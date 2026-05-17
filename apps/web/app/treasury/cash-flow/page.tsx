"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { PageHeader } from "../../../components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../components/ui/select";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type ProjectionPoint = {
  date: string;
  projectedBalance: string;
  inflow: string;
  outflow: string;
};

type ProjectionResponse = {
  currency: string;
  horizonDays: number;
  openingBalance: string;
  points: ProjectionPoint[];
};

export default function CashFlowProjectionPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [days, setDays] = useState("30");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProjectionResponse | null>(null);

  useEffect(() => {
    setPage(1);
  }, [days, user?.organizationId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await apiFetch(`/api/treasury/cashflow-projection?days=${encodeURIComponent(days)}`);
      setLoading(false);
      if (res.ok) setData((await res.json()) as ProjectionResponse);
      else setData(null);
    })();
  }, [days, user?.organizationId]);

  const points = data?.points ?? [];
  const totalRows = points.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const visiblePoints = useMemo(() => {
    const p = Math.min(page, totalPages);
    const start = (p - 1) * pageSize;
    return points.slice(start, start + pageSize);
  }, [points, page, pageSize, totalPages]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("cashFlowProjection.title")}
        subtitle={
          <div className="space-y-2">
            <p className="m-0">{t("cashFlowProjection.subtitle")}</p>
            <p className="m-0 text-[13px] leading-snug text-[#95A5A6]">{t("cashFlowProjection.algorithmHint")}</p>
          </div>
        }
        leading={
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-[#34495E]">{t("cashFlowProjection.horizonLabel")}</span>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className={`${MODAL_INPUT_CLASS} !mt-0 h-9 w-[130px]`} />
              <SelectContent>
                <SelectItem value="14">14 {t("cashFlowProjection.days")}</SelectItem>
                <SelectItem value="30">30 {t("cashFlowProjection.days")}</SelectItem>
                <SelectItem value="60">60 {t("cashFlowProjection.days")}</SelectItem>
                <SelectItem value="90">90 {t("cashFlowProjection.days")}</SelectItem>
              </SelectContent>
            </Select>
          </label>
        }
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t("cashFlowProjection.liquidityWidget")}</h2>
        <div className="text-xs text-[#7F8C8D]">
          {t("cashFlowProjection.openingBalance")}: {data?.openingBalance ?? "0.00"} {data?.currency ?? "AZN"}
        </div>
      </div>

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead className={DATA_TABLE_HEAD_ROW_CLASS}>
            <tr>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("cashFlowProjection.colDate")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("cashFlowProjection.colInflow")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("cashFlowProjection.colOutflow")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("cashFlowProjection.colBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS} colSpan={4}>
                  {t("common.loading")}
                </td>
              </tr>
            ) : (
              visiblePoints.map((row) => {
                const isGap = Number(row.projectedBalance) < 0;
                return (
                  <tr
                    key={row.date}
                    className={`${DATA_TABLE_TR_CLASS} ${isGap ? "bg-red-50/70" : ""}`}
                  >
                    <td className={DATA_TABLE_TD_CLASS}>{row.date}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        {row.inflow}
                      </span>
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      <span className="inline-flex items-center gap-1">
                        <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                        {row.outflow}
                      </span>
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} ${isGap ? "text-destructive font-semibold" : ""}`}>
                      {row.projectedBalance}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalRows > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEDF0] pt-3 text-[13px] text-[#34495E]">
          <label className="flex items-center gap-2">
            <span className="text-[#7F8C8D]">{t("common.paginationRowsPerPage")}</span>
            <select
              className={`${MODAL_INPUT_CLASS} !mt-0 h-9 min-w-[4.5rem]`}
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 15);
                setPage(1);
              }}
            >
              <option value="7">7</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
          </label>
          <span className="tabular-nums text-[#7F8C8D]">
            {t("common.paginationPageOf", {
              page: String(Math.min(page, totalPages)),
              pages: String(totalPages),
              total: String(totalRows),
            })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t("common.paginationPrev")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t("common.paginationNext")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
