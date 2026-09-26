// Core animation engine: math, easing, colour, morphable shapes, text, timing.
// Every frame is a pure function of time t (seconds) so frames can be rendered
// in any order and the output is fully deterministic.

const W = 1920, H = 1080, CX = W / 2, CY = H / 2;
const TAU = Math.PI * 2;
let ctx;

// ---------------------------------------------------------------- math
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const E = {
  lin: t => t,
  in: t => t * t * t,
  out: t => 1 - Math.pow(1 - t, 3),
  out5: t => 1 - Math.pow(1 - t, 5),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOut5: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  back: (t, s = 1.9) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.7) => (s + 1) * t * t * t - s * t * t,
  elastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
// deterministic hash-based random in [0,1)
function rnd(i, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 17.13) * 43758.5453;
  return x - Math.floor(x);
}
const rr = (i, salt, a, b) => a + (b - a) * rnd(i, salt);

// Appear/disappear envelope. Returns scale-like factor (0..~1.1).
function pop(t, t0, d = 0.5, s = 2.0) {
  const p = inv(t0, t0 + d, t);
  return p <= 0 ? 0 : E.back(p, s);
}
function unpop(t, t1, d = 0.35) {
  const p = inv(t1, t1 + d, t);
  return p <= 0 ? 1 : p >= 1 ? 0 : 1 - E.inBack(p, 1.6);
}
function life(t, tin, tout = 1e9, din = 0.5, dout = 0.35) {
  return Math.max(0, pop(t, tin, din) * unpop(t, tout, dout));
}
function fade(t, tin, tout = 1e9, din = 0.4, dout = 0.4) {
  return inv(tin, tin + din, t) * (1 - inv(tout, tout + dout, t));
}

// ---------------------------------------------------------------- colour
const _cc = {};
function rgb(hex) {
  if (_cc[hex]) return _cc[hex];
  if (hex.startsWith('rgb')) return (_cc[hex] = hex.replace(/[^\d,.]/g, '').split(',').slice(0, 3).map(Number));
  const h = hex.replace('#', '');
  const v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  return (_cc[hex] = v);
}
function mix(a, b, p) {
  const A = rgb(a), B = rgb(b);
  p = clamp(p);
  return `rgb(${Math.round(lerp(A[0], B[0], p))},${Math.round(lerp(A[1], B[1], p))},${Math.round(lerp(A[2], B[2], p))})`;
}
function mixHex(a, b, p) {
  const A = rgb(a), B = rgb(b);
  p = clamp(p);
  const h = x => Math.round(x).toString(16).padStart(2, '0');
  return '#' + h(lerp(A[0], B[0], p)) + h(lerp(A[1], B[1], p)) + h(lerp(A[2], B[2], p));
}
function rgba(hex, a) {
  const A = rgb(hex);
  return `rgba(${A[0]},${A[1]},${A[2]},${a})`;
}

const P = {
  navy: '#1b2236', navy2: '#252f49', navy3: '#33405f', slate: '#23304a',
  ink: '#1c1f2b', cream: '#f4ecdc', paper: '#efe3c8', parch: '#eadbbb', white: '#fffaf0',
  gold: '#f2b53c', gold2: '#d8962a', gold3: '#ffd978', coral: '#e8664f', coral2: '#c44d3a',
  teal: '#2a9d8f', teal2: '#1d7469', sky: '#9fd0dc', water: '#3a9ea3', water2: '#2b7d88',
  green: '#6fb07a', green2: '#3e7f56', grass: '#8cbc6c', grass2: '#76a85a',
  bill: '#9fcb86', bill2: '#5f9a55', bill3: '#d9ecc4',
  plum: '#5b4a7a', plum2: '#7c6795', brown: '#8a5a3c', brown2: '#6b4430', wood: '#b07a4c',
  peach: '#f6d9b8', sand: '#e7d3a4', road: '#d9c08c', red: '#d9493a', grey: '#9aa0ab', grey2: '#6c7280',
  skin1: '#f3c7a0', skin2: '#d9a077', skin3: '#a86c45', skin4: '#6f4630',
};

