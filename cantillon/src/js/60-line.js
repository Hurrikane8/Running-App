/* ==========================================================================
   The line: new money pours in at the top and tumbles down, ledge by
   ledge. Each person spends it at the price of the moment; each purchase
   nudges the price up for everyone below.
   ========================================================================== */

const G = 3400; // px/s², coins fall with real-ish gravity
const COIN_R = 23;
const HEAP = [
  [-66, -24],
  [-22, -24],
  [22, -24],
  [66, -24],
  [-44, -64],
  [0, -64],
  [44, -64],
  [-22, -104],
  [22, -104],
  [0, -144],
];
let LEGS = []; // coins that travel the line
let LEGS_M = []; // the modern pour (central bank → banks → markets)
let LEGS_F = []; // the finale trickle onto the winner
const CHECK = { x: PX[3] - 96, y: LV[3] - 96 };

function pourLegs(n, t0, gap, from, restAt) {
  const out = [];
  for (let j = 0; j < n; j++) {
    const rest = restAt(j);
    const ts = t0 + j * gap;
    const tf = Math.sqrt((2 * Math.max(10, rest[1] - from[1])) / G);
    out.push([{ type: 'fall', t0: ts, t1: ts + tf, p0: [from[0] + RS(j, 1, -8, 8), from[1]], p1: rest, spin: RS(j, 2, 5, 9) }]);
  }
  return out;
}
/** send a heap from ledge k to ledge k+1; returns arrival time */
function transferLegs(legs, slots, k, start, stagger = 0.03) {
  const dir = k % 2 === 0 ? 1 : -1;
  const edgeX = dir > 0 ? LEDGE[k][1] - 10 : LEDGE[k][0] + 10;
  const landX = edgeX + dir * 30;
  let arrive = 0;
  for (let j = 0; j < legs.length; j++) {
    const L0 = legs[j];
    const order = legs.length - 1 - slots[j];
    const cur = L0[L0.length - 1].p1;
    const d0 = start + order * stagger;
    L0.push({ type: 'rest', t0: L0[L0.length - 1].t1, t1: d0, p0: cur, p1: cur });
    const edge = [edgeX, LV[k] - COIN_R];
    const tr1 = Math.hypot(edgeX - cur[0], edge[1] - cur[1]) / 1300 + 0.04;
    L0.push({ type: 'roll', t0: d0, t1: d0 + tr1, p0: cur, p1: edge });
    const land = [landX, LV[k + 1] - COIN_R];
    const tf = Math.sqrt((2 * (land[1] - edge[1])) / G);
    L0.push({ type: 'fall', t0: d0 + tr1, t1: d0 + tr1 + tf, p0: edge, p1: land, spin: RS(j, 10 + k, 4, 8) });
    const rest = [HX[k + 1] + HEAP[order][0], LV[k + 1] + HEAP[order][1]];
    const tr2 = Math.hypot(rest[0] - land[0], rest[1] - land[1]) / 1100 + 0.05;
    L0.push({ type: 'roll', t0: d0 + tr1 + tf, t1: d0 + tr1 + tf + tr2, p0: land, p1: rest });
    slots[j] = order;
    arrive = Math.max(arrive, d0 + tr1 + tf + tr2);
  }
  return arrive;
}

