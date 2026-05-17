"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
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
import { AdjustmentsModal } from "../../../components/inventory/modals";
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
  type: string;
  quantity: unknown;
  price: unknown;
  createdAt: string;
  documentDate?: string;
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

export default function InventoryAdjustmentsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<Movement[]>([]);
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
      const q = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        notes: "INV_ADJ_IN,INV_ADJ_OUT",
      });
      const res = await apiFetch(`/api/inventory/movements?${q.toString()}`);
      if (!res.ok) throw new Error(`movements ${res.status}`);
      const parsed = parsePaginatedList<Movement>(await res.json());
      setRows(parsed.items);
      setTotal(parsed.total);
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
    return subscribeListRefresh("inventory-adjustments", () => void load());
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
        title={t("inventory.adjustmentsPageTitle")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            + {t("inventory.newAdjustBtn")}
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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thWh")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thProduct")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thMovType")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.thQty")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.thMovPrice")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thNote")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} py-12 text-center`}>
                    {!error ? (
                      <EmptyState
                        icon={
                          <ClipboardList
                            className="mx-auto h-12 w-12 stroke-[1.5] text-[#7F8C8D]"
                            aria-hidden
                          />
                        }
                        title={t("inventory.emptyAdjustmentsTitle")}
                        description={t("inventory.emptyAdjustmentsHint")}
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
              rows.map((m) => (
                <tr key={m.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>{rowDate(m)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{m.warehouse.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {m.product.name}
                    {m.product.sku ? ` (${m.product.sku})` : ""}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{m.type}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{fmtQty(m.quantity)}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(m.price)}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{m.note ?? "—"}</td>
                </tr>
              ))
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

      <AdjustmentsModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
