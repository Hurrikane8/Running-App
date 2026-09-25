/* ==========================================================================
   Backdrop, the hook (a sealed vitrine whose banknote shrinks anyway),
   the leak, and the particle title.
   ========================================================================== */

/* ---------- backdrop ----------
   The sky and every large soft glow are painted into a quarter-resolution
   buffer and stretched to the screen: they are blurry by nature, and this
   keeps full-screen additive blending off the per-frame budget. */
let VIGN = null;
const BG = { c: null, g: null, k: 0.25, grad: null };
function buildScreenCache() {
  const [c, g] = canvas2(VIEW.W, VIEW.H);
  const cx = VIEW.W / 2;
  const cy = VIEW.H * 0.47;
  const r = Math.hypot(VIEW.W, VIEW.H) * 0.62;
  const gr = g.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
  gr.addColorStop(0, 'rgba(3,4,18,0)');
  gr.addColorStop(1, 'rgba(3,4,18,0.62)');
  g.fillStyle = gr;
  g.fillRect(0, 0, VIEW.W, VIEW.H);
  VIGN = c;
  [BG.c, BG.g] = canvas2(Math.max(8, VIEW.W * BG.k), Math.max(8, VIEW.H * BG.k));
  const lg = BG.g.createLinearGradient(0, 0, 0, BG.c.height);
  lg.addColorStop(0, '#13164d');
  lg.addColorStop(0.5, '#0c0e35');
  lg.addColorStop(1, '#070820');
  BG.grad = lg;
}

/** how hot prices are running, 0..1 (tints the world during the line) */
function heat(t) {
  let p = 1;
  for (const [ts, v] of T.priceSteps) if (t >= ts) p = lerp(p, v, ez(t, ts, ts + 0.5, E.out2));
  return clamp((p - 1) / 1) * (1 - ez(t, T.today, T.today + 1.2));
}

/** big world-space glows that always sit behind the action */
function backGlows(t, g) {
  if (vitrineVisible(t)) glow('duskHi', VIT.x, VIT.y, 620, 0.3, g);
  const vg = win(t, T.find, T.cant + 0.4, 1.2, 0.4);
  if (vg > 0) glow('gold', VORTEX.x, VORTEX.y, 280 + 60 * Math.sin(t * 5), vg * 0.6, g);
  if (t > T.paris && t < T.paris + 1.3) glow('gold', TITLE.x, TITLE.y, 520, 0.3 * win(t, T.paris, T.paris + 1.3, 0.2, 0.4), g);
  if (t > T.formed - 0.2 && t < T.paris + 0.6) {
    const ca = titleCrispAlpha(t);
    const er = t >= T.paris ? prog(t, T.paris, T.paris + 0.42) : 0;
    glow('gold', TITLE.x, TITLE.y, 640, 0.3 * ca * (1 - er), g);
  }
  const fl = prog(t, T.formed - 0.12, T.formed + 0.7);
  if (fl > 0 && fl < 1) glow('goldHi', TITLE.x, TITLE.y, 760 * E.out3(fl), (1 - fl) * 0.6, g);
}

