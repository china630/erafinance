"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../empty-state";
import { useAuth } from "../../lib/auth-context";

export function SuperAdminDataGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { ready, token, user } = useAuth();

  if (!ready) {
    return <p className="text-[#7F8C8D] text-sm py-8">{t("common.loading")}</p>;
  }
  if (!token || !user?.isSuperAdmin) {
    return (
      <EmptyState
        title={t("superAdminTranslations.denied")}
        description={t("superAdminTranslations.deniedHint")}
      />
    );
  }

  return (
    <>
      <p className="text-[13px] mb-4">
        <Link href="/super-admin" className="text-[#2980B9] underline">
          {t("superAdmin.dataHubBack")}
        </Link>
      </p>
      {children}
    </>
  );
}
