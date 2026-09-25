// Real playback smoke test: tap to start, sample frames, pause, seek, check errors.
// Playwright: set PLAYWRIGHT_MODULE to its index.mjs if it isn't at the default path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto('file://' + path.resolve(here, '..', 'index.html'));
await page.waitForTimeout(1500);
await page.screenshot({ path: out + '/live_idle.png' });
const t0 = Date.now();
await page.mouse.click(200, 360);
for (const s of [2.0, 8.5]) {
  await page.waitForTimeout(s * 1000 - (Date.now() - t0));
  await page.screenshot({ path: out + `/live_${s}.png` });
}
await page.keyboard.press(' '); // pause
await page.waitForTimeout(800);
await page.screenshot({ path: out + '/live_paused.png' });
await page.keyboard.press(' '); // resume
await page.keyboard.press('ArrowRight'); // +5 s
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '/live_seek.png' });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