function drawBackground(t) {
  const g = BG.g;
  const k = BG.k;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = BG.grad;
  g.fillRect(0, 0, BG.c.width, BG.c.height);
  g.setTransform(VIEW.S * k, 0, 0, VIEW.S * k, VIEW.OX * k, VIEW.OY * k);
  // slow nebulae, parallaxed a little against the camera
  const py = -CAM.y * 0.06;
  // (periodic over the whole piece, so the last frame matches the first)
  const ph = (t / DUR) * TAU;
  glow('duskHi', 250 + Math.sin(ph) * 90, 520 + ((py + 4000) % 2400) - 600, 760, 0.22, g);
  glow('lilac', 860 + Math.cos(ph * 2) * 80, 1450 + ((py * 1.3 + 4000) % 2600) - 800, 700, 0.1, g);
  const h = heat(t);
  if (h > 0.01) glow('coral', 540, 1100, 1300, h * 0.16, g);
  // world-space glows behind the action
  g.translate(540, 960);
  if (CAM.r) g.rotate(CAM.r);
  g.scale(CAM.z, CAM.z);
  g.translate(-CAM.x, -CAM.y);
  backGlows(t, g);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(BG.c, 0, 0, VIEW.W, VIEW.H);
  toFrame();
  const fb = frameBounds();
  // dust motes: periodic over the whole piece so the loop point matches
  const n = 70;
  const w = fb.x1 - fb.x0 + 80;
  const hh = fb.y1 - fb.y0 + 80;
  ctx.fillStyle = PAL.snow;
  for (let i = 0; i < n; i++) {
    const par = RS(i, 1, 0.05, 0.3);
    const drift = (t / DUR) * TAU;
    let x = RS(i, 2, 0, w) + Math.sin(drift + i) * 30;
    let y = RS(i, 3, 0, hh) - CAM.y * par * CAM.z - (t / DUR) * hh * (R(i, 7) < 0.5 ? 1 : 2);
    x = ((x % w) + w) % w + fb.x0 - 40;
    y = ((y % hh) + hh) % hh + fb.y0 - 40;
    const tw = 0.5 + 0.5 * Math.sin(TAU * Math.round(RS(i, 4, 7, 24)) * (t / DUR) + i);
    ctx.globalAlpha = RS(i, 5, 0.06, 0.28) * (0.5 + 0.5 * tw);
    const s = RS(i, 6, 1.2, 3.4);
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawPost(t, frameNo) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (VIGN) ctx.drawImage(VIGN, 0, 0);
  if (!REDUCED && OPT.grain && SPR.grain) {
    ctx.globalAlpha = 0.03;
    const T2 = 512;
    const ox = Math.floor(R(frameNo, 5) * T2);
    const oy = Math.floor(R(frameNo, 6) * T2);
    for (let y = -oy; y < VIEW.H; y += T2) for (let x = -ox; x < VIEW.W; x += T2) ctx.drawImage(SPR.grain, x, y, T2, T2);
    ctx.globalAlpha = 1;
  }
}

/* ---------- the vitrine ---------- */
function billScale(t) {
  if (t > T.paris) return 1; // off-stage from here on; whole again for the loop
  const steps = [0.83, 0.69, 0.57];
  let s = 1;
  for (let k = 0; k < 3; k++) s = lerp(s, steps[k], ez(t, T.sq[k], T.sq[k] + 0.14, E.out3));
  return s - 0.05 * ez(t, T.sq[2] + 0.25, T.leak + 2.2, E.io2);
}
function billSquash(t) {
  let q = 0;
  for (const s of T.sq) q += wob(t, s, 4.2, 8.5) * 0.16;
  return q;
}
function vitrineVisible(t) {
  return t < T.leak + 3.4 || t > T.drop;
}

function drawVitrine(t) {
  if (!vitrineVisible(t)) return;
  const x = VIT.x;
  const y = VIT.y;
  const top = y - 250;
  const bot = y + 210;
  const L0 = x - 350;
  const R0 = x + 350;
  // spotlight cone
  ctx.save();
  const cone = ctx.createLinearGradient(0, y - 1100, 0, bot + 60);
  cone.addColorStop(0, 'rgba(190,200,255,0)');
  cone.addColorStop(0.55, 'rgba(190,200,255,0.05)');
  cone.addColorStop(1, 'rgba(190,200,255,0.11)');
  ctx.fillStyle = cone;
  poly([x - 90, y - 1100, x + 90, y - 1100, R0 + 90, bot + 40, L0 - 90, bot + 40]);
  ctx.fill();
  ctx.restore();
  // pedestal
  ctx.fillStyle = PAL.dusk;
  rrect(x - 300, bot, 600, 250, 16);
  ctx.fill();
  ctx.fillStyle = PAL.dusk2;
  rrect(x - 330, bot - 4, 660, 36, 12);
  ctx.fill();
  ctx.fillStyle = PAL.duskHi;
  rrect(x - 330, bot - 4, 660, 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(4,5,22,0.35)';
  ctx.fillRect(x - 300, bot + 32, 600, 16);
  // plaque
  ctx.fillStyle = PAL.goldLo;
  rrect(x - 110, bot + 86, 220, 58, 8);
  ctx.fill();
  ctx.fillStyle = PAL.gold;
  rrect(x - 104, bot + 90, 208, 50, 6);
  ctx.fill();
  ctx.fillStyle = PAL.goldDeep;
  ctx.font = fBric(22, 700);
  ctx.textAlign = 'center';
  spaced('YOUR SAVINGS', x, bot + 123, fBric(22, 700), 3);
  // glass back
  ctx.fillStyle = 'rgba(150,170,255,0.05)';
  rrect(L0, top, R0 - L0, bot - top, 22);
  ctx.fill();
  // the note
  const s = billScale(t);
  const q = billSquash(t);
  const bob = Math.sin(t * 2.1) * 6 * win(t, 0.2, T.leak + 3, 0.8, 0.5);
  const tilt = Math.sin(t * 1.4) * 0.018 * win(t, 0.2, T.leak + 3, 0.8, 0.5);
  ctx.fillStyle = 'rgba(3,4,20,0.35)';
  ellipse(x, bot - 26, 250 * s, 18 * s);
  ctx.fill();
  bill(x, y - 10 + bob, s, 1 - q, 1 + q, tilt);
  // sheen sweeping across at "money"
  const sw = prog(t, T.money, T.money + 0.6);
  if (sw > 0 && sw < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 300 * s, y - 152 * s + bob, 600 * s, 300 * s);
    ctx.clip();
    const sx = lerp(x - 420 * s, x + 420 * s, E.io2(sw));
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    poly([sx - 30, y - 200, sx + 30, y - 200, sx - 50, y + 200, sx - 110, y + 200]);
    ctx.fill();
    ctx.restore();
  }
  // glass front
  ctx.strokeStyle = 'rgba(200,215,255,0.38)';
  ctx.lineWidth = 3;
  rrect(L0, top, R0 - L0, bot - top, 22);
  ctx.stroke();
  ctx.fillStyle = 'rgba(210,225,255,0.08)';
  poly([L0 + 40, top + 8, L0 + 150, top + 8, L0 + 40, top + 160]);
  ctx.fill();
  ctx.fillStyle = 'rgba(210,225,255,0.06)';
  poly([R0 - 60, bot - 10, R0 - 10, bot - 70, R0 - 10, bot - 10]);
  ctx.fill();
  ctx.fillStyle = 'rgba(230,240,255,0.14)';
  poly([L0 + 190, top + 8, L0 + 230, top + 8, L0 + 60, bot - 10, L0 + 20, bot - 10]);
  ctx.fill();
  // lid
  ctx.fillStyle = PAL.dusk2;
  rrect(L0 - 16, top - 26, R0 - L0 + 32, 30, 10);
  ctx.fill();
  ctx.fillStyle = PAL.duskHi;
  rrect(L0 - 16, top - 26, R0 - L0 + 32, 9, 5);
  ctx.fill();
  // seam glint where the value seeps out
  const seep = win(t, T.sq[0], T.leak + 2.5, 0.2, 0.8);
  if (seep > 0) {
    glow('gold', x, top - 10, 160, seep * (0.35 + 0.15 * Math.sin(t * 20)));
    ctx.fillStyle = rgba(RGB.goldHi, 0.8 * seep);
    ctx.fillRect(x - 120, top - 12, 240, 3);
  }
  // padlock (checks itself on "touched")
  const lk = wob(t, T.touched, 6, 7);
  ctx.save();
  ctx.translate(x, bot - 14);
  ctx.rotate(lk * 0.25);
  ctx.strokeStyle = PAL.goldLo;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, -8, 20, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = PAL.gold;
  rrect(-30, -10, 60, 48, 10);
  ctx.fill();
  ctx.fillStyle = PAL.goldDeep;
  circle(0, 8, 7);
  ctx.fill();
  ctx.fillRect(-3, 8, 6, 14);
  ctx.restore();
  // landing ripple for the loop
  const lr = prog(t, T.land, T.land + 0.8);
  if (lr > 0 && lr < 1) {
    ctx.strokeStyle = rgba(RGB.goldHi, (1 - lr) * 0.8);
    ctx.lineWidth = 4 * (1 - lr) + 1;
    ellipse(x, top - 26, 40 + lr * 330, 8 + lr * 40);
    ctx.stroke();
    glow('gold', x, top - 20, 240 * (1 - lr * 0.5), (1 - lr) * 0.9);
  }
}

/* ---------- hook type ---------- */
const BLOCKS = {};
function initHookType() {
  BLOCKS.h1 = makeBlock({
    x: 540,
    y: 420,
    world: true,
    lead: 1.0,
    out: T.h2 - 0.12,
    outFx: 'rise',
    outDur: 0.22,
    outStagger: 0.02,
    lines: [
      { size: 112, words: [{ t: 'NOBODY', at: T.nobody }, { t: 'TOUCHED', at: T.touched }] },
      {
        size: 112,
        color: PAL.mint,
        words: [
          { t: 'YOUR', at: T.your },
          { t: 'MONEY.', at: T.money },
        ],
      },
    ],
  });
  BLOCKS.h2 = makeBlock({
    x: 540,
    y: 405,
    world: true,
    lead: 1.1,
    out: T.leak + 1.0,
    outFx: 'fall',
    lines: [
      {
        size: 86,
        words: [
          { t: 'SO', at: T.so },
          { t: 'WHY', at: T.why },
          { t: 'IS', at: T.is },
          { t: 'IT', at: T.it },
        ],
      },
      {
        size: 150,
        color: PAL.coral,
        words: [
          {
            t: 'SHRINKING?',
            at: T.shrink,
            fx: 'slam',
            squash: (t) => {
              const s = 0.78 + 0.22 * ((billScale(t) - 0.52) / 0.48);
              const q = billSquash(t);
              return [s * (1 - q), s * (1 + q)];
            },
          },
        ],
      },
    ],
  });
  BLOCKS.name = makeBlock({
    x: 540,
    y: 150,
    world: true,
    out: T.never - 0.1,
    outFx: 'shrink',
    lead: 1.1,
    lines: [
      {
        size: 80,
        font: 'fellI',
        color: PAL.paper,
        spaceK: 1.9,
        words: [
          { t: 'Richard', at: T.richard, fx: 'type' },
          { t: 'Cantillon', at: T.cantW, fx: 'type' },
        ],
      },
      {
        size: 26,
        weight: 700,
        track: 6,
        color: PAL.mist,
        words: [
          { t: 'BANKER', at: T.cantW + 0.4, fx: 'type' },
          { t: '·', at: T.cantW + 0.4, fx: 'type' },
          { t: '1680s–1734', at: T.cantW + 0.4, fx: 'type' },
        ],
      },
    ],
  });
  BLOCKS.idea = makeBlock({
    x: TITLE.x,
    y: TITLE.y - 250,
    world: true,
    out: T.paris - 0.1,
    lines: [
      {
        size: 40,
        weight: 700,
        track: 7,
        color: PAL.gold,
        words: [
          { t: 'A', at: T.a300 },
          { t: '300-YEAR-OLD', at: T.y300 },
          { t: 'IDEA', at: T.idea },
        ],
      },
    ],
  });
}

/* ---------- the leak: sparkles escape the vitrine and drift upward ---------- */
const LEAK = [];
const VORTEX = { x: TITLE.x, y: TITLE.y - 30 };
function initLeak() {
  let id = 0;
  const add = (b, kind) => {
    const i = id++;
    const p = { i, b, kind };
    const s = billScale(b);
    if (kind === 'burst') {
      const a = RS(i, 1, 0, TAU);
      p.x0 = VIT.x + Math.cos(a) * 300 * s;
      p.y0 = VIT.y + Math.sin(a) * 140 * s;
      p.c1 = [p.x0 + Math.cos(a) * 220, p.y0 + Math.sin(a) * 120 - 160];
    } else if (kind === 'trickle') {
      p.x0 = VIT.x + RS(i, 1, -260, 260) * s;
      p.y0 = VIT.y - 120 * s;
      p.c1 = [p.x0 + RS(i, 2, -120, 120), p.y0 - 520];
    } else {
      const side = R(i, 1) < 0.5 ? -1 : 1;
      p.x0 = 540 + side * 700;
      p.y0 = RS(i, 2, -250, 700);
      p.c1 = [540 + side * RS(i, 3, 250, 480), p.y0 - RS(i, 4, 200, 500)];
    }
    p.c2 = [VORTEX.x + RS(i, 5, -380, 380), VORTEX.y + RS(i, 6, 150, 520)];
    p.orb = RS(i, 7, 120, 250);
    p.phi = RS(i, 8, 0, TAU);
    p.d = kind === 'side' ? RS(i, 9, 1.6, 2.4) : RS(i, 9, 2.4, 3.4);
    p.r = RS(i, 10, 7, 13);
    LEAK.push(p);
  };
  for (let k = 0; k < 3; k++) for (let j = 0; j < 9; j++) add(T.sq[k] + j * 0.015, 'burst');
  for (let j = 0; j < 34; j++) add(lerp(T.sq[2] + 0.2, T.find + 0.4, j / 33), 'trickle');
  for (let j = 0; j < 30; j++) add(lerp(T.leak + 0.6, T.idea - 0.2, j / 29), 'side');
}
function leakPos(p, t) {
  const u = (t - p.b) / p.d;
  if (u < 1) {
    const e = E.ioSine(clamp(u));
    const end = [VORTEX.x + Math.cos(p.phi) * p.orb, VORTEX.y + Math.sin(p.phi) * p.orb * 0.42];
    const mt = 1 - e;
    return [
      mt * mt * mt * p.x0 + 3 * mt * mt * e * p.c1[0] + 3 * mt * e * e * p.c2[0] + e * e * e * end[0],
      mt * mt * mt * p.y0 + 3 * mt * mt * e * p.c1[1] + 3 * mt * e * e * p.c2[1] + e * e * e * end[1],
    ];
  }
  const tt = t - p.b - p.d;
  const ang = p.phi + tt * 2.6;
  const rad = p.orb * (1 - 0.35 * clamp(tt / 3));
  return [VORTEX.x + Math.cos(ang) * rad, VORTEX.y + Math.sin(ang) * rad * 0.42];
}
function drawLeak(t) {
  if (t < T.sq[0] || t > T.cant + 0.6) return;
  const fade = 1 - ez(t, T.cant, T.cant + 0.45);
  for (const p of LEAK) {
    if (t < p.b) continue;
    const [x, y] = leakPos(p, t);
    const [x2, y2] = leakPos(p, Math.max(p.b, t - 0.07));
    const a = clamp((t - p.b) / 0.15) * fade;
    ctx.strokeStyle = rgba(RGB.gold, 0.35 * a);
    ctx.lineWidth = p.r * 0.35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x, y);
    ctx.stroke();
    const tw = 0.75 + 0.25 * Math.sin(t * 9 + p.i);
    sparkle(x, y, p.r * tw * (p.kind === 'burst' ? 1.15 : 1), t * 2 + p.i, 'goldHi', a);
  }
}