function initLine() {
  /* the new money's journey */
  LEGS = pourLegs(10, T.pours + 0.02, 0.1, [TAP0.x + 110, TAP0.y + 124], (j) => [HX[0] + HEAP[j][0], LV[0] + HEAP[j][1]]);
  const slots = LEGS.map((_, j) => j);
  T.arrive = [LEGS[9][0].t1];
  T.transfer = [];
  let start = T.nextW - 0.05;
  for (let k = 0; k < 3; k++) {
    const arrive = transferLegs(LEGS, slots, k, start, k === 2 ? 0.024 : 0.03);
    T.transfer.push([start, arrive]);
    T.arrive.push(arrive);
    start = k === 0 ? T.end + 0.02 : arrive + 0.1;
  }
  T.checkAt = Math.max(T.paycheck - 0.1, T.arrive[3] + 0.04);
  for (let j = 0; j < 10; j++) {
    const L0 = LEGS[j];
    const cur = L0[L0.length - 1].p1;
    const g0 = T.checkAt + j * 0.014;
    L0.push({ type: 'rest', t0: L0[L0.length - 1].t1, t1: g0, p0: cur, p1: cur });
    L0.push({ type: 'gather', t0: g0, t1: g0 + 0.28, p0: cur, p1: [CHECK.x, CHECK.y] });
  }
  /* purchases: [start, gap, loaves] */
  T.buy = [
    [T.todays + 0.3, 0.15, 4],
    [Math.max(T.arrive[1] + 0.3, T.cost - 0.4), 0.18, 3],
    [T.arrive[2] + 0.02, 0.1, 2.5],
    [T.climbed - 0.25, 0.22, 2],
  ];
  T.priceSteps = [
    [-1, 1.0],
    [T.pushes + 0.06, 1.3],
    [T.more - 0.02, 1.6],
    [T.transfer[2][0] + 0.05, 2.0],
  ];
  /* today: the central bank pours into banks, banks pass it to markets */
  LEGS_M = pourLegs(10, T.pourModern[0], 0.08, [TAP0.x + 110, TAP0.y + 124], (j) => [HX[0] + HEAP[j][0], LV[0] + HEAP[j][1]]);
  const sm = LEGS_M.map((_, j) => j);
  const am = transferLegs(LEGS_M, sm, 0, T.transferModern[0], 0.028);
  T.arriveModern = am;
  for (let j = 0; j < 10; j++) {
    const L0 = LEGS_M[j];
    const cur = L0[L0.length - 1].p1;
    const g0 = T.chart + 0.05 + j * 0.03;
    L0.push({ type: 'rest', t0: L0[L0.length - 1].t1, t1: g0, p0: cur, p1: cur });
    L0.push({ type: 'gather', t0: g0, t1: g0 + 0.55, p0: cur, p1: [150, 1250], arc: -260 });
  }
  /* finale: a trickle lands on whoever stands under the tap */
  LEGS_F = pourLegs(6, T.winners - 0.1, 0.16, [300, -950 + 124], () => [QX[0], QY - 150]);
  for (const L0 of LEGS_F) {
    const e = L0[0];
    L0.push({ type: 'gather', t0: e.t1, t1: e.t1 + 0.18, p0: e.p1, p1: [QX[0], QY - 120] });
  }
}

/** position of a coin following its legs at time t */
function coinOn(legs, t) {
  if (t < legs[0].t0) return null;
  let land = -1;
  let leg = legs[legs.length - 1];
  for (const l of legs) {
    if (l.type === 'fall' && l.t1 <= t) land = l.t1;
    if (t <= l.t1) {
      leg = l;
      break;
    }
  }
  const u = prog(t, leg.t0, leg.t1);
  let x;
  let y;
  let spin = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  let a = 1;
  let r = COIN_R;
  if (leg.type === 'fall') {
    x = lerp(leg.p0[0], leg.p1[0], u);
    y = leg.p0[1] + (leg.p1[1] - leg.p0[1]) * u * u;
    spin = (t - leg.t0) * leg.spin;
    sy = 1 + 0.22 * u;
    sx = 1 - 0.1 * u;
  } else if (leg.type === 'roll') {
    const e = E.io2(u);
    x = lerp(leg.p0[0], leg.p1[0], e);
    y = lerp(leg.p0[1], leg.p1[1], e);
    rot = (x - leg.p0[0]) / COIN_R;
  } else if (leg.type === 'gather') {
    if (t > leg.t1) return null;
    const e = E.in3(u);
    x = lerp(leg.p0[0], leg.p1[0], e);
    y = lerp(leg.p0[1], leg.p1[1], e) + Math.sin(u * Math.PI) * (leg.arc || -60);
    r *= 1 - 0.7 * e;
    a = 1 - prog(u, 0.75, 1);
    spin = u * 6;
  } else {
    x = leg.p1[0];
    y = leg.p1[1];
  }
  if (land > 0 && leg.type !== 'fall') {
    const q = wob(t, land, 5, 9) * 0.3;
    sx *= 1 + q;
    sy *= 1 - q;
    y += q * 10;
  }
  return { x, y, r, spin, rot, sx, sy, a };
}
function drawCoinSet(set, t, alpha = 1) {
  for (const legs of set) {
    const c = coinOn(legs, t);
    if (!c) continue;
    if (c.a > 0.2 && c.r > 12) glow('gold', c.x, c.y, c.r * 2.4, 0.18 * c.a);
    coin(c.x, c.y, c.r, c.spin, c.sx, c.sy, c.a * alpha, c.rot);
  }
}
function drawCoins(t) {
  if (t > T.pours - 0.1 && t < T.climbed) drawCoinSet(LEGS, t);
  if (t > T.pourModern[0] - 0.1 && t < T.chart + 1) drawCoinSet(LEGS_M, t);
  if (t > T.winners - 0.2 && t < T.closer + 0.8) drawCoinSet(LEGS_F, t);
}

