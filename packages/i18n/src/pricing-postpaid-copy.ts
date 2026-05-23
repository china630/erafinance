/** Public /pricing storefront copy — separate module to avoid tree-shaking. */

export type PricingMatrixTierCopy = {
  id: "TIER_0" | "TIER_1" | "TIER_2" | "TIER_3";
  columnTitle: string;
  pricePrimary: string;
  priceSecondary?: string;
  priceStrikethrough?: string;
  ctaLabel: string;
  ctaVariant: "current" | "free" | "upgrade";
  checkoutTier?: "TIER_1" | "TIER_2" | "TIER_3";
};

export type PricingResourceRowCopy = {
  id: string;
  name: string;
  tier0: string;
  tier1: string;
  tier2: string;
  tier3: string;
};

export type PricingBundleCopy = {
  id: string;
  name: string;
  moduleLine: string;
  discountBadge: string;
  bullets: string[];
  ctaLabel: string;
};

export type PricingPremiumModuleCopy = {
  slug: string;
  name: string;
  priceLabel: string;
  bullets: string[];
};

export type PricingPostpaidCopy = {
  title: string;
  ctaRegister: string;
  ctaLogin: string;
  coreSuite: {
    trialPrice: string;
    trialBadge: string;
    postTrialPriceLine: string;
    body: string;
    bullets: string[];
  };
  bundlesSection: {
    title: string;
    bundles: PricingBundleCopy[];
  };
  limitsSection: {
    title: string;
    hint: string;
    metricColumnLabel: string;
    matrixTiers: PricingMatrixTierCopy[];
    resources: PricingResourceRowCopy[];
    postTrialNote: string;
  };
  premiumTitle: string;
  premiumHint: string;
  premiumLockedTitle: string;
  premiumUpgradeTierCta: string;
  premiumModules: PricingPremiumModuleCopy[];
};

const pricingHybridRu: PricingPostpaidCopy = {
  title: "ERA Finance: Гибкое и Прозрачное Ценообразование",
  ctaRegister: "Начать 3 месяца бесплатно",
  ctaLogin: "Войти",
  coreSuite: {
    trialPrice: "0 AZN",
    trialBadge: "Первые 3 месяца бесплатно",
    postTrialPriceLine: "29 AZN / мес (первые 3 месяца 0 AZN)",
    body:
      "Операционный контур ERA Core: NAS/MMUS и MHBS/IFRS, производство WIP (счёт 203), склад FIFO и HR/Payroll. На Tier 1–3 база включена в trial.",
    bullets: [
      "NAS/MMUS и MHBS/IFRS — двойная главная книга",
      "WIP Manufacturing · счёт 203",
      "Склад FIFO и движение запасов",
      "HR/Payroll и кадровый контур",
    ],
  },
  bundlesSection: {
    title: "Готовые Пакеты",
    bundles: [
      {
        id: "finance",
        name: "Финансовый пакет",
        moduleLine: "Core + Banking Pro + Kassa Pro",
        discountBadge: "15% СКИДКА",
        bullets: [
          "Прямой банк и выписки в ERP",
          "Касса и Z-отчёты без ручного ввода",
          "Единый контур MMUS/MHBS",
        ],
        ctaLabel: "Активировать пакет",
      },
      {
        id: "manufacturing",
        name: "Производственный пакет",
        moduleLine: "Core + Склад + Производство",
        discountBadge: "20% СКИДКА",
        bullets: [
          "FIFO и движение ТМЦ",
          "WIP 203 и выпуск партий",
          "Себестоимость и списание в NAS",
        ],
        ctaLabel: "Активировать пакет",
      },
    ],
  },
  limitsSection: {
    title: "Матрица лимитов ресурсов",
    hint: "Tier 0 — бесплатно навсегда; Tier 1–3 — 0 AZN первые 3 месяца. Календарь — Asia/Baku.",
    metricColumnLabel: "Ресурс",
    matrixTiers: [
      {
        id: "TIER_0",
        columnTitle: "Tier 0 · Starter",
        pricePrimary: "0 AZN",
        priceSecondary: "Всегда бесплатно",
        ctaLabel: "Текущий",
        ctaVariant: "current",
      },
      {
        id: "TIER_1",
        columnTitle: "Tier 1 · Growth",
        pricePrimary: "0 AZN / первые 3 мес.",
        priceStrikethrough: "49 AZN",
        priceSecondary: "/ месяц",
        ctaLabel: "Выбрать уровень",
        ctaVariant: "upgrade",
        checkoutTier: "TIER_1",
      },
      {
        id: "TIER_2",
        columnTitle: "Tier 2 · Scale",
        pricePrimary: "0 AZN / первые 3 мес.",
        priceStrikethrough: "129 AZN",
        priceSecondary: "/ месяц",
        ctaLabel: "Выбрать уровень",
        ctaVariant: "upgrade",
        checkoutTier: "TIER_2",
      },
      {
        id: "TIER_3",
        columnTitle: "Tier 3 · Enterprise",
        pricePrimary: "Кастомный",
        priceSecondary: "Индивидуальный тариф",
        ctaLabel: "Выбрать уровень",
        ctaVariant: "upgrade",
        checkoutTier: "TIER_3",
      },
    ],
    resources: [
      {
        id: "users",
        name: "Пользователи (seats)",
        tier0: "2",
        tier1: "5",
        tier2: "15",
        tier3: "50",
      },
      {
        id: "invoices",
        name: "Счета / мес. (Baku)",
        tier0: "20",
        tier1: "100",
        tier2: "500",
        tier3: "5000",
      },
      {
        id: "storage",
        name: "Хранилище (Disk)",
        tier0: "1 GB",
        tier1: "5 GB",
        tier2: "20 GB",
        tier3: "100 GB",
      },
      {
        id: "whatsapp",
        name: "WhatsApp / мес.",
        tier0: "20",
        tier1: "100",
        tier2: "500",
        tier3: "2000",
      },
      {
        id: "ocr",
        name: "AI-OCR страниц / мес.",
        tier0: "10",
        tier1: "50",
        tier2: "250",
        tier3: "1000",
      },
    ],
    postTrialNote:
      "Premium-модули — после коммерческого статуса (Tier 1+). Активация привязывает карту.",
  },
  premiumTitle: "Premium-модули",
  premiumHint: "Расширения уровня лендинга — прозрачная цена и возможности до активации",
  premiumLockedTitle: "Требуется коммерческий статус (TIER 1+)",
  premiumUpgradeTierCta: "Перейти на Tier 1+",
  premiumModules: [
    {
      slug: "tax_pro",
      name: "Tax Pro",
      priceLabel: "+39 AZN / мес.",
      bullets: [
        "Автосинхронизация e-Taxes и деклараций",
        "RPA-подача без ручного копирования",
        "Контроль лимитов НДС в реальном времени",
      ],
    },
    {
      slug: "trade_pro",
      name: "Trade Pro",
      priceLabel: "+49 AZN / мес.",
      bullets: [
        "BGD / e-customs с предзаполнением",
        "HS-коды и пошлины из справочника KM",
        "Проводки себестоимости и входного НДС",
      ],
    },
    {
      slug: "compliance_pro",
      name: "Compliance Pro · Audit Hub",
      priceLabel: "+59 AZN / мес.",
      bullets: [
        "AI Council of Elders — аудит рисков",
        "ƏMAS: трудовые договоры в 1 клик",
        "ERM-дашборд и журнал mitigation",
      ],
    },
  ],
};

