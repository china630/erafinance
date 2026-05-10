"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../../../components/layout/page-header";
import { SuperAdminDataTable } from "../../../../../components/super-admin/data-table";
import { apiFetch } from "../../../../../lib/api-client";
import { useAuth } from "../../../../../lib/auth-context";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../../lib/design-system";

export default function DataHubMdmCounterpartiesPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<
    Array<{ id: string; taxId: string; name: string; updatedAt: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (q.trim()) params.set("q", q.trim());
    const res = await apiFetch(`/api/admin/mdm/counterparties?${params}`);
    if (!res.ok) {
      toast.error(await res.text());
      setItems([]);
      setTotal(0);
    } else {
      const data = (await res.json()) as {
        total: number;
        items: Array<{ id: string; taxId: string; name: string; updatedAt: string }>;
      };
      setTotal(data.total);
      setItems(data.items);
    }
    setLoading(false);
  }, [token, page, q]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("superAdmin.dataHubMdmCp")} subtitle={t("superAdmin.dataHubReadOnly")} />

      <div className={`${CARD_CONTAINER_CLASS} p-4 flex flex-wrap gap-2 items-end`}>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("superAdmin.search")}
          className="min-w-[200px] flex-1 rounded-lg border border-[#D5DADF] px-3 py-1.5 text-[13px]"
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("superAdminTranslations.refresh")}
        </button>
      </div>

      <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.totalLabel", { count: total })}</p>

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
      ) : (
        <>
          <SuperAdminDataTable>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.orgColVoen")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.orgColName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.logsColTime")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[12px]`}>{r.taxId}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.name}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[12px]`}>{new Date(r.updatedAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </SuperAdminDataTable>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("superAdmin.prev")}
            </button>
            <span className="text-[13px]">{t("superAdmin.pageLabel", { page })}</span>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("superAdmin.next")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