/* ---------- the paycheck ---------- */
function drawCheck(t) {
  const a0 = T.checkAt + 0.14;
  if (t < a0 || t > T.buy[3][0] + 0.6) return;
  const s = pop(t, a0, 0.4, 2.2) * pout(t, T.buy[3][0] - 0.05, 0.4);
  if (s <= 0.01) return;
  const bob = Math.sin(t * 3) * 4;
  ctx.save();
  ctx.translate(CHECK.x, CHECK.y + bob);
  ctx.rotate(-0.12 + wob(t, a0, 3, 6) * 0.2);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(4,5,20,0.3)';
  rrect(-96, -46, 196, 100, 10);
  ctx.fill();
  ctx.fillStyle = PAL.mintHi;
  rrect(-100, -54, 196, 100, 10);
  ctx.fill();
  ctx.fillStyle = PAL.mintLo;
  rrect(-100, -54, 196, 26, 10);
  ctx.fill();
  ctx.fillRect(-100, -38, 196, 10);
  ctx.fillStyle = PAL.snow;
  ctx.textAlign = 'center';
  spaced('PAYCHECK', -2, -34, fBric(20, 800), 4);
  ctx.fillStyle = PAL.mintDeep;
  ctx.textAlign = 'left';
  ctx.font = fBric(19, 700);
  ctx.fillText('PAY TO: YOU', -84, 0);
  ctx.strokeStyle = PAL.mintLo;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-84, 26);
  ctx.bezierCurveTo(-60, 6, -50, 40, -30, 20);
  ctx.bezierCurveTo(-14, 6, 0, 34, 20, 18);
  ctx.stroke();
  ctx.fillStyle = PAL.gold;
  circle(64, 22, 16);
  ctx.fill();
  ctx.fillStyle = PAL.goldLo;
  ctx.font = fBric(22, 800);
  ctx.textAlign = 'center';
  ctx.fillText('$', 64, 30);
  ctx.restore();
}

