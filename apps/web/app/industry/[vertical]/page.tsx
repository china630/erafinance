"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useEarlyAccess } from "../../../components/early-access/early-access-context";
import { EARLY_ACCESS_MODULES } from "../../../components/early-access/modules.config";
import { PageHeader } from "../../../components/layout/page-header";
import {
  CARD_CONTAINER_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import {
  hasIndustryModuleAccess,
  industryItemByVertical,
} from "../../../lib/industry-modules";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";

export default function IndustryVerticalPage() {
  const { vertical } = useParams<{ vertical: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { effectiveSnapshot: snapshot } = useSubscription();
  const { open: openEarlyAccess } = useEarlyAccess();
  const item = industryItemByVertical(String(vertical ?? ""));

  useEffect(() => {
    if (!ready || !token || !item) return;
    if (!hasIndustryModuleAccess(snapshot, item.key)) {
      openEarlyAccess(item.key);
      router.replace("/");
    }
  }, [ready, token, item, snapshot, openEarlyAccess, router]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;
  if (!item) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{t("industry.unknownVertical")}</p>
        <Link href="/home" className={SECONDARY_BUTTON_CLASS}>
          {t("nav.home")}
        </Link>
      </div>
    );
  }

  const mod = EARLY_ACCESS_MODULES[item.key];
  const Icon = mod.icon;
  const entitled = hasIndustryModuleAccess(snapshot, item.key);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(item.labelKey)}
        subtitle={t("industry.shellSubtitle")}
        actions={
          <Link href="/home" className={SECONDARY_BUTTON_CLASS}>
            ← {t("nav.home")}
          </Link>
        }
      />
      <section className={`${CARD_CONTAINER_CLASS} p-8 text-center`}>
        <Icon className="mx-auto h-12 w-12 text-[#2980B9]" aria-hidden />
        <p className="mt-4 text-[13px] text-[#7F8C8D]">{t("industry.betaNotice")}</p>
        {entitled ? (
          <p className="mt-2 text-sm font-medium text-[#34495E]">
            {t("industry.entitledHint")}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#7F8C8D]">{t("industry.waitlistHint")}</p>
        )}
      </section>
    </div>
  );
}
