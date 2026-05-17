"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { subscribeListRefresh } from "../../../lib/list-refresh-bus";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { ReleaseModal } from "../../../components/manufacturing/release-modal";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
import { Badge } from "../../../components/ui/badge";
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
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../../lib/form-styles";
import { formatMoneyAzn } from "../../../lib/format-money";

type ReleaseRow = {
  id: string;
  documentDate: string;
  quantity: string;
  materialCost: string;
  recipeName: string;
  finishedProductName: string;
  warehouseName: string;
  status: "COMPLETED";
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ManufacturingReleasesContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [period, setPeriod] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      period,
    });
    const res = await apiFetch(`/api/manufacturing/releases?${params}`);
    setLoading(false);
    if (!res.ok) {
      setError(t("manufacturing.loadErr"));
      return;
    }
    const data = parsePaginatedList<ReleaseRow>(await res.json());
    setRows(data.items);
    setTotal(data.total);
  }, [token, page, pageSize, period, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    return subscribeListRefresh("manufacturing-releases", () => void load());
  }, [load]);

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
        title={t("manufacturing.productionJournal")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/manufacturing" className={SECONDARY_BUTTON_CLASS}>
              ← {t("manufacturing.backHub")}
            </Link>
            <input
              type="month"
              className={TOOLBAR_MONTH_INPUT_CLASS}
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setModalOpen(true)}
            >
              <Plus className="mr-1.5 inline h-4 w-4" aria-hidden />
              {t("manufacturing.newRelease")}
            </button>
          </div>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={`${DATA_TABLE_CLASS} min-w-full`}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colDate")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colRecipe")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manufacturing.qty")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("manufacturing.materialCost")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState title={t("manufacturing.noReleases")} compact />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.documentDate.slice(0, 10)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div>{row.recipeName}</div>
                    <div className="text-xs text-[#7F8C8D]">{row.finishedProductName}</div>
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{row.quantity}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                    {formatMoneyAzn(row.materialCost)}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Badge variant="success">{t("manufacturing.statusCompleted")}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ListPaginationFooter
        page={page}
        pageSize={pageSize}
        total={total}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={(ps) => {
          setPageSize(ps);
          setPage(1);
        }}
      />

      <ReleaseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onReleased={() => void load()}
      />
    </div>
  );
}

export default function ManufacturingReleasesPage() {
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
      <ManufacturingReleasesContent />
    </SubscriptionPaywall>
  );
}
