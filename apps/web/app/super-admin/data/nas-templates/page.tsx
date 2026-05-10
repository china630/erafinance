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
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";

type Row = {
  id: string;
  kind: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  accountType: string;
  parentCode: string | null;
  cashProfile: string | null;
  sortOrder: number;
  isDeprecated: boolean;
  usageTotal?: number;
};

const KINDS = ["COMMERCIAL", "BUDGET", "NGO"] as const;
const ACC_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;

export default function DataHubNasTemplatesPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "COMMERCIAL" as (typeof KINDS)[number],
    code: "",
    nameAz: "",
    nameRu: "",
    nameEn: "",
    accountType: "EXPENSE" as (typeof ACC_TYPES)[number],
    parentCode: "",
    sortOrder: 0,
  });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/admin/template-accounts");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      setRows(await res.json());
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const upsert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const res = await apiFetch("/api/admin/template-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        code: form.code.trim(),
        nameAz: form.nameAz.trim(),
        nameRu: form.nameRu.trim(),
        nameEn: form.nameEn.trim(),
        accountType: form.accountType,
        parentCode: form.parentCode.trim() || null,
        sortOrder: Number(form.sortOrder) || 0,
        isDeprecated: false,
      }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    setForm({
      kind: "COMMERCIAL",
      code: "",
      nameAz: "",
      nameRu: "",
      nameEn: "",
      accountType: "EXPENSE",
      parentCode: "",
      sortOrder: 0,
    });
    void load();
  };

  const patchDeprecate = async (id: string, isDeprecated: boolean) => {
    if (!token) return;
    const msg = isDeprecated ? t("superAdmin.dataHubConfirmRestore") : t("superAdmin.dataHubConfirmDeactivate");
    if (!window.confirm(msg)) return;
    setBusyId(id);
    const res = await apiFetch(`/api/admin/template-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDeprecated: !isDeprecated }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    void load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("superAdmin.dataHubNasTemplates")} />

      <form onSubmit={(e) => void upsert(e)} className={`${CARD_CONTAINER_CLASS} p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-9`}>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColKind")}
          <select
            value={form.kind}
            onChange={(e) => setForm((s) => ({ ...s, kind: e.target.value as (typeof KINDS)[number] }))}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColCode")}
          <input
            required
            value={form.code}
            onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColNameAz")}
          <input
            required
            value={form.nameAz}
            onChange={(e) => setForm((s) => ({ ...s, nameAz: e.target.value }))}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColNameRu")}
          <input
            required
            value={form.nameRu}
            onChange={(e) => setForm((s) => ({ ...s, nameRu: e.target.value }))}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColNameEn")}
          <input
            required
            value={form.nameEn}
            onChange={(e) => setForm((s) => ({ ...s, nameEn: e.target.value }))}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColType")}
          <select
            value={form.accountType}
            onChange={(e) => setForm((s) => ({ ...s, accountType: e.target.value as (typeof ACC_TYPES)[number] }))}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          >
            {ACC_TYPES.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColParent")}
          <input
            value={form.parentCode}
            onChange={(e) => setForm((s) => ({ ...s, parentCode: e.target.value }))}
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          />
        </label>
        <label className="text-xs font-medium text-[#34495E]">
          {t("superAdmin.chartColSort")}
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) =>
              setForm((s) => ({ ...s, sortOrder: Number.parseInt(e.target.value, 10) || 0 }))
            }
            className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className={PRIMARY_BUTTON_CLASS}>
            {t("superAdmin.chartSaveRow")}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
      ) : (
        <SuperAdminDataTable>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.chartColKind")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.chartColCode")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.chartColNameAz")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.chartColType")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("superAdmin.dataHubColUsage")}</th>
              <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("superAdmin.chartColDepr")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{r.kind}</td>
                <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{r.code}</td>
                <td className={`${DATA_TABLE_TD_CLASS} max-w-[12rem] truncate text-xs`}>{r.nameAz}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-xs`}>{r.accountType}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right text-xs`}>{r.usageTotal ?? 0}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-center text-xs`}>{r.isDeprecated ? "✓" : "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busyId === r.id}
                    onClick={() => void patchDeprecate(r.id, r.isDeprecated)}
                  >
                    {r.isDeprecated ? t("superAdmin.dataHubRestore") : t("superAdmin.dataHubDeprecate")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </SuperAdminDataTable>
      )}
    </div>
  );
}
