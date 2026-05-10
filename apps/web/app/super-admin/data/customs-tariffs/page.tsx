"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
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

type TariffRow = {
  id: string;
  hsCode: string;
  effectiveFrom: string;
  description: string | null;
  dutyRatePercent: unknown;
  vatRatePercent: unknown;
  excisePercent: unknown;
  deletedAt?: string | null;
};

export default function DataHubCustomsTariffsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [rows, setRows] = useState<TariffRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [hsCode, setHsCode] = useState("");
  const [duty, setDuty] = useState("15");
  const [vat, setVat] = useState("18");
  const [excise, setExcise] = useState("0");
  const [desc, setDesc] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("2000-01-01");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const q = includeInactive ? "?includeInactive=1" : "";
    const res = await apiFetch(`/api/admin/customs-tariff-rates${q}`);
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setRows((await res.json()) as TariffRow[]);
  }, [token, includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!token) return;
    const res = await apiFetch("/api/admin/customs-tariff-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hsCode,
        description: desc || null,
        dutyRatePercent: Number(duty),
        vatRatePercent: Number(vat),
        excisePercent: Number(excise),
        effectiveFrom: `${effectiveFrom.slice(0, 10)}T00:00:00.000Z`,
      }),
    });
    if (!res.ok) {
      window.alert(await res.text());
      return;
    }
    setHsCode("");
    setDesc("");
    await load();
  };

  const deactivate = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t("superAdmin.dataHubConfirmDeactivate"))) return;
    const res = await apiFetch(`/api/admin/customs-tariff-rates/${encodeURIComponent(id)}/deactivate`, {
      method: "POST",
    });
    if (!res.ok) {
      window.alert(await res.text());
      return;
    }
    await load();
  };

  const restore = async (id: string) => {
    if (!token) return;
    if (!window.confirm(t("superAdmin.dataHubConfirmRestore"))) return;
    const res = await apiFetch(`/api/admin/customs-tariff-rates/${encodeURIComponent(id)}/restore`, {
      method: "POST",
    });
    if (!res.ok) {
      window.alert(await res.text());
      return;
    }
    await load();
  };

  const fmt = (v: unknown) => (v == null ? "—" : String(v));

  return (
    <div className="space-y-4">
      <PageHeader title={t("trade.customs.tariffRatesTitle")} />
      <p className="text-sm text-[#7F8C8D]">{t("trade.customs.tariffRatesHint")}</p>
      <p className="text-sm">
        <Link href="/super-admin/data" className="text-[#2980B9] underline">
          ← {t("superAdmin.dataHubTitle")}
        </Link>
      </p>

      <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
        <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
        {t("superAdmin.dataHubIncludeInactive")}
      </label>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
        <h2 className="text-sm font-semibold text-[#34495E]">{t("trade.customs.tariffRatesSave")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <label className="text-xs text-[#34495E] flex flex-col gap-1">
            {t("trade.customs.tariffRatesHs")}
            <input
              className="border border-[#D5DADF] rounded px-2 py-1 text-sm"
              value={hsCode}
              onChange={(e) => setHsCode(e.target.value)}
              placeholder="85"
            />
          </label>
          <label className="text-xs text-[#34495E] flex flex-col gap-1">
            {t("trade.customs.tariffRatesEffectiveFrom")}
            <input
              type="date"
              className="border border-[#D5DADF] rounded px-2 py-1 text-sm"
              value={effectiveFrom.slice(0, 10)}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </label>
          <label className="text-xs text-[#34495E] flex flex-col gap-1">
            {t("trade.customs.tariffRatesDuty")}
            <input className="border border-[#D5DADF] rounded px-2 py-1 text-sm" value={duty} onChange={(e) => setDuty(e.target.value)} />
          </label>
          <label className="text-xs text-[#34495E] flex flex-col gap-1">
            {t("trade.customs.tariffRatesVat")}
            <input className="border border-[#D5DADF] rounded px-2 py-1 text-sm" value={vat} onChange={(e) => setVat(e.target.value)} />
          </label>
          <label className="text-xs text-[#34495E] flex flex-col gap-1">
            {t("trade.customs.tariffRatesExcise")}
            <input className="border border-[#D5DADF] rounded px-2 py-1 text-sm" value={excise} onChange={(e) => setExcise(e.target.value)} />
          </label>
          <label className="text-xs text-[#34495E] flex flex-col gap-1">
            {t("trade.customs.colDesc")}
            <input className="border border-[#D5DADF] rounded px-2 py-1 text-sm" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void save()}>
          {t("trade.customs.tariffRatesSave")}
        </button>
      </div>

      <SuperAdminDataTable>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesHs")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesEffectiveFrom")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colDesc")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesDuty")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesVat")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesExcise")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.dataHubColStatus")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const inactive = !!r.deletedAt;
            return (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{r.hsCode}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.effectiveFrom?.slice(0, 10) ?? "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.description ?? "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>{fmt(r.dutyRatePercent)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{fmt(r.vatRatePercent)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{fmt(r.excisePercent)}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {inactive ? t("superAdmin.dataHubInactive") : t("superAdmin.dataHubActive")}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {inactive ? (
                    <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void restore(r.id)}>
                      {t("superAdmin.dataHubRestore")}
                    </button>
                  ) : (
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void deactivate(r.id)}>
                      {t("superAdmin.dataHubDeactivate")}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </SuperAdminDataTable>
    </div>
  );
}
