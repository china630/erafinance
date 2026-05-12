import { Prisma } from "@erafinance/database";
import { decryptText } from "../security/pii-crypto.util";

function applyPiiFallbackToRow(row: Record<string, unknown>): void {
  const setFromCipherPreferred = (plainKey: string, cipherKey: string) => {
    const cipher = row[cipherKey];
    if (typeof cipher === "string") {
      const decoded = decryptText(cipher);
      if (decoded != null) row[plainKey] = decoded;
    }
  };

  setFromCipherPreferred("taxId", "taxIdCipher");
  setFromCipherPreferred("firstName", "firstNameCipher");
  setFromCipherPreferred("lastName", "lastNameCipher");
  setFromCipherPreferred("fullName", "fullNameCipher");
  setFromCipherPreferred("finCode", "finCodeCipher");
  setFromCipherPreferred("voen", "voenCipher");
  setFromCipherPreferred("name", "nameCipher");

  // Keep backward-compatible display contract while full_name plaintext column is removed.
  if (typeof row.fullName !== "string" || !row.fullName.trim()) {
    const first = typeof row.firstName === "string" ? row.firstName.trim() : "";
    const last = typeof row.lastName === "string" ? row.lastName.trim() : "";
    const combined = [first, last].filter(Boolean).join(" ").trim();
    if (combined) {
      row.fullName = combined;
    }
  }
}

function walkAndApply(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkAndApply(item);
    return;
  }
  const row = value as Record<string, unknown>;
  applyPiiFallbackToRow(row);
  for (const nested of Object.values(row)) {
    walkAndApply(nested);
  }
}

export const prismaPiiReadFallbackExtension = Prisma.defineExtension((client: any) =>
  client.$extends({
    name: "piiReadFallback",
    query: {
      $allModels: {
        async $allOperations({
          operation,
          args,
          query,
        }: {
          operation: string;
          args: unknown;
          query: (a: unknown) => Promise<unknown>;
        }) {
          const res = await query(args);
          // Cover typical read & mutation returns; no-op for aggregates/counts.
          if (
            operation === "findMany" ||
            operation === "findFirst" ||
            operation === "findUnique" ||
            operation === "findFirstOrThrow" ||
            operation === "findUniqueOrThrow" ||
            operation === "create" ||
            operation === "update" ||
            operation === "upsert" ||
            operation === "createManyAndReturn" ||
            operation === "updateManyAndReturn"
          ) {
            walkAndApply(res);
          }
          return res;
        },
      },
    },
  }),
);
