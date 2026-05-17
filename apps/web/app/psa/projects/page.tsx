"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { PsaProjectCreateModal } from "../../../components/psa/psa-project-create-modal";
import { EmptyState } from "../../../components/empty-state";
import {
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
} from "../../../lib/design-system";

type Cp = { id: string; name: string; taxId?: string | null };
type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  billingMode: string;
  hourlyRate?: unknown;
  counterparty?: { id: string };
  _count?: { timeEntries: number; tasks: number };
};

export default function PsaProjectsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [cps, setCps] = useState<Cp[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const [pr, cp] = await Promise.all([
      apiFetch(`/api/psa/projects?${qs.toString()}`),
      apiFetch("/api/counterparties"),
    ]);
    if (!pr.ok || !cp.ok) {
      setErr(t("psa.loadErr"));
      setProjects([]);
      setTotal(0);
    } else {
      const parsed = parsePaginatedList<Project>(await pr.json());
      setProjects(parsed.items);
      setTotal(parsed.total);
      setCps((await cp.json()) as Cp[]);
    }
    setLoading(false);
  }, [token, t, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title={t("psa.title")}
        actions={
          <>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setCreateOpen(true)}
              disabled={cps.length === 0}
            >
              + {t("psa.createProject")}
            </button>
            <Link href="/employees" className={SECONDARY_BUTTON_CLASS}>
              {t("nav.employees")}
            </Link>
          </>
        }
      />

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {loading && <p className="text-gray-600">{t("common.loading")}</p>}

      {!loading && (
        <>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("psa.code")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("psa.name")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("psa.projects")}</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={3} className={`${DATA_TABLE_TD_CLASS} py-12 text-center`}>
                      <EmptyState
                        title={t("psa.none")}
                        action={
                          <button
                            type="button"
                            className={PRIMARY_BUTTON_CLASS}
                            onClick={() => setCreateOpen(true)}
                            disabled={cps.length === 0}
                          >
                            + {t("psa.createProject")}
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{p.code}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{p.name}</td>
                      <td className={`${DATA_TABLE_TD_RIGHT_CLASS} text-xs text-[#7F8C8D]`}>
                        {p._count?.timeEntries ?? 0}h / {p._count?.tasks ?? 0}
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
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      <PsaProjectCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        counterparties={cps}
        onCreated={() => void load()}
      />
    </div>
  );
}
