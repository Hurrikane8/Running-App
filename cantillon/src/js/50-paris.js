/* ==========================================================================
   Paris, 1720: the date stamp, the skyline (Notre-Dame still has its
   medieval spire), John Law's banknote press, and Richard Cantillon.
   The skyline later folds down into the ledges of the line.
   ========================================================================== */

/* ---------- 1720 · Paris ---------- */
function draw1720(t) {
  const a = crisp1720Alpha(t);
  if (a <= 0.01) return;
  const out = pout(t, T.never + 0.05, 0.4);
  if (out <= 0) return;
  const m = ez(t, T.parisW - 0.15, T.parisW + 0.6, E.io4);
  const x = lerp(TITLE.x, 240, m);
  const y = lerp(TITLE.y + 90, -844, m);
  const s = lerp(1, 0.4, m) * out;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.font = fFell(330);
  ctx.fillStyle = 'rgba(10,8,30,0.4)';
  ctx.fillText('1720', 0, 12);
  ctx.fillStyle = PAL.paper;
  ctx.fillText('1720', 0, 0);
  ctx.restore();
  // "Paris" set in italic under the date, travelling with it
  const pa = ez(t, T.parisW, T.parisW + 0.4) * out;
  if (pa > 0.01) {
    const k = s / 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.globalAlpha = pa;
    ctx.textAlign = 'center';
    ctx.font = fFell(64, true);
    ctx.fillStyle = PAL.paper;
    ctx.fillText('Paris', 0, 76 + (1 - pa) * 14);
    ctx.fillStyle = rgba(RGB.gold, 0.8 * pa);
    ctx.fillRect(-60 * pa, 26, 120 * pa, 3);
    ctx.restore();
  }
}

