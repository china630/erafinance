"use client";

import { CheckCircle2, Eye, Printer, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../../../components/empty-state";
import { KO1PrintForm, type KO1PrintOrder } from "../../../../components/print/KO1PrintForm";
import { apiFetch } from "../../../../lib/api-client";
import {
  CARD_CONTAINER_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_TEXTAREA_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../../lib/design-system";
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../../../lib/form-styles";
import { ledgerQueryParam, useLedger } from "../../../../lib/ledger-context";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import { SubscriptionPaywall } from "../../../../components/subscription-paywall";
import { PageHeader } from "../../../../components/layout/page-header";
import { Button } from "../../../../components/ui/button";
import { AsyncCombobox } from "../../../../components/ui/async-combobox";
import { CurrencySelect } from "../../../../components/ui/currency-select";
import { DatePicker } from "../../../../components/ui/date-picker";
import { NumericAmountInput } from "../../../../components/ui/numeric-amount-input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../../components/ui/select";
import type { SupportedCurrency } from "../../../../lib/currencies";

type CashOrderKind = "KMO" | "KXO";
type CashOrderStatus = "DRAFT" | "POSTED" | "CANCELLED";

type CashOrderRow = {
  id: string;
  orderNumber: string;
  date: string;
  kind: CashOrderKind;
  status: CashOrderStatus;
  currency: string;
  amount: string;
  purpose: string;
  skipJournalPosting?: boolean;
  counterparty?: { id: string; name: string } | null;
  employee?: { id: string; firstName: string; lastName: string } | null;
};

type PkoSubtype =
  | "INCOME_FROM_CUSTOMER"
  | "RETURN_FROM_ACCOUNTABLE"
  | "WITHDRAWAL_FROM_BANK"
  | "OTHER";

type RkoSubtype =
  | "SALARY"
  | "SUPPLIER_PAYMENT"
  | "ACCOUNTABLE_ISSUE"
  | "BANK_DEPOSIT"
  | "OTHER";

type AccountableRow = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    finCode: string;
    accountableAccountCode244: string | null;
  };
  accountCode: string;
  balance: string;
  currency: string;
};

type CounterpartyRole = "CUSTOMER" | "SUPPLIER" | "BOTH" | "OTHER";
type CounterpartySearchRow = { id: string; name: string; taxId?: string | null; role?: CounterpartyRole };
type EmployeeOpt = {
  id: string;
  firstName: string;
  lastName: string;
  accountableAccountCode244?: string | null;
};

type CashCatalogRow = { code: string; name: string; cashProfile: string | null };

type CashFlowOpt = { id: string; code: string; name: string };
type CashDeskOpt = { id: string; name: string };

function defaultCashCodeForCurrency(
  currency: string,
  rows: CashCatalogRow[],
): string {
  const cur = currency.trim().toUpperCase() || "AZN";
  const want = cur === "AZN" ? "AZN" : "FX";
  const match = rows.filter((r) => r.cashProfile === want);
  if (match.length === 0) return want === "AZN" ? "101.01" : "102.01";
  return match[0].code;
}

function cashRowsForCurrency(currency: string, rows: CashCatalogRow[]) {
  const cur = currency.trim().toUpperCase() || "AZN";
  const want = cur === "AZN" ? "AZN" : "FX";
  return rows.filter((r) => r.cashProfile === want);
}

