"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { apiFetch } from "../../../lib/api-client";
import { parseHrEmployeesResponse } from "../../../lib/hr-employees-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";
import {
  BORDER_MUTED_CLASS,
  CARD_CONTAINER_CLASS,
} from "../../../lib/design-system";
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../../lib/form-styles";

type Dept = { id: string; name: string };
type EmpRow = {
  id: string;
  firstName: string;
  lastName: string;
  jobPosition?: { department?: { id: string; name: string } };
};
type AbsenceRow = {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  note?: string;
  absenceType?: {
    nameAz: string;
    formula: string;
    color?: string;
  };
};

function monthBounds(isoMonth: string): {
  from: string;
  to: string;
  y: number;
  m: number;
  days: number;
} | null {
  const s = isoMonth.trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!Number.isFinite(y) || m < 1 || m > 12) return null;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    y,
    m,
    days,
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(days)}`,
  };
}

function utcDay(iso: string): number {
  const x = iso.slice(0, 10);
  return Date.UTC(
    Number(x.slice(0, 4)),
    Number(x.slice(5, 7)) - 1,
    Number(x.slice(8, 10)),
  );
}

/** Priority: sick > unpaid > labor (visual emphasis for overlapping types). */
function pickAbsenceForCell(
  absences: AbsenceRow[],
  employeeId: string,
  dayUtc: number,
): AbsenceRow | null {
  const hits = absences.filter((a) => {
    if (a.employeeId !== employeeId) return false;
    const a0 = utcDay(a.startDate);
    const a1 = utcDay(a.endDate);
    return dayUtc >= a0 && dayUtc <= a1;
  });
  if (hits.length === 0) return null;
  const sick = hits.find((h) => h.absenceType?.formula === "SICK_LEAVE_STAJ");
  if (sick) return sick;
  const unpaid = hits.find((h) => h.absenceType?.formula === "UNPAID_RECORD");
  if (unpaid) return unpaid;
  return hits[0] ?? null;
}

export default function HrAnalyticsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const isDeptHead = user?.role === "DEPARTMENT_HEAD";

  const [departments, setDepartments] = useState<Dept[]>([]);
  const [employees, setEmployees] = useState<EmpRow[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [monthValue, setMonthValue] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [departmentId, setDepartmentId] = useState("");

  const bounds = useMemo(() => monthBounds(monthValue), [monthValue]);
  const calYear = bounds?.y ?? new Date().getFullYear();
  const calMonth = bounds?.m ?? new Date().getMonth() + 1;
  const daysInMonth = bounds?.days ?? 31;

  const loadData = useCallback(async () => {
    if (!token || !bounds) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const deptQs =
        !isDeptHead && departmentId
          ? `&departmentId=${encodeURIComponent(departmentId)}`
          : "";
      const absQs = `dateFrom=${encodeURIComponent(bounds.from)}&dateTo=${encodeURIComponent(bounds.to)}${deptQs}`;
      const empQs = `page=1&pageSize=500${deptQs}`;
      const [ed, ea, eb] = await Promise.all([
        apiFetch("/api/hr/departments"),
        apiFetch(`/api/hr/absences?${absQs}`),
        apiFetch(`/api/hr/employees?${empQs}`),
      ]);
      if (ed.ok) {
        setDepartments((await ed.json()) as Dept[]);
      }
      if (!ea.ok) {
        setErr(`${t("payroll.loadErr")}: ${ea.status}`);
        setAbsences([]);
      } else {
        setAbsences((await ea.json()) as AbsenceRow[]);
      }
      if (!eb.ok) {
        setErr((e) => e ?? `${t("employees.loadErr")}: ${eb.status}`);
        setEmployees([]);
      } else {
        const parsed = parseHrEmployeesResponse<EmpRow>(await eb.json());
        setEmployees(parsed.items);
      }
    } catch {
      setErr(t("common.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [token, bounds, departmentId, isDeptHead, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadData();
  }, [ready, token, loadData]);

  const dayHeader = useMemo(() => {
    const labels: string[] = [];
    const m0 = calMonth - 1;
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(calYear, m0, d));
      const wd = dt.getUTCDay();
      const w = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][wd];
      labels.push(`${d}\n${w}`);
    }
    return labels;
  }, [calYear, calMonth, daysInMonth]);

  const legend = useMemo(
    () => [
      {
        hex: "#E8F4FC",
        border: "#2980B9",
        label: t("payroll.calendarLegendVacation"),
      },
      {
        hex: "#FCE8E8",
        border: "#C0392B",
        label: t("payroll.calendarLegendSick"),
      },
      {
        hex: "#FEF3C7",
        border: "#D97706",
        label: t("hrAnalytics.legendUnpaid"),
      },
    ],
    [t],
  );

  if (!ready) {
    return (
      <div className="text-[#7F8C8D]">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hrAnalytics.title")}
        subtitle={t("hrAnalytics.subtitle")}
        leading={
          <div className="flex h-8 flex-wrap items-center gap-2">
            <span className="shrink-0 text-sm font-medium leading-none text-[#34495E]">
              {t("banking.monthPickerToolbarLabel")}
            </span>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className={TOOLBAR_MONTH_INPUT_CLASS}
              aria-label={t("hrAnalytics.monthFilter")}
            />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-end justify-end gap-3">
            {!isDeptHead ? (
              <label className="block min-w-[12rem] shrink-0 text-[13px] font-medium text-[#34495E]">
                {t("hrAnalytics.departmentFilter")}
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className={`mt-1 block h-9 w-full rounded-lg border ${BORDER_MUTED_CLASS} bg-white px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2980B9]/40`}
                >
                  <option value="">{t("hrAnalytics.departmentAll")}</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        }
      />

      {err ? (
        <p className="text-[13px] text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      {loading ? <p className="text-[13px] text-[#7F8C8D]">{t("common.loading")}</p> : null}

      {!loading && employees.length === 0 ? (
        <EmptyState
          title={t("hrAnalytics.emptyTitle")}
          description={t("hrAnalytics.emptyHint")}
        />
      ) : !loading ? (
        <section className={`${CARD_CONTAINER_CLASS} overflow-x-auto p-4`}>
          <div
            className="inline-grid gap-px rounded-xl bg-[#D5DADF] p-px"
            style={{
              gridTemplateColumns: `minmax(10rem,14rem) repeat(${daysInMonth}, minmax(1.5rem, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-20 bg-[#F4F5F7] px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {t("employees.thName")}
            </div>
            {dayHeader.map((label, i) => {
              const d = i + 1;
              const m0 = calMonth - 1;
              const wd = new Date(Date.UTC(calYear, m0, d)).getUTCDay();
              const weekend = wd === 0 || wd === 6;
              return (
                <div
                  key={d}
                  className={`bg-[#F4F5F7] px-0.5 py-2 text-center text-[10px] font-semibold leading-tight text-[#34495E] ${weekend ? "text-[#7F8C8D]" : ""}`}
                >
                  {label.split("\n").map((line, li) => (
                    <span key={li} className="block">
                      {line}
                    </span>
                  ))}
                </div>
              );
            })}

            {employees.map((emp) => (
              <Fragment key={emp.id}>
                <div
                  className="sticky left-0 z-10 border-t border-[#EBEDF0] bg-white px-2 py-1.5 text-[13px] font-medium text-[#34495E]"
                >
                  <span className="block truncate" title={`${emp.lastName} ${emp.firstName}`}>
                    {emp.lastName} {emp.firstName}
                  </span>
                  {emp.jobPosition?.department?.name ? (
                    <span className="block truncate text-[11px] font-normal text-[#7F8C8D]">
                      {emp.jobPosition.department.name}
                    </span>
                  ) : null}
                </div>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const m0 = calMonth - 1;
                  const dayT = Date.UTC(calYear, m0, d);
                  const wd = new Date(dayT).getUTCDay();
                  const weekend = wd === 0 || wd === 6;
                  const hit = pickAbsenceForCell(absences, emp.id, dayT);
                  const bg = hit?.absenceType?.color;
                  const title = hit
                    ? `${hit.absenceType?.nameAz ?? ""}${hit.note ? ` — ${hit.note}` : ""}`
                    : undefined;
                  return (
                    <div
                      key={`${emp.id}-d-${d}`}
                      title={title}
                      className={`min-h-9 border-t border-[#EBEDF0] ${weekend && !bg ? "bg-[#FAFBFC]" : "bg-white"}`}
                      style={
                        bg
                          ? {
                              backgroundColor: bg,
                              boxShadow: "inset 0 0 0 1px rgba(52,73,94,0.12)",
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-[#7F8C8D]">
            {legend.map((it) => (
              <span key={it.label} className="inline-flex items-center gap-2">
                <span
                  className="h-3 w-5 shrink-0 rounded border"
                  style={{
                    backgroundColor: it.hex,
                    borderColor: it.border,
                  }}
                />
                {it.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
