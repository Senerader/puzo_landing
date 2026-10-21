# Puzo Software OÜ

Публичное портфолио Canvasik и LEGENDA для `landing.puzoapps.com`. Обычные HTML, CSS и JavaScript без сборки и серверной части. Английский язык выбран по умолчанию; язык и тема сохраняются в браузере.

## Локальный просмотр

```sh
python3 dev.py
```

Откройте `http://127.0.0.1:8080`. Скрипт корректно сопоставляет `/assets/` с каталогом `public/assets/`.

## Контейнер приложения

В этом репозитории остаются исходники сайта, Dockerfile и внутренняя конфигурация раздачи статики `deploy/static.Caddyfile`. Контейнер обслуживает HTTP на порту `80`; домены, HTTPS, сертификаты и маршруты общего Caddy управляются в `puzo_infra`.

Для локальной проверки контейнера:

```sh
docker compose config --quiet
docker compose up -d --build
docker compose logs --tail=50 landing
curl --fail --silent --show-error -I http://127.0.0.1:8080/
```

Compose из этого репозитория публикует только `127.0.0.1:8080`. Откройте `http://127.0.0.1:8080` и проверьте EN/RU, обе темы и ссылки на сервисы. Параметр `SITE_ADDRESS` больше не требуется: внутренний сервер всегда слушает `:80`.

## Развёртывание на Hetzner

Production Compose, конфигурация общего Caddy, DNS/TLS и порядок обновления находятся в `puzo_infra`: `docs/landing.md` и `deploy/landing/compose.yaml`. Развёртывание выполняется оттуда с выбранным commit и отдельным тегом образа.

Контракт приложения совместим с описанной там схемой:

```text
landing.puzoapps.com → общий Caddy на VM → 127.0.0.1:8080 → landing:80
```

Общий Caddy занимает публичные порты `80/443`. Контейнер приложения не выпускает сертификаты и не требует volumes для их хранения. Если reverse proxy запускается в Docker, сеть контейнеров и upstream настраиваются в инфраструктурном репозитории.

Основные файлы: `index.html` — содержание, `styles.css` — оформление, `script.js` — языки, темы и анимация. Изображения находятся в `public/assets/` и доступны на сайте как `/assets/…`. Секреты и переменные окружения приложению не нужны.

## Оформление и графика

Английский и тёмная тема включены при первом посещении. Переключатели сохраняют выбор в localStorage; если хранилище недоступно, страница продолжает работать. Кнопка паузы останавливает декоративные анимации, а системная настройка reduced motion учитывается автоматически. Шрифты размещены локально; обращения к сторонним CDN и аналитика отсутствуют.

Логотип, `image.png` и `image2.png` взяты из предоставленных файлов. Для страницы подготовлены WebP-копии: `logo.webp`, `canvasik.webp`, `legenda.webp`. Оригиналы сохранены. Новый декоративный портал создан встроенным imagegen: `public/assets/orbit.png`; на странице используется оптимизированный `public/assets/orbit.webp` с прозрачным фоном.

Промпт портала:

> Premium videogame title-screen 3D studio render: one tilted polished brushed platinum/chrome elliptical torus, thin diagonal electric cyan glass orbit, three small floating metallic cubes. Transparent background and portal opening, complete centered object, generous margins, dramatic silver highlights and cyan rim glow. No text, logo, letters, watermark, floor or environment.

## Проверка интерфейса

Браузерный сценарий находится в `tests/qa.mjs`. Он проверяет языки, темы, сохранение настроек, клавиатуру, ссылки, мобильную ширину, reduced motion, недоступность localStorage, загрузку ассетов и автоматические правила WCAG через axe. Для запуска нужны Node.js, Playwright, axe-core и установленный Chromium; production от них не зависит.

Запустите `python3 dev.py` в отдельном терминале, затем:

```sh
npm install --prefix /tmp/puzo-qa playwright axe-core
/tmp/puzo-qa/node_modules/.bin/playwright install chromium
PLAYWRIGHT_MODULE=/tmp/puzo-qa/node_modules/playwright \
AXE_MODULE=/tmp/puzo-qa/node_modules/axe-core/axe.min.js \
node tests/qa.mjs
```

Результаты и скриншоты сохраняются в `tests/qa-report.json` и `tests/screenshots/`; они исключены из Git и production-образа. Автоматические проверки доступности не заменяют ручную проверку.
