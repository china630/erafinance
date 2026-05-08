"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/page-header";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch } from "../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type TariffRow = {
  id: string;
  hsCode: string;
  description: string | null;
  dutyRatePercent: unknown;
  vatRatePercent: unknown;
  excisePercent: unknown;
};

export default function CustomsTariffRatesAdminPage() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [rows, setRows] = useState<TariffRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [hsCode, setHsCode] = useState("");
  const [duty, setDuty] = useState("15");
  const [vat, setVat] = useState("18");
  const [excise, setExcise] = useState("0");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const res = await apiFetch("/api/admin/customs-tariff-rates");
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    setRows((await res.json()) as TariffRow[]);
  }, [token]);

  useEffect(() => {
    if (!token || !user?.isSuperAdmin) return;
    void load();
  }, [token, user?.isSuperAdmin, load]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="p-6">
        <p className="text-slate-600">{t("superAdmin.forbidden")}</p>
        <Link href="/super-admin" className="text-blue-600 underline text-sm">
          Super-Admin
        </Link>
      </div>
    );
  }

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

  const remove = async (id: string) => {
    if (!token) return;
    if (!window.confirm("OK?")) return;
    const res = await apiFetch(`/api/admin/customs-tariff-rates/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      window.alert(await res.text());
      return;
    }
    await load();
  };

  const fmt = (v: unknown) => (v == null ? "—" : String(v));

  return (
    <div className="space-y-4 p-4 max-w-5xl mx-auto">
      <PageHeader title={t("trade.customs.tariffRatesTitle")} />
      <p className="text-sm text-slate-600">{t("trade.customs.tariffRatesHint")}</p>
      <p className="text-sm">
        <Link href="/super-admin" className="text-blue-600 underline">
          ← Super-Admin
        </Link>
      </p>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className={CARD_CONTAINER_CLASS + " p-4 space-y-3"}>
        <h2 className="text-sm font-semibold text-slate-800">{t("trade.customs.tariffRatesSave")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            {t("trade.customs.tariffRatesHs")}
            <input
              className="border rounded px-2 py-1 text-sm"
              value={hsCode}
              onChange={(e) => setHsCode(e.target.value)}
              placeholder="85"
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            {t("trade.customs.tariffRatesDuty")}
            <input
              className="border rounded px-2 py-1 text-sm"
              value={duty}
              onChange={(e) => setDuty(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            {t("trade.customs.tariffRatesVat")}
            <input
              className="border rounded px-2 py-1 text-sm"
              value={vat}
              onChange={(e) => setVat(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            {t("trade.customs.tariffRatesExcise")}
            <input
              className="border rounded px-2 py-1 text-sm"
              value={excise}
              onChange={(e) => setExcise(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600 flex flex-col gap-1">
            {t("trade.customs.colDesc")}
            <input
              className="border rounded px-2 py-1 text-sm"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void save()}>
          {t("trade.customs.tariffRatesSave")}
        </button>
      </div>

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesHs")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colDesc")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesDuty")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesVat")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.tariffRatesExcise")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{r.hsCode}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.description ?? "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>{fmt(r.dutyRatePercent)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{fmt(r.vatRatePercent)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{fmt(r.excisePercent)}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void remove(r.id)}>
                    {t("trade.customs.tariffRatesDelete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
