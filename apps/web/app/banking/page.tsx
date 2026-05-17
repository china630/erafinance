"use client";

import { Building2, Clock, GitMerge, Landmark, Loader2, Plus, Search, Wallet, X } from "lucide-react";
import { BankStatementImportModal } from "./banking-modals";
import { InternalTransferModal } from "./internal-transfer-modal";
import { filterNasBankLedgerAccounts, NasBankAccountSelect, type NasBankAccountOption } from "./nas-bank-account-select";
import { toast } from "sonner";
import { PageHeader } from "../../components/layout/page-header";
import { EmptyState } from "../../components/empty-state";
import { ListPaginationFooter } from "../../components/list-pagination-footer";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { formatMoneyAzn } from "../../lib/format-money";
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../lib/form-styles";
import {
  CARD_CONTAINER_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CENTER_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_INPUT_NUMERIC_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";
import { ledgerQueryParam, useLedger } from "../../lib/ledger-context";
import { useRequireAuth } from "../../lib/use-require-auth";
import { OrganizationBankAccountModal } from "../../components/settings/organization-bank-account-modal";
import { SubscriptionPaywall } from "../../components/subscription-paywall";

type AccountSegment = "CASH" | "BANK";

type AccountCardRow = {
  segment: AccountSegment;
  accountCode: string;
  displayName: string;
  maskedNumber: string;
  balances: { currency: string; amount: string }[];
};

type AccountCardsResponse = {
  dateFrom: string;
  dateTo: string;
  ledgerType: string;
  accounts: AccountCardRow[];
};

type BankLine = {
  id: string;
  description: string | null;
  amount: unknown;
  type: string;
  origin: string;
  isMatched: boolean;
  counterpartyTaxId: string | null;
  valueDate: string | null;
  bankStatement: {
    bankName: string;
    date: string;
    channel: string;
  };
  matchedInvoice: {
    id: string;
    number: string;
    status: string;
  } | null;
};

type Candidate = {
  id: string;
  number: string;
  status: string;
  totalAmount: unknown;
  counterparty: { name: string; taxId: string };
};

type OutboundDraft = {
  id: string;
  amount: unknown;
  currency: string;
  recipientIban: string;
  purpose: string;
  status: "PENDING" | "SENT" | "REJECTED" | "COMPLETED";
  provider?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
};

function BankingQuickExpenseModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, ready: ledgerReady } = useLedger();
  const [cfItems, setCfItems] = useState<{ id: string; code: string; name: string }[]>([]);
  const [amount, setAmount] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankOptions, setBankOptions] = useState<NasBankAccountOption[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cfId, setCfId] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [createAccOpen, setCreateAccOpen] = useState(false);

  const loadCf = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch("/api/treasury/cash-flow-items");
    if (res.ok) {
      const list = (await res.json()) as { id: string; code: string; name: string }[];
      setCfItems(list);
      if (list[0]) setCfId((v) => v || list[0].id);
    }
  }, [token]);

  const loadBankAccounts = useCallback(
    async (preferCode?: string) => {
      if (!token || !ledgerReady) return;
      const res = await apiFetch(`/api/accounts?${ledgerQueryParam(ledgerType)}`);
      if (!res.ok) return;
      const raw = (await res.json()) as {
        id: string;
        code: string;
        displayName: string;
        currency: string | null;
      }[];
      const mapped: NasBankAccountOption[] = filterNasBankLedgerAccounts(raw).map((r) => ({
        id: r.id,
        code: r.code,
        displayName: r.displayName,
        currency: (r.currency || "AZN").trim() || "AZN",
      }));
      setBankOptions(mapped);
      setBankAccountId((prev) => {
        if (preferCode) {
          const byCode = mapped.find((m) => m.code === preferCode);
          if (byCode) return byCode.id;
        }
        if (prev && mapped.some((m) => m.id === prev)) return prev;
        return mapped[0]?.id ?? "";
      });
    },
    [token, ledgerReady, ledgerType],
  );

  useEffect(() => {
    if (!ready || !token) return;
    void loadCf();
  }, [ready, token, loadCf]);

  useEffect(() => {
    if (!ready || !token || !ledgerReady) return;
    void loadBankAccounts();
  }, [ready, token, ledgerReady, loadBankAccounts]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !cfId) {
      toast.error(t("banking.cash.cashFlowRequired"));
      return;
    }
    const row = bankOptions.find((a) => a.id === bankAccountId);
    if (!row?.code?.trim()) {
      toast.error(t("common.fillRequired"));
      return;
    }
    const amt = Number(amount.replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t("banking.quickExpenseAmountInvalid"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/banking/manual-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "OUTFLOW",
        amount: amt,
        bankAccountCode: row.code.trim(),
        offsetAccountCode: "731",
        date,
        cashFlowItemId: cfId,
        description: desc.trim() || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      toast.success(t("banking.manualEntryOk"));
      setAmount("");
      setDesc("");
      onDone();
      onClose();
    }
  }

  return (
    <Dialog open={true} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}>
        <DialogHeader className="shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="m-0 text-lg font-semibold leading-snug text-[#34495E]">{t("banking.quickExpense")}</h3>
            <p className="mb-0 mt-1 text-[13px] leading-snug text-[#7F8C8D]">{t("banking.manualEntryHint")}</p>
          </div>
          <Button type="button" variant="ghost" className={MODAL_CLOSE_BUTTON_CLASS} onClick={onClose} aria-label={t("common.close")}>
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </DialogHeader>

        <form className="mt-4 flex min-h-0 flex-1 flex-col" onSubmit={(e) => void onSubmit(e)}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="grid gap-4 md:grid-cols-2">
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("banking.thAmount")}
                <input
                  className={`mt-1 block w-full ${MODAL_INPUT_NUMERIC_CLASS}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("banking.cashOutDate")}
                <input
                  type="date"
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
                {t("banking.manualEntryDds")}
                <select
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  value={cfId}
                  onChange={(e) => setCfId(e.target.value)}
                >
                  {cfItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} вЂ” {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
                {t("banking.manualEntryBankAcc")}
                <div className="mt-1 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <NasBankAccountSelect
                      value={bankAccountId}
                      onChange={setBankAccountId}
                      accounts={bankOptions}
                      disabled={busy}
                      placeholder={t("common.loading")}
                      emptyLabel={t("banking.accountsEmpty")}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!h-9 !min-w-9 !px-0"
                    onClick={() => setCreateAccOpen(true)}
                    title={t("banking.newBankAccountBtn")}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </label>
              <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
                {t("banking.manualEntryDesc")}
                <input
                  className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={t("banking.cashOutDescPh")}
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
            <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} disabled={busy}>
              {busy ? t("banking.uploadHint") : t("banking.manualEntrySubmit")}
            </Button>
          </div>
        </form>
      </DialogContent>
      {createAccOpen ? (
        <OrganizationBankAccountModal
          open={createAccOpen}
          onClose={() => setCreateAccOpen(false)}
          onSaved={() => {
            setCreateAccOpen(false);
            void loadBankAccounts();
          }}
          mode="create"
        />
      ) : null}
    </Dialog>
  );
}

function formatBalanceLine(amount: string, currency: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return "вЂ”";
  if (currency === "AZN") return formatMoneyAzn(n);
  const s = new Intl.NumberFormat("az-AZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${s.replace(/\u00a0/g, " ")} ${currency}`;
}

