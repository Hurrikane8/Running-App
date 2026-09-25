// Render frames of the built page at given times: node tools/snap.mjs out_dir t1 t2 ...
// Playwright: set PLAYWRIGHT_MODULE to its index.mjs if it isn't at the default path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const here = path.dirname(fileURLToPath(import.meta.url));
const page_ = path.resolve(here, '..', 'index.html');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const times = process.argv.slice(3).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
page.on('console', (m) => console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('file://' + page_ + '?render');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate((t) => window.__render(t), t);
  await page.screenshot({ path: path.join(out, `f_${t.toFixed(2).padStart(6, '0')}.png`) });
  if (process.env.V) console.log(t, Date.now() - t0, 'ms');
}
await browser.close();
