# Материалы для мануала бухгалтера

- Основной документ: [manual-buhgalter.md](./manual-buhgalter.md).
- **PDF:** [manual-buhgalter.pdf](./manual-buhgalter.pdf) — сборка из корня репозитория: `python tools/md_to_pdf.py docs/manual-accountant/manual-buhgalter.md -o docs/manual-accountant/manual-buhgalter.pdf` (см. ниже).
- **HTML:** [manual-buhgalter.html](./manual-buhgalter.html) — один файл со стилями, боковым оглавлением и ссылками; сборка из корня репозитория: `python tools/md_to_html.py docs/manual-accountant/manual-buhgalter.md -o docs/manual-accountant/manual-buhgalter.html`.
- Иллюстрации лежат в каталоге `images/` (сгенерированные эталонные картинки и/или ваши реальные скриншоты).

## Сборка PDF

```bash
cd "path/to/era_erp"
python -m pip install -r docs/manual-accountant/requirements-pdf.txt
python tools/md_to_pdf.py docs/manual-accountant/manual-buhgalter.md -o docs/manual-accountant/manual-buhgalter.pdf
```

PDF собирается через **headless Chrome / Edge** (тот же движок, что у браузера): нормальные **таблицы**, шрифты и оглавление со ссылками. Нужен установленный **Google Chrome** или **Microsoft Edge** (на Windows обычно уже есть Edge). Явный путь к браузеру: переменная **`ERAFINANCE_CHROME_BIN`** или флаг **`--browser "C:\...\msedge.exe"`**. Если браузера нет (типично CI/Linux без Chromium), установите **`pip install weasyprint`** и запускайте с **`--engine weasyprint`**.

## Сборка HTML

```bash
cd "path/to/era_erp"
python -m pip install markdown
python tools/md_to_html.py docs/manual-accountant/manual-buhgalter.md -o docs/manual-accountant/manual-buhgalter.html
```

Откройте `manual-buhgalter.html` в браузере из этой же папки, чтобы подгрузились картинки из `images/`.

Чтобы заменить иллюстрации на **реальные скриншоты** вашего стенда:

1. Запустите веб: `npm run dev:web` (и при необходимости API).
2. Войдите под учётной записью с ролью **Accountant** или **Admin**.
3. Сохраняйте PNG с теми же именами файлов, что указаны в мануале, либо обновите пути в `manual-buhgalter.md`.

Рекомендуемое разрешение: 1280×720 или шире, без личных данных (VÖEN, email) или с замазанными полями.
