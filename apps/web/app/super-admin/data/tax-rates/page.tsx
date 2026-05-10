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
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";

const TAX_KINDS = ["VAT", "EXCISE", "INCOME", "SOCIAL"] as const;

type Row = {
  id: string;
  code: string;
  kind: string;
  region: string | null;
  percent: unknown;
  effectiveFrom: string;
  effectiveTo: string | null;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  isActive: boolean;
  usageTotal?: number;
};

export default function DataHubTaxRatesPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<string>("VAT");
  const [percent, setPercent] = useState("18");
  const [effectiveFrom, setEffectiveFrom] = useState("2024-01-01");
  const [nameAz, setNameAz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [nameEn, setNameEn] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/admin/tax-rates");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      const data = (await res.json()) as Row[];
      setRows(data.map((r) => ({ ...r, usageTotal: (r as { usageTotal?: number }).usageTotal ?? 0 })));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const createRow = async () => {
    if (!token) return;
    const res = await apiFetch("/api/admin/tax-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        kind,
        percent: Number(percent),
        effectiveFrom: `${effectiveFrom}T00:00:00.000Z`,
        nameAz: nameAz.trim(),
        nameRu: nameRu.trim(),
        nameEn: nameEn.trim(),
      }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    setCode("");
    void load();
  };

  const toggle = async (id: string, isActive: boolean) => {
    if (!token) return;
    const msg = isActive ? t("superAdmin.dataHubConfirmDeactivate") : t("superAdmin.dataHubConfirmRestore");
    if (!window.confirm(msg)) return;
    const res = await apiFetch(`/api/admin/tax-rates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    void load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("superAdmin.dataHubTaxRates")} />

      <div className={`${CARD_CONTAINER_CLASS} p-4 grid gap-2 md:grid-cols-3 lg:grid-cols-8`}>
        <label className="text-xs text-[#34495E] flex flex-col gap-1">
          Code
          <input className="rounded border border-[#D5DADF] px-2 py-1 font-mono" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className="text-xs text-[#34495E] flex flex-col gap-1">
          Kind
          <select className="rounded border border-[#D5DADF] px-2 py-1" value={kind} onChange={(e) => setKind(e.target.value)}>
            {TAX_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-[#34495E] flex flex-col gap-1">
          %
          <input className="rounded border border-[#D5DADF] px-2 py-1" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </label>
        <label className="text-xs text-[#34495E] flex flex-col gap-1">
          From
          <input type="date" className="rounded border border-[#D5DADF] px-2 py-1" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </label>
        <label className="text-xs text-[#34495E] flex flex-col gap-1">
          AZ
          <input className="rounded border border-[#D5DADF] px-2 py-1" value={nameAz} onChange={(e) => setNameAz(e.target.value)} />
        </label>
        <label className="text-xs text-[#34495E] flex flex-col gap-1">
          RU
          <input className="rounded border border-[#D5DADF] px-2 py-1" value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
        </label>
        <label className="text-xs text-[#34495E] flex flex-col gap-1">
          EN
          <input className="rounded border border-[#D5DADF] px-2 py-1" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void createRow()}>
            {t("common.create")}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
      ) : (
        <SuperAdminDataTable>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Code</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Kind</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>%</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>From</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("superAdmin.dataHubColUsage")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.dataHubColStatus")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{r.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.kind}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{String(r.percent)}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[12px]`}>{r.effectiveFrom.slice(0, 10)}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{r.usageTotal ?? 0}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {r.isActive ? t("superAdmin.dataHubActive") : t("superAdmin.dataHubInactive")}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button
                    type="button"
                    className={r.isActive ? SECONDARY_BUTTON_CLASS : PRIMARY_BUTTON_CLASS}
                    onClick={() => void toggle(r.id, r.isActive)}
                  >
                    {r.isActive ? t("superAdmin.dataHubDeactivate") : t("superAdmin.dataHubActivate")}
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
