import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OrganizationKind } from "@prisma/client";
import {
  cashProfileForNasCode,
  normalizeChartAccountSeedRow,
  organizationKindToPayrollSettingsTemplateGroup,
  type ChartOfAccountsFile,
} from "./chart-seed";

function loadJsonFile(relFromLib: string): ChartOfAccountsFile {
  const p = join(__dirname, relFromLib);
  return JSON.parse(readFileSync(p, "utf-8")) as ChartOfAccountsFile;
}

function validateAccounts(accounts: ReturnType<typeof normalizeChartAccountSeedRow>[]) {
  const codes = new Set<string>();
  for (const a of accounts) {
    expect(a.code.length).toBeGreaterThan(0);
    expect(codes.has(a.code)).toBe(false);
    codes.add(a.code);
  }
  const byCode = new Map(accounts.map((r) => [r.code, r]));
  for (const a of accounts) {
    if (a.parentCode) {
      expect(byCode.has(a.parentCode)).toBe(true);
    }
  }
}

describe("chart-seed NAS JSON catalogs", () => {
  it.each([
    ["commercial", OrganizationKind.COMMERCIAL],
    ["budget", OrganizationKind.BUDGET],
    ["ngo", OrganizationKind.NGO],
  ] as const)("loads %s chart", (_slug, kind) => {
    const slug = kind.toLowerCase();
    const parsed = loadJsonFile(`../../catalog/national/chart-of-accounts-${slug}.json`);
    expect(parsed.accounts.length).toBeGreaterThan(0);
    const rows = (parsed.accounts as Record<string, unknown>[]).map(normalizeChartAccountSeedRow);
    validateAccounts(rows);
  });

  it("maps OrganizationKind to payroll settings.templateGroup", () => {
    expect(organizationKindToPayrollSettingsTemplateGroup(OrganizationKind.COMMERCIAL)).toBe(
      "COMMERCIAL",
    );
    expect(organizationKindToPayrollSettingsTemplateGroup(OrganizationKind.NGO)).toBe(
      "COMMERCIAL",
    );
    expect(organizationKindToPayrollSettingsTemplateGroup(OrganizationKind.BUDGET)).toBe(
      "GOVERNMENT",
    );
  });

  it("assigns cash profiles by kind (101 kassa for commercial/budget; 221 for NGO)", () => {
    expect(cashProfileForNasCode(OrganizationKind.BUDGET, "101")).toBe("AZN");
    expect(cashProfileForNasCode(OrganizationKind.COMMERCIAL, "101")).toBe("AZN");
    expect(cashProfileForNasCode(OrganizationKind.NGO, "221")).toBe("AZN");
  });

  it("BUDGET chart includes account 101 (government cash)", () => {
    const parsed = loadJsonFile("../../catalog/national/chart-of-accounts-budget.json");
    const codes = new Set(
      (parsed.accounts as Record<string, unknown>[]).map((r) => String(r.code ?? "").trim()),
    );
    expect(codes.has("101")).toBe(true);
  });
});
