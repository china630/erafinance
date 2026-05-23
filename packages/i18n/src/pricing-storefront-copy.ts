/**
 * Localized chrome for /pricing storefront (module prices come from API).
 */

export type PricingStorefrontUiCopy = {
  heroTitle: string;
  heroSubtitle: string;
  ctaRegister: string;
  ctaLogin: string;
  coreSuiteTitle: string;
  coreSuiteIntro: string;
  foundationTitle: string;
  foundationDescription: string;
  trialPromoText: string;
  trialPromoButton: string;
  coreTrialBadge: string;
  coreTrialPriceLabel: string;
  corePostTrialTemplate: string;
  standardModulesTitle: string;
  standardModulesHint: string;
  bundlesTitle: string;
  bundlesHint: string;
  bundleCta: string;
  bundleDiscountSuffix: string;
  bundlePopularBadge: string;
  bundleSavingsLabel: string;
  pricePerMonthSuffix: string;
  matrixTitle: string;
  matrixHint: string;
  spendTierMatrixHint: string;
  matrixMetricLabel: string;
  tierSpendCeilingTemplate: string;
  tierSpendCeilingStarter: string;
  trialMeterMayBillLine: string;
  tierCurrentLabel: string;
  tierSelectLabel: string;
  tierFreeForever: string;
  tierCustom: string;
  tierPerMonth: string;
  tierTrialLine: string;
  resourceUsers: string;
  resourceInvoices: string;
  resourceStorage: string;
  resourceWhatsapp: string;
  resourceOcr: string;
  resourceWorkspaces: string;
  premiumTitle: string;
  premiumHint: string;
  premiumLockedTitle: string;
  premiumUpgradeCta: string;
  calculatorDueTodayLabel: string;
  calculatorPostpaidLabel: string;
  calculatorBakuNotice: string;
  standardModules: Record<string, { name: string; subtitle: string; bullets: string[] }>;
  premiumFeatures: Record<string, { description: string; bullets: string[] }>;
  bundles: Record<string, { name: string; moduleLine: string }>;
};

