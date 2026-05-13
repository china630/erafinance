import type { PrismaClient } from "@prisma/client";
import type { SeedContext } from "./upsert";
import { seedBank } from "../bank";
import { seedCore } from "../core";
import { seedGeo } from "../geo";
import { seedHr } from "../hr";
import { seedNational } from "../national";
import { seedTrade } from "../trade";
import { seedDemoOrganizations } from "../demo/demo-organizations";

export async function runSeedLayers(
  prisma: PrismaClient,
  options: { layers: string[]; skip: Set<string>; region: string; dryRun: boolean; only?: string },
): Promise<void> {
  const ctx: SeedContext = {
    prisma,
    region: options.region,
    dryRun: options.dryRun,
    only: options.only,
  };

  const handlers: Record<string, (x: SeedContext) => Promise<void>> = {
    core: seedCore,
    geo: seedGeo,
    "geo-light": seedGeo,
    bank: seedBank,
    national: seedNational,
    hr: seedHr,
    trade: seedTrade,
  };

  for (const layer of options.layers) {
    if (options.skip.has(layer)) continue;
    const fn = handlers[layer];
    if (!fn) {
      console.info(`[seed] unknown layer "${layer}" - skip`);
      continue;
    }
    const t0 = Date.now();
    await fn(ctx);
    console.info(`[seed] layer ${layer} done in ${Date.now() - t0}ms`);
  }

  if (process.env.SEED_DEMO_ORG === "1" && !options.dryRun && !options.skip.has("demo-org")) {
    const t0 = Date.now();
    await seedDemoOrganizations(ctx);
    console.info(`[seed] demo-org layer done in ${Date.now() - t0}ms`);
  }
}
