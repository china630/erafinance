export type EcosystemModuleStatus = "trial" | "beta" | "premium";

export type EcosystemModuleCopy = {
  slug: string;
  title: string;
  tasks: string[];
  status: EcosystemModuleStatus;
};

export type EcosystemSectionCopy = {
  id: string;
  title: string;
  modules: EcosystemModuleCopy[];
};

export type LandingEcosystemCopy = {
  statusTrial: string;
  statusBeta: string;
  statusPremium: string;
  premiumGlowBadge: string;
  sections: EcosystemSectionCopy[];
  disclaimer: string;
};

export const landingEcosystemRu: LandingEcosystemCopy = {
  statusTrial: "Включено в trial",
  statusBeta: "Beta-доступ",
  statusPremium: "Premium plug-in",
  premiumGlowBadge: "AI / RPA",
  disclaimer:
    "*Исключая специализированные премиум-пакеты (compliance_pro, tax_pro, trade_pro): AI-консилиум Старейшин, RPA e-taxes/ƏMAS, таможня BGD.",
  sections: [
    {
      id: "operational",
      title: "Операционный контур (Включено в 3-месячный Триал)",
      modules: [
        {
          slug: "core_accounting",
          title: "Главная Бухгалтерия (Core Accounting)",
          status: "trial",
          tasks: [
            "Двойная запись по НСБУ (NAS / MMUS) и МСФО (IFRS / MHBS)",
            "ОСВ (Şahmat balansı) и главная книга автоматически",
            "Соответствие регламенту учёта в Азербайджане",
          ],
        },
        {
          slug: "cash_bank",
          title: "Мультивалютная Касса и Банк",
          status: "trial",
          tasks: [
            "Учёт наличных KMO/KSO (AZN, USD, EUR)",
            "Выписки банков АР и интеллектуальный матчинг",
            "Автоматическое устранение дубликатов",
          ],
        },
        {
          slug: "treasury",
          title: "Казначейство и Ликвидность (Treasury)",
          status: "trial",
          tasks: [
            "Платежный календарь и реестр заявок",
            "Контроль исходящих платежей",
            "Защита от кассовых разрывов",
          ],
        },
        {
          slug: "supply_chain",
          title: "Снабжение и Сбыт (Supply Chain & Sales)",
          status: "trial",
          tasks: [
            "Договоры и спецификации",
            "Дебиторка / кредиторка",
            "Акты сверки (Üzləşmə aktı) автоматически",
          ],
        },
        {
          slug: "warehouse",
          title: "Управление Складом (Warehouse & Stock)",
          status: "trial",
          tasks: [
            "Остатки в реальном времени",
            "Себестоимость по FIFO",
            "Инвентаризация и перемещения",
          ],
        },
        {
          slug: "manufacturing",
          title: "Производство и НЗП (Manufacturing WIP)",
          status: "trial",
          tasks: [
            "Производственные заказы (Manufacturing Orders)",
            "Списание сырья 201 → 203 (НЗП)",
            "Учёт полуфабрикатов",
          ],
        },
        {
          slug: "fixed_assets",
          title: "Основные Средства (Fixed Assets v2)",
          status: "trial",
          tasks: [
            "Амортизация: STRAIGHT_LINE",
            "UNITS_OF_PRODUCTION (выработка)",
            "Проводки по NAS на счета ОС",
          ],
        },
        {
          slug: "hr_payroll",
          title: "Кадры и Зарплаты (HR & Payroll)",
          status: "trial",
          tasks: [
            "Учёт сотрудников по нормам АР",
            "Табель (Timesheets)",
            "Оклады, премии, больничные и налоги с ФОТ",
          ],
        },
      ],
    },
    {
      id: "vertical",
      title: "Отраслевые Решения (Включено в Beta-Доступ)",
      modules: [
        {
          slug: "retail",
          title: "Retail & E-commerce",
          status: "beta",
          tasks: [
            "Синхронизация с POS-терминалами",
            "Локальные кассовые аппараты",
            "Остатки обновляются при пробитии чека",
          ],
        },
        {
          slug: "construction",
          title: "Строительство (Construction)",
          status: "beta",
          tasks: [
            "Строительные сметы",
            "Контроль субподрядчиков",
            "Акты выполненных работ и М-29",
          ],
        },
        {
          slug: "logistics",
          title: "Логистика и Таможня (Logistics)",
          status: "beta",
          tasks: [
            "Трекинг международных перевозок",
            "Калькулятор импортных пошлин",
            "Накладные расходы в себестоимость партий",
          ],
        },
        {
          slug: "crm_whatsapp",
          title: "CRM & WhatsApp Business",
          status: "beta",
          tasks: [
            "Триггерные уведомления клиентам",
            "Счета в мессенджер",
            "Предоплатный кошелёк квот",
          ],
        },
      ],
    },
    {
      id: "premium",
      title: "Премиальные Расширения (Отдельные Плагины)",
      modules: [
        {
          slug: "tax_pro",
          title: "Tax Pro (e-taxes Automation)",
          status: "premium",
          tasks: [
            "RPA ERA Finance Assistant",
            "Автозаполнение деклараций и выписок",
            "Отправка отчётов НДС в e-taxes.gov.az",
          ],
        },
        {
          slug: "trade_pro",
          title: "Trade Pro (Customs Automation)",
          status: "premium",
          tasks: [
            "Портал e-customs.gov.az",
            "Импорт BGD в ERP",
            "Связка с закупками и ВЭД",
          ],
        },
        {
          slug: "compliance_pro",
          title: "Compliance Pro (AI Совет Старейшин)",
          status: "premium",
          tasks: [
            "4 модели Gemini: 3 эксперта + Синтезатор",
            "Поиск скрытых финансовых рисков",
            "Превентивный гвардинг лимита НДС",
          ],
        },
      ],
    },
  ],
};

