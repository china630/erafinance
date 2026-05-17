"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { inputFieldClass } from "../../lib/form-classes";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";

type Cp = { id: string; name: string };

const lbl = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

export function PsaProjectCreateModal({
  open,
  onClose,
  counterparties,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  counterparties: Cp[];
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [cpId, setCpId] = useState("");
  const [rate, setRate] = useState("50");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setName("");
    setRate("50");
    setErr(null);
    setCpId(counterparties[0]?.id ?? "");
  }, [open, counterparties]);

  if (!open) return null;

  async function submit() {
    if (!cpId) return;
    setBusy(true);
    setErr(null);
    const res = await apiFetch("/api/psa/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim(),
        name: name.trim(),
        counterpartyId: cpId,
        hourlyRate: Number(rate),
        billingMode: "HOURLY",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr(t("psa.saveErr"));
      return;
    }
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`} role="dialog" aria-modal="true">
        <header className="flex items-start justify-between gap-3">
          <h2 className="m-0 text-lg font-semibold text-[#34495E]">{t("psa.createProject")}</h2>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </header>
        <div className="mt-4 space-y-3">
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={lbl}>{t("psa.code")}</label>
              <input className={inputFieldClass} value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>{t("psa.name")}</label>
              <input className={inputFieldClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={lbl}>{t("psa.hourlyRate")}</label>
              <input className={inputFieldClass} value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={lbl}>{t("psa.counterpartyId")}</label>
              <select className={inputFieldClass} value={cpId} onChange={(e) => setCpId(e.target.value)}>
                {counterparties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void submit()}>
              {busy ? "…" : t("psa.createProject")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