function segmentIcon(segment: AccountSegment) {
  return segment === "CASH" ? Wallet : Landmark;
}

function sourceLabelKey(origin: string): string {
  switch (origin) {
    case "INVOICE_PAYMENT_SYSTEM":
      return "banking.sourceSystem";
    case "FILE_IMPORT":
      return "banking.sourceImport";
    case "DIRECT_SYNC":
      return "banking.sourceSync";
    case "WEBHOOK":
      return "banking.sourceWebhook";
    case "MANUAL_CASH_OUT":
      return "banking.sourceManualCash";
    case "MANUAL_BANK_ENTRY":
      return "banking.sourceManualBank";
    default:
      return "banking.sourceOther";
  }
}

function defaultYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** `ym` = `YYYY-MM` (Р»РѕРєР°Р»СЊРЅС‹Р№ РєР°Р»РµРЅРґР°СЂСЊ). */
function monthDateRange(ym: string): { from: string; to: string } {
  const parts = ym.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function CashAccountCards({
  refreshKey,
  segmentFilter = "ALL",
}: {
  refreshKey: number;
  /** РќР° СЃС‚СЂР°РЅРёС†Рµ В«Р‘Р°РЅРєВ» РїРѕРєР°Р·С‹РІР°РµРј С‚РѕР»СЊРєРѕ Р±Р°РЅРєРѕРІСЃРєРёРµ СЃС‡РµС‚Р°; РєР°СЃСЃР° вЂ” РІ СЂР°Р·РґРµР»Рµ Kassa. */
  segmentFilter?: "ALL" | "BANK" | "CASH";
}) {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType, ready: ledgerReady } = useLedger();
  const [data, setData] = useState<AccountCardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createBankOpen, setCreateBankOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token || !ledgerReady) return;
    setLoading(true);
    setError(null);
    const path = `/api/banking/account-cards?${ledgerQueryParam(ledgerType)}`;
    const res = await apiFetch(path);
    if (!res.ok) {
      const detail = String(res.status);
      toast.error(t("banking.accountsLoadErr"), { description: detail });
      setError(detail);
      setData(null);
      setLoading(false);
      return;
    }
    setData((await res.json()) as AccountCardsResponse);
    setLoading(false);
  }, [token, ledgerReady, ledgerType, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token, refreshKey]);

  if (!ready || !token) return null;

  const accounts =
    !loading && !error && data
      ? segmentFilter === "ALL"
        ? data.accounts
        : data.accounts.filter((a) => a.segment === segmentFilter)
      : [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 m-0">{t("banking.accountsTitle")}</h2>
        </div>
      </div>
      {loading && <p className="text-[#7F8C8D] text-[13px] m-0">{t("common.loading")}</p>}
      {!loading && error && (
        <EmptyState
          title={t("banking.accountsLoadErr")}
          description={t("banking.accountsLoadErrHint")}
          icon={<Landmark className="h-10 w-10" aria-hidden />}
        />
      )}
      {!loading && !error && data && accounts.length === 0 && (
        <EmptyState
          title={t("banking.accountsEmpty")}
          icon={<Landmark className="h-10 w-10" aria-hidden />}
          action={
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setCreateBankOpen(true)}
            >
              {t("banking.newBankAccountBtn")}
            </button>
          }
        />
      )}
      {!loading && !error && data && accounts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {accounts.map((acc) => {
            const Icon = segmentIcon(acc.segment);
            const segTitle =
              acc.segment === "CASH" ? t("banking.segmentCash") : t("banking.segmentBank");
            return (
              <div
                key={acc.accountCode}
                className={`relative ${CARD_CONTAINER_CLASS} p-5`}
              >
                <span className="absolute right-4 top-4 font-mono text-[11px] text-slate-400" title={acc.accountCode}>
                  {acc.accountCode}
                </span>
                <div className="flex items-start gap-3 pr-14">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#EBEDF0] text-[#2980B9]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[14px] font-bold text-[#34495E]" title={acc.displayName}>
                      {acc.displayName}
                    </p>
                    <p className="m-0 mt-1 text-xs text-slate-500">
                      {segTitle}
                      {acc.maskedNumber ? ` В· ${acc.maskedNumber}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
                  <p className="text-xs font-medium text-slate-500 m-0 mb-1">{t("banking.thNetBalance")}</p>
                  {acc.balances.map((b) => (
                    <p
                      key={`${acc.accountCode}-${b.currency}`}
                      className="m-0 text-right text-sm tabular-nums font-semibold text-slate-900"
                    >
                      {formatBalanceLine(b.amount, b.currency)}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {createBankOpen ? (
        <OrganizationBankAccountModal
          open={createBankOpen}
          onClose={() => setCreateBankOpen(false)}
          onSaved={() => {
            setCreateBankOpen(false);
            void load();
          }}
          mode="create"
        />
      ) : null}
    </section>
  );
}

type BankingSyncStatus = {
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  webhookUrl: string | null;
};

function BankingUnifiedRegistry({
  yearMonth,
  refreshKey,
  disabled,
  syncStatus,
}: {
  yearMonth: string;
  refreshKey: number;
  disabled?: boolean;
  syncStatus: BankingSyncStatus | null;
}) {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [lines, setLines] = useState<BankLine[]>([]);
  const [linesTotal, setLinesTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [drafts, setDrafts] = useState<OutboundDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [candidatesByLine, setCandidatesByLine] = useState<
    Record<string, Candidate[] | "loading" | "error">
  >({});

  useLayoutEffect(() => {
    setPage(1);
  }, [yearMonth]);

  const load = useCallback(async () => {
    if (!token) {
      setLines([]);
      setLinesTotal(0);
      setDrafts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { from, to } = monthDateRange(yearMonth);
    const lineQuery = `channel=BANK&bankOnly=true&valueDateFrom=${encodeURIComponent(from)}&valueDateTo=${encodeURIComponent(to)}&page=${encodeURIComponent(String(page))}&pageSize=${encodeURIComponent(String(pageSize))}`;
    const [lineRes, draftRes] = await Promise.all([
      apiFetch(`/api/banking/lines?${lineQuery}`),
      apiFetch("/api/banking/payment-drafts?status=PENDING"),
    ]);
    if (!lineRes.ok) {
      const detail = String(lineRes.status);
      toast.error(t("banking.loadErr"), { description: detail });
      setError(detail);
      setLines([]);
      setLinesTotal(0);
    } else {
      const body = (await lineRes.json()) as {
        items: BankLine[];
        total: number;
        page: number;
        pageSize: number;
      };
      setLines(Array.isArray(body.items) ? body.items : []);
      setLinesTotal(typeof body.total === "number" ? body.total : 0);
    }
    if (draftRes.ok) {
      setDrafts((await draftRes.json()) as OutboundDraft[]);
    } else {
      setDrafts([]);
    }
    setLoading(false);
  }, [token, t, yearMonth, page, pageSize]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token, refreshKey]);

  async function loadCandidates(lineId: string) {
    if (!token) return;
    setCandidatesByLine((m) => ({ ...m, [lineId]: "loading" }));
    const res = await apiFetch(`/api/banking/lines/${lineId}/candidates`);
    if (!res.ok) {
      setCandidatesByLine((m) => ({ ...m, [lineId]: "error" }));
      return;
    }
    const data = (await res.json()) as { candidates: Candidate[] };
    setCandidatesByLine((m) => ({ ...m, [lineId]: data.candidates ?? [] }));
  }

  async function match(lineId: string, invoiceId: string) {
    if (!token) return;
    const res = await apiFetch(`/api/banking/lines/${lineId}/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    if (!res.ok) {
      const txt = await res.text();
      toast.error(`${t("banking.matchErr")}: ${res.status} ${txt}`);
      return;
    }
    setCandidatesByLine((m) => {
      const next = { ...m };
      delete next[lineId];
      return next;
    });
    await load();
  }

  const hasAny = drafts.length > 0 || linesTotal > 0;
  const totalPages = Math.max(1, Math.ceil(linesTotal / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <section className={`space-y-4 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      {loading && <p className="text-[#7F8C8D] text-[13px] m-0">{t("banking.loadingLines")}</p>}
      {!loading && error ? (
        <EmptyState
          title={t("banking.loadErr")}
          description={error}
          icon={<Landmark className="h-8 w-8" aria-hidden />}
        />
      ) : null}
      {!loading && !error && !hasAny ? (
        <p className="text-[#7F8C8D] text-[13px] m-0">{t("banking.unifiedTableEmpty")}</p>
      ) : null}
      {!loading && !error && hasAny ? (
        <>
          {syncStatus ? (
            <div className="flex justify-end text-[11px] text-slate-500">
              <span className="text-right">
                {t("banking.lastSync")}:{" "}
                {syncStatus.lastSyncAt
                  ? new Date(syncStatus.lastSyncAt).toLocaleString()
                  : t("banking.syncNever")}
                {syncStatus.lastSyncStatus === "ok" ? (
                  <span className="ml-2 font-semibold text-emerald-700">{t("banking.syncOk")}</span>
                ) : null}
                {syncStatus.lastSyncStatus === "error" ? (
                  <span className="ml-2 font-semibold text-red-600">{t("banking.syncErr")}</span>
                ) : null}
              </span>
            </div>
          ) : null}
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("banking.thDate")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("banking.thSource")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("banking.thCounterparty")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("banking.thDescription")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("banking.thAmountInOut")}</th>
                <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("banking.thStatus")}</th>
                <th className={`${DATA_TABLE_TH_RIGHT_CLASS} min-w-[140px] w-[140px]`}>
                  {t("banking.thActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-amber-50/90">
                <td
                  colSpan={7}
                  className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wide text-amber-950"
                >
                  {t("banking.queueSectionTitle")}
                </td>
              </tr>
              {drafts.length === 0 ? (
                <tr className={`${DATA_TABLE_TR_CLASS} bg-amber-50/40`}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} text-sm text-slate-600`}>
                    {t("banking.queueEmpty")}
                  </td>
                </tr>
              ) : (
                drafts.map((r) => (
                  <tr key={`draft-${r.id}`} className={`${DATA_TABLE_TR_CLASS} align-top bg-amber-50/40`}>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>
                      {String(r.createdAt).slice(0, 10)}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t("banking.queueRowBadge")}
                      </span>
                    </td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} font-mono text-xs text-[#34495E]`}>
                      {r.recipientIban}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} max-w-md`}>{r.purpose}</td>
                    <td className={`${DATA_TABLE_TD_RIGHT_CLASS} font-medium text-rose-700`}>
                      {t("banking.expense")} В· {formatMoneyAzn(Number(r.amount))} {r.currency}
                    </td>
                    <td className={DATA_TABLE_TD_CENTER_CLASS}>
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                        {r.status}
                      </span>
                      {r.rejectionReason ? (
                        <div className="mt-1 text-xs text-rose-700">{r.rejectionReason}</div>
                      ) : null}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>вЂ”</td>
                  </tr>
                ))
              )}
              <tr className="bg-slate-50">
                <td
                  colSpan={7}
                  className="py-2.5 px-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700"
                >
                  {t("banking.historySectionTitle")} В· {yearMonth}
                </td>
              </tr>
              {lines.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} text-sm text-slate-600`}>
                    {t("banking.noLinesMonth")}
                  </td>
                </tr>
              ) : (
                lines.map((r) => {
                  const amt = Number(
                    String(r.amount ?? "")
                      .replace(/\s/g, "")
                      .replace(",", "."),
                  );
                  const isIn = r.type === "INFLOW";
                  const signed = isIn ? amt : -amt;
                  return (
                    <tr key={r.id} className={`${DATA_TABLE_TR_CLASS} align-top`}>
                      <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>
                        {r.valueDate ? String(r.valueDate).slice(0, 10) : "вЂ”"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <span className="inline-flex rounded-lg bg-[#EBEDF0] px-2 py-0.5 text-xs font-medium text-[#34495E]">
                          {t(sourceLabelKey(r.origin))}
                        </span>
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                        <div className="flex min-w-[8rem] items-center justify-end gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EBEDF0] text-[#7F8C8D]">
                            <Building2 className="h-4 w-4" aria-hidden />
                          </span>
                          <span className="break-words font-mono tabular-nums text-[#34495E]">
                            {r.counterpartyTaxId ?? "вЂ”"}
                          </span>
                        </div>
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} max-w-md`}>
                        {r.description ?? r.bankStatement.bankName}
                      </td>
                      <td
                        className={`${DATA_TABLE_TD_RIGHT_CLASS} font-medium ${
                          signed >= 0 ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        <span className="block">
                          {isIn ? t("banking.income") : t("banking.expense")} В· {formatMoneyAzn(r.amount)}
                        </span>
                      </td>
                      <td className={DATA_TABLE_TD_CENTER_CLASS}>
                        {r.isMatched ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            {t("banking.statusPosted")}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                            {t("banking.statusPending")}
                          </span>
                        )}
                      </td>
                      <td className={`${DATA_TABLE_TD_CLASS} w-[140px] min-w-[140px]`}>
                        {!r.isMatched && r.type === "INFLOW" && (
                          <div className="max-w-md space-y-2 text-left">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className={TABLE_ROW_ICON_BTN_CLASS}
                                title={t("banking.candidates")}
                                onClick={() => void loadCandidates(r.id)}
                              >
                                {candidatesByLine[r.id] === "loading" ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-[#2980B9]" aria-hidden />
                                ) : (
                                  <Search className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                )}
                              </button>
                            </div>
                            {candidatesByLine[r.id] === "loading" && (
                              <span className="text-xs text-[#7F8C8D]">{t("banking.candidatesLoading")}</span>
                            )}
                            {candidatesByLine[r.id] === "error" && (
                              <span className="text-xs text-red-600">{t("banking.candidatesErr")}</span>
                            )}
                            {Array.isArray(candidatesByLine[r.id]) &&
                              (candidatesByLine[r.id] as Candidate[]).length === 0 && (
                                <p className="m-0 text-xs text-[#7F8C8D]">{t("banking.noCandidates")}</p>
                              )}
                            {Array.isArray(candidatesByLine[r.id]) &&
                              (candidatesByLine[r.id] as Candidate[]).map((c) => (
                                <div key={c.id} className="mt-1 flex flex-wrap items-center justify-end gap-1">
                                  <span className="min-w-0 flex-1 text-right text-[13px] text-[#34495E]">
                                    {c.number} В· {c.counterparty.name} В· {formatMoneyAzn(c.totalAmount)}
                                  </span>
                                  <button
                                    type="button"
                                    className={TABLE_ROW_ICON_BTN_CLASS}
                                    title={t("banking.match")}
                                    onClick={() => void match(r.id, c.id)}
                                  >
                                    <GitMerge className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={linesTotal}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      ) : null}
    </section>
  );
}

export default function BankingPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferMode, setTransferMode] = useState<"TRANSFER" | "CONVERSION" | "CASH_DEPOSIT">("TRANSFER");
  const [importOpen, setImportOpen] = useState(false);
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [syncFullBusy, setSyncFullBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<BankingSyncStatus | null>(null);

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const loadSyncStatus = useCallback(async () => {
    if (!token) {
      setSyncStatus(null);
      return;
    }
    const res = await apiFetch("/api/banking/sync/status");
    if (res.ok) {
      setSyncStatus((await res.json()) as BankingSyncStatus);
    }
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadSyncStatus();
  }, [ready, token, refreshKey, loadSyncStatus]);

  const smartSync = useCallback(async () => {
    if (!token) return;
    setSyncFullBusy(true);
    try {
      const pushRes = await apiFetch("/api/banking/payment-drafts/send-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!pushRes.ok) {
        const txt = await pushRes.text();
        toast.error(t("banking.syncFail"), { description: `${pushRes.status} ${txt}` });
      } else {
        const j = (await pushRes.json()) as { failed?: number };
        if (j.failed && j.failed > 0) {
          toast.warning(t("banking.smartSyncPushPartial", { count: String(j.failed) }));
        }
      }
      const pullRes = await apiFetch("/api/banking/sync", { method: "POST" });
      if (!pullRes.ok) {
        const txt = await pullRes.text();
        toast.error(t("banking.syncFail"), { description: `${pullRes.status} ${txt}` });
      } else {
        toast.success(t("banking.smartSyncDone"));
      }
      bump();
    } catch (e) {
      toast.error(t("banking.syncFail"), {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSyncFullBusy(false);
      void loadSyncStatus();
    }
  }, [token, t, bump, loadSyncStatus]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;
  return (
    <SubscriptionPaywall module="bankingPro">
      <div className="space-y-10 max-w-6xl mx-auto">
        <PageHeader
          title={t("banking.title")}
          leading={
            <div className="flex h-8 items-center gap-2">
              <span className="shrink-0 text-sm leading-none text-slate-700">
                {t("banking.monthPickerToolbarLabel")}
              </span>
              <input
                type="month"
                value={yearMonth}
                disabled={syncFullBusy}
                onChange={(e) => setYearMonth(e.target.value)}
                className={TOOLBAR_MONTH_INPUT_CLASS}
                aria-label={t("banking.monthPickerLabel")}
              />
            </div>
          }
          actions={
            <>
              <button
                type="button"
                disabled={syncFullBusy}
                onClick={() => void smartSync()}
                className={`${PRIMARY_BUTTON_CLASS} inline-flex items-center gap-2 disabled:opacity-50`}
              >
                {syncFullBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    {t("banking.syncRunning")}
                  </>
                ) : (
                  t("banking.syncBtn")
                )}
              </button>
              <button
                type="button"
                disabled={syncFullBusy}
                onClick={() => setImportOpen(true)}
                className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}
              >
                {t("banking.importStatementBtn")}
              </button>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={syncFullBusy}
                onClick={() => setQuickExpenseOpen(true)}
              >
                {t("banking.quickExpense")}
              </button>
              <details className="relative">
                <summary className={`${SECONDARY_BUTTON_CLASS} cursor-pointer list-none`}>
                  {t("banking.transfer.operationsMenu")}
                </summary>
                <div className="absolute right-0 z-20 mt-1 min-w-[14rem] rounded-xl border border-[#D5DADF] bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#34495E] hover:bg-[#F1F5F9]"
                    onClick={() => {
                      setTransferMode("TRANSFER");
                      setTransferOpen(true);
                    }}
                  >
                    {t("banking.transfer.modeTransfer")}
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#34495E] hover:bg-[#F1F5F9]"
                    onClick={() => {
                      setTransferMode("CONVERSION");
                      setTransferOpen(true);
                    }}
                  >
                    {t("banking.transfer.modeConversion")}
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#34495E] hover:bg-[#F1F5F9]"
                    onClick={() => {
                      setTransferMode("CASH_DEPOSIT");
                      setTransferOpen(true);
                    }}
                  >
                    {t("banking.transfer.modeCashDeposit")}
                  </button>
                </div>
              </details>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={syncFullBusy}
                onClick={() => setCreateAccountOpen(true)}
              >
                {t("banking.addNewBankAccountCta")}
              </button>
            </>
          }
        />

        <CashAccountCards refreshKey={refreshKey} segmentFilter="BANK" />

        <div className="relative">
          {syncFullBusy ? (
            <div
              className="absolute inset-0 z-10 rounded-lg bg-white/70 backdrop-blur-[1px]"
              aria-busy="true"
            />
          ) : null}
          <div className="relative z-[1]">
            <BankingUnifiedRegistry
              yearMonth={yearMonth}
              refreshKey={refreshKey}
              disabled={syncFullBusy}
              syncStatus={syncStatus}
            />
          </div>
        </div>

        {quickExpenseOpen ? (
          <BankingQuickExpenseModal onClose={() => setQuickExpenseOpen(false)} onDone={bump} />
        ) : null}
        {createAccountOpen ? (
          <OrganizationBankAccountModal
            open={createAccountOpen}
            onClose={() => setCreateAccountOpen(false)}
            onSaved={() => {
              setCreateAccountOpen(false);
              bump();
            }}
            mode="create"
          />
        ) : null}
        <BankStatementImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            void loadSyncStatus();
            bump();
          }}
        />
        <InternalTransferModal
          open={transferOpen}
          initialMode={transferMode}
          hideModeTabs
          onClose={() => setTransferOpen(false)}
          onDone={() => {
            setTransferOpen(false);
            bump();
          }}
        />
      </div>
    </SubscriptionPaywall>
  );
}
