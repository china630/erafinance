"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  downloadAuditHubCsv,
  downloadAuditHubXlsx,
} from "../../lib/audit-hub-export";
import { CARD_CONTAINER_CLASS, LINK_ACCENT_CLASS, SECONDARY_BUTTON_CLASS } from "../../lib/design-system";

export type RiskPayload = {
  from: string;
  to: string;
  windowDays: number;
  detectors: {
    duplicateCashOrders: { pairs: Record<string, unknown>[] };
    duplicateInvoicePayments: { pairs: Record<string, unknown>[] };
    expenseAccountSpikes: { items: Record<string, unknown>[] };
    counterpartyPaymentConcentration: { items: Record<string, unknown>[] };
    counterpartyZScore: { items: Record<string, unknown>[]; note?: string };
  };
};

function isRiskPayload(v: unknown): v is RiskPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (typeof o.from !== "string" || typeof o.to !== "string") return false;
  const d = o.detectors;
  if (!d || typeof d !== "object") return false;
  const det = d as Record<string, unknown>;
  return (
    Array.isArray((det.duplicateCashOrders as { pairs?: unknown })?.pairs) &&
    Array.isArray((det.duplicateInvoicePayments as { pairs?: unknown })?.pairs) &&
    Array.isArray((det.expenseAccountSpikes as { items?: unknown })?.items) &&
    Array.isArray(
      (det.counterpartyPaymentConcentration as { items?: unknown })?.items,
    ) &&
    Array.isArray((det.counterpartyZScore as { items?: unknown })?.items)
  );
}

function countCardClass(n: number): string {
  return n > 0
    ? "border-[#FAD7A0] bg-[#FFFBF0] text-[#34495E]"
    : "border-[#D5DADF] bg-[#F8FAFC] text-[#34495E]";
}

export function buildRiskExportSheets(payload: RiskPayload) {
  const d = payload.detectors;
  return [
    {
      name: "summary",
      rows: [
        {
          from: payload.from,
          to: payload.to,
          windowDays: payload.windowDays,
          duplicateCashPairs: d.duplicateCashOrders.pairs.length,
          duplicateInvoicePaymentPairs: d.duplicateInvoicePayments.pairs.length,
          expenseSpikes: d.expenseAccountSpikes.items.length,
          cpConcentration: d.counterpartyPaymentConcentration.items.length,
          cpZScore: d.counterpartyZScore.items.length,
        },
      ],
    },
    { name: "dup_cash", rows: d.duplicateCashOrders.pairs as Record<string, unknown>[] },
    {
      name: "dup_inv_pay",
      rows: d.duplicateInvoicePayments.pairs as Record<string, unknown>[],
    },
    { name: "expense_spikes", rows: d.expenseAccountSpikes.items as Record<string, unknown>[] },
    {
      name: "cp_conc",
      rows: d.counterpartyPaymentConcentration.items as Record<string, unknown>[],
    },
    { name: "cp_z", rows: d.counterpartyZScore.items as Record<string, unknown>[] },
  ];
}

export function buildRiskFlatCsvRows(payload: RiskPayload): Record<string, unknown>[] {
  const d = payload.detectors;
  const tag = (detector: string, row: Record<string, unknown>) => ({
    detector,
    periodFrom: payload.from,
    periodTo: payload.to,
    ...row,
  });
  return [
    ...d.duplicateCashOrders.pairs.map((r) => tag("duplicate_cash", r as Record<string, unknown>)),
    ...d.duplicateInvoicePayments.pairs.map((r) =>
      tag("duplicate_invoice_payment", r as Record<string, unknown>),
    ),
    ...d.expenseAccountSpikes.items.map((r) => tag("expense_spike", r as Record<string, unknown>)),
    ...d.counterpartyPaymentConcentration.items.map((r) =>
      tag("cp_payment_concentration", r as Record<string, unknown>),
    ),
    ...d.counterpartyZScore.items.map((r) => tag("cp_z_score", r as Record<string, unknown>)),
  ];
}

