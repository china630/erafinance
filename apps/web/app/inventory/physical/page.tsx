"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { notifyListRefresh, subscribeListRefresh } from "../../../lib/list-refresh-bus";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { PhysicalAdjustmentModal } from "../../../components/inventory/modals/physical-adjustment-modal";
import { EmptyState } from "../../../components/empty-state";
import {
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
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
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type PhysicalRow = {
  id: string;
  date: string;
  status: string;
  docType: string;
  warehouse?: { id: string; name: string } | null;
  _count?: { lines: number };
};

export default function InventoryPhysicalPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<PhysicalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [postBusyId, setPostBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const res = await apiFetch(`/api/inventory/physical-adjustments?${qs.toString()}`);
    if (!res.ok) {
      setError(`${t("inventory.loadErr")}: ${res.status}`);
      setRows([]);
      setTotal(0);
    } else {
      const parsed = parsePaginatedList<PhysicalRow>(await res.json());
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
    return subscribeListRefresh("inventory-physical", () => void load());
  }, [load, ready, token]);

  async function postDraft(id: string) {
    if (!token) return;
    setPostBusyId(id);
    try {
      const res = await apiFetch(
        `/api/inventory/physical-adjustments/${encodeURIComponent(id)}/post`,
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      toast.success(t("inventory.physicalPostedOk"));
      void load();
    } finally {
      setPostBusyId(null);
    }
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
        title={t("inventory.physicalTitle")}
        subtitle={
          <span className="text-[#7F8C8D]">
            {t("inventory.physicalHint")}{" "}
            <Link href="/inventory/audits" className={LINK_ACCENT_CLASS}>
              {t("inventory.physicalVsAuditLink")}
            </Link>
          </span>
        }
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
            + {t("inventory.physicalNewBtn")}
          </button>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-gray-600">{t("common.loading")}</p>}

      {!loading && (
        <>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.physicalRegistryDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thWh")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.physicalRegistryType")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.physicalRegistryStatus")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("inventory.physicalRegistryLines")}</th>
                  <th className={DATA_TABLE_ACTIONS_TH_CLASS}>{t("inventory.physicalRegistryActions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={6} className={`${DATA_TABLE_TD_CLASS} py-12 text-center`}>
                      <EmptyState
                        title={t("inventory.physicalTitle")}
                        description={t("inventory.physicalHint")}
                        action={
                          <button
                            type="button"
                            className={PRIMARY_BUTTON_CLASS}
                            onClick={() => setModalOpen(true)}
                          >
                            + {t("inventory.physicalNewBtn")}
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
                      <td className={DATA_TABLE_TD_CLASS}>{r.warehouse?.name ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {t(`inventory.physicalDocType_${r.docType}`, { defaultValue: r.docType })}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {r.status === "POSTED"
                          ? t("inventory.physicalStatusPosted")
                          : t("inventory.physicalStatusDraft")}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{r._count?.lines ?? "—"}</td>
                      <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                        {r.status === "DRAFT" ? (
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={postBusyId === r.id}
                            onClick={() => void postDraft(r.id)}
                          >
                            {postBusyId === r.id ? "…" : t("inventory.physicalPost")}
                          </button>
                        ) : (
                          <span className="text-[#7F8C8D]">—</span>
                        )}
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

      <PhysicalAdjustmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          notifyListRefresh("inventory-physical");
          void load();
        }}
      />
    </div>
  );
}
