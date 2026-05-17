"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BillingProvider } from "./billing-context";
import { SECONDARY_BUTTON_CLASS } from "../../../lib/design-system";

const BILLING_TABS = [
  { href: "/super-admin/billing/pricing", key: "superAdmin.billingTabPricing" },
  { href: "/super-admin/billing/quotas", key: "superAdmin.billingTabQuotas" },
  { href: "/super-admin/billing/packages", key: "superAdmin.billingTabBundles" },
] as const;

export default function SuperAdminBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <BillingProvider>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#34495E]">
              {t("superAdmin.billingSectionTitle")}
            </h1>
            <p className="text-[13px] text-[#7F8C8D]">
              {t("superAdmin.billingSectionHint")}
            </p>
          </div>
          <Link
            href="/super-admin"
            className={`${SECONDARY_BUTTON_CLASS} w-fit shrink-0`}
          >
            {t("superAdmin.billingBackToSuperAdmin")}
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {BILLING_TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "rounded-lg px-3 py-2 text-[13px] font-medium transition",
                  active
                    ? "bg-[#2980B9] text-white shadow-sm ring-2 ring-[#2980B9] ring-offset-1"
                    : "border border-[#D5DADF] bg-white text-[#34495E] hover:bg-[#F8F9FA]",
                ].join(" ")}
              >
                {t(tab.key)}
              </Link>
            );
          })}
        </div>

        <div className="min-h-[12rem]">{children}</div>
      </div>
    </BillingProvider>
  );
}
