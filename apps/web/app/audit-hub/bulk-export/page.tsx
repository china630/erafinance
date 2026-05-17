"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { auditHubFetch } from "../../../lib/audit-hub-api";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

export default function AuditHubBulkExportPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();

  const [sampleId, setSampleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!ready || !token) return null;

  async function download() {
    if (!token || !sampleId.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await auditHubFetch("/api/audit-hub/bulk-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: sampleId.trim() }),
      });
      if (!res.ok) {
        setErr(await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-sample-${sampleId.trim().slice(0, 8)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="m-0 text-sm text-[#7F8C8D]">{t("auditHub.bulkHint")}</p>
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <label className={MODAL_FIELD_LABEL_CLASS}>
          {t("auditHub.sampleIdPh")}
          <input
            className={`${INPUT_BORDERED_CLASS} mt-1.5 w-full max-w-xl`}
            value={sampleId}
            onChange={(e) => setSampleId(e.target.value)}
            placeholder={t("auditHub.sampleIdPh")}
          />
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EBEDF0] pt-3">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !sampleId.trim()}
            onClick={() => void download()}
          >
            {t("auditHub.downloadZip")}
          </button>
        </div>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