/* ---------- prices ---------- */
function priceNow(t) {
  let v0 = 1;
  let v1 = 1;
  let k = 1;
  let ts = -1;
  for (const [s, v] of T.priceSteps) {
    if (t >= s) {
      v0 = v1;
      v1 = v;
      ts = s;
    }
  }
  k = ez(t, ts, ts + 0.5, E.io3);
  return { v0, v1, k, ts, v: lerp(v0, v1, k) };
}
function priceColor(v) {
  const k = clamp((v - 1) / 1);
  return k < 0.35 ? mix('mint', 'amber', k / 0.35) : mix('amber', 'coral', (k - 0.35) / 0.65);
}
const TAG = { x: 808, y: 330 };
function drawPriceTag(t) {
  if (t < T.todays - 0.2 || t > T.today + 0.6) return;
  const s = pop(t, T.todays - 0.15, 0.5, 2) * pout(t, T.today + 0.05, 0.4);
  if (s <= 0.01) return;
  const P = priceNow(t);
  // swing from its string whenever the price changes
  let swing = 0;
  for (const [ts] of T.priceSteps) swing += wob(t, ts, 1.6, 3.2) * 0.14;
  const bump = wob(t, T.up, 3, 6) * 0.14;
  const lift = -ez(t, T.up - 0.05, T.up + 0.25, E.out3) * 18 * (1 - ez(t, T.up + 0.6, T.up + 1.2));
  ctx.save();
  ctx.translate(TAG.x, TAG.y - 118 + lift);
  // string
  ctx.strokeStyle = rgba(RGB.mist, 0.7);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -140);
  ctx.lineTo(Math.sin(swing) * 20, 0);
  ctx.stroke();
  ctx.rotate(swing);
  ctx.scale(s * (1 + bump), s * (1 - bump));
  const W0 = 290;
  const H0 = 170;
  // tag body with a pointed top and eyelet
  ctx.fillStyle = 'rgba(3,4,20,0.35)';
  tagPath(-W0 / 2 + 8, 12, W0, H0);
  ctx.fill();
  ctx.fillStyle = PAL.snow;
  tagPath(-W0 / 2, 0, W0, H0);
  ctx.fill();
  ctx.fillStyle = priceColor(P.v);
  ctx.save();
  tagPath(-W0 / 2, 0, W0, H0);
  ctx.clip();
  ctx.fillRect(-W0 / 2, H0 - 26, W0, 30);
  ctx.restore();
  ctx.fillStyle = PAL.night;
  circle(0, 18, 9);
  ctx.fill();
  ctx.fillStyle = PAL.fog;
  ctx.textAlign = 'center';
  spaced('BREAD', 0, 70, fBric(26, 700), 6);
  // odometer price
  drawOdometer(P, 0, 136, 78);
  ctx.restore();
  // up arrow when prices are pushed up
  const ua = win(t, T.up - 0.1, T.up + 1.6, 0.1, 0.4);
  if (ua > 0.01) {
    const k = pop(t, T.up - 0.1, 0.4);
    ctx.save();
    ctx.translate(TAG.x + 196, TAG.y + 10 + Math.sin(t * 7) * 6 - k * 10);
    ctx.scale(k, k);
    ctx.globalAlpha = ua;
    ctx.fillStyle = PAL.coral;
    poly([0, -46, 34, 0, 12, 0, 12, 40, -12, 40, -12, 0, -34, 0]);
    ctx.fill();
    ctx.restore();
  }
}
function tagPath(x, y, w, h) {
  const r = 18;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - 22);
  ctx.lineTo(x + w - 40, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.lineTo(x + 40, y);
  ctx.closePath();
}
function drawOdometer(P, cx, base, size) {
  const f = fBric(size, 800);
  const s0 = '$' + P.v0.toFixed(2);
  const s1 = '$' + P.v1.toFixed(2);
  const cw = measure('0', f);
  const widths = [...s1].map((ch) => (ch === '.' ? measure('.', f) : ch === '$' ? measure('$', f) : cw));
  const total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2;
  ctx.font = f;
  ctx.textAlign = 'center';
  for (let i = 0; i < s1.length; i++) {
    const w = widths[i];
    const a = s0[i];
    const b = s1[i];
    ctx.fillStyle = PAL.night;
    if (a === b || P.k >= 1) ctx.fillText(b, x + w / 2, base);
    else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 2, base - size * 0.8, w + 4, size * 1.0);
      ctx.clip();
      const h = size * 0.95;
      const k = E.outBack(P.k, 1.4);
      ctx.fillText(a, x + w / 2, base - k * h);
      ctx.fillText(b, x + w / 2, base + (1 - k) * h);
      ctx.restore();
    }
    x += w;
  }
}

/* ---------- baskets of bread ---------- */
function basketScale(i, t) {
  const [b0] = T.buy[i];
  return pop(t, b0 - 0.5, 0.45) * pout(t, T.today + i * 0.07, 0.35);
}
function drawBaskets(t) {
  if (t < T.buy[0][0] - 0.6 || t > T.today + 0.8) return;
  const tagW = f2w(TAG.x, TAG.y);
  for (let i = 0; i < 4; i++) {
    const s = basketScale(i, t) * 0.8;
    if (s <= 0.01) continue;
    const [b0, gap, n] = T.buy[i];
    const x = BX[i];
    const y = LV[i];
    // loaves arriving from the market (the price tag), landing in the basket
    const slots = [
      [-34, -70, -0.12],
      [34, -72, 0.1],
      [0, -102, 0.02],
      [-2, -132, -0.06],
    ];
    const count = Math.ceil(n - 0.01);
    for (let j = 0; j < count; j++) {
      const ta = b0 + j * gap;
      if (t < ta) continue;
      const half = n - j < 0.99;
      const [dx, dy, r] = slots[j];
      const u = prog(t, ta, ta + 0.42);
      const tx = x + dx * s;
      const ty = y + dy * s;
      const px = lerp(tagW[0], tx, E.out2(u));
      const py = lerp(tagW[1], ty, E.in2(u)) - Math.sin(u * Math.PI) * 120;
      const q = wob(t, ta + 0.42, 4, 8) * 0.25;
      const ww = 120 * s * (0.5 + 0.5 * E.out3(u));
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1 + q, 1 - q);
      loaf(0, 0, ww, lerp(0.8, r, u), clamp(u * 4), half);
      ctx.restore();
    }
    basket(x, y, s);
  }
}

