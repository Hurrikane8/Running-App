// Vertical (9:16) short cut. Same engine, art and continuous "vector merge"
// transitions as the long version, re-composed for a 1080x1920 phone frame.
// Key content stays inside the platform-safe area (roughly y 180..1560,
// x 60..960) so app UI overlays don't cover it.

function buildShort() {
  shortHook();
  shortCantillon();
  shortTown();
  shortModern();
  shortYou();
  shortEnd();
}

const V = {};
// staircase town geometry (feet positions of the five people)
const STX = i => 190 + i * 175, STY = i => 560 + i * 230, SSC = 0.75;
const NODE_V = [0, 1, 2, 3, 4].map(i => ({ x: 300, y: 380 + i * 270, r: 100 }));

function twoLine(a, b, y, t, ta, tb, o) {
  kinetic(a, CX, y, t, ta, o);
  kinetic(b, CX, y + (o.size || 80) * 1.12, t, tb, o);
}

// ================================================================= 1. HOOK
function shortHook() {
  const pops = { body: 0.2, gear: 0.34, chim: 0.44, dial: 0.52, emblem: 0.6, lamp: 0.68 };
  for (const k in pops) sfx(pops[k], 'pop', 0.55);
  const leverT = 1.25, runStart = Wd('h1', 'prints') - 0.1;
  const tMil = Wd('h2', 'million'), tMove = S('h3') - 0.25;
  const tWho = Wd('h3', 'who'), tFirst = Wd('h3', 'first');
  const tDoes = Wd('h4', 'does'), tMorph = Wd('h4', 'why') - 0.3;
  const tRent = Wd('h4', 'rent'), tSav = Wd('h4', 'savings');
  const tMerge = S('h5') - 0.35, tCalled = Wd('h5', 'cantillon'), tEffect = Wd('h5', 'effect');
  const tOut = Eend('h5') + 0.25;
  V.hookOut = tOut;
  V.coin = { x: 540, y: 690, r: 130 };
  sfx(leverT, 'clunk', 0.8);
  sfx(runStart, 'machine_start', 0.9, { until: tMorph + 0.2 });
  sfx(Wd('h1', 'money'), 'shine', 0.6);
  sfx(tMil, 'counter', 0.7, { dur: 1.1 });
  sfx(tMove, 'whoosh', 0.6);
  sfx(tFirst, 'ding', 0.7);
  sfx(tMorph, 'morph', 0.9);
  sfx(tRent, 'pop', 0.8); sfx(tSav, 'pop', 0.8);
  sfx(tMerge, 'morph', 0.8);
  sfx(tCalled, 'boom', 1.0);
  sfx(tMerge + 0.5, 'coin', 0.8);

  const prT = t => {
    const m = E.inOut(inv(tMove, tMove + 0.7, t));
    return { x: 540, y: lerp(1190, 990, m), s: lerp(1.35, 0.8, m) };
  };
  const people = CAST_ORDER.map((who, i) => ({ who, x: 140 + i * 200, y: 1420, s: 0.62, t0: tMove + 0.2 + i * 0.08 }));
  people.forEach(p => sfx(p.t0, 'pop', 0.35));
  const circles = [
    { x: 540, y: 640, r: 230, c: '#f8dcc0', label: 'RENT', arrow: 1 },
    { x: 540, y: 1200, r: 230, c: '#cfe7e1', label: 'SAVINGS', arrow: -1 },
  ];
  const silPrinter = rrectS(-215, -384, 430, 384, 40);
  const silPerson = pathS(PERSON_SIL);
  const feedStart = tMove + 0.7, feedRate = 5;

  scene(0, tOut + 1.6, t => {
    rect(0, 0, W, H, P.navy);
    const pr = prT(t);
    const glowA = inv(0, 0.8, t) * (1 - inv(tMorph, tMorph + 0.6, t));
    if (glowA > 0) alpha(glowA * (1 - inv(tMove, tMove + 0.6, t)), () => {
      const g = ctx.createLinearGradient(0, 0, 0, 1250);
      g.addColorStop(0, 'rgba(255,230,170,0.17)');
      g.addColorStop(1, 'rgba(255,230,170,0.02)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(440, -10); ctx.lineTo(640, -10); ctx.lineTo(980, 1200); ctx.lineTo(100, 1200); ctx.fill();
      ellipse(540, 1196, 400, 50, 'rgba(255,230,170,0.08)');
    });
    bgGlow(pr.x, pr.y - 220 * pr.s, 700 * pr.s + 200, P.gold, 0.16 * glowA);
    const run = inv(runStart, runStart + 0.5, t) * (1 - inv(tMorph - 0.3, tMorph, t));
    const spin = rampInt(t, runStart, 0.5) * 2.4;
    const lever = E.out(inv(leverT, leverT + 0.25, t));
    const fadePr = 1 - inv(tMorph, tMorph + 0.12, t);

    // free-flying bills
    const drawFree = front => {
      for (let i = 0; i < 90; i++) {
        const te = runStart + 0.15 + i * (i < 20 ? 0.14 : 0.1);
        if (te > tMove + 0.1) break;
        if (t < te || t - te > 4.5) continue;
        if ((i % 3 === 0) !== front) continue;
        const b = billPath(i, te, t, 540, 1190 - 97 * 1.35, 0.62);
        flyingBill(b.x, b.y, b.rot, b.flip, 110 * clamp((t - te) * 5), fadePr * (1 - inv(tMove + 0.2, tMove + 0.9, t)));
      }
    };
    drawFree(false);
    if (fadePr > 0) alpha(fadePr, () => at(pr.x, pr.y, pr.s, 0, () => printer(t, { pop: pops, run, spin, lever, runStart })));
    drawFree(true);

    // headline: "This machine prints money"
    if (t < tMil + 0.2) kinetic('This machine prints *money*', CX, 300, t, [Wd('h1', 'imagine'), Wd('h1', 'machine'), Wd('h1', 'prints'), Wd('h1', 'money')], { size: 76, fam: 'serif', weight: 900, out: tMil - 0.35 });
    // counter
    const cA = fade(t, tMil - 0.2, tMove, 0.3, 0.3);
    if (cA > 0) {
      const v = Math.round(E.out(inv(tMil, tMil + 1.1, t)) * 1000000);
      at(CX, 320, pop(t, tMil - 0.2, 0.5), 0, () => text('$' + v.toLocaleString('en-US'), 0, 0, { size: 130, weight: 900, fam: 'serif', color: P.gold, a: cA }));
      text('new dollars', CX, 430, { size: 60, fam: 'hand', weight: 700, color: P.cream, a: cA * inv(Wd('h2', 'dollars') - 0.1, Wd('h2', 'dollars') + 0.2, t) });
    }

    // the line of people
    const stackN = () => Math.min(9, Math.floor(Math.max(0, (t - feedStart - 0.9) * feedRate)));
    const peopleA = 1 - inv(tMorph, tMorph + 0.12, t);
    if (t > tMove && peopleA > 0) {
      const dimP = inv(tDoes - 0.2, tDoes + 0.8, t);
      people.forEach((p, i) => {
        const s = life(t, p.t0) * p.s;
        if (s <= 0) return;
        const isFirst = i === 0;
        if (isFirst) alpha(dimP, () => bgGlow(p.x, p.y - 150, 240, P.gold, 0.5));
        const arm = isFirst ? 0.12 + 0.5 * E.out(inv(feedStart, feedStart + 0.4, t)) : 0.12;
        alpha(peopleA, () => at(p.x, p.y, s, 0, () => person({
          who: p.who, seed: i + 3, look: [-5, 0], armL: arm, armR: arm,
          expr: isFirst ? (dimP > 0.3 ? 'happy' : 'smile') : dimP > 0.5 && i >= 3 ? 'worried' : 'smile',
          dim: isFirst ? 0 : dimP * (0.25 + i * 0.15),
          holdFront: isFirst && stackN() > 0 ? () => at(0, -112, 1, 0, () => billStack(stackN(), 104)) : null,
        }, t)));
      });
      for (let i = 0; i < 40; i++) {
        const te = feedStart + i / feedRate;
        if (te > tMorph - 0.3) break;
        const a = (t - te) / 0.8;
        if (a < 0 || a > 1) continue;
        const p0 = prT(te);
        const u = E.sine(a);
        const bx = lerp(p0.x, people[0].x, u), by = lerp(p0.y - 100 * p0.s, people[0].y - (120 + stackN() * 9) * people[0].s, u) - Math.sin(u * Math.PI) * 220;
        flyingBill(bx, by, a * 5 + i, a * 9, 80, peopleA);
      }
      alpha(inv(tDoes, tDoes + 0.3, t) * peopleA, () => {
        text('first', people[0].x, 1500, { size: 52, fam: 'hand', weight: 700, color: P.gold });
        text('last', people[4].x, 1500, { size: 52, fam: 'hand', weight: 700, color: P.grey });
      });
    }
    if (t > tWho - 0.1 && t < tMorph + 0.6) {
      kinetic('Who gets it', CX, 280, t, [tWho, Wd('h3', 'got'), Wd('h3', 'them')], { size: 104, fam: 'serif', weight: 900, out: tMorph - 0.05 });
      kinetic('*first?*', CX, 400, t, [tFirst], { size: 124, fam: 'serif', weight: 900, out: tMorph + 0.05 });
    }

    // morph: printer + people -> two circles
    const mp = inv(tMorph, tMorph + 0.9, t);
    const mergeP = E.inOut(inv(tMerge, tMerge + 0.6, t));
    const circA = 1 - inv(tMerge + 0.5, tMerge + 0.6, t);
    if (mp > 0 && mp < 1) {
      const pr0 = prT(tMorph);
      const sils = [
        { S: xf(silPrinter, pr0.x, pr0.y, pr0.s), c: '#eadcbc', to: 0, key: 'pr' },
        ...people.map((p, i) => ({ S: xf(silPerson, p.x, p.y, p.s), c: CAST[p.who].top, to: 1, key: 'pp' + i })),
      ];
      for (const s of sils) {
        const C = circles[s.to];
        const target = align(s.S, circleS(C.x, C.y, C.r), 'vhook' + s.key);
        fillS(morph(s.S, target, E.inOut(inv(0.05, 0.9, mp))), mix(s.c, C.c, inv(0.2, 0.8, mp)));
      }
    }
    if (mp >= 1 && circA > 0) {
      circles.forEach((C, i) => {
        const cx = lerp(C.x, V.coin.x, mergeP), cy = lerp(C.y, V.coin.y, mergeP);
        const r = lerp(C.r, V.coin.r, mergeP);
        circle(cx, cy, r, mix(C.c, P.gold, mergeP));
        const ia = 1 - inv(tMerge - 0.1, tMerge + 0.15, t);
        const tI = i === 0 ? tRent : tSav;
        const ip = pop(t, tI, 0.55);
        if (ip > 0 && ia > 0) alpha(ia, () => {
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 10, 0, TAU); ctx.clip();
          at(cx, cy, ip * 1.25, 0, () => hookIcon(i, t, tI));
          ctx.restore();
          const la = inv(tI + 0.2, tI + 0.5, t);
          const ly = C.y + (i === 0 ? -C.r - 60 : C.r + 70);
          text(C.label, cx - 22, ly, { size: 48, weight: 800, ls: 6, color: P.cream, a: la });
          const aw = measure(C.label, { size: 48, weight: 800, ls: 6 });
          at(cx - 22 + aw / 2 + 40, ly - 2, la * 0.75, C.arrow > 0 ? 0 : Math.PI, () => upArrow(34, C.arrow > 0 ? P.coral : P.sky));
        });
      });
    }
    if (t > tMerge) bgGlow(V.coin.x, 900, 800, P.gold, 0.14 * inv(tMerge, tMerge + 0.8, t) * (1 - inv(tOut, tOut + 0.8, t)));
    if (t > tMerge + 0.5 && t < tOut) at(V.coin.x, V.coin.y, 1, 0, () => coin(V.coin.r));
    if (t > tCalled - 0.6) {
      kinetic('THE', CX, 900, t, [Wd('h5', 'the')], { size: 40, weight: 800, ls: 16, color: P.gold, out: tOut - 0.1 });
      kinetic('CANTILLON', CX, 1020, t, [tCalled], { size: 150, weight: 900, fam: 'serif', out: tOut - 0.05 });
      kinetic('EFFECT', CX, 1175, t, [tEffect], { size: 150, weight: 900, fam: 'serif', out: tOut });
      const ul = inv(tEffect + 0.25, tEffect + 0.6, t);
      if (ul > 0) alpha(1 - inv(tOut, tOut + 0.3, t), () => scribble(290, 1262, 790, 1262, ul, 12, P.gold, 4, 2));
    }
  });
}

