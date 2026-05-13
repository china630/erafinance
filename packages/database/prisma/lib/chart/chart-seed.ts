import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AccountType,
  LedgerType,
  OrganizationKind,
  PrismaClient,
  type Prisma,
} from "@prisma/client";

/** One row of NAS chart JSON / template seed. */
export type ChartAccountSeed = {
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  type: keyof typeof AccountType | AccountType;
  parentCode?: string | null;
};

export type ChartOfAccountsFile = {
  accounts: ChartAccountSeed[];
  meta?: Record<string, unknown>;
};

function toAccountType(value: string): AccountType {
  const upper = String(value).toUpperCase();
  if (upper in AccountType) {
    return AccountType[upper as keyof typeof AccountType];
  }
  throw new Error(`Unknown AccountType: ${value}`);
}

/** Normalize JSON row (legacy `name` → AZ/RU/EN; `nameEn` may fall back to `nameAz`). */
export function normalizeChartAccountSeedRow(raw: Record<string, unknown>): ChartAccountSeed {
  const code = String(raw.code ?? "").trim();
  if (!code) throw new Error("Chart row: missing code");
  const type = String(raw.type ?? "ASSET");
  const parentCode =
    raw.parentCode != null && String(raw.parentCode).trim() !== ""
      ? String(raw.parentCode).trim()
      : null;
  const nameAz = String(raw.nameAz ?? raw.name_az ?? "").trim();
  const nameRu = String(raw.nameRu ?? raw.name_ru ?? "").trim();
  const nameEn = String(raw.nameEn ?? raw.name_en ?? "").trim();
  const legacyName = String(raw.name ?? "").trim();
  const az = nameAz || legacyName;
  const ru = nameRu || legacyName;
  const en = nameEn || legacyName || az;
  if (!az || !ru) {
    throw new Error(`Chart row ${code}: nameAz/nameRu (or legacy name) required`);
  }
  return { code, nameAz: az, nameRu: ru, nameEn: en, type: type as ChartAccountSeed["type"], parentCode };
}

/**
 * Path to `prisma/catalog/national/chart-of-accounts-{commercial|budget|ngo}.json`.
 * Works when this module is loaded from compiled `dist/lib/chart/` or from source `prisma/lib/chart/`.
 */
export function chartOfAccountsJsonPath(kind: OrganizationKind): string {
  const slug = kind.toLowerCase();
  return join(
    __dirname,
    "..",
    "..",
    "..",
    "prisma",
    "catalog",
    "national",
    `chart-of-accounts-${slug}.json`,
  );
}

/**
 * Load chart rows for one `OrganizationKind` from catalog JSON (required at runtime for seeds/API).
 */
export async function loadChartJson(kind: OrganizationKind): Promise<ChartAccountSeed[]> {
  const path = chartOfAccountsJsonPath(kind);
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw) as ChartOfAccountsFile;
  if (!parsed?.accounts?.length) {
    throw new Error(`Chart JSON empty or invalid: ${path}`);
  }
  return (parsed.accounts as Record<string, unknown>[]).map(normalizeChartAccountSeedRow);
}

/**
 * Copies platform `chart_of_accounts_entries` into tenant `accounts` for one organization.
 */
export async function seedChartOfAccountsForOrganization(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  accounts: ChartAccountSeed[],
  kind: OrganizationKind = OrganizationKind.COMMERCIAL,
): Promise<void> {
  if (accounts.length === 0) {
    return;
  }

  const byCode = new Map<string, { data: ChartAccountSeed; id?: string }>();
  for (const row of accounts) {
    byCode.set(row.code, { data: row });
  }

  const roots = accounts.filter((a) => !a.parentCode);
  const children = accounts.filter((a) => a.parentCode);

  async function upsertOne(row: ChartAccountSeed, parentId: string | null) {
    const type = toAccountType(row.type as string);
    const catalogRow = await db.chartOfAccountsEntry.findFirst({
      where: { kind, code: row.code },
    });
    const account = await db.account.upsert({
      where: {
        organizationId_code_ledgerType: {
          organizationId,
          code: row.code,
          ledgerType: LedgerType.NAS,
        },
      },
      create: {
        organizationId,
        code: row.code,
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        type,
        ledgerType: LedgerType.NAS,
        parentId,
        chartEntryId: catalogRow?.id ?? null,
      },
      update: {
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        type,
        parentId,
        ...(catalogRow && { chartEntryId: catalogRow.id }),
      },
    });
    const entry = byCode.get(row.code);
    if (entry) entry.id = account.id;
    return account;
  }

  for (const row of roots) {
    await upsertOne(row, null);
  }

  let remaining = [...children];
  let guard = 0;
  while (remaining.length > 0 && guard < accounts.length + 10) {
    guard += 1;
    const next: ChartAccountSeed[] = [];
    for (const row of remaining) {
      const parent = row.parentCode ? byCode.get(row.parentCode) : undefined;
      const parentId = parent?.id ?? null;
      if (!row.parentCode || parentId) {
        await upsertOne(row, parentId);
      } else {
        next.push(row);
      }
    }
    if (next.length === remaining.length) {
      throw new Error(
        `Chart of accounts: unresolved parentCode references: ${next.map((r) => r.code).join(", ")}`,
      );
    }
    remaining = next;
  }
}