/* ---------- skyline ---------- */
const CITY = [
  { x0: -90, x1: 118, top: -228, roof: 'mansard', to: [2, 60, 392], d: 0.0 },
  { x0: 112, x1: 300, top: -300, roof: 'mansard', to: [2, 388, 720], d: 0.12 },
  { x0: 296, x1: 452, top: -188, roof: 'flat', to: [1, 360, 562], d: 0.2 },
  { x0: 560, x1: 940, top: -318, roof: 'nd', to: [1, 558, 1020], d: 0.28 },
  { x0: 936, x1: 1170, top: -244, roof: 'mansard', to: [3, 360, 1020], d: 0.38 },
];
function windows(b, a) {
  if (a <= 0.01) return;
  const cols = Math.max(1, Math.floor((b.x1 - b.x0 - 40) / 48));
  const rows = Math.max(1, Math.floor((40 - b.top - 70) / 64));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * 13 + c + b.x0;
      const lit = R(i, 31) < 0.42;
      ctx.fillStyle = lit ? rgba([255, 214, 140], 0.85 * a) : rgba(RGB.night2, 0.9 * a);
      const wx = b.x0 + 24 + c * 48 + ((b.x1 - b.x0 - 40) - cols * 48) / 2 + 8;
      const wy = b.top + 58 + r * 64;
      rrect(wx, wy, 22, 34, 11);
      ctx.fill();
    }
  }
}
function notreDame(b, a, grow) {
  const midL = b.x0 + 108;
  const midR = b.x1 - 108;
  ctx.fillStyle = PAL.dusk;
  // medieval flèche (removed 1786) behind the nave
  ctx.fillRect((midL + midR) / 2 - 5, b.top - 170 * grow, 10, 170 * grow);
  poly([(midL + midR) / 2 - 16, b.top - 60 * grow, (midL + midR) / 2 + 16, b.top - 60 * grow, (midL + midR) / 2, b.top - 230 * grow]);
  ctx.fill();
  // towers
  ctx.fillStyle = PAL.dusk2;
  ctx.fillRect(b.x0, b.top, midL - b.x0, 70 - b.top);
  ctx.fillRect(midR, b.top, b.x1 - midR, 70 - b.top);
  ctx.fillStyle = PAL.dusk;
  ctx.fillRect(midL, b.top + 70, midR - midL, Math.max(0, -b.top));
  poly([midL, b.top + 72, (midL + midR) / 2, b.top + 20, midR, b.top + 72]);
  ctx.fill();
  // rose window
  ctx.fillStyle = rgba([255, 214, 140], 0.75 * a);
  circle((midL + midR) / 2, b.top + 150, 34);
  ctx.fill();
  ctx.strokeStyle = rgba(RGB.dusk, a);
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const an = (i * TAU) / 6;
    ctx.beginPath();
    ctx.moveTo((midL + midR) / 2, b.top + 150);
    ctx.lineTo((midL + midR) / 2 + Math.cos(an) * 34, b.top + 150 + Math.sin(an) * 34);
    ctx.stroke();
  }
  // tower openings
  ctx.fillStyle = rgba(RGB.night2, a);
  for (const tx of [b.x0 + 26, midR + 26]) {
    rrect(tx, b.top + 40, 22, 70, 11);
    ctx.fill();
    rrect(tx + 34, b.top + 40, 22, 70, 11);
    ctx.fill();
  }
  // parapet crenels
  ctx.fillStyle = PAL.dusk2;
  for (const [x0, x1] of [
    [b.x0, midL],
    [midR, b.x1],
  ])
    for (let x = x0; x < x1 - 8; x += 22) ctx.fillRect(x, b.top - 12, 12, 14);
}
function building(b, a, grow) {
  const top = lerp(40, b.top, grow);
  const bb = { ...b, top };
  if (b.roof === 'nd') return notreDame(bb, a, grow);
  ctx.fillStyle = PAL.dusk2;
  ctx.fillRect(b.x0, top, b.x1 - b.x0, 70 - top);
  ctx.fillStyle = PAL.dusk;
  ctx.fillRect(b.x1 - 36, top, 36, 70 - top);
  if (b.roof === 'mansard') {
    ctx.fillStyle = '#1d2160';
    poly([b.x0 - 8, top + 4, b.x0 + 26, top - 64, b.x1 - 26, top - 64, b.x1 + 8, top + 4]);
    ctx.fill();
    ctx.fillStyle = PAL.dusk2;
    ctx.fillRect(b.x0 + 40, top - 98, 24, 50);
    ctx.fillRect(b.x1 - 70, top - 90, 20, 44);
    ctx.fillStyle = rgba([255, 214, 140], 0.6 * a);
    rrect((b.x0 + b.x1) / 2 - 12, top - 48, 24, 30, 12);
    ctx.fill();
  } else {
    ctx.fillStyle = PAL.dusk;
    ctx.fillRect(b.x0 - 6, top - 8, b.x1 - b.x0 + 12, 14);
  }
  windows(bb, a);
}
/** skyline, then each building folds flat like a pop-up book and slides into a ledge */
function drawCity(t) {
  if (t < T.parisW - 0.3 || t > T.never + 1.6) return;
  for (let i = 0; i < CITY.length; i++) {
    const b = CITY[i];
    const grow = E.outBack(prog(t, T.parisW - 0.2 + i * 0.07, T.parisW + 0.45 + i * 0.07), 1.4);
    const f0 = T.never + 0.08 + b.d * 0.5;
    const fold = ez(t, f0, f0 + 0.38, E.in3); // facade folds down onto its base
    const s0 = f0 + 0.38;
    const slide = ez(t, s0, s0 + 0.62, E.io3); // the flat strip travels to its slot
    if (fold < 1) {
      ctx.save();
      ctx.translate(0, 40);
      ctx.scale(1, Math.max(0.02, 1 - fold));
      ctx.translate(0, -40);
      building(b, 1, grow);
      ctx.restore();
      // the underside catches the light as it folds
      if (fold > 0) {
        ctx.fillStyle = rgba(RGB.duskHi, fold);
        rrect(b.x0, 40 - 14 * fold, b.x1 - b.x0, 14 * fold + 1, 7);
        ctx.fill();
      }
      continue;
    }
    const [lv, lx0, lx1] = b.to;
    const x0 = lerp(b.x0, lx0, slide);
    const x1 = lerp(b.x1, lx1, slide);
    const y = lerp(40, LV[lv], slide) - Math.sin(slide * Math.PI) * 90;
    const q = wob(t, s0 + 0.62, 3.2, 8) * 0.3;
    ledge(x0 - q * 20, x1 + q * 20, y + q * 6, lerp(14, 44, slide), 1, 0, 64 * slide);
  }
}