// ================================================================= 2. CANTILLON
function shortCantillon() {
  const t0 = V.hookOut;
  const frame = { x: 540, y: 760, rx: 250, ry: 320 };
  const tFlip = t0 + 0.05, flipD = 1.1, tBg = t0 + 0.2;
  const tParis = Wd('c1', 'paris'), tName = Wd('c1', 'richard'), tNoticed = Wd('c1', 'noticed');
  const tNew = S('c2'), tEven = Wd('c2', 'spread'), tEvenly = Wd('c2', 'evenly');
  const tEnters = Wd('c2', 'enters'), tPoint = Wd('c2', 'point'), tRipple = Wd('c2', 'ripples');
  const tDive = tNew - 0.35;
  const tOut = Eend('c2') + 0.1;
  V.cantOut = tOut;
  V.lens = { x: 540, y: 900, r: 440 };
  sfx(t0, 'whoosh', 0.8); sfx(tBg, 'morph', 0.7);
  sfx(tParis, 'pop', 0.5); sfx(tName, 'pop', 0.6); sfx(tNoticed, 'whoosh', 0.7);
  sfx(tDive, 'morph', 0.8); sfx(tEvenly + 0.1, 'scribble', 0.6); sfx(tPoint, 'ding', 0.8); sfx(tRipple, 'rise', 0.5);

  const flipPos = t => {
    const p = inv(tFlip, tFlip + flipD, t), e = E.inOut(p), ang = e * Math.PI * 3;
    return { x: lerp(V.coin.x, frame.x, e), y: lerp(V.coin.y, frame.y, e), sx: Math.max(0.02, Math.abs(Math.cos(ang))), face: p < 0.5 ? 'coin' : 'portrait', r: lerp(V.coin.r, (frame.rx + frame.ry) / 2, e), rx: lerp(V.coin.r, frame.rx, e), ry: lerp(V.coin.r, frame.ry, e) };
  };

  scene(t0, tOut, t => {
    const bgP = E.inOut(inv(tBg, tBg + 1.0, t));
    const fp = flipPos(t);
    if (bgP < 1) circle(fp.x, fp.y, bgP * 2400, P.paper); else rect(0, 0, W, H, P.paper);
    alpha(inv(t0 + 0.8, t0 + 1.8, t), () => bgGlow(700, 500, 800, '#f7c98b', 0.5));
    const diveP = E.inOut(inv(tDive, tDive + 1.0, t));
    const groupA = 1 - inv(tDive + 0.1, tDive + 0.6, t);
    if (groupA > 0) alpha(groupA, () => {
      at(-420, 840, 1, 0, () => paris(E.out(inv(t0 + 0.9, t0 + 2.2, t)), t));
      const la = inv(tParis, tParis + 0.4, t);
      if (la > 0) {
        text('PARIS', CX, 250, { size: 96, fam: 'hand', weight: 700, color: P.plum, a: la });
        text('1720', CX, 330, { size: 52, weight: 800, ls: 10, color: P.coral2, a: inv(tParis + 0.2, tParis + 0.6, t) });
      }
      at(fp.x, fp.y, 1, 0, () => { ctx.scale(fp.sx, 1); if (fp.face === 'coin') coin(fp.r); else portrait(fp.rx, fp.ry, t, false); });
      const np = pop(t, tName, 0.5);
      if (np > 0) at(frame.x, frame.y + frame.ry + 80, np * 1.15, 0, () => {
        rrect(-210, -46, 420, 92, 14, P.navy);
        text('RICHARD CANTILLON', 0, -11, { size: 31, weight: 800, ls: 4, color: P.cream });
        text('banker · c. 1680 – 1734', 0, 24, { size: 23, weight: 600, color: P.gold });
      });
    });
    // magnifying lens: pops on "noticed", then grows into the economy diagram
    const lensIn = pop(t, tNoticed - 0.1, 0.6);
    if (lensIn > 0) {
      const L = V.lens;
      const lx = lerp(830, L.x, diveP), ly = lerp(470, L.y, diveP), lr = lerp(95, L.r, diveP);
      const wig = (1 - diveP) * Math.sin(t * 2.2) * 16;
      const sunP = V.sunP ? V.sunP(t) : 0;
      if (sunP <= 0) at(lx + wig, ly, lensIn, 0, () => {
        circle(0, 0, lr, mix('#fff7e6', P.cream, diveP));
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, lr, 0, TAU); ctx.clip();
        dotEconomy(t, lr, diveP, tPoint, tRipple, tEven, tEnters);
        ctx.restore();
        ring(0, 0, lr, lerp(16, 12, diveP), P.ink);
        alpha(1 - diveP, () => at(0, 0, lr / 95, 0, () => line(66, 66, 150, 150, 26, P.brown2)));
      });
    }
    if (t > tNew - 0.1) {
      const ko = { size: 76, fam: 'serif', weight: 800, color: P.ink, accent: P.coral2 };
      kinetic("New money doesn't", CX, 200, t, [Wd('c2', 'new'), Wd('c2', 'money'), Wd('c2', "doesn't")], { ...ko, out: tEnters - 0.35 });
      kinetic('spread *evenly*', CX, 290, t, [tEven, tEvenly], { ...ko, out: tEnters - 0.3 });
      kinetic('It enters at', CX, 200, t, [tEnters - 0.1, tEnters, Wd('c2', 'at')], { ...ko, out: tOut - 0.45 });
      kinetic('*one point*', CX, 290, t, [Wd('c2', 'one'), tPoint], { ...ko, out: tOut - 0.4 });
      const ra = inv(tRipple, tRipple + 0.4, t) * (1 - inv(tOut - 0.4, tOut - 0.1, t));
      text('…and ripples outward', CX, 1440, { size: 72, fam: 'hand', weight: 700, color: P.plum, a: ra });
      const xa = inv(tEvenly + 0.1, tEvenly + 0.45, t) * (1 - inv(tEnters - 0.4, tEnters - 0.1, t));
      if (xa > 0) alpha(1 - inv(tEnters - 0.4, tEnters - 0.1, t), () => {
        scribble(270, 630, 810, 1170, inv(tEvenly + 0.1, tEvenly + 0.35, t), 24, P.coral2, 5, 1);
        scribble(810, 630, 270, 1170, inv(tEvenly + 0.3, tEvenly + 0.55, t), 24, P.coral2, 5, 2);
      });
    }
  });
}

