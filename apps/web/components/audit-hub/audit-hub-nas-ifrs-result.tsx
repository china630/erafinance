"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  downloadAuditHubCsv,
  downloadAuditHubXlsx,
} from "../../lib/audit-hub-export";
import {
  CARD_CONTAINER_CLASS,
  LINK_ACCENT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";

export type NasIfrsPayload = {
  from: string;
  to: string;
  includeTotalsMismatch: boolean;
  items: Array<{
    transactionId: string;
    date: string;
    reference: string | null;
    hasNas: boolean;
    hasIfrs: boolean;
    issue: string;
  }>;
  totalsMismatchItems: Array<{
    transactionId: string;
    date: string;
    reference: string | null;
    issue: string;
    nasDebitSum: string;
    ifrsDebitSum: string;
  }>;
};

function isNasPayload(v: unknown): v is NasIfrsPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.from === "string" &&
    typeof o.to === "string" &&
    typeof o.includeTotalsMismatch === "boolean" &&
    Array.isArray(o.items) &&
    Array.isArray(o.totalsMismatchItems)
  );
}

function jeExplainHref(transactionId: string) {
  return `/audit-hub/calculation?type=journal_posting&id=${encodeURIComponent(transactionId)}`;
}

export function buildNasIfrsExportSheets(payload: NasIfrsPayload) {
  return [
    {
      name: "asymmetry",
      rows: payload.items as unknown as Record<string, unknown>[],
    },
    {
      name: "totals_mismatch",
      rows: payload.totalsMismatchItems as unknown as Record<string, unknown>[],
    },
  ];
}

export function buildNasIfrsFlatCsvRows(payload: NasIfrsPayload): Record<string, unknown>[] {
  return [
    ...payload.items.map((r) => ({ section: "asymmetry", ...r })),
    ...payload.totalsMismatchItems.map((r) => ({ section: "totals_mismatch", ...r })),
  ];
}

export function AuditHubNasIfrsResultPanel({ payload }: { payload: unknown }) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const parsed = useMemo(() => (isNasPayload(payload) ? payload : null), [payload]);

  if (!parsed) {
    return (
      <p className="text-xs text-red-600">{t("auditHub.exportInvalidPayload")}</p>
    );
  }

  const baseName = `audit-nas-ifrs-${parsed.from}_${parsed.to}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() =>
            downloadAuditHubCsv(`${baseName}.csv`, buildNasIfrsFlatCsvRows(parsed))
          }
        >
          {t("auditHub.exportCsv")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() =>
            downloadAuditHubXlsx(`${baseName}.xlsx`, buildNasIfrsExportSheets(parsed))
          }
        >
          {t("auditHub.exportXlsx")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? t("auditHub.hideRawJson") : t("auditHub.showRawJson")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <div className="text-xs font-semibold text-[#34495E]">{t("auditHub.reconCardAsym")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[#34495E]">
            {parsed.items.length}
          </div>
        </div>
        <div className={`${CARD_CONTAINER_CLASS} p-4`}>
          <div className="text-xs font-semibold text-[#34495E]">{t("auditHub.reconCardTotals")}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[#34495E]">
            {parsed.totalsMismatchItems.length}
          </div>
        </div>
      </div>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h3 className="text-xs font-semibold text-[#34495E]">{t("auditHub.reconSectionAsym")}</h3>
        <div className="mt-2 max-h-[280px] overflow-auto">
          {parsed.items.length === 0 ? (
            <p className="text-[11px] text-[#7F8C8D]">—</p>
          ) : (
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 border-b border-[#D5DADF] bg-[#F8FAFC]">
                <tr>
                  <th className="border-b px-2 py-1.5">transactionId</th>
                  <th className="border-b px-2 py-1.5">date</th>
                  <th className="border-b px-2 py-1.5">issue</th>
                  <th className="border-b px-2 py-1.5">{t("auditHub.reconColExplain")}</th>
                </tr>
              </thead>
              <tbody>
                {parsed.items.map((row) => (
                  <tr key={row.transactionId} className="border-b border-[#D5DADF]">
                    <td className="px-2 py-1.5 font-mono">{row.transactionId}</td>
                    <td className="px-2 py-1.5">{row.date}</td>
                    <td className="px-2 py-1.5">{row.issue}</td>
                    <td className="px-2 py-1.5">
                      <Link
                        className={LINK_ACCENT_CLASS}
                        href={jeExplainHref(row.transactionId)}
                      >
                        journal_posting
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {parsed.includeTotalsMismatch ? (
        <section className={`${CARD_CONTAINER_CLASS} p-4`}>
          <h3 className="text-xs font-semibold text-[#34495E]">{t("auditHub.reconSectionTotals")}</h3>
          <div className="mt-2 max-h-[280px] overflow-auto">
            {parsed.totalsMismatchItems.length === 0 ? (
              <p className="text-[11px] text-[#7F8C8D]">—</p>
            ) : (
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0 z-10 border-b border-[#D5DADF] bg-[#F8FAFC]">
                  <tr>
                    <th className="border-b px-2 py-1.5">transactionId</th>
                    <th className="border-b px-2 py-1.5">date</th>
                    <th className="border-b px-2 py-1.5">nasDebitSum</th>
                    <th className="border-b px-2 py-1.5">ifrsDebitSum</th>
                    <th className="border-b px-2 py-1.5">{t("auditHub.reconColExplain")}</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.totalsMismatchItems.map((row) => (
                    <tr key={row.transactionId} className="border-b border-[#D5DADF]">
                      <td className="px-2 py-1.5 font-mono">{row.transactionId}</td>
                      <td className="px-2 py-1.5">{row.date}</td>
                      <td className="px-2 py-1.5 font-mono">{row.nasDebitSum}</td>
                      <td className="px-2 py-1.5 font-mono">{row.ifrsDebitSum}</td>
                      <td className="px-2 py-1.5">
                        <Link
                          className={LINK_ACCENT_CLASS}
                          href={jeExplainHref(row.transactionId)}
                        >
                          journal_posting
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}

      {showRaw ? (
        <div className="max-h-[360px] overflow-auto rounded-lg border border-[#D5DADF] bg-[#FAFAFA] p-3">
          <pre className="whitespace-pre-wrap break-all text-[11px]">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
