"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/page-header";
import { CARD_CONTAINER_CLASS } from "../../../lib/design-system";

const SECTIONS: {
  titleKey: string;
  links: { href: string; labelKey: string }[];
}[] = [
  {
    titleKey: "superAdmin.dataHubNavRuntime",
    links: [{ href: "/super-admin/data/system-config", labelKey: "superAdmin.dataHubSystemConfig" }],
  },
  {
    titleKey: "superAdmin.dataHubNavCatalogs",
    links: [
      { href: "/super-admin/data/currencies", labelKey: "superAdmin.dataHubCurrencies" },
      { href: "/super-admin/data/units-of-measure", labelKey: "superAdmin.dataHubUom" },
      { href: "/super-admin/data/tax-rates", labelKey: "superAdmin.dataHubTaxRates" },
      { href: "/super-admin/data/customs-tariffs", labelKey: "superAdmin.dataHubCustoms" },
    ],
  },
  {
    titleKey: "superAdmin.dataHubNavNas",
    links: [
      { href: "/super-admin/data/nas-chart", labelKey: "superAdmin.dataHubNasChart" },
      { href: "/super-admin/data/nas-templates", labelKey: "superAdmin.dataHubNasTemplates" },
    ],
  },
  {
    titleKey: "superAdmin.dataHubNavI18n",
    links: [{ href: "/super-admin/data/translations", labelKey: "superAdmin.dataHubTranslations" }],
  },
  {
    titleKey: "superAdmin.dataHubNavMdm",
    links: [
      { href: "/super-admin/data/mdm/companies", labelKey: "superAdmin.dataHubMdmCompanies" },
      { href: "/super-admin/data/mdm/counterparties", labelKey: "superAdmin.dataHubMdmCp" },
    ],
  },
  {
    titleKey: "superAdmin.dataHubNavReference",
    links: [{ href: "/super-admin/data/reference", labelKey: "superAdmin.dataHubReference" }],
  },
];

export default function SuperAdminDataHubPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageHeader title={t("superAdmin.dataHubTitle")} subtitle={t("superAdmin.dataHubSubtitle")} />

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((sec) => (
          <div key={sec.titleKey} className={`${CARD_CONTAINER_CLASS} p-4 space-y-3`}>
            <h2 className="text-sm font-semibold text-[#34495E]">{t(sec.titleKey)}</h2>
            <ul className="space-y-2 text-[13px]">
              {sec.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[#2980B9] hover:underline">
                    {t(l.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