// ================================================================= 3. TOWN (a staircase village)
function stairOutline() {
  const pts = [[-20, STY(0)]];
  for (let i = 0; i < 5; i++) {
    const xr = i < 4 ? STX(i) + 88 : W + 20;
    pts.push([xr, STY(i)]);
    if (i < 4) pts.push([xr, STY(i + 1)]);
  }
  pts.push([W + 20, H + 20], [-20, H + 20]);
  return pts;
}
function pipeV() {
  const L = [], R = [];
  for (let k = 0; k <= 40; k++) {
    const u = k / 40, y = lerp(250, 1580, u), th = lerp(46, 7, Math.pow(u, 0.8));
    L.push([300 - th, y]); R.push([300 + th, y]);
  }
  return polyS(R.concat(L.reverse()));
}
function stairBlocks(t, rise) {
  const walls = ['#f3e2c2', '#efd6b6', '#f5e6c9', '#ead3b0', '#f2dfc0'];
  const roofs = ['#c96f5a', P.plum2, P.teal, '#c96f5a', P.plum2];
  for (let i = 4; i >= 0; i--) {
    const x0 = i === 0 ? -20 : STX(i) - 87, x1 = i < 4 ? STX(i) + 88 : W + 20;
    const y0 = STY(i) + (1 - rise(i)) * 1400;
    at(0, 0, 1, 0, () => {
      rect(x0, y0, x1 - x0, H - y0 + 40, walls[i]);
      rect(x0, y0, x1 - x0, 18, roofs[i]);
      rect(x0, y0 + 18, x1 - x0, 6, 'rgba(0,0,0,0.08)');
      // windows & doors on the facade
      for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) {
        const wx = x0 + 24 + c * 80, wy = y0 + 110 + r * 150;
        if (wx + 44 > x1 || wy > H) continue;
        if (r === 0 && c === 1) continue;
        rrect(wx, wy, 44, 56, 6, (r + c + i) % 3 === 0 ? '#f6cf7a' : '#bfe0e6');
      }
      rect(x0, y0 + 24, 4, H, 'rgba(0,0,0,0.06)');
    });
  }
}
function shortTown() {
  const t0 = V.cantOut;
  const tSign = Wd('t1', 'bread') - 0.2;
  const tMoney = Wd('t2', 'money'), tBanker = Wd('t2', 'banker'), tSpend = Wd('t2', 'spends'), tYest = Wd('t2', "yesterday's");
  const tBuilder = Wd('t3', 'reaches'), tCreep = Wd('t3', 'creep'), tShop = Wd('t3', 'then'), tFifty = Wd('t3', 'dollar') - 0.1;
  const tTeach = Wd('t4', 'teacher'), tInc = Wd('t4', 'incomes'), tTwo = Wd('t4', 'two') - 0.05;
  const tStole = S('t5'), tWealth = Wd('t5', 'wealth'), tBack = Wd('t5', 'back'), tFront = Wd('t5', 'front');
  const tOut = Eend('t5') + 0.1;
  V.townOut = tOut;
  const prices = [[-1, '$1.00'], [tCreep, '$1.20'], [tFifty, '$1.50'], [tTwo, '$2.00']];
  sfx(t0 + 0.1, 'morph', 0.7);
  sfx(t0 + 0.5, 'whoosh', 0.5);
  sfx(tSign, 'drop', 0.8);
  sfx(tMoney, 'sparkle', 0.8); sfx(tBanker + 0.3, 'coins', 0.8);
  sfx(tSpend, 'whoosh', 0.5); sfx(tYest, 'ding', 0.5);
  sfx(tBuilder - 0.2, 'whoosh', 0.5); sfx(tShop - 0.2, 'whoosh', 0.5);
  prices.slice(1).forEach(([pt], k) => sfx(pt, 'flip', 0.8 + k * 0.1));
  sfx(tTwo + 0.05, 'thud', 0.8);
  sfx(tTeach, 'spot', 0.5);
  sfx(tStole + 0.1, 'pop', 0.6);
  sfx(tWealth, 'rise', 0.7); sfx(tBack + 0.2, 'coins', 0.6);
  sfx(tOut, 'morph', 0.9);
  const priceAt = t => { let cur = prices[0], prev = null; for (const p of prices) if (t >= p[0]) { prev = cur; cur = p; } return { cur, prev }; };
  const sunX = 150, sunY = 170, sunR = 72;
  V.sunP = t => E.inOut(inv(t0, t0 + 1.2, t));
  const rise = t => i => E.back(inv(t0 + 0.35 + i * 0.1, t0 + 1.0 + i * 0.1, t), 1.2);
  const stairS = polyS(stairOutline());
  const pipeS = pipeV();

  scene(t0, tOut + 1.5, t => {
    const sp = V.sunP(t);
    const outP = E.inOut(inv(tOut, tOut + 1.3, t));
    // background: parchment -> sky -> (later) slate
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, mixHex(mixHex(P.paper, '#f7dcb4', sp), P.slate, outP));
    sky.addColorStop(1, mixHex(mixHex(P.paper, '#fbeedb', sp), P.slate, outP));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // the lens from the previous scene becomes the sun
    const L = V.lens;
    const lx = lerp(L.x, sunX, sp), ly = lerp(L.y, sunY, sp), lr = lerp(L.r, sunR, sp);
    alpha(1 - outP, () => {
      if (sp < 1) {
        circle(lx, ly, lr + lerp(6, 0, sp), mix(P.ink, '#fbd58a', sp));
        circle(lx, ly, lr - lerp(6, 0, sp), mix(P.cream, '#fbd58a', sp));
        alpha(1 - sp * 2, () => { ctx.save(); ctx.beginPath(); ctx.arc(lx, ly, Math.max(1, lr - 6), 0, TAU); ctx.clip(); at(lx, ly, lr / L.r, 0, () => dotEconomy(t, L.r, 1, -99, S('c2') + 3.5)); ctx.restore(); });
      } else circle(sunX, sunY, sunR, '#fbd58a');
      // distant hills
      at(0, (1 - sp) * 400, 1, 0, () => {
        ctx.fillStyle = '#d6e3b6'; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 1180 - Math.sin(x / 260 + 1) * 60 - x * 0.35);
        ctx.lineTo(W, H); ctx.fill();
      });
    });
    // staircase village, later morphing into the vertical money pipe
    if (outP <= 0) stairBlocks(t, rise(t));
    else {
      const A = align(pipeS, stairS, 'stairpipe');
      fillS(morph(A, pipeS, outP), mix('#efd6b6', PIPE_EMPTY, outP));
    }
    // price sign (top right)
    const signIn = pop(t, tSign, 0.6, 1.6);
    const signOut = E.inBack(inv(tWealth - 0.5, tWealth, t));
    if (signIn > 0 && signOut < 1) {
      const pc = priceAt(t);
      const flipP = inv(pc.cur[0], pc.cur[0] + 0.35, t);
      const shake = pc.cur[0] > 0 ? Math.sin((t - pc.cur[0]) * 30) * 0.05 * (1 - inv(pc.cur[0], pc.cur[0] + 0.7, t)) : 0;
      at(770, lerp(-200, 300, clamp(signIn)) - signOut * 520, 0.82, shake, () => priceSign(pc, flipP, t, tYest));
    }
    // cast on the steps
    CAST_ORDER.forEach((who, i) => {
      const x = STX(i), y = STY(i) + (1 - rise(t)(i)) * 1400;
      const pin = pop(t, t0 + 0.9 + i * 0.12, 0.5);
      const morphP = inv(tOut + i * 0.05, tOut + 1.2 + i * 0.05, t);
      const spot = inv(tTeach - 0.3, tTeach + 0.2, t) * (1 - inv(tStole - 0.2, tStole + 0.2, t));
      const dim = i < 3 ? spot * 0.9 : 0;
      let expr = 'smile', armL = 0.12, armR = 0.12, holdFront = null, hold = null, look = [0, 0];
      if (i === 0) {
        if (t > tBanker - 0.3) { armL = armR = 0.12 + 0.5 * E.out(inv(tBanker - 0.3, tBanker, t)) * (1 - inv(tSpend + 1.2, tSpend + 1.6, t)); expr = 'happy'; }
        const n = Math.round(lerp(9, 2, inv(tSpend, tSpend + 1.4, t)));
        if (t > tBanker && t < tSpend + 1.6) holdFront = () => at(0, -112, 1, 0, () => billStack(n, 104));
        if (t > tWealth) expr = 'smug';
      }
      if (i === 1 && t > Wd('t3', 'builder')) expr = 'happy';
      if (i === 2 && t > Wd('t3', 'shopkeeper')) expr = 'happy';
      if (i >= 3 && t > tTwo) expr = 'worried';
      if (i >= 3 && t > tTeach && t < tTwo) look = [-4, -4];
      const detailA = 1 - inv(0, 0.22, morphP);
      if (detailA > 0 && pin > 0) alpha(detailA, () => at(x, y, SSC * pin, 0, () => person({ who, seed: i + 11, expr, look, armL, armR, hold, holdFront, dim }, t)));
      if (morphP > 0) {
        const sil = xf(pathS(PERSON_SIL), x, y, SSC);
        const n = NODE_V[i];
        const tgt = align(sil, circleS(n.x, n.y, n.r), 'vtown2node' + i);
        fillS(morph(sil, tgt, E.inOut(inv(0.08, 1, morphP))), mix(CAST[who].top, NODE_FILL, inv(0.3, 1, morphP)), clamp(morphP * 6));
      }
      const la = inv(t0 + 1.3 + i * 0.1, t0 + 1.7 + i * 0.1, t) * (1 - inv(tOut - 0.3, tOut, t));
      if (la > 0 && outP <= 0) text(CAST_LABEL[who], x, y + 64, { size: 24, weight: 800, ls: 3, color: P.ink, a: la * (1 - spot * (i < 3 ? 0.6 : 0)) });
    });
    // new money appears above the banker
    const bx = STX(0);
    const cloud = life(t, tMoney - 0.2, tBanker - 0.05, 0.4, 0.3);
    if (cloud > 0) {
      for (let k = 0; k < 7; k++) sparkle(bx + Math.cos(k + t * 2) * 80, 230 + Math.sin(k * 2 + t * 3) * 40, 20 * cloud, P.gold3, t + k);
      const dropP = E.in(inv(tBanker - 0.45, tBanker, t));
      at(bx, lerp(230, STY(0) - 112 * SSC, dropP), cloud * SSC, 0, () => billStack(9, 104));
    }
    const fl = inv(tBanker + 0.1, tBanker + 0.4, t) * (1 - inv(tSpend + 1.5, tSpend + 1.8, t));
    if (fl > 0) at(bx + 140, 300, 1, -0.06, () => text('first!', 0, 0, { size: 64, fam: 'hand', weight: 700, color: P.coral2, a: fl }));
    // money cascading down the steps (and to the shop's price sign)
    const flows = [
      { from: 0, to: 'sign', a: tSpend - 0.1, b: tSpend + 1.2, n: 5 },
      { from: 0, to: 1, a: tBuilder - 0.3, b: tBuilder + 1.1, n: 5 },
      { from: 1, to: 2, a: tShop - 0.3, b: tShop + 1.1, n: 5 },
      { from: 2, to: 3, a: tTeach - 0.6, b: tTeach + 0.9, n: 2 },
      { from: 3, to: 4, a: tTeach, b: tTeach + 1.2, n: 1 },
    ];
    flows.forEach(f => {
      for (let j = 0; j < f.n; j++) {
        const te = f.a + (j / Math.max(1, f.n)) * (f.b - f.a - 0.8);
        const a = (t - te) / 0.8;
        if (a < 0 || a > 1) continue;
        const x0 = STX(f.from), y0 = STY(f.from) - 200;
        const [x1, y1] = f.to === 'sign' ? [700, 330] : [STX(f.to), STY(f.to) - 180];
        const u = E.sine(a);
        flyingBill(lerp(x0, x1, u), lerp(y0, y1, u) - Math.sin(u * Math.PI) * 140, a * 4 + j, a * 8 + j, 68, 1);
      }
    });
    // same income, half the bread
    [[3, 440, 1285], [4, 640, 1525]].forEach(([i, cx, cy]) => {
      const ca = life(t, tInc - 0.2, tStole - 0.3, 0.5, 0.3);
      if (ca <= 0) return;
      const lost = inv(tTwo + 0.1, tTwo + 0.5, t);
      at(cx, cy - 120, ca, 0, () => {
        rrect(-115, -66, 230, 132, 18, P.white);
        text('$4', -62, 0, { size: 54, weight: 900, fam: 'serif', color: P.ink });
        text('buys', 14, -45, { size: 17, weight: 700, color: P.grey2, ls: 2 });
        for (let q = 0; q < 4; q++) {
          const gone = q >= 2 ? lost : 0;
          const qx = 12 + (q % 2) * 62, qy = -10 + Math.floor(q / 2) * 40;
          at(qx, qy, 0.38, 0, () => alpha(1 - gone * 0.75, () => bread(1)));
          if (gone > 0) at(qx, qy, E.back(gone), 0, () => crossMark(30, P.coral2, 7));
        }
        poly([[115, -14], [115, 14], [138, 0]], P.white);
      });
    });
    const half = inv(tTwo + 0.5, tTwo + 0.8, t) * (1 - inv(tStole - 0.3, tStole, t));
    if (half > 0) at(CX, 1640, 1, -0.03, () => text('same income, half the bread', 0, 0, { size: 60, fam: 'hand', weight: 700, color: P.coral2, a: half }));
    // nobody stole anything
    const n1 = life(t, tStole + 0.05, Wd('t5', 'but') - 0.1, 0.5, 0.3);
    if (n1 > 0) at(190, 1120, n1 * 0.9, -0.05, () => noSign(() => moneySack(), 'no theft'));
    // wealth moves from the back of the line to the front
    const wb = inv(tWealth - 0.2, tWealth + 0.3, t) * (1 - inv(tOut, tOut + 0.4, t));
    if (wb > 0) {
      const arr = bezierPts([STX(4) - 60, 1560], [420, 1760], [10, 1300], [110, 660], 80);
      const ap = inv(tWealth, tFront + 0.3, t);
      alpha(wb, () => {
        strokePartial(arr, ap, 16, P.coral2, [2, 26]);
        if (ap > 0.97) arrowHead(110, 660, -1.35, 30, P.coral2);
      });
      for (let j = 0; j < 7; j++) {
        const u = ((t - tWealth) * 0.45 + j / 7) % 1;
        if (t > tWealth && u < ap) { const q = pointAlong(arr, u); at(q[0], q[1], 0.5 * wb, 0, () => coin(40)); }
      }
      at(250, 1350, 1, -1.2, () => text('wealth quietly moves', 0, 0, { size: 50, fam: 'hand', weight: 700, color: P.coral2, a: inv(tWealth + 0.2, tWealth + 0.6, t) * wb }));
      text('back of the line', 700, 1660, { size: 52, fam: 'hand', weight: 700, color: P.ink, a: inv(tBack, tBack + 0.3, t) * wb });
      text('front of the line', 330, 240, { size: 52, fam: 'hand', weight: 700, color: P.ink, a: inv(tFront - 0.1, tFront + 0.2, t) * wb });
    }
  });
}

