/** Fallback when DB / API has no landing_module_marketing rows (mirrors packages/database seed). */
export type LandingLocaleText = { az: string; ru: string };
export type LandingLocaleTasks = { az: string[]; ru: string[] };

export type LandingModuleMarketingItem = {
  moduleSlug: string;
  sortOrder: number;
  names: LandingLocaleText;
  descriptions: LandingLocaleText;
  tasks: LandingLocaleTasks;
};

export const LANDING_MODULE_MARKETING_DEFAULTS: LandingModuleMarketingItem[] = [
  {
    moduleSlug: "finance",
    sortOrder: 0,
    names: { az: "Maliyyə və uçot", ru: "Финансы и учёт" },
    descriptions: {
      az: "NAS kitabı, kassa, bank, satış və hesabatlar — bir platformada.",
      ru: "План счетов NAS, касса, банк, продажи и отчёты — в одной платформе.",
    },
    tasks: {
      az: [
        "Satış və alış sənədləri",
        "Kassa və bank əməliyyatları",
        "Debitor/kreditor və P&L",
        "Aylıq bağlanış",
      ],
      ru: [
        "Счета и акты продаж/закупок",
        "Касса и банковские операции",
        "Дебиторка/кредиторка и P&L",
        "Закрытие месяца",
      ],
    },
  },
  {
    moduleSlug: "manufacturing_wip",
    sortOrder: 1,
    names: { az: "İstehsalat (WIP)", ru: "Производство (WIP)" },
    descriptions: {
      az: "BOM, istehsalat sifarişləri və WIP hesabları (203/201/204).",
      ru: "Спецификации, производственные заказы и WIP-счета (203/201/204).",
    },
    tasks: {
      az: [
        "Reseptlər (BOM)",
        "Sifariş: başlat → tamamla",
        "Material xərcləri və buraxılış",
        "Anbar inteqrasiyası",
      ],
      ru: [
        "Рецепты (BOM)",
        "Заказ: старт → завершение",
        "Списание материалов и выпуск",
        "Интеграция со складом",
      ],
    },
  },
  {
    moduleSlug: "fixed_assets",
    sortOrder: 2,
    names: { az: "Əsas vəsaitlər", ru: "Основные средства" },
    descriptions: {
      az: "Amortizasiya: xətti, azalan qalıq və istehsal həcminə görə.",
      ru: "Амортизация: линейная, убывающий остаток и по объёму выработки.",
    },
    tasks: {
      az: [
        "ƏV reyestri",
        "Aylıq amortizasiya",
        "UoP aylıq istehsal uçotu",
        "Dr 713 / Cr 112 keçidləri",
      ],
      ru: [
        "Реестр ОС",
        "Месячное начисление",
        "UoP — ввод выработки за месяц",
        "Проводки Дт 713 / Кт 112",
      ],
    },
  },
  {
    moduleSlug: "industry_solutions",
    sortOrder: 3,
    names: { az: "Sənaye həlləri", ru: "Отраслевые решения" },
    descriptions: {
      az: "Pərakəndə, logistika, tikinti və CRM — beta giriş.",
      ru: "Ритейл, логистика, строительство и CRM — beta-доступ.",
    },
    tasks: {
      az: [
        "Modul entitlement ilə açılır",
        "Painted-door beta",
        "Super-Admin idarəetməsi",
        "Roadmap: dərin vertikallar",
      ],
      ru: [
        "Открытие по entitlement",
        "Painted-door beta",
        "Управление в Super-Admin",
        "Roadmap: полноценные вертикали",
      ],
    },
  },
];
