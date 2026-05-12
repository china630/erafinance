"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
} from "../../lib/design-system";
import type { SupportedCurrency } from "../../lib/currencies";
import { Button } from "../ui/button";
import { CurrencySelect } from "../ui/currency-select";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";

export function CreateHoldingModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (created: { id: string; name: string; baseCurrency?: string }) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState<SupportedCurrency>("AZN");

  const title = useMemo(() => t("holdingCreate.title"), [t]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBaseCurrency("AZN");
    setBusy(false);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      toast.error(t("common.fillRequired"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/holdings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        baseCurrency,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("holdingCreate.createErr"), { description: await res.text() });
      return;
    }
    const created = (await res.json()) as {
      id: string;
      name: string;
      baseCurrency?: string;
    };
    toast.success(t("holdingCreate.createdOk"));
    onCreated(created);
    onClose();
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-xl`}>
        <DialogHeader className="shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="m-0 text-lg font-semibold leading-snug text-[#34495E]">{title}</h3>
            <p className="mb-0 mt-1 text-[13px] leading-snug text-[#7F8C8D]">{t("holdingCreate.subtitle")}</p>
          </div>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </DialogHeader>

        <form className="mt-4 flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("holdingCreate.name")}
              <input
                className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("holdingCreate.baseCurrency")}
              <div className="mt-1">
                <CurrencySelect
                  value={baseCurrency}
                  onValueChange={setBaseCurrency}
                  className={`block w-full ${MODAL_INPUT_CLASS}`}
                />
              </div>
            </label>
          </div>
          <div className={MODAL_FOOTER_ACTIONS_CLASS}>
            <Button
              type="button"
              variant="outline"
              className={MODAL_FOOTER_BUTTON_CLASS}
              onClick={onClose}
              disabled={busy}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} disabled={busy}>
              {busy ? "…" : t("holdingCreate.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
