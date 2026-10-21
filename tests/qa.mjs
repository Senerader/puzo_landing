import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const axePath = require.resolve(process.env.AXE_MODULE || 'axe-core/axe.min.js');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8080';
const output = fileURLToPath(new URL('./screenshots/', import.meta.url));
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const browserVersion = browser.version();
const results = [];
const errors = [];
const failedRequests = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, passed: true, detail });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}

async function screenshot(name) {
  await page.screenshot({ path: `${output}${name}.png`, fullPage: true });
}

async function scanAccessibility(label) {
  await page.addScriptTag({ path: axePath });
  const findings = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations.map(({ id, impact, description, nodes }) => ({ id, impact, description, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
  });
  assert.deepEqual(findings, [], `${label}: ${JSON.stringify(findings)}`);
}

async function noHorizontalOverflow() {
  const dimensions = await page.evaluate(() => {
    const animation = document.querySelector('.portal-image').getAnimations()[0];
    const currentTime = animation?.currentTime;
    const playState = animation?.playState;
    if (animation) { animation.pause(); animation.currentTime = 4500; }
    const measured = { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth };
    if (animation) { animation.currentTime = currentTime; if (playState === 'running') animation.play(); }
    return measured;
  });
  assert.ok(dimensions.document <= dimensions.viewport + 1 && dimensions.body <= dimensions.viewport + 1, JSON.stringify(dimensions));
  return dimensions;
}

async function revealAll() {
  for (const item of await page.locator('.reveal').all()) {
    await item.scrollIntoViewIfNeeded();
    await page.waitForTimeout(70);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(900);
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await revealAll();
  await check('English is the default language', async () => {
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.match(await page.title(), /Puzo/);
    await page.getByRole('heading', { level: 1 }).waitFor();
  });
  await check('Portfolio links target the supplied service URLs', async () => {
    for (const url of ['https://canvasik.puzoapps.com', 'https://legenda-event.com']) {
      const links = page.locator(`a[href="${url}"], a[href="${url}/"]`);
      assert.ok(await links.count() > 0, `${url} link is missing`);
      for (const link of await links.all()) {
        if (await link.getAttribute('target') === '_blank') assert.match(await link.getAttribute('rel') || '', /noopener/);
      }
    }
  });
  await check('Visible images load', async () => {
    const invalid = await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.getAttribute('src')));
    assert.deepEqual(invalid, []);
  });
  await check('Desktop has no horizontal overflow', noHorizontalOverflow);
  await screenshot('desktop-en-dark');
  await check('Desktop default theme passes automated WCAG checks', () => scanAccessibility('desktop default'));
  const englishCopy = await page.locator('[data-i18n]').evaluateAll(elements => elements.map(element => ({ key: element.dataset.i18n, text: element.textContent })));
  await check('Keyboard opens and closes project detail panels', async () => {
    for (const detail of await page.locator('details.project-details').all()) {
      const summary = detail.locator('summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await detail.getAttribute('open'), '');
      await detail.locator('.details-body').waitFor({ state: 'visible' });
      await page.keyboard.press('Enter');
      assert.equal(await detail.getAttribute('open'), null);
    }
  });
  await check('Keyboard product links open the correct service in a new tab', async () => {
    for (const origin of ['https://canvasik.puzoapps.com', 'https://legenda-event.com']) {
      await context.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: '<title>Local link verification</title>' }));
      const link = page.locator(`a.project-link[href="${origin}"]`);
      await link.focus();
      const [popup] = await Promise.all([context.waitForEvent('page'), page.keyboard.press('Enter')]);
      await popup.waitForURL(`${origin}/`);
      await popup.close();
      await context.unroute(`${origin}/**`);
    }
  });
  await check('Light theme works by keyboard and persists after reload', async () => {
    await page.locator('#theme-toggle').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('#theme-toggle').getAttribute('aria-pressed'), 'true');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  });
  await revealAll();
  await screenshot('desktop-en-light');
  await check('Desktop light theme passes automated WCAG checks', () => scanAccessibility('desktop light'));
  await check('Russian switch translates content, labels and metadata', async () => {
    await page.locator('[data-language="ru"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    assert.equal(await page.locator('[data-language="ru"]').getAttribute('aria-pressed'), 'true');
    assert.match(await page.title(), /Немного софта/);
    for (const selector of ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]']) {
      assert.match(await page.locator(selector).getAttribute('content'), /[а-яё]/i);
    }
    assert.equal(await page.locator('meta[property="og:locale"]').getAttribute('content'), 'ru_RU');
    assert.match(await page.locator('#motion-toggle').getAttribute('aria-label'), /[а-яё]/i);
    const russianCopy = await page.locator('[data-i18n]').evaluateAll(elements => elements.map(element => ({ key: element.dataset.i18n, text: element.textContent })));
    const unchanged = russianCopy.filter((entry, index) => !entry.text.trim() || entry.text === englishCopy[index]?.text);
    assert.deepEqual(unchanged, []);
    for (const attr of ['aria', 'alt']) {
      const values = await page.locator(`[data-i18n-${attr}]`).evaluateAll((elements, attribute) => elements.map(element => element.getAttribute(attribute === 'aria' ? 'aria-label' : 'alt')), attr);
      assert.ok(values.every(value => /[а-яё]/i.test(value)), JSON.stringify(values));
    }
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
  });
  await page.locator('#theme-toggle').click();
  await check('Dark theme restores and persists after reload', async () => {
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await revealAll();
    await check(`Russian mobile ${width}px has no horizontal overflow`, noHorizontalOverflow);
    await screenshot(`mobile-ru-dark-${width}`);
  }
  await check('Russian mobile dark theme passes automated WCAG checks', () => scanAccessibility('mobile Russian dark'));
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await check(`Russian tablet ${width}px has no horizontal overflow`, noHorizontalOverflow);
  }
  await page.locator('[data-language="en"]').click();
  await page.locator('#theme-toggle').click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await revealAll();
    await check(`English mobile ${width}px has no horizontal overflow`, noHorizontalOverflow);
    if (width === 390) await screenshot('mobile-en-light-390');
  }
  await check('English mobile light theme passes automated WCAG checks', () => scanAccessibility('mobile English light'));
  await check('Motion pause works by keyboard and survives reload with content visible', async () => {
    await page.locator('#motion-toggle').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('html').evaluate(element => element.classList.contains('motion-paused')));
    const playStates = await page.locator('.portal-image, .ticker-track').evaluateAll(elements => elements.map(element => getComputedStyle(element).animationPlayState));
    assert.ok(playStates.every(value => value === 'paused'), JSON.stringify(playStates));
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#motion-toggle').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(() => [...document.querySelectorAll('.hero-copy, .hero-art')].every(element => getComputedStyle(element).opacity === '1'), undefined, { timeout: 3000 });
    const hidden = await page.locator('.hero-copy, .hero-art').evaluateAll(elements => elements.filter(element => getComputedStyle(element).opacity !== '1').map(element => element.className));
    assert.deepEqual(hidden, []);
  });
  await page.locator('#motion-toggle').click();
  await check('Reduced motion disables animated decoration and keeps content visible', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'networkidle' });
    const hidden = await page.locator('.reveal').evaluateAll(elements => elements.filter(element => getComputedStyle(element).opacity !== '1').map(element => element.className));
    assert.deepEqual(hidden, []);
    const animations = await page.locator('.portal-image, .ticker-track, .hero-art, .hero-copy').evaluateAll(elements => elements.map(element => getComputedStyle(element).animationName));
    assert.ok(animations.every(value => value === 'none'), JSON.stringify(animations));
    assert.equal(await page.locator('html').evaluate(element => getComputedStyle(element).scrollBehavior), 'auto');
    assert.equal(await page.locator('#motion-toggle').isDisabled(), true);
    assert.match(await page.locator('#motion-toggle').getAttribute('aria-label'), /Reduced motion/);
  });
  await check('Preferences work when localStorage is unavailable', async () => {
    const isolatedContext = await browser.newContext();
    try {
      await isolatedContext.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked for QA', 'SecurityError'); } });
      });
      const isolatedPage = await isolatedContext.newPage();
      const isolatedErrors = [];
      isolatedPage.on('pageerror', error => isolatedErrors.push(error.message));
      await isolatedPage.goto(baseURL, { waitUntil: 'networkidle' });
      await isolatedPage.locator('[data-language="ru"]').click();
      await isolatedPage.locator('#theme-toggle').click();
      assert.equal(await isolatedPage.locator('html').getAttribute('lang'), 'ru');
      assert.equal(await isolatedPage.locator('html').getAttribute('data-theme'), 'light');
      assert.deepEqual(isolatedErrors, []);
    } finally { await isolatedContext.close(); }
  });

  await check('No browser errors or failed asset requests', async () => {
    assert.deepEqual(errors, []);
    assert.deepEqual(failedRequests, []);
  });
} finally {
  await browser.close();
  await writeFile(fileURLToPath(new URL('./qa-report.json', import.meta.url)), JSON.stringify({ baseURL, browser: `Chromium ${browserVersion}`, results }, null, 2) + '\n');
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`);
  console.log(`${results.filter(result => result.passed).length}/${results.length} checks passed.`);
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
