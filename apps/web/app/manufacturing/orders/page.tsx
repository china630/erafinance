"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { subscribeListRefresh } from "../../../lib/list-refresh-bus";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { ManufacturingOrderCreateModal } from "../../../components/manufacturing/manufacturing-order-create-modal";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
import { Badge } from "../../../components/ui/badge";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { formatMoneyAzn } from "../../../lib/format-money";

type OrderRow = {
  id: string;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  quantity: string;
  materialCost: string;
  recipeName: string;
  warehouseName: string;
  createdAt: string;
};

function statusBadge(
  status: OrderRow["status"],
  t: (k: string) => string,
): { label: string; variant: "neutral" | "owner" | "success" | "admin" } {
  switch (status) {
    case "IN_PROGRESS":
      return { label: t("manufacturing.orderStatusInProgress"), variant: "owner" };
    case "COMPLETED":
      return { label: t("manufacturing.orderStatusCompleted"), variant: "success" };
    case "CANCELLED":
      return { label: t("manufacturing.orderStatusCancelled"), variant: "admin" };
    default:
      return { label: t("manufacturing.orderStatusDraft"), variant: "neutral" };
  }
}

function ManufacturingOrdersContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (statusFilter) params.set("status", statusFilter);
    const res = await apiFetch(`/api/manufacturing/orders?${params}`);
    setLoading(false);
    if (!res.ok) {
      setError(t("manufacturing.loadErr"));
      return;
    }
    const data = parsePaginatedList<OrderRow>(await res.json());
    setRows(data.items);
    setTotal(data.total);
  }, [token, page, pageSize, statusFilter, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    return subscribeListRefresh("manufacturing-orders", () => void load());
  }, [load]);

  async function runAction(id: string, action: "start" | "complete" | "cancel") {
    if (!token) return;
    setActionId(id);
    const res = await apiFetch(`/api/manufacturing/orders/${id}/${action}`, {
      method: "POST",
    });
    setActionId(null);
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    await load();
  }

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
        title={t("manufacturing.ordersTitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/manufacturing" className={SECONDARY_BUTTON_CLASS}>
              ← {t("manufacturing.backHub")}
            </Link>
            <select
              className={SECONDARY_BUTTON_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label={t("manufacturing.orderFilterStatus")}
            >
              <option value="">{t("manufacturing.orderFilterAll")}</option>
              <option value="DRAFT">{t("manufacturing.orderStatusDraft")}</option>
              <option value="IN_PROGRESS">
                {t("manufacturing.orderStatusInProgress")}
              </option>
              <option value="COMPLETED">{t("manufacturing.orderStatusCompleted")}</option>
              <option value="CANCELLED">{t("manufacturing.orderStatusCancelled")}</option>
            </select>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setModalOpen(true)}
            >
              <Plus className="mr-1.5 inline h-4 w-4" aria-hidden />
              {t("manufacturing.newOrder")}
            </button>
          </div>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={`${DATA_TABLE_CLASS} min-w-full`}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colDate")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colRecipe")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.warehouse")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manufacturing.qty")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manufacturing.materialCost")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colStatus")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState title={t("manufacturing.noOrders")} compact />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const badge = statusBadge(row.status, t);
                const busy = actionId === row.id;
                return (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.createdAt.slice(0, 10)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.recipeName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.warehouseName}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{row.quantity}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      {formatMoneyAzn(row.materialCost)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      <div className="flex flex-wrap justify-end gap-1">
                        {row.status === "DRAFT" && (
                          <>
                            <button
                              type="button"
                              className={SECONDARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void runAction(row.id, "start")}
                            >
                              {t("manufacturing.orderStart")}
                            </button>
                            <button
                              type="button"
                              className={SECONDARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void runAction(row.id, "cancel")}
                            >
                              {t("common.cancel")}
                            </button>
                          </>
                        )}
                        {row.status === "IN_PROGRESS" && (
                          <>
                            <button
                              type="button"
                              className={PRIMARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void runAction(row.id, "complete")}
                            >
                              {t("manufacturing.orderComplete")}
                            </button>
                            <button
                              type="button"
                              className={SECONDARY_BUTTON_CLASS}
                              disabled={busy}
                              onClick={() => void runAction(row.id, "cancel")}
                            >
                              {t("common.cancel")}
                            </button>
                          </>
                        )}
                      </div>
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
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />

      <ManufacturingOrderCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => void load()}
      />
    </div>
  );
}

export default function ManufacturingOrdersPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;
  return (
    <SubscriptionPaywall module="manufacturing">
      <ManufacturingOrdersContent />
    </SubscriptionPaywall>
  );
}
