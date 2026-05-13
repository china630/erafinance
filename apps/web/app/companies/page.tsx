"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";
import {
  CARD_CONTAINER_CLASS,
  GHOST_BUTTON_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";
import { useRequireAuth } from "../../lib/use-require-auth";
import { VoenRequestModal } from "../../components/companies/voen-request-modal";
import { CreateCompanyModal } from "../../components/companies/create-company-modal";
import { CreateHoldingModal } from "../../components/holding/create-holding-modal";
import { PageHeader } from "../../components/layout/page-header";
import { CompanyCard, type CompanyCardItem } from "../../components/companies/company-card";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../components/ui/select";
import { Dialog, DialogContent, DialogHeader } from "@erafinance/ui";
import { X } from "lucide-react";

type OrganizationsTree = {
  holdings: Array<{
    holdingId: string;
    holdingName: string;
    baseCurrency: string;
    organizations: Array<{
      id: string;
      name: string;
      taxId: string;
      currency: string;
    }>;
  }>;
  freeOrganizations: Array<{
    id: string;
    name: string;
    taxId: string;
    currency: string;
  }>;
};

type HoldingListItem = {
  id: string;
  name: string;
};

export default function CompaniesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { ready, token } = useRequireAuth();
  const { user, organizations, switchOrganization } = useAuth();

  const [voenModalOpen, setVoenModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createHoldingOpen, setCreateHoldingOpen] = useState(false);

  const [tree, setTree] = useState<OrganizationsTree | null>(null);
  const [holdings, setHoldings] = useState<HoldingListItem[]>([]);
  const [holdingUiErr, setHoldingUiErr] = useState<string | null>(null);
  const [holdingBusyOrgId, setHoldingBusyOrgId] = useState<string | null>(null);
  const [attachDialogOrg, setAttachDialogOrg] = useState<CompanyCardItem | null>(null);
  const [attachHoldingId, setAttachHoldingId] = useState("");

  const loadHoldingUi = useCallback(async () => {
    setHoldingUiErr(null);
    const [treeRes, holdingsRes] = await Promise.all([
      apiFetch("/api/organizations/tree"),
      apiFetch("/api/holdings"),
    ]);
    if (!treeRes.ok) {
      setHoldingUiErr(`${t("common.loadErr")}: ${treeRes.status}`);
      setTree(null);
      return;
    }
    setTree((await treeRes.json()) as OrganizationsTree);
    if (holdingsRes.ok) {
      setHoldings((await holdingsRes.json()) as HoldingListItem[]);
    } else {
      setHoldings([]);
    }
  }, [t]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadHoldingUi();
  }, [ready, token, loadHoldingUi]);

  const orgRoleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of organizations) {
      m.set(o.id, o.role);
    }
    return m;
  }, [organizations]);

  const holdingSections = useMemo(
    () =>
      (tree?.holdings ?? []).map((h) => ({
        id: h.holdingId,
        name: h.holdingName,
        organizations: h.organizations.map((o) => ({
          ...o,
          role: orgRoleById.get(o.id) ?? "",
          holdingId: h.holdingId,
          isCurrent: o.id === user?.organizationId,
        })),
      })),
    [tree, orgRoleById, user?.organizationId],
  );

  const freeOrganizations = useMemo(
    () =>
      (tree?.freeOrganizations ?? []).map((o) => ({
        ...o,
        role: orgRoleById.get(o.id) ?? "",
        holdingId: null,
        isCurrent: o.id === user?.organizationId,
      })),
    [tree, orgRoleById, user?.organizationId],
  );

  const roleVariant = useCallback(
    (role: string): "neutral" | "owner" | "admin" | "accountant" | "user" => {
      if (role === "OWNER") return "owner";
      if (role === "ADMIN") return "admin";
      if (role === "ACCOUNTANT") return "accountant";
      if (role === "USER") return "user";
      return "neutral";
    },
    [],
  );

  const roleLabel = useCallback(
    (role: string) =>
      t(`common.role${role}` as never, {
        defaultValue: role,
      }),
    [t],
  );

  const isOwnerOnly = useCallback(
    (orgId: string) => {
      const r = orgRoleById.get(orgId) ?? "";
      return r === "OWNER";
    },
    [orgRoleById],
  );

  async function attachToHolding(organizationId: string, holdingId: string) {
    const safeHoldingId = holdingId.trim();
    if (!safeHoldingId) return;
    setHoldingBusyOrgId(organizationId);
    setHoldingUiErr(null);
    try {
      const res = await apiFetch(
        `/api/holdings/${encodeURIComponent(safeHoldingId)}/organizations/${encodeURIComponent(organizationId)}`,
        { method: "POST" },
      );
      if (!res.ok) {
        setHoldingUiErr(await res.text());
        return;
      }
      await loadHoldingUi();
    } finally {
      setHoldingBusyOrgId(null);
    }
  }

  async function detachFromHolding(holdingId: string, organizationId: string) {
    setHoldingBusyOrgId(organizationId);
    setHoldingUiErr(null);
    try {
      const res = await apiFetch(
        `/api/holdings/${encodeURIComponent(holdingId)}/organizations/${encodeURIComponent(organizationId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setHoldingUiErr(await res.text());
        return;
      }
      await loadHoldingUi();
    } finally {
      setHoldingBusyOrgId(null);
    }
  }

  if (!ready || !token) {
    return (
      <div className="text-sm text-gray-500">{t("common.loading")}</div>
    );
  }

  async function openOrg(o: { id: string }) {
    if (o.id === user?.organizationId) {
      router.push("/");
      return;
    }
    try {
      await switchOrganization(o.id);
      router.push("/");
    } catch {
      // toast is global; keep page minimal
    }
  }

  async function openCompanySettings(org: CompanyCardItem) {
    if (org.id !== user?.organizationId) {
      await openOrg(org);
    }
    router.push("/settings/organization");
  }

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader
        title={t("companiesPage.workspaceTitle")}
        subtitle={t("companiesPage.subtitle")}
        actions={
          <>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => setCreateModalOpen(true)}
              aria-label={t("companiesPage.addCompanyAria")}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("companiesPage.modals.createCompanyTitle")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setCreateHoldingOpen(true)}
            >
              <Building2 className="h-4 w-4" aria-hidden />
              {t("holdingCreate.openBtn")}
            </button>
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              onClick={() => setVoenModalOpen(true)}
            >
              <Send className="h-4 w-4" aria-hidden />
              {t("companiesPage.joinTitle")}
            </button>
          </>
        }
      />

      {holdingUiErr ? (
        <div className={`${CARD_CONTAINER_CLASS} p-3 text-sm text-red-600`}>
          {holdingUiErr}
        </div>
      ) : null}

      <div className="space-y-7">
        {holdingSections.map((holding) => (
          <section key={holding.id} className={`${CARD_CONTAINER_CLASS} space-y-4 p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-[#34495E]">
                <Building2 className="h-4 w-4" aria-hidden />
                {holding.name}
              </h2>
              <Link
                href={`/holding?id=${encodeURIComponent(holding.id)}`}
                className={GHOST_BUTTON_CLASS}
              >
                {t("companiesPage.holdingSettings")}
              </Link>
            </div>
            {holding.organizations.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("companiesPage.holdingNoCompanies")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {holding.organizations.map((company) => (
                  <CompanyCard
                    key={company.id}
                    company={company}
                    roleLabel={roleLabel}
                    roleVariant={roleVariant}
                    settingsLabel={t("companiesPage.cardSettings")}
                    attachLabel={t("companiesPage.cardAttach")}
                    detachLabel={t("companiesPage.cardDetach")}
                    workspaceLabel={t("companiesPage.workspaceLabel")}
                    currentWorkspaceLabel={t("companiesPage.currentWorkspaceLabel")}
                    canManageHolding={isOwnerOnly(company.id)}
                    canDetachFromHolding={isOwnerOnly(company.id)}
                    onOpen={() => void openOrg(company)}
                    onOpenSettings={() => void openCompanySettings(company)}
                    onAttachHolding={() => {
                      setAttachDialogOrg(company);
                      setAttachHoldingId("");
                    }}
                    onDetachHolding={() => {
                      if (company.holdingId) {
                        void detachFromHolding(company.holdingId, company.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        ))}

        <section className={`${CARD_CONTAINER_CLASS} space-y-4 p-5`}>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" aria-hidden />
            <h2 className="text-lg font-semibold text-[#34495E]">
              {t("companiesPage.freeSectionTitle")}
            </h2>
          </div>
          {freeOrganizations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("companiesPage.freeNone")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {freeOrganizations.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  roleLabel={roleLabel}
                  roleVariant={roleVariant}
                  settingsLabel={t("companiesPage.cardSettings")}
                  attachLabel={t("companiesPage.cardAttach")}
                  detachLabel={t("companiesPage.cardDetach")}
                  workspaceLabel={t("companiesPage.workspaceLabel")}
                  currentWorkspaceLabel={t("companiesPage.currentWorkspaceLabel")}
                  canManageHolding={isOwnerOnly(company.id)}
                  canDetachFromHolding={false}
                  onOpen={() => void openOrg(company)}
                  onOpenSettings={() => void openCompanySettings(company)}
                  onAttachHolding={() => {
                    setAttachDialogOrg(company);
                    setAttachHoldingId("");
                  }}
                  onDetachHolding={() => void 0}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <VoenRequestModal open={voenModalOpen} onClose={() => setVoenModalOpen(false)} />
      <CreateCompanyModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      <CreateHoldingModal
        open={createHoldingOpen}
        onClose={() => setCreateHoldingOpen(false)}
        onCreated={() => {
          void loadHoldingUi();
        }}
      />
      {attachDialogOrg ? (
        <Dialog open={Boolean(attachDialogOrg)} onOpenChange={(next) => (!next ? setAttachDialogOrg(null) : undefined)}>
          <DialogContent className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
            <DialogHeader>
              <div>
                <h3 className="text-lg font-semibold text-[#34495E]">
                  {t("companiesPage.attachDialogTitle")}
                </h3>
                <p className="mt-1 text-[13px] text-[#7F8C8D]">{attachDialogOrg.name}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setAttachDialogOrg(null)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <label className={MODAL_FIELD_LABEL_CLASS}>
                {t("companiesPage.chooseHolding")}
                <div className="mt-1">
                  <Select value={attachHoldingId} onValueChange={setAttachHoldingId}>
                    <SelectTrigger className={`w-full ${MODAL_INPUT_CLASS}`} />
                    <SelectContent>
                      <SelectItem value="">{t("companiesPage.chooseHolding")}</SelectItem>
                      {holdings.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </label>
            </div>
            <div className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="outline"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => setAttachDialogOrg(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={!attachHoldingId || holdingBusyOrgId === attachDialogOrg.id}
                onClick={async () => {
                  await attachToHolding(attachDialogOrg.id, attachHoldingId);
                  setAttachDialogOrg(null);
                  setAttachHoldingId("");
                }}
              >
                {holdingBusyOrgId === attachDialogOrg.id
                  ? t("common.loading")
                  : t("companiesPage.holdingAttach")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
