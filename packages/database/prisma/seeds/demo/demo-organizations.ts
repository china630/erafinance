import bcrypt from "bcrypt";
import {
  CounterpartyLegalForm,
  OrganizationKind,
  Prisma,
  TariffTier,
  UserRole,
} from "@prisma/client";
import { provisionNasAccountsForOrganization } from "../../lib/chart/chart-seed";
import { PRICING_MODULE_SEED_DEFAULTS } from "../../lib/core/pricing-module-seed";
import {
  blindIndexVoenForSeed,
  encryptVoenForSeed,
  normalizeVoenForSeed,
} from "../../lib/demo/pii-for-org-seed";
import { PLATFORM_SUPER_ADMIN_EMAILS } from "../../lib/platform/upsert-platform-super-admins";
import type { SeedContext } from "../_engine/upsert";

const BCRYPT_ROUNDS = 10;

/** Default local demo owner (not a platform super-admin). */
const DEFAULT_DEMO_OWNER_EMAIL = "demo.owner@erafinance.local";
const DEFAULT_DEMO_OWNER_PASSWORD = "DemoLocal#2026";

const DEMO_ORGS: ReadonlyArray<{
  name: string;
  /** 10-digit test VÖEN; must stay unique in DB (global blind index). */
  taxId: string;
  legalAddress: string;
  phone: string;
  directorName: string;
}> = [
  {
    name: "Demo MMC Alpha (local)",
    taxId: "9900000001",
    legalAddress: "Bakı, Nəsimi rayonu (demo)",
    phone: "+994501112233",
    directorName: "Demo Director Alpha",
  },
  {
    name: "Demo MMC Beta (local)",
    taxId: "9900000002",
    legalAddress: "Bakı, Yasamal rayonu (demo)",
    phone: "+994501112244",
    directorName: "Demo Director Beta",
  },
];

function demoActiveModules(): string[] {
  return [
    ...new Set<string>([
      "nas",
      "ifrs",
      "production",
      ...PRICING_MODULE_SEED_DEFAULTS.map((m) => m.key),
    ]),
  ];
}

async function upsertDemoOwnerUser(
  prisma: SeedContext["prisma"],
  email: string,
  password: string,
): Promise<{ id: string }> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    create: {
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      isSuperAdmin: false,
      locale: "AZ",
    },
    update: {
      passwordHash: hash,
    },
    select: { id: true },
  });
}

/** Extra logins that should see demo orgs under /companies (comma-separated emails). */
function parseExtraDemoMemberEmails(): string[] {
  const raw = process.env.SEED_DEMO_EXTRA_MEMBER_EMAILS?.trim();
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
}

/**
 * Super-admins (and optional `SEED_DEMO_EXTRA_MEMBER_EMAILS`) get ADMIN on each demo org so
 * local testing under a real account is not limited to `SEED_DEMO_USER_EMAIL` only.
 */
async function attachDemoOrgMembershipsForLocalTesters(
  prisma: SeedContext["prisma"],
  organizationIds: string[],
  demoOwnerUserId: string,
): Promise<void> {
  if (organizationIds.length === 0) return;

  const extra = parseExtraDemoMemberEmails();
  const emails = [
    ...new Set<string>([...PLATFORM_SUPER_ADMIN_EMAILS, ...extra]),
  ];

  for (const emailRaw of emails) {
    const email = emailRaw.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      console.info(`[seed:demo-org] skip attach — no user: ${email}`);
      continue;
    }
    if (user.id === demoOwnerUserId) continue;

    for (const organizationId of organizationIds) {
      const existing = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId },
        },
      });
      if (existing) continue;
      await prisma.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId,
          role: UserRole.ADMIN,
        },
      });
      console.info(`[seed:demo-org] attached ADMIN: ${email} → org ${organizationId}`);
    }
  }
}

