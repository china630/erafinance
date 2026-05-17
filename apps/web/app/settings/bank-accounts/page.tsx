"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import { DirectBankingPanel } from "../../../components/settings/direct-banking-panel";
import { apiFetch } from "../../../lib/api-client";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
} from "../../../lib/design-system";
import { OrganizationBankAccountModal } from "../../../components/settings/organization-bank-account-modal";
import { useSubscription } from "../../../lib/subscription-context";

type AccountType = "MAIN" | "SALARY" | "CARD" | "TENDER" | "CREDIT" | "VAT_DEPOSIT";

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

type DirectSnapshot = {
  syncActive: boolean;
  syncMode: "mock" | "rest";
};

export default function BankAccountsSettingsPage() {
  const { t } = useTranslation();
  const { ready: subscriptionReady, effectiveSnapshot } = useSubscription();
  const bankingPro = effectiveSnapshot?.modules.bankingPro ?? false;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [directInfo, setDirectInfo] = useState<DirectSnapshot | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/banking/bank-accounts");
      if (!res.ok) {
        toast.error(t("common.loadErr"), { description: String(res.status) });
        return;
      }
      const data = (await res.json()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  const loadDirect = useCallback(async () => {
    if (!bankingPro) {
      setDirectInfo(null);
      return;
    }
    const res = await apiFetch("/api/banking/direct-settings");
    if (!res.ok) {
      setDirectInfo(null);
      return;
    }
    const data = (await res.json()) as DirectSnapshot;
    setDirectInfo({
      syncActive: Boolean(data.syncActive),
      syncMode: data.syncMode === "rest" ? "rest" : "mock",
    });
  }, [bankingPro]);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadDirect();
  }, [loadDirect]);

  const subtitle = useMemo(() => t("bankAccountsRegistry.subtitle"), [t]);

  function directSyncHint(r: Row): string {
    if (!bankingPro) return "—";
    if (!directInfo) return "…";
    if (directInfo.syncMode === "mock" || !directInfo.syncActive) {
      return t("bankAccountsRegistry.directSyncInactive");
    }
    if (r.isPrimary) {
      return t("bankAccountsRegistry.directSyncAnchor");
    }
    return t("bankAccountsRegistry.directSyncIndirect");
  }

  async function removeRow(id: string) {
    if (!window.confirm(t("bankAccountsRegistry.deleteConfirm"))) return;
    const res = await apiFetch(`/api/banking/bank-accounts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(t("common.deleteErr"), { description: String(res.status) });
      return;
    }
    toast.success(t("common.delete"));
    await load();
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={t("bankAccountsRegistry.title")}
        subtitle={subtitle}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            {t("bankAccountsRegistry.add")}
          </Button>
        }
      />

      {subscriptionReady && effectiveSnapshot ? (
        <DirectBankingPanel snapshot={effectiveSnapshot} />
      ) : null}

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("bankAccountsRegistry.columns.bank")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("bankAccountsRegistry.columns.iban")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("bankAccountsRegistry.columns.currency")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("bankAccountsRegistry.columns.accountType")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("bankAccountsRegistry.columns.ledger")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("bankAccountsRegistry.columns.status")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>
                {t("bankAccountsRegistry.columns.directSync")}
              </th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>{r.bankName}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>{r.iban}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>{r.currency}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>
                  {t(`bankAccountsRegistry.type.${r.accountType}`)}
                </td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>{r.ledgerAccountCode}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>
                  <div className="flex items-center gap-2">
                    {r.isPrimary ? <span>{t("bankAccountsRegistry.primary")}</span> : null}
                    {r.isFrozen ? (
                      <span className="rounded-full border border-[#FECACA] bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#B42318]">
                        {t("bankAccountsRegistry.frozenBadge")}
                      </span>
                    ) : null}
                    {!r.isPrimary && !r.isFrozen ? "-" : null}
                  </div>
                </td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>{directSyncHint(r)}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`}>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => {
                        setEditing(r);
                        setModalOpen(true);
                      }}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs text-[#B42318]"
                      onClick={() => void removeRow(r.id)}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className={`${DATA_TABLE_TD_CLASS} text-[13px]`} colSpan={8}>
                  {t("bankAccountsRegistry.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <OrganizationBankAccountModal
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void load();
        }}
      />
    </div>
  );
}