const uiRu: PricingStorefrontUiCopy = {
  heroTitle: "ERA Finance: Гибкое и Прозрачное Ценообразование",
  heroSubtitle:
    "Новая финансовая платформа для бизнеса Азербайджана. Полное соответствие стандартам MMUS и MHBS.",
  ctaRegister: "Начать 3 месяца бесплатно",
  ctaLogin: "Войти",
  coreSuiteTitle: "ERA Core",
  coreSuiteIntro:
    "Базовая платформа и стандартные модули — единый контур учёта для бизнеса в Азербайджане.",
  foundationTitle: "ERA Core (Foundation)",
  foundationDescription:
    "Учёт, проводки, закрытие периода и соответствие MMUS/MHBS.",
  trialPromoText:
    "Зарегистрируйтесь сейчас и пользуйтесь всеми модулями ERA Core бесплатно в течение 3 месяцев.",
  trialPromoButton: "Начать бесплатно — 3 месяца",
  coreTrialBadge: "Первые 3 месяца бесплатно",
  coreTrialPriceLabel: "0 AZN",
  corePostTrialTemplate: "{{price}} / мес после trial (первые 3 месяца 0 AZN)",
  standardModulesTitle: "Стандартные модули ERA Core",
  standardModulesHint:
    "Входят в подписку Core или подключаются пакетами ниже — без отдельной à la carte-витрины.",
  bundlesTitle: "Готовые пакеты",
  bundlesHint:
    "Стандартные модули со скидкой — готовые наборы под типовой сценарий бизнеса.",
  bundleCta: "Активировать пакет",
  bundleDiscountSuffix: "скидка",
  bundlePopularBadge: "Популярный",
  bundleSavingsLabel: "Экономия",
  pricePerMonthSuffix: "/ мес.",
  matrixTitle: "Unit-цены и потолки расхода (spend tier)",
  matrixHint:
    "Оплата по факту использования; потолок tier — лимит накопленного расхода за месяц (Baku).",
  spendTierMatrixHint:
    "3 месяца: ERA Core (Foundation) = 0 AZN; metered-расход начисляется. При достижении потолка tier — счёт в тот же день; иначе — 1-го числа за прошлый месяц.",
  trialMeterMayBillLine:
    "Metered-услуги (счета, OCR, WhatsApp, GB) могут выставляться в trial по unit-ценам.",
  tierSpendCeilingTemplate: "до {{amount}} / мес.",
  tierSpendCeilingStarter: "старт 0 AZN",
  matrixMetricLabel: "Ресурс",
  tierCurrentLabel: "Текущий",
  tierSelectLabel: "Выбрать уровень",
  tierFreeForever: "Всегда бесплатно",
  tierCustom: "Кастомный",
  tierPerMonth: "/ месяц",
  tierTrialLine: "0 AZN / первые 3 мес.",
  resourceUsers: "Пользователи (seats)",
  resourceInvoices: "Счета / мес. (Baku)",
  resourceStorage: "Хранилище (Disk)",
  resourceWhatsapp: "WhatsApp / мес.",
  resourceOcr: "AI-OCR страниц / мес.",
  resourceWorkspaces: "Рабочие пространства",
  premiumTitle: "Premium-модули",
  premiumHint:
    "Расширения для налогов, таможни, compliance и внешнего аудита — подключаются поверх Core.",
  premiumLockedTitle: "Требуется коммерческий статус (TIER 1+)",
  premiumUpgradeCta: "Перейти на Tier 1+",
  calculatorDueTodayLabel:
    "Сумма к оплате сегодня (входит в 3-месячный trial): {{amount}}",
  calculatorPostpaidLabel:
    "Плата за лимиты и premium-модули (постоплата в следующем месяце): {{amount}}",
  calculatorBakuNotice:
    "Все расчеты лимитов и закрытие биллингового периода выполняются 1-го числа календарного месяца строго по времени Баку (Asia/Baku).",
  standardModules: {
    core_accounting: {
      name: "Главная бухгалтерия",
      subtitle: "Базовый учёт, проводки и закрытие периода по MMUS/MHBS",
      bullets: ["NAS / MMUS", "MHBS / IFRS", "Проводки и GL", "Закрытие периода"],
    },
    cash_bank: {
      name: "Касса и банк",
      subtitle: "Касса, POS и банк в одном платёжном контуре",
      bullets: ["Касса и POS", "Банковские выписки", "Платежи и поручения", "Сверка остатков"],
    },
    supply_sales: {
      name: "Снабжение, сбыт и склад",
      subtitle: "Закупки, продажи и складской учёт",
      bullets: ["Закупки и продажи", "FIFO и остатки", "Инвентаризация", "Себестоимость отгрузки"],
    },
    manufacturing_wip: {
      name: "Производство и НЗП",
      subtitle: "Выпуск, рецепты и учёт незавершённого производства",
      bullets: ["WIP 203", "Рецепты и спецификации", "Выпуск продукции", "Себестоимость"],
    },
    fixed_assets: {
      name: "Основные средства",
      subtitle: "Капвложения, амортизация и реестр ОС",
      bullets: ["Принятие к учёту", "Амортизация", "Перемещения и выбытие", "Реестр ОС"],
    },
    hr_payroll: {
      name: "Кадры и зарплаты",
      subtitle: "Штат, табель и расчёт зарплаты",
      bullets: ["Штатное расписание", "Табель", "Начисления", "Ведомости и выплаты"],
    },
  },
  premiumFeatures: {
    tax_pro: {
      description: "Налоги и e-Taxes без ручного копирования.",
      bullets: [
        "Автосинхронизация e-Taxes и деклараций",
        "RPA-подача без ручного копирования",
        "Контроль лимитов НДС в реальном времени",
      ],
    },
    trade_pro: {
      description: "Таможня BGD и Trade Pro для импорта.",
      bullets: [
        "BGD / e-customs с предзаполнением",
        "HS-коды и пошлины из справочника KM",
        "Проводки себестоимости и входного НДС",
      ],
    },
    compliance_pro: {
      description: "ERM, AI Council и трудовой compliance.",
      bullets: [
        "AI Council of Elders — аудит рисков",
        "ƏMAS: трудовые договоры в 1 клик",
        "ERM-дашборд и журнал mitigation",
      ],
    },
    audit_hub: {
      description: "Рабочее место внешнего аудитора и guest-доступ.",
      bullets: [
        "Engagement, выборки и timeline",
        "NAS/IFRS отчёты для аудитора",
        "Bulk export и guest-приглашения",
      ],
    },
  },
  bundles: {
    cash_warehouse: {
      name: "Cash & warehouse",
      moduleLine: "Cash & Bank Pro + Warehouse",
    },
    hr_ifrs: {
      name: "HR & IFRS",
      moduleLine: "HR + IFRS mapping",
    },
    trade_ops: {
      name: "Trade & operations",
      moduleLine: "Warehouse + Manufacturing",
    },
  },
};

