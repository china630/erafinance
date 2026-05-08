"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { inputFieldClass } from "../../../lib/form-classes";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { SECONDARY_BUTTON_CLASS } from "../../../lib/design-system";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";

type Driver = { id: string; name: string; type: string };
type OhDriverType = "VOLUME" | "TIME" | "MATERIAL_COST";

type Pool = {
  id: string;
  period: string;
  totalAmount: unknown;
  sourceAccountCode: string;
  debitAccountCode: string;
  creditAccountCode: string;
  driverId: string;
  driver?: Driver;
};

const lbl = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

function ManufacturingOverheadContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [dName, setDName] = useState("");
  const [dType, setDType] = useState<OhDriverType>("VOLUME");

  const [pTotal, setPTotal] = useState("100");
  const [pSource, setPSource] = useState("741");
  const [pDriver, setPDriver] = useState("");
  const [pDebit, setPDebit] = useState("204");
  const [pCredit, setPCredit] = useState("741");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const [dr, pl] = await Promise.all([
      apiFetch("/api/manufacturing/overhead/drivers"),
      apiFetch(`/api/manufacturing/overhead/pools?period=${encodeURIComponent(period)}`),
    ]);
    if (!dr.ok || !pl.ok) {
      setErr(t("manufacturing.overheadLoadErr"));
      return;
    }
    const dlist = (await dr.json()) as Driver[];
    const plist = (await pl.json()) as Pool[];
    setDrivers(dlist);
    setPools(plist);
    setPDriver((prev) => prev || dlist[0]?.id || "");
  }, [token, period, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  const driverOptions = useMemo(
    () => [
      { v: "VOLUME" as const, k: "VOLUME" },
      { v: "TIME" as const, k: "TIME" },
      { v: "MATERIAL_COST" as const, k: "MATERIAL_COST" },
    ],
    [],
  );

  const createDriver = async () => {
    if (!token) return;
    setErr(null);
    const res = await apiFetch("/api/manufacturing/overhead/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: dName.trim(), type: dType }),
    });
    if (!res.ok) {
      setErr(t("manufacturing.overheadSaveErr"));
      return;
    }
    setDName("");
    void load();
  };

  const createPool = async () => {
    if (!token || !pDriver) return;
    setErr(null);
    const res = await apiFetch("/api/manufacturing/overhead/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period,
        totalAmount: Number(pTotal),
        sourceAccountCode: pSource.trim(),
        driverId: pDriver,
        debitAccountCode: pDebit.trim(),
        creditAccountCode: pCredit.trim(),
      }),
    });
    if (!res.ok) {
      setErr(t("manufacturing.overheadSaveErr"));
      return;
    }
    void load();
  };

  const allocate = async () => {
    if (!token) return;
    setErr(null);
    setMsg(null);
    const res = await apiFetch(
      `/api/manufacturing/overhead/allocate?period=${encodeURIComponent(period)}`,
      { method: "POST" },
    );
    if (!res.ok) {
      setErr(t("manufacturing.overheadSaveErr"));
      return;
    }
    const body = (await res.json()) as { poolsProcessed: number; allocationsCreated: number };
    setMsg(
      t("manufacturing.overheadAllocateDone", {
        pools: body.poolsProcessed,
        alloc: body.allocationsCreated,
      }),
    );
    void load();
  };

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title={t("manufacturing.overheadTitle")}
        actions={
          <Link href="/manufacturing/releases" className={SECONDARY_BUTTON_CLASS}>
            ← {t("manufacturing.backHub")}
          </Link>
        }
      />

      <div>
        <label className={lbl} htmlFor="oh-period">
          {t("manufacturing.overheadPeriod")}
        </label>
        <input
          id="oh-period"
          className={inputFieldClass}
          value={period}
          onChange={(e) => setPeriod(e.target.value.trim())}
        />
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3">{t("manufacturing.overheadDrivers")}</h2>
        <ul className="text-sm text-slate-700 space-y-1 mb-4">
          {drivers.map((d) => (
            <li key={d.id}>
              {d.name} — {d.type}
            </li>
          ))}
          {drivers.length === 0 ? <li className="text-slate-500">{t("psa.none")}</li> : null}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{t("manufacturing.overheadDriverName")}</label>
            <input className={inputFieldClass} value={dName} onChange={(e) => setDName(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t("manufacturing.overheadDriverType")}</label>
            <select
              className={inputFieldClass}
              value={dType}
              onChange={(e) => setDType(e.target.value as OhDriverType)}
            >
              {driverOptions.map((o) => (
                <option key={o.k} value={o.v}>
                  {o.k}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void createDriver()}
        >
          {t("manufacturing.overheadCreateDriver")}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3">{t("manufacturing.overheadPools")}</h2>
        <ul className="text-sm text-slate-700 space-y-1 mb-4">
          {pools.map((p) => (
            <li key={p.id}>
              {p.period}: {String(p.totalAmount)} AZN — {p.driver?.name ?? p.driverId} (Dr {p.debitAccountCode}{" "}
              / Cr {p.creditAccountCode})
            </li>
          ))}
          {pools.length === 0 ? <li className="text-slate-500">—</li> : null}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{t("manufacturing.overheadPoolTotal")}</label>
            <input className={inputFieldClass} value={pTotal} onChange={(e) => setPTotal(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t("manufacturing.overheadSourceAccount")}</label>
            <input className={inputFieldClass} value={pSource} onChange={(e) => setPSource(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t("manufacturing.overheadDebitAccount")}</label>
            <input className={inputFieldClass} value={pDebit} onChange={(e) => setPDebit(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t("manufacturing.overheadCreditAccount")}</label>
            <input className={inputFieldClass} value={pCredit} onChange={(e) => setPCredit(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>{t("manufacturing.overheadDriverId")}</label>
            <select
              className={inputFieldClass}
              value={pDriver}
              onChange={(e) => setPDriver(e.target.value)}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
          onClick={() => void createPool()}
        >
          {t("manufacturing.overheadCreatePool")}
        </button>
      </section>

      <button
        type="button"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        onClick={() => void allocate()}
      >
        {t("manufacturing.overheadAllocate")}
      </button>
    </div>
  );
}

export default function ManufacturingOverheadPage() {
  return (
    <SubscriptionPaywall module="manufacturing">
      <ManufacturingOverheadContent />
    </SubscriptionPaywall>
  );
}