/* ---------- the Seine, with the city's lit windows trembling in it ---------- */
function drawSeine(t, y0, a) {
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 620);
  g.addColorStop(0, '#1d2570');
  g.addColorStop(1, '#0b0d30');
  ctx.fillStyle = g;
  ctx.fillRect(-320, y0, 1720, 700);
  // reflections of the lit windows, broken up by the current
  for (const b of CITY) {
    if (b.roof === 'nd') continue;
    const cols = Math.max(1, Math.floor((b.x1 - b.x0 - 40) / 48));
    const rows = Math.max(1, Math.floor((40 - b.top - 70) / 64));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * 13 + c + b.x0;
        if (R(i, 31) >= 0.42) continue;
        const wx = b.x0 + 24 + c * 48 + ((b.x1 - b.x0 - 40) - cols * 48) / 2 + 19;
        const ry = y0 + 40 + (r + 0.5) * 46;
        for (let k = 0; k < 3; k++) {
          const jit = Math.sin(t * 2.2 + i + k * 1.7) * 7;
          ctx.fillStyle = rgba([255, 214, 140], (0.34 - k * 0.09) * a);
          rrect(wx - 16 + jit - k * 3, ry + k * 13, 32 - k * 6, 5, 2.5);
          ctx.fill();
        }
      }
    }
  }
  // rose window of Notre-Dame, a ring of light on the water
  const nd = CITY[3];
  const rx = (nd.x0 + 108 + nd.x1 - 108) / 2;
  ctx.fillStyle = rgba([255, 214, 140], 0.22 * a);
  ellipse(rx + Math.sin(t * 1.7) * 6, y0 + 150, 40, 9);
  ctx.fill();
  // ripples drifting downstream
  ctx.strokeStyle = rgba(RGB.duskHi, 0.55 * a);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const yy = y0 + 30 + RS(i, 51, 0, 520);
    const len = RS(i, 52, 50, 150);
    let xx = RS(i, 53, -200, 1280) + t * RS(i, 54, 14, 30);
    xx = ((xx + 300) % 1600) - 300;
    ctx.beginPath();
    ctx.moveTo(xx, yy);
    ctx.lineTo(xx + len, yy);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- ledges (street in Paris → the line → the chart axis) ---------- */
