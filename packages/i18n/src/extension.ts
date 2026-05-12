/** ERA Finance Assistant (browser extension) — RU/AZ only per i18n:audit. */
export const extensionResources = {
  ru: {
    translation: {
      extension: {
        hub: {
          title: "ERA Finance Assistant",
          subtitle: "Порталы и компании",
          openErp: "Открыть ERP",
          serviceEmas: "ƏMAS (кадры)",
          serviceEtaxes: "e-Taxes (налоги)",
          serviceCustoms: "e-Customs (таможня)",
        },
        orgSwitcher: {
          label: "Компания",
          placeholder: "Выберите компанию",
        },
        paywall: {
          title: "Модуль не активен",
          body: "Для этой компании не подключён нужный модуль. Оформите подписку в ERA Finance.",
          cta: "Открыть подписку",
        },
        portal: {
          contextTitle: "Портал",
          authWaiting: "Войдите на портале (ASAN İmza)",
          authOk: "Сессия портала активна",
          openWidget: "Показать помощник",
          flowEmuqavile: "Электронный трудовой договор (e-müqavilə)",
          flowEqaime: "Электронная счёт-фактура (e-qaimə)",
          flowBgdCapture: "Таможенная декларация (BGD) → ERP",
        },
        widget: {
          title: "ERA",
          stepAsan: "Шаг 1: вход на портале",
          stepFill: "Шаг 2: заполнение из ERP",
          stepFillInvoice: "Шаг 2: заполнение инвойса из ERP",
          stepSign: "Шаг 3: подпись",
          mismatchError:
            "Внимание: VÖEN в ERA Finance ({erpVoen}) не совпадает с VÖEN на портале ({portalVoen}). Пожалуйста, смените компанию в плагине или на портале.",
          fillButton: "Заполнить из ERA",
          fillButtonInvoice: "Заполнить e-qaimə из ERA",
          selectEmployee: "Сотрудник",
          selectInvoice: "Инвойс",
          awaitSignHint: "Нажмите «İmzala» на портале — расширение не подписывает за вас.",
          close: "Скрыть",
          bulkRun: "Запустить bulk",
          bulkPause: "Пауза",
          bulkResume: "Продолжить",
          bulkCancel: "Отмена",
          stepCaptureBgd: "Шаг 2: захват BGD в ERP",
          captureBgdHint:
            "Откройте карточку BGD на e-customs и нажмите кнопку — в ERA создастся черновик (при дубликате номера строка не дублируется).",
          captureToErp: "Захватить в ERP",
          captureOk: "BGD отправлен в ERA Finance (новая вкладка).",
          captureDeduped: "Такой BGD уже есть в ERP — дубликат не создан.",
          captureUnexpected: "Неожиданный ответ API.",
          captureItemsPreview: "Позиции (предпросмотр)",
          captureMismatchWarn:
            "Внимание: расчётная пошлина отличается от портала примерно на {pct}%.",
          captureMismatchWarnVat:
            "Внимание: расчётный НДС отличается от портала примерно на {pct}%.",
        },
        auth: {
          magicInProgress: "Подключение к ERP…",
          needLogin: "Войдите в ERA Finance в браузере, затем откройте расширение снова.",
          error: "Ошибка авторизации",
        },
      },
    },
  },
  az: {
    translation: {
      extension: {
        hub: {
          title: "ERA Finance Assistant",
          subtitle: "Portallar və şirkətlər",
          openErp: "ERP aç",
          serviceEmas: "ƏMAS (kadrlar)",
          serviceEtaxes: "e-Taxes (vergi)",
          serviceCustoms: "e-Customs (gömrük)",
        },
        orgSwitcher: {
          label: "Şirkət",
          placeholder: "Şirkət seçin",
        },
        paywall: {
          title: "Modul aktiv deyil",
          body: "Bu şirkət üçün lazımi modul qoşulmayıb. ERA Finance-də abunəni aktivləşdirin.",
          cta: "Abunəyə keç",
        },
        portal: {
          contextTitle: "Portal",
          authWaiting: "Portala daxil olun (ASAN İmza)",
          authOk: "Portal sessiyası aktivdir",
          openWidget: "Köməkçini göstər",
          flowEmuqavile: "Elektron əmək müqaviləsi (e-müqavilə)",
          flowEqaime: "Elektron qaimə-faktura (e-qaimə)",
          flowBgdCapture: "Gömrük bəyannaməsi (BGD) → ERP",
        },
        widget: {
          title: "ERA",
          stepAsan: "Addım 1: portala giriş",
          stepFill: "Addım 2: ERP-dən doldurma",
          stepFillInvoice: "Addım 2: ERP-dən qaimə doldurma",
          stepSign: "Addım 3: imza",
          mismatchError:
            "Diqqət: ERA Finance-dəki VÖEN ({erpVoen}) portaldakı VÖEN-lə ({portalVoen}) uyğun gəlmir. Zəhmət olmasa şirkəti plugin-də və ya portalda dəyişin.",
          fillButton: "ERA-dən doldur",
          fillButtonInvoice: "e-qaiməni ERA-dən doldur",
          selectEmployee: "İşçi",
          selectInvoice: "Qaimə",
          awaitSignHint: "Portaldakı «İmzala» düyməsini özünüz basın — genişləndirmə sizin əvəzinizə imzalamır.",
          close: "Gizlət",
          bulkRun: "Bulk başladın",
          bulkPause: "Pauza",
          bulkResume: "Davam et",
          bulkCancel: "Ləğv et",
          stepCaptureBgd: "Addım 2: BGD-ni ERP-yə tutmaq",
          captureBgdHint:
            "e-customs-da BGD kartını açın və düyməni basın — ERA-da qaralama yaradılacaq (təkrar nömrədə sətir əlavə olunmur).",
          captureToErp: "ERP-yə tut",
          captureOk: "BGD ERA Finance-yə göndərildi (yeni tab).",
          captureDeduped: "Bu BGD artıq ERP-də var — dublikat yaradılmadı.",
          captureUnexpected: "API-dən gözlənilməz cavab.",
          captureItemsPreview: "Mövqelər (önizləmə)",
          captureMismatchWarn:
            "Diqqət: hesablanan rüsum portal təxminən {pct}% fərqlənir.",
          captureMismatchWarnVat:
            "Diqqət: hesablanan ƏDV portal təxminən {pct}% fərqlənir.",
        },
        auth: {
          magicInProgress: "ERP-ə qoşulur…",
          needLogin: "Brauzerdə ERA Finance-yə daxil olun, sonra genişləndirməni yenidən açın.",
          error: "Avtorizasiya xətası",
        },
      },
    },
  },
} as const;
