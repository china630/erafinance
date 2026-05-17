"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  notifyListRefresh,
  subscribeListRefresh,
} from "../../../lib/list-refresh-bus";
import { InventoryAuditCreateFlow } from "../../../components/inventory/inventory-audit-create-flow";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { ClipboardList, Eye, X } from "lucide-react";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { Button } from "../../../components/ui/button";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CENTER_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";

type AuditRow = {
  id: string;
  date: string;
  status: string;
  createdAt: string;
  warehouse?: { id: string; name: string } | null;
};

export default function InventoryAuditsHistoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditCreateOpen, setAuditCreateOpen] = useState(false);
  const [auditFlowKey, setAuditFlowKey] = useState(0);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const res = await apiFetch(`/api/inventory/audits?${qs.toString()}`);
    if (!res.ok) {
      setError(`${t("inventory.loadErr")}: ${res.status}`);
      setRows([]);
      setTotal(0);
    } else {
      const parsed = parsePaginatedList<AuditRow>(await res.json());
      setRows(parsed.items);
      setTotal(parsed.total);
    }
    setLoading(false);
  }, [token, t, page, pageSize]);

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
    return subscribeListRefresh("inventory-audits", () => void load());
  }, [load, ready, token]);

  function openAuditCreate() {
    setAuditFlowKey((k) => k + 1);
    setAuditCreateOpen(true);
  }

  function closeAuditCreate() {
    setAuditCreateOpen(false);
    notifyListRefresh("inventory-audits");
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
    <div className="w-full space-y-6">
      <PageHeader
        title={t("inventory.auditHistoryTitle")}
        subtitle={t("inventory.auditHistoryLead")}
        actions={
          <button type="button" onClick={() => openAuditCreate()} className={PRIMARY_BUTTON_CLASS}>
            + {t("inventory.auditNewInventoryBtn")}
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
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.auditThDateDoc")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thWh")}</th>
                  <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("inventory.auditThStatus")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.auditThCreated")}</th>
                  <th className={DATA_TABLE_ACTIONS_TH_CLASS}>{t("inventory.auditThOpen")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} py-12 text-center`}>
                      <EmptyState
                        icon={
                          <ClipboardList
                            className="mx-auto h-12 w-12 stroke-[1.5] text-[#7F8C8D]"
                            aria-hidden
                          />
                        }
                        title={t("inventory.auditHistoryEmpty")}
                        description={t("inventory.auditHistoryEmptyHint")}
                        action={
                          <button
                            type="button"
                            onClick={() => openAuditCreate()}
                            className={PRIMARY_BUTTON_CLASS}
                          >
                            {t("inventory.auditNewInventoryBtn")}
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>
                        {typeof r.date === "string" ? r.date.slice(0, 10) : "—"}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap`}>
                        {r.warehouse?.name ?? "—"}
                      </td>
                      <td className={`${DATA_TABLE_TD_CENTER_CLASS} whitespace-nowrap`}>
                        {r.status === "COMPLETED"
                          ? t("inventory.auditStatusCompleted")
                          : r.status === "DRAFT"
                            ? t("inventory.auditStatusDraft")
                            : r.status === "COUNTING"
                              ? t("inventory.auditStatusCounting")
                              : r.status === "REVIEW"
                                ? t("inventory.auditStatusReview")
                                : r.status === "CANCELLED"
                                  ? t("inventory.auditStatusCancelled")
                                  : r.status}
                      </td>
                      <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>
                        {r.createdAt?.slice(0, 19)?.replace("T", " ") ?? "—"}
                      </td>
                      <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/inventory/audits/${r.id}`}
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("inventory.auditOpen")}
                          >
                            <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                          </Link>
                        </div>
                      </td>
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

      {auditCreateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-audit-create-modal-title"
          >
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h2
                id="inventory-audit-create-modal-title"
                className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]"
              >
                {t("inventory.auditNewInventoryBtn")}
              </h2>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => closeAuditCreate()}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
              <InventoryAuditCreateFlow
                key={auditFlowKey}
                compactForModal
                onAuditStarted={(auditId) => {
                  closeAuditCreate();
                  router.push(`/inventory/audits/${auditId}`);
                }}
                onNavigateToHistory={() => closeAuditCreate()}
                onBackToInventory={() => closeAuditCreate()}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
