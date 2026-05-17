"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import {
  FORM_INPUT_CLASS,
  FORM_LABEL_CLASS,
  TOOLBAR_MONTH_INPUT_CLASS,
} from "../../../lib/form-styles";
import { formatMoneyAzn } from "../../../lib/format-money";

type PeriodRelease = {
  id: string;
  documentDate: string;
  quantity: string;
  materialCost: string;
  recipeName: string;
  finishedProductName: string;
  allocatedAmount: string;
};

type PeriodSummary = {
  period: string;
  suggestedOverheadTotal: string;
  totalAllocated: string;
  releases: PeriodRelease[];
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ManufacturingOverheadContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [period, setPeriod] = useState(currentMonth);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [totalAmount, setTotalAmount] = useState("");
  const [distributionKey, setDistributionKey] = useState<"QUANTITY" | "MATERIAL_COST">(
    "QUANTITY",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const res = await apiFetch(
      `/api/manufacturing/overhead/period-summary?period=${encodeURIComponent(period)}`,
    );
    setLoading(false);
    if (!res.ok) {
      setErr(t("manufacturing.overheadLoadErr"));
      setSummary(null);
      return;
    }
    const data = (await res.json()) as PeriodSummary;
    setSummary(data);
    setTotalAmount((prev) => prev || data.suggestedOverheadTotal);
    setSelected(new Set(data.releases.map((r) => r.id)));
  }, [token, period, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  const allSelected = useMemo(() => {
    if (!summary?.releases.length) return false;
    return summary.releases.every((r) => selected.has(r.id));
  }, [summary, selected]);

  function toggleAll() {
    if (!summary) return;
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(summary.releases.map((r) => r.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAllocate() {
    if (!summary || selected.size === 0) {
      toast.error(t("manufacturing.selectReleases"));
      return;
    }
    const amt = Number(totalAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t("manufacturing.invalidTotal"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/manufacturing/overhead/allocate-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period: summary.period,
        totalAmount: amt,
        distributionKey,
        releaseIds: [...selected],
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("manufacturing.overheadSaveErr"), { description: await res.text() });
      return;
    }
    const out = (await res.json()) as { allocationsCreated: number };
    toast.success(
      t("manufacturing.allocateDone", { count: out.allocationsCreated }),
    );
    void load();
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
    <div className="space-y-6">
      <PageHeader
        title={t("manufacturing.costAllocationTitle")}
        actions={
          <Link href="/manufacturing" className={SECONDARY_BUTTON_CLASS}>
            ← {t("manufacturing.backHub")}
          </Link>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className={FORM_LABEL_CLASS}>{t("manufacturing.overheadPeriod")}</span>
          <input
            type="month"
            className={TOOLBAR_MONTH_INPUT_CLASS}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
        <label className="block min-w-[10rem]">
          <span className={FORM_LABEL_CLASS}>{t("manufacturing.totalOverhead")}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className={FORM_INPUT_CLASS}
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
          />
        </label>
        {summary && (
          <p className="text-[13px] text-[#7F8C8D] pb-1">
            {t("manufacturing.suggestedHint")}: {formatMoneyAzn(summary.suggestedOverheadTotal)}
          </p>
        )}
        <label className="block min-w-[12rem]">
          <span className={FORM_LABEL_CLASS}>{t("manufacturing.distributionKey")}</span>
          <select
            className={FORM_INPUT_CLASS}
            value={distributionKey}
            onChange={(e) =>
              setDistributionKey(e.target.value as "QUANTITY" | "MATERIAL_COST")
            }
          >
            <option value="QUANTITY">{t("manufacturing.distributionKeyQuantity")}</option>
            <option value="MATERIAL_COST">{t("manufacturing.distributionKeyMaterial")}</option>
          </select>
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy || loading}
          onClick={() => void handleAllocate()}
        >
          {t("manufacturing.allocateBtn")}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading && <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>}

      {summary && !loading && (
        <>
          <p className="text-[13px] text-[#7F8C8D]">
            {t("manufacturing.totalAllocated")}: {formatMoneyAzn(summary.totalAllocated)}
          </p>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={t("common.selectAll")}
                    />
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colDate")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colRecipe")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manufacturing.qty")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manufacturing.materialCost")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manufacturing.allocated")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.releases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={DATA_TABLE_TD_CLASS}>
                      {t("manufacturing.noReleases")}
                    </td>
                  </tr>
                ) : (
                  summary.releases.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                        />
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.documentDate.slice(0, 10)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div>{row.recipeName}</div>
                        <div className="text-xs text-[#7F8C8D]">{row.finishedProductName}</div>
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{row.quantity}</td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                        {formatMoneyAzn(row.materialCost)}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                        {formatMoneyAzn(row.allocatedAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function ManufacturingOverheadPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;
  return (
    <SubscriptionPaywall module="manufacturing">
      <ManufacturingOverheadContent />
    </SubscriptionPaywall>
  );
}
