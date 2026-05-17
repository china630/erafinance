"use client";

import Link from "next/link";
import { Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { subscribeListRefresh } from "../../../lib/list-refresh-bus";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { TransferModal } from "../../../components/inventory/modals";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  LINK_ACCENT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type Movement = {
  id: string;
  quantity: unknown;
  price: unknown;
  createdAt: string;
  documentDate?: string;
  transferBatchId?: string | null;
  note: string | null;
  product: { name: string; sku?: string };
  warehouse: { name: string };
};

function fmtQty(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object" && v !== null && "toString" in v) {
    return String((v as { toString(): string }).toString());
  }
  return String(v);
}

function rowDate(m: Movement): string {
  const d = m.documentDate ?? m.createdAt;
  return d.slice(0, 19);
}

export default function InventoryTransfersPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<Movement[]>([]);
  const [toByBatch, setToByBatch] = useState<Record<string, string>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qOut = new URLSearchParams({
        note: "TRANSFER_OUT",
        page: String(page),
        pageSize: String(pageSize),
      });
      const qIn = new URLSearchParams({ note: "TRANSFER_IN", page: "1", pageSize: "500" });
      const [outRes, inRes] = await Promise.all([
        apiFetch(`/api/inventory/movements?${qOut.toString()}`),
        apiFetch(`/api/inventory/movements?${qIn.toString()}`),
      ]);
      if (!outRes.ok) throw new Error(`movements ${outRes.status}`);
      if (!inRes.ok) throw new Error(`movements ${inRes.status}`);
      const parsedOut = parsePaginatedList<Movement>(await outRes.json());
      const parsedIn = parsePaginatedList<Movement>(await inRes.json());
      const toMap: Record<string, string> = {};
      for (const m of parsedIn.items) {
        const bid = m.transferBatchId;
        if (bid) toMap[bid] = m.warehouse.name;
      }
      setToByBatch(toMap);
      setRows(parsedOut.items);
      setTotal(parsedOut.total);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [token, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    if (!ready || !token) return;
    return subscribeListRefresh("inventory-transfers", () => void load());
  }, [load, ready, token]);

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
        title={t("inventory.transfersPageTitle")}
        subtitle={
          <span className="inline leading-relaxed text-[#7F8C8D]">
            {t("inventory.transfersPageSubtitle")}{" "}
            <Link className={LINK_ACCENT_CLASS} href="/inventory/movements">
              {t("inventory.goToMovements")}
            </Link>
          </span>
        }
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            + {t("inventory.newTransferBtn")}
          </button>
        }
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading && <p className="text-gray-600">{t("common.loading")}</p>}
      {!loading && (
        <>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.thMovDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.transferFrom")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.transferTo")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thProduct")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.thQty")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.thMovPrice")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thTransferBatch")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} py-12 text-center`}>
                    {!error ? (
                      <EmptyState
                        icon={
                          <Truck
                            className="mx-auto h-12 w-12 stroke-[1.5] text-[#7F8C8D]"
                            aria-hidden
                          />
                        }
                        title={t("inventory.emptyTransfersTitle")}
                        description={t("inventory.emptyTransfersHint")}
                        action={
                          <Link className={LINK_ACCENT_CLASS} href="/inventory/movements">
                            {t("inventory.goToMovements")}
                          </Link>
                        }
                      />
                    ) : null}
                  </td>
                </tr>
              ) : (
              rows.map((m) => {
                const bid = m.transferBatchId ?? "—";
                const toName = m.transferBatchId ? toByBatch[m.transferBatchId] ?? "—" : "—";
                return (
                  <tr key={m.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>{rowDate(m)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{m.warehouse.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{toName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {m.product.name}
                      {m.product.sku ? ` (${m.product.sku})` : ""}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{fmtQty(m.quantity)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(m.price)}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                      {typeof bid === "string" ? bid.slice(0, 8) : bid}
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        </>
      )}

      <TransferModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
