import { closePrismaPool, createPrismaClient } from "./prisma-client";
import { parseSeedCli } from "./seeds/_engine/cli";
import { resolveRegion } from "./seeds/_engine/region";
import { runSeedLayers } from "./seeds/_engine/runner";

async function main() {
  const prisma = createPrismaClient();
  const cli = parseSeedCli(process.argv.slice(2));
  await runSeedLayers(prisma, {
    layers: cli.layers,
    skip: cli.skip,
    region: resolveRegion(cli.region),
    dryRun: cli.dryRun,
    only: cli.only,
  });
  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await closePrismaPool();
  });
