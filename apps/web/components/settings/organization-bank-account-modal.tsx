"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import { validateAzIban } from "../../lib/iban";
import { ORGANIZATION_BANK_ACCOUNT_CURRENCIES, ORGANIZATION_BANK_ACCOUNT_TYPES } from "@erafinance/api-contracts";
import { AsyncCombobox } from "../ui/async-combobox";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";
import { useAuth } from "../../lib/auth-context";
import { FALLBACK_CURRENCY_CODES } from "../../lib/currencies";

type AccountType = (typeof ORGANIZATION_BANK_ACCOUNT_TYPES)[number];

type Row = {
  id: string;
  bankName: string;
  iban: string;
  swift: string | null;
  currency: string;
  accountType: AccountType;
  ledgerAccountCode: string;
  isPrimary: boolean;
  isFrozen: boolean;
};

type AccountOpt = {
  id: string;
  code: string;
  displayName: string;
};

const ACCOUNT_TYPES = [...ORGANIZATION_BANK_ACCOUNT_TYPES] satisfies AccountType[];

function isAllowedBankCode(code: string): boolean {
  return /^(221|222|223|224|225)(\.\d{2}){0,4}$/.test(code.trim());
}

export function OrganizationBankAccountModal({
  open,
  onClose,
  onSaved,
  mode,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  mode: "create" | "edit";
  initial?: Row | null;
}) {
  const { t } = useTranslation();
  const { currencyCodes } = useAuth();
  const allowedCurrencies = useMemo(() => {
    const base =
      currencyCodes.length > 0 ? currencyCodes : [...FALLBACK_CURRENCY_CODES];
    const wl = ORGANIZATION_BANK_ACCOUNT_CURRENCIES as readonly string[];
    const intersected = base.filter((c) => wl.includes(c));
    return intersected.length > 0 ? intersected : [...ORGANIZATION_BANK_ACCOUNT_CURRENCIES];
  }, [currencyCodes]);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [swift, setSwift] = useState("");
  const [currency, setCurrency] = useState<string>("AZN");
  const [accountType, setAccountType] = useState<AccountType>("MAIN");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [ledgerAccountCode, setLedgerAccountCode] = useState("");
  const [ledgerSelectedLabel, setLedgerSelectedLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setBankName(initial.bankName ?? "");
      setIban(initial.iban ?? "");
      setSwift(initial.swift ?? "");
      setCurrency(
        allowedCurrencies.includes(String(initial.currency ?? "").toUpperCase())
          ? String(initial.currency).toUpperCase()
          : "AZN",
      );
      setAccountType(initial.accountType ?? "MAIN");
      setIsPrimary(initial.isPrimary === true);
      setIsFrozen(initial.isFrozen === true);
      setLedgerAccountCode(initial.ledgerAccountCode ?? "");
      setLedgerSelectedLabel(initial.ledgerAccountCode ?? "");
      return;
    }
    setBankName("");
    setIban("");
    setSwift("");
    setCurrency("AZN");
    setAccountType("MAIN");
    setIsPrimary(false);
    setIsFrozen(false);
    setLedgerAccountCode("");
    setLedgerSelectedLabel("");
  }, [open, mode, initial, allowedCurrencies]);

  const title = useMemo(() => (mode === "create" ? t("bankAccountsRegistry.modalCreateTitle") : t("bankAccountsRegistry.modalEditTitle")), [mode, t]);

  async function checkIban() {
    const local = validateAzIban(iban);
    if (!local.isValid) {
      toast.error(t("bankAccountsRegistry.ibanLocalInvalid"));
      return;
    }
    setChecking(true);
    try {
      const res = await apiFetch("/api/banking/validate-iban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iban: local.normalized }),
      });
      if (!res.ok) {
        toast.error(t("bankAccountsRegistry.ibanCheckFail"), { description: String(res.status) });
        return;
      }
      setIban(local.normalized);
      try {
        const j = (await res.json()) as { bankName?: string; bic?: string };
        if (j.bankName) setBankName(j.bankName);
        if (j.bic) setSwift(j.bic);
      } catch {
        // ignore parse errors
      }
      toast.success(t("bankAccountsRegistry.ibanCheckOk"));
    } finally {
      setChecking(false);
    }
  }

  async function fetchLedgerAccounts(query: string): Promise<AccountOpt[]> {
    const res = await apiFetch("/api/accounts?ledgerType=NAS");
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ id: string; code: string; displayName?: string; nameAz?: string; nameRu?: string; nameEn?: string }>;
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => isAllowedBankCode(r.code))
      .map((r) => ({ id: r.id, code: r.code, displayName: r.displayName || r.nameRu || r.nameAz || r.nameEn || r.code }))
      .filter((r) => (q ? `${r.code} ${r.displayName}`.toLowerCase().includes(q) : true))
      .slice(0, 80);
  }

  async function submit() {
    if (busy) return;
    const normalizedIban = iban.replace(/\s+/g, "").toUpperCase();
    const local = validateAzIban(normalizedIban);
    if (!local.isValid) {
      toast.error(t("bankAccountsRegistry.ibanLocalInvalid"));
      return;
    }
    if (!bankName.trim()) {
      toast.error(t("bankAccountsRegistry.fillRequired"));
      return;
    }
    if (!isAllowedBankCode(ledgerAccountCode)) {
      toast.error(t("bankAccountsRegistry.ledgerRequired"));
      return;
    }
    setBusy(true);
    const payload = {
      iban: local.normalized,
      bankName: bankName.trim(),
      swift: swift.trim() || null,
      currency,
      accountType,
      ledgerAccountCode: ledgerAccountCode.trim(),
      isPrimary,
      isFrozen,
    };
    const url = mode === "create" ? "/api/banking/bank-accounts" : `/api/banking/bank-accounts/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) {
      const txt = await res.text();
      toast.error(t("common.saveErr"), { description: txt || String(res.status) });
      return;
    }
    toast.success(t("common.save"));
    onSaved();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-2xl`} role="dialog" aria-modal="true">
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">{title}</h3>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="grid gap-4 md:grid-cols-2">
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("bankAccountsRegistry.iban")}
              <div className="mt-1 flex items-center gap-2">
                <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} onBlur={(e) => setIban(e.target.value.replace(/\s+/g, "").toUpperCase())} className={`block w-full ${MODAL_INPUT_CLASS}`} placeholder="AZ.." />
                <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => void checkIban()} disabled={checking}>
                  {checking ? "..." : t("bankAccountsRegistry.check")}
                </Button>
              </div>
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("bankAccountsRegistry.bankName")}
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`} />
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("bankAccountsRegistry.swift")}
              <input value={swift} onChange={(e) => setSwift(e.target.value)} className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`} />
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("bankAccountsRegistry.currency")}
              <select value={currency} onChange={(e) => setCurrency(e.target.value as any)} className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}>
                {allowedCurrencies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("bankAccountsRegistry.accountType")}
              <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}>
                {ACCOUNT_TYPES.map((tp) => (
                  <option key={tp} value={tp}>{t(`bankAccountsRegistry.type.${tp}`)}</option>
                ))}
              </select>
            </label>
            <div className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
              {t("bankAccountsRegistry.ledgerAccountCode")}
              <AsyncCombobox<AccountOpt>
                value={ledgerAccountCode}
                selectedLabel={ledgerSelectedLabel}
                onChange={(_id, item) => {
                  setLedgerAccountCode(item?.code ?? "");
                  setLedgerSelectedLabel(item ? `${item.code} - ${item.displayName}` : "");
                }}
                fetcher={fetchLedgerAccounts}
                getOptionLabel={(item) => `${item.code} - ${item.displayName}`}
                placeholder={t("bankAccountsRegistry.ledgerPlaceholder")}
                portaled
              />
            </div>
            <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
              <span className="inline-flex items-center gap-2 text-[#34495E]"><input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />{t("bankAccountsRegistry.isPrimary")}</span>
            </label>
            <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
              <span className="inline-flex items-center gap-2 text-[#34495E]"><input type="checkbox" checked={isFrozen} onChange={(e) => setIsFrozen(e.target.checked)} />{t("bankAccountsRegistry.isFrozen")}</span>
            </label>
          </div>
        </div>

        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={onClose} disabled={busy}>{t("common.cancel")}</Button>
          <Button type="button" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => void submit()} disabled={busy}>{busy ? "..." : t("common.save")}</Button>
        </div>
      </div>
    </div>
  );
}