// ================================================================= 4. MODERN (vertical pipeline)
function shortModern() {
  const t0 = V.townOut + 1.5;
  const tToday = Wd('m1', 'today'), tFlows = Wd('m1', 'flows'), tBanks = Wd('m1', 'banks');
  const tBuy = Wd('m2', 'buy'), tStocks = Wd('m2', 'stocks'), tEstate = Wd('m2', 'estate'), tBefore = Wd('m2', 'before'), tMove = Wd('m2', 'move');
  const tWages = Wd('m3', 'wages'), tLast = Wd('m3', 'last');
  const tOut = Eend('m3') + 0.1;
  V.modOut = tOut;
  const iconT = [0, 1, 2, 3, 4].map(i => t0 + 0.05 + i * 0.1);
  iconT.forEach(x => sfx(x, 'pop', 0.4));
  sfx(tFlows, 'flow', 0.8, { dur: 1.3 }); sfx(tBuy, 'flow', 0.7, { dur: 0.9 });
  sfx(tStocks, 'pop', 0.5); sfx(tEstate, 'pop', 0.5); sfx(tMove, 'rise', 0.6);
  sfx(tWages - 0.2, 'drip', 0.7); sfx(tLast, 'thud', 0.9); sfx(tOut, 'morph', 0.8);
  const pipe = pipeV();
  const frontY = t => {
    const keys = [[tFlows - 0.4, 250], [tFlows + 0.2, 400], [tBanks - 0.3, 400], [tBanks + 0.5, 670], [tBuy - 0.1, 670], [tBuy + 0.8, 940], [tWages - 0.6, 940], [tWages + 0.2, 1210], [tWages + 0.5, 1210], [tLast - 0.2, 1580]];
    if (t <= keys[0][0]) return 0;
    for (let k = 1; k < keys.length; k++) if (t < keys[k][0]) return lerp(keys[k - 1][1], keys[k][1], E.inOut(inv(keys[k - 1][0], keys[k][0], t)));
    return 1580;
  };
  const LABELS = [
    ['CENTRAL BANK', 'creates new money'], ['BANKS & GOV’T', '+ big investors'], ['ASSETS', 'stocks · real estate'],
    ['BUSINESSES', 'goods · services'], ['WAGES', 'workers · savers'],
  ];

  scene(t0, tOut + 1.3, t => {
    rect(0, 0, W, H, P.slate);
    alpha(0.06, () => { for (let x = 0; x < W; x += 80) rect(x, 0, 2, H, P.cream); for (let y = 0; y < H; y += 80) rect(0, y, W, 2, P.cream); });
    const fy = frontY(t);
    fillS(pipe, PIPE_EMPTY);
    if (fy > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, fy); ctx.clip();
      fillS(pipe, P.gold);
      ctx.save(); tracePath(pipe); ctx.clip();
      for (let k = -2; k < 40; k++) { const y = ((t * 160) % 60) + k * 60; alpha(0.35, () => poly([[240, y], [360, y - 30], [360, y - 12], [240, y + 18]], P.gold3)); }
      ctx.restore();
      ctx.restore();
      for (let j = 0; j < 26; j++) {
        const y = 260 + ((t * 240 + j * 97) % 1320);
        if (y > fy) continue;
        const keep = y < 670 ? 1 : y < 940 ? 0.75 : y < 1210 ? 0.4 : 0.15;
        if (rnd(j, 12) > keep) continue;
        flyingBill(300 + Math.sin(t * 3 + j) * 10, y, Math.PI / 2 + Math.sin(j) * 0.4, t * 3 + j, 54, 0.95);
      }
    }
    // header
    kinetic('TODAY', CX, 170, t, [tToday], { size: 48, weight: 800, ls: 16, color: P.gold, out: tOut - 0.2 });
    NODE_V.forEach((n, i) => {
      const reached = fy >= n.y - 20;
      if (reached) bgGlow(n.x, n.y, 190, P.gold, 0.4);
      at(n.x, n.y, 1, 0, () => {
        circle(0, 0, n.r, NODE_FILL);
        ring(0, 0, n.r - 4, 8, reached ? P.gold : P.navy3);
        const ip = pop(t, iconT[i], 0.5);
        const pulse = (i === 2 && (Math.abs(t - tStocks - 0.2) < 0.25 || Math.abs(t - tEstate - 0.2) < 0.25)) ? 1.1 : 1;
        if (ip > 0) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, n.r - 10, 0, TAU); ctx.clip(); at(0, 0, ip * 0.95 * pulse, 0, () => nodeIcon(i, t, inv(tLast, tLast + 0.3, t))); ctx.restore(); }
      });
      const la = inv(iconT[i] + 0.2, iconT[i] + 0.6, t);
      text(LABELS[i][0], 440, n.y - 16, { size: 36, weight: 800, ls: 3, color: P.cream, a: la, align: 'left' });
      text(LABELS[i][1], 440, n.y + 28, { size: 28, weight: 600, color: rgba(P.cream, 0.62), a: la, align: 'left' });
    });
    const fa = inv(tFlows, tFlows + 0.4, t) * (1 - inv(tOut, tOut + 0.3, t));
    text('FIRST', 300, 262, { size: 30, weight: 900, ls: 6, color: P.gold, a: fa * 0 });
    const up = life(t, tMove - 0.2, tOut, 0.5, 0.3);
    if (up > 0) at(820, 830, up, 0, () => { rrect(-140, -40, 280, 80, 40, P.coral); text('prices', -26, 3, { size: 46, fam: 'hand', weight: 700, color: P.white }); at(80, 2, 0.8, 0, () => upArrow(30, P.white)); });
    const wait = life(t, tBefore - 0.1, tWages - 0.1, 0.5, 0.3);
    if (wait > 0) at(640, 1580, wait, 0.03, () => text('…still waiting', 0, 0, { size: 58, fam: 'hand', weight: 700, color: P.sky }));
    const last = pop(t, tLast - 0.05, 0.3, 3);
    if (last > 0) at(800, 1400, lerp(1.8, 1, clamp(last)), -0.12, () => {
      ctx.strokeStyle = P.coral; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.roundRect(-110, -48, 220, 96, 12); ctx.stroke();
      text('LAST', 0, 4, { size: 60, weight: 900, ls: 6, color: P.coral });
    });
  });
}