function ledgeFrame(i, t) {
  // [x0, x1, y, depth, alpha] for ledge i
  const [lx0, lx1] = LEDGE[i];
  let x0 = lx0;
  let x1 = lx1;
  let y = LV[i];
  let d = 44;
  // chart: every ledge slides into one quarter of the x-axis
  const c = ez(t, T.chart, T.chart + 0.95, E.io4);
  if (c > 0) {
    x0 = lerp(x0, 150 + i * 202.5, c);
    x1 = lerp(x1, 150 + (i + 1) * 202.5, c);
    y = lerp(y, 1296, c);
    d = lerp(d, 8, c);
  }
  return [x0, x1, y, d];
}
function drawLedges(t) {
  // Paris street: one long ledge that shrinks into the first ledge
  if (t >= T.parisW - 0.3 && t < T.never + 1.3) {
    const g = ez(t, T.parisW - 0.3, T.parisW + 0.3, E.out3);
    const m = ez(t, T.never + 0.1, T.never + 1.2, E.io4);
    const x0 = lerp(-260, LEDGE[0][0], m);
    const x1 = lerp(1340, LEDGE[0][1], m);
    const y = LV[0] + (1 - g) * 300;
    // the Seine drains away as the city folds itself into the line
    const rv = 1 - ez(t, T.never + 0.05, T.never + 0.7, E.in2);
    if (rv > 0.01) drawSeine(t, y + 60, rv);
    // the quay narrows into the first ledge
    ledge(x0, x1, y, lerp(66, 44, m), 1, 0, 64 * m);
    if (m < 1) {
      ctx.fillStyle = rgba(RGB.dusk2, 1 - m);
      for (let k = 0; k < 26; k++) {
        const cx = -240 + k * 62 + (k % 2) * 22;
        rrect(cx, y + 26, 44, 12, 6);
        ctx.fill();
        rrect(cx + 26, y + 44, 44, 12, 6);
        ctx.fill();
      }
    }
  }
  // the line's ledges (after the skyline has folded into them)
  const on = T.never + 1.45;
  if (t >= on - 0.02 && t < T.stole + 0.5) {
    const out = t > T.waveEnd ? pout(t, T.waveEnd, 0.4) : 1;
    const c = ez(t, T.chart, T.chart + 0.95, E.io4);
    for (let i = 0; i < 4; i++) {
      if (i === 0 && t < on) continue;
      const [x0, x1, y, d] = ledgeFrame(i, t);
      const tint = i > 0 && t < T.today + 1 ? heat(t) * (i / 3) : 0;
      if (c < 1) ledge(x0, x1, y, d, out, tint, 64 * (1 - c));
      else {
        ctx.fillStyle = rgba(RGB.mist, 0.75 * out);
        rrect(x0 - (i ? 1 : 0), y, x1 - x0 + 2, d * out, 4);
        ctx.fill();
      }
    }
  }
}

