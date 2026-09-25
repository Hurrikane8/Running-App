// Render the soundtrack offline in Chromium: node tools/mix.mjs out.wav [query]
// Playwright: set PLAYWRIGHT_MODULE to its index.mjs if it isn't at the default path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => console.log('console:', m.text()));
await page.goto('file://' + path.resolve(here, '..', 'index.html') + '?render' + (process.argv[3] || ''));
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
const b64 = await page.evaluate(() => window.__audio());
fs.writeFileSync(process.argv[2], Buffer.from(b64, 'base64'));
console.log('wrote', process.argv[2]);
await browser.close();
