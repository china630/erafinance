import type { PrismaClient } from "@prisma/client";

type Counter = { created: number; updated: number; total: number };

export async function upsertByCode<
  TRow extends { code: string },
  TModel extends { upsert: (args: unknown) => Promise<unknown> },
>(
  model: TModel,
  rows: ReadonlyArray<TRow>,
  create: (row: TRow) => Record<string, unknown>,
  update: (row: TRow) => Record<string, unknown> = create,
): Promise<Counter> {
  let total = 0;
  for (const row of rows) {
    await model.upsert({
      where: { code: row.code },
      create: create(row),
      update: update(row),
    } as never);
    total += 1;
  }
  return { created: 0, updated: total, total };
}

export type SeedContext = {
  prisma: PrismaClient;
  region: string;
  dryRun: boolean;
  only?: string | undefined;
};
