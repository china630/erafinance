/**
 * Generates PDF: 1C:Enterprise vs ERA Finance capability mapping (Russian).
 * Run from repo root: node scripts/generate-1c-mapping-report.mjs
 * Requires: pdfkit in apps/api (npm install at root populates workspaces).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const pdfkitPath = path.join(repoRoot, "node_modules", "pdfkit", "js", "pdfkit.js");
const PDFDocument = require(pdfkitPath);

const outDir = path.join(repoRoot, "reports");
const outFile = path.join(outDir, "1c-predpriyatie-vs-erafinance-erp.pdf");

const fontCandidates = [
  "C:\\Windows\\Fonts\\arial.ttf",
  "C:\\Windows\\Fonts\\calibri.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];

function pickFont() {
  for (const p of fontCandidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** @type {{ title: string, lines: { need: string, text: string, erafinance: string }[] }[]} */
const SECTIONS = [
  {
    title: "Модуль 1С: «Бухгалтерия предприятия» — план счетов и учётная политика",
    lines: [
      { need: "ВЫС", text: "План счетов (иерархия, субсчета, аналитика)", erafinance: "Частично: NAS/IFRS счета, маппинг; без произвольной многоуровневой аналитики как в 1С" },
      { need: "ВЫС", text: "Журналы проводок и хронологический учёт", erafinance: "Частично: проводки из бизнес-событий; нет универсального журнала ручных операций как в 1С" },
      { need: "ВЫС", text: "Оборотно-сальдовая ведомость, карточка счёта", erafinance: "Реализовано: ОСВ за период (отчётность)" },
      { need: "ВЫС", text: "Закрытие месяца, блокировка периодов", erafinance: "Реализовано: закрытие периода (reporting)" },
      { need: "СРЕД", text: "Регламентные операции (амортизация, переоценка, списание)", erafinance: "Частично: амортизация ОС, FX; нет полного набора регламентов 1С" },
      { need: "ВЫС", text: "НДС: счета-фактуры, книги покупок/продаж", erafinance: "Частично: НДС в инвойсах; экспорт приложения к декларации (Excel)" },
      { need: "СРЕД", text: "Валютный учёт, курсовые разницы", erafinance: "Реализовано: модуль FX (переоценка)" },
      { need: "НИЗ", text: "Налоговый учёт (раздельный от бухгалтерского)", erafinance: "Не реализовано как в 1С" },
      { need: "НИЗ", text: "Учёт по проектам, ЦФО, статьям затрат в каждой проводке", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: «Бухгалтерия» — денежные средства и расчёты",
    lines: [
      { need: "ВЫС", text: "Касса, банк, платёжные поручения", erafinance: "Частично: банковские выписки, матчинг с инвойсами; касса в плане счетов 101" },
      { need: "ВЫС", text: "Расчёты с поставщиками и покупателями", erafinance: "Частично: дебиторка по инвойсам; кредиторка 531 без полной связи с контрагентом в акте сверки" },
      { need: "ВЫС", text: "Акт сверки с контрагентом", erafinance: "Реализовано: отчёт + PDF (AZ)" },
      { need: "СРЕД", text: "Ведомость по взаиморасчётам, авансы", erafinance: "Частично: receivables, aging; без полной модели авансов 1С" },
      { need: "СРЕД", text: "Быстрый ввод типовых операций", erafinance: "Частично: quick expense (731/101.01), закупка на склад" },
    ],
  },
  {
    title: "Модуль 1С: «Бухгалтерия» — запасы и себестоимость",
    lines: [
      { need: "ВЫС", text: "Номенклатура, единицы измерения, штрихкоды", erafinance: "Частично: товары/SKU; без штрихкодов" },
      { need: "ВЫС", text: "Склады, остатки, партии, себестоимость", erafinance: "Частично: склады, средняя себестоимость; без партионного учёта" },
      { need: "ВЫС", text: "Документы оприходования, списания, перемещения", erafinance: "Частично: закупка, движения; ограниченный набор сценариев" },
      { need: "СРЕД", text: "Инвентаризация", erafinance: "Не реализовано" },
      { need: "СРЕД", text: "Комиссия, ответственное хранение", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: «Бухгалтерия» — ОС и НМА",
    lines: [
      { need: "СРЕД", text: "Ввод в эксплуатацию, инвентарные номера", erafinance: "Частично: карточка ОС, ввод данных" },
      { need: "СРЕД", text: "Амортизация (линейная и др. методы)", erafinance: "Частично: линейная по сроку в месяцах" },
      { need: "НИЗ", text: "Переоценка, модернизация, частичная ликвидация", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "НМА, аренда по ФСБУ/МСФО", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: «Зарплата и управление персоналом» (ЗУП)",
    lines: [
      { need: "ВЫС", text: "Кадровый учёт, приказы, штатное расписание", erafinance: "Частично: список сотрудников/подрядчиков без кадрового контура 1С" },
      { need: "ВЫС", text: "Начисление зарплаты, налоги, взносы", erafinance: "Частично: расчётный период, проведение в учёт (721/533/521 и др.)" },
      { need: "ВЫС", text: "Отпуска, больничные, табель", erafinance: "Частично: отпуск/больничный как периоды, калькулятор отпускных, календарь в UI" },
      { need: "СРЕД", text: "ГПХ, удержания, алименты, исп. листы", erafinance: "Частично: тип CONTRACTOR и поля для соц. удержаний" },
      { need: "СРЕД", text: "Регламентированная отчётность по труду", erafinance: "Не реализовано (выгрузки в форматы госорганов)" },
      { need: "НИЗ", text: "Кадровый электронный документооборот", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: «Управление торговлей» / розница",
    lines: [
      { need: "ВЫС", text: "Заказы покупателей, отгрузки, резервы", erafinance: "Частично: инвойсы как продажи; без заказов/резервов" },
      { need: "ВЫС", text: "Цены, скидки, виды цен", erafinance: "Не реализовано (цена в строке инвойса)" },
      { need: "ВЫС", text: "Закупки у поставщиков, приёмка", erafinance: "Частично: закупка на склад (упрощённо)" },
      { need: "СРЕД", text: "Касса ККМ, фискализация", erafinance: "Не реализовано" },
      { need: "СРЕД", text: "Интеграция с маркетплейсами", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: «Управление производственным предприятием» / производство",
    lines: [
      { need: "СРЕД", text: "Спецификации, многоуровневые BOM", erafinance: "Частично: рецепт (плоский список компонентов)" },
      { need: "СРЕД", text: "Выпуск продукции, списание материалов", erafinance: "Реализовано: выпуск с учётом склада и проводок" },
      { need: "НИЗ", text: "Планирование производства, MRP, смены", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Учёт брака, переделы, субподряд", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: Отчётность и аналитика",
    lines: [
      { need: "ВЫС", text: "Стандартные бухгалтерские отчёты", erafinance: "Частично: ОСВ, P&L, дашборд, дебиторка, старение" },
      { need: "ВЫС", text: "Конструктор отчётов, СКД", erafinance: "Не реализовано" },
      { need: "СРЕД", text: "Мультивалютная отчётность", erafinance: "Частично через FX-модуль" },
      { need: "НИЗ", text: "Сводная отчётность холдинга", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: Интеграции и обмен",
    lines: [
      { need: "ВЫС", text: "Обмен с банками (клиент-банк)", erafinance: "Частично: загрузка/разбор выписок (по возможностям проекта)" },
      { need: "СРЕД", text: "Экспорт в Excel для налоговых порталов", erafinance: "Реализовано: НДС приложение (квартал)" },
      { need: "ВЫС", text: "Прямая интеграция с e-taxes (API)", erafinance: "Не реализовано (только файлы)" },
      { need: "СРЕД", text: "ЭДО, УПД, ЭЦП", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Обмен с 1С:ЗУП, CRM, WMS", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Модуль 1С: Платформа (технические возможности)",
    lines: [
      { need: "ВЫС", text: "Гибкая настройка ролей и прав", erafinance: "Частично: JWT, роли OWNER/ADMIN в части операций" },
      { need: "ВЫС", text: "Полнотекстовый поиск, списки с отборами", erafinance: "Частично: простые списки; без платформенных отборов 1С" },
      { need: "СРЕД", text: "Версионирование объектов, история изменений", erafinance: "Частично: аудит мутаций (по проекту)" },
      { need: "ВЫС", text: "Внешние печатные формы, произвольные макеты", erafinance: "Частично: PDF инвойса, PDF акта сверки" },
      { need: "НИЗ", text: "Мобильное приложение 1С", erafinance: "Адаптивный веб вместо нативного клиента" },
      { need: "СРЕД", text: "Расширения и доработки без исходников", erafinance: "Не применимо (открытый код, деплой своей версии)" },
    ],
  },
  {
    title: "Модули 1С, отсутствующие в ERA (типичный охват)",
    lines: [
      { need: "СРЕД", text: "1С:Документооборот", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "1С:CRM", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "1С:Управление холдингом", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "1С:ERP (полный цикл крупного предприятия)", erafinance: "Не реализовано; ERA — узкий MVP под AZ" },
    ],
  },
  {
    title: "1С:Розница / касса / маркировка",
    lines: [
      { need: "ВЫС", text: "РМК, быстрые продажи в торговой точке", erafinance: "Не реализовано" },
      { need: "СРЕД", text: "Онлайн-кассы, фискальные накопители", erafinance: "Не реализовано" },
      { need: "СРЕД", text: "Маркировка «Честный ЗНАК», коды DataMatrix", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Акцизы, спецмарки", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "1С:УНФ / малый бизнес (ориентир)",
    lines: [
      { need: "ВЫС", text: "Единый интерфейс: продажи + закупки + деньги", erafinance: "Частично: веб-модули раздельно, без «одной формы всё»" },
      { need: "ВЫС", text: "Простые цепочки документов для ИП", erafinance: "Частично: упрощённые сценарии инвойс/оплата/склад" },
      { need: "СРЕД", text: "Взаимозачёты, корректировки долга", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "1С:Бухгалтерия — специализированные учёты",
    lines: [
      { need: "НИЗ", text: "Учёт автотранспорта, топлива, путевые листы", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Учёт сельхоз, зерно, живность", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Строительство, сметы, объекты капвложений", erafinance: "Не реализовано" },
      { need: "СРЕД", text: "Учёт ТМЦ в эксплуатации, спецодежда", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Биллинг, абоненты, договоры с периодичностью", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "1С:ЗУП — детализация (сравнение)",
    lines: [
      { need: "ВЫС", text: "Штатное расписание, оклады по должностям", erafinance: "Не реализовано (оклад в карточке сотрудника)" },
      { need: "ВЫС", text: "Табель учёта рабочего времени", erafinance: "Не реализовано" },
      { need: "СРЕД", text: "Больничные по правилам ФСС (если применимо)", erafinance: "Частично: учёт периода без полной модели пособий" },
      { need: "СРЕД", text: "Отпуск без сохранения, учебные, соц. отпуска", erafinance: "Не реализовано (два типа: отпуск/больничный)" },
      { need: "НИЗ", text: "Мотивация, KPI, премии по формулам", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "1С:Контроль взаимодействия / задачи (не бухгалтерия)",
    lines: [
      { need: "НИЗ", text: "Внутренние поручения и согласования", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Проекты и задачи как в 1С:Управление проектами", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Международные стандарты и консолидация",
    lines: [
      { need: "СРЕД", text: "МСФО отчётность, трансформации", erafinance: "Частично: IFRS-тени проводок при маппинге" },
      { need: "НИЗ", text: "Консолидация группы компаний, МСФО пакеты", erafinance: "Не реализовано" },
      { need: "НИЗ", text: "Учёт по GAAP/USALI для гостиниц и т.п.", erafinance: "Не реализовано" },
    ],
  },
  {
    title: "Безопасность, администрирование, масштаб",
    lines: [
      { need: "ВЫС", text: "Многофирменный учёт в одной базе", erafinance: "Модель SaaS: организация из JWT; не полный аналог 1С" },
      { need: "ВЫС", text: "Гранулярные RLS на уровне записей", erafinance: "Частично: изоляция по organizationId" },
      { need: "СРЕД", text: "Резервное копирование, журнал регистрации", erafinance: "На стороне инфраструктуры; аудит мутаций в приложении" },
      { need: "НИЗ", text: "Кластеризация, очереди фоновых заданий как в 1С", erafinance: "Частично: BullMQ для PDF и др. задач API" },
    ],
  },
  {
    title: "ERA: функции без прямого аналога в типовой 1С (или редкость)",
    lines: [
      { need: "СРЕД", text: "Двойная книга NAS/IFRS с переключателем в UI", erafinance: "Реализовано (Multi-GAAP по ТЗ)" },
      { need: "СРЕД", text: "Фокус на Азербайджан: VÖEN, локальные отчёты", erafinance: "Реализовано в рамках ТЗ" },
      { need: "ВЫС", text: "Современный веб-UI + мобильная адаптация таблиц", erafinance: "Реализовано (фаза UX)" },
      { need: "СРЕД", text: "Quick Actions (+) для частых операций", erafinance: "Реализовано" },
    ],
  },
];

const NEED_LEGEND =
  "Потребность для большинства пользователей: ВЫС — высокая (типичный SMB), СРЕД — средняя, НИЗ — нишевые/крупные сценарии.";

const ESTIMATE_BLOCK = [
  "Оценка доли функционала 1С:Предприятие (методология):",
  "1С — это платформа + десятки конфигураций и тысячи функций. Прямой процент «всего 1С» для любой системы бессмысленен без рамки.",
  "Если сравнивать с полным стеком типичной крупной конфигурации (1С:ERP / УПП), реализовано порядка 2–5% охвата по количеству предметных функций.",
  "Если сравнивать узкий контур «малый бизнес AZ: учёт + инвойсы + склад + зарплата + ОС + базовая отчётность + налоговый экспорт»,",
  "ERA закрывает примерно 25–40% типовых потребностей этого контура — с упором на учёт и продажи, меньше — закупки/торговля/кадры в глубину 1С.",
  "Итоговая ориентировочная оценка «как у 1С в целом»: ~3–6%; «как у узкого целевого контура ТЗ»: ~30–35% (субъективно, по таблице выше).",
];

function main() {
  const font = pickFont();
  fs.mkdirSync(outDir, { recursive: true });

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 45, right: 45 },
    info: {
      Title: "1C:Predpriyatie vs ERA Finance",
      Author: "ERA Finance",
      CreationDate: new Date(),
    },
  });
  const stream = fs.createWriteStream(outFile);
  doc.pipe(stream);

  if (font) doc.registerFont("body", font);
  const f = font ? "body" : "Helvetica";

  const pageW = doc.page.width - 90;
  let y = 50;

  function newPage() {
    doc.addPage();
    y = 50;
  }

  function lineHeight(size) {
    return size * 1.25;
  }

  function writeParagraph(text, size = 9, gap = 4) {
    const lh = lineHeight(size);
    doc.font(f).fontSize(size).fillColor("#111");
    const h = doc.heightOfString(text, { width: pageW });
    if (y + h > doc.page.height - 55) newPage();
    doc.text(text, 45, y, { width: pageW, align: "left" });
    y += h + gap;
  }

  function writeTitle(text, size = 14) {
    doc.font(f).fontSize(size).fillColor("#0f172a");
    const h = lineHeight(size) + 4;
    if (y + h > doc.page.height - 55) newPage();
    doc.text(text, 45, y, { width: pageW });
    y += h + 6;
  }

  writeTitle("Сопоставление возможностей 1С:Предприятие и ERA Finance", 13);
  writeParagraph(
    "Дата отчёта: " +
      new Date().toISOString().slice(0, 10) +
      ". ERA Finance — SaaS-учёт (NestJS + Next.js), ориентир ТЗ v2.0. Нумерация строк сквозная для ссылок в обсуждении.",
    9,
    8,
  );
  writeParagraph(NEED_LEGEND, 8.5, 10);

  let n = 1;
  for (const sec of SECTIONS) {
    if (y > doc.page.height - 120) newPage();
    writeTitle(sec.title, 10.5);
    for (const row of sec.lines) {
      const block = `${n}. [${row.need}] ${row.text}\n   ERA: ${row.erafinance}`;
      const lh = 9;
      doc.font(f).fontSize(lh).fillColor("#111");
      const h = doc.heightOfString(block, { width: pageW });
      if (y + h > doc.page.height - 55) newPage();
      doc.text(block, 45, y, { width: pageW, align: "left" });
      y += h + 5;
      n += 1;
    }
    y += 4;
  }

  y += 6;
  writeTitle("Итоговая оценка покрытия относительно 1С:Предприятие", 11);
  for (const p of ESTIMATE_BLOCK) {
    writeParagraph(p, 9, 6);
  }

  writeParagraph(
    "Конец отчёта. Файл сгенерирован скриптом scripts/generate-1c-mapping-report.mjs",
    8,
    0,
  );

  doc.end();
  stream.on("finish", () => {
    console.log("Written:", outFile);
  });
}

main();