function CashAccountSelect({
  value,
  onChange,
  currency,
  catalog,
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  currency: string;
  catalog: CashCatalogRow[];
  className: string;
}) {
  const opts = cashRowsForCurrency(currency, catalog);
  if (opts.length === 0) {
    return (
      <input className={className} value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {opts.map((r) => (
        <option key={r.code} value={r.code}>
          {r.code} — {r.name}
        </option>
      ))}
    </select>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** `ym` = `YYYY-MM` (локальный календарь). */
function monthDateRange(ym: string): { from: string; to: string } {
  const parts = ym.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export default function BankingCashPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ledgerType } = useLedger();
  const lq = ledgerQueryParam(ledgerType);

  const [balances, setBalances] = useState<Record<string, string> | null>(null);
  const [orders, setOrders] = useState<CashOrderRow[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(25);
  const [accountable, setAccountable] = useState<AccountableRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [pkoCpLabel, setPkoCpLabel] = useState("");
  const [rkoCpLabel, setRkoCpLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cashCatalog, setCashCatalog] = useState<CashCatalogRow[]>([]);
  const [cashFlowItems, setCashFlowItems] = useState<CashFlowOpt[]>([]);
  const [cashDesks, setCashDesks] = useState<CashDeskOpt[]>([]);

  const [pkoOpen, setPkoOpen] = useState(false);
  const [rkoOpen, setRkoOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const [pkoDate, setPkoDate] = useState(todayIso);
  const [pkoSubtype, setPkoSubtype] = useState<PkoSubtype>("INCOME_FROM_CUSTOMER");
  const [pkoAmount, setPkoAmount] = useState("");
  const [pkoCurrency, setPkoCurrency] = useState<SupportedCurrency>("AZN");
  const [pkoPurpose, setPkoPurpose] = useState("");
  const [pkoCash, setPkoCash] = useState("101.01");
  const [pkoOffset, setPkoOffset] = useState("");
  const [pkoCpId, setPkoCpId] = useState("");
  const [pkoEmpId, setPkoEmpId] = useState("");
  const [pkoNotes, setPkoNotes] = useState("");
  const [pkoCfId, setPkoCfId] = useState("");
  const [pkoDeskId, setPkoDeskId] = useState("");

  const [rkoDate, setRkoDate] = useState(todayIso);
  const [rkoSubtype, setRkoSubtype] = useState<RkoSubtype>("SUPPLIER_PAYMENT");
  const [rkoAmount, setRkoAmount] = useState("");
  const [rkoCurrency, setRkoCurrency] = useState<SupportedCurrency>("AZN");
  const [rkoPurpose, setRkoPurpose] = useState("");
  const [rkoCash, setRkoCash] = useState("101.01");
  const [rkoOffset, setRkoOffset] = useState("");
  const [rkoCpId, setRkoCpId] = useState("");
  const [rkoEmpId, setRkoEmpId] = useState("");
  const [rkoNotes, setRkoNotes] = useState("");
  const [rkoCfId, setRkoCfId] = useState("");
  const [rkoDeskId, setRkoDeskId] = useState("");
  const [rkoWithholding, setRkoWithholding] = useState("");

  const [advEmployeeId, setAdvEmployeeId] = useState("");
  const [advDate, setAdvDate] = useState(todayIso);
  const [advLines, setAdvLines] = useState<{ amount: string; description: string }[]>([
    { amount: "", description: "" },
  ]);
  const [advPurpose, setAdvPurpose] = useState("");
  const [advSaving, setAdvSaving] = useState(false);
  const [advDraftId, setAdvDraftId] = useState<string | null>(null);

  const [quickDate, setQuickDate] = useState(todayIso);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickPurpose, setQuickPurpose] = useState("");
  const [quickCfId, setQuickCfId] = useState("");
  const [quickCurrency, setQuickCurrency] = useState<SupportedCurrency>("AZN");
  const [quickBusy, setQuickBusy] = useState(false);

  const [ko1PrintOrder, setKo1PrintOrder] = useState<KO1PrintOrder | null>(null);
  const [viewOrder, setViewOrder] = useState<CashOrderRow | null>(null);
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [accountableDialogOpen, setAccountableDialogOpen] = useState(false);

  useLayoutEffect(() => {
    setOrdersPage(1);
  }, [yearMonth]);

  const fetchCashCounterpartiesIncoming = useCallback(async (search: string) => {
    const q = new URLSearchParams();
    q.set("limit", "20");
    q.set("cashParty", "incoming");
    const trimmed = search.trim();
    if (trimmed) q.set("search", trimmed);
    const res = await apiFetch(`/api/counterparties?${q}`);
    if (!res.ok) return [];
    const list = (await res.json()) as CounterpartySearchRow[];
    return Array.isArray(list) ? list : [];
  }, []);

  const fetchCashCounterpartiesOutgoing = useCallback(async (search: string) => {
    const q = new URLSearchParams();
    q.set("limit", "20");
    q.set("cashParty", "outgoing");
    const trimmed = search.trim();
    if (trimmed) q.set("search", trimmed);
    const res = await apiFetch(`/api/counterparties?${q}`);
    if (!res.ok) return [];
    const list = (await res.json()) as CounterpartySearchRow[];
    return Array.isArray(list) ? list : [];
  }, []);

  const loadCore = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    const { from, to } = monthDateRange(yearMonth);
    const ordersQuery = `dateFrom=${encodeURIComponent(from)}&dateTo=${encodeURIComponent(to)}&page=${encodeURIComponent(String(ordersPage))}&pageSize=${encodeURIComponent(String(ordersPageSize))}`;
    const [b, o, e, chart, cf, desks] = await Promise.all([
      apiFetch(`/api/banking/cash/balances?${lq}`),
      apiFetch(`/api/banking/cash/orders?${ordersQuery}`),
      apiFetch("/api/hr/employees?page=1&pageSize=100"),
      apiFetch("/api/accounts/chart/cash-catalog"),
      apiFetch("/api/treasury/cash-flow-items"),
      apiFetch("/api/treasury/cash-desks"),
    ]);
    if (!b.ok || !o.ok) {
      const msg = t("banking.cash.loadErr");
      toast.error(msg);
      setErr(msg);
      setLoading(false);
      return;
    }
    setBalances((await b.json()) as Record<string, string>);
    const oj = (await o.json()) as { items?: CashOrderRow[]; total?: number };
    setOrders(Array.isArray(oj.items) ? oj.items : []);
    setOrdersTotal(typeof oj.total === "number" ? oj.total : 0);
    if (e.ok) {
      const ej = (await e.json()) as { items?: EmployeeOpt[] };
      setEmployees(ej.items ?? []);
    }
    if (chart.ok) {
      setCashCatalog((await chart.json()) as CashCatalogRow[]);
    }
    if (cf.ok) {
      setCashFlowItems((await cf.json()) as CashFlowOpt[]);
    } else {
      setCashFlowItems([]);
    }
    if (desks.ok) {
      setCashDesks((await desks.json()) as CashDeskOpt[]);
    } else {
      setCashDesks([]);
    }
    const accRes = await apiFetch(`/api/banking/cash/accountable?${lq}`);
    if (accRes.ok) {
      setAccountable((await accRes.json()) as AccountableRow[]);
    }
    setLoading(false);
  }, [token, t, lq, yearMonth, ordersPage, ordersPageSize]);

  const loadAccountable = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch(`/api/banking/cash/accountable?${lq}`);
    if (res.ok) {
      setAccountable((await res.json()) as AccountableRow[]);
    }
  }, [token, lq]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadCore();
  }, [ready, token, loadCore]);

  useEffect(() => {
    if (pkoSubtype === "INCOME_FROM_CUSTOMER") {
      setPkoEmpId("");
    } else if (pkoSubtype === "RETURN_FROM_ACCOUNTABLE") {
      setPkoCpId("");
      setPkoCpLabel("");
    }
  }, [pkoSubtype]);

  useEffect(() => {
    if (cashFlowItems.length === 0) return;
    const first = cashFlowItems[0].id;
    setPkoCfId((v) => v || first);
    setRkoCfId((v) => v || first);
    setQuickCfId((v) => v || first);
  }, [cashFlowItems]);

  useEffect(() => {
    if (cashCatalog.length === 0) return;
    const allowed = new Set(
      cashRowsForCurrency(pkoCurrency, cashCatalog).map((r) => r.code),
    );
    if (!allowed.has(pkoCash)) {
      setPkoCash(defaultCashCodeForCurrency(pkoCurrency, cashCatalog));
    }
  }, [pkoCurrency, cashCatalog, pkoCash]);

  useEffect(() => {
    if (cashCatalog.length === 0) return;
    const allowed = new Set(
      cashRowsForCurrency(rkoCurrency, cashCatalog).map((r) => r.code),
    );
    if (!allowed.has(rkoCash)) {
      setRkoCash(defaultCashCodeForCurrency(rkoCurrency, cashCatalog));
    }
  }, [rkoCurrency, cashCatalog, rkoCash]);

  const partyLabel = useCallback((row: CashOrderRow) => {
    if (row.counterparty?.name) return row.counterparty.name;
    if (row.employee) {
      return `${row.employee.firstName} ${row.employee.lastName}`.trim();
    }
    return "—";
  }, []);

  const typeLabel = useCallback(
    (row: CashOrderRow) =>
      row.kind === "KMO" ? t("banking.cash.typeIn") : t("banking.cash.typeOut"),
    [t],
  );

  const statusLabel = useCallback(
    (s: CashOrderStatus) =>
      s === "POSTED" ? t("banking.cash.statusPosted") : t("banking.cash.statusDraft"),
    [t],
  );

  async function openPrint(orderId: string) {
    const res = await apiFetch(`/api/banking/cash/orders/${orderId}/print`);
    const html = await res.text();
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  function printKo1ForRow(row: CashOrderRow) {
    if (row.kind !== "KMO") {
      void openPrint(row.id);
      return;
    }
    const fromParty = row.counterparty?.name
      ? row.counterparty.name
      : row.employee
        ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
        : "—";

    setKo1PrintOrder({
      orderNumber: row.orderNumber,
      dateIso: row.date?.slice?.(0, 10) ?? todayIso(),
      organizationName: "", // will be filled once API includes org info in list (KO-1 still prints)
      organizationTaxId: null,
      fromParty,
      purpose: row.purpose ?? "",
      amount: String(row.amount ?? "0"),
    });
    window.setTimeout(() => window.print(), 50);
  }

  async function submitPko(e: React.FormEvent) {
    e.preventDefault();
    if (!pkoCfId) {
      toast.error(t("banking.cash.cashFlowRequired"));
      return;
    }
    const body: Record<string, unknown> = {
      date: pkoDate,
      pkoSubtype,
      amount: Number(pkoAmount.replace(",", ".")),
      currency: pkoCurrency,
      purpose: pkoPurpose,
      cashAccountCode: pkoCash,
      cashFlowItemId: pkoCfId,
    };
    if (pkoOffset.trim()) body.offsetAccountCode = pkoOffset.trim();
    if (pkoCpId) body.counterpartyId = pkoCpId;
    if (pkoEmpId) body.employeeId = pkoEmpId;
    if (pkoNotes.trim()) body.notes = pkoNotes.trim();
    if (pkoDeskId) body.cashDeskId = pkoDeskId;
    const res = await apiFetch("/api/banking/cash/orders/kmo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setPkoOpen(false);
      setPkoAmount("");
      setPkoPurpose("");
      setPkoNotes("");
      setPkoCpId("");
      setPkoCpLabel("");
      await loadCore();
    }
  }

  async function submitRko(e: React.FormEvent) {
    e.preventDefault();
    if (!rkoCfId) {
      toast.error(t("banking.cash.cashFlowRequired"));
      return;
    }
    const body: Record<string, unknown> = {
      date: rkoDate,
      rkoSubtype,
      amount: Number(rkoAmount.replace(",", ".")),
      currency: rkoCurrency,
      purpose: rkoPurpose,
      cashAccountCode: rkoCash,
      cashFlowItemId: rkoCfId,
    };
    if (rkoOffset.trim()) body.offsetAccountCode = rkoOffset.trim();
    if (rkoCpId) body.counterpartyId = rkoCpId;
    if (rkoEmpId) body.employeeId = rkoEmpId;
    if (rkoNotes.trim()) body.notes = rkoNotes.trim();
    if (rkoDeskId) body.cashDeskId = rkoDeskId;
    const wht = Number(rkoWithholding.replace(",", "."));
    if (Number.isFinite(wht) && wht > 0) {
      body.withholdingTaxAmount = wht;
    }
    const res = await apiFetch("/api/banking/cash/orders/kxo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setRkoOpen(false);
      setRkoAmount("");
      setRkoPurpose("");
      setRkoNotes("");
      setRkoWithholding("");
      setRkoCpId("");
      setRkoCpLabel("");
      await loadCore();
    }
  }

  async function postOrder(id: string) {
    const res = await apiFetch(`/api/banking/cash/orders/${id}/post`, {
      method: "POST",
    });
    if (res.ok) await loadCore();
  }

  async function submitQuickCashOut(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(quickAmount.replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0 || !quickPurpose.trim()) return;
    if (!quickCfId) {
      toast.error(t("banking.cash.cashFlowRequired"));
      return;
    }
    setQuickBusy(true);
    const create = await apiFetch("/api/banking/cash/orders/kxo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: quickDate,
        rkoSubtype: "OTHER",
        amount: amt,
        currency: quickCurrency,
        purpose: quickPurpose.trim(),
        cashAccountCode: "101.01",
        offsetAccountCode: "731",
        cashFlowItemId: quickCfId,
      }),
    });
    if (!create.ok) {
      setQuickBusy(false);
      return;
    }
    const row = (await create.json()) as { id: string };
    const post = await apiFetch(`/api/banking/cash/orders/${row.id}/post`, {
      method: "POST",
    });
    setQuickBusy(false);
    if (post.ok) {
      setQuickAmount("");
      setQuickPurpose("");
      await loadCore();
    }
  }

  const accountableOptions = useMemo(
    () => accountable.map((r) => r.employee),
    [accountable],
  );

  const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / ordersPageSize));

  useEffect(() => {
    if (ordersPage > ordersTotalPages) setOrdersPage(ordersTotalPages);
  }, [ordersPage, ordersTotalPages]);

  async function submitAdvanceDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!advEmployeeId) return;
    setAdvSaving(true);
    const lines = advLines
      .map((x) => ({
        amount: Number(x.amount.replace(",", ".")),
        description: x.description.trim(),
      }))
      .filter((x) => x.amount > 0 && x.description);
    const res = await apiFetch("/api/banking/cash/advance-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: advEmployeeId,
        reportDate: advDate,
        expenseLines: lines,
        purpose: advPurpose.trim() || undefined,
      }),
    });
    setAdvSaving(false);
    if (res.ok) {
      const row = (await res.json()) as { id: string };
      setAdvDraftId(row.id);
    }
  }

  async function postAdvance() {
    if (!advDraftId) return;
    setAdvSaving(true);
    const res = await apiFetch(`/api/banking/cash/advance-reports/${advDraftId}/post`, {
      method: "POST",
    });
    setAdvSaving(false);
    if (res.ok) {
      setAdvDraftId(null);
      setAdvLines([{ amount: "", description: "" }]);
      setAdvPurpose("");
      setAdvEmployeeId("");
      await loadAccountable();
      await loadCore();
      setAdvOpen(false);
    }
  }

  if (!ready || !token) return null;

  return (
    <SubscriptionPaywall module="kassaPro">
      <>
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #ko1-print-root,
            #ko1-print-root * {
              visibility: visible !important;
            }
            #ko1-print-root {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              background: white;
            }
          }
        `}</style>
        <div id="ko1-print-root" className="hidden print:block">
          {ko1PrintOrder ? <KO1PrintForm order={ko1PrintOrder} lang="az" /> : null}
        </div>

        <section className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title={t("banking.cash.pageTitle")}
          leading={
            <div className="flex h-8 items-center gap-2">
              <span className="shrink-0 text-sm font-medium leading-none text-[#34495E]">
                {t("banking.monthPickerToolbarLabel")}
              </span>
              <input
                type="month"
                value={yearMonth}
                disabled={loading}
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
                disabled={loading}
                onClick={() => setPkoOpen(true)}
                className={PRIMARY_BUTTON_CLASS}
              >
                {t("banking.cash.btnPko")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setRkoOpen(true)}
                className={SECONDARY_BUTTON_CLASS}
              >
                {t("banking.cash.btnRko")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setAdvOpen(true)}
                className={SECONDARY_BUTTON_CLASS}
              >
                {t("banking.cash.btnAdvanceTop")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setAccountableDialogOpen(true)}
                className={SECONDARY_BUTTON_CLASS}
                title={t("banking.cash.accountableHint")}
              >
                {t("banking.cash.sideAccountableTitle")}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setQuickOpen(true)}
                className={SECONDARY_BUTTON_CLASS}
              >
                {t("banking.cash.quickCashOutTitle")}
              </button>
            </>
          }
        />

        {err && !loading ? (
          <EmptyState
            title={err}
            description={t("banking.cash.loadErrHint")}
            icon={<Wallet className="h-10 w-10" aria-hidden />}
          />
        ) : null}
        {!err && (
          <>
            {loading && <p className="text-[#7F8C8D] text-[13px]">{t("common.loading")}</p>}

            <div className="space-y-3">
              <h2 className="m-0 text-base font-semibold text-[#34495E]">{t("banking.cash.balanceTitle")}</h2>
              {balances && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(["AZN", "USD", "EUR"] as const).map((cur) => (
                    <div key={cur} className={`${CARD_CONTAINER_CLASS} p-5`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#EBEDF0] text-[#2980B9]">
                          <Wallet className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-xs font-medium text-slate-500">
                            {cur === "AZN"
                              ? t("banking.cash.currencyAzn")
                              : cur === "USD"
                                ? t("banking.cash.currencyUsd")
                                : t("banking.cash.currencyEur")}
                          </p>
                          <p className="m-0 mt-2 text-lg font-semibold tabular-nums text-[#34495E]">
                            {balances[cur] ?? "0.00"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="m-0 text-base font-semibold text-[#34495E]">
                {t("banking.cash.journalTitle")} · {yearMonth}
              </h2>
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={`${DATA_TABLE_CLASS} min-w-full`}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("banking.cash.colOrderNo")}</th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("banking.cash.colDate")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("banking.cash.colType")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("banking.cash.colParty")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("banking.cash.colPurpose")}</th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("banking.cash.colAmount")}</th>
                      <th className={`${DATA_TABLE_TH_RIGHT_CLASS} w-[120px] min-w-[7.5rem]`}>
                        {t("banking.cash.colActions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((row) => (
                      <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                        <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>
                          <button
                            type="button"
                            className="text-left font-medium text-[#2980B9] hover:underline underline-offset-2"
                            onClick={() => setViewOrder(row)}
                          >
                            {row.orderNumber}
                          </button>
                        </td>
                        <td className={`${DATA_TABLE_TD_RIGHT_CLASS} whitespace-nowrap`}>
                          {row.date?.slice?.(0, 10) ?? "—"}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <span className="block">{typeLabel(row)}</span>
                          <span className="text-xs text-[#7F8C8D]">{statusLabel(row.status)}</span>
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{partyLabel(row)}</td>
                        <td className={`${DATA_TABLE_TD_CLASS} max-w-xs truncate`} title={row.purpose}>
                          {row.purpose}
                        </td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {row.amount} {row.currency}
                        </td>
                        <td className={`${DATA_TABLE_TD_CLASS} w-[120px] min-w-[7.5rem]`}>
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setViewOrder(row)}
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              title={t("common.view")}
                            >
                              <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => printKo1ForRow(row)}
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              title={t("banking.cash.print")}
                            >
                              <Printer className="h-4 w-4 text-[#7F8C8D]" aria-hidden />
                            </button>
                            {row.status === "DRAFT" && (
                              <button
                                type="button"
                                onClick={() => void postOrder(row.id)}
                                className={TABLE_ROW_ICON_BTN_CLASS}
                                title={t("banking.cash.postOrder")}
                              >
                                <CheckCircle2 className="h-4 w-4 text-[#2980B9]" aria-hidden />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ordersTotal > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EBEDF0] pt-3 text-[13px] text-[#34495E]">
                  <label className="flex items-center gap-2">
                    <span className="text-[#7F8C8D]">{t("common.paginationRowsPerPage")}</span>
                    <select
                      className={`${MODAL_INPUT_CLASS} !mt-0 h-9 min-w-[4.5rem]`}
                      value={String(ordersPageSize)}
                      onChange={(e) => {
                        setOrdersPageSize(Number(e.target.value) || 25);
                        setOrdersPage(1);
                      }}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </label>
                  <span className="tabular-nums text-[#7F8C8D]">
                    {t("common.paginationPageOf", {
                      page: String(ordersPage),
                      pages: String(ordersTotalPages),
                      total: String(ordersTotal),
                    })}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={ordersPage <= 1}
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                    >
                      {t("common.paginationPrev")}
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={ordersPage >= ordersTotalPages}
                      onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))}
                    >
                      {t("common.paginationNext")}
                    </button>
                  </div>
                </div>
              ) : null}
              {!loading && ordersTotal === 0 && (
                <p className="px-4 py-6 text-slate-500 text-sm">—</p>
              )}
            </div>

            {viewOrder ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div
                  className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}
                  role="dialog"
                  aria-modal="true"
                >
                  <header className="flex shrink-0 items-start justify-between gap-3">
                    <div className="min-w-0 pr-2">
                      <h3 className="m-0 text-lg font-semibold leading-snug text-[#34495E]">
                        {viewOrder.orderNumber}
                      </h3>
                      <p className="mb-0 mt-1 text-[13px] text-[#7F8C8D]">
                        {viewOrder.date?.slice?.(0, 10) ?? "—"} · {typeLabel(viewOrder)} ·{" "}
                        {statusLabel(viewOrder.status)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className={MODAL_CLOSE_BUTTON_CLASS}
                      onClick={() => setViewOrder(null)}
                      aria-label={t("common.close")}
                    >
                      <X className="h-4 w-4 shrink-0" aria-hidden />
                    </Button>
                  </header>

                  <div className="mt-4 space-y-2 text-[13px] text-[#34495E]">
                    <div>
                      <span className="text-[13px] font-semibold text-[#7F8C8D]">
                        {t("banking.cash.colParty")}
                      </span>
                      <div className="mt-0.5">{partyLabel(viewOrder)}</div>
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-[#7F8C8D]">
                        {t("banking.cash.colPurpose")}
                      </span>
                      <div className="mt-0.5">{viewOrder.purpose}</div>
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-[#7F8C8D]">
                        {t("banking.cash.colAmount")}
                      </span>
                      <div className="mt-0.5 tabular-nums">
                        {viewOrder.amount} {viewOrder.currency}
                      </div>
                    </div>
                  </div>

                  <div className={MODAL_FOOTER_ACTIONS_CLASS}>
                    <Button
                      type="button"
                      variant="outline"
                      className={`${MODAL_FOOTER_BUTTON_CLASS} inline-flex items-center gap-2`}
                      onClick={() => printKo1ForRow(viewOrder)}
                    >
                      <Printer className="h-4 w-4 shrink-0" aria-hidden />
                      {t("banking.cash.print")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {accountableDialogOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div
                  className={`${MODAL_DIALOG_CONTENT_CLASS} flex max-h-[min(90vh,48rem)] w-full max-w-2xl flex-col`}
                  role="dialog"
                  aria-modal="true"
                >
                  <header className="flex shrink-0 items-start justify-between gap-3">
                    <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
                      {t("banking.cash.sideAccountableTitle")}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      className={MODAL_CLOSE_BUTTON_CLASS}
                      onClick={() => setAccountableDialogOpen(false)}
                      aria-label={t("common.close")}
                    >
                      <X className="h-4 w-4 shrink-0" aria-hidden />
                    </Button>
                  </header>
                  <p className="m-0 text-[13px] leading-snug text-[#7F8C8D]">{t("banking.cash.accountableHint")}</p>
                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                    <div className={DATA_TABLE_VIEWPORT_CLASS}>
                      <table className={`${DATA_TABLE_CLASS} min-w-full`}>
                        <thead>
                          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("banking.cash.thEmployee")}</th>
                            <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("banking.cash.thAccount244")}</th>
                            <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("banking.cash.thBalance")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accountable.length === 0 ? (
                            <tr className={DATA_TABLE_TR_CLASS}>
                              <td className={DATA_TABLE_TD_CLASS} colSpan={3}>
                                {t("banking.cash.accountableEmpty")}
                              </td>
                            </tr>
                          ) : (
                            accountable.map((r) => (
                              <tr key={r.employee.id} className={DATA_TABLE_TR_CLASS}>
                                <td className={DATA_TABLE_TD_CLASS}>
                                  {r.employee.firstName} {r.employee.lastName}
                                </td>
                                <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{r.accountCode}</td>
                                <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                                  {r.balance} {r.currency}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {quickOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`} role="dialog" aria-modal="true">
              <header className="flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0 pr-2">
                  <h3 className="m-0 text-lg font-semibold leading-snug text-[#34495E]">
                    {t("banking.cash.quickCashOutTitle")}
                  </h3>
                  <p className="mb-0 mt-1 text-[13px] text-[#7F8C8D]">{t("banking.cash.quickCashOutHint")}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className={MODAL_CLOSE_BUTTON_CLASS}
                  onClick={() => setQuickOpen(false)}
                  aria-label={t("common.close")}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                </Button>
              </header>

              <form className="mt-4 flex min-h-0 flex-1 flex-col space-y-4" onSubmit={submitQuickCashOut}>
                <div className="grid grid-cols-2 gap-4">
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.outAmount")}
                    <NumericAmountInput
                      fieldVariant="modal"
                      className="mt-1 block w-full"
                      value={quickAmount}
                      onValueChange={setQuickAmount}
                      required
                    />
                  </label>
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.currency")}
                    <span className="mt-1 block">
                      <CurrencySelect value={quickCurrency} onValueChange={setQuickCurrency} />
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.outDate")}
                    <DatePicker
                      fieldVariant="modal"
                      className="mt-1 block w-full"
                      value={quickDate}
                      onChange={setQuickDate}
                      required
                    />
                  </label>
                  <div aria-hidden="true" className="min-h-0" />
                </div>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.cashFlowItem")}
                  <select
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={quickCfId}
                    onChange={(e) => setQuickCfId(e.target.value)}
                    required
                  >
                    {cashFlowItems.map((cf) => (
                      <option key={cf.id} value={cf.id}>
                        {cf.code} — {cf.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.outDesc")}
                  <input
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={quickPurpose}
                    onChange={(e) => setQuickPurpose(e.target.value)}
                    placeholder={t("banking.cash.outDescPh")}
                    required
                  />
                </label>
                <div className={MODAL_FOOTER_ACTIONS_CLASS}>
                  <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => setQuickOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} disabled={quickBusy}>
                    {quickBusy ? "…" : t("banking.cash.quickCashOutSubmit")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {advOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`} role="dialog" aria-modal="true">
              <header className="flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0 pr-2">
                  <h3 className="m-0 text-lg font-semibold leading-snug text-[#34495E]">{t("banking.cash.btnAdvanceTop")}</h3>
                  <p className="mb-0 mt-1 text-[13px] text-[#7F8C8D]">{t("banking.cash.advanceHint")}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className={MODAL_CLOSE_BUTTON_CLASS}
                  onClick={() => setAdvOpen(false)}
                  disabled={advSaving}
                  aria-label={t("common.close")}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                </Button>
              </header>

              <form className="mt-4 flex min-h-0 flex-1 flex-col space-y-4" onSubmit={submitAdvanceDraft}>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.advanceEmployee")}
                  <select
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={advEmployeeId}
                    onChange={(e) => setAdvEmployeeId(e.target.value)}
                    required
                  >
                    <option value="">—</option>
                    {(accountableOptions.length
                      ? accountableOptions
                      : employees.filter((e) => e.accountableAccountCode244?.trim())
                    ).map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.firstName} {em.lastName}
                        {em.accountableAccountCode244 ? ` · ${em.accountableAccountCode244}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.advanceReportDate")}
                  <DatePicker
                    fieldVariant="modal"
                    className="mt-1 block w-full"
                    value={advDate}
                    onChange={setAdvDate}
                    required
                  />
                </label>
                <p className="m-0 text-[13px] leading-snug text-[#7F8C8D]">{t("banking.cash.advanceCurrencyAznNote")}</p>
                <div className="flex flex-col gap-1.5">
                  <div className="text-[13px] font-semibold text-[#34495E]">{t("banking.cash.advanceLines")}</div>
                  {advLines.map((line, i) => (
                    <div key={i} className="mb-2 flex flex-wrap gap-2">
                      <NumericAmountInput
                        fieldVariant="modal"
                        className="max-w-[140px]"
                        placeholder={t("banking.cash.amount")}
                        value={line.amount}
                        onValueChange={(plain) => {
                          const next = [...advLines];
                          next[i] = { ...next[i], amount: plain };
                          setAdvLines(next);
                        }}
                      />
                      <input
                        className={`${MODAL_INPUT_CLASS} min-w-0 flex-1`}
                        placeholder={t("banking.cash.description")}
                        value={line.description}
                        onChange={(e) => {
                          const next = [...advLines];
                          next[i] = { ...next[i], description: e.target.value };
                          setAdvLines(next);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-[13px] font-medium text-[#2980B9] hover:underline"
                    onClick={() => setAdvLines([...advLines, { amount: "", description: "" }])}
                  >
                    {t("banking.cash.advanceAddLine")}
                  </button>
                </div>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.purpose")}
                  <input
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={advPurpose}
                    onChange={(e) => setAdvPurpose(e.target.value)}
                  />
                </label>
                <div className={`${MODAL_FOOTER_ACTIONS_CLASS} flex-wrap`}>
                  <Button
                    type="button"
                    variant="outline"
                    className={MODAL_FOOTER_BUTTON_CLASS}
                    onClick={() => setAdvOpen(false)}
                    disabled={advSaving}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS} disabled={advSaving}>
                    {t("banking.cash.advanceSubmitDraft")}
                  </Button>
                  {advDraftId ? (
                    <Button
                      type="button"
                      variant="primary"
                      className={MODAL_FOOTER_BUTTON_CLASS}
                      disabled={advSaving}
                      onClick={() => void postAdvance()}
                    >
                      {t("banking.cash.advancePost")}
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        )}

        {pkoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`} role="dialog" aria-modal="true">
              <header className="flex shrink-0 items-start justify-between gap-3">
                <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
                  {t("banking.cash.pkoTitle")}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  className={MODAL_CLOSE_BUTTON_CLASS}
                  onClick={() => setPkoOpen(false)}
                  aria-label={t("common.close")}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                </Button>
              </header>
              <form className="mt-4 flex min-h-0 flex-1 flex-col space-y-4" onSubmit={submitPko}>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.date")}
                  <DatePicker
                    fieldVariant="modal"
                    className="mt-1 block w-full"
                    value={pkoDate}
                    onChange={setPkoDate}
                    required
                  />
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.pkoSubtype")}
                  <span className="mt-1 block">
                    <Select value={pkoSubtype} onValueChange={(v) => setPkoSubtype(v as PkoSubtype)}>
                      <SelectTrigger className="" />
                      <SelectContent>
                        <SelectItem value="INCOME_FROM_CUSTOMER">
                          {t("banking.cash.subtypeIncomeCustomer")}
                        </SelectItem>
                        <SelectItem value="RETURN_FROM_ACCOUNTABLE">
                          {t("banking.cash.subtypeReturnAccountable")}
                        </SelectItem>
                        <SelectItem value="WITHDRAWAL_FROM_BANK">
                          {t("banking.cash.subtypeBankWithdrawal")}
                        </SelectItem>
                        <SelectItem value="OTHER">{t("banking.cash.subtypeOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.amount")}
                    <NumericAmountInput
                      fieldVariant="modal"
                      className="mt-1 block w-full"
                      value={pkoAmount}
                      onValueChange={setPkoAmount}
                      required
                    />
                  </label>
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.currency")}
                    <span className="mt-1 block">
                      <CurrencySelect value={pkoCurrency} onValueChange={setPkoCurrency} />
                    </span>
                  </label>
                </div>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.purpose")}
                  <input
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={pkoPurpose}
                    onChange={(e) => setPkoPurpose(e.target.value)}
                    required
                  />
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.cashAccount")}
                  <CashAccountSelect
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    currency={pkoCurrency}
                    catalog={cashCatalog}
                    value={pkoCash}
                    onChange={setPkoCash}
                  />
                </label>
                {(pkoSubtype === "OTHER" || pkoSubtype === "RETURN_FROM_ACCOUNTABLE") && (
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.offsetAccount")}
                    <input
                      className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                      value={pkoOffset}
                      onChange={(e) => setPkoOffset(e.target.value)}
                    />
                  </label>
                )}
                {pkoSubtype === "INCOME_FROM_CUSTOMER" && (
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.counterparty")}
                    <AsyncCombobox<CounterpartySearchRow>
                      className="mt-1 w-full"
                      value={pkoCpId}
                      onChange={(id, item) => {
                        setPkoCpId(id);
                        setPkoCpLabel(
                          item
                            ? `${item.name}${item.taxId ? ` (${String(item.taxId)})` : ""}`
                            : "",
                        );
                      }}
                      fetcher={fetchCashCounterpartiesIncoming}
                      getOptionLabel={(c) => `${c.name}${c.taxId ? ` (${String(c.taxId)})` : ""}`}
                      placeholder="—"
                      selectedLabel={pkoCpLabel}
                    />
                  </label>
                )}
                {pkoSubtype === "RETURN_FROM_ACCOUNTABLE" && (
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.employee")}
                    <select
                      className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                      value={pkoEmpId}
                      onChange={(e) => setPkoEmpId(e.target.value)}
                    >
                      <option value="">—</option>
                      {employees.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.cashFlowItem")}
                  <select
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={pkoCfId}
                    onChange={(e) => setPkoCfId(e.target.value)}
                    required
                  >
                    {cashFlowItems.map((cf) => (
                      <option key={cf.id} value={cf.id}>
                        {cf.code} — {cf.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.cashDeskOptional")}
                  <select
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={pkoDeskId}
                    onChange={(e) => setPkoDeskId(e.target.value)}
                  >
                    <option value="">—</option>
                    {cashDesks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.notes")}
                  <textarea
                    className={`mt-1 block w-full ${MODAL_TEXTAREA_CLASS}`}
                    value={pkoNotes}
                    onChange={(e) => setPkoNotes(e.target.value)}
                    rows={2}
                  />
                </label>
                <div className={MODAL_FOOTER_ACTIONS_CLASS}>
                  <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => setPkoOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS}>
                    {t("banking.cash.saveDraft")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {rkoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
              className={`${MODAL_DIALOG_CONTENT_CLASS} flex max-h-[min(90vh,52rem)] w-full max-w-lg flex-col`}
              role="dialog"
              aria-modal="true"
            >
              <header className="flex shrink-0 items-start justify-between gap-3">
                <h3 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold leading-snug text-[#34495E]">
                  {t("banking.cash.rkoTitle")}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  className={MODAL_CLOSE_BUTTON_CLASS}
                  onClick={() => setRkoOpen(false)}
                  aria-label={t("common.close")}
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden />
                </Button>
              </header>
              <form className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={submitRko}>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.date")}
                  <DatePicker
                    fieldVariant="modal"
                    className="mt-1 block w-full"
                    value={rkoDate}
                    onChange={setRkoDate}
                    required
                  />
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.rkoSubtype")}
                  <span className="mt-1 block">
                    <Select value={rkoSubtype} onValueChange={(v) => setRkoSubtype(v as RkoSubtype)}>
                      <SelectTrigger className="" />
                      <SelectContent>
                        <SelectItem value="SALARY">{t("banking.cash.subtypeSalary")}</SelectItem>
                        <SelectItem value="SUPPLIER_PAYMENT">{t("banking.cash.subtypeSupplier")}</SelectItem>
                        <SelectItem value="ACCOUNTABLE_ISSUE">
                          {t("banking.cash.subtypeAccountableIssue")}
                        </SelectItem>
                        <SelectItem value="BANK_DEPOSIT">{t("banking.cash.subtypeBankDeposit")}</SelectItem>
                        <SelectItem value="OTHER">{t("banking.cash.subtypeOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.amount")}
                    <NumericAmountInput
                      fieldVariant="modal"
                      className="mt-1 block w-full"
                      value={rkoAmount}
                      onValueChange={setRkoAmount}
                      required
                    />
                  </label>
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.currency")}
                    <span className="mt-1 block">
                      <CurrencySelect value={rkoCurrency} onValueChange={setRkoCurrency} />
                    </span>
                  </label>
                </div>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.withholdingTax")}
                  <NumericAmountInput
                    fieldVariant="modal"
                    className="mt-1 block w-full"
                    value={rkoWithholding}
                    onValueChange={setRkoWithholding}
                    placeholder="0"
                  />
                  <p className="mb-0 mt-1.5 text-[13px] text-[#7F8C8D]">{t("banking.cash.withholdingHint")}</p>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.purpose")}
                  <input
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={rkoPurpose}
                    onChange={(e) => setRkoPurpose(e.target.value)}
                    required
                  />
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.cashAccount")}
                  <CashAccountSelect
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    currency={rkoCurrency}
                    catalog={cashCatalog}
                    value={rkoCash}
                    onChange={setRkoCash}
                  />
                </label>
                {rkoSubtype === "OTHER" && (
                  <label className={MODAL_FIELD_LABEL_CLASS}>
                    {t("banking.cash.offsetAccount")}
                    <input
                      className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                      value={rkoOffset}
                      onChange={(e) => setRkoOffset(e.target.value)}
                    />
                  </label>
                )}
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.counterparty")}
                  <AsyncCombobox<CounterpartySearchRow>
                    className="mt-1 w-full"
                    value={rkoCpId}
                    onChange={(id, item) => {
                      setRkoCpId(id);
                      setRkoCpLabel(
                        item ? `${item.name}${item.taxId ? ` (${String(item.taxId)})` : ""}` : "",
                      );
                    }}
                    fetcher={fetchCashCounterpartiesOutgoing}
                    getOptionLabel={(c) => `${c.name}${c.taxId ? ` (${String(c.taxId)})` : ""}`}
                    placeholder="—"
                    selectedLabel={rkoCpLabel}
                    portaled
                  />
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.employee")}
                  <select
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={rkoEmpId}
                    onChange={(e) => setRkoEmpId(e.target.value)}
                  >
                    <option value="">—</option>
                    {employees.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.cashFlowItem")}
                  <select
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={rkoCfId}
                    onChange={(e) => setRkoCfId(e.target.value)}
                    required
                  >
                    {cashFlowItems.map((cf) => (
                      <option key={cf.id} value={cf.id}>
                        {cf.code} — {cf.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.cashDeskOptional")}
                  <select
                    className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
                    value={rkoDeskId}
                    onChange={(e) => setRkoDeskId(e.target.value)}
                  >
                    <option value="">—</option>
                    {cashDesks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={MODAL_FIELD_LABEL_CLASS}>
                  {t("banking.cash.notes")}
                  <textarea
                    className={`mt-1 block w-full ${MODAL_TEXTAREA_CLASS}`}
                    value={rkoNotes}
                    onChange={(e) => setRkoNotes(e.target.value)}
                    rows={2}
                  />
                </label>
                </div>
                <div className={MODAL_FOOTER_ACTIONS_CLASS}>
                  <Button type="button" variant="outline" className={MODAL_FOOTER_BUTTON_CLASS} onClick={() => setRkoOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" variant="primary" className={MODAL_FOOTER_BUTTON_CLASS}>
                    {t("banking.cash.saveDraft")}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        </section>
      </>
    </SubscriptionPaywall>
  );
}