export function AuditHubRiskResultPanel({ payload }: { payload: unknown }) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const parsed = useMemo(() => (isRiskPayload(payload) ? payload : null), [payload]);

  if (!parsed) {
    return (
      <p className="text-xs text-red-600">
        {t("auditHub.exportInvalidPayload")}
      </p>
    );
  }

  const d = parsed.detectors;
  const nCash = d.duplicateCashOrders.pairs.length;
  const nPay = d.duplicateInvoicePayments.pairs.length;
  const nExp = d.expenseAccountSpikes.items.length;
  const nCp = d.counterpartyPaymentConcentration.items.length;
  const nZ = d.counterpartyZScore.items.length;

  const baseName = `audit-risk-${parsed.from}_${parsed.to}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() =>
            downloadAuditHubCsv(`${baseName}.csv`, buildRiskFlatCsvRows(parsed))
          }
        >
          {t("auditHub.exportCsv")}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          onClick={() => downloadAuditHubXlsx(`${baseName}.xlsx`, buildRiskExportSheets(parsed))}
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

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className={`rounded-2xl border px-3 py-2 text-xs shadow-sm ${countCardClass(nCash)}`}>
          <div className="font-semibold">{t("auditHub.riskCardDupCash")}</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{nCash}</div>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-xs shadow-sm ${countCardClass(nPay)}`}>
          <div className="font-semibold">{t("auditHub.riskCardDupPay")}</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{nPay}</div>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-xs shadow-sm ${countCardClass(nExp)}`}>
          <div className="font-semibold">{t("auditHub.riskCardExpense")}</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{nExp}</div>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-xs shadow-sm ${countCardClass(nCp)}`}>
          <div className="font-semibold">{t("auditHub.riskCardCpLoad")}</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{nCp}</div>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-xs shadow-sm ${countCardClass(nZ)}`}>
          <div className="font-semibold">{t("auditHub.riskCardCpZ")}</div>
          <div className="mt-1 text-lg font-bold tabular-nums">{nZ}</div>
        </div>
      </div>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h3 className="text-xs font-semibold text-[#34495E]">{t("auditHub.riskSectionDupCash")}</h3>
        <RiskPairTable
          rows={d.duplicateCashOrders.pairs}
          columns={[
            { key: "cashOrderIdA" },
            { key: "cashOrderIdB" },
            { key: "amount" },
            { key: "cashAccountCode" },
            { key: "counterpartyId", link: (v) => `/crm/counterparties/${String(v)}/edit` },
            { key: "dateGapDays" },
          ]}
        />
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h3 className="text-xs font-semibold text-[#34495E]">{t("auditHub.riskSectionDupPay")}</h3>
        <RiskPairTable
          rows={d.duplicateInvoicePayments.pairs}
          columns={[
            {
              key: "invoiceIdA",
              link: (v) => `/sales/invoices?invoice=${encodeURIComponent(String(v))}`,
            },
            {
              key: "invoiceIdB",
              link: (v) => `/sales/invoices?invoice=${encodeURIComponent(String(v))}`,
            },
            { key: "amount" },
            {
              key: "counterpartyId",
              link: (v) => `/crm/counterparties/${String(v)}/edit`,
            },
            { key: "dateGapDays" },
          ]}
        />
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h3 className="text-xs font-semibold text-[#34495E]">{t("auditHub.riskSectionExpense")}</h3>
        <RiskPairTable
          rows={d.expenseAccountSpikes.items}
          columns={[{ key: "accountCode" }, { key: "accountId" }, { key: "totalDebitNas" }]}
        />
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h3 className="text-xs font-semibold text-[#34495E]">{t("auditHub.riskSectionCpLoad")}</h3>
        <RiskPairTable
          rows={d.counterpartyPaymentConcentration.items}
          columns={[
            {
              key: "counterpartyId",
              link: (v) => `/crm/counterparties/${String(v)}/edit`,
            },
            { key: "paymentCount" },
            { key: "totalAmount" },
          ]}
        />
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <h3 className="text-xs font-semibold text-[#34495E]">{t("auditHub.riskSectionCpZ")}</h3>
        {d.counterpartyZScore.note ? (
          <p className="mb-2 text-[11px] text-[#5D6D7E]">{d.counterpartyZScore.note}</p>
        ) : null}
        <RiskPairTable
          rows={d.counterpartyZScore.items}
          columns={[
            {
              key: "counterpartyId",
              link: (v) => `/crm/counterparties/${String(v)}/edit`,
            },
            { key: "zScore" },
            { key: "totalAmount" },
            { key: "paymentCount" },
          ]}
        />
      </section>

      {showRaw ? (
        <div className={`max-h-[360px] overflow-auto ${CARD_CONTAINER_CLASS} p-4`}>
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-[#34495E]">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function RiskPairTable({
  rows,
  columns,
}: {
  rows: Record<string, unknown>[];
  columns: { key: string; link?: (val: unknown) => string }[];
}) {
  if (rows.length === 0) {
    return <p className="mt-2 text-[11px] text-[#7F8C8D]">—</p>;
  }
  return (
    <div className="mt-2 max-h-[280px] overflow-auto">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead className="sticky top-0 z-10 border-b border-[#D5DADF] bg-[#F8FAFC] text-[#475569]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="border-b border-[#D5DADF] px-2 py-1.5 font-medium">
                {c.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#D5DADF] transition-colors hover:bg-[#F1F5F9]">
              {columns.map((c) => {
                const v = row[c.key];
                const href = c.link && v != null && v !== "" ? c.link(v) : null;
                const text = v === null || v === undefined ? "—" : String(v);
                return (
                  <td key={c.key} className="px-2 py-1.5 font-mono text-[#34495E]">
                    {href ? (
                      <Link className={LINK_ACCENT_CLASS} href={href}>
                        {text}
                      </Link>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
