"use client";

import Link from "next/link";
import { FileSpreadsheet, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { formatMoneyAzn } from "../../lib/format-money";
import { useRequireAuth } from "../../lib/use-require-auth";
import { subscribeListRefresh } from "../../lib/list-refresh-bus";
import { PageHeader } from "../../components/layout/page-header";
import { EmptyState } from "../../components/empty-state";
import { CreateReceiptModal } from "../../components/inventory/create-receipt-modal";
import { PurchaseModal } from "../../components/inventory/modals";
import { Badge } from "../../components/ui/badge";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";

type PurchaseInvoiceRow = {
  id: string;
  documentDate: string;
  createdAt: string;
  description: string | null;
  reference: string | null;
  kind: "goods" | "services" | "dual";
  receiptStatus: "pending" | "received" | "na";
  totalGross: string;
};

function rowDate(m: PurchaseInvoiceRow): string {
  const d = m.documentDate ?? m.createdAt;
  return d.slice(0, 19);
}

function purchaseKindLabel(m: PurchaseInvoiceRow, t: (k: string) => string): string {
  if (m.kind === "dual") return t("inventory.purchaseKindDual");
  if (m.kind === "services") return t("inventory.purchaseKindServices");
  return t("inventory.purchaseKindGoods");
}

function receiptBadge(
  m: PurchaseInvoiceRow,
  t: (k: string) => string,
): { label: string; variant: "neutral" | "success" } | null {
  if (m.receiptStatus === "na") return null;
  if (m.receiptStatus === "received") {
    return { label: t("inventory.purchaseReceiptStatusReceived"), variant: "success" };
  }
  return { label: t("inventory.purchaseReceiptStatusPending"), variant: "neutral" };
}

function purchaseHasGoodsLines(m: PurchaseInvoiceRow): boolean {
  return m.kind === "goods" || m.kind === "dual";
}

export default function PurchasesPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<PurchaseInvoiceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptBasisTransactionId, setReceiptBasisTransactionId] = useState<string | undefined>();
  const [purchaseActionsMenuId, setPurchaseActionsMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/inventory/purchase-invoices?take=400");
      if (!res.ok) throw new Error(`purchase-invoices ${res.status}`);
      setRows(await res.json());
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    if (!ready || !token) return;
    return subscribeListRefresh("inventory-hub", () => void load());
  }, [load, ready, token]);

  useEffect(() => {
    if (!purchaseActionsMenuId) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = document.getElementById(`purchase-row-actions-${purchaseActionsMenuId}`);
      if (el && !el.contains(e.target as Node)) {
        setPurchaseActionsMenuId(null);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [purchaseActionsMenuId]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("inventory.purchasesRegistryTitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              + {t("inventory.purchaseNewOpenBtn")}
            </button>
            <Link href="/inventory" className={SECONDARY_BUTTON_CLASS}>
              {t("inventory.backList")}
            </Link>
          </div>
        }
      />
      <p className="text-sm text-slate-600 m-0">{t("inventory.purchaseRegistryHint")}</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading && <p className="text-gray-600">{t("common.loading")}</p>}
      {!loading && rows.length === 0 && !error && (
        <EmptyState
          icon={<FileSpreadsheet className="h-12 w-12 mx-auto stroke-[1.5] text-[#7F8C8D]" aria-hidden />}
          title={t("inventory.purchasesRegistryTitle")}
          description={t("inventory.purchaseEmptyRegistryHint")}
          action={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              + {t("inventory.purchaseNewOpenBtn")}
            </button>
          }
        />
      )}
      {!loading && rows.length > 0 && (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.purchaseThDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.purchaseThKind")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.purchaseThReceipt")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.purchaseThTotal")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.purchaseThDescription")}</th>
                <th className={`${DATA_TABLE_TH_LEFT_CLASS} w-[3rem]`}>{t("inventory.purchaseThActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>{rowDate(m)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{purchaseKindLabel(m, t)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {(() => {
                      const b = receiptBadge(m, t);
                      return b ? <Badge variant={b.variant}>{b.label}</Badge> : "—";
                    })()}
                  </td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(m.totalGross)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{m.description?.trim() || "—"}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} relative`}>
                    {purchaseHasGoodsLines(m) ? (
                      <div className="relative inline-block" id={`purchase-row-actions-${m.id}`}>
                        <button
                          type="button"
                          className="rounded-lg border border-[#D5DADF] bg-white px-2 py-1.5 text-[#34495E] hover:bg-[#F8F9FA]"
                          aria-expanded={purchaseActionsMenuId === m.id}
                          aria-haspopup="menu"
                          aria-label={t("inventory.purchaseActionsMenuAria")}
                          onClick={() =>
                            setPurchaseActionsMenuId((cur) => (cur === m.id ? null : m.id))
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" aria-hidden />
                        </button>
                        {purchaseActionsMenuId === m.id ? (
                          <div
                            className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded-lg border border-[#D5DADF] bg-white py-1 text-[13px] text-[#34495E] shadow-md"
                            role="menu"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-2 text-left hover:bg-[#F1F5F9]"
                              onClick={() => {
                                setPurchaseActionsMenuId(null);
                                setReceiptBasisTransactionId(m.id);
                                setReceiptModalOpen(true);
                              }}
                            >
                              {t("inventory.purchaseCreateReceipt")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PurchaseModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => void load()} />

      <CreateReceiptModal
        open={receiptModalOpen}
        initialBasisTransactionId={receiptBasisTransactionId}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptBasisTransactionId(undefined);
        }}
        onSaved={() => void load()}
      />
    </div>
  );
}
