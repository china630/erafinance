import {
  normalizeBankName,
  normalizePhones,
  normalizeIban,
  normalizeVoen,
  normalizeBranchCode,
  normalizeSwift,
  normalizeAddress,
  parseBanksMd,
} from "../lib/bank/banks-md-parser";

describe("normalizeBankName", () => {
  it.each<[string, string]>([
    ["AzərbaycanBeynəlxalq Bankı ASC", "Azərbaycan Beynəlxalq Bankı ASC"],
    ["Bank of Baku ASC", "Bank of Baku ASC"],
    ["Yapı Kredi BankAzərbaycan QSC", "Yapı Kredi Bank Azərbaycan QSC"],
    ["Mingəçevir filialı", "Mingəçevir filialı"],
    ["Cəfər Cabbarlı küçəsi,40C", "Cəfər Cabbarlı küçəsi,40C"],
    ["  Bank   Avrasiya   ASC  ", "Bank Avrasiya ASC"],
    ["", ""],
  ])("normalizes %j → %j", (input, expected) => {
    expect(normalizeBankName(input)).toBe(expected);
  });
});

describe("normalizePhones", () => {
  it("splits on `;` and removes spaces/dashes", () => {
    const r = normalizePhones("+994124934159; +994 124-934-091");
    expect(r.phones).toEqual(["+994124934159", "+994124934091"]);
    expect(r.invalid).toEqual([]);
  });

  it("accepts short internal numbers (3-4 digits)", () => {
    const r = normalizePhones("132;+994125612288");
    expect(r.phones).toContain("132");
    expect(r.phones).toContain("+994125612288");
  });

  it("filters out malformed tokens", () => {
    const r = normalizePhones("abc;++994 ;+99412");
    expect(r.phones).toEqual([]);
    expect(r.invalid.length).toBeGreaterThan(0);
  });

  it("dedupes repeated phones", () => {
    const r = normalizePhones("+994124934159;+994124934159");
    expect(r.phones).toEqual(["+994124934159"]);
  });

  it("returns empty arrays for null/empty input", () => {
    expect(normalizePhones(null)).toEqual({ phones: [], invalid: [] });
    expect(normalizePhones("")).toEqual({ phones: [], invalid: [] });
  });
});

describe("normalizeIban / VÖEN / branchCode / SWIFT", () => {
  it("validates IBAN AZ + 24 chars", () => {
    expect(normalizeIban("AZ03NABZ01350100000000002944")).toBe(
      "AZ03NABZ01350100000000002944",
    );
    expect(normalizeIban("az03 NABZ 0135 0100 0000 0000 2944")).toBe(
      "AZ03NABZ01350100000000002944",
    );
    expect(normalizeIban("BG03NABZ01350100000000002944")).toBeNull();
    expect(normalizeIban("AZ03")).toBeNull();
  });

  it("requires VÖEN to be exactly 10 digits", () => {
    expect(normalizeVoen("9900003241")).toBe("9900003241");
    expect(normalizeVoen("9900-003-241")).toBe("9900003241");
    expect(normalizeVoen("12345")).toBeNull();
    expect(normalizeVoen("12345678901")).toBeNull();
    expect(normalizeVoen(undefined)).toBeNull();
  });

  it("accepts 4-7 digit branch codes", () => {
    expect(normalizeBranchCode("805250")).toBe("805250");
    expect(normalizeBranchCode("200004")).toBe("200004");
    expect(normalizeBranchCode("99")).toBeNull();
    expect(normalizeBranchCode("12345678")).toBeNull();
  });

  it("validates SWIFT codes", () => {
    expect(normalizeSwift("AIIBAZ2X")).toBe("AIIBAZ2X");
    expect(normalizeSwift("PAHAAZ22")).toBe("PAHAAZ22");
    expect(normalizeSwift("not-swift")).toBeNull();
    expect(normalizeSwift("")).toBeNull();
  });

  it("normalizes address whitespace", () => {
    expect(normalizeAddress("Bakı şəhəri,  Nizami\u00a0küçəsi, 67")).toBe(
      "Bakı şəhəri, Nizami küçəsi, 67",
    );
    expect(normalizeAddress("")).toBeNull();
    expect(normalizeAddress(null)).toBeNull();
  });
});

describe("parseBanksMd", () => {
  it("parses a head bank with branches and resolves the parent", () => {
    const md = `
| 9 | AzərbaycanBeynəlxalq Bankı ASC | AZ03NABZ01350100000000002944 | 805250 | 9900001881 | IBAZAZ2X | +994124934159;+994124930091 | Bakı şəhəri, Nizami küçəsi, 67 |
| 9.1 | Ağsu filialı | AZ03NABZ01350100000000002944 | 805904 | 9900001881 | IBAZAZ2X | +994202265130 | Ağsu şəhəri, Ü.Hacıbəyov küçəsi,29A |
| 9.2 | Mingəçevir filialı | AZ03NABZ01350100000000002944 | 805272 | 9900001881 | IBAZAZ2X | +994242740051 | Mingəçevir şəhəri |
`;
    const r = parseBanksMd(md);
    expect(r.warnings).toEqual([]);
    expect(r.banks).toHaveLength(1);
    const bank = r.banks[0]!;
    expect(bank.rowIndex).toBe(9);
    expect(bank.voen).toBe("9900001881");
    expect(bank.swift).toBe("IBAZAZ2X");
    expect(bank.correspondentIban).toBe("AZ03NABZ01350100000000002944");
    expect(bank.branchCode).toBe("805250");
    expect(bank.phones).toEqual(["+994124934159", "+994124930091"]);
    expect(bank.nameAz).toBe("Azərbaycan Beynəlxalq Bankı ASC");
    expect(bank.branches).toHaveLength(2);
    expect(bank.branches[0]!.subIndex).toBe(1);
    expect(bank.branches[0]!.branchCode).toBe("805904");
  });

  it("emits warning when branch precedes its head bank", () => {
    const md = `
| 9.1 | Orphan filialı | AZ03NABZ01350100000000002944 | 805904 | 9900001881 | IBAZAZ2X |  |  |
`;
    const r = parseBanksMd(md);
    expect(r.banks).toEqual([]);
    expect(r.warnings.some((w) => w.includes("precedes"))).toBe(true);
  });

  it("skips head with invalid IBAN/VÖEN", () => {
    const md = `
| 9 | Bad Bank | INVALID-IBAN | 805250 | 99-bad | XX |  |  |
| 10 | Good Bank ASC | AZ37NABZ01350100000000001944 | 200004 | 9900003611 | AIIBAZ2X | +994124931882 | Bakı |
`;
    const r = parseBanksMd(md);
    expect(r.banks).toHaveLength(1);
    expect(r.banks[0]!.voen).toBe("9900003611");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("accepts empty trailing cells (no phones / no address)", () => {
    const md = `
| 9 | Bank ASC | AZ03NABZ01350100000000002944 | 805250 | 9900001881 | IBAZAZ2X |  |  |
`;
    const r = parseBanksMd(md);
    expect(r.banks).toHaveLength(1);
    expect(r.banks[0]!.phones).toEqual([]);
    expect(r.banks[0]!.address).toBeNull();
  });

  it("skips garbage lines (header, separator, blank)", () => {
    const md = `
# Список филиалов

| - | - | - | - | - | - | - | - |
random text
| 9 | Bank ASC | AZ03NABZ01350100000000002944 | 805250 | 9900001881 | IBAZAZ2X | +994124934159 | Addr |
`;
    const r = parseBanksMd(md);
    expect(r.banks).toHaveLength(1);
  });
});
