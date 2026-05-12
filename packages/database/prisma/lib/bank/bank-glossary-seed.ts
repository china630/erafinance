import type { PrismaClient } from "@prisma/client";

/**
 * System-level glossary of Azerbaijan banks (no `organizationId`).
 *
 * Two-digit `code` is fixed for the platform and used as the second segment of
 * NAS subaccount `221.<bankCode>.<seq>` (see TZ §14.0.2 / PRD §11.0).
 *
 * Rows are ordered **alphabetically by Azerbaijani display name** (same order as
 * `prisma/catalog/bank/banks-table.md` head banks after `localeCompare(..., "az")`),
 * with codes **01–22** assigned in that order. Head-office facts (IBAN, SWIFT, MFO,
 * phones, address) are aligned with that table (parsed via `banks-md-parser`);
 * a few display names keep the curated spelling from the platform glossary where
 * the OCR dump truncates the legal form (e.g. Sənaye Bankı).
 *
 * **Branches** are applied from the committed snapshot
 * `prisma/catalog/bank/bank-branches.generated.ts` (regenerate via
 * `npm run db:gen:banks-branches-seed` in `@erafinance/database`).
 */
export interface BankGlossarySeedRow {
  /** Two-character platform code, `01`–`22` (alphabetical slot). */
  code: string;
  /** Official Azerbaijani name. */
  nameAz: string;
  /** 10-digit VÖEN of the bank legal entity. */
  voen: string;
  /** Correspondent IBAN of the bank in CBA. */
  correspondentIban: string;
  /** SWIFT/BIC code of the bank. */
  swift: string;
  /** 6-digit MFO code of the head office (used as the head `BankBranch`). */
  headBranchCode: string;
  /** Phones of the head office (already cleaned up). */
  headPhones: ReadonlyArray<string>;
  /** Free-text head office address. */
  headAddress: string;
}