const uiAz: PricingStorefrontUiCopy = {
  heroTitle: "ERA Finance: Çevik və Şəffaf Qiymətləndirmə",
  heroSubtitle:
    "Azərbaycan biznesi üçün yeni maliyyə platforması. MMUS və MHBS standartlarına tam uyğunluq.",
  ctaRegister: "3 ay tam pulsuz başla",
  ctaLogin: "Daxil ol",
  coreSuiteTitle: "ERA Core",
  coreSuiteIntro:
    "Əsas platforma və standart modullar — Azərbaycan biznesi üçün vahid uçot konturu.",
  foundationTitle: "ERA Core (Foundation)",
  foundationDescription:
    "Uçot, yazılışlar, dövr bağlanması, MMUS/MHBS uyğunluğu.",
  trialPromoText:
    "İndi qeydiyyatdan keçin və 3 ay müddətində bütün ERA Core modullarından pulsuz istifadə edin.",
  trialPromoButton: "Pulsuz başla — 3 ay",
  coreTrialBadge: "İlk 3 ay tam pulsuz",
  coreTrialPriceLabel: "0 AZN",
  corePostTrialTemplate: "{{price}} / ay trialdan sonra (ilk 3 ay 0 AZN)",
  standardModulesTitle: "ERA Core standart modulları",
  standardModulesHint:
    "Core abunəliyə daxildir və ya aşağıdakı paketlərlə qoşulur — ayrıca modul siyahısı yoxdur.",
  bundlesTitle: "Hazır paketlər",
  bundlesHint:
    "Endirimli standart modullar — tipik biznes ssenarisi üçün hazır paketlər.",
  bundleCta: "Paketi aktivləşdir",
  bundleDiscountSuffix: "endirim",
  bundlePopularBadge: "Məşhur",
  bundleSavingsLabel: "Qənaət",
  pricePerMonthSuffix: "/ ay",
  matrixTitle: "Unit qiymətlər və xərc tavanları (spend tier)",
  matrixHint:
    "Faktiki istifadəyə görə ödəniş; tier tavanı — Bakı ayı üzrə yığılmış xərc limiti.",
  spendTierMatrixHint:
    "3 ay: ERA Core (Foundation) = 0 AZN; metered xərc hesablanır. Tavan çatanda — eyni gün faktura; əks halda — keçən ay üçün ayın 1-də.",
  trialMeterMayBillLine:
    "Trialda metered xidmətlər (hesab, OCR, WhatsApp, GB) unit qiymətə görə hesablanır.",
  tierSpendCeilingTemplate: "{{amount}} / ay qədər",
  tierSpendCeilingStarter: "0 AZN start",
  matrixMetricLabel: "Resurs",
  tierCurrentLabel: "Cari Tarif",
  tierSelectLabel: "Bu səviyyəni seç",
  tierFreeForever: "Həmişə pulsuz",
  tierCustom: "Fərdi",
  tierPerMonth: "/ ay",
  tierTrialLine: "0 AZN / ilk 3 ay",
  resourceUsers: "İstifadəçilər (oturacaq)",
  resourceInvoices: "Hesablar / ay (Baku)",
  resourceStorage: "Sənəd yaddaşı (Disk)",
  resourceWhatsapp: "WhatsApp / ay",
  resourceOcr: "AI-OCR səhifə / ay",
  resourceWorkspaces: "İş məkanları",
  premiumTitle: "Premium əlavə-modullar",
  premiumHint:
    "Vergi, gömrük, compliance və xarici audit genişləndirmələri — Core üzərində qoşulur.",
  premiumLockedTitle: "Kommersiya statusu tələb olunur (TİER 1+)",
  premiumUpgradeCta: "Tier 1+ seçin",
  calculatorDueTodayLabel:
    "Bu gün ödənilən məbləğ (3 aylıq triala daxildir): {{amount}}",
  calculatorPostpaidLabel:
    "Limitlər və premium modullar üçün ödəniş (növbəti ayda postoplat): {{amount}}",
  calculatorBakuNotice:
    "Bütün limit hesablamaları və billing dövrünün bağlanması ayın 1-də cədvəl vaxtı ilə Bakı (Asia/Baku) üzrə aparılır.",
  standardModules: {
    core_accounting: {
      name: "Əsas mühasibatlıq",
      subtitle: "MMUS/MHBS üzrə əsas uçot, yazılışlar və dövr bağlanması",
      bullets: ["NSU / MMUS", "MHBS / IFRS", "Yazılışlar və GL", "Dövr bağlanması"],
    },
    cash_bank: {
      name: "Kassa və bank",
      subtitle: "Kassa, POS və bank bir ödəniş konturunda",
      bullets: ["Kassa və POS", "Bank çıxarışları", "Ödənişlər və sərəğmələr", "Qalıqların yoxlanması"],
    },
    supply_sales: {
      name: "Təchizat, satış və anbar",
      subtitle: "Alış-satış və anbar uçotu",
      bullets: ["Alış və satış", "FIFO və qalıqlar", "İnventar", "Göndəriş maya dəyəri"],
    },
    manufacturing_wip: {
      name: "İstehsalat və NAT",
      subtitle: "Buraxılış, reseptlər və natamam istehsalat uçotu",
      bullets: ["NAT 203", "Reseptlər və spesifikasiya", "Məhsul buraxılışı", "Maya dəyəri"],
    },
    fixed_assets: {
      name: "Əsas vəsaitlər",
      subtitle: "Kapital qoyuluşlar, amortizasiya və OV reyestri",
      bullets: ["Uçota qəbul", "Amortizasiya", "Köçürmə və çıxarış", "OV reyestri"],
    },
    hr_payroll: {
      name: "Kadrlar və əməkhaqqı",
      subtitle: "Ştat, tabel və əməkhaqqı hesablanması",
      bullets: ["Ştat cədvəli", "Tabel", "Hesablamalar", "Vərəqələr və ödənişlər"],
    },
  },
  premiumFeatures: {
    tax_pro: {
      description: "Vergilər və e-Taxes əl ilə köçürmə olmadan.",
      bullets: [
        "e-Taxes avtosinxron və bəyannamələr",
        "RPA ilə əl ilə kopyalama olmadan",
        "ƏDV limitləri real vaxtda",
      ],
    },
    trade_pro: {
      description: "BGD gömrük və Trade Pro import üçün.",
      bullets: [
        "BGD / e-customs ön-doldurma",
        "KM tarif kitabından HS və rüsum",
        "Maya dəyəri və giriş ƏDV yazılışları",
      ],
    },
    compliance_pro: {
      description: "ERM, AI Şura və əmək compliance.",
      bullets: [
        "AI Ağsaqqallar Şurası — risk auditi",
        "ƏMAS: əmək müqavilələri 1 kliklə",
        "ERM paneli və mitigation jurnalı",
      ],
    },
    audit_hub: {
      description: "Xarici auditor iş yeri və guest giriş.",
      bullets: [
        "Engagement, seçmə və timeline",
        "Auditor üçün NAS/IFRS hesabatları",
        "Bulk export və guest dəvətləri",
      ],
    },
  },
  bundles: {
    cash_warehouse: {
      name: "Cash & warehouse",
      moduleLine: "Cash & Bank Pro + Anbar",
    },
    hr_ifrs: {
      name: "HR & IFRS",
      moduleLine: "HR + IFRS mapping",
    },
    trade_ops: {
      name: "Trade & operations",
      moduleLine: "Anbar + İstehsalat",
    },
  },
};

export function getPricingStorefrontUiCopy(locale: "ru" | "az"): PricingStorefrontUiCopy {
  return locale === "ru" ? uiRu : uiAz;
}
