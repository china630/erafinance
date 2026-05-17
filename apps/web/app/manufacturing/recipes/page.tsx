"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { subscribeListRefresh, notifyListRefresh } from "../../../lib/list-refresh-bus";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { RecipeModal } from "../../../components/manufacturing/recipe-modal";
import { SubscriptionPaywall } from "../../../components/subscription-paywall";
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
import { FORM_INPUT_CLASS, FORM_LABEL_CLASS } from "../../../lib/form-styles";

type RecipeRow = {
  id: string;
  name: string;
  updatedAt: string;
  finishedProduct?: { id: string; name: string; sku: string };
  _count?: { lines: number; byproducts: number };
};

function ManufacturingRecipesContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search.trim()) params.set("q", search.trim());
    const res = await apiFetch(`/api/manufacturing/recipes?${params}`);
    setLoading(false);
    if (!res.ok) {
      setError(t("manufacturing.loadErr"));
      return;
    }
    const data = parsePaginatedList<RecipeRow>(await res.json());
    setRows(data.items);
    setTotal(data.total);
  }, [token, page, pageSize, search, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    return subscribeListRefresh("manufacturing-recipes", () => void load());
  }, [load]);

  async function handleDelete(id: string) {
    if (!confirm(t("manufacturing.deleteRecipeConfirm"))) return;
    const res = await apiFetch(`/api/manufacturing/recipes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("manufacturing.deleteSuccess"));
    notifyListRefresh("manufacturing-recipes");
    notifyListRefresh("manufacturing-dashboard");
    void load();
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
        title={t("nav.manufacturingRecipes")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/manufacturing" className={SECONDARY_BUTTON_CLASS}>
              ← {t("manufacturing.backHub")}
            </Link>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setEditId(null);
                setModalOpen(true);
              }}
            >
              <Plus className="mr-1.5 inline h-4 w-4" aria-hidden />
              {t("manufacturing.newRecipe")}
            </button>
          </div>
        }
      />

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q);
        }}
      >
        <label className="block min-w-[12rem] flex-1">
          <span className={FORM_LABEL_CLASS}>{t("manufacturing.searchRecipes")}</span>
          <input
            type="search"
            className={FORM_INPUT_CLASS}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("manufacturing.searchRecipes")}
          />
        </label>
        <button type="submit" className={SECONDARY_BUTTON_CLASS}>
          {t("common.refresh")}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={`${DATA_TABLE_CLASS} min-w-full`}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.recipeName")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.targetProduct")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.componentCount")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("manufacturing.colUpdated")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState title={t("manufacturing.noRecipes")} compact />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.finishedProduct
                      ? `${row.finishedProduct.name} (${row.finishedProduct.sku})`
                      : "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{row._count?.lines ?? 0}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.updatedAt.slice(0, 10)}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#2980B9] hover:bg-[#F4F5F7]"
                        aria-label={t("common.edit")}
                        onClick={() => {
                          setEditId(row.id);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        aria-label={t("common.delete")}
                        onClick={() => void handleDelete(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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

      <RecipeModal
        open={modalOpen}
        recipeId={editId}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}

export default function ManufacturingRecipesPage() {
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
      <ManufacturingRecipesContent />
    </SubscriptionPaywall>
  );
}