// ================================================================= 5. YOU
function shortYou() {
  const t0 = V.modOut;
  const n5 = NODE_V[4];
  const YX = 540, YF = 1420, YS = 1.45;
  const tYou = Wd('y1', 'you'), tPay = Wd('y1', 'paycheck'), tRaise = Wd('y1', 'raise'), tPrices = Wd('y1', 'prices');
  const tSave = Wd('y2', 'save'), tCash = Wd('y2', 'cash'), tLike = Wd('y2', 'like'), tDown = Wd('y2', 'down');
  const tMean = S('y3'), tOwn = Wd('y3', 'own'), tRich = Wd('y3', 'richer'), tWithout = Wd('y3', 'without'), tNothing = Wd('y3', 'anything');
  const tOut = Eend('y3') + 0.1;
  V.youOut = tOut;
  sfx(t0 + 0.2, 'morph', 0.8);
  sfx(tPay, 'pop', 0.6); sfx(tRaise, 'pop', 0.5); sfx(tPrices, 'pop', 0.6);
  sfx(tCash, 'coin', 0.8); sfx(tCash + 0.4, 'drip', 0.5); sfx(tLike - 0.1, 'morph', 0.8);
  sfx(tLike + 0.5, 'escalator', 0.6, { dur: tMean - tLike - 0.4 });
  sfx(tMean, 'morph', 0.6); sfx(tOwn, 'pop', 0.6); sfx(tRich - 0.3, 'coins', 0.7); sfx(tWithout, 'thud', 0.8);
  sfx(tOut, 'swoosh_long', 0.9);
  const EA = [40, 1720], EB = [1040, 780];
  const eu = [EB[0] - EA[0], EB[1] - EA[1]], eL = Math.hypot(eu[0], eu[1]);
  const un = [eu[0] / eL, eu[1] / eL];
  const onEscY = x => EA[1] + (x - EA[0]) * (eu[1] / eu[0]);
  const escPanel = polyS([[EA[0] - 150, EA[1]], EA, EB, [EB[0] + 150, EB[1]], [EB[0] + 150, EB[1] + 120], [EB[0] + 40, EB[1] + 120], [EA[0] + 40, EA[1] + 120], [EA[0] - 150, EA[1] + 120]]);
  const jarS = rrectS(270 - 115, 1420 - 290, 230, 290, 30);
  const groundS = rrectS(-40, 1560, W + 80, 400, 4);
  const pos = t => {
    let x = YX, y = YF, s = YS;
    const m1 = E.inOut(inv(tSave - 0.3, tSave + 0.3, t));
    x = lerp(x, 760, m1); s = lerp(s, 1.25, m1);
    const m2 = E.inOut(inv(tLike, tLike + 0.8, t)) * (1 - E.inOut(inv(tMean - 0.2, tMean + 0.5, t)));
    x = lerp(x, 540, m2); y = lerp(y, onEscY(540), m2); s = lerp(s, 1.1, m2);
    const m3 = E.inOut(inv(tMean - 0.2, tMean + 0.5, t));
    x = lerp(x, 250, m3); y = lerp(y, 1560, m3); s = lerp(s, 1.0, m3);
    return { x, y, s };
  };

  scene(t0, tOut + 1.2, t => {
    const p = inv(t0, t0 + 1.25, t);
    const bgR = E.inOut(inv(0.05, 0.85, p)) * 2600;
    if (p < 1) circle(n5.x, n5.y, bgR, P.cream); else rect(0, 0, W, H, P.cream);
    alpha(inv(0.5, 1, p), () => bgGlow(540, 1000, 800, '#f2cfa6', 0.55));
    // timeline: prices move first, the raise comes later
    const tl = inv(tRaise - 0.4, tRaise, t) * (1 - inv(tSave - 0.4, tSave, t));
    if (tl > 0) alpha(tl, () => {
      rect(90, 600, 860 * E.out(tl), 7, P.ink);
      arrowHead(90 + 860 * E.out(tl) + 12, 603, 0, 24, P.ink);
      text('time', 900, 660, { size: 46, fam: 'hand', weight: 700, color: P.ink });
      const pf = pop(t, tPrices, 0.5), rf = pop(t, tRaise, 0.5);
      if (pf > 0) at(300, 603, pf, 0, () => { line(0, 0, 0, -150, 6, P.ink); at(80, -140, 1.15, 0, () => priceTag('prices ↑', { w: 190, h: 64, size: 30, c: P.coral, tc: P.white, hole: P.cream })); text('first', 0, 60, { size: 46, fam: 'hand', weight: 700, color: P.coral2 }); });
      if (rf > 0) at(740, 603, rf, 0, () => { line(0, 0, 0, -150, 6, P.ink); at(0, -140, 1.2, 0, () => paycheck('raise')); text('later', 0, 60, { size: 46, fam: 'hand', weight: 700, color: P.teal2 }); });
    });
    const ya = inv(tYou - 0.1, tYou + 0.3, t) * (1 - inv(tRaise - 0.3, tRaise, t));
    if (ya > 0) {
      text('you', 820, 820, { size: 100, fam: 'hand', weight: 700, color: P.coral2, a: ya });
      alpha(ya, () => { strokePartial(bezierPts([780, 860], [740, 920], [690, 960], [630, 990], 30), ya, 8, P.coral2); });
    }
    // jar -> escalator -> ground
    const jarIn = pop(t, tSave - 0.2, 0.5);
    const escP = E.inOut(inv(tLike - 0.1, tLike + 0.8, t));
    const flatP = E.inOut(inv(tMean - 0.4, tMean + 0.4, t));
    if (jarIn > 0 && escP <= 0) {
      const lvl = lerp(0.8, 0.3, E.inOut(inv(tCash, tLike, t)));
      at(270, 1420, jarIn, 0, () => jar(lvl, { w: 230, h: 290, stroke: 'rgba(40,60,80,0.45)' }));
      for (let d = 0; d < 8; d++) {
        const a = ((t - tCash) * 1.1 + d / 8) % 1;
        if (t > tCash) alpha(1 - a, () => ellipse(330, 1400 + a * 90, 10, 14, P.bill2));
      }
    }
    text('value ↓', 270, 1050, { size: 72, fam: 'hand', weight: 700, color: P.coral2, a: inv(tCash, tCash + 0.4, t) * (1 - inv(tLike - 0.1, tLike + 0.3, t)) });
    if (escP > 0) {
      const A = align(jarS, escPanel, 'vjaresc');
      let S0 = morph(jarS, A, escP);
      if (flatP > 0) S0 = morph(A, align(A, groundS, 'vescground'), flatP);
      fillS(S0, mix(mixHex('#c9dde2', P.navy3, escP), '#e2d3b3', flatP));
      if (escP < 0.3) alpha(1 - escP / 0.3, () => at(270, 1420, 1, 0, () => jar(0.3, { w: 230, h: 290, stroke: 'rgba(40,60,80,0.45)' })));
      if (escP > 0.7 && flatP < 1) alpha(inv(0.7, 1, escP) * (1 - flatP * 3), () => escalatorSteps(t, EA, EB, un, eL));
    }
    const ea = inv(tDown - 0.2, tDown + 0.2, t) * (1 - inv(tMean - 0.4, tMean - 0.1, t));
    if (ea > 0) at(300, 880, 1, -0.1, () => text('going down', 0, 0, { size: 76, fam: 'hand', weight: 700, color: P.coral2, a: ea }));
    // owner, the source, and the gap
    const oIn = pop(t, tOwn - 0.2, 0.5);
    if (oIn > 0) {
      const src = inv(tOwn - 0.3, tOwn + 0.3, t);
      alpha(src, () => {
        rrect(690, -20, 60, 330, 12, P.gold2);
        rrect(670, 300, 100, 40, 12, P.gold2);
        text('SOURCE', 790, 150, { size: 30, weight: 800, ls: 4, color: P.gold2, align: 'left' });
        for (let k = 0; k < 7; k++) {
          const a = ((t - tOwn) * 1.3 + k / 7) % 1;
          if (t > tOwn) at(720 + Math.sin(k * 3) * 8, 360 + a * 420, 0.46, a * 6 + k, () => alpha(clamp((1 - a) * 3), () => coin(40)));
        }
      });
      at(760, 1560, oIn, 0, () => loungeChair());
      at(790, 1560, oIn * 0.95, 0, () => { ctx.save(); ctx.rotate(-0.35); ctx.translate(-40, 30); person({ who: 'owner', seed: 90, expr: t > tNothing ? 'smug' : 'smile', armL: 2.4, armR: 2.4, noShadow: true }, t); ctx.restore(); });
      if (t > tNothing) for (let k = 0; k < 3; k++) {
        const a = ((t - tNothing) * 0.6 + k / 3) % 1;
        text('z', 880 + a * 60, 1250 - a * 120, { size: 44 + k * 8, weight: 800, color: P.navy3, a: Math.sin(a * Math.PI) });
      }
      text('already owns assets', 760, 1660, { size: 52, fam: 'hand', weight: 700, color: P.teal2, a: inv(tOwn + 0.2, tOwn + 0.6, t) });
    }
    const bA = inv(tRich - 0.4, tRich, t);
    if (bA > 0) {
      const g = E.inOut(inv(tRich - 0.2, tOut - 0.3, t));
      const hY = lerp(120, 170, g) * E.out(bA), hO = lerp(150, 560, g) * E.out(bA);
      const base = 1200;
      rrect(320, base - hY, 130, hY, 12, P.teal);
      rrect(655, base - hO, 130, hO, 12, P.gold);
      text('YOU', 385, base + 38, { size: 30, weight: 800, ls: 4, color: P.ink, a: bA });
      text('OWNER', 720, base + 38, { size: 30, weight: 800, ls: 4, color: P.ink, a: bA });
      const ga = inv(tWithout - 0.2, tWithout + 0.2, t);
      if (ga > 0) alpha(ga, () => {
        ctx.save(); ctx.setLineDash([10, 12]); strokePoly([[320, base - hY], [785, base - hY]], 4, P.ink); ctx.restore();
        const top = base - hO, bot = base - hY;
        strokePoly([[552, top + 4], [552, bot - 4]], 7, P.coral2);
        arrowHead(552, top + 2, -Math.PI / 2, 20, P.coral2);
        arrowHead(552, bot - 2, Math.PI / 2, 20, P.coral2);
        text('THE GAP', 552, (top + bot) / 2, { size: 46, weight: 900, ls: 4, color: P.coral2, stroke: P.cream, strokeW: 16 });
      });
      V.gapMid = [552, base - (hO + hY) / 2];
    }
    // YOU (on top)
    const bodyP = inv(0.62, 1, p);
    if (p < 1) {
      const hm = E.inOut(inv(0, 0.7, p));
      const hx = lerp(n5.x, YX, hm), hy = lerp(n5.y, YF - 252 * YS, hm), r = lerp(n5.r, 45 * YS, hm);
      if (bodyP > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, hy + (YF + 20 - hy) * E.out(bodyP)); ctx.clip(); at(YX, YF, YS, 0, () => person({ who: 'you', seed: 80 }, t)); ctx.restore(); }
      alpha(1 - inv(0.8, 1, p), () => circle(hx, hy, r, mix(NODE_FILL, P.skin2, inv(0.3, 0.8, p))));
    } else {
      const q = pos(t);
      const onEsc = t > tLike + 0.6 && t < tMean;
      const walk = onEsc ? t * 7 : 0;
      const hold = t > tPay - 0.3 && t < tSave - 0.3 ? () => at(70, -150, 1, 0.15, () => paycheck('$')) : null;
      const expr = t > tCash ? 'worried' : t > tPrices ? 'neutral' : 'smile';
      at(q.x, q.y, q.s, onEsc ? -0.12 : 0, () => person({ who: 'you', seed: 80, walk, walkAmp: 0.45, armR: hold ? 1.2 : 0.12, hold, expr }, t));
    }
  });
}

