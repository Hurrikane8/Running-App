/* ==========================================================================
   THE CANTILLON EFFECT: a 9:16 motion-graphics explainer.
   Every frame is a pure function of time: render(t). Nothing accumulates
   between frames, so playback is frame-rate independent and seekable, and
   the narration's audio clock drives the picture.
   ========================================================================== */

/* ---------- math ---------- */
const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const smooth = (x) => x * x * (3 - 2 * x);

const E = {
  lin: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  io2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in3: (t) => t * t * t,
  out3: (t) => 1 - Math.pow(1 - t, 3),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out4: (t) => 1 - Math.pow(1 - t, 4),
  io4: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  out5: (t) => 1 - Math.pow(1 - t, 5),
  io5: (t) => (t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  ioSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  ioExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  ioBack: (t, s = 1.70158 * 1.525) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((s + 1) * 2 * t - s)) / 2
      : (Math.pow(2 * t - 2, 2) * ((s + 1) * (t * 2 - 2) + s) + 2) / 2,
  outElastic: (t) =>
    t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
};
/** eased progress of t through [a, b] */
const ez = (t, a, b, f = E.io3) => f(prog(t, a, b));
/** 0→1 pop with overshoot, starting at a, lasting d */
const pop = (t, a, d = 0.42, s = 1.9) => (t <= a ? 0 : t >= a + d ? 1 : E.outBack(prog(t, a, a + d), s));
/** 1→0 exit that winds up before it goes */
const pout = (t, a, d = 0.32) => (t <= a ? 1 : t >= a + d ? 0 : 1 - E.inBack(prog(t, a, a + d), 2.2));
/** damped oscillation after an impulse at t0: follow-through for squash & stretch */
const wob = (t, t0, f = 3.2, k = 7) => (t < t0 ? 0 : Math.exp(-k * (t - t0)) * Math.sin(TAU * f * (t - t0)));
/** in-window envelope: fades in over fi after a, out over fo before b */
const win = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(ez(t, a, a + fi, E.out2), 1 - ez(t, b - fo, b, E.in2));
/* ---------- deterministic randomness ---------- */
function R(i, s = 0) {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((s | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const RS = (i, s, a, b) => lerp(a, b, R(i, s));

/* ---------- palette: a midnight treasury ---------- */
const PAL = {
  night: '#0b0d2e',
  night2: '#141747',
  dusk: '#252a6e',
  dusk2: '#343a8c',
  duskHi: '#4a51ad',
  ink: '#06071d',
  gold: '#ffc23d',
  goldHi: '#ffe7a1',
  goldLo: '#d98a14',
  goldDeep: '#9e5a06',
  mint: '#3fe0b0',
  mintHi: '#b8f8e3',
  mintLo: '#169b7b',
  mintDeep: '#0b5e4b',
  coral: '#ff5a6a',
  coralHi: '#ffa7ae',
  coralLo: '#c73450',
  lilac: '#9d8dff',
  lilacLo: '#6a58d8',
  amber: '#ff9e44',
  amberLo: '#d4701c',
  wine: '#b8365a',
  wineLo: '#83203f',
  paper: '#f4e7c9',
  paperLo: '#d9c396',
  wood: '#a46a44',
  woodLo: '#6f4229',
  stone: '#dcd8f4',
  stoneLo: '#a9a3d6',
  snow: '#f7f5ff',
  mist: '#b8b4e8',
  fog: '#7d79b8',
};
const hex3 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const RGB = {};
for (const k in PAL) RGB[k] = hex3(PAL[k]);
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixRGB = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** mix two palette names (or rgb arrays) → css string */
const mix = (a, b, t, alpha = 1) =>
  rgba(mixRGB(typeof a === 'string' ? RGB[a] || hex3(a) : a, typeof b === 'string' ? RGB[b] || hex3(b) : b, clamp(t)), alpha);

/* ---------- narration cues ---------- */
const TIMING = JSON.parse(document.getElementById('timing').textContent);
const DUR = TIMING.duration;
const LINES = {};
for (const l of TIMING.lines) LINES[l.id] = l;
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
/** line by id: {start, end, words, text} */
const L = (id) => {
  if (!LINES[id]) throw new Error('no line ' + id);
  return LINES[id];
};
/** word timing {s, e} by line id + word text (nth occurrence) */
function W(id, word, nth = 0) {
  let k = 0;
  for (const w of L(id).words) if (norm(w.w) === norm(word) && k++ === nth) return w;
  throw new Error(`no word "${word}" in ${id}`);
}
const Ws = (id, word, nth) => W(id, word, nth).s;

/* ---------- canvas & frame ---------- */
const cv = document.getElementById('c');
const ctx = cv.getContext('2d', { alpha: false });
const FW = 1080;
const FH = 1920;
const VIEW = { S: 1, OX: 0, OY: 0, W: 1080, H: 1920, clip: false };

function resize(fixed) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = fixed ? fixed[0] : window.innerWidth;
  const h = fixed ? fixed[1] : window.innerHeight;
  // Cap the backing store so a 4K monitor doesn't render 8 million pixels per frame.
  const cap = Math.min(1, 2600 / Math.max(1, h * dpr), 4200 / Math.max(1, w * dpr));
  cv.width = Math.round(w * dpr * cap);
  cv.height = Math.round(h * dpr * cap);
  VIEW.W = cv.width;
  VIEW.H = cv.height;
  VIEW.S = Math.min(cv.width / FW, cv.height / FH);
  VIEW.OX = (cv.width - FW * VIEW.S) / 2;
  VIEW.OY = (cv.height - FH * VIEW.S) / 2;
  // Portrait phones show a little extra world above/below; landscape screens
  // get a clean 9:16 frame so off-stage props never peek in from the sides.
  VIEW.clip = cv.width / cv.height > FW / FH + 0.02;
}
/** frame space: the 1080×1920 design canvas */
function toFrame() {
  ctx.setTransform(VIEW.S, 0, 0, VIEW.S, VIEW.OX, VIEW.OY);
}
/** visible frame-space bounds (a little taller than 1920 on tall phones) */
function frameBounds() {
  const top = -VIEW.OY / VIEW.S;
  const left = -VIEW.OX / VIEW.S;
  return { x0: left, y0: top, x1: left + VIEW.W / VIEW.S, y1: top + VIEW.H / VIEW.S };
}

/* camera: world → frame. (cx, cy) is the world point at frame centre. */
const CAM = { x: 540, y: 960, z: 1, r: 0 };
function applyCam() {
  ctx.translate(540, 960);
  if (CAM.r) ctx.rotate(CAM.r);
  ctx.scale(CAM.z, CAM.z);
  ctx.translate(-CAM.x, -CAM.y);
}
/** world → frame coordinates for the current camera */
function w2f(x, y) {
  const dx = (x - CAM.x) * CAM.z;
  const dy = (y - CAM.y) * CAM.z;
  const c = Math.cos(CAM.r);
  const s = Math.sin(CAM.r);
  return [540 + dx * c - dy * s, 960 + dx * s + dy * c];
}
/** frame → world coordinates for the current camera */
function f2w(x, y) {
  const dx = x - 540;
  const dy = y - 960;
  const c = Math.cos(-CAM.r);
  const s = Math.sin(-CAM.r);
  return [CAM.x + (dx * c - dy * s) / CAM.z, CAM.y + (dx * s + dy * c) / CAM.z];
}

/* ---------- paths ---------- */
function rrect(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, TAU);
}
function ellipse(x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
}
function poly(pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}
/** four-point sparkle star */
function starPath(x, y, r, rot = 0, pinch = 0.28) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 ? r * pinch : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/* ---------- polyline utilities (arc-length sampling) ---------- */
function makePath(pts) {
  const segs = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const l = Math.hypot(x1 - x0, y1 - y0);
    segs.push({ x0, y0, x1, y1, l, a: len });
    len += l;
  }
  return {
    len,
    at(u) {
      const d = clamp(u) * len;
      for (const s of segs) {
        if (d <= s.a + s.l || s === segs[segs.length - 1]) {
          const k = s.l ? (d - s.a) / s.l : 0;
          return [lerp(s.x0, s.x1, k), lerp(s.y0, s.y1, k), Math.atan2(s.y1 - s.y0, s.x1 - s.x0)];
        }
      }
      return [pts[0][0], pts[0][1], 0];
    },
  };
}
/* ---------- type ---------- */
const BRIC = '"Bricolage", "Avenir Next", "Segoe UI", system-ui, sans-serif';
const FELL = '"Fell", "Iowan Old Style", "Palatino Linotype", Georgia, serif';
const fBric = (px, w = 800) => `${w} ${px}px ${BRIC}`;
const fFell = (px, italic = false) => `${italic ? 'italic ' : ''}400 ${px}px ${FELL}`;
const _mcache = new Map();
function measure(text, font) {
  const k = font + '|' + text;
  let v = _mcache.get(k);
  if (v === undefined) {
    ctx.font = font;
    v = ctx.measureText(text).width;
    _mcache.set(k, v);
  }
  return v;
}
/** letter-spaced label (canvas letterSpacing isn't universal yet) */
function spaced(text, x, y, font, spacing, align = 'center') {
  ctx.font = font;
  let w = 0;
  const ws = [];
  for (const ch of text) {
    const cw = measure(ch, font);
    ws.push(cw);
    w += cw + spacing;
  }
  w -= spacing;
  let px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  let i = 0;
  for (const ch of text) {
    ctx.fillText(ch, px, y);
    px += ws[i++] + spacing;
  }
  ctx.textAlign = prev;
  return w;
}
function spacedWidth(text, font, spacing) {
  let w = 0;
  for (const ch of text) w += measure(ch, font) + spacing;
  return w - spacing;
}

/* ---------- sprites (pre-rendered once, stamped many times) ---------- */
function canvas2(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d')];
}
const GLOW = {};
function makeGlow(name, rgb) {
  const [c, g] = canvas2(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, rgba(rgb, 1));
  gr.addColorStop(0.18, rgba(rgb, 0.55));
  gr.addColorStop(0.5, rgba(rgb, 0.16));
  gr.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  GLOW[name] = c;
}
/** additive soft glow */
function glow(name, x, y, r, a = 1, g = ctx) {
  if (a <= 0.003 || r <= 0) return;
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = Math.min(1, a);
  g.drawImage(GLOW[name], x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = prev;
}
