"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";
import { subscribeListRefresh } from "../../lib/list-refresh-bus";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";
type DashboardPayload = {
  activeRuns: { count: number; comingSoon: boolean };
  recentReleases: Array<{
    id: string;
    documentDate: string;
    quantity: string;
    materialCost: string;
    recipeName: string;
    finishedProductName: string;
  }>;
  inventoryAlerts: Array<{
    productId: string;
    productName: string;
    recipeName: string;
    available: string;
    needPerUnit: string;
  }>;
};

function formatDate(d: string): string {
  return d.slice(0, 10);
}

export function ManufacturingDashboardWidgets() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const res = await apiFetch("/api/manufacturing/dashboard");
    if (!res.ok) {
      setErr(t("manufacturing.loadErr"));
      return;
    }
    setData((await res.json()) as DashboardPayload);
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    return subscribeListRefresh("manufacturing-dashboard", () => void load());
  }, [load]);

  if (!ready || !token) return null;
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!data) return <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={`${CARD_CONTAINER_CLASS} p-5`}>
        <h2 className="m-0 text-base font-semibold text-[#34495E]">
          {t("manufacturing.widgetActiveRuns")}
        </h2>
        <p className="mt-3 text-3xl font-bold text-[#2980B9]">{data.activeRuns.count}</p>
        {data.activeRuns.comingSoon ? (
          <p className="mt-2 mb-0 text-[13px] text-[#7F8C8D]">
            {t("manufacturing.activeRunsComingSoon")}
          </p>
        ) : (
          <Link
            href="/manufacturing/orders?status=IN_PROGRESS"
            className={`${SECONDARY_BUTTON_CLASS} mt-3 inline-block text-xs`}
          >
            {t("manufacturing.viewOrders")}
          </Link>
        )}
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-5 lg:col-span-1`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-base font-semibold text-[#34495E]">
            {t("manufacturing.widgetRecentReleases")}
          </h2>
          <Link href="/manufacturing/releases" className={`${SECONDARY_BUTTON_CLASS} text-xs`}>
            {t("manufacturing.viewAll")}
          </Link>
        </div>
        {data.recentReleases.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("manufacturing.noReleases")}</p>
        ) : (
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colRecipe")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.qty")}</th>
              </tr>
            </thead>
            <tbody>
              {data.recentReleases.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{formatDate(r.documentDate)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.recipeName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-5 lg:col-span-1`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-base font-semibold text-[#34495E]">
            {t("manufacturing.widgetInventoryAlerts")}
          </h2>
          <Link href="/inventory" className={`${SECONDARY_BUTTON_CLASS} text-xs`}>
            {t("manufacturing.openInventory")}
          </Link>
        </div>
        {data.inventoryAlerts.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("manufacturing.noAlerts")}</p>
        ) : (
          <ul className="m-0 list-none space-y-2 p-0">
            {data.inventoryAlerts.map((a) => (
              <li
                key={`${a.productId}-${a.recipeName}`}
                className="rounded-lg border border-[#D5DADF] px-3 py-2 text-[13px]"
              >
                <div className="font-medium text-[#34495E]">{a.productName}</div>
                <div className="text-[#7F8C8D]">
                  {t("manufacturing.alertRecipe")}: {a.recipeName} · {t("manufacturing.alertStock")}:{" "}
                  {a.available} / {a.needPerUnit}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