/* ---------- the source: John Law's press → a tap ---------- */
function sourceState(t) {
  if (t < T.printing - 0.02) return null;
  let x = 540;
  let y = lerp(-1650, -620, ez(t, T.printing, T.pressLand, E.in3));
  let k = 0;
  const m = ez(t, T.never + 0.1, T.never + 1.25, E.io4);
  x = lerp(x, TAP0.x, m);
  y = lerp(y, TAP0.y, m);
  k = m;
  const f = ez(t, T.panUpStart, T.stole + 0.7, E.io4);
  x = lerp(x, 190, f);
  y = lerp(y, -950, f);
  // steps out of shot while we compare baskets, back for "today"
  y -= 560 * (ez(t, T.overview - 0.2, T.same + 0.2, E.io3) - ez(t, T.today - 0.4, T.today + 0.3, E.io3));
  // leaves at the end: slides up and out as the question takes the stage
  const gone = ez(t, T.askW - 0.2, T.question + 0.4, E.inBack);
  y -= gone * 700;
  const q = wob(t, T.pressLand, 3.4, 7) * 0.22 + wob(t, T.never + 1.25, 3.2, 8) * 0.18;
  // handle turns when the tap opens
  const turn =
    ez(t, T.pours - 0.3, T.pours, E.io3) * (1 - ez(t, T.lineW, T.lineW + 0.4)) +
    ez(t, T.pourModern[0] - 0.3, T.pourModern[0], E.io3) * (1 - ez(t, T.pourModern[1], T.pourModern[1] + 0.3)) +
    ez(t, T.appears - 0.6, T.appears - 0.2, E.io3);
  return { x, y, k, q, turn, a: 1 - ez(t, T.question, T.question + 0.3) };
}
/** where coins leave the tap */
function outlet(t) {
  const s = sourceState(t) || { x: TAP0.x, y: TAP0.y };
  return [s.x + 110, s.y + 112];
}
function drawSource(t) {
  const S = sourceState(t);
  if (!S || S.a <= 0) return;
  const { k, q } = S;
  ctx.save();
  ctx.translate(S.x, S.y);
  ctx.scale(1 - q, 1 + q);
  ctx.globalAlpha = S.a;
  const wood = mix('wood', 'goldLo', k);
  const woodLo = mix('woodLo', 'goldDeep', k);
  const brass = mix('goldLo', 'gold', k);
  // stamp cycle (press only)
  let pz = 0;
  for (const s of T.stamps) {
    const d = t - s;
    if (d >= -0.07 && d < 0.2) pz = Math.max(pz, d < 0 ? 1 + d / 0.07 : 1 - d / 0.2);
  }
  pz *= 1 - k;
  const L = (a, b) => lerp(a, b, k);
  // [x, y, w, h] press → tap for each part
  const beam = [L(-160, -700), L(-230, -26), L(320, 690), L(44, 52)];
  const postL = [L(-160, -58), L(-230, -50), L(36, 116), L(420, 100)];
  const postR = [L(124, -58), L(-230, -50), L(36, 116), L(420, 100)];
  const base = [L(-180, -30), L(180, -10), L(360, 60), L(30, 20)];
  // posts and beam
  ctx.fillStyle = woodLo;
  rrect(base[0], base[1], base[2], base[3], 8);
  ctx.fill();
  ctx.fillStyle = wood;
  rrect(postL[0], postL[1], postL[2], postL[3], L(8, 30));
  ctx.fill();
  rrect(postR[0], postR[1], postR[2], postR[3], L(8, 30));
  ctx.fill();
  ctx.fillStyle = mix('wood', 'gold', k);
  rrect(beam[0], beam[1], beam[2], beam[3], L(10, 26));
  ctx.fill();
  if (k > 0.02) {
    // pipe shading + flange
    ctx.fillStyle = rgba(RGB.goldDeep, 0.5 * k);
    ctx.fillRect(beam[0], beam[1] + beam[3] - 14, beam[2] - 40, 14);
    ctx.fillStyle = mix('goldLo', 'goldHi', k * 0.7);
    rrect(-86, -40, 22, 80, 8);
    ctx.fill();
  }
  // press bed + paper, platen, screw
  const pa = 1 - k;
  if (pa > 0.01) {
    ctx.globalAlpha = S.a * pa;
    ctx.fillStyle = woodLo;
    rrect(-130, 120, 260, 26, 6);
    ctx.fill();
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(-90, 112, 180, 9);
    const py = lerp(10, 70, pz);
    ctx.fillStyle = brass;
    ctx.fillRect(-12, -186, 24, py + 186);
    ctx.strokeStyle = woodLo;
    ctx.lineWidth = 3;
    for (let yy = -176; yy < py - 6; yy += 16) {
      ctx.beginPath();
      ctx.moveTo(-12, yy);
      ctx.lineTo(12, yy + 8);
      ctx.stroke();
    }
    ctx.fillStyle = wood;
    rrect(-104, py, 208, 40, 8);
    ctx.fill();
    ctx.fillStyle = mix('wood', 'goldHi', 0.3);
    rrect(-104, py, 208, 10, 5);
    ctx.fill();
    // the bar ("devil's tail") swings on each stamp
    const sw = Math.cos(pz * 1.8);
    ctx.strokeStyle = woodLo;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-150 * sw, -120);
    ctx.lineTo(150 * sw, -120);
    ctx.stroke();
    ctx.fillStyle = brass;
    circle(0, -120, 18);
    ctx.fill();
    ctx.globalAlpha = S.a;
  }
  // tap: body, handle, spout
  if (k > 0.01) {
    ctx.globalAlpha = S.a * k;
    ctx.strokeStyle = PAL.gold;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 46 * k;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(80, 0);
    ctx.quadraticCurveTo(110, 0, 110, 40);
    ctx.lineTo(110, 70 + 18 * k);
    ctx.stroke();
    ctx.strokeStyle = PAL.goldLo;
    ctx.lineWidth = 12 * k;
    ctx.beginPath();
    ctx.moveTo(126, 34);
    ctx.lineTo(126, 80);
    ctx.stroke();
    ctx.fillStyle = PAL.goldDeep;
    rrect(84, 84 + 18 * k, 52, 16, 6);
    ctx.fill();
    ctx.fillStyle = PAL.gold;
    rrect(-60, -52, 120, 104, 32);
    ctx.fill();
    ctx.fillStyle = PAL.goldHi;
    rrect(-44, -42, 50, 16, 8);
    ctx.fill();
    ctx.fillStyle = PAL.goldLo;
    ctx.fillRect(-9, -106, 18, 56);
    const hw = Math.cos(S.turn * Math.PI * 0.9);
    ctx.fillStyle = PAL.gold;
    rrect(-70 * Math.abs(hw) - 10, -122, 140 * Math.abs(hw) + 20, 24, 12);
    ctx.fill();
    ctx.fillStyle = PAL.goldLo;
    circle(0, -110, 13);
    ctx.fill();
    ctx.globalAlpha = S.a;
  }
  ctx.restore();
  // label once it is a central bank
  const cb = win(t, T.today + 0.3, T.chart + 0.4, 0.4, 0.3);
  if (cb > 0.01) {
    ctx.save();
    ctx.globalAlpha = cb;
    ctx.fillStyle = PAL.goldHi;
    ctx.textAlign = 'center';
    spaced('CENTRAL BANK', S.x - 250, S.y + 118 + (1 - E.out3(cb)) * 20, fBric(44, 800), 6);
    ctx.restore();
  }
}

