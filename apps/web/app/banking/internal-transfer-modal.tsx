"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
import { apiFetch } from "../../lib/api-client";
import {
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
} from "../../lib/design-system";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";

type BankAccount = {
  id: string;
  bankName: string;
  iban: string;
  currency: string;
  ledgerAccountCode: string;
  isFrozen: boolean;
};

type Mode = "TRANSFER" | "CONVERSION" | "CASH_DEPOSIT";

export function InternalTransferModal({
  open,
  onClose,
  onDone,
  initialMode,
  /** When true (e.g. opened from operations menu), mode tabs are hidden and mode stays `initialMode`. */
  hideModeTabs,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  initialMode?: Mode;
  hideModeTabs?: boolean;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>(initialMode ?? "TRANSFER");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [sourceBankAccountId, setSourceBankAccountId] = useState("");
  const [targetBankAccountId, setTargetBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [commission, setCommission] = useState("");
  const [depositSource, setDepositSource] = useState<"KASSA" | "FOUNDER">("KASSA");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setMode(initialMode ?? "TRANSFER");
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await apiFetch("/api/banking/bank-accounts");
      if (!res.ok) {
        toast.error(t("common.loadErr"), { description: String(res.status) });
        return;
      }
      const data = (await res.json()) as BankAccount[];
      setAccounts(Array.isArray(data) ? data : []);
    })();
  }, [open, t]);

  const source = useMemo(
    () => accounts.find((a) => a.id === sourceBankAccountId) ?? null,
    [accounts, sourceBankAccountId],
  );
  const target = useMemo(
    () => accounts.find((a) => a.id === targetBankAccountId) ?? null,
    [accounts, targetBankAccountId],
  );

  const modalTitle = useMemo(() => {
    if (hideModeTabs) {
      if (mode === "TRANSFER") return t("banking.transfer.modeTransfer");
      if (mode === "CONVERSION") return t("banking.transfer.modeConversion");
      return t("banking.transfer.modeCashDeposit");
    }
    return t("banking.transfer.title");
  }, [hideModeTabs, mode, t]);

  if (!open) return null;

  async function submit() {
    if (busy) return;
    if (mode !== "CASH_DEPOSIT" && (!sourceBankAccountId || !targetBankAccountId)) {
      toast.error(t("common.fillRequired"));
      return;
    }
    if (mode === "CASH_DEPOSIT" && !targetBankAccountId) {
      toast.error(t("common.fillRequired"));
      return;
    }
    if (mode !== "CASH_DEPOSIT" && sourceBankAccountId === targetBankAccountId) {
      toast.error(t("banking.transfer.errors.sameAccount"));
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error(t("banking.transfer.errors.amount"));
      return;
    }
    if (mode !== "CASH_DEPOSIT" && source?.isFrozen) {
      toast.error(t("banking.transfer.errors.frozenSource"));
      return;
    }
    if (mode === "TRANSFER" && source && target && source.currency !== target.currency) {
      toast.error(t("banking.transfer.errors.sameCurrency"));
      return;
    }
    if (mode === "CONVERSION" && source && target && source.currency === target.currency) {
      toast.error(t("banking.transfer.errors.diffCurrency"));
      return;
    }
    const payload =
      mode === "TRANSFER"
        ? {
            sourceBankAccountId,
            targetBankAccountId,
            amount: Number(amount),
            date,
            commissionAmount: commission ? Number(commission) : 0,
          }
        : mode === "CONVERSION"
          ? {
              sourceBankAccountId,
              targetBankAccountId,
              sourceAmount: Number(amount),
              targetAmount: Number(targetAmount),
              date,
              commissionAmount: commission ? Number(commission) : 0,
            }
          : {
              targetBankAccountId,
              amount: Number(amount),
              source: depositSource,
              date,
            };
    if (mode === "CONVERSION" && (!targetAmount || Number(targetAmount) <= 0)) {
      toast.error(t("banking.transfer.errors.targetAmount"));
      return;
    }
    setBusy(true);
    const res = await apiFetch(
      mode === "TRANSFER"
        ? "/api/banking/transfers"
        : mode === "CONVERSION"
          ? "/api/banking/conversions"
          : "/api/banking/cash-deposits",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const txt = await res.text();
      toast.error(t("common.saveErr"), { description: txt || String(res.status) });
      return;
    }
    toast.success(t("common.save"));
    onDone();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-2xl`}>
        <DialogHeader className="shrink-0">
          <h3 className="m-0 flex-1 text-lg font-semibold text-[#34495E]">{modalTitle}</h3>
          <Button
            type="button"
            variant="ghost"
            className={MODAL_CLOSE_BUTTON_CLASS}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {!hideModeTabs ? (
            <div className="grid gap-2 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setMode("TRANSFER")}
                className={`${MODAL_FOOTER_BUTTON_CLASS} ${mode === "TRANSFER" ? "border-[#16A085] text-[#16A085]" : ""}`}
              >
                {t("banking.transfer.modeTransfer")}
              </button>
              <button
                type="button"
                onClick={() => setMode("CONVERSION")}
                className={`${MODAL_FOOTER_BUTTON_CLASS} ${mode === "CONVERSION" ? "border-[#16A085] text-[#16A085]" : ""}`}
              >
                {t("banking.transfer.modeConversion")}
              </button>
              <button
                type="button"
                onClick={() => setMode("CASH_DEPOSIT")}
                className={`${MODAL_FOOTER_BUTTON_CLASS} ${mode === "CASH_DEPOSIT" ? "border-[#16A085] text-[#16A085]" : ""}`}
              >
                {t("banking.transfer.modeCashDeposit")}
              </button>
            </div>
          ) : null}

          {mode !== "CASH_DEPOSIT" ? (
            <>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("banking.transfer.sourceAccount")}
                <select
                  value={sourceBankAccountId}
                  onChange={(e) => setSourceBankAccountId(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                >
                  <option value="">{t("banking.transfer.chooseAccount")}</option>
                  {accounts
                    .filter((a) => !a.isFrozen)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} - {a.currency} - {a.ledgerAccountCode}
                      </option>
                    ))}
                </select>
              </label>

              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("banking.transfer.targetAccount")}
                <select
                  value={targetBankAccountId}
                  onChange={(e) => setTargetBankAccountId(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                >
                  <option value="">{t("banking.transfer.chooseAccount")}</option>
                  {accounts
                    .filter((a) => a.id !== sourceBankAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.bankName} - {a.currency} - {a.ledgerAccountCode}
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("banking.transfer.cashDepositTarget")}
                <select
                  value={targetBankAccountId}
                  onChange={(e) => setTargetBankAccountId(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                >
                  <option value="">{t("banking.transfer.chooseAccount")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bankName} - {a.currency} - {a.ledgerAccountCode}
                    </option>
                  ))}
                </select>
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("banking.transfer.cashDepositSource")}
                <select
                  value={depositSource}
                  onChange={(e) => setDepositSource(e.target.value as "KASSA" | "FOUNDER")}
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                >
                  <option value="KASSA">{t("banking.transfer.cashDepositFromKassa")}</option>
                  <option value="FOUNDER">{t("banking.transfer.cashDepositFromFounder")}</option>
                </select>
              </label>
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("banking.transfer.amountOut")}
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                inputMode="decimal"
              />
            </label>
            {mode === "CONVERSION" ? (
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("banking.transfer.amountIn")}
                <input
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                  inputMode="decimal"
                />
              </label>
            ) : null}
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("banking.transfer.commission")}
              <input
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                inputMode="decimal"
              />
            </label>
            <label className={MODAL_FIELD_LABEL_CLASS}>
              {t("banking.transfer.date")}
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
              />
            </label>
          </div>
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
          <Button
            type="button"
            variant="primary"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? "…" : t("common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