/** Global `chart_of_accounts_entries` upsert from the same JSON as org accounts. */
export async function seedChartOfAccountsCatalogEntries(
  db: PrismaClient | Prisma.TransactionClient,
  accounts: ChartAccountSeed[],
  kind: OrganizationKind = OrganizationKind.COMMERCIAL,
): Promise<void> {
  const seen = new Set<string>();
  for (const row of accounts) {
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    const type = toAccountType(row.type as string);
    const cashProfile = cashProfileForNasCode(kind, row.code);
    await db.chartOfAccountsEntry.upsert({
      where: {
        kind_code: {
          kind,
          code: row.code,
        },
      },
      create: {
        kind,
        code: row.code,
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        accountType: type,
        parentCode: row.parentCode?.trim() || null,
        cashProfile,
        sortOrder: 0,
        isDeprecated: false,
      },
      update: {
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        accountType: type,
        parentCode: row.parentCode?.trim() || null,
        cashProfile,
      },
    });
  }
}

export async function loadChartTemplateFromDb(
  db: PrismaClient | Prisma.TransactionClient,
  kind: OrganizationKind = OrganizationKind.COMMERCIAL,
): Promise<ChartAccountSeed[]> {
  const rows = await db.chartOfAccountsEntry.findMany({
    where: { isDeprecated: false, kind },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  return rows.map((r) => ({
    code: r.code,
    nameAz: r.nameAz,
    nameRu: r.nameRu,
    nameEn: r.nameEn,
    type: r.accountType,
    parentCode: r.parentCode?.trim() || null,
  }));
}

/**
 * Sync org NAS from DB catalog or seed catalog from JSON when empty.
 */
export async function syncChartForOrganization(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  kind: OrganizationKind = OrganizationKind.COMMERCIAL,
): Promise<void> {
  const catalogCount = await db.chartOfAccountsEntry.count({
    where: { kind },
  });
  let accounts: ChartAccountSeed[];
  if (catalogCount > 0) {
    accounts = await loadChartTemplateFromDb(db, kind);
  } else {
    accounts = await loadChartJson(kind);
    await seedChartOfAccountsCatalogEntries(db, accounts, kind);
  }
  await seedChartOfAccountsForOrganization(db, organizationId, accounts, kind);
}

/** @deprecated Use `syncChartForOrganization`. */
export async function syncAzChartForOrganization(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  kind: OrganizationKind = OrganizationKind.COMMERCIAL,
): Promise<void> {
  return syncChartForOrganization(db, organizationId, kind);
}

/** Payroll / legacy `settings.templateGroup` (COMMERCIAL | GOVERNMENT). */
export function organizationKindToPayrollSettingsTemplateGroup(
  kind: OrganizationKind,
): "COMMERCIAL" | "GOVERNMENT" {
  if (kind === OrganizationKind.BUDGET) return "GOVERNMENT";
  return "COMMERCIAL";
}

export function cashProfileForNasCode(kind: OrganizationKind, code: string): string | null {
  if (kind === OrganizationKind.BUDGET) {
    if (code === "101" || code.startsWith("101.")) return "AZN";
    if (code === "102" || code.startsWith("102.")) return "FX";
    return null;
  }
  if (kind === OrganizationKind.NGO) {
    if (code === "221" || code.startsWith("221.")) return "AZN";
    if (code === "222" || code.startsWith("222.")) return "FX";
    return null;
  }
  // COMMERCIAL — ERA harmonized (101 kassa, 102 FX cash)
  if (code === "101" || code.startsWith("101.")) return "AZN";
  if (code === "102" || code.startsWith("102.")) return "FX";
  return null;
}

/**
 * Global `template_accounts`: upsert all three NAS variants from catalog JSON.
 */
export async function upsertGlobalNasTemplateAccounts(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<number> {
  let total = 0;
  for (const kind of [
    OrganizationKind.COMMERCIAL,
    OrganizationKind.BUDGET,
    OrganizationKind.NGO,
  ]) {
    const rows = await loadChartJson(kind);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const type = toAccountType(String(row.type));
      const cashProfile = cashProfileForNasCode(kind, row.code);
      await db.templateAccount.upsert({
        where: {
          kind_code: {
            kind,
            code: row.code,
          },
        },
        create: {
          kind,
          code: row.code,
          nameAz: row.nameAz,
          nameRu: row.nameRu,
          nameEn: row.nameEn,
          accountType: type,
          parentCode: row.parentCode?.trim() || null,
          cashProfile,
          sortOrder: total,
          isDeprecated: false,
        },
        update: {
          nameAz: row.nameAz,
          nameRu: row.nameRu,
          nameEn: row.nameEn,
          accountType: type,
          parentCode: row.parentCode?.trim() || null,
          cashProfile,
          sortOrder: total,
        },
      });
      total += 1;
    }
  }
  return total;
}

export async function seedOrganizationNasFromTemplateAccounts(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  kind: OrganizationKind,
): Promise<void> {
  const tplRows = await db.templateAccount.findMany({
    where: {
      isDeprecated: false,
      kind,
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
  if (tplRows.length === 0) {
    return;
  }

  const byCode = new Map<string, { row: (typeof tplRows)[0]; id?: string }>();
  for (const row of tplRows) {
    byCode.set(row.code, { row });
  }

  const roots = tplRows.filter((a) => !a.parentCode?.trim());
  const children = tplRows.filter((a) => a.parentCode?.trim());

  async function upsertOne(row: (typeof tplRows)[0], parentId: string | null) {
    const catalogRow = await db.chartOfAccountsEntry.findFirst({
      where: { kind, code: row.code },
    });
    const account = await db.account.upsert({
      where: {
        organizationId_code_ledgerType: {
          organizationId,
          code: row.code,
          ledgerType: LedgerType.NAS,
        },
      },
      create: {
        organizationId,
        code: row.code,
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        type: row.accountType,
        ledgerType: LedgerType.NAS,
        parentId,
        chartEntryId: catalogRow?.id ?? null,
        templateAccountId: row.id,
      },
      update: {
        nameAz: row.nameAz,
        nameRu: row.nameRu,
        nameEn: row.nameEn,
        type: row.accountType,
        parentId,
        ...(catalogRow ? { chartEntryId: catalogRow.id } : {}),
        templateAccountId: row.id,
      },
    });
    const entry = byCode.get(row.code);
    if (entry) entry.id = account.id;
    return account;
  }

  for (const row of roots) {
    await upsertOne(row, null);
  }

  let remaining = [...children];
  let guard = 0;
  while (remaining.length > 0 && guard < tplRows.length + 10) {
    guard += 1;
    const next: typeof tplRows = [];
    for (const row of remaining) {
      const parent = row.parentCode?.trim()
        ? byCode.get(row.parentCode.trim())
        : undefined;
      const parentId = parent?.id ?? null;
      if (!row.parentCode?.trim() || parentId) {
        await upsertOne(row, parentId);
      } else {
        next.push(row);
      }
    }
    if (next.length === remaining.length) {
      throw new Error(
        `Template NAS: unresolved parentCode: ${next.map((r) => r.code).join(", ")}`,
      );
    }
    remaining = next;
  }
}

/**
 * Onboarding: copy from `template_accounts` for `kind` when rows exist; otherwise seed from JSON.
 */
export async function provisionNasAccountsForOrganization(
  db: PrismaClient | Prisma.TransactionClient,
  organizationId: string,
  kind: OrganizationKind,
): Promise<void> {
  const countForKind = await db.templateAccount.count({ where: { kind } });
  if (countForKind === 0) {
    await syncChartForOrganization(db, organizationId, kind);
    return;
  }
  await seedOrganizationNasFromTemplateAccounts(db, organizationId, kind);
}

export function pickAccountDisplayName(
  row: { nameAz: string; nameRu: string; nameEn: string },
  locale?: string | null,
): string {
  const raw = (locale ?? "az").trim().toLowerCase();
  const two = raw.startsWith("en") ? "en" : raw.startsWith("ru") ? "ru" : "az";
  if (two === "ru") return row.nameRu || row.nameAz;
  if (two === "en") return row.nameEn || row.nameAz;
  return row.nameAz || row.nameRu;
}