// ---------------------------------------------------------------- shapes
// A shape is an array of [x,y] points (closed, clockwise on screen).
const NS = 200;
function signedArea(S) {
  let a = 0;
  for (let i = 0; i < S.length; i++) {
    const [x1, y1] = S[i], [x2, y2] = S[(i + 1) % S.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
function resample(pts, n = NS) {
  const L = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1], b = pts[i % pts.length];
    L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = L[L.length - 1];
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (k / n) * total;
    while (L[j + 1] < d) j++;
    const a = pts[j], b = pts[(j + 1) % pts.length];
    const seg = L[j + 1] - L[j] || 1;
    const u = (d - L[j]) / seg;
    out.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u)]);
  }
  if (signedArea(out) < 0) out.reverse();
  return rotateToTop(out);
}
// rotate index so point 0 is the top-most (min y), for stable morph alignment
function rotateToTop(S) {
  let bi = 0, cx = 0;
  for (const p of S) cx += p[0];
  cx /= S.length;
  let best = 1e9;
  for (let i = 0; i < S.length; i++) {
    const sc = S[i][1] + Math.abs(S[i][0] - cx) * 0.35;
    if (sc < best) { best = sc; bi = i; }
  }
  return S.slice(bi).concat(S.slice(0, bi));
}
function ellipseS(cx, cy, rx, ry = rx, n = NS) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / n) * TAU;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
const circleS = (cx, cy, r, n) => ellipseS(cx, cy, r, r, n);
function rrectS(x, y, w, h, r, n = NS) {
  r = Math.min(r, w / 2, h / 2);
  const pts = [];
  const arc = (cx, cy, a0) => {
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (k / 8) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  pts.push([x + w / 2, y]);
  arc(x + w - r, y + r, -Math.PI / 2);
  arc(x + w - r, y + h - r, 0);
  arc(x + r, y + h - r, Math.PI / 2);
  arc(x + r, y + r, Math.PI);
  return resample(dedupe(pts), n);
}
function polyS(pts, n = NS) { return resample(dedupe(pts), n); }
function dedupe(pts) {
  const o = [];
  for (const p of pts) {
    const q = o[o.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) o.push(p);
  }
  return o;
}
let _svgHost;
const _pathCache = {};
function pathS(d, n = NS) {
  const key = d + '|' + n;
  if (_pathCache[key]) return _pathCache[key];
  if (!_svgHost) {
    _svgHost = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    _svgHost.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.appendChild(_svgHost);
  }
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  _svgHost.appendChild(p);
  const L = p.getTotalLength();
  const pts = [];
  const M = n * 4;
  for (let k = 0; k < M; k++) {
    const q = p.getPointAtLength((k / M) * L);
    pts.push([q.x, q.y]);
  }
  _svgHost.removeChild(p);
  return (_pathCache[key] = resample(pts, n));
}
function xf(S, dx = 0, dy = 0, s = 1, sy = s, rot = 0) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  return S.map(([x, y]) => [dx + (x * c - y * sn) * s, dy + (x * sn + y * c) * sy]);
}
// Align B's starting index to A so the morph doesn't twist.
const _alignCache = new Map();
function align(A, B, key) {
  if (key && _alignCache.has(key)) return _alignCache.get(key);
  const n = A.length;
  const ca = centroid(A), cb = centroid(B);
  let best = 1e18, off = 0;
  for (let o = 0; o < n; o += 1) {
    let d = 0;
    for (let i = 0; i < n; i += 4) {
      const a = A[i], b = B[(i + o) % n];
      const dx = (a[0] - ca[0]) - (b[0] - cb[0]), dy = (a[1] - ca[1]) - (b[1] - cb[1]);
      d += dx * dx + dy * dy;
    }
    if (d < best) { best = d; off = o; }
  }
  const out = B.slice(off).concat(B.slice(0, off));
  if (key) _alignCache.set(key, out);
  return out;
}
function centroid(S) {
  let x = 0, y = 0;
  for (const p of S) { x += p[0]; y += p[1]; }
  return [x / S.length, y / S.length];
}
function morph(A, B, p) {
  p = clamp(p);
  if (p <= 0) return A;
  if (p >= 1) return B;
  return A.map((a, i) => [lerp(a[0], B[i][0], p), lerp(a[1], B[i][1], p)]);
}
function tracePath(S) {
  ctx.beginPath();
  ctx.moveTo(S[0][0], S[0][1]);
  for (let i = 1; i < S.length; i++) ctx.lineTo(S[i][0], S[i][1]);
  ctx.closePath();
}
function fillS(S, color, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  tracePath(S);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- drawing helpers
function save() { ctx.save(); }
function restore() { ctx.restore(); }
function at(x, y, s = 1, rot = 0, fn, sy) {
  if (s <= 0.0001 && (sy === undefined || sy <= 0.0001)) return;
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(s, sy === undefined ? s : sy);
  fn();
  ctx.restore();
}
function alpha(a, fn) {
  if (a <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  fn();
  ctx.restore();
}
function circle(x, y, r, color) {
  if (r <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function ring(x, y, r, w, color) {
  if (r <= 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}
function ellipse(x, y, rx, ry, color, rot = 0) {
  if (rx <= 0 || ry <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}
function rrect(x, y, w, h, r, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}
function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
function line(x1, y1, x2, y2, w, color, cap = 'round') {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function poly(pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}
function strokePoly(pts, w, color, closed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
  ctx.stroke();
}
// Partial stroke along a polyline, 0..1 of its length (for draw-on effects).
function strokePartial(pts, p, w, color, dash) {
  if (p <= 0) return;
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const target = L[L.length - 1] * clamp(p);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (L[i] <= target) out.push(pts[i]);
    else {
      const u = (target - L[i - 1]) / (L[i] - L[i - 1] || 1);
      out.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]);
      break;
    }
  }
  ctx.save();
  if (dash) ctx.setLineDash(dash);
  strokePoly(out, w, color);
  ctx.restore();
  return out[out.length - 1];
}
function pointAlong(pts, p) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const target = L[L.length - 1] * clamp(p);
  for (let i = 1; i < pts.length; i++) {
    if (L[i] >= target) {
      const u = (target - L[i - 1]) / (L[i] - L[i - 1] || 1);
      return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u), Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])];
    }
  }
  const n = pts.length;
  return [pts[n - 1][0], pts[n - 1][1], 0];
}
function bezierPts(p0, p1, p2, p3, n = 60) {
  const o = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n, v = 1 - u;
    o.push([
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ]);
  }
  return o;
}
function arrowHead(x, y, ang, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size * 0.9, 0);
  ctx.lineTo(-size * 0.6, -size * 0.75);
  ctx.quadraticCurveTo(-size * 0.25, 0, -size * 0.6, size * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- text
const FONTS = {
  serif: 'Fraunces', sans: 'Inter', hand: 'Caveat',
};
function font(size, weight = 700, fam = 'sans') {
  return `${weight} ${size}px ${FONTS[fam] || fam}`;
}
function text(s, x, y, o = {}) {
  const { size = 40, weight = 700, fam = 'sans', color = P.cream, align = 'center', base = 'middle', ls = 0, a = 1 } = o;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.font = font(size, weight, fam);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.letterSpacing = ls + 'px';
  if (o.stroke) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.strokeW || 8;
    ctx.strokeText(s, x, y);
  }
  ctx.fillText(s, x, y);
  ctx.restore();
}
function measure(s, o = {}) {
  const { size = 40, weight = 700, fam = 'sans', ls = 0 } = o;
  ctx.save();
  ctx.font = font(size, weight, fam);
  ctx.letterSpacing = ls + 'px';
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}
// Kinetic line: words pop in one after another, each rising & scaling.
// `times` can be a single start time (auto-stagger) or an array per word.
// Words wrapped in *asterisks* get the accent colour.
function kinetic(s, x, y, t, times, o = {}) {
  const words = s.split(' ');
  const size = o.size || 72;
  const gap = Math.max(measure(' ', o), size * 0.26);
  const clean = words.map(w => w.replace(/\*/g, ''));
  const ws = clean.map(w => measure(w, o));
  const total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  let cx = o.align === 'left' ? x : x - total / 2;
  const stagger = o.stagger || 0.09;
  const out = o.out;
  for (let i = 0; i < words.length; i++) {
    const t0 = Array.isArray(times) ? times[i] : times + i * stagger;
    const p = inv(t0, t0 + (o.dur || 0.45), t);
    if (p > 0) {
      let sc = 0.7 + 0.3 * E.back(p, 2.6);
      let al = clamp(p * 3);
      let dy = (1 - E.out(p)) * size * 0.5;
      if (out !== undefined) {
        const q = inv(out + i * 0.03, out + i * 0.03 + 0.3, t);
        al *= 1 - q;
        dy -= E.in(q) * size * 0.4;
      }
      const accent = /\*/.test(words[i]);
      const wx = cx + ws[i] / 2;
      at(wx, y + dy, sc, 0, () => {
        text(clean[i], 0, 0, { ...o, align: 'center', color: accent ? (o.accent || P.gold) : (o.color || P.cream), a: al });
      });
    }
    cx += ws[i] + gap;
  }
  return total;
}
// Hand-drawn underline / strike that draws on.
function scribble(x1, y1, x2, y2, p, w, color, wobble = 3, seed = 1) {
  const pts = [];
  for (let k = 0; k <= 20; k++) {
    const u = k / 20;
    pts.push([lerp(x1, x2, u), lerp(y1, y2, u) + Math.sin(u * 9 + seed) * wobble]);
  }
  strokePartial(pts, p, w, color);
}