/* ---------- banknotes pouring out of the press ---------- */
const NOTES = [];
function initNotes() {
  T.stamps.forEach((s, j) => {
    const n = j > 8 ? 2 : 1;
    for (let m = 0; m < n; m++) {
      const i = NOTES.length;
      NOTES.push({
        i,
        t0: s + m * 0.04,
        dir: (j + m) % 2 ? 1 : -1,
        vx: RS(i, 1, 170, 360),
        up: RS(i, 2, 70, 170),
        vy: RS(i, 3, 230, 330),
        sway: RS(i, 4, 30, 70),
        ph: RS(i, 5, 0, TAU),
        fs: RS(i, 6, 3, 6),
        land: RS(i, 7, 6, 16),
        w: RS(i, 8, 92, 118),
      });
    }
  });
}
function notePos(n, t, px, py) {
  const d = t - n.t0;
  const e0 = 0.38;
  const x0 = px + n.dir * 60;
  const y0 = py + 110;
  if (d < e0) {
    const e = E.out2(d / e0);
    return [x0 + n.dir * n.vx * 0.55 * e, y0 - Math.sin(e * Math.PI * 0.8) * n.up, e * 4 * n.dir, d * n.fs, false];
  }
  const dd = d - e0;
  const x1 = x0 + n.dir * n.vx * 0.55;
  const y1 = y0 - Math.sin(Math.PI * 0.8) * n.up;
  let y = y1 + n.vy * dd;
  let x = x1 + n.dir * 40 * dd + Math.sin(dd * 2.4 + n.ph) * n.sway;
  const ground = LV[0] - n.land;
  if (y >= ground) return [x, ground, 0.08 * Math.sin(n.ph), Math.PI / 2 - 0.25, true];
  return [x, y, Math.sin(dd * 3 + n.ph) * 0.5, e0 * n.fs + dd * n.fs, false];
}
function cantillonHands(t) {
  const c = cantillonState(t);
  return c ? [c.x, c.y - 170 * c.s] : [540, -150];
}
function drawNotes(t) {
  if (t < T.pressLand || t > T.never + 1.4) return;
  const px = 540;
  const py = -620;
  const gone = ez(t, T.never, T.never + 0.6, E.inBack);
  for (const n of NOTES) {
    if (t < n.t0) continue;
    let [x, y, rot, flip, landed] = notePos(n, t, px, py);
    // after "got rich" every note still in the air is pulled to Cantillon
    const grab = T.got - 0.1;
    let a = 1;
    if (!landed && t > grab && n.t0 < t) {
      const [hx, hy] = cantillonHands(t);
      const k = E.in2(prog(t, Math.max(grab, n.t0 + 0.3), Math.max(grab, n.t0 + 0.3) + 0.55));
      x = lerp(x, hx, k);
      y = lerp(y, hy, k);
      a = 1 - prog(k, 0.8, 1);
      if (k >= 1) continue;
    }
    if (landed) {
      // lying on the cobbles: seen edge-on, a thin sheet
      ctx.save();
      ctx.globalAlpha = 1 - gone;
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(1, 0.2);
      ctx.drawImage(SPR.note.c, -n.w / 2, -30, n.w, 60);
      ctx.restore();
      continue;
    }
    note(x, y, n.w, rot, flip, a * (1 - gone));
  }
}

