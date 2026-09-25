// Render the piece to an MP4 (1080x1920, frame-perfect, with the full mix):
//   node tools/export.mjs out.mp4 [fps=60] [workers=4]
// Needs Playwright's Chromium and ffmpeg (set FFMPEG=/path/to/ffmpeg if not on PATH).
// CRF=20 (default) keeps the file around 25 MB; lower means larger and sharper.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const page_ = 'file://' + path.resolve(here, '..', 'index.html');
const out = path.resolve(process.argv[2] || 'cantillon-effect.mp4');
const fps = Number(process.argv[3] || 60);
const workers = Number(process.argv[4] || 4);
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cantillon-'));
const limit = Number(process.env.FRAMES || 0);

const browser = await chromium.launch();
const open = async (query = '') => {
  const p = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  p.on('pageerror', (e) => console.error('pageerror:', e.message));
  await p.goto(page_ + '?render' + query);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return p;
};

// soundtrack
const ap = await open();
const dur = await ap.evaluate(() => window.__duration);
fs.writeFileSync(path.join(tmp, 'mix.wav'), Buffer.from(await ap.evaluate(() => window.__audio()), 'base64'));
await ap.close();

// frames, rendered in parallel (every frame is a pure function of time)
const total = limit || Math.floor(dur * fps) + 1;
let done = 0;
const t0 = Date.now();
await Promise.all(
  Array.from({ length: workers }, async (_, w) => {
    const p = await open('&grain=0');
    for (let i = w; i < total; i += workers) {
      const b64 = await p.evaluate((t) => {
        window.__render(t);
        return document.getElementById('c').toDataURL('image/jpeg', 0.95).split(',')[1];
      }, Math.min(i / fps, dur));
      fs.writeFileSync(path.join(tmp, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(b64, 'base64'));
      if (++done % 300 === 0) console.log(`${done}/${total} frames, ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
    }
    await p.close();
  })
);
await browser.close();

// encode
await new Promise((res, rej) => {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-framerate', String(fps), '-i', path.join(tmp, 'f%05d.jpg'),
    '-i', path.join(tmp, 'mix.wav'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(process.env.CRF || 20), '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-level', '4.2', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out,
  ];
  const f = spawn(ffmpeg, args, { stdio: 'inherit' });
  f.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
