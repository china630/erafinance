import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATALOG_PATH = join(__dirname, "..", "prisma", "catalog", "trade", "customs-tariff-rates.json");

type SeedRow = {
  hsCode: string;
  description: string;
  dutyRatePercent: number;
  vatRatePercent: number;
  excisePercent: number;
};

async function main() {
  const prisma = new PrismaClient();
  const rows = JSON.parse(readFileSync(CATALOG_PATH, "utf-8")) as SeedRow[];
  const effectiveFrom = new Date("2000-01-01T00:00:00.000Z");
  try {
    for (const r of rows) {
      const hs = r.hsCode.replace(/\D/g, "").trim();
      if (!hs) continue;
      await prisma.customsTariffRate.upsert({
        where: {
          hsCode_effectiveFrom: { hsCode: hs, effectiveFrom },
        },
        create: {
          hsCode: hs,
          description: r.description,
          dutyRatePercent: new Prisma.Decimal(r.dutyRatePercent),
          vatRatePercent: new Prisma.Decimal(r.vatRatePercent),
          excisePercent: new Prisma.Decimal(r.excisePercent),
          effectiveFrom,
        },
        update: {
          description: r.description,
          dutyRatePercent: new Prisma.Decimal(r.dutyRatePercent),
          vatRatePercent: new Prisma.Decimal(r.vatRatePercent),
          excisePercent: new Prisma.Decimal(r.excisePercent),
          deletedAt: null,
        },
      });
    }
    console.log(`customs_tariff_rates from ${CATALOG_PATH}: ${rows.length} rows`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
