"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { FileDown, FileUp, LayoutTemplate, Sparkles } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { PageHeader } from "../../components/layout/page-header";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";
import { ExtensionInstallBanner } from "../../components/extension-install-banner";
import { RpaUpsellModal } from "../../components/rpa-upsell-modal";
import { useSubscription } from "../../lib/subscription-context";
import { useRequireAuth } from "../../lib/use-require-auth";

type Row = {
  id: string;
  bgdNumber: string;
  bgdDate: string;
  currency: string;
  customsValueAzn?: unknown;
  status: string;
  senderName: string | null;
  receiverName: string | null;
  _count: { items: number };
};

export default function CustomsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const search = useSearchParams();
  const focusId = search.get("focus");
  const { effectiveSnapshot } = useSubscription();
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const tradePro = Boolean(effectiveSnapshot?.modules.tradePro);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      return;
    }
    const res = await apiFetch("/api/customs/declarations");
    if (res.ok) setRows((await res.json()) as Row[]);
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  const toggleOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === rows.length) setSelectedIds([]);
    else setSelectedIds(rows.map((r) => r.id));
  };

  const onWidgetUpsell = () => {
    if (!tradePro) setUpsellOpen(true);
  };

  const exportBulkExcel = async () => {
    const qs =
      selectedIds.length > 0
        ? `?ids=${encodeURIComponent(selectedIds.join(","))}`
        : "";
    const res = await apiFetch(`/api/integrations/customs/declarations/export.xlsx${qs}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customs-bgd-export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportExcel = async (file: File | null) => {
    if (!file || !token) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await apiFetch("/api/integrations/customs/declarations/import-excel", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        window.alert(await res.text());
        return;
      }
      await load();
      setSelectedIds([]);
    } finally {
      setImportBusy(false);
    }
  };

  const onDownloadTemplate = async () => {
    const res = await apiFetch("/api/integrations/customs/declarations/template.xlsx");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bgd-blank.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("trade.customs.title")} />

      {tradePro ? <ExtensionInstallBanner variant="card" dismissible /> : null}

      <RpaUpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} moduleKey="tradePro" />

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            {t("trade.customs.bulkTitle")}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={onWidgetUpsell}
              title={t("trade.customs.widgetHint")}
            >
              <Sparkles className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden />
              {t("trade.customs.widgetCta")}
            </button>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void exportBulkExcel()}>
              <FileDown className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden />
              {t("trade.customs.exportExcel")}
            </button>
            <label className={SECONDARY_BUTTON_CLASS + " cursor-pointer"}>
              <FileUp className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden />
              {importBusy ? "…" : t("trade.customs.importExcel")}
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={importBusy}
                onChange={(e) => void onImportExcel(e.target.files?.[0] ?? null)}
              />
            </label>
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void onDownloadTemplate()}>
              <LayoutTemplate className="inline h-4 w-4 mr-1 -mt-0.5" aria-hidden />
              {t("trade.customs.templateDownload")}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-600">{t("trade.customs.bulkHint")}</p>
      </div>

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>
                <input
                  type="checkbox"
                  aria-label="select all"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={toggleAll}
                />
              </th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>BGD</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colDate")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colCurrency")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colStatus")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colSender")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colReceiver")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colItems")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={
                  DATA_TABLE_TR_CLASS +
                  (focusId === r.id ? " bg-amber-50" : "")
                }
              >
                <td className={DATA_TABLE_TD_CLASS}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={r.bgdNumber}
                  />
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <Link className="text-blue-600 underline font-medium" href={`/customs/${encodeURIComponent(r.id)}`}>
                    {r.bgdNumber}
                  </Link>
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{String(r.bgdDate).slice(0, 10)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.currency}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.status}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.senderName ?? "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.receiverName ?? "—"}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r._count?.items ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
