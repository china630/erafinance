import { upsertByCode } from "../seeds/_engine/upsert";

type Row = Record<string, unknown>;

describe("upsertByCode idempotency", () => {
  it("keeps unique rows stable on repeated runs", async () => {
    const rows = new Map<string, Row>();
    const model = {
      async upsert(args: { where: { code: string }; create: Row; update: Row }) {
        const key = args.where.code;
        const prev = rows.get(key);
        rows.set(key, prev ? { ...prev, ...args.update } : { ...args.create });
      },
    };

    const data = [
      { code: "AZN", name: "Azerbaijani manat" },
      { code: "USD", name: "US dollar" },
      { code: "EUR", name: "Euro" },
    ];

    await upsertByCode(model, data, (x) => x);
    const firstSize = rows.size;
    await upsertByCode(model, data, (x) => x);

    expect(firstSize).toBe(3);
    expect(rows.size).toBe(3);
    expect(rows.get("AZN")?.name).toBe("Azerbaijani manat");
  });
});
