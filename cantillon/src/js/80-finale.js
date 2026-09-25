/* ==========================================================================
   Finale: everyone queues under the tap. The winners simply stand closer.
   A new drop of money forms, becomes the dot of the question mark, then
   falls all the way back down to the vitrine: the last frame is the first.
   ========================================================================== */

function drawQueue(t) {
  if (t < T.stole - 0.2 || t > T.land) return;
  const g = ez(t, T.stole + 0.05, T.stole + 0.6, E.out4);
  if (g <= 0) return;
  const cx = 570;
  const half = 420 * g;
  ledge(cx - half, cx + half, QY, 44);
  // brackets: how far each person stands from the tap
  const b = ez(t, T.closer - 0.15, T.tapW + 0.2, E.io3);
  const out = 1 - ez(t, T.ask - 0.2, T.ask + 0.3);
  if (b > 0 && out > 0) {
    const ox = 300;
    ctx.save();
    ctx.globalAlpha = out;
    ctx.setLineDash([3, 14]);
    ctx.strokeStyle = rgba(RGB.goldHi, 0.6);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox, -836);
    ctx.lineTo(ox, QY + 60 + 3 * 26 + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    const cols = [PAL.gold, PAL.gold, PAL.amber, PAL.coral];
    for (let i = 1; i < 4; i++) {
      const k = E.out3(clamp(b * 1.4 - (i - 1) * 0.2));
      if (k <= 0) continue;
      const y = QY + 60 + i * 26;
      const x1 = lerp(ox, QX[i], k);
      ctx.strokeStyle = cols[i];
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(ox, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y - 14);
      ctx.lineTo(x1, y + 14);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------- the drop of new money ---------- */
function qLayout() {
  // frame-space layout for "WHO GETS / IT FIRST?"
  const size = 150;
  const f = fBric(size, 800);
  const l1 = ['WHO', 'GETS'];
  const l2 = ['IT', 'FIRST'];
  const sp = measure(' ', f);
  const qW = measure('?', f);
  const w1 = measure('WHO', f) + sp + measure('GETS', f);
  const w2 = measure('IT', f) + sp + measure('FIRST', f) + qW;
  const y1 = 610;
  const y2 = 770;
  const x1 = 540 - w1 / 2;
  const x2 = 540 - w2 / 2;
  const words = [
    { t: 'WHO', x: x1 + measure('WHO', f) / 2, y: y1, at: T.who },
    { t: 'GETS', x: x1 + measure('WHO', f) + sp + measure('GETS', f) / 2, y: y1, at: T.gets },
    { t: 'IT', x: x2 + measure('IT', f) / 2, y: y2, at: T.it2, c: PAL.gold },
    { t: 'FIRST', x: x2 + measure('IT', f) + sp + measure('FIRST', f) / 2, y: y2, at: T.first3, c: PAL.gold },
  ];
  const qx = x2 + measure('IT', f) + sp + measure('FIRST', f) + qW / 2;
  return { f, size, words, qx, qy: y2, dot: [qx - qW * 0.03, y2 - size * 0.07] };
}
let QL = null;
function dropState(t) {
  const t0 = T.appears - 0.75;
  if (t < t0 || t > T.land + 0.05) return null;
  const outlet = [300, -950 + 112 + 18];
  const swell = ez(t, t0, T.appears + 0.25, E.out3);
  let x = outlet[0];
  let y = outlet[1] + 26 * swell;
  let r = 30 * swell;
  let stretch = 1 + 0.25 * swell;
  if (t > T.askW - 0.1) {
    // lifts off and floats to become the dot of the question mark
    const [dx, dy] = f2w(QL.dot[0], QL.dot[1]);
    const k = E.io4(prog(t, T.askW - 0.1, T.question + 0.35));
    x = lerp(x, dx, k) + Math.sin(k * Math.PI) * -120;
    y = lerp(y, dy, k) - Math.sin(k * Math.PI) * 60;
    r = lerp(r, 22, k);
    stretch = lerp(stretch, 1, k);
  }
  if (t > T.drop) {
    // falls, and the camera falls with it
    const u = prog(t, T.drop, T.land);
    [x, y] = dropFall(t);
    r = lerp(22, 26, u);
    stretch = 1 + 0.7 * Math.sin(u * Math.PI);
  }
  return { x, y, r, stretch };
}
function dropFrom() {
  // where the dot is at the moment it lets go
  return f2wC(camAt(T.drop), QL.dot[0], QL.dot[1]);
}
/** world position of the falling drop (T.drop → T.land) */
function dropFall(t) {
  const d0 = dropFrom();
  const u = E.io2(prog(t, T.drop, T.land));
  return [lerp(d0[0], VIT.x, u), lerp(d0[1], VIT.y - 296, u)];
}
function drawDrop(t, layer) {
  if ((layer === 'back') !== t > T.drop) return;
  const d = dropState(t);
  if (!d || d.r <= 0.5) return;
  if (t > T.land) return;
  glow('gold', d.x, d.y, d.r * 5, 0.55);
  glow('goldHi', d.x, d.y, d.r * 2, 0.5);
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(1 / Math.sqrt(d.stretch), d.stretch);
  ctx.fillStyle = PAL.gold;
  ctx.beginPath();
  ctx.moveTo(0, -d.r * 1.9);
  ctx.bezierCurveTo(d.r * 0.5, -d.r * 1.1, d.r, -d.r * 0.5, d.r, 0);
  ctx.arc(0, 0, d.r, 0, Math.PI);
  ctx.bezierCurveTo(-d.r, -d.r * 0.5, -d.r * 0.5, -d.r * 1.1, 0, -d.r * 1.9);
  ctx.fill();
  ctx.fillStyle = PAL.goldHi;
  ellipse(-d.r * 0.35, -d.r * 0.2, d.r * 0.22, d.r * 0.4, 0.3);
  ctx.fill();
  ctx.restore();
}

/* ---------- finale type ---------- */
function initFinaleType() {
  BLOCKS.stole = makeBlock({
    x: 650,
    y: -690,
    world: true,
    out: T.winners - 0.2,
    outFx: 'rise',
    lines: [
      {
        size: 96,
        words: [
          { t: 'NOBODY', at: Ws('stole', 'nobody') },
          { t: 'STOLE', at: T.stoleW },
        ],
      },
      { size: 96, color: PAL.mint, words: [{ t: 'ANYTHING.', at: T.anything }] },
    ],
  });
  BLOCKS.tap = makeBlock({
    x: 650,
    y: -770,
    world: true,
    lead: 1.12,
    out: T.ask - 0.15,
    outFx: 'rise',
    lines: [
      {
        size: 44,
        weight: 700,
        track: 3,
        color: PAL.mist,
        words: [
          { t: 'THE', at: Ws('tap', 'the') },
          { t: 'WINNERS', at: T.winners },
          { t: 'JUST', at: Ws('tap', 'just') },
          { t: 'STAND', at: Ws('tap', 'stand') },
        ],
      },
      {
        size: 110,
        color: PAL.gold,
        words: [
          { t: 'CLOSER', at: T.closer },
          { t: 'TO', at: Ws('tap', 'to') },
        ],
      },
      {
        size: 110,
        color: PAL.gold,
        words: [
          { t: 'THE', at: Ws('tap', 'the', 1) },
          { t: 'TAP.', at: T.tapW },
        ],
      },
    ],
  });
  BLOCKS.ask = makeBlock({
    x: 540,
    y: 440,
    out: T.who - 0.2,
    outFx: 'rise',
    lines: [
      {
        size: 40,
        weight: 700,
        track: 8,
        color: PAL.goldHi,
        words: [
          { t: 'ASK', at: T.askW },
          { t: 'ONE', at: Ws('ask', 'one') },
          { t: 'QUESTION', at: T.question },
        ],
      },
    ],
  });
  QL = qLayout();
}
function drawQuestion(t) {
  if (t < T.who - 0.05 || t > T.land) return;
  const leave = prog(t, T.drop, T.drop + 0.7);
  const scroll = t > T.drop ? (camAt(T.drop).y - CAM.y) * CAM.z : 0;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = QL.f;
  const words = [...QL.words, { t: '?', x: QL.qx, y: QL.qy, at: T.first3 + 0.12, c: PAL.gold, hook: true }];
  words.forEach((w, i) => {
    const d = t - w.at;
    if (d < 0) return;
    const k1 = E.out4(clamp(d / 0.16));
    const s0 = lerp(2.2, 1, k1);
    const q = wob(t, w.at + 0.16, 3.6, 8) * 0.2;
    let a = clamp(d / 0.08);
    let dy = 0;
    // the question stays behind in the world as the camera follows the dot down
    const lv = clamp(leave * 1.3 - i * 0.06);
    dy = scroll;
    a *= 1 - E.in2(lv);
    if (a <= 0.01) return;
    ctx.save();
    ctx.translate(w.x, w.y + dy);
    ctx.scale(s0 * (1 + q), s0 * (1 - q));
    ctx.globalAlpha = a;
    if (w.hook) {
      // the question mark's hook only; its dot is the drop of money
      ctx.beginPath();
      ctx.rect(-QL.size, -QL.size * 1.2, QL.size * 2, QL.size * 1.2 - QL.size * 0.2);
      ctx.clip();
    }
    ctx.fillStyle = 'rgba(5,6,26,0.55)';
    ctx.fillText(w.t, 0, 7);
    ctx.fillStyle = w.c || PAL.snow;
    ctx.fillText(w.t, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}
