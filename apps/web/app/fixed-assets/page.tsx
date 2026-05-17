"use client";

import Link from "next/link";
import { Building2, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { formatMoneyAzn } from "../../lib/format-money";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useAuth } from "../../lib/auth-context";
import { isRestrictedUserRole } from "../../lib/role-utils";
import { EmptyState } from "../../components/empty-state";
import { PageHeader } from "../../components/layout/page-header";
import { SubscriptionPaywall } from "../../components/subscription-paywall";
import { FixedAssetModal } from "../../components/fixed-assets/fixed-asset-modal";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../lib/form-styles";

type Fa = {
  id: string;
  name: string;
  inventoryNumber: string;
  purchaseDate: string;
  status: "ACTIVE" | "DISPOSED";
  depreciationMethod:
    | "STRAIGHT_LINE"
    | "REDUCING_BALANCE"
    | "UNITS_OF_PRODUCTION";
  purchasePrice: unknown;
  usefulLifeMonths: number;
  salvageValue: unknown;
  bookedDepreciation: unknown;
};

function FixedAssetsPageContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const hideDestructive = isRestrictedUserRole(user?.role ?? undefined);
  const [rows, setRows] = useState<Fa[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [faModalOpen, setFaModalOpen] = useState(false);
  const [faModalMode, setFaModalMode] = useState<"create" | "edit">("create");
  const [faEditId, setFaEditId] = useState<string | null>(null);
  const [depYearMonth, setDepYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [runningDep, setRunningDep] = useState(false);
  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/fixed-assets");
    if (!res.ok) {
      setErr(`${t("fixedAssets.loadErr")}: ${res.status}`);
      setRows([]);
    } else {
      setRows(await res.json());
    }
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    const onOnline = () => {
      void load();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [load]);

  async function remove(id: string) {
    if (!token || !window.confirm("OK?")) return;
    const res = await apiFetch(`/api/fixed-assets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    await load();
  }

  async function runDepreciation() {
    if (!token) return;
    setRunningDep(true);
    try {
      const parts = depYearMonth.trim().split("-");
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        alert(t("common.fillRequired"));
        return;
      }
      const res = await apiFetch("/api/fixed-assets/depreciation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
        }),
      });
      if (!res.ok) {
        alert(await res.text());
        return;
      }
      const data = (await res.json()) as {
        assetsCount: number;
        totalAmount: string;
      };
      alert(
        t("fixedAssets.deprRunDone", {
          count: data.assetsCount,
          amount: data.totalAmount,
        }),
      );
      await load();
    } finally {
      setRunningDep(false);
    }
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
    <div className="space-y-8">
      <PageHeader
        title={t("fixedAssets.title")}
        subtitle={
          <p className="m-0 text-[13px] leading-snug text-[#7F8C8D]">
            {t("fixedAssets.subtitleDepreciationPerAsset")}
          </p>
        }
        leading={
          <div className="flex h-8 flex-wrap items-center gap-2">
            <span className="shrink-0 text-sm font-medium leading-none text-[#34495E]">
              {t("fixedAssets.depreciationMonthLabel")}
            </span>
            <input
              type="month"
              value={depYearMonth}
              onChange={(e) => setDepYearMonth(e.target.value)}
              className={TOOLBAR_MONTH_INPUT_CLASS}
              aria-label={t("fixedAssets.depreciationMonthLabel")}
            />
          </div>
        }
        actions={
          <>
            <Link href="/fixed-assets/usage" className={SECONDARY_BUTTON_CLASS}>
              {t("fixedAssets.usageNav")}
            </Link>
            <button
              type="button"
              onClick={() => void runDepreciation()}
              disabled={runningDep}
              className={PRIMARY_BUTTON_CLASS}
            >
              {runningDep ? "…" : t("fixedAssets.runDepreciation")}
            </button>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setFaModalMode("create");
                setFaEditId(null);
                setFaModalOpen(true);
              }}
            >
              + {t("fixedAssets.newBtn")}
            </button>
          </>
        }
      />
      {err && (
        <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-red-800 text-sm m-0">{err}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[13px] font-medium text-red-900 hover:bg-red-50"
          >
            {t("common.retryCheck")}
          </button>
        </div>
      )}

      {loading && <p className="text-gray-600">{t("common.loading")}</p>}
      {!loading && rows.length === 0 && !err && (
        <div className="flex min-h-[320px] w-full flex-col items-center justify-center py-8">
          <EmptyState
            className="max-w-lg w-full border-[#D5DADF] bg-white"
            icon={
              <Building2
                className="mx-auto h-12 w-12 stroke-[1.5] text-[#7F8C8D]"
                aria-hidden
              />
            }
            title={t("fixedAssets.emptyTitle")}
            description={t("fixedAssets.emptyHint")}
            action={
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  setFaModalMode("create");
                  setFaEditId(null);
                  setFaModalOpen(true);
                }}
              >
                + {t("fixedAssets.newBtn")}
              </button>
            }
          />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className={`${CARD_CONTAINER_CLASS} space-y-1 p-4 text-sm`}
              >
                <div className="font-medium text-[#34495E]">{r.name}</div>
                <div>
                  {t("fixedAssets.invNo")}: {r.inventoryNumber}
                </div>
                <div>
                  {t("fixedAssets.initial")}: {formatMoneyAzn(r.purchasePrice)}
                </div>
                <div>
                  {t("fixedAssets.thBooked")}: {formatMoneyAzn(r.bookedDepreciation)}
                </div>
                <div>
                  {t("fixedAssets.bookValue")}:{" "}
                  {formatMoneyAzn(
                    Number(r.purchasePrice) - Number(r.bookedDepreciation),
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    title={t("products.edit")}
                    onClick={() => {
                      setFaModalMode("edit");
                      setFaEditId(r.id);
                      setFaModalOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
                  </button>
                  {!hideDestructive && (
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      title={t("fixedAssets.delete")}
                      onClick={() => void remove(r.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className={`hidden md:block ${DATA_TABLE_VIEWPORT_CLASS}`}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("fixedAssets.thName")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("fixedAssets.thInv")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("fixedAssets.commission")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("fixedAssets.initial")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("fixedAssets.life")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("fixedAssets.depreciationMethod")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("fixedAssets.thBooked")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("fixedAssets.bookValue")}</th>
                  <th className={`${DATA_TABLE_ACTIONS_TH_CLASS} ${hideDestructive ? "" : "min-w-[88px]"}`}>
                    {t("teamPage.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>{r.name}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{r.inventoryNumber}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {String(r.purchaseDate).slice(0, 10)}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.purchasePrice)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{r.usefulLifeMonths}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {t(`fixedAssets.method.${r.depreciationMethod}`)}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {formatMoneyAzn(r.bookedDepreciation)}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      {formatMoneyAzn(
                        Number(r.purchasePrice) - Number(r.bookedDepreciation),
                      )}
                    </td>
                    <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("products.edit")}
                          onClick={() => {
                            setFaModalMode("edit");
                            setFaEditId(r.id);
                            setFaModalOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
                        </button>
                        {!hideDestructive && (
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("fixedAssets.delete")}
                            onClick={() => void remove(r.id)}
                          >
                            <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <FixedAssetModal
        open={faModalOpen}
        mode={faModalMode}
        assetId={faEditId}
        onClose={() => setFaModalOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}

export default function FixedAssetsPage() {
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
    <SubscriptionPaywall module="fixedAssets">
      <FixedAssetsPageContent />
    </SubscriptionPaywall>
  );
}
