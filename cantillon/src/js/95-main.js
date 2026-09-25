/* ==========================================================================
   Stage manager: boot, the clock, input, and the render loop.
   The narration's audio clock is the master clock whenever sound plays.
   ========================================================================== */

const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* options: ?query or #hash tokens (hash survives hosts that strip queries) */
const OPT = (() => {
  const q = new URLSearchParams(location.search);
  const h = new Set(location.hash.replace(/^#/, '').split(/[&,+]/).filter(Boolean));
  const on = (k) => q.has(k) || h.has(k);
  const off = (k) => q.get(k) === '0' || h.has('no' + k);
  return {
    autoplay: on('autoplay'),
    captions: on('captions'),
    grain: !off('grain'),
    music: !off('music'),
    voice: !off('voice'),
    sfx: !off('sfx'),
    mute: on('mute'),
    render: q.has('render'),
    debug: on('debug'),
    t: parseFloat(q.get('t') || '0') || 0,
  };
})();

let STATE = 'loading'; // loading → idle → playing ⇄ paused → ended
let clockMode = 'perf';
let perf0 = 0;
let pausedAt = 0;
let lastT = 0;
let frameNo = 0;
let startedAt = -1; // performance.now() at start, for the tap hint fade
let lineShown = '';

function clockNow() {
  if (STATE === 'paused') return pausedAt;
  if (clockMode === 'audio') {
    const t = audioClock() - AUD.t0;
    // never step backwards between frames (audio clocks report in chunks)
    lastT = Math.max(lastT, t);
    return lastT;
  }
  return (performance.now() - perf0) / 1000;
}

async function start(from = 0) {
  if (STATE === 'playing' || STATE === 'starting') return;
  STATE = 'starting';
  document.body.classList.add('playing');
  startedAt = performance.now();
  lastT = from;
  let ok = false;
  if (!OPT.mute) {
    try {
      ok = await audioStart(from);
    } catch (e) {
      ok = false;
    }
  }
  clockMode = ok ? 'audio' : 'perf';
  if (!ok) perf0 = performance.now() - from * 1000;
  STATE = 'playing';
  try {
    if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
  } catch (e) {
    /* optional */
  }
}
function pause() {
  if (STATE !== 'playing') return;
  pausedAt = clockNow();
  STATE = 'paused';
  if (clockMode === 'audio') AUD.ctx.suspend();
}
function resume() {
  if (STATE !== 'paused') return;
  if (clockMode === 'audio') AUD.ctx.resume();
  else perf0 = performance.now() - pausedAt * 1000;
  STATE = 'playing';
}
function seek(to) {
  to = clamp(to, 0, DUR - 0.05);
  const wasPaused = STATE === 'paused';
  audioStop();
  STATE = 'idle';
  start(to).then(() => {
    if (wasPaused) pause();
  });
}
function finish() {
  STATE = 'ended';
  document.body.classList.remove('playing');
  audioStop(true);
}

/* ---------- drawing the whole frame ---------- */
function render(t, fno) {
  camera(t);
  drawBackground(t);
  toFrame();
  if (VIEW.clip) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, FW, FH);
    ctx.clip();
  }
  ctx.save();
  applyCam();
  drawVitrine(t);
  drawCity(t);
  drawLedges(t);
  drawFlowPath(t);
  drawSource(t);
  drawNotes(t);
  drawPile(t);
  drawBaskets(t);
  drawChart(t);
  drawWave(t);
  drawDrop(t, 'back');
  drawQueue(t);
  drawCantillon(t);
  drawBank(t);
  drawFolk(t);
  drawCoins(t);
  drawCheck(t);
  drawBadges(t);
  drawLineLabels(t);
  drawLeak(t);
  drawTitle(t);
  draw1720(t);
  drawDrop(t, 'front');
  ctx.restore();
  // type (frame space; world-pinned blocks project themselves)
  for (const k in BLOCKS) drawBlock(BLOCKS[k], t);
  drawPriceTag(t);
  drawQuestion(t);
  if (OPT.captions) drawCaptions(t);
  if (VIEW.clip) ctx.restore();
  drawPost(t, fno);
}

function drawHint(now) {
  // a quiet "tap to play" that disappears the instant playback starts
  const k = STATE === 'idle' ? 1 : 1 - clamp((now - startedAt) / 250);
  if (k <= 0) return;
  toFrame();
  const p = (now / 1000) % 1.6;
  const y = 1650;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.strokeStyle = rgba(RGB.snow, 0.5 * (1 - p / 1.6));
  ctx.lineWidth = 3;
  circle(540, y, 30 + p * 28);
  ctx.stroke();
  ctx.fillStyle = rgba(RGB.snow, 0.85);
  poly([530, y - 14, 530, y + 14, 553, y]);
  ctx.fill();
  ctx.fillStyle = rgba(RGB.mist, 0.8);
  ctx.textAlign = 'center';
  spaced('TAP TO PLAY', 540, y + 92, fBric(26, 700), 6);
  ctx.restore();
}

