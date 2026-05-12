"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../components/ui/select";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
} from "../../../lib/design-system";
import { Popover, PopoverContent, PopoverTrigger } from "@erafinance/ui";

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

type OrgTree = {
  holdings: Array<{
    holdingId: string;
    holdingName: string;
    organizations: Array<{ id: string; name: string }>;
  }>;
  freeOrganizations: Array<{ id: string; name: string }>;
};

export default function CashFlowProjectionPage() {
  const { t } = useTranslation();
  const { organizations, switchOrganization, user } = useAuth();
  const [days, setDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProjectionResponse | null>(null);
  const [tree, setTree] = useState<OrgTree | null>(null);
  const [holdingFilter, setHoldingFilter] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await apiFetch("/api/organizations/tree");
      if (res.ok) setTree((await res.json()) as OrgTree);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await apiFetch(`/api/treasury/cashflow-projection?days=${encodeURIComponent(days)}`);
      setLoading(false);
      if (res.ok) setData((await res.json()) as ProjectionResponse);
      else setData(null);
    })();
  }, [days, user?.organizationId]);

  const companies = useMemo(() => {
    if (!tree) return organizations.map((o) => ({ id: o.id, name: o.name, holdingId: "" }));
    const fromHoldings = tree.holdings.flatMap((h) =>
      h.organizations.map((o) => ({ ...o, holdingId: h.holdingId })),
    );
    const free = tree.freeOrganizations.map((o) => ({ ...o, holdingId: "" }));
    return [...fromHoldings, ...free];
  }, [tree, organizations]);

  const filteredCompanies = useMemo(
    () =>
      holdingFilter
        ? companies.filter((c) => c.holdingId === holdingFilter)
        : companies,
    [companies, holdingFilter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("cashFlowProjection.title")}
        subtitle={t("cashFlowProjection.subtitle")}
        actions={
          <>
            <Popover>
              <PopoverTrigger className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#D5DADF] bg-white px-3 text-[13px] text-[#34495E]">
                <Filter className="h-4 w-4" />
                {t("cashFlowProjection.filters")}
              </PopoverTrigger>
              <PopoverContent className="right-0 top-10 w-80">
                <div className="space-y-3">
                  <label className="block text-[13px] font-semibold text-[#34495E]">
                    {t("cashFlowProjection.holdingFilter")}
                    <div className="mt-1">
                      <Select value={holdingFilter} onValueChange={setHoldingFilter}>
                        <SelectTrigger className="w-full" />
                        <SelectContent>
                          <SelectItem value="">{t("common.all")}</SelectItem>
                          {(tree?.holdings ?? []).map((h) => (
                            <SelectItem key={h.holdingId} value={h.holdingId}>
                              {h.holdingName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </label>
                  <label className="block text-[13px] font-semibold text-[#34495E]">
                    {t("cashFlowProjection.companyFilter")}
                    <div className="mt-1">
                      <Select
                        value={user?.organizationId ?? ""}
                        onValueChange={(orgId) => void switchOrganization(orgId)}
                      >
                        <SelectTrigger className="w-full" />
                        <SelectContent>
                          {filteredCompanies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </label>
                </div>
              </PopoverContent>
            </Popover>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[130px]" />
              <SelectContent>
                <SelectItem value="14">14 {t("cashFlowProjection.days")}</SelectItem>
                <SelectItem value="30">30 {t("cashFlowProjection.days")}</SelectItem>
                <SelectItem value="60">60 {t("cashFlowProjection.days")}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <section className={`${CARD_CONTAINER_CLASS} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#34495E]">
            {t("cashFlowProjection.liquidityWidget")}
          </h2>
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
              ) : (data?.points ?? []).map((row) => {
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
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