/* ---------- people of the line ---------- */
const FOLK = [
  null,
  { c: [PAL.lilac, PAL.lilacLo, '#cfc6ff'], seed: 2 },
  { c: [PAL.amber, PAL.amberLo, '#ffcf9c'], seed: 3 },
  { c: [PAL.mint, PAL.mintLo, PAL.mintHi], seed: 4 },
];
const APPEAR = () => [0, T.everyone - 0.08, T.everyone + 0.1, T.everyone + 0.28];

/** the gold line on the chart: y at x∈[0,1] */
const chartGold = (x) => 1296 - 700 * (0.07 + 0.8 * smooth(clamp((x - 0.04) / 0.52)) + 0.018 * Math.sin(x * 19));
const chartMint = (x) => 1296 - 700 * (0.07 + 0.2 * smooth(clamp((x - 0.52) / 0.48)) + 0.01 * Math.sin(x * 13));
const goldProg = (t) => ez(t, T.rise - 0.3, T.first2 + 0.55, E.io2);
const mintProg = (t) => ez(t, T.wages - 0.1, T.last + 0.5, E.io2);

function folkState(i, t) {
  const tin = APPEAR()[i];
  if (t < tin) return null;
  let x = PX[i];
  let y = LV[i];
  let s = 0.9 * pop(t, tin, 0.5, 2.3);
  let rot = 0;
  let walk = 0;
  let sx = 1;
  let sy = 1;
  // squash on arrival and when coins land at their feet
  let q = wob(t, tin + 0.45, 3, 7) * 0.16;
  if (i < 4) q += wob(t, T.arrive[i] || -9, 4, 8) * 0.1;
  // chart: shrink into a marker riding a line
  const c = ez(t, T.chart, T.chart + 0.95, E.io4);
  if (i === 2 && t > T.chart) s *= pout(t, T.chart + 0.05, 0.35);
  if ((i === 1 || i === 3) && c > 0) {
    const gp = i === 1 ? goldProg(t) : mintProg(t);
    const fx = i === 1 ? chartGold : chartMint;
    const hx = 150 + 810 * gp;
    const hy = fx(gp);
    x = lerp(x, hx, c);
    y = lerp(y, hy - 8, c);
    s = lerp(s, 0.36, c);
  }
  // wave
  if (t > T.own - 0.1) {
    const w = waveState(t);
    if (i === 1) {
      const m = ez(t, T.ride - 0.45, T.ride + 0.25, E.io3);
      const [cx, cy] = [w.crestX, w.crestY];
      x = lerp(x, cx - 10, m);
      y = lerp(y, cy - 40, m) + Math.sin(t * 5) * 6 * m;
      s = lerp(s, 0.5, m);
      rot = Math.sin(t * 3) * 0.08 * m;
    }
    if (i === 3) {
      const gone = pout(t, T.own + 0.15, 0.3);
      const back = pop(t, T.dont - 0.2, 0.45);
      const run = ez(t, T.chase - 0.15, T.waveEnd + 0.6, E.io2);
      const gx = lerp(150, 430, run);
      if (t > T.dont - 0.2) {
        x = gx;
        y = 1296 - Math.abs(Math.sin(t * 14)) * 16 * run * (1 - prog(t, T.waveEnd + 0.3, T.waveEnd + 0.6));
        s = 0.55 * back;
      } else s *= gone;
      walk = run > 0 && run < 1 ? t * 14 : 0;
      rot = run > 0 && run < 1 ? 0.12 : 0;
    }
  }
  // finale: everybody lines up under the tap
  if (t > T.panUpStart) {
    if (i === 2) {
      s = 0.8 * pop(t, T.stole + 0.5, 0.5);
      x = QX[2];
      y = QY;
      q = wob(t, T.stole + 0.95, 3, 7) * 0.16;
    } else {
      const m = ez(t, T.panUpStart, T.stole + 0.45, E.io3);
      x = lerp(x, QX[i], m);
      const y0 = y;
      y = lerp(y0, QY, E.out2(m)) - Math.sin(m * Math.PI) * 240;
      s = lerp(s, 0.8, m);
      const fly = Math.sin(m * Math.PI);
      sx = 1 - 0.18 * fly;
      sy = 1 + 0.3 * fly;
      rot = lerp(rot, 0, m);
      q += wob(t, T.stole + 0.45, 3, 7) * 0.2;
      if (m >= 1) walk = 0;
    }
  }
  return { x, y, s, sx: sx * (1 + q), sy: sy * (1 - q), rot, walk };
}