/* ---------- Richard Cantillon ---------- */
function pileH(t) {
  // his heap of gold grows as the notes turn into coins
  const g = ez(t, T.got, T.bankerEnd + 0.4, E.out3);
  const shrink = ez(t, T.never + 0.1, T.never + 1.0, E.io3);
  return 104 * g * (1 - shrink);
}
function cantillonState(t) {
  if (t < T.banker - 0.05) return null;
  const tin = T.banker - 0.05;
  const k = pop(t, tin, 0.5, 2.4);
  let x = 540;
  let y = LV[0] - pileH(t);
  const m = ez(t, T.never + 0.1, T.never + 1.2, E.io4);
  x = lerp(x, PX[0], m);
  // in the finale he is first in the queue again
  const fin = t > T.chart ? 1 : 0;
  let s = k;
  if (fin) {
    s = pout(t, T.chart, 0.35);
    if (t > T.stole) {
      s = pop(t, T.stole + 0.35, 0.5);
      x = QX[0];
      y = QY;
    }
  }
  const jump = t < tin + 0.5 ? Math.sin(prog(t, tin, tin + 0.5) * Math.PI) * 60 : 0;
  return { x, y: y - jump, s: s * 0.95 };
}
function drawPile(t) {
  const h = pileH(t);
  if (h <= 0.5) return;
  const c = cantillonState(t);
  if (!c) return;
  const rows = [6, 5, 4, 3];
  for (let r = 0; r < rows.length; r++) {
    const need = r * 26 + 6;
    if (h < need) break;
    const k = E.outBack(clamp((h - need) / 20), 2.2);
    const n = rows[r];
    for (let j = 0; j < n; j++) {
      const x = c.x + (j - (n - 1) / 2) * 34;
      const y = LV[0] - 17 - r * 26;
      coin(x, y, 17 * k, 0, 1, 1, 1);
    }
  }
  glow('gold', c.x, LV[0] - 50, 150, 0.25 * clamp(h / 104));
}
function drawCantillon(t) {
  const c = cantillonState(t);
  if (!c || c.s <= 0.01 || (t > T.today + 0.3 && t < T.stole)) return;
  const tin = T.banker - 0.05;
  let sq = wob(t, tin + 0.5, 3, 7) * 0.2 + wob(t, T.rich, 4, 8) * 0.12;
  // today: he winds up, then squashes flat into the bank's foundations
  const mk = prog(t, T.today - 0.05, T.today + 0.3);
  if (mk > 0 && t < T.stole) sq = -0.12 * Math.sin(Math.min(1, mk * 2.5) * Math.PI) * (mk < 0.4 ? 1 : 0) + (mk >= 0.4 ? E.in2((mk - 0.4) / 0.6) * 0.72 : 0);
  let mood = 'smile';
  if (t > T.rich - 0.1 && t < T.figured) mood = 'joy';
  if (t >= T.figured && t < T.whyEnd + 0.1) mood = 'o';
  if (t > T.stole) mood = t > T.winners ? 'grin' : 'smile';
  let look = [0, 0];
  if (t < T.richard) look = [0, -1];
  else if (t < T.got) look = [0.2, 0];
  else if (t >= T.figured && t < T.whyW) look = [0, -1];
  else if (t >= T.whyW && t < T.whyEnd) look = [0.3, 0.9];
  if (t > T.stole) look = t > T.appears - 0.8 && t < T.askW + 0.3 ? [-0.6, -0.9] : [0, 0];
  const catchUp = win(t, T.got - 0.25, T.bankerEnd + 0.3, 0.25, 0.3);
  const blink = blinkAt(t, 1);
  const hands = person({
    x: c.x,
    y: c.y,
    s: c.s,
    sx: 1 + sq,
    sy: 1 - sq,
    c: [PAL.wine, PAL.wineLo, '#e46a8c'],
    mood,
    look,
    blink,
    armL: lerp(0.3, 2.6, catchUp),
    armR: lerp(0.3, 2.6, catchUp) + (t > T.winners && t < T.tapEnd ? 0.6 * win(t, T.winners, T.tapEnd, 0.2, 0.3) : 0),
    acc: { wig: true, tricorn: true, jabot: true },
  });
  // the realisation
  const bang = win(t, T.whyW - 0.05, T.whyEnd + 0.25, 0.08, 0.25);
  if (bang > 0.01) {
    const s = pop(t, T.whyW - 0.05, 0.35, 2.5);
    ctx.save();
    ctx.translate(c.x + 96, c.y - 250 * c.s);
    ctx.rotate(0.15);
    ctx.scale(s, s);
    ctx.globalAlpha = bang;
    ctx.fillStyle = PAL.goldHi;
    ctx.font = fBric(96, 800);
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 0);
    ctx.restore();
  }
  return hands;
}
/** occasional blinks, deterministic */
function blinkAt(t, seed) {
  const period = 2.6 + R(seed, 3) * 1.8;
  const ph = (t + R(seed, 4) * period) % period;
  return ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
}

