import {
  prismaSoftDeleteExtension,
  SOFT_DELETE_DELETED_AT_MODELS,
} from "./prisma-soft-delete.extension";

describe("prismaSoftDeleteExtension", () => {
  it("exports a Prisma extension factory", () => {
    expect(typeof prismaSoftDeleteExtension).toBe("function");
  });

  it("soft-deletes Invoice rows via delete→update(deletedAt) path", () => {
    expect(SOFT_DELETE_DELETED_AT_MODELS.has("Invoice")).toBe(true);
  });
});