function drawFolk(t) {
  for (let i = 1; i < 4; i++) {
    const st = folkState(i, t);
    if (!st || st.s <= 0.01) continue;
    const F = FOLK[i];
    let mood = 'smile';
    let look = [0, 0];
    let armL = 0.25;
    let armR = 0.25;
    let sweat = 0;
    let brow = 0;
    // reactions through the line
    if (t > T.arrive[i] - 0.4 && t < T.arrive[i] + 0.9) {
      mood = 'grin';
      look = i % 2 ? [-0.8, -0.2] : [0.8, -0.2];
    }
    const [b0] = T.buy[i];
    if (t > b0 - 0.2 && t < b0 + 0.9) {
      look = [0.8, -1];
      armL = armR = 1.2 * win(t, b0 - 0.2, b0 + 0.9, 0.2, 0.3);
    }
    if (i === 2 && t > T.arrive[2] - 0.2 && t < T.today) mood = t > b0 + 0.6 ? 'flat' : 'grin';
    if (i === 3) {
      if (t > T.checkAt + 0.1) {
        mood = 'grin';
        armL = 1.5;
      }
      if (t > T.prices2 - 0.15) {
        mood = t > T.climbed + 0.2 ? 'sad' : 'o';
        look = [0.9, -1];
        armL = 0.3;
        brow = 1;
      }
      if (t > T.same) {
        look = [0, 0];
        mood = 'sad';
      }
    }
    if (t > T.today) {
      mood = 'smile';
      look = [0, 0];
      brow = 0;
    }
    if (t > T.own - 0.1 && t < T.panUpStart + 0.5) {
      if (i === 1) {
        mood = 'joy';
        armL = armR = 2.4;
      }
      if (i === 3) {
        mood = t > T.chase ? 'o' : 'flat';
        look = [1, -0.4];
        sweat = t > T.chase ? (t * 2) % 1 : 0;
        armL = armR = t > T.chase ? 1 + Math.sin(t * 14) * 0.6 : 0.3;
        brow = t > T.chase ? 1 : 0;
      }
    }
    if (t > T.stole) {
      mood = i === 1 ? (t > T.winners ? 'grin' : 'smile') : i === 3 && t > T.winners ? 'flat' : 'smile';
      look = [0, 0];
      armL = armR = 0.25;
      sweat = 0;
      brow = 0;
      if (t > T.appears - 0.8) look = [-0.6, -0.9];
      if (t > T.question + 0.2) look = [0.1, -1];
    }
    const acc = {};
    if (t > T.today + 0.1 && t < T.stole + 20) {
      if (i === 1) acc.tie = PAL.coral;
      if (i === 2) acc.apron = true;
      if (i === 3) acc.hardhat = true;
    }
    // winners glow in the finale
    if (i === 1 && t > T.winners - 0.2) {
      const g = win(t, T.winners - 0.2, T.appears, 0.3, 0.6);
      glow('gold', st.x, st.y - 90 * st.s, 190, 0.45 * g);
    }
    if (i === 1 && t > T.own - 0.1 && t < T.panUpStart + 0.3) drawBoard(st, t);
    const hands = person({
      x: st.x,
      y: st.y,
      s: st.s,
      sx: st.sx,
      sy: st.sy,
      rot: st.rot,
      walk: st.walk,
      c: F.c,
      mood,
      look,
      blink: blinkAt(t, F.seed),
      armL,
      armR,
      sweat,
      brow,
      acc,
    });
    // accessories arrive with a puff
    const pf = prog(t, T.today + 0.1 + i * 0.12, T.today + 0.6 + i * 0.12);
    if (pf > 0 && pf < 1)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + i;
        const r = 40 + 70 * E.out3(pf);
        sparkle(st.x + Math.cos(a) * r, st.y - 120 * st.s + Math.sin(a) * r * 0.7, 9 * (1 - pf), a, 'goldHi', 1 - pf);
      }
    if (i === 1 && t > T.today + 0.15 && t < T.chart + 0.4) briefcase(hands.r[0], hands.r[1], st.s * pop(t, T.today + 0.15, 0.4) * pout(t, T.chart, 0.3));
  }
}
function briefcase(x, y, s) {
  if (s <= 0.01) return;
  ctx.save();
  ctx.translate(x, y + 6 * s);
  ctx.scale(s, s);
  ctx.strokeStyle = PAL.woodLo;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 4, 12, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = PAL.wood;
  rrect(-34, 4, 68, 48, 8);
  ctx.fill();
  ctx.fillStyle = PAL.gold;
  ctx.fillRect(-6, 18, 12, 8);
  ctx.restore();
}
function drawBoard(st, t) {
  const k = pop(t, T.ride - 0.35, 0.4);
  if (k <= 0) return;
  ctx.save();
  ctx.translate(st.x, st.y + 6);
  ctx.rotate(st.rot * 1.2 - 0.08);
  ctx.scale(k, k);
  ctx.fillStyle = PAL.coral;
  ellipse(0, 0, 120 * st.s * 2, 14);
  ctx.fill();
  ctx.fillStyle = PAL.snow;
  ctx.fillRect(-100 * st.s * 2, -3, 200 * st.s * 2, 6);
  ctx.restore();
}