export const landingEcosystemAz: LandingEcosystemCopy = {
  statusTrial: "Trial-da daxildir",
  statusBeta: "Beta girişi",
  statusPremium: "Premium plug-in",
  premiumGlowBadge: "AI / RPA",
  disclaimer:
    "*AI Ağsaqqallar Şurası və e-taxes/ƏMAS RPA avtomatlaşdırılması istisna olmaqla (compliance_pro, tax_pro, trade_pro).",
  sections: [
    {
      id: "operational",
      title: "Operativ Kontur (Triala daxildir)",
      modules: [
        {
          slug: "core_accounting",
          title: "Əsas Mühasibatlıq (Core Accounting)",
          status: "trial",
          tasks: [
            "NSU (NAS / MMUS) və MHBS (IFRS) üzrə ikiqat yazılış",
            "Avtomatik OSV (Şahmat balansı) və baş kitab",
            "Azərbaycan uçot standartlarına uyğunluq",
          ],
        },
        {
          slug: "cash_bank",
          title: "Multivalyuta Kassa və Bank",
          status: "trial",
          tasks: [
            "Nağd KMO/KSO uçotu (AZN, USD, EUR)",
            "AR bank çıxarışları və intellektual uyğunlaşdırma",
            "Dublikatların avtomatik aradan qaldırılması",
          ],
        },
        {
          slug: "treasury",
          title: "Xəzinədarlıq və Likvidlik (Treasury)",
          status: "trial",
          tasks: [
            "Ödəniş təqvimi və ödəniş sorğuları reyestri",
            "Çıxan ödənişlərin nəzarəti",
            "Kassa boşluqlarından qorunma",
          ],
        },
        {
          slug: "supply_chain",
          title: "Təchizat və Satış (Supply Chain & Sales)",
          status: "trial",
          tasks: [
            "Müqavilələr və spesifikasiyalar",
            "Debitor / kreditor nəzarəti",
            "Üzləşmə aktının avtomatik formalaşdırılması",
          ],
        },
        {
          slug: "warehouse",
          title: "Anbar İdarəetməsi (Warehouse & Stock)",
          status: "trial",
          tasks: [
            "Real vaxt qalıqları",
            "FIFO üzrə maya dəyəri",
            "İnventar və köçürmələr",
          ],
        },
        {
          slug: "manufacturing",
          title: "İstehsalat və NAT (Manufacturing WIP)",
          status: "trial",
          tasks: [
            "İstehsalat sifarişləri (Manufacturing Orders)",
            "Xammalın 201 → 203 (NAT) silinməsi",
            "Yarımfabrikat uçotu",
          ],
        },
        {
          slug: "fixed_assets",
          title: "Əsas Vəsaitlər (Fixed Assets v2)",
          status: "trial",
          tasks: [
            "Amortizasiya: STRAIGHT_LINE",
            "UNITS_OF_PRODUCTION (istehsalat həcmi)",
            "ƏV üzrə NAS keçidləri",
          ],
        },
        {
          slug: "hr_payroll",
          title: "Kadr və Əməkhaqqı (HR & Payroll)",
          status: "trial",
          tasks: [
            "AR əmək normaları üzrə işçi uçotu",
            "İş vaxtı cədvəli (Timesheets)",
            "Maaş, mükafat, xəstəlik və FOT vergiləri",
          ],
        },
      ],
    },
    {
      id: "vertical",
      title: "Sahəvi Həllər (Beta)",
      modules: [
        {
          slug: "retail",
          title: "Retail & E-commerce",
          status: "beta",
          tasks: [
            "POS terminalları ilə sinxronizasiya",
            "Yerli kassa aparatları",
            "Çek anında anbar qalıqlarının yenilənməsi",
          ],
        },
        {
          slug: "construction",
          title: "Tikinti (Construction)",
          status: "beta",
          tasks: [
            "Tikinti smetaları",
            "Subpodratçıların nəzarəti",
            "İcra aktları və M-29",
          ],
        },
        {
          slug: "logistics",
          title: "Logistika və Gömrük (Logistics)",
          status: "beta",
          tasks: [
            "Beynəlxalq daşımaların izlənməsi",
            "İdxal rüsumları kalkulyatoru",
            "Overhead xərclərinin partiya maya dəyərinə paylanması",
          ],
        },
        {
          slug: "crm_whatsapp",
          title: "CRM & WhatsApp Business",
          status: "beta",
          tasks: [
            "Müştərilərə trigger bildirişlər",
            "Messengerdə hesab-faktura",
            "Ön ödənişli kvota cüzdanı",
          ],
        },
      ],
    },
    {
      id: "premium",
      title: "Premium Genişləndirmələr",
      modules: [
        {
          slug: "tax_pro",
          title: "Tax Pro (e-taxes Automation)",
          status: "premium",
          tasks: [
            "ERA Finance Assistant RPA",
            "Bəyannamə və çıxarışların avtomatik doldurulması",
            "ƏDV hesabatlarının e-taxes.gov.az-a göndərilməsi",
          ],
        },
        {
          slug: "trade_pro",
          title: "Trade Pro (Customs Automation)",
          status: "premium",
          tasks: [
            "e-customs.gov.az portalı",
            "BGD-nin ERP-yə idxalı",
            "Alışlar və XTT ilə əlaqə",
          ],
        },
        {
          slug: "compliance_pro",
          title: "Compliance Pro (AI Ağsaqqallar Şurası)",
          status: "premium",
          tasks: [
            "4 Gemini: 3 ekspert + Sintezator",
            "Gizli maliyyə riskləri",
            "ƏDV limiti üzrə preventiv qorunma",
          ],
        },
      ],
    },
  ],
};