// ================================================================= 6. END
function shortEnd() {
  const t0 = V.youOut;
  const tInfl = S('e1'), tTransfer = Wd('e1', 'transfer');
  const tHear = Wd('e2', 'hear'), tHow = Wd('e2', 'how'), tMuch = Wd('e2', 'much');
  const tAsk = S('e3'), tWho = Wd('e3', 'who'), tFirst = Wd('e3', 'first');
  const tPr = Eend('e1') + 0.15; // transfer diagram melts into the machine
  const tMove = tAsk - 0.3;
  const tMerge = Eend('e3') + 0.5, tTitle = tMerge + 0.85;
  const tEnd = TL.duration;
  sfx(t0 + 0.1, 'morph', 0.7); sfx(tInfl, 'pop', 0.7); sfx(tTransfer - 0.2, 'morph', 0.8); sfx(tTransfer + 0.4, 'coins', 0.6);
  sfx(tPr, 'morph', 0.8); sfx(tPr + 0.8, 'machine_start', 0.8, { until: tMerge });
  sfx(tHear, 'news', 0.7); sfx(tMuch + 0.2, 'scribble', 0.6); sfx(tMove, 'whoosh', 0.6);
  sfx(tWho, 'boom', 0.9); sfx(tFirst + 0.1, 'ding', 0.7);
  sfx(tMerge, 'morph', 0.9); sfx(tTitle - 0.1, 'coin', 0.8); sfx(tTitle + 0.1, 'outro', 1);
  const back = [0, 1, 2, 3].map(k => ({ who: CAST_ORDER[1 + k], x: 200 + k * 170, y: 1500, s: 0.62 }));
  const front = { who: 'banker', x: 540, y: 820, s: 0.95 };
  const prAt = t => { const m = E.inOut(inv(tMove, tMove + 0.7, t)); return { x: 540, y: lerp(1260, 990, m), s: lerp(1.2, 0.8, m) }; };
  const line = CAST_ORDER.map((who, i) => ({ who, x: 140 + i * 200, y: 1420, s: 0.62, t0: tMove + 0.25 + i * 0.08 }));
  line.forEach(p => sfx(p.t0, 'pop', 0.35));
  const silPrinter = rrectS(-215, -384, 430, 384, 40);
  const silPerson = pathS(PERSON_SIL);
  const coinC = { x: 540, y: 690, r: 130 };

  scene(t0, tEnd + 1, t => {
    const p = inv(t0, t0 + 1.1, t);
    const gm = V.gapMid || [540, 900];
    if (p < 1) circle(gm[0], gm[1], E.inOut(p) * 2600, P.navy); else rect(0, 0, W, H, P.navy);
    const prIn = inv(tPr, tPr + 1.0, t);
    const pr = prAt(t);
    const mergeP = inv(tMerge, tMerge + 0.85, t);
    const live = mergeP <= 0;
    // e1: inflation -> transfer
    const ia = inv(tInfl - 0.3, tInfl + 0.1, t) * (1 - inv(tPr - 0.1, tPr + 0.2, t));
    if (ia > 0) alpha(ia, () => {
      const tp = E.inOut(inv(tTransfer - 0.4, tTransfer + 0.4, t));
      const ko = { size: 80, fam: 'serif', weight: 900, accent: P.coral };
      kinetic('Inflation isn’t just', CX, 250, t, [tInfl, Wd('e1', "isn't"), Wd('e1', 'just')], { ...ko, out: tTransfer - 0.5 });
      kinetic('prices going *up.*', CX, 345, t, [Wd('e1', 'prices'), Wd('e1', 'going'), Wd('e1', 'up')], { ...ko, out: tTransfer - 0.45 });
      kinetic('It’s a *transfer.*', CX, 300, t, [Wd('e1', "it's"), Wd('e1', 'a'), tTransfer], { ...ko, size: 104, accent: P.gold });
      at(CX, 900, pop(t, tInfl, 0.5) * (1 - tp), 0, () => { priceTag('INFLATION', { w: 460, h: 130, size: 62, c: P.cream, hole: P.navy }); at(0, -160, 1.1, 0, () => upArrow(64, P.coral)); });
      if (tp > 0) {
        back.forEach((b, k) => at(b.x, b.y, b.s * tp, 0, () => person({ who: b.who, seed: 130 + k, dim: 0.5, expr: 'worried', look: [0, -5] }, t)));
        alpha(tp, () => bgGlow(front.x, front.y - 150, 280, P.gold, 0.45));
        at(front.x, front.y, front.s * tp, 0, () => person({ who: 'banker', seed: 140, expr: 'smug' }, t));
        const arr = bezierPts([760, 1250], [980, 1050], [960, 700], [700, 640], 60);
        const ap = inv(tTransfer - 0.1, tTransfer + 0.7, t);
        strokePartial(arr, ap, 20, P.coral, [2, 30]);
        if (ap > 0.97) arrowHead(700, 640, 3.0, 34, P.coral);
        for (let j = 0; j < 6; j++) { const u = ((t - tTransfer) * 0.6 + j / 6) % 1; if (t > tTransfer && u < ap) { const q = pointAlong(arr, u); at(q[0], q[1], 0.5, 0, () => coin(40)); } }
        text('back of the line', CX, 1590, { size: 54, fam: 'hand', weight: 700, color: P.sky, a: tp });
        text('front', front.x - 220, 700, { size: 54, fam: 'hand', weight: 700, color: P.gold, a: tp });
      }
    });
    // transfer diagram melts into the money machine
    if (prIn > 0 && prIn < 1) {
      const em = E.inOut(prIn);
      const tgt = xf(silPrinter, 540, 1260, 1.2);
      const sils = [{ S: xf(silPerson, front.x, front.y, front.s), c: CAST.banker.top }, ...back.map(b => ({ S: xf(silPerson, b.x, b.y, b.s), c: CAST[b.who].top }))];
      sils.forEach((s, k) => fillS(morph(s.S, align(s.S, tgt, 'vend2pr' + k), em), mix(s.c, '#eadcbc', em)));
    }
    const run = inv(tPr + 0.8, tPr + 1.2, t);
    if (prIn >= 1 && live) {
      if (t < tMove + 0.2) for (let i = 0; i < 50; i++) {
        const te = tPr + 1.0 + i * 0.1;
        if (t < te || t - te > 4) continue;
        const b = billPath(i + 900, te, t, 540, 1260 - 97 * 1.2, 0.62);
        flyingBill(b.x, b.y, b.rot, b.flip, 100, 1);
      }
      bgGlow(pr.x, pr.y - 200 * pr.s, 650, P.gold, 0.14);
      at(pr.x, pr.y, pr.s, 0, () => printer(t, { run, spin: rampInt(t, tPr + 0.8, 0.5) * 2.4, lever: 1, runStart: tPr + 0.8 }));
      if (t > tMove) {
        const glow = inv(tFirst - 0.2, tFirst + 0.4, t);
        line.forEach((q, i) => {
          const sc = life(t, q.t0) * q.s;
          if (sc <= 0) return;
          if (i === 0) alpha(glow, () => bgGlow(q.x, q.y - 150, 240, P.gold, 0.5));
          at(q.x, q.y, sc, 0, () => person({ who: q.who, seed: 150 + i, look: [-5, 0], expr: i === 0 ? (glow > 0.5 ? 'happy' : 'smile') : i >= 3 && glow > 0.5 ? 'worried' : 'smile', dim: i === 0 ? 0 : glow * (0.2 + i * 0.12) }, t));
        });
        for (let i = 0; i < 12; i++) {
          const te = tMove + 0.7 + i * 0.2;
          const a = (t - te) / 0.8;
          if (a < 0 || a > 1) continue;
          const p0 = prAt(te), u = E.sine(a);
          flyingBill(lerp(p0.x, line[0].x, u), lerp(p0.y - 100 * p0.s, line[0].y - 200, u) - Math.sin(u * Math.PI) * 200, a * 5 + i, a * 9, 80, 1);
        }
      }
    }
    if (mergeP > 0 && mergeP < 1) {
      const em = E.inOut(mergeP);
      const target = circleS(coinC.x, coinC.y, coinC.r);
      const sils = [{ S: xf(silPrinter, pr.x, pr.y, pr.s), c: '#eadcbc', key: 'pr' }, ...line.map((q, i) => ({ S: xf(silPerson, q.x, q.y, q.s), c: CAST[q.who].top, key: 'p' + i }))];
      for (const sl of sils) fillS(morph(sl.S, align(sl.S, target, 'vendc' + sl.key), em), mix(sl.c, P.gold, inv(0.3, 0.9, mergeP)));
    }
    // news banner
    const nb = inv(tHear - 0.2, tHear + 0.3, t) * (1 - inv(tMove - 0.2, tMove + 0.2, t));
    if (nb > 0) at(lerp(-1100, 0, E.out(nb)) - E.in(inv(tMove - 0.2, tMove + 0.2, t)) * 1200, 0, 1, 0, () => {
      rect(0, 1480, 1000, 80, P.coral2);
      rect(0, 1480, 230, 80, P.white);
      text('BREAKING', 115, 1521, { size: 30, weight: 900, ls: 3, color: P.coral2 });
      text('NEW MONEY CREATED', 262, 1521, { size: 36, weight: 800, ls: 3, color: P.white, align: 'left' });
    });
    const hm = inv(tHow - 0.2, tHow + 0.15, t) * (1 - inv(tAsk - 0.1, tAsk + 0.2, t));
    if (hm > 0) at(CX, 330, 1, -0.03, () => {
      text('How much?', 0, 0, { size: 130, fam: 'serif', weight: 900, color: P.cream, a: hm });
      alpha(hm, () => scribble(-340, 8, 340, -6, inv(tMuch + 0.1, tMuch + 0.45, t), 18, P.coral, 6, 4));
    });
    if (t > tAsk - 0.1 && t < tMerge + 0.5) {
      text('ASK', CX, 170, { size: 42, weight: 800, ls: 16, color: P.gold, a: inv(tAsk, tAsk + 0.3, t) * (1 - inv(tMerge - 0.1, tMerge + 0.2, t)) });
      kinetic('Who gets it', CX, 290, t, [tWho, Wd('e3', 'gets'), Wd('e3', 'it')], { size: 112, fam: 'serif', weight: 900, out: tMerge - 0.1 });
      kinetic('*first?*', CX, 420, t, [tFirst], { size: 140, fam: 'serif', weight: 900, out: tMerge - 0.05 });
    }
    if (mergeP >= 1) {
      bgGlow(540, 900, 800, P.gold, 0.14 * (1 - inv(tEnd - 1.5, tEnd - 0.3, t)));
      at(coinC.x, coinC.y, 1, 0, () => coin(coinC.r));
      kinetic('THE', CX, 900, t, [tTitle], { size: 40, weight: 800, ls: 16, color: P.gold });
      kinetic('CANTILLON', CX, 1020, t, [tTitle + 0.1], { size: 150, weight: 900, fam: 'serif' });
      kinetic('EFFECT', CX, 1175, t, [tTitle + 0.25], { size: 150, weight: 900, fam: 'serif' });
      alpha(1, () => scribble(290, 1262, 790, 1262, inv(tTitle + 0.6, tTitle + 1.0, t), 12, P.gold, 4, 2));
      const ta = inv(tTitle + 0.9, tTitle + 1.4, t);
      text('New money isn’t neutral.', CX, 1370, { size: 44, weight: 600, color: rgba(P.cream, 0.85), a: ta });
      text('Who gets it first matters.', CX, 1430, { size: 44, weight: 600, color: rgba(P.cream, 0.85), a: ta });
      const cr = inv(tTitle + 1.3, tTitle + 1.8, t);
      alpha(cr, () => rect(CX - 60, 1498, 120, 3, rgba(P.gold, 0.6)));
      text('By Kane Gulka ft. Opus 5.5', CX, 1545, { size: 38, weight: 700, ls: 1, color: P.gold, a: cr });
    }
    const ff = inv(tEnd - 1.3, tEnd - 0.1, t);
    if (ff > 0) alpha(ff, () => rect(0, 0, W, H, '#0e1220'));
  });
}
