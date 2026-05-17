"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type Schedule = {
  id: string;
  period: string;
  amount: unknown;
  status: string;
};

type Row = {
  id: string;
  totalAmount: unknown;
  currency: string;
  startDate: string;
  endDate: string;
  status: string;
  expenseAccountCode: string;
  prepaidAccountCode: string;
  schedules: Schedule[];
};

export default function PrepaidExpensesPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState("1000");
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState("2025-03-31");
  const [periodById, setPeriodById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch("/api/prepaid-expenses");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      setRows((await res.json()) as Row[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function create() {
    if (!token) return;
    const res = await apiFetch("/api/prepaid-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalAmount: total,
        startDate: start,
        endDate: end,
      }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    await load();
  }

  async function postMonth(prepaidId: string) {
    if (!token) return;
    const period = (periodById[prepaidId] ?? "").trim();
    if (!period) {
      toast.error(t("prepaid.periodPh"));
      return;
    }
    const res = await apiFetch(
      `/api/prepaid-expenses/${encodeURIComponent(prepaidId)}/post-month?period=${encodeURIComponent(period)}`,
      { method: "POST" },
    );
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    await load();
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
    <div className="w-full max-w-none space-y-8">
      <PageHeader title={t("prepaid.title")} subtitle={t("prepaid.subtitle")} />

      <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-[#7F8C8D]">
            {t("prepaid.total")}
            <input
              className="mt-1 w-full rounded border border-[#D1D5DB] p-2 text-sm"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </label>
          <label className="text-xs text-[#7F8C8D]">
            {t("prepaid.start")}
            <input
              type="date"
              className="mt-1 w-full rounded border border-[#D1D5DB] p-2 text-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="text-xs text-[#7F8C8D]">
            {t("prepaid.end")}
            <input
              type="date"
              className="mt-1 w-full rounded border border-[#D1D5DB] p-2 text-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void create()}>
          {t("prepaid.create")}
        </button>
      </section>

      {loading ? <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="text-sm text-[#7F8C8D]">{t("prepaid.empty")}</p>
      ) : null}

      <ul className="space-y-4">
        {rows.map((r) => (
          <li
            key={r.id}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm space-y-2"
          >
            <div className="text-sm font-medium text-[#34495E]">
              {String(r.totalAmount)} {r.currency} · {r.status}
            </div>
            <div className="text-xs text-[#7F8C8D]">
              {String(r.startDate).slice(0, 10)} → {String(r.endDate).slice(0, 10)} · Dr{" "}
              {r.expenseAccountCode} / Cr {r.prepaidAccountCode}
            </div>
            <ul className="text-xs text-[#2C3E50] space-y-1">
              {r.schedules.map((s) => (
                <li key={s.id}>
                  {s.period}: {String(s.amount)} — {s.status}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <input
                className="rounded border border-[#D1D5DB] p-1.5 text-xs w-28"
                placeholder={t("prepaid.periodPh")}
                value={periodById[r.id] ?? ""}
                onChange={(e) =>
                  setPeriodById((prev) => ({ ...prev, [r.id]: e.target.value }))
                }
              />
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => void postMonth(r.id)}
              >
                {t("prepaid.postMonth")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