export const BANK_GLOSSARY_SEED: ReadonlyArray<BankGlossarySeedRow> = [
  {
    code: "01",
    nameAz: "ACCESSBANK QSC",
    voen: "1400057421",
    correspondentIban: "AZ10NABZ01350100000000056944",
    swift: "ACABAZ22",
    headBranchCode: "505000",
    headPhones: ["+994124930726", "+994124984075", "+994124930796"],
    headAddress:
      "Bakı şəhəri, Yasamal rayonu ,1033-cü məhəllə, Tbilisi prospekti, 3",
  },
  {
    code: "02",
    nameAz: "AFB BANK ASC",
    voen: "1301703781",
    correspondentIban: "AZ81NABZ01350100000000091944",
    swift: "AZFIAZ22",
    headBranchCode: "503217",
    headPhones: ["+994125656565", "+994125656575"],
    headAddress: "Bakı şəhəri, Yasamal r-nu, İ.Qutqaşınli küçəsi, ev 112",
  },
  {
    code: "03",
    nameAz: "ASC XALQ Bankı",
    voen: "2000296061",
    correspondentIban: "AZ24NABZ01350100000000067944",
    swift: "HAJCAZ22",
    headBranchCode: "505055",
    headPhones: ["+994124044343", "+994124044334"],
    headAddress: "Bakı şəhəri, İnşaatçılar prospekti, 22 L",
  },
  {
    code: "04",
    nameAz: "Azər-Türk Bank ASC",
    voen: "9900006111",
    correspondentIban: "AZ02NABZ01350100000000022944",
    swift: "AZRTAZ22",
    headBranchCode: "507699",
    headPhones: ["+994124644212", "+994124644219", "+994124644203"],
    headAddress:
      "Bakı şəhəri, Nəsimi rayonu, C.Məmmədquluzadə küçəsi 85,192/193",
  },
  {
    code: "05",
    nameAz: "Azərbaycan Beynəlxalq Bankı ASC",
    voen: "9900001881",
    correspondentIban: "AZ03NABZ01350100000000002944",
    swift: "IBAZAZ2X",
    headBranchCode: "805250",
    headPhones: ["+994124934159", "+994124930091", "+994124934091"],
    headAddress: "Bakı şəhəri, Nizami küçəsi, 67",
  },
  {
    code: "06",
    nameAz: "Azərbaycan Sənaye Bankı ASC",
    voen: "9900007981",
    correspondentIban: "AZ12NABZ01350100000000016944",
    swift: "CAPNAZ22",
    headBranchCode: "509664",
    headPhones: ["+994124934949"],
    headAddress:
      "Bakı şəhəri, Suraxanı rayonu, Hövsan Südçülük Sovxozu, Xəyal Adası Yaşayış Kompleksi",
  },
  {
    code: "07",
    nameAz: "Bank Avrasiya ASC",
    voen: "1700792251",
    correspondentIban: "AZ48NABZ01350100000000072944",
    swift: "AVRAAZ22",
    headBranchCode: "505129",
    headPhones: ["+994125981107", "+994125980307"],
    headAddress: "Bakı şəhəri, Nizami küçəsi, 70",
  },
  {
    code: "08",
    nameAz: "Bank BTB ASC",
    voen: "1302164881",
    correspondentIban: "AZ13NABZ01350100000000093944",
    swift: "BBTBAZ22",
    headBranchCode: "501145",
    headPhones: ["+994124997995"],
    headAddress: "Bakı şəhəri, Xətai r-nu, Nobel prospekti, ev 13 A",
  },
  {
    code: "09",
    nameAz: "Bank of Baku ASC",
    voen: "1700038881",
    correspondentIban: "AZ27NABZ01350100000000007944",
    swift: "JBBKAZ22",
    headBranchCode: "506924",
    headPhones: ["+994124470055", "+994124988278"],
    headAddress: "Bakı şəhəri, Atatürk prospekti, 40/42",
  },
  {
    code: "10",
    nameAz: "Bank Respublika ASC",
    voen: "9900001901",
    correspondentIban: "AZ80NABZ01350100000000014944",
    swift: "BRESAZ22",
    headBranchCode: "505668",
    headPhones: ["+994125980800", "+994124401949", "+994124656749"],
    headAddress: "Bakı şəhəri, Xəqani küçəsi, 21",
  },
  {
    code: "11",
    nameAz: "BANK VTB (AZƏRBAYCAN) ASC",
    voen: "1400117231",
    correspondentIban: "AZ15NABZ01350100000000053944",
    swift: "VTBAAZ22",
    headBranchCode: "506623",
    headPhones: ["+994124377121", "+994124935442", "+994124930942"],
    headAddress: "Bakı şəhəri, Xətai prospekti, 38",
  },
  {
    code: "12",
    nameAz: "Expressbank ASC",
    voen: "1500031691",
    correspondentIban: "AZ11NABZ01350100000000036944",
    swift: "AZENAZ22",
    headBranchCode: "505099",
    headPhones: ["132", "+994125612288"],
    headAddress:
      "Bakı şəhəri, Nərimanov rayonu, Y.V. Çəminzəminli küçəsi, ev 134 C",
  },
  {
    code: "13",
    nameAz: "Kapital Bank ASC",
    voen: "9900003611",
    correspondentIban: "AZ37NABZ01350100000000001944",
    swift: "AIIBAZ2X",
    headBranchCode: "200004",
    headPhones: ["+994124931882", "+994124936630"],
    headAddress:
      "Bakı şəhəri, Nəsimi rayonu, 687-ci məhəllə, Neftçilər prospekti 153, Port Baku Tower 2",
  },
  {
    code: "14",
    nameAz: "Melli İran Bankı Bakı filialı",
    voen: "1300036291",
    correspondentIban: "AZ74NABZ01350100000000037944",
    swift: "MELIAZ22",
    headBranchCode: "509761",
    headPhones: ["+994125989005", "+994125989006"],
    headAddress: "Bakı şəhəri, Xətai rayonu, Nobel prospekti 23",
  },
  {
    code: "15",
    nameAz: "Paşa Bank ASC",
    voen: "1700767721",
    correspondentIban: "AZ82NABZ01350100000000071944",
    swift: "PAHAAZ22",
    headBranchCode: "505141",
    headPhones: ["+994124965000", "+994124965010"],
    headAddress:
      "Bakı şəhəri, Səbail r-nu, Yusif Məmmədəliyev küçəsi, 15",
  },
  {
    code: "16",
    nameAz: "Premium Bank ASC",
    voen: "9900006241",
    correspondentIban: "AZ70NABZ01350100000000020944",
    swift: "AZALAZ22",
    headBranchCode: "507473",
    headPhones: ["+994124939915", "+994124939117", "931", "+994124989701"],
    headAddress:
      "Bakı şəhəri, Nərimanov rayonu, Akademik Həsən Əliyev küçəsi, 1096 məhəllə. 131A",
  },
  {
    code: "17",
    nameAz: "Rabitəbank ASC",
    voen: "9900001061",
    correspondentIban: "AZ61NABZ01350100000000006944",
    swift: "RBTAAZ22",
    headBranchCode: "506399",
    headPhones: ["+994125984488"],
    headAddress: "Bakı şəhəri, Füzuli küçəsi, 71",
  },
  {
    code: "18",
    nameAz: "TURANBANK ASC",
    voen: "1300016391",
    correspondentIban: "AZ26NABZ01350100000000027944",
    swift: "TURAAZ22",
    headBranchCode: "507462",
    headPhones: ["+994125107911", "+994125107912", "+994124972577"],
    headAddress: "Bakı şəhəri, İ.Qutqaşenli küçəsi, 85",
  },
  {
    code: "19",
    nameAz: "UNİBANK KB ASC",
    voen: "1300017201",
    correspondentIban: "AZ46NABZ01350100000000015944",
    swift: "UBAZAZ22",
    headBranchCode: "505754",
    headPhones: ["+994124982244", "+994124982245", "+994124980953"],
    headAddress: "Bakı şəhəri, Rəşid Behbudov küçəsi, 55",
  },
  {
    code: "20",
    nameAz: "Yapı Kredi Bank Azərbaycan QSC",
    voen: "9900009021",
    correspondentIban: "AZ51NABZ01350100000000012944",
    swift: "KABAAZ22",
    headBranchCode: "509987",
    headPhones: ["+994124977795", "+994124970276"],
    headAddress: "Bakı şəhəri, Cəlil Məmmədquluzadə küçəsi, 73F",
  },
  {
    code: "21",
    nameAz: "Yelo Bank ASC",
    voen: "9900014901",
    correspondentIban: "AZ98NABZ01350100000000042944",
    swift: "NICBAZ22",
    headBranchCode: "507064",
    headPhones: ["981", "+994124933379"],
    headAddress: "Bakı şəhəri, Nəsimi rayonu, Puşkin küçəsi, 30",
  },
  {
    code: "22",
    nameAz: "Ziraat Bank Azərbaycan ASC",
    voen: "1303953611",
    correspondentIban: "AZ42NABZ01350100000000095944",
    swift: "TCZBAZ22",
    headBranchCode: "512372",
    headPhones: [],
    headAddress: "Bakı şəhəri, Yasamal rayonu, Cəfər Cabbarlı küçəsi, 40",
  },
] as const;

