// Drives the animation page in headless Chromium.
//   node render.js stills <out_dir> t1,t2,...        -> PNG stills for review
//   node render.js video <out.mp4> [fps] [from] [to] -> silent H.264 video
//   node render.js sfx <out.json>                    -> sound-effect cue list
const { chromium } = require(process.env.PW_CORE || 'playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXE = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

async function open() {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(ROOT, process.env.PAGE || 'index.html') + '?render');
  await page.waitForFunction(() => window.ready === true, null, { timeout: 20000 });
  return { browser, page };
}

(async () => {
  const [mode, out, a3, a4, a5] = process.argv.slice(2);
  const { browser, page } = await open();
  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const ts of a3.split(',')) {
      const t = parseFloat(ts);
      const url = await page.evaluate(t => window.grabPng(t), t);
      fs.writeFileSync(path.join(out, `f_${t.toFixed(2).padStart(7, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
  } else if (mode === 'sfx') {
    const list = await page.evaluate(() => ({ duration: window.DURATION, sfx: window.SFX_LIST }));
    fs.writeFileSync(out, JSON.stringify(list, null, 1));
    console.log('sfx cues:', list.sfx.length);
  } else if (mode === 'video') {
    const fps = parseInt(a3 || '30', 10);
    const dur = await page.evaluate(() => window.DURATION);
    const from = a4 ? parseFloat(a4) : 0, to = a5 ? parseFloat(a5) : dur;
    const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', process.env.X264_PRESET || 'medium', '-crf', process.env.CRF || '18', '-pix_fmt', 'yuv420p', '-tune', 'animation', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    const BATCH = 6;
    for (let f = f0; f < f1; f += BATCH) {
      const frames = [];
      for (let k = f; k < Math.min(f + BATCH, f1); k++) frames.push(k);
      const urls = await page.evaluate(({ frames, fps }) => frames.map(k => window.grab(k / fps, k, 0.95)), { frames, fps });
      for (const u of urls) {
        const buf = Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      if ((f - f0) % (fps * 10) < BATCH) {
        const el = (Date.now() - t0) / 1000;
        process.stderr.write(`frame ${f}/${f1}  ${(el).toFixed(0)}s elapsed\n`);
      }
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
