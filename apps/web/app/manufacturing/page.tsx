"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../components/layout/page-header";
import { ManufacturingDashboardWidgets } from "../../components/manufacturing/manufacturing-dashboard-widgets";
import { useRequireAuth } from "../../lib/use-require-auth";
import { SubscriptionPaywall } from "../../components/subscription-paywall";
import { SECONDARY_BUTTON_CLASS } from "../../lib/design-system";

function ManufacturingHubContent() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.manufacturing")}
        subtitle={t("manufacturing.hubLead")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/manufacturing/recipes" className={SECONDARY_BUTTON_CLASS}>
              {t("nav.manufacturingRecipes")}
            </Link>
            <Link href="/manufacturing/releases" className={SECONDARY_BUTTON_CLASS}>
              {t("nav.manufacturingRelease")}
            </Link>
            <Link href="/manufacturing/orders" className={SECONDARY_BUTTON_CLASS}>
              {t("nav.manufacturingOrders")}
            </Link>
            <Link href="/manufacturing/overhead" className={SECONDARY_BUTTON_CLASS}>
              {t("nav.manufacturingOverhead")}
            </Link>
          </div>
        }
      />
      <ManufacturingDashboardWidgets />
    </div>
  );
}

export default function ManufacturingPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;
  return (
    <SubscriptionPaywall module="manufacturing">
      <ManufacturingHubContent />
    </SubscriptionPaywall>
  );
}
