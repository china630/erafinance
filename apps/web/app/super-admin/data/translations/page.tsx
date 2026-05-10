"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

type Item = {
  id: string | null;
  key: string;
  value: string;
  effectiveValue: string;
  defaultValue: string;
  isOverride: boolean;
  isActive: boolean;
  updatedAt: string | null;
};

export default function DataHubTranslationsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [locale, setLocale] = useState("az");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ locale, take: "5000" });
    if (q.trim()) params.set("q", q.trim());
    const res = await apiFetch(`/api/admin/translations?${params.toString()}`);
    if (!res.ok) {
      toast.error(await res.text());
      setItems([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { items: Item[] };
    setItems(data.items ?? []);
    setLoading(false);
  }, [token, locale, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSync = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      const res = await apiFetch("/api/admin/translations/sync", { method: "POST" });
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      toast.success(t("superAdminTranslations.syncOk"));
    } finally {
      setSyncing(false);
    }
  };

  const upsert = async (key: string, value: string) => {
    if (!token) return;
    const res = await apiFetch("/api/admin/translations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, key, value }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    void load();
  };

  const patchOverride = async (id: string, patch: { value?: string; isActive?: boolean }) => {
    if (!token) return;
    const res = await apiFetch(`/api/admin/translations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    void load();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (r) =>
        r.key.toLowerCase().includes(s) ||
        r.value.toLowerCase().includes(s) ||
        r.effectiveValue.toLowerCase().includes(s),
    );
  }, [items, q]);

  const editValue = (row: Item) => {
    if (!row.isOverride || !row.id) {
      const nv = window.prompt(t("superAdminTranslations.value"), row.effectiveValue);
      if (nv === null) return;
      void upsert(row.key, nv);
      return;
    }
    const nv = window.prompt(t("superAdminTranslations.value"), row.value);
    if (nv === null) return;
    void patchOverride(row.id, { value: nv });
  };

  const toggleActive = (row: Item) => {
    if (!row.id) return;
    if (!window.confirm(t("superAdminTranslations.confirmToggleInactive"))) return;
    void patchOverride(row.id, { isActive: !row.isActive });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("superAdminTranslations.title")} subtitle={t("superAdminTranslations.subtitle")} />

      <div className={`${CARD_CONTAINER_CLASS} p-4 flex flex-wrap gap-3 items-end`}>
        <label className="text-[13px] text-[#34495E]">
          {t("superAdminTranslations.locale")}
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="ml-2 rounded-lg border border-[#D5DADF] px-2 py-1"
          >
            <option value="az">az</option>
            <option value="ru">ru</option>
            <option value="en">en</option>
          </select>
        </label>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("superAdminTranslations.search")}
          className="min-w-[200px] flex-1 rounded-lg border border-[#D5DADF] px-3 py-1.5 text-[13px]"
        />
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("superAdminTranslations.refresh")}
        </button>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={syncing} onClick={() => void onSync()}>
          {syncing ? "…" : t("superAdminTranslations.sync")}
        </button>
      </div>

      <div className={CARD_CONTAINER_CLASS}>
        {loading ? (
          <p className="p-6 text-[#7F8C8D]">{t("common.loading")}</p>
        ) : (
          <SuperAdminDataTable>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>Key</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdminTranslations.value")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdminTranslations.effective")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdminTranslations.source")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdminTranslations.activeFlag")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => (
                <tr key={r.key} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[12px]`}>{r.key}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-md truncate`}>{r.value}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-md truncate`}>{r.effectiveValue}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[12px] text-[#7F8C8D]`}>
                    {r.isOverride ? t("superAdminTranslations.fromDb") : t("superAdminTranslations.fromBundle")}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-[12px]`}>
                    {r.isOverride ? (r.isActive ? t("superAdmin.dataHubActive") : t("superAdmin.dataHubInactive")) : "—"}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} space-x-2 whitespace-nowrap`}>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => editValue(r)}>
                      {t("superAdmin.dataHubEdit")}
                    </button>
                    {r.isOverride && r.id ? (
                      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => toggleActive(r)}>
                        {r.isActive
                          ? t("superAdminTranslations.deactivateOverride")
                          : t("superAdminTranslations.activateOverride")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </SuperAdminDataTable>
        )}
      </div>
      <p className="text-[12px] text-[#7F8C8D]">{t("superAdminTranslations.toggleInactiveHint")}</p>
    </div>
  );
}