// ---------------------------------------------------------------- timeline helpers
let TL, CUE = {};
function initTimeline(tl) {
  TL = tl;
  for (const c of tl.cues) CUE[c.id] = c;
}
const S = id => CUE[id].start;
const Eend = id => CUE[id].end;
// time the k-th occurrence of `word` is spoken in line `id`
function Wd(id, word, k = 0) {
  const ws = CUE[id].words;
  let n = 0;
  for (const [w, t] of ws) if (w === word && n++ === k) return t;
  console.warn('word not found', id, word);
  return CUE[id].start;
}

// ---------------------------------------------------------------- sound cue registry
// Scenes register sound effects at the time they build their timelines;
// the renderer exports the list so the audio mixer can place them.
const SFX = [];
function sfx(t, type, gain = 1, extra = {}) { SFX.push({ t: +t.toFixed(3), type, gain, ...extra }); }

// ---------------------------------------------------------------- post: grain + vignette
let grainCanvas;
function makeGrain() {
  grainCanvas = document.createElement('canvas');
  grainCanvas.width = grainCanvas.height = 512;
  const g = grainCanvas.getContext('2d');
  const img = g.createImageData(512, 512);
  let seed = 1234567;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function post(t, frame) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // film grain, jittered every frame
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.06;
  // static paper-like grain (animated grain would balloon the video bitrate)
  const ox = 0, oy = 0;
  const pat = ctx.createPattern(grainCanvas, 'repeat');
  ctx.translate(-ox, -oy);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W + 512, H + 512);
  ctx.restore();
  // vignette
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(CX, CY, H * 0.45, CX, CY, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,8,20,0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
