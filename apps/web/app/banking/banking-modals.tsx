"use client";

import { Landmark, X } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { EmptyState } from "../../components/empty-state";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../lib/design-system";
import { useRequireAuth } from "../../lib/use-require-auth";

export function BankStatementImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [bankName, setBankName] = useState("Pasha Bank");
  const [importChannel, setImportChannel] = useState<"BANK" | "CASH">("BANK");
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setDragActive(false);
    }
  }, [open]);

  async function uploadCsv(file: File) {
    if (!token || !bankName.trim()) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".xml")) {
      alert(t("banking.importXmlNotSupported"));
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("bankName", bankName.trim());
    fd.append("channel", importChannel);
    const res = await apiFetch("/api/banking/import", {
      method: "POST",
      body: fd,
    });
    setUploading(false);
    if (!res.ok) {
      const txt = await res.text();
      const msg = `${res.status} ${txt}`;
      toast.error(t("banking.importErr"), { description: msg });
      setError(msg);
      return;
    }
    onImported();
    onClose();
  }

  function onDropFiles(fileList: FileList | null) {
    const f = fileList?.[0];
    if (f) void uploadCsv(f);
  }

  if (!open) return null;
  if (!ready || !token) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}>
        <DialogHeader className="shrink-0">
          <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
            {t("banking.importStatementsTitle")}
          </h3>
          <Button
            type="button"
            variant="ghost"
            className={MODAL_CLOSE_BUTTON_CLASS}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </DialogHeader>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          <p className="text-sm text-slate-600 m-0">{t("banking.importStatementsHint")}</p>
          {error ? (
            <EmptyState
              title={t("banking.importErr")}
              description={error}
              icon={<Landmark className="h-8 w-8" aria-hidden />}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("banking.bank")}
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
              />
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("banking.importChannel")}
              <select
                value={importChannel}
                onChange={(e) => setImportChannel(e.target.value as "BANK" | "CASH")}
                className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
              >
                <option value="BANK">{t("banking.filterBank")}</option>
                <option value="CASH">{t("banking.filterCash")}</option>
              </select>
            </label>
          </div>
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
              onDropFiles(e.dataTransfer.files);
            }}
            className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragActive
                ? "border-[#2980B9] bg-[#EBEDF0]"
                : "border-[#D5DADF] bg-[#F8F9FA] hover:border-[#2980B9]/60"
            }`}
          >
            <Landmark className="mx-auto mb-3 h-9 w-9 text-[#2980B9]" aria-hidden />
            <p className="m-0 text-sm font-medium text-slate-800">{t("banking.importDropHint")}</p>
            <p className="mt-2 m-0 text-xs text-slate-500">{t("banking.uploadHint")}</p>
            <label className={`mt-4 inline-flex cursor-pointer ${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}>
              <input
                type="file"
                accept=".csv,.xml,text/csv,application/xml,text/xml"
                disabled={uploading}
                className="sr-only"
                onChange={(e) => {
                  onDropFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {uploading ? t("banking.uploadHint") : t("banking.importCsv")}
            </label>
          </div>
        </div>
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={onClose}
            disabled={uploading}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