/* ---------- order badges and labels ---------- */
function drawBadges(t) {
  if (t < T.once - 0.1 || t > T.overview + 0.6) return;
  const lbl = ['1', '2', '3', '4'];
  for (let i = 0; i < 4; i++) {
    const s = pop(t, T.once - 0.05 + i * 0.12, 0.4) * pout(t, T.overview + i * 0.05, 0.3);
    if (s <= 0.01) continue;
    const x = PX[i] + (i % 2 ? 84 : -84);
    const y = LV[i] - 236;
    // the badge brightens as the pulse of new money passes it
    const hit = Math.exp(-Math.pow((prog(t, T.flows - 0.1, T.lineW + 0.55) - (i + 0.6) / 4.2) * 9, 2));
    const isYou = i === 3 && t > T.paycheck - 0.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (1 + hit * 0.25), s * (1 + hit * 0.25));
    glow('gold', 0, 0, 90, 0.3 + hit * 0.7);
    ctx.fillStyle = isYou ? PAL.mint : PAL.gold;
    circle(0, 0, isYou ? 0 : 34);
    ctx.fill();
    if (isYou) {
      const w = pop(t, T.paycheck - 0.2, 0.4);
      ctx.fillStyle = PAL.mint;
      rrect(-58 * w, -30, 116 * w, 60, 30);
      ctx.fill();
      ctx.fillStyle = PAL.night;
      ctx.textAlign = 'center';
      ctx.font = fBric(34, 800);
      ctx.fillText('YOU', 0, 12);
    } else {
      ctx.fillStyle = PAL.goldDeep;
      ctx.textAlign = 'center';
      ctx.font = fBric(40, 800);
      ctx.fillText(lbl[i], 0, 14);
    }
    ctx.restore();
  }
}
/** a small caps label pinned to the world */
function tagLabel(t, text, x, y, t0, t1, color = PAL.snow, size = 34, bg = null) {
  const s = pop(t, t0, 0.4) * pout(t, t1, 0.3);
  if (s <= 0.01) return;
  const f = fBric(size, 800);
  const w = spacedWidth(text, f, size * 0.14);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (bg) {
    ctx.fillStyle = bg;
    rrect(-w / 2 - 22, -size * 1.05, w + 44, size * 1.5, size * 0.75);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  spaced(text, 0, 0, f, size * 0.14);
  ctx.restore();
}
function drawLineLabels(t) {
  // same money, less stuff: loaf counts
  const counts = ['×4', '×3', '×2½', '×2'];
  for (let i = 0; i < 4; i++) {
    const t0 = T.less + i * 0.12;
    if (t < t0 || t > T.today + 0.6) continue;
    const s = pop(t, t0, 0.4, 2.5) * pout(t, T.today + i * 0.05, 0.3);
    ctx.save();
    ctx.translate(BX[i] + (i % 2 ? -14 : 14), LV[i] - 196);
    ctx.scale(s, s);
    ctx.font = fBric(112, 800);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(4,5,22,0.5)';
    ctx.fillText(counts[i], 0, 6);
    ctx.fillStyle = priceColor(1 + i / 3);
    ctx.fillText(counts[i], 0, 0);
    ctx.restore();
  }
  // identical little piles of money next to everyone: "same money"
  for (let i = 0; i < 4; i++) {
    const t0 = T.same - 0.1 + i * 0.06;
    if (t < t0 || t > T.today + 0.6) continue;
    const s = pop(t, t0, 0.4, 2.4) * pout(t, T.today + i * 0.05, 0.3);
    const bx = HX[i] + (i === 0 ? -20 : 0);
    const by = LV[i];
    glow('gold', bx, by - 50, 110 * s, 0.35);
    for (let j = 0; j < 3; j++) coin(bx + (j - 1) * 50 * s, by - 32 * s, 32 * s, 0, 1, 1, 1);
    coin(bx - 25 * s, by - 84 * s, 32 * s, 0, 1, 1, 1);
    coin(bx + 25 * s, by - 84 * s, 32 * s, 0, 1, 1, 1);
  }
  // where each person stands in the line
  tagLabel(t, 'FIRST IN LINE', 390, LV[0] + 128, T.firstW - 0.05, T.overview, PAL.gold, 40);
  tagLabel(t, 'NEXT IN LINE', 690, LV[1] + 128, T.nextW - 0.05, T.end + 0.4, PAL.lilac, 40);
  tagLabel(t, 'END OF THE LINE', 690, LV[3] + 128, T.endW - 0.05, T.overview, PAL.mint, 40);
  // today: who is who
  tagLabel(t, 'BANKS', PX[0], LV[0] + 128, T.banks - 0.05, T.chart, PAL.goldHi, 56);
  tagLabel(t, 'FINANCIAL MARKETS', 690, LV[1] + 128, T.financial - 0.05, T.chart, PAL.goldHi, 52);
}

/* ---------- the bank (Cantillon, modernised) ---------- */
function drawBank(t) {
  const t0 = T.today + 0.25;
  if (t < t0 || t > T.chart + 0.5) return;
  const k = E.outBack(prog(t, t0, t0 + 0.55), 2);
  const out = pout(t, T.chart, 0.4);
  const s = 0.95 * out;
  if (s <= 0.01) return;
  ctx.save();
  ctx.translate(PX[0], LV[0]);
  ctx.scale(s * lerp(1.6, 1, clamp(k)), s * k);
  const W0 = 260;
  const H0 = 240;
  ctx.fillStyle = PAL.stoneLo;
  ctx.fillRect(-W0 / 2 - 16, -22, W0 + 32, 22);
  ctx.fillStyle = PAL.stone;
  ctx.fillRect(-W0 / 2 - 6, -38, W0 + 12, 18);
  // columns
  for (let c = 0; c < 4; c++) {
    const cx = -W0 / 2 + 26 + c * ((W0 - 52) / 3);
    ctx.fillStyle = PAL.stone;
    ctx.fillRect(cx - 14, -H0 + 70, 28, H0 - 108);
    ctx.fillStyle = PAL.stoneLo;
    ctx.fillRect(cx + 6, -H0 + 70, 8, H0 - 108);
  }
  ctx.fillStyle = PAL.stone;
  ctx.fillRect(-W0 / 2, -H0 + 36, W0, 36);
  ctx.fillStyle = PAL.stoneLo;
  ctx.fillRect(-W0 / 2, -H0 + 64, W0, 8);
  poly([-W0 / 2 - 14, -H0 + 38, 0, -H0 - 40, W0 / 2 + 14, -H0 + 38]);
  ctx.fill();
  ctx.fillStyle = PAL.stone;
  poly([-W0 / 2 + 8, -H0 + 32, 0, -H0 - 28, W0 / 2 - 8, -H0 + 32]);
  ctx.fill();
  ctx.fillStyle = PAL.gold;
  circle(0, -H0 + 6, 13);
  ctx.fill();
  ctx.fillStyle = PAL.night;
  ctx.textAlign = 'center';
  spaced('BANK', 0, -H0 + 64, fBric(26, 800), 8);
  ctx.restore();
  // puff where Cantillon became the bank
  const pf = prog(t, T.today, T.today + 0.6);
  if (pf > 0 && pf < 1) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const r = 60 + 120 * E.out3(pf);
      sparkle(PX[0] + Math.cos(a) * r, LV[0] - 100 + Math.sin(a) * r * 0.7, 12 * (1 - pf), a, 'goldHi', 1 - pf);
    }
  }
}