/* ---------- particle title: THE CANTILLON EFFECT → 1720 ---------- */
const TP = { n: 0 };
function fitSize(text, weight, maxW, maxSize) {
  const w = measure(text, fBric(100, weight));
  return Math.min(maxSize, Math.floor((maxW / w) * 100));
}
function initTitle() {
  const s1 = fitSize('CANTILLON', 800, 900, 170);
  TP.size = s1;
  TP.rows = [
    { text: 'THE', font: fBric(64, 800), size: 64, y: -s1 * 0.93, track: 16 },
    { text: 'CANTILLON', font: fBric(s1, 800), size: s1, y: 0 },
    { text: 'EFFECT', font: fBric(s1, 800), size: s1, y: s1 * 0.97 },
  ];
  // centre the block vertically on TITLE.y
  const off = -(TP.rows[0].y - 64 + TP.rows[2].y) / 2;
  for (const r of TP.rows) r.y += off;
  TP.off = off;
  const pts = textPoints(TP.rows, 7);
  TP.pts = pts;
  TP.n = pts.length;
  const yr = pts.map((p) => p[1]);
  const midA = (TP.rows[0].y + TP.rows[1].y - s1 * 0.4) / 2;
  const midB = (TP.rows[1].y + TP.rows[2].y - s1 * 0.4) / 2;
  TP.row = yr.map((y) => (y < midA ? 0 : y < midB ? 1 : 2));
  TP.p1720 = textPoints([{ text: '1720', font: fFell(330), size: 330, y: 110 }], 7);
  TP.minX = Math.min(...pts.map((p) => p[0]));
  TP.maxX = Math.max(...pts.map((p) => p[0]));
}
/** position of title particle i at time t (world), plus alpha and colour mix */
function titleParticle(i, t) {
  const pt = TP.pts[i];
  const row = TP.row[i];
  const appear = lerp(T.find + 0.2, T.cant - 0.15, R(i, 11));
  if (t < appear) return null;
  const orbR = 30 + 190 * Math.sqrt(R(i, 12));
  const phi = R(i, 13) * TAU;
  const w = 2.2 + 1.4 * R(i, 14);
  const xn = (pt[0] - TP.minX) / (TP.maxX - TP.minX);
  const form = row === 2 ? T.effect - 0.05 + xn * 0.22 : T.cant - 0.08 + xn * 0.3 + (row === 0 ? 0.05 : 0);
  const orbit = (tt) => {
    const ang = phi + w * (tt - appear) * (1 + 0.6 * prog(tt, T.idea, T.cant));
    const rad = orbR * (1 - 0.3 * prog(tt, appear, form));
    return [VORTEX.x + Math.cos(ang) * rad, VORTEX.y + Math.sin(ang) * rad * 0.42];
  };
  let a = clamp((t - appear) / 0.4);
  let x;
  let y;
  let c = 0;
  const tx = TITLE.x + pt[0];
  const ty = TITLE.y + pt[1];
  if (t < form) [x, y] = orbit(t);
  else if (t < T.paris) {
    const [ox, oy] = orbit(form);
    const k = E.outExpo(clamp((t - form) / 0.6));
    const arc = Math.sin(k * Math.PI) * (R(i, 15) - 0.5) * 160;
    x = lerp(ox, tx, k) + arc;
    y = lerp(oy, ty, k) - Math.sin(k * Math.PI) * 60;
    // shimmer once settled
    const settle = clamp((t - form - 0.6) / 0.3);
    y += Math.sin(t * 6 + i) * 0.8 * settle;
  } else {
    const q = TP.p1720[i % TP.p1720.length];
    const tgx = TITLE.x + q[0];
    const tgy = TITLE.y + q[1] - 20;
    const d0 = T.paris + xn * 0.42 + R(i, 16) * 0.12;
    if (t < d0 - 0.02) return null; // still part of the solid title
    const k = E.io4(clamp((t - d0) / 0.75));
    const sw = Math.sin(k * Math.PI);
    const ang = R(i, 17) * TAU;
    x = lerp(tx, tgx, k) + Math.cos(ang) * sw * 140;
    y = lerp(ty, tgy, k) + Math.sin(ang) * sw * 140;
    c = k;
  }
  return [x, y, a, c];
}
function titleCrispAlpha(t) {
  return ez(t, T.formed, T.formed + 0.25) * (t < T.paris + 0.6 ? 1 : 0);
}
/** x (world) left of which the solid title has already crumbled into particles */
function titleFront(t) {
  return lerp(TITLE.x + TP.minX - 20, TITLE.x + TP.maxX + 20, prog(t, T.paris, T.paris + 0.42));
}
function crisp1720Alpha(t) {
  return ez(t, T.paris + 1.05, T.paris + 1.3);
}
function drawTitle(t) {
  if (t < T.find || t > T.never + 1) return;
  const ca = titleCrispAlpha(t);
  const c1720 = crisp1720Alpha(t);
  // vortex core glow
  const vg = win(t, T.find, T.cant + 0.4, 1.2, 0.4);
  if (vg > 0) glow('goldHi', VORTEX.x, VORTEX.y, 90, vg * 0.6);
  // particles
  const eroding = t >= T.paris && t < T.paris + 0.6;
  const partA = eroding ? 1 - c1720 : (1 - ca) * (1 - c1720);
  if (partA > 0.01) {
    const cols = [PAL.gold, PAL.goldHi, PAL.paper];
    for (let g = 0; g < 3; g++) {
      ctx.fillStyle = cols[g];
      for (let i = g; i < TP.n; i += 3) {
        const p = titleParticle(i, t);
        if (!p) continue;
        const [x, y, a, c] = p;
        if (g < 2 && c > 0.6) continue;
        if (g === 2 && c <= 0.6) continue;
        ctx.globalAlpha = a * partA;
        const s = t > T.paris ? 4.6 : 3.6;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }
  // crisp title
  if (ca > 0.01) {
    const pulse = wob(t, T.formed - 0.1, 2.5, 6) * 0.03;
    const er = t >= T.paris ? prog(t, T.paris, T.paris + 0.42) : 0;
    ctx.save();
    if (t >= T.paris) {
      const fx = titleFront(t);
      glow('goldHi', fx, TITLE.y, 230, 0.45 * Math.sin(er * Math.PI));
      ctx.beginPath();
      ctx.rect(fx, TITLE.y - 600, 2000, 1200);
      ctx.clip();
    }
    ctx.translate(TITLE.x, TITLE.y);
    ctx.scale(1 + pulse, 1 + pulse);
    ctx.globalAlpha = ca;
    ctx.textAlign = 'center';
    for (const r of TP.rows) {
      // a shallow extrusion gives the title some weight
      ctx.fillStyle = 'rgba(8,6,30,0.45)';
      if (r.track) spaced(r.text, 0, r.y + 16, r.font, r.track);
      else {
        ctx.font = r.font;
        ctx.fillText(r.text, 0, r.y + 16);
      }
      ctx.fillStyle = PAL.goldDeep;
      for (const d of [9, 6, 3]) {
        if (r.track) spaced(r.text, 0, r.y + d, r.font, r.track);
        else ctx.fillText(r.text, 0, r.y + d);
      }
      ctx.fillStyle = r === TP.rows[0] ? PAL.goldHi : PAL.gold;
      if (r.track) spaced(r.text, 0, r.y, r.font, r.track);
      else {
        ctx.font = r.font;
        ctx.fillText(r.text, 0, r.y);
      }
    }
    // a thin highlight across the letters
    ctx.restore();
  }
  // formation flash + ring
  const fl = prog(t, T.formed - 0.12, T.formed + 0.7);
  if (fl > 0 && fl < 1) {
    ctx.strokeStyle = rgba(RGB.goldHi, (1 - fl) * 0.7);
    ctx.lineWidth = 6 * (1 - fl) + 1;
    circle(TITLE.x, TITLE.y, 120 + 520 * E.out3(fl));
    ctx.stroke();
  }
}