async function ensureDemoSubscription(
  prisma: SeedContext["prisma"],
  organizationId: string,
  modules: string[],
): Promise<void> {
  await prisma.organizationSubscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      currentTier: TariffTier.TIER_3,
      activeModules: modules,
      isTrial: false,
      isBlocked: false,
      expiresAt: new Date("2099-12-31T23:59:59.000Z"),
      customConfig: { modules } as Prisma.InputJsonValue,
    },
    update: {
      currentTier: TariffTier.TIER_3,
      activeModules: modules,
      isBlocked: false,
      expiresAt: new Date("2099-12-31T23:59:59.000Z"),
      customConfig: { modules } as Prisma.InputJsonValue,
    },
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { activeModules: modules },
  });

  for (const key of modules) {
    await prisma.organizationModule.upsert({
      where: {
        organizationId_moduleKey: { organizationId, moduleKey: key },
      },
      create: {
        organizationId,
        moduleKey: key,
        priceSnapshot: new Prisma.Decimal(0),
      },
      update: {},
    });
  }
}

/**
 * When `SEED_DEMO_ORG=1` (e.g. `npm run db:seed:demo` from repo root): lightweight **stub** MMC orgs
 * for local login / companies smoke tests — **not** the TiVi Media/Sport showcase (that is
 * `npm run seed:local -w @erafinance/api`). For both: `npm run db:seed:showcase` from repo root.
 *
 * Creates a demo owner user and two commercial organizations with NAS + ENTERPRISE-style modules.
 *
 * Env (optional):
 * - `SEED_DEMO_USER_EMAIL` — owner email (default {@link DEFAULT_DEMO_OWNER_EMAIL})
 * - `SEED_DEMO_USER_PASSWORD` — bcrypt source (default {@link DEFAULT_DEMO_OWNER_PASSWORD})
 * - `SEED_DEMO_EXTRA_MEMBER_EMAILS` — optional comma-separated emails that receive ADMIN on each demo org
 */
export async function seedDemoOrganizations(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  if (process.env.SEED_DEMO_ORG !== "1") return;

  const email =
    process.env.SEED_DEMO_USER_EMAIL?.trim().toLowerCase() || DEFAULT_DEMO_OWNER_EMAIL;
  const password =
    process.env.SEED_DEMO_USER_PASSWORD?.trim() || DEFAULT_DEMO_OWNER_PASSWORD;

  const owner = await upsertDemoOwnerUser(ctx.prisma, email, password);
  const modules = demoActiveModules();
  const demoOrganizationIds: string[] = [];

  for (const cfg of DEMO_ORGS) {
    const voen = normalizeVoenForSeed(cfg.taxId);
    if (voen.length !== 10) {
      console.warn(`[seed:demo-org] skip invalid VÖEN for "${cfg.name}": ${cfg.taxId}`);
      continue;
    }
    const taxIdBlindIndex = blindIndexVoenForSeed(voen);
    const existing = await ctx.prisma.organization.findFirst({
      where: { taxIdBlindIndex },
      select: { id: true },
    });
    if (existing) {
      demoOrganizationIds.push(existing.id);
      console.info(`[seed:demo-org] exists: ${cfg.name} (${existing.id})`);
      continue;
    }

    const taxIdCipher = encryptVoenForSeed(voen);

    const org = await ctx.prisma.$transaction(async (tx) => {
      const o = await tx.organization.create({
        data: {
          name: cfg.name,
          taxIdCipher,
          taxIdBlindIndex,
          currency: "AZN",
          legalAddress: cfg.legalAddress,
          phone: cfg.phone,
          directorName: cfg.directorName,
          ownerId: owner.id,
          kind: OrganizationKind.COMMERCIAL,
          legalForm: CounterpartyLegalForm.LLC,
          activeModules: modules,
          settings: { erafinanceDemoSeed: true } as Prisma.InputJsonValue,
        },
      });

      await tx.organizationMembership.create({
        data: {
          userId: owner.id,
          organizationId: o.id,
          role: UserRole.OWNER,
        },
      });

      return o;
    });

    demoOrganizationIds.push(org.id);
    await ensureDemoSubscription(ctx.prisma, org.id, modules);
    await provisionNasAccountsForOrganization(ctx.prisma, org.id, OrganizationKind.COMMERCIAL);
    console.info(`[seed:demo-org] created: ${cfg.name} (${org.id}) voen=${voen}`);
  }

  await attachDemoOrgMembershipsForLocalTesters(ctx.prisma, demoOrganizationIds, owner.id);

  console.info(
    `[seed:demo-org] demo owner: ${email} (password: env SEED_DEMO_USER_PASSWORD or built-in default for local — see prisma/seeds/demo/demo-organizations.ts)`,
  );
}
