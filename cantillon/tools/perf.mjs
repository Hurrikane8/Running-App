// Time the renderer at 1080x1920: node tools/perf.mjs
// Playwright: set PLAYWRIGHT_MODULE to its index.mjs if it isn't at the default path.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
await page.goto('file://' + path.resolve(here, '..', 'index.html') + '?render');
await page.waitForFunction(() => window.__ready === true);
const res = await page.evaluate(() => {
  const out = [];
  for (let s = 0; s < 69; s += 1) {
    const t0 = performance.now();
    for (let k = 0; k < 10; k++) { window.__render(s + k * 0.1); document.getElementById("c").getContext("2d").getImageData(0, 0, 1, 1); }
    out.push([s, (performance.now() - t0) / 10]);
  }
  return out;
});
res.sort((a, b) => b[1] - a[1]);
console.log('slowest seconds (ms/frame):', res.slice(0, 8).map(([s, m]) => `${s}s:${m.toFixed(1)}`).join('  '));
console.log('median ms/frame:', res.map((r) => r[1]).sort((a, b) => a - b)[Math.floor(res.length / 2)].toFixed(1));
await browser.close();
