"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
import {
  CARD_CONTAINER_CLASS,
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
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../../lib/form-styles";
import { notifyListRefresh } from "../../../lib/list-refresh-bus";

type UsageRow = {
  fixedAssetId: string;
  name: string;
  inventoryNumber: string;
  totalExpectedUnits: string | number | null;
  unitsProducedTotal: string | number | null;
  periodUnits: number | null;
};

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function FixedAssetsUsageContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [period, setPeriod] = useState(currentYearMonth);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const [y, m] = period.split("-").map(Number);
    const res = await apiFetch(
      `/api/fixed-assets/usage/monthly?year=${y}&month=${m}`,
    );
    setLoading(false);
    if (!res.ok) {
      setErr(t("fixedAssets.loadErr"));
      return;
    }
    const data = (await res.json()) as { items: UsageRow[] };
    const items = data.items ?? [];
    setRows(items);
    const next: Record<string, string> = {};
    for (const r of items) {
      next[r.fixedAssetId] =
        r.periodUnits != null ? String(r.periodUnits) : "";
    }
    setDraft(next);
  }, [token, period, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  async function saveAll() {
    if (!token) return;
    const [y, m] = period.split("-").map(Number);
    const entries = rows
      .map((r) => {
        const raw = draft[r.fixedAssetId]?.trim();
        if (!raw) return null;
        const periodUnits = Number(raw);
        if (!Number.isFinite(periodUnits) || periodUnits <= 0) return null;
        return { fixedAssetId: r.fixedAssetId, periodUnits };
      })
      .filter(Boolean) as Array<{ fixedAssetId: string; periodUnits: number }>;
    if (entries.length === 0) {
      alert(t("fixedAssets.usageNothingToSave"));
      return;
    }
    setSaving(true);
    const res = await apiFetch("/api/fixed-assets/usage/monthly/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: y, month: m, entries }),
    });
    setSaving(false);
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    notifyListRefresh("fixed-assets-usage");
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
    <div className="space-y-6">
      <PageHeader
        title={t("fixedAssets.usageTitle")}
        subtitle={t("fixedAssets.usageSubtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/fixed-assets" className={SECONDARY_BUTTON_CLASS}>
              ← {t("fixedAssets.backList")}
            </Link>
            <input
              type="month"
              className={TOOLBAR_MONTH_INPUT_CLASS}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label={t("fixedAssets.depreciationMonthLabel")}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={saving || loading}
              onClick={() => void saveAll()}
            >
              {saving ? "…" : t("fixedAssets.usageSaveMonth")}
            </button>
          </div>
        }
      />

      {err && <p className="text-sm text-red-600">{err}</p>}

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("fixedAssets.usageEmpty")}</p>
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full text-[13px]`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("fixedAssets.thName")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("fixedAssets.thInv")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("fixedAssets.totalExpectedUnits")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("fixedAssets.usagePeriodUnits")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.fixedAssetId} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.name}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{r.inventoryNumber}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      {r.totalExpectedUnits ?? "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="w-28 rounded-lg border border-[#D5DADF] px-2 py-1 text-right text-[13px]"
                        value={draft[r.fixedAssetId] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [r.fixedAssetId]: e.target.value,
                          }))
                        }
                        aria-label={t("fixedAssets.usagePeriodUnits")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default function FixedAssetsUsagePage() {
  return (
    <SubscriptionPaywall module="fixedAssets">
      <FixedAssetsUsageContent />
    </SubscriptionPaywall>
  );
}