function drawCaptions(t) {
  const line = TIMING.lines.find((l) => t >= l.start - 0.05 && t <= l.end + 0.35);
  if (!line) return;
  const f = fBric(40, 700);
  const words = line.text.split(' ');
  const spoken = line.words;
  // wrap into lines of ≤ 28 characters
  const rows = [];
  let row = [];
  let len = 0;
  words.forEach((w, i) => {
    if (len + w.length > 28 && row.length) {
      rows.push(row);
      row = [];
      len = 0;
    }
    row.push(i);
    len += w.length + 1;
  });
  if (row.length) rows.push(row);
  const lh = 52;
  const y0 = 1400 - (rows.length - 1) * lh;
  ctx.save();
  ctx.font = f;
  const maxW = Math.max(...rows.map((r) => measure(r.map((i) => words[i]).join(' '), f)));
  ctx.fillStyle = 'rgba(6,7,28,0.72)';
  rrect(540 - maxW / 2 - 28, y0 - 50, maxW + 56, rows.length * lh + 30, 26);
  ctx.fill();
  ctx.textAlign = 'left';
  rows.forEach((r, ri) => {
    const text = r.map((i) => words[i]).join(' ');
    let x = 540 - measure(text, f) / 2;
    for (const i of r) {
      const sw = spoken[Math.min(i, spoken.length - 1)];
      const said = sw && t >= sw.s;
      ctx.fillStyle = said ? PAL.snow : rgba(RGB.mist, 0.55);
      ctx.fillText(words[i], x, y0 + ri * lh);
      x += measure(words[i] + ' ', f);
    }
  });
  ctx.restore();
}

function drawDebug(t) {
  toFrame();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(20, 20, 330, 60);
  ctx.fillStyle = '#0f0';
  ctx.font = '28px monospace';
  ctx.textAlign = 'left';
  const line = TIMING.lines.find((l) => t >= l.start && t <= l.end + 0.6);
  ctx.fillText(`${t.toFixed(2)}s ${line ? line.id : ''}`, 32, 60);
}

function updateLive(t) {
  const line = TIMING.lines.find((l) => t >= l.start && t <= l.end);
  const text = line ? line.text : '';
  if (line && text !== lineShown) {
    lineShown = text;
    document.getElementById('cc').textContent = text;
  }
}

/* ---------- loop ---------- */
function loop(now) {
  if (STATE === 'render') return;
  requestAnimationFrame(loop);
  let t = 0;
  if (STATE === 'playing') {
    t = clockNow();
    if (t >= DUR) {
      t = DUR;
      finish();
    }
  } else if (STATE === 'paused') t = pausedAt;
  else if (STATE === 'ended') t = DUR;
  else if (STATE === 'starting') t = lastT;
  if (STATE === 'loading') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.night;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);
    return;
  }
  render(t, frameNo++);
  drawHint(now);
  if (OPT.debug) drawDebug(t);
  if (STATE === 'playing') updateLive(t);
}

/* ---------- input ---------- */
function onTap(e) {
  if (e && e.button > 0) return;
  audioUnlock(); // must happen inside the gesture on iOS
  if (STATE === 'idle') start(OPT.t);
  else if (STATE === 'ended') {
    STATE = 'idle';
    start(0);
  }
}
function onKey(e) {
  const k = e.key;
  if (k === ' ' || k === 'Enter' || k === 'k') {
    e.preventDefault();
    audioUnlock();
    if (STATE === 'idle') start(OPT.t);
    else if (STATE === 'playing') pause();
    else if (STATE === 'paused') resume();
    else if (STATE === 'ended') {
      STATE = 'idle';
      start(0);
    }
  } else if (k === 'r' || k === 'R') {
    audioUnlock();
    seek(0);
  } else if (k === 'ArrowRight' || k === 'ArrowLeft') {
    if (STATE === 'playing' || STATE === 'paused') seek(clockNow() + (k === 'ArrowRight' ? 5 : -5));
  } else if (k === 'c' || k === 'C') {
    OPT.captions = !OPT.captions;
  } else if (k === 'm' || k === 'M') {
    audioToggleMute();
  } else if (k === 'f' || k === 'F') {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
}

/* ---------- boot ---------- */
async function boot() {
  resize();
  requestAnimationFrame(loop);
  try {
    await Promise.all([
      document.fonts.load(fBric(100, 800)),
      document.fonts.load(fBric(100, 700)),
      document.fonts.load(fFell(100)),
      document.fonts.load(fFell(100, true)),
    ]);
    await document.fonts.ready;
  } catch (e) {
    /* fall back to system faces */
  }
  _mcache.clear();
  buildSprites();
  buildScreenCache();
  initTimeline();
  initLine();
  initHookType();
  initTodayType();
  initFinaleType();
  initLeak();
  initTitle();
  initNotes();
  buildSfx();
  window.addEventListener('resize', () => {
    resize();
    buildScreenCache();
  });
  if (OPT.render) {
    // deterministic frame access for tooling: window.__render(seconds)
    window.__duration = DUR;
    window.__render = (t) => {
      render(t, Math.round(t * 60));
      return true;
    };
    window.__audio = async () => {
      // 16-bit stereo WAV of the full mix, base64
      const b = await audioRenderOffline();
      const n = b.length;
      const L0 = b.getChannelData(0);
      const R0 = b.getChannelData(1);
      const out = new DataView(new ArrayBuffer(44 + n * 4));
      const w = (o, s) => [...s].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
      w(0, 'RIFF');
      out.setUint32(4, 36 + n * 4, true);
      w(8, 'WAVEfmt ');
      out.setUint32(16, 16, true);
      out.setUint16(20, 1, true);
      out.setUint16(22, 2, true);
      out.setUint32(24, b.sampleRate, true);
      out.setUint32(28, b.sampleRate * 4, true);
      out.setUint16(32, 4, true);
      out.setUint16(34, 16, true);
      w(36, 'data');
      out.setUint32(40, n * 4, true);
      for (let i = 0; i < n; i++) {
        out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L0[i])) * 32767, true);
        out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R0[i])) * 32767, true);
      }
      const bytes = new Uint8Array(out.buffer);
      let s = '';
      for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
      return btoa(s);
    };
    STATE = 'render';
    window.__ready = true;
    return;
  }
  audioPrepare();
  STATE = 'idle';
  window.addEventListener('pointerup', onTap);
  window.addEventListener('keydown', onKey);
  if (OPT.autoplay) start(OPT.t);
}
boot();
