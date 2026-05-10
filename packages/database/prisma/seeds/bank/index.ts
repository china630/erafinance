import type { SeedContext } from "../_engine/upsert";
import { seedBankGlossary } from "../../lib/bank/bank-glossary-seed";
import { seedBankBranchRows } from "../../lib/bank/banks-md-importer";
import { BANK_BRANCH_SEED_ROWS } from "../../catalog/bank/bank-branches.generated";

export async function seedBank(ctx: SeedContext): Promise<void> {
  if (ctx.dryRun) return;
  await seedBankGlossary(ctx.prisma);
  const { branchUpserts } = await seedBankBranchRows(
    ctx.prisma,
    BANK_BRANCH_SEED_ROWS,
  );
  console.info(`[seed:bank] bank branch catalog upserts=${branchUpserts}`);
}