const HEAD_OFFICE_NAME_AZ = "Baş ofis";

/**
 * Idempotent upsert of the system bank glossary AND every head office
 * `BankBranch` row. Safe to run on every `prisma db seed` and on every
 * redeploy.
 *
 * Two-phase write protects the `BankGlossary.voen` and `BankGlossary.correspondentIban`
 * UNIQUE constraints when values shuffle between codes (e.g. when a new release
 * re-numbers the platform `code` slots).
 *
 * Returns the count of upserted glossary rows.
 */
export async function seedBankGlossary(prisma: PrismaClient): Promise<number> {
  await prisma.$transaction(async (tx) => {
    const codes = BANK_GLOSSARY_SEED.map((r) => r.code);
    const existing = await tx.bankGlossary.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true, voen: true },
    });
    for (const row of existing) {
      await tx.bankGlossary.update({
        where: { id: row.id },
        data: {
          voen: `__tmp_${row.code}_${row.id.slice(0, 8)}`,
          correspondentIban: `__tmp_iban_${row.code}_${row.id.slice(0, 8)}`,
        },
      });
    }

    for (const row of BANK_GLOSSARY_SEED) {
      const glossary = await tx.bankGlossary.upsert({
        where: { code: row.code },
        create: {
          code: row.code,
          nameAz: row.nameAz,
          voen: row.voen,
          correspondentIban: row.correspondentIban,
          swift: row.swift,
          headPhones: [...row.headPhones],
          headAddress: row.headAddress,
          isActive: true,
        },
        update: {
          nameAz: row.nameAz,
          voen: row.voen,
          correspondentIban: row.correspondentIban,
          swift: row.swift,
          headPhones: [...row.headPhones],
          headAddress: row.headAddress,
          isActive: true,
        },
      });

      await tx.bankBranch.upsert({
        where: {
          bankId_branchCode: {
            bankId: glossary.id,
            branchCode: row.headBranchCode,
          },
        },
        create: {
          bankId: glossary.id,
          branchCode: row.headBranchCode,
          name: HEAD_OFFICE_NAME_AZ,
          swift: row.swift,
          address: row.headAddress,
          phones: [...row.headPhones],
          isHeadOffice: true,
          isActive: true,
        },
        update: {
          name: HEAD_OFFICE_NAME_AZ,
          swift: row.swift,
          address: row.headAddress,
          phones: [...row.headPhones],
          isHeadOffice: true,
          isActive: true,
        },
      });
    }
  });
  return BANK_GLOSSARY_SEED.length;
}
