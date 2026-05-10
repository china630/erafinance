"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

const LINK_GROUPS: { groupKey: string; items: { href: string; labelKey: string }[] }[] = [
  {
    groupKey: "superAdmin.dataHubNavRuntime",
    items: [{ href: "/super-admin/data/system-config", labelKey: "superAdmin.dataHubSystemConfig" }],
  },
  {
    groupKey: "superAdmin.dataHubNavCatalogs",
    items: [
      { href: "/super-admin/data/currencies", labelKey: "superAdmin.dataHubCurrencies" },
      { href: "/super-admin/data/units-of-measure", labelKey: "superAdmin.dataHubUom" },
      { href: "/super-admin/data/tax-rates", labelKey: "superAdmin.dataHubTaxRates" },
      { href: "/super-admin/data/customs-tariffs", labelKey: "superAdmin.dataHubCustoms" },
    ],
  },
  {
    groupKey: "superAdmin.dataHubNavNas",
    items: [
      { href: "/super-admin/data/nas-chart", labelKey: "superAdmin.dataHubNasChart" },
      { href: "/super-admin/data/nas-templates", labelKey: "superAdmin.dataHubNasTemplates" },
    ],
  },
  {
    groupKey: "superAdmin.dataHubNavI18n",
    items: [{ href: "/super-admin/data/translations", labelKey: "superAdmin.dataHubTranslations" }],
  },
  {
    groupKey: "superAdmin.dataHubNavMdm",
    items: [
      { href: "/super-admin/data/mdm/companies", labelKey: "superAdmin.dataHubMdmCompanies" },
      { href: "/super-admin/data/mdm/counterparties", labelKey: "superAdmin.dataHubMdmCp" },
    ],
  },
  {
    groupKey: "superAdmin.dataHubNavReference",
    items: [{ href: "/super-admin/data/reference", labelKey: "superAdmin.dataHubReference" }],
  },
];

export function SuperAdminDataHubNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const activeClass = "bg-[#EBF5FB] text-[#2980B9] font-medium";
  const idleClass = "text-[#34495E] hover:bg-[#F4F6F7]";

  return (
    <nav className="w-full lg:w-56 shrink-0 space-y-5 border-b lg:border-b-0 lg:border-r border-[#E5E9EC] pb-4 lg:pb-0 lg:pr-4">
      <Link
        href="/super-admin/data"
        className={[
          "block rounded-lg px-3 py-2 text-[13px] font-semibold",
          pathname === "/super-admin/data" ? activeClass : idleClass,
        ].join(" ")}
      >
        {t("superAdmin.dataHubTitle")}
      </Link>
      {LINK_GROUPS.map((g) => (
        <div key={g.groupKey}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D] mb-2 px-1">
            {t(g.groupKey)}
          </p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const active =
                pathname === it.href || (it.href !== "/super-admin/data" && pathname.startsWith(it.href));
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={[
                      "block rounded-lg px-3 py-1.5 text-[13px]",
                      active ? activeClass : idleClass,
                    ].join(" ")}
                  >
                    {t(it.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