/* ---------- the path money takes ---------- */
const FLOW_LINE = [
  [575, -500],
  [575, -24],
  [716, -24],
  [740, 516],
  [364, 516],
  [330, 1036],
  [716, 1036],
  [740, 1556],
  [830, 1556],
];
const FLOW_PARIS = FLOW_LINE.map(([x, y], i) => (i === 0 ? [540, -500] : i === 1 ? [540, -150] : [x + 200, y]));
function flowPts(t) {
  const m = ez(t, T.never + 0.1, T.never + 1.25, E.io4);
  return FLOW_LINE.map((p, i) => [lerp(FLOW_PARIS[i][0], p[0], m), lerp(FLOW_PARIS[i][1], p[1], m)]);
}
function drawFlowPath(t) {
  if (t < T.figured || t > T.chart + 0.8) return;
  const reveal = ez(t, T.figured, T.never + 1.6, E.io2);
  const out = 1 - ez(t, T.chart, T.chart + 0.6);
  const pts = flowPts(t);
  const path = makePath(pts);
  const upto = reveal * path.len;
  ctx.save();
  ctx.setLineDash([2, 22]);
  ctx.lineDashOffset = -t * 40;
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = rgba(RGB.gold, 0.55 * out);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + l >= upto) {
      const k = (upto - acc) / l;
      ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
      break;
    }
    ctx.lineTo(pts[i][0], pts[i][1]);
    acc += l;
  }
  ctx.stroke();
  ctx.restore();
  // quill-tip glow travelling with the reveal
  if (reveal > 0 && reveal < 1) {
    const [x, y] = path.at(reveal);
    glow('gold', x, y, 90, 0.8 * out);
    sparkle(x, y, 12, t * 4, 'goldHi', 0.9 * out);
  }
  // "flows down the line": a pulse runs the whole route
  const pu = prog(t, T.flows - 0.1, T.lineW + 0.55);
  if (pu > 0 && pu < 1) {
    const [x, y] = path.at(E.io2(pu));
    glow('goldHi', x, y, 150, 0.9 * out);
    glow('gold', x, y, 60, 1 * out);
  }
}