const pricingHybridAz: PricingPostpaidCopy = {
  title: "ERA Finance: Çevik və Şəffaf Qiymətləndirmə",
  ctaRegister: "3 ay tam pulsuz başla",
  ctaLogin: "Daxil ol",
  coreSuite: {
    trialPrice: "0 AZN",
    trialBadge: "İlk 3 ay tam pulsuz",
    postTrialPriceLine: "29 AZN / ay (ilk 3 ay 0 AZN)",
    body:
      "ERA Core əməliyyat konturu: NSU/MMUS və MHBS/IFRS, 203 NAT, anbar FIFO və HR/Payroll. Tier 1–3-də trial ilə daxildir.",
    bullets: [
      "NSU/MMUS və MHBS/IFRS — ikiqat baş kitab",
      "NAT istehsalatı · 203 hesabı",
      "Anbar FIFO və ehtiyat hərəkəti",
      "HR/Payroll və kadr konturu",
    ],
  },
  bundlesSection: {
    title: "Hazır Paketlər",
    bundles: [
      {
        id: "finance",
        name: "Maliyyə Paketi",
        moduleLine: "Core + Banking Pro + Kassa Pro",
        discountBadge: "15% ENDİRİM",
        bullets: [
          "Birbaşa bank və çıxarışlar ERP-də",
          "Kassa və Z-hesabatlar avtomatik",
          "Vahid MMUS/MHBS konturu",
        ],
        ctaLabel: "Paketi aktivləşdir",
      },
      {
        id: "manufacturing",
        name: "İstehsalat Paketi",
        moduleLine: "Core + Anbar + İstehsalat",
        discountBadge: "20% ENDİRİM",
        bullets: [
          "FIFO və ehtiyat hərəkəti",
          "NAT 203 və partiya buraxılışı",
          "NSU-da maya dəyəri və silinmə",
        ],
        ctaLabel: "Paketi aktivləşdir",
      },
    ],
  },
  limitsSection: {
    title: "Resurs limitləri matrisi",
    hint: "Tier 0 — həmişə pulsuz; Tier 1–3 — ilk 3 ay 0 AZN. Təqvim — Asia/Baku.",
    metricColumnLabel: "Resurs",
    matrixTiers: [
      {
        id: "TIER_0",
        columnTitle: "Tier 0 · Starter",
        pricePrimary: "0 AZN",
        priceSecondary: "Həmişə pulsuz",
        ctaLabel: "Cari Tarif",
        ctaVariant: "current",
      },
      {
        id: "TIER_1",
        columnTitle: "Tier 1 · Growth",
        pricePrimary: "0 AZN / ilk 3 ay",
        priceStrikethrough: "49 AZN",
        priceSecondary: "/ ay",
        ctaLabel: "Bu səviyyəni seç",
        ctaVariant: "upgrade",
        checkoutTier: "TIER_1",
      },
      {
        id: "TIER_2",
        columnTitle: "Tier 2 · Scale",
        pricePrimary: "0 AZN / ilk 3 ay",
        priceStrikethrough: "129 AZN",
        priceSecondary: "/ ay",
        ctaLabel: "Bu səviyyəni seç",
        ctaVariant: "upgrade",
        checkoutTier: "TIER_2",
      },
      {
        id: "TIER_3",
        columnTitle: "Tier 3 · Enterprise",
        pricePrimary: "Fərdi",
        priceSecondary: "Fərdi tarif",
        ctaLabel: "Bu səviyyəni seç",
        ctaVariant: "upgrade",
        checkoutTier: "TIER_3",
      },
    ],
    resources: [
      {
        id: "users",
        name: "İstifadəçilər (oturacaq)",
        tier0: "2",
        tier1: "5",
        tier2: "15",
        tier3: "50",
      },
      {
        id: "invoices",
        name: "Hesablar / ay (Baku)",
        tier0: "20",
        tier1: "100",
        tier2: "500",
        tier3: "5000",
      },
      {
        id: "storage",
        name: "Sənəd yaddaşı (Disk)",
        tier0: "1 GB",
        tier1: "5 GB",
        tier2: "20 GB",
        tier3: "100 GB",
      },
      {
        id: "whatsapp",
        name: "WhatsApp / ay",
        tier0: "20",
        tier1: "100",
        tier2: "500",
        tier3: "2000",
      },
      {
        id: "ocr",
        name: "AI-OCR səhifə / ay",
        tier0: "10",
        tier1: "50",
        tier2: "250",
        tier3: "1000",
      },
    ],
    postTrialNote:
      "Premium modullar — kommersiya statusundan sonra (Tier 1+). Aktivasiya kartı bağlayır.",
  },
  premiumTitle: "Premium əlavə-modullar",
  premiumHint: "Landing tipli genişləndirmələr — qiymət və imkanlar aydın görünür",
  premiumLockedTitle: "Kommersiya statusu tələb olunur (TİER 1+)",
  premiumUpgradeTierCta: "Tier 1+ seçin",
  premiumModules: [
    {
      slug: "tax_pro",
      name: "Tax Pro",
      priceLabel: "+39 AZN / ay",
      bullets: [
        "e-Taxes avtosinxron və bəyannamələr",
        "RPA ilə əl ilə kopyalama olmadan",
        "ƏDV limitləri real vaxtda",
      ],
    },
    {
      slug: "trade_pro",
      name: "Trade Pro",
      priceLabel: "+49 AZN / ay",
      bullets: [
        "BGD / e-customs ön-doldurma",
        "KM tarif kitabından HS və rüsum",
        "Maya dəyəri və giriş ƏDV yazılışları",
      ],
    },
    {
      slug: "compliance_pro",
      name: "Compliance Pro · Audit Hub",
      priceLabel: "+59 AZN / ay",
      bullets: [
        "AI Ağsaqqallar Şurası — risk auditi",
        "ƏMAS: əmək müqavilələri 1 kliklə",
        "ERM paneli və mitigation jurnalı",
      ],
    },
  ],
};

export const pricingPostpaidCopyByLocale = {
  ru: pricingHybridRu,
  az: pricingHybridAz,
} as const satisfies Record<"ru" | "az", PricingPostpaidCopy>;

export function getPricingPostpaidCopy(locale: "ru" | "az"): PricingPostpaidCopy {
  if (locale === "ru") return pricingPostpaidCopyByLocale.ru;
  return pricingPostpaidCopyByLocale.az;
}

/** @deprecated Use PricingMatrixTierCopy */
export type PricingTierColumnCopy = PricingMatrixTierCopy;

/** @deprecated Use PricingResourceRowCopy */
export type PricingResourceLimitCopy = PricingResourceRowCopy;
