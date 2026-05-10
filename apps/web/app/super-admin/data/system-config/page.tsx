"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../../components/layout/page-header";
import { SuperAdminDataTable } from "../../../../components/super-admin/data-table";
import { apiFetch } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";

type Row = {
  key: string;
  description: string;
  allowReset: boolean;
  allowPut: boolean;
  valueKind: string;
  storedValue: unknown;
  effectiveValue: unknown;
  defaultValue: unknown;
};

export default function DataHubSystemConfigPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/admin/system-config");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((await res.json()) as Row[]);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (r: Row) => {
    setEditKey(r.key);
    setDraft(JSON.stringify(r.effectiveValue ?? null, null, 2));
  };

  const saveEdit = async () => {
    if (!token || !editKey) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      toast.error(t("superAdmin.dataHubJsonInvalid"));
      return;
    }
    const res = await apiFetch(`/api/admin/system-config/${encodeURIComponent(editKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: parsed }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("superAdmin.save"));
    setEditKey(null);
    void load();
  };

  const resetKey = async (key: string) => {
    if (!token) return;
    if (!window.confirm(t("superAdmin.dataHubConfirmReset"))) return;
    const res = await apiFetch(`/api/admin/system-config/${encodeURIComponent(key)}/reset`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("superAdmin.dataHubResetDefault"));
    void load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("superAdmin.dataHubSystemConfig")} />

      <div className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("superAdminTranslations.refresh")}
        </button>
        {loading ? (
          <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
        ) : (
          <SuperAdminDataTable>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.dataHubKey")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.dataHubDescription")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.dataHubEffective")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.dataHubDefault")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[12px]`}>{r.key}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-xs`}>{r.description}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[11px] max-w-md truncate`}>
                    {JSON.stringify(r.effectiveValue)}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[11px] max-w-md truncate`}>
                    {JSON.stringify(r.defaultValue)}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} whitespace-nowrap space-x-2`}>
                    {r.allowPut ? (
                      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => openEdit(r)}>
                        {t("superAdmin.dataHubEdit")}
                      </button>
                    ) : (
                      <span className="text-[12px] text-[#7F8C8D]">{t("superAdmin.dataHubReadOnly")}</span>
                    )}
                    {r.allowReset ? (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void resetKey(r.key)}
                      >
                        {t("superAdmin.dataHubResetDefault")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </SuperAdminDataTable>
        )}
      </div>

      {editKey ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className={`${CARD_CONTAINER_CLASS} max-w-lg w-full p-4 space-y-3`}>
            <h2 className="text-sm font-semibold text-[#34495E]">{editKey}</h2>
            <textarea
              className="w-full min-h-[200px] rounded-lg border border-[#D5DADF] p-2 font-mono text-[12px]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setEditKey(null)}>
                {t("superAdmin.orgSubCancel")}
              </button>
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void saveEdit()}>
                {t("superAdmin.dataHubSave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
