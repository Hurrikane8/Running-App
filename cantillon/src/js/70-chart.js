/* ==========================================================================
   Today: the ledges fold flat into a time axis, the money's route becomes
   two lines (assets first, wages last), and the asset line swells into a
   wave that owners ride and everyone else chases.
   ========================================================================== */

function drawChart(t) {
  if (t < T.chart || t > T.panUpStart + 0.6) return;
  const ax = ez(t, T.chart + 0.35, T.chart + 1.05, E.io3);
  const fade = 1 - ez(t, T.own + 0.1, T.ride + 0.1);
  const gp = goldProg(t);
  const mp = mintProg(t);
  // y axis + arrows
  if (fade > 0.01) {
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = rgba(RGB.mist, 0.75);
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(154, 1300);
    ctx.lineTo(154, lerp(1300, 540, ax));
    ctx.stroke();
    if (ax > 0.9) {
      ctx.fillStyle = rgba(RGB.mist, 0.75);
      poly([154, 512, 136, 546, 172, 546]);
      ctx.fill();
      poly([992, 1300, 958, 1282, 958, 1318]);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = PAL.mist;
      spaced('PRICES', 184, 540, fBric(30, 800), 5, 'left');
      ctx.textAlign = 'right';
      spaced('TIME', 990, 1360, fBric(30, 800), 5, 'right');
    }
    ctx.restore();
  }
  // the gap between what assets did and what wages did
  if (gp > 0 && fade > 0.01) {
    ctx.save();
    ctx.globalAlpha = 0.16 * fade;
    ctx.fillStyle = PAL.coral;
    ctx.beginPath();
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * gp;
      const x = 150 + 810 * u;
      if (i) ctx.lineTo(x, chartGold(u));
      else ctx.moveTo(x, chartGold(u));
    }
    for (let i = n; i >= 0; i--) {
      const u = (i / n) * gp;
      ctx.lineTo(150 + 810 * u, chartMint(u));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const line = (fn, p, color, glowName, a) => {
    if (p <= 0 || a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = color;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = Math.max(2, Math.ceil(80 * p));
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * p;
      const x = 150 + 810 * u;
      if (i) ctx.lineTo(x, fn(u));
      else ctx.moveTo(x, fn(u));
    }
    ctx.stroke();
    ctx.restore();
    glow(glowName, 150 + 810 * p, fn(p), 70, 0.6 * a);
  };
  // gold becomes the wave's surface, so it stays until the wave takes over
  const goldA = 1 - ez(t, T.own + 0.2, T.own + 0.5);
  line(chartMint, mp, PAL.mint, 'mint', fade);
  line(chartGold, gp, PAL.gold, 'gold', goldA);
  // labels
  if (fade > 0.01) {
    ctx.save();
    ctx.globalAlpha = fade;
    tagLabel(t, 'STOCKS & HOMES', 460, 610, Math.max(T.stocks - 0.05, T.chart + 0.75), T.own + 0.1, PAL.gold, 46);
    tagLabel(t, 'WAGES', 800, 1232, T.wages - 0.05, T.own + 0.1, PAL.mint, 46);
    tagLabel(t, 'FIRST', 330, 900, T.first2 - 0.08, T.own + 0.1, PAL.goldHi, 30, rgba(RGB.goldDeep, 0.8));
    tagLabel(t, 'LAST', 850, 1060, T.last - 0.08, T.own + 0.1, PAL.mintHi, 30, rgba(RGB.mintDeep, 0.9));
    ctx.restore();
  }
}

/* ---------- the wave ---------- */
function waveState(t) {
  const m = ez(t, T.ride - 0.55, T.waveW + 0.15, E.io3);
  const dx = 190 * ez(t, T.chase - 0.3, T.waveEnd + 0.8, E.io2);
  const out = ez(t, T.panUpStart, T.stole + 0.2, E.in2);
  const crestU = 0.68;
  const H = 640 * (1 - out);
  const crestX = 150 + 810 * crestU + dx;
  const crestY = lerp(chartGold(crestU), 1296 - H, m);
  return { m, dx, crestU, H, crestX, crestY, out };
}
function waveHeight(u, H) {
  if (u <= 0.68) return H * Math.pow(smooth(u / 0.68), 1.35);
  return H * Math.pow(1 - smooth(clamp((u - 0.68) / 0.26)), 0.85);
}
function drawWave(t) {
  if (t < T.own - 0.15 || t > T.stole + 0.3) return;
  const W0 = waveState(t);
  const fillA = ez(t, T.own - 0.1, T.own + 0.35);
  if (fillA <= 0.01 || W0.H <= 1) return;
  const n = 90;
  const top = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const chartY = chartGold(Math.min(u, 1));
    const waveY = 1296 - waveHeight(u, W0.H) + Math.sin(u * 38 - t * 7) * 6 * W0.m * (1 - smooth(clamp((u - 0.6) / 0.1)));
    top.push([150 + 810 * u + W0.dx * lerp(0.3, 1, u) * W0.m, lerp(chartY, waveY, W0.m)]);
  }
  ctx.save();
  ctx.globalAlpha = fillA;
  // body
  const g = ctx.createLinearGradient(0, W0.crestY, 0, 1300);
  g.addColorStop(0, PAL.gold);
  g.addColorStop(1, PAL.goldLo);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(top[0][0], 1300);
  for (const [x, y] of top) ctx.lineTo(x, y);
  ctx.lineTo(top[n][0], 1300);
  ctx.closePath();
  ctx.fill();
  // stripes of lighter swell
  ctx.strokeStyle = rgba(RGB.goldHi, 0.35 * W0.m);
  ctx.lineWidth = 5;
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    for (let i = 0; i <= n * 0.66; i++) {
      const [x, y] = top[i];
      const yy = y + k * 46 + Math.sin(i * 0.4 - t * 3 + k) * 6;
      if (i) ctx.lineTo(x, Math.min(1290, yy));
      else ctx.moveTo(x, Math.min(1290, yy));
    }
    ctx.stroke();
  }
  // crest line
  ctx.strokeStyle = PAL.goldHi;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= n * 0.7; i++) {
    const [x, y] = top[i];
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  // the curling lip
  if (W0.m > 0.02) {
    const k = W0.m;
    const cx = W0.crestX;
    const cy = W0.crestY;
    const H = W0.H;
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.moveTo(cx - 40, cy + 10);
    ctx.bezierCurveTo(cx + 40 * k, cy - 50 * k, cx + 190 * k, cy - 10 * k, cx + 190 * k, cy + 110 * k);
    ctx.bezierCurveTo(cx + 190 * k, cy + 190 * k, cx + 110 * k, cy + 200 * k, cx + 96 * k, cy + 150 * k);
    ctx.bezierCurveTo(cx + 130 * k, cy + 140 * k, cx + 120 * k, cy + 60 * k, cx + 40 * k, cy + 70 * k);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.goldDeep;
    ctx.globalAlpha = fillA * 0.5 * k;
    ellipse(cx + 118 * k, cy + 120 * k, 40 * k, 50 * k, 0.3);
    ctx.fill();
    ctx.globalAlpha = fillA;
    // foam
    ctx.fillStyle = PAL.snow;
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.38;
      const r = 150 * k;
      const fx = cx + 70 * k + Math.cos(a) * r * 0.8;
      const fy = cy + 60 * k + Math.sin(a) * r * 0.62;
      circle(fx, fy, (7 + 4 * Math.sin(t * 8 + i)) * k);
      ctx.fill();
    }
    // spray
    for (let i = 0; i < 10; i++) {
      const ph = (t * 1.6 + i / 10) % 1;
      const sx = cx + 150 * k + ph * 120 + i * 6;
      const sy = cy - 20 * k + ph * ph * 180 - 40 * ph;
      ctx.globalAlpha = fillA * (1 - ph) * k;
      circle(sx, sy, 5);
      ctx.fill();
    }
    ctx.globalAlpha = fillA;
    void H;
  }
  ctx.restore();
}

