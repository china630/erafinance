"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { formatMoneyAzn } from "../../lib/format-money";
import { useAuth } from "../../lib/auth-context";
import { isRestrictedUserRole } from "../../lib/role-utils";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useSubscription } from "../../lib/subscription-context";
import { EmptyState } from "../../components/empty-state";
import { ListPaginationFooter } from "../../components/list-pagination-footer";
import { PageHeader } from "../../components/layout/page-header";
import { parseHrEmployeesResponse } from "../../lib/hr-employees-list";
import {
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CENTER_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import { CreateEmployeeModal } from "./employee-modal";
import { EditEmployeeModal } from "./edit-employee-modal";
import { RpaUpsellModal } from "../../components/rpa-upsell-modal";

type Employee = {
  id: string;
  kind?: string;
  finCode: string;
  voen?: string | null;
  firstName: string;
  lastName: string;
  positionId: string;
  jobPosition?: {
    id: string;
    name: string;
    department: { id: string; name: string };
  };
  startDate: string;
  salary: unknown;
  contractorMonthlySocialAzn?: unknown | null;
};

export default function EmployeesPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const hideDestructive = isRestrictedUserRole(user?.role ?? undefined);
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await apiFetch(`/api/hr/employees?page=${page}&pageSize=${pageSize}`);
    if (!res.ok) {
      setError(`${t("employees.loadErr")}: ${res.status}`);
      setRows([]);
      setTotal(0);
    } else {
      const parsed = parseHrEmployeesResponse<Employee>(await res.json());
      setRows(parsed.items);
      setTotal(parsed.total);
    }
    setLoading(false);
  }, [token, t, page, pageSize]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  async function remove(id: string) {
    if (!token || !window.confirm(t("employees.confirmDelete"))) return;
    const res = await apiFetch(`/api/hr/employees/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    await load();
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((cur) => {
      if (checked) return Array.from(new Set([...cur, id]));
      return cur.filter((x) => x !== id);
    });
  }

  async function exportBulkExcel() {
    if (selectedIds.length === 0) return;
    const res = await apiFetch(
      `/api/integrations/emas/employees/export.xlsx?ids=${encodeURIComponent(selectedIds.join(","))}`,
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "emas-employees-export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBulkExcel(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await apiFetch("/api/integrations/emas/employees/import-result", {
      method: "POST",
      body: fd,
    });
    await load();
  }

  function runBulkWidget() {
    if (!snapshot?.modules.hrFull) {
      setUpsellOpen(true);
      return;
    }
    window.localStorage.setItem("erafinanceAssistantBulkFlow", "emuqavile");
    window.localStorage.setItem("erafinanceAssistantBulkIds", JSON.stringify(selectedIds));
    alert("Bulk payload prepared for ERA Finance Assistant");
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
        title={t("employees.title")}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={selectedIds.length === 0}
              onClick={runBulkWidget}
            >
              {t("bulk.employees.rpa")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={selectedIds.length === 0}
              onClick={() => void exportBulkExcel()}
            >
              {t("bulk.employees.export")}
            </button>
            <label className={SECONDARY_BUTTON_CLASS}>
              {t("bulk.employees.import")}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importBulkExcel(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}
              disabled={subReady && Boolean(snapshot?.quotas.employees.atLimit)}
              title={
                subReady && snapshot?.quotas.employees.atLimit
                  ? t("subscription.employeesLimitTooltip")
                  : undefined
              }
              onClick={() => setCreateOpen(true)}
            >
              + {t("employees.newBtn")}
            </button>
          </div>
        }
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading && <p className="text-gray-600">{t("common.loading")}</p>}
      {!loading && total > 0 && (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-[#D5DADF] bg-white p-4 shadow-sm text-[13px] space-y-1"
              >
                <div className="font-semibold text-[#34495E]">
                  {r.lastName} {r.firstName}
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={(e) => toggleSelected(r.id, e.target.checked)}
                  />
                  {t("bulk.employees.select")}
                </label>
                <div className="text-[13px] text-[#34495E]">
                  {t("employees.thFin")}:{" "}
                  <span className="font-mono tabular-nums">{r.finCode}</span> ·{" "}
                  {r.kind === "CONTRACTOR"
                    ? t("employees.kindContractor")
                    : t("employees.kindEmployee")}
                </div>
                {r.voen && (
                  <div className="text-[13px] text-right font-mono tabular-nums">
                    {t("employees.thVoen")}: {r.voen}
                  </div>
                )}
                <div className="text-right font-mono tabular-nums">
                  {t("employees.thGross")}: {formatMoneyAzn(r.salary)}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 pt-2">
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    title={t("employees.change")}
                    onClick={() => setEditEmployeeId(r.id)}
                  >
                    <Pencil className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
                  </button>
                  {!hideDestructive && (
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      title={t("employees.remove")}
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
            <table className={`${DATA_TABLE_CLASS} min-w-[720px]`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("employees.thFin")}</th>
                  <th className={DATA_TABLE_TH_CENTER_CLASS}>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selectedIds.length === rows.length}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? rows.map((x) => x.id) : [])
                      }
                    />
                  </th>
                  <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("employees.thKind")}</th>
                  <th className={`hidden lg:table-cell ${DATA_TABLE_TH_RIGHT_CLASS}`}>
                    {t("employees.thVoen")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("employees.thName")}</th>
                  <th className={`hidden xl:table-cell ${DATA_TABLE_TH_LEFT_CLASS}`}>
                    {t("employees.thPosition")}
                  </th>
                  <th className={`hidden lg:table-cell ${DATA_TABLE_TH_RIGHT_CLASS}`}>
                    {t("employees.thStart")}
                  </th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("employees.thGross")}</th>
                  <th className={DATA_TABLE_ACTIONS_TH_CLASS}>{t("teamPage.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{r.finCode}</td>
                    <td className={DATA_TABLE_TD_CENTER_CLASS}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => toggleSelected(r.id, e.target.checked)}
                      />
                    </td>
                    <td className={DATA_TABLE_TD_CENTER_CLASS}>
                      {r.kind === "CONTRACTOR"
                        ? t("employees.kindContractor")
                        : t("employees.kindEmployee")}
                    </td>
                    <td className={`hidden lg:table-cell ${DATA_TABLE_TD_RIGHT_CLASS}`}>
                      {r.voen ?? "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>
                      {r.lastName} {r.firstName}
                    </td>
                    <td className={`hidden xl:table-cell ${DATA_TABLE_TD_CLASS}`}>
                      {r.jobPosition
                        ? `${r.jobPosition.department.name} — ${r.jobPosition.name}`
                        : "—"}
                    </td>
                    <td className={`hidden lg:table-cell ${DATA_TABLE_TD_RIGHT_CLASS}`}>
                      {String(r.startDate).slice(0, 10)}
                    </td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.salary)}</td>
                    <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("employees.change")}
                          onClick={() => setEditEmployeeId(r.id)}
                        >
                          <Pencil className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
                        </button>
                        {!hideDestructive && (
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("employees.remove")}
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
      {!loading && rows.length === 0 && !error && (
        <EmptyState title={t("employees.none")} description={t("employees.emptyHint")} />
      )}

      {!loading && (
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      <CreateEmployeeModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
        quotaAtLimit={subReady && Boolean(snapshot?.quotas.employees.atLimit)}
      />
      <EditEmployeeModal
        open={Boolean(editEmployeeId)}
        employeeId={editEmployeeId}
        token={token}
        onClose={() => setEditEmployeeId(null)}
        onSaved={() => void load()}
      />
      <RpaUpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} moduleKey="hrFull" />
    </div>
  );
}
