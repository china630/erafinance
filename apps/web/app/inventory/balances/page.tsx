"use client";

import { BarChart3 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { subscribeListRefresh } from "../../../lib/list-refresh-bus";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  INPUT_BORDERED_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { CreateTransferModal } from "../../../components/inventory/create-transfer-modal";

type Warehouse = { id: string; name: string };

type BalanceRow = {
  warehouseId: string;
  warehouseName: string;
  binId: string | null;
  binCode: string | null;
  productId: string;
  productName: string;
  productSku: string;
  quantity: string;
};

function fmtQty(q: string): string {
  const n = Number(String(q).replace(",", "."));
  if (!Number.isFinite(n)) return q;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export default function InventoryBalancesReportPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filterWh, setFilterWh] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);

  useEffect(() => {
    const tmr = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(tmr);
  }, [search]);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      q.set("page", String(page));
      q.set("pageSize", String(pageSize));
      if (filterWh) q.set("warehouseId", filterWh);
      if (searchDebounced) q.set("search", searchDebounced);
      const [w, b] = await Promise.all([
        apiFetch("/api/inventory/warehouses"),
        apiFetch(`/api/inventory/balances?${q.toString()}`),
      ]);
      if (!w.ok) throw new Error(`warehouses ${w.status}`);
      if (!b.ok) throw new Error(`balances ${b.status}`);
      setWarehouses(await w.json());
      const parsed = parsePaginatedList<BalanceRow>(await b.json());
      setRows(parsed.items);
      setTotal(parsed.total);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [filterWh, searchDebounced, token, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filterWh, searchDebounced]);

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
    return subscribeListRefresh("inventory-hub", () => void load());
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
        title={t("inventory.balancesReportTitle")}
        subtitle={t("inventory.balancesReportSubtitle")}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-[#475569]">
          {t("inventory.filterWh")}
          <select
            value={filterWh}
            onChange={(e) => setFilterWh(e.target.value)}
            className={`mt-1 block min-w-[12rem] ${INPUT_BORDERED_CLASS}`}
          >
            <option value="">{t("inventory.allWh")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-[#475569] min-w-[12rem] flex-1 max-w-md">
          {t("inventory.balancesFilterSearch")}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("inventory.balancesSearchPlaceholder")}
            className={`mt-1 block w-full ${INPUT_BORDERED_CLASS}`}
          />
        </label>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("inventory.refresh")}
        </button>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => setTransferOpen(true)}
        >
          {t("inventory.balancesBtnTransfer")}
        </button>
      </div>

      <CreateTransferModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        onSaved={() => void load()}
      />

      {loading && <p className="text-[#7F8C8D] text-sm">{t("common.loading")}</p>}

      {!loading && total === 0 && !error && (
        <EmptyState
          icon={<BarChart3 className="h-12 w-12 mx-auto stroke-[1.5] text-[#7F8C8D]" aria-hidden />}
          title={t("inventory.balancesEmptyTitle")}
          description={t("inventory.balancesEmptyHint")}
        />
      )}

      {!loading && total > 0 && (
        <>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-[720px]`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.balancesColProduct")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.balancesColWarehouse")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.balancesColBin")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.balancesColQty")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.warehouseId}:${r.binId ?? "null"}:${r.productId}`} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-medium text-[#34495E]`}>
                    <div className="flex flex-col gap-0.5">
                      <span>{r.productName}</span>
                      <span className="text-xs font-normal text-[#7F8C8D] font-mono">{r.productSku}</span>
                    </div>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.warehouseName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {r.binCode?.trim() ? r.binCode : "—"}
                  </td>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} font-mono tabular-nums`}>
                    {fmtQty(r.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEDF0] pt-3 text-[13px] text-[#34495E]">
          <label className="flex items-center gap-2">
            <span className="text-[#7F8C8D]">{t("common.paginationRowsPerPage")}</span>
            <select
              className={`${MODAL_INPUT_CLASS} !mt-0 h-9 min-w-[4.5rem]`}
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 50);
                setPage(1);
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>
          <span className="tabular-nums text-[#7F8C8D]">
            {t("common.paginationPageOf", {
              page: String(page),
              pages: String(totalPages),
              total: String(total),
            })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("common.paginationPrev")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("common.paginationNext")}
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