/* ---------- type for today / the wave ---------- */
function initTodayType() {
  BLOCKS.w1 = makeBlock({
    x: 540,
    y: 360,
    out: T.dont - 0.06,
    outFx: 'rise',
    outDur: 0.24,
    outStagger: 0.012,
    lead: 1.25,
    lines: [
      {
        size: 64,
        words: [
          { t: 'OWN', at: T.own },
          { t: 'ASSETS?', at: T.assetsW },
        ],
      },
      {
        size: 112,
        color: PAL.gold,
        words: [
          { t: 'RIDE', at: T.ride },
          { t: 'THE', at: Ws('wave', 'the') },
          { t: 'WAVE.', at: T.waveW },
        ],
      },
    ],
  });
  BLOCKS.w2 = makeBlock({
    x: 540,
    y: 360,
    out: T.waveEnd + 0.25,
    outFx: 'rise',
    lead: 1.25,
    lines: [
      { size: 64, words: [{ t: "DON'T?", at: T.dont + 0.02, fx: 'roll' }] },
      {
        size: 112,
        color: PAL.mint,
        words: [
          { t: 'CHASE', at: T.chase, fx: 'roll' },
          { t: 'IT.', at: Ws('wave', 'it'), fx: 'roll' },
        ],
      },
    ],
  });
  BLOCKS.same = makeBlock({
    x: 70,
    y: 318,
    align: 'left',
    lead: 1.0,
    out: T.today - 0.1,
    outFx: 'shrink',
    lines: [
      {
        size: 88,
        words: [
          { t: 'SAME', at: T.same },
          { t: 'MONEY.', at: T.money3 },
        ],
      },
      {
        size: 88,
        color: PAL.coral,
        words: [
          { t: 'LESS', at: T.less },
          { t: 'STUFF.', at: T.stuff },
        ],
      },
    ],
  });
  BLOCKS.today = makeBlock({
    x: 70,
    y: 300,
    align: 'left',
    out: T.stocks - 0.2,
    outFx: 'rise',
    lines: [{ size: 88, color: PAL.goldHi, words: [{ t: 'TODAY', at: T.today, fx: 'drop' }] }],
  });
}
