"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { inputFieldClass } from "../../../lib/form-classes";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { SECONDARY_BUTTON_CLASS } from "../../../lib/design-system";

type Cp = { id: string; name: string; taxId?: string | null };
type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  billingMode: string;
  hourlyRate?: unknown;
  counterparty?: { id: string };
  _count?: { timeEntries: number; tasks: number };
};

const lbl = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

export default function PsaProjectsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [cps, setCps] = useState<Cp[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [cpId, setCpId] = useState("");
  const [rate, setRate] = useState("50");

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const [pr, cp] = await Promise.all([
      apiFetch("/api/psa/projects"),
      apiFetch("/api/counterparties"),
    ]);
    if (!pr.ok || !cp.ok) {
      setErr(t("psa.loadErr"));
      return;
    }
    setProjects((await pr.json()) as Project[]);
    const cplist = (await cp.json()) as Cp[];
    setCps(cplist);
    setCpId((prev) => prev || cplist[0]?.id || "");
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  const createProject = async () => {
    if (!token || !cpId) return;
    setErr(null);
    const res = await apiFetch("/api/psa/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        name: name.trim(),
        counterpartyId: cpId,
        hourlyRate: Number(rate),
        billingMode: "HOURLY",
      }),
    });
    if (!res.ok) {
      setErr(t("psa.saveErr"));
      return;
    }
    setCode("");
    setName("");
    void load();
  };

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title={t("psa.title")}
        actions={
          <Link href="/employees" className={SECONDARY_BUTTON_CLASS}>
            ← {t("nav.employees")}
          </Link>
        }
      />

      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3">{t("psa.projects")}</h2>
        <ul className="text-sm text-slate-700 divide-y divide-slate-100">
          {projects.map((p) => (
            <li key={p.id} className="py-2 flex justify-between gap-2">
              <span>
                <span className="font-mono text-xs text-slate-500">{p.code}</span> {p.name}
              </span>
              <span className="text-xs text-slate-500">
                {p._count?.timeEntries ?? 0}h / {p._count?.tasks ?? 0} tasks
              </span>
            </li>
          ))}
          {projects.length === 0 ? <li className="py-2 text-slate-500">{t("psa.none")}</li> : null}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800 mb-3">{t("psa.createProject")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={lbl}>{t("psa.code")}</label>
            <input className={inputFieldClass} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t("psa.name")}</label>
            <input className={inputFieldClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>{t("psa.hourlyRate")}</label>
            <input className={inputFieldClass} value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>{t("psa.counterpartyId")}</label>
            <select className={inputFieldClass} value={cpId} onChange={(e) => setCpId(e.target.value)}>
              {cps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id.slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          onClick={() => void createProject()}
        >
          {t("psa.createProject")}
        </button>
      </section>
    </div>
  );
}
