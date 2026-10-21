# Puzo Software OÜ

Публичное портфолио Canvasik и LEGENDA для `landing.puzoapps.com`. Обычные HTML, CSS и JavaScript без сборки и серверной части. Английский язык выбран по умолчанию; язык и тема сохраняются в браузере.

## Локальный просмотр

```sh
python3 dev.py
```

Откройте `http://127.0.0.1:8080`. Скрипт корректно сопоставляет `/assets/` с каталогом `public/assets/`.

## Запуск на Hetzner

Нужны Docker Engine и Docker Compose v2. Скопируйте проект на виртуальную машину, затем:

1. Создайте DNS-запись `A` для `landing.puzoapps.com` с реальным IPv4 вашей машины. Добавляйте `AAAA` только при настроенном и доступном IPv6.
2. Разрешите входящие TCP-порты `80` и `443` в firewall машины и Hetzner. UDP `443` нужен для HTTP/3.
3. Убедитесь, что эти порты свободны. Если их уже занимает другой сайт или reverse proxy, используйте вариант ниже.
4. В каталоге проекта выполните:

```sh
docker compose config --quiet
docker compose up -d --build
docker compose logs --tail=50 landing
curl --fail --silent --show-error -I https://landing.puzoapps.com
```

Caddy автоматически получает и продлевает TLS-сертификат, перенаправляет HTTP на HTTPS и сохраняет сертификаты в Docker volume `caddy_data`. DNS должен указывать на эту машину, а TCP-порты должны быть доступны извне. [Документация Caddy](https://caddyserver.com/docs/automatic-https).

После проверки URL откройте сайт с компьютера и телефона: проверьте EN/RU, обе темы и ссылки на сервисы.

## Если на машине уже есть reverse proxy

Соберите тот же образ и запустите его только на loopback-порту `8080`:

```sh
docker build -t puzo-landing:local .
docker run -d --name puzo-landing --restart unless-stopped \
  -e SITE_ADDRESS=:80 \
  -p 127.0.0.1:8080:80 \
  puzo-landing:local
curl --fail --silent --show-error -I http://127.0.0.1:8080
```

Добавьте `landing.puzoapps.com` в существующий reverse proxy и направьте его на `http://127.0.0.1:8080`; HTTPS в этом варианте обслуживает существующий proxy. Например, для Caddy, запущенного на самой машине:

```caddyfile
landing.puzoapps.com {
    reverse_proxy 127.0.0.1:8080
}
```

Если существующий proxy работает в Docker, его `127.0.0.1` указывает внутрь собственного контейнера. Подключите оба контейнера к общей Docker-сети и используйте имя контейнера и порт `80` как upstream.

В production-варианте с Compose дополнительные команды `docker run` не нужны.

## Обновление

Обновите файлы проекта на машине и пересоберите контейнер:

```sh
docker compose up -d --build
curl --fail --silent --show-error -I https://landing.puzoapps.com
```

Для варианта за существующим proxy пересоберите образ и пересоздайте только контейнер `puzo-landing` с той же командой `docker run`. Не удаляйте volumes Caddy при обычном обновлении.

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
