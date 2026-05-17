"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "../empty-state";
import { Button } from "../ui/button";
import { apiFetch } from "../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import type { LandingModuleMarketingItem } from "../../lib/config/landing-modules";
import { uiLangRuAz } from "../../lib/i18n/ui-lang";

type EditForm = {
  sortOrder: string;
  nameAz: string;
  nameRu: string;
  descAz: string;
  descRu: string;
  tasksAz: string;
  tasksRu: string;
};

function tasksToText(lines: string[]): string {
  return lines.join("\n");
}

function textToTasks(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function rowToForm(row: LandingModuleMarketingItem): EditForm {
  return {
    sortOrder: String(row.sortOrder),
    nameAz: row.names.az,
    nameRu: row.names.ru,
    descAz: row.descriptions.az,
    descRu: row.descriptions.ru,
    tasksAz: tasksToText(row.tasks.az),
    tasksRu: tasksToText(row.tasks.ru),
  };
}

export function LandingModulesEditor() {
  const { t, i18n } = useTranslation();
  const locale = uiLangRuAz(i18n.language);
  const [rows, setRows] = useState<LandingModuleMarketingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/admin/landing-modules");
      if (!res.ok) {
        setErr(String(res.status));
        return;
      }
      const data = (await res.json()) as { items?: LandingModuleMarketingItem[] };
      setRows(data.items ?? []);
    } catch {
      setErr("network");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (row: LandingModuleMarketingItem) => {
    setEditSlug(row.moduleSlug);
    setForm(rowToForm(row));
  };

  const save = async () => {
    if (!editSlug || !form) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/landing-modules/${encodeURIComponent(editSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
          names: { az: form.nameAz.trim(), ru: form.nameRu.trim() },
          descriptions: { az: form.descAz.trim(), ru: form.descRu.trim() },
          tasks: {
            az: textToTasks(form.tasksAz),
            ru: textToTasks(form.tasksRu),
          },
        }),
      });
      if (!res.ok) {
        toast.error(t("common.apiErrorTitle"));
        return;
      }
      toast.success(t("common.save"));
      setEditSlug(null);
      setForm(null);
      await load();
    } catch {
      toast.error(t("common.apiErrorTitle"));
    } finally {
      setSaving(false);
    }
  };

  if (loading && rows.length === 0) {
    return <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>;
  }

  if (err) {
    return (
      <EmptyState
        title={t("common.apiErrorTitle")}
        description={`API ${err}`}
        className="border-solid border-[#D5DADF] bg-white"
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#7F8C8D]">{t("superAdmin.landingIntro")}</p>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.landingColSlug")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.landingColSort")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("superAdmin.landingColName")}</th>
              <th className={DATA_TABLE_ACTIONS_TH_CLASS} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.moduleSlug} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{row.moduleSlug}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.sortOrder}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.names[locale]}</td>
                <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    onClick={() => openEdit(row)}
                    aria-label={t("superAdmin.landingEdit")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editSlug && form ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between gap-2 border-b border-[#D5DADF] px-4 py-3">
              <h2 className="text-base font-semibold text-[#34495E]">
                {t("superAdmin.landingEdit")}: {editSlug}
              </h2>
              <button
                type="button"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => {
                  setEditSlug(null);
                  setForm(null);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.landingColSort")}
                <input
                  type="number"
                  min={0}
                  className={MODAL_INPUT_NUMERIC_CLASS}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.landingNameAz")}
                <input
                  className={MODAL_INPUT_CLASS}
                  value={form.nameAz}
                  onChange={(e) => setForm({ ...form, nameAz: e.target.value })}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.landingNameRu")}
                <input
                  className={MODAL_INPUT_CLASS}
                  value={form.nameRu}
                  onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.landingDescAz")}
                <textarea
                  className={`${MODAL_INPUT_CLASS} min-h-[72px]`}
                  value={form.descAz}
                  onChange={(e) => setForm({ ...form, descAz: e.target.value })}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.landingDescRu")}
                <textarea
                  className={`${MODAL_INPUT_CLASS} min-h-[72px]`}
                  value={form.descRu}
                  onChange={(e) => setForm({ ...form, descRu: e.target.value })}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.landingTasksAz")}
                <textarea
                  className={`${MODAL_INPUT_CLASS} min-h-[96px] font-mono text-[12px]`}
                  value={form.tasksAz}
                  onChange={(e) => setForm({ ...form, tasksAz: e.target.value })}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("superAdmin.landingTasksRu")}
                <textarea
                  className={`${MODAL_INPUT_CLASS} min-h-[96px] font-mono text-[12px]`}
                  value={form.tasksRu}
                  onChange={(e) => setForm({ ...form, tasksRu: e.target.value })}
                />
              </label>
            </div>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => {
                  setEditSlug(null);
                  setForm(null);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={saving}
                onClick={() => void save()}
              >
                {t("superAdmin.landingSave")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
