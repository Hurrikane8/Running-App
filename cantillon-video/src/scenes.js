// Scene choreography. Each scene is drawn from absolute time t; transitions are
// continuous morphs between neighbouring scenes (no cuts anywhere).

const SCENES = [];
function scene(a, b, draw) { SCENES.push({ a, b, draw }); }

function drawFrame(t, frame) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = P.navy;
  ctx.fillRect(0, 0, W, H);
  for (const sc of SCENES) if (t >= sc.a && t < sc.b) { ctx.save(); sc.draw(t); ctx.restore(); }
  post(t, frame);
}

// integral of a 0->1 ramp starting at a lasting d (for smooth spin-up of gears)
function rampInt(t, a, d) {
  if (t <= a) return 0;
  if (t <= a + d) return (t - a) * (t - a) / (2 * d);
  return d / 2 + (t - a - d);
}
function gear(r, teeth, c, hole = P.navy) {
  const pts = [];
  for (let k = 0; k < teeth * 4; k++) {
    const a = (k / (teeth * 4)) * TAU;
    const rr2 = k % 4 === 0 || k % 4 === 1 ? r : r * 0.8;
    pts.push([Math.cos(a) * rr2, Math.sin(a) * rr2]);
  }
  poly(pts, c);
  circle(0, 0, r * 0.35, hole);
}
function bgGlow(x, y, r, c, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(c, a));
  g.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---------------------------------------------------------------- money printer
// o: { pop: {body,gear,chim,lamp,dial,emblem} appear times, run: 0..1, spin, lever }
function printer(t, o) {
  const run = o.run || 0;
  const sh = run * 2.6;
  const sx = Math.sin(t * 61) * sh, sy = Math.cos(t * 47) * sh * 0.7;
  const pp = k => (o.pop ? pop(t, o.pop[k], 0.5, 2.2) : 1);
  ctx.save();
  ctx.translate(sx, sy);
  const spin = o.spin || 0;
  // back gears
  at(-205, -230, pp('gear'), spin * 1.4, () => gear(92, 12, P.gold2));
  at(-150, -350, pp('gear') * 0.9, -spin * 2.2, () => gear(52, 9, P.coral));
  // chimney & steam
  at(128, -372, pp('chim'), 0, () => {
    rect(-18, -70, 36, 72, P.navy3);
    rrect(-28, -86, 56, 18, 6, P.navy3);
  });
  if (run > 0) {
    for (let i = 0; i < 40; i++) {
      const te = o.runStart + i * 0.42;
      const age = t - te;
      if (age < 0 || age > 1.8) continue;
      const k = age / 1.8;
      alpha((1 - k) * 0.55 * run, () => circle(128 + Math.sin(age * 3 + i) * 12 + age * 30, -470 - age * 110, 12 + age * 26, P.cream));
    }
  }
  // lever (right)
  at(210, -205, pp('body'), 0, () => {
    const pull = o.lever || 0;
    const ang = -0.9 + pull * 1.3;
    line(0, 0, Math.cos(ang) * 95, Math.sin(ang) * 95, 14, P.navy3);
    circle(Math.cos(ang) * 95, Math.sin(ang) * 95, 20, P.coral);
    circle(0, 0, 16, P.navy3);
  });
  // body
  const bs = pp('body');
  at(0, 0, bs, 0, () => {
    rect(-175, -34, 44, 34, P.navy3);
    rect(131, -34, 44, 34, P.navy3);
    rrect(-215, -350, 430, 320, 38, '#eadcbc');
    ctx.save();
    ctx.beginPath(); ctx.roundRect(-215, -350, 430, 320, 38); ctx.clip();
    rect(-215, -140, 430, 120, '#d8c49e');
    rect(-215, -350, 430, 14, 'rgba(255,255,255,0.35)');
    ctx.restore();
    rrect(-180, -384, 360, 46, 20, P.navy3);
    for (let i = 0; i < 6; i++) { circle(-180 + i * 72, -322, 5, '#c8b28a'); }
    // slot + tray
    rrect(-160, -112, 320, 30, 15, P.ink);
    poly([[-170, -86], [170, -86], [205, -44], [-205, -44]], P.navy3);
  });
  // dials
  for (const s of [-1, 1]) {
    at(s * 140, -272, pp('dial'), 0, () => {
      circle(0, 0, 34, P.cream);
      ring(0, 0, 34, 7, P.navy3);
      const a = -2.2 + run * (1.2 + Math.sin(t * (7 + s * 2)) * 0.5) + (s > 0 ? 0.3 : 0);
      line(0, 0, Math.cos(a) * 24, Math.sin(a) * 24, 5, P.coral2);
      circle(0, 0, 5, P.ink);
    });
  }
  // emblem
  at(0, -222, pp('emblem'), 0, () => coin(66));
  // lamp
  at(0, -384, pp('lamp'), 0, () => {
    const on = run > 0 ? (Math.sin(t * 9) > 0 ? 1 : 0.35) : 0.15;
    if (on > 0.5) bgGlow(0, -12, 90, P.gold, 0.5);
    ctx.fillStyle = mix(P.coral2, '#ffcf5a', on);
    ctx.beginPath(); ctx.arc(0, 0, 30, Math.PI, 0); ctx.fill();
    rect(-38, -4, 76, 10, P.navy3);
  });
  ctx.restore();
}

// Physically-plausible flutter path for a bill ejected at te from (x0,y0).
function billPath(i, te, t, x0, y0, spread = 1) {
  const a = t - te;
  const vx = rr(i, 1, -620, 620) * spread, vy = rr(i, 2, -1250, -800);
  const kx = 1.1, ky = 2.3, g = 820;
  const x = x0 + (vx / kx) * (1 - Math.exp(-kx * a)) + Math.sin(a * 3 + i) * 26 * clamp(a);
  const y = y0 + ((vy - g / ky) / ky) * (1 - Math.exp(-ky * a)) + (g / ky) * a;
  return { x, y, rot: rr(i, 3, -1, 1) + a * rr(i, 4, -2.5, 2.5), flip: a * rr(i, 5, 3, 8), a };
}

// ---------------------------------------------------------------- scenes
function buildScenes() {
  hookScene();
  cantillonScene();
  rippleScene();
  townScene();
  modernScene();
  youScene();
  mattersScene();
  endScene();
}

// ================================================================= 1. HOOK
let HOOK = {};
function hookScene() {
  const pops = { body: 0.35, gear: 0.62, chim: 0.78, dial: 0.9, emblem: 1.02, lamp: 1.14 };
  for (const k in pops) sfx(pops[k], 'pop', 0.6);
  const leverT = 2.05, runStart = Wd('h1', 'create') - 0.1;
  sfx(leverT, 'clunk', 0.8);
  sfx(runStart, 'machine_start', 0.9, { until: 15.4 });
  const tHero = S('h2') - 0.05, tReal = Wd('h2', 'real');
  const tMil = Wd('h3', 'million');
  const tMove = S('h4') - 0.3;
  const tWho = Wd('h4', 'who'), tFirst = Wd('h4', 'first');
  const tMatters = S('h5');
  const tMorph = S('h6') - 0.25;
  const tRent = Wd('h6', 'rent'), tSav = Wd('h6', 'savings'), tTop = Wd('h6', 'top');
  const tMerge = S('h7') - 0.45;
  const tCalled = Wd('h7', 'cantillon'), tEffect = Wd('h7', 'effect');
  const tOut = Eend('h7') + 0.2;
  HOOK = { tOut, coin: { x: 960, y: 372, r: 110 } };

  sfx(tHero, 'whoosh', 0.8);
  sfx(Wd('h2', 'counterfeit') + 0.1, 'scribble', 0.6);
  sfx(tReal, 'stamp', 1);
  sfx(tReal + 0.15, 'shine', 0.6);
  sfx(tMil, 'counter', 0.7, { dur: 1.1 });
  sfx(tMove, 'whoosh', 0.6);
  sfx(tFirst, 'ding', 0.7);
  sfx(tMorph, 'morph', 0.9);
  sfx(tRent, 'pop', 0.8); sfx(tSav, 'pop', 0.8); sfx(tTop, 'pop', 0.8);
  sfx(tMerge, 'morph', 0.8);
  sfx(tCalled, 'boom', 1.0);
  sfx(tMerge + 0.55, 'coin', 0.8);

  // printer placement over time
  const prT = t => {
    const m = E.inOut(inv(tMove, tMove + 0.8, t));
    return { x: lerp(960, 400, m), y: lerp(880, 905, m), s: lerp(1.15, 0.66, m) };
  };
  const people = CAST_ORDER.map((who, i) => ({ who, x: 780 + i * 215, y: 905, s: 0.64, t0: tMove + 0.25 + i * 0.1 }));
  people.forEach(p => sfx(p.t0, 'pop', 0.4));
  const circles = [
    { x: 480, y: 470, r: 175, c: '#f8dcc0', label: 'RENT', arrow: 1 },
    { x: 960, y: 470, r: 175, c: '#cfe7e1', label: 'SAVINGS', arrow: -1 },
    { x: 1440, y: 470, r: 175, c: '#f7e3a9', label: 'THE GAP', arrow: 1 },
  ];
  const tIcons = [tRent, tSav, tTop];
  const silPrinter = rrectS(-215, -384, 430, 384, 40);
  const silPerson = pathS(PERSON_SIL);

  // Targeted bills: after tMove, the printer feeds the first person in line.
  const feedStart = tMove + 0.9, feedEnd = tMorph - 0.2, feedRate = 5;
  const nFeed = Math.floor((feedEnd - feedStart) * feedRate);

  scene(0, tOut + 1.6, t => {
    // background + glow
    ctx.fillStyle = P.navy;
    ctx.fillRect(0, 0, W, H);
    const pr = prT(t);
    const glowA = inv(0, 1.2, t) * (1 - inv(tMorph, tMorph + 0.6, t));
    // spotlight cone from above
    if (glowA > 0) alpha(glowA * (1 - inv(tMove, tMove + 0.6, t)), () => {
      const g = ctx.createLinearGradient(0, 0, 0, 900);
      g.addColorStop(0, 'rgba(255,230,170,0.16)');
      g.addColorStop(1, 'rgba(255,230,170,0.02)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(860, -10); ctx.lineTo(1060, -10); ctx.lineTo(1340, 900); ctx.lineTo(580, 900); ctx.fill();
      ellipse(960, 884, 380, 46, 'rgba(255,230,170,0.08)');
    });
    bgGlow(pr.x, pr.y - 220 * pr.s, 700 * pr.s + 200, P.gold, 0.16 * glowA);
    const run = inv(runStart, runStart + 0.6, t) * (1 - inv(tMorph - 0.3, tMorph, t));
    const spin = rampInt(t, runStart, 0.6) * 2.4;
    const lever = E.out(inv(leverT, leverT + 0.25, t));
    const fadePr = 1 - inv(tMorph, tMorph + 0.12, t);

    // free-flying bills (hook part 1-3)
    const emitA = runStart + 0.2, emitB = tMove + 0.2;
    const drawFree = front => {
      for (let i = 0; i < 160; i++) {
        const rate = i < 40 ? 0.16 : 0.07;
        const te = emitA + (i < 40 ? i * 0.16 : 40 * 0.16 + (i - 40) * 0.07);
        if (te > emitB) break;
        if (t < te || t - te > 4.5) continue;
        if ((i % 3 === 0) !== front) continue;
        const b = billPath(i, te, t, 960, 768, 1);
        const heroDim = 1 - 0.6 * fade(t, tHero, tMil - 0.3, 0.3, 0.4);
        flyingBill(b.x, b.y, b.rot, b.flip, 100 * clamp(b.a * 5), heroDim * fadePr);
      }
    };
    drawFree(false);
    // printer (pre-morph)
    if (fadePr > 0) alpha(fadePr, () => at(pr.x, pr.y, pr.s, 0, () => printer(t, { pop: pops, run, spin, lever, runStart })));
    drawFree(true);

    // hero bill: "Not counterfeit money. Real, brand-new dollars."
    const hp = inv(tHero, tHero + 0.75, t), hout = inv(tMil - 0.45, tMil + 0.15, t);
    if (hp > 0 && hout < 1) {
      alpha(0.6 * E.out(hp) * (1 - hout), () => rect(0, 0, W, H, P.navy));
      const e = E.out(hp), o = E.in(hout);
      const x = lerp(lerp(960, 960, e), 1500, o);
      const y = lerp(lerp(700, 520, e), 120, o) - Math.sin(e * Math.PI) * 200 * (1 - o);
      const w = lerp(lerp(100, 700, e), 120, o);
      const rot = lerp(lerp(2.4, -0.06, e), 1.2, o);
      const flip = lerp(Math.PI * 5, 0, e) + o * 7;
      at(x, y, 1, rot, () => {
        ctx.scale(1, Math.max(0.05, Math.abs(Math.cos(flip))));
        ellipse(0, w * 0.34, w * 0.5, w * 0.05, 'rgba(0,0,0,0.25)');
        bill({ w, c1: Math.cos(flip) < 0 ? '#8dbc74' : P.bill });
        // shine sweep
        const sp = inv(tReal + 0.05, tReal + 0.6, t);
        if (sp > 0 && sp < 1) {
          ctx.save();
          ctx.beginPath(); ctx.roundRect(-w / 2, -w / 4, w, w / 2, w * 0.06); ctx.clip();
          const sx = lerp(-w * 0.8, w * 0.8, sp);
          ctx.fillStyle = 'rgba(255,255,240,0.55)';
          ctx.beginPath(); ctx.moveTo(sx, -w / 3); ctx.lineTo(sx + 60, -w / 3); ctx.lineTo(sx - 40, w / 3); ctx.lineTo(sx - 100, w / 3); ctx.fill();
          ctx.restore();
        }
        // stamp
        const st = inv(tReal - 0.05, tReal + 0.12, t);
        if (st > 0) at(w * 0.24, w * 0.14, lerp(2.2, 1, E.out(st)), -0.2, () => alpha(clamp(st * 3), () => {
          rrect(-120, -44, 240, 88, 14, 'rgba(255,248,225,0.92)');
          ctx.strokeStyle = P.gold2; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.roundRect(-112, -36, 224, 72, 10); ctx.stroke();
          text('✓ REAL', 0, 3, { size: 46, weight: 900, fam: 'serif', color: P.gold2 });
        }));
      });
      // "counterfeit?" crossed out
      const cf = Wd('h2', 'counterfeit');
      const ca = inv(cf - 0.1, cf + 0.2, t) * (1 - inv(tReal + 0.2, tReal + 0.5, t));
      if (ca > 0) {
        at(960, 175, lerp(0.8, 1, E.out(inv(cf - 0.1, cf + 0.3, t))), -0.04, () => {
          text('counterfeit?', 0, 0, { size: 110, fam: 'hand', weight: 700, color: P.coral, a: ca });
          alpha(ca, () => scribble(-250, 6, 250, -4, inv(Wd('h2', 'money') - 0.15, Wd('h2', 'money') + 0.2, t), 12, P.coral, 6, 3));
        });
      }
      const nw = Wd('h2', 'brand-new');
      const na = inv(nw - 0.1, nw + 0.2, t) * (1 - hout);
      if (na > 0) text('brand-new', 960, 175, { size: 110, fam: 'hand', weight: 700, color: P.gold, a: na });
    }

    // counter "$1,000,000"
    const cA = fade(t, tMil - 0.2, tMove, 0.3, 0.3);
    if (cA > 0) {
      const v = Math.round(E.out(inv(tMil, tMil + 1.1, t)) * 1000000);
      at(960, 150, pop(t, tMil - 0.2, 0.5), 0, () => text('$' + v.toLocaleString('en-US'), 0, 0, { size: 110, weight: 900, fam: 'serif', color: P.gold, a: cA }));
    }

    // people in line + targeted bills
    const stackN = i => Math.min(9, Math.floor(Math.max(0, (t - feedStart - 0.9) * feedRate)));
    const peopleA = 1 - inv(tMorph, tMorph + 0.12, t);
    if (t > tMove && peopleA > 0) {
      const dimP = inv(tMatters, tMatters + 1.2, t);
      people.forEach((p, i) => {
        const s = life(t, p.t0) * p.s;
        if (s <= 0) return;
        if (i === 0) alpha(dimP, () => bgGlow(p.x, p.y - 150, 260, P.gold, 0.45));
        const isFirst = i === 0;
        const expr = isFirst ? (dimP > 0.3 ? 'happy' : 'smile') : dimP > 0.5 && i >= 3 ? 'worried' : 'smile';
        alpha(peopleA, () => at(p.x, p.y, s, 0, () => person({
          who: p.who, seed: i + 3, expr, dim: isFirst ? 0 : dimP * (0.25 + i * 0.15),
          armL: isFirst ? 0.12 + 0.5 * E.out(inv(feedStart, feedStart + 0.4, t)) : 0.12,
          armR: isFirst ? 0.12 + 0.5 * E.out(inv(feedStart, feedStart + 0.4, t)) : 0.12,
          look: [-5, 0],
          holdFront: isFirst && stackN() > 0 ? () => at(0, -112, 1, 0, () => billStack(stackN(), 104)) : null,
        }, t)));
      });
      // bills flying to first person
      for (let i = 0; i < nFeed; i++) {
        const te = feedStart + i / feedRate;
        const a = (t - te) / 0.9;
        if (a < 0 || a > 1) continue;
        const pr0 = prT(te);
        const x0 = pr0.x, y0 = pr0.y - 100 * pr0.s;
        const x1 = people[0].x, y1 = people[0].y - (120 + stackN() * 9) * people[0].s;
        const u = E.sine(a);
        const bx = lerp(x0, x1, u), by = lerp(y0, y1, u) - Math.sin(u * Math.PI) * 260;
        flyingBill(bx, by, a * 5 + i, a * 9, 80, peopleA);
      }
    }

    // question
    if (t > tWho - 0.1 && t < tMorph + 0.5) {
      kinetic('Who gets it *first?*', 960, 170, t, [tWho, Wd('h4', 'got'), Wd('h4', 'them'), tFirst], { size: 96, fam: 'serif', weight: 900, out: tMorph - 0.1 });
    }

    // ---- morph: printer + people -> three circles
    const mp = inv(tMorph, tMorph + 0.9, t);
    const mergeP = E.inOut(inv(tMerge, tMerge + 0.6, t));
    const circA = 1 - inv(tMerge + 0.5, tMerge + 0.6, t);
    if (mp > 0 && mp < 1 && circA > 0) {
      const em = E.inOut(mp);
      // printer silhouette -> circle 1
      const pr0 = prT(tMorph);
      const sils = [
        { S: xf(silPrinter, pr0.x, pr0.y, pr0.s), c: '#eadcbc', to: 0, key: 'pr' },
        ...people.map((p, i) => ({ S: xf(silPerson, p.x, p.y, p.s), c: CAST[p.who].top, to: i < 2 ? 1 : 2, key: 'pp' + i })),
      ];
      for (const s of sils) {
        const C = circles[s.to];
        const target = align(s.S, circleS(C.x, C.y, C.r), 'hookc' + s.key);
        const sh = morph(s.S, target, E.inOut(inv(0.05, 0.9, mp)));
        fillS(sh, mix(s.c, C.c, inv(0.2, 0.8, mp)), 1);
      }
    }
    if (mp >= 1 && circA > 0) {
      circles.forEach((C, i) => {
        // slide outer circles to the centre and shrink to a coin
        const cx = lerp(C.x, HOOK.coin.x, mergeP), cy = lerp(C.y, HOOK.coin.y, mergeP);
        const r = lerp(C.r, HOOK.coin.r, mergeP);
        circle(cx, cy, r, mix(C.c, P.gold, mergeP));
        const ia = 1 - inv(tMerge - 0.1, tMerge + 0.15, t);
        alpha(ia, () => ring(cx, cy, r - 5, 10, rgba(P.navy3, 0.25)));
        const ip = pop(t, tIcons[i], 0.55);
        if (ip > 0 && ia > 0) alpha(ia, () => {
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, r - 10, 0, TAU); ctx.clip();
          at(cx, cy, ip, 0, () => hookIcon(i, t, tIcons[i]));
          ctx.restore();
          // label
          const la = inv(tIcons[i] + 0.2, tIcons[i] + 0.5, t);
          text(C.label, cx - 18, C.y + C.r + 62, { size: 38, weight: 800, ls: 6, color: P.cream, a: la * ia });
          const aw = measure(C.label, { size: 38, weight: 800, ls: 6 });
          at(cx - 18 + aw / 2 + 32, C.y + C.r + 60, la * 0.6, C.arrow > 0 ? 0 : Math.PI, () => upArrow(34, C.arrow > 0 ? P.coral : P.sky));
        });
      });
    }
    // coin + title
    if (t > tMerge) bgGlow(HOOK.coin.x, 520, 800, P.gold, 0.14 * inv(tMerge, tMerge + 0.8, t) * (1 - inv(HOOK.tOut, HOOK.tOut + 0.8, t)));
    if (t > tMerge + 0.5 && t < HOOK.tOut) {
      const c = HOOK.coin;
      at(c.x, c.y, 1, 0, () => coin(c.r));
      const shineP = inv(tMerge + 0.6, tMerge + 1.2, t);
      if (shineP > 0 && shineP < 1) {
        ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.clip();
        const sx = lerp(c.x - 200, c.x + 200, shineP);
        ctx.fillStyle = 'rgba(255,250,230,0.55)';
        ctx.beginPath(); ctx.moveTo(sx - 30, c.y - 150); ctx.lineTo(sx + 10, c.y - 150); ctx.lineTo(sx - 30, c.y + 150); ctx.lineTo(sx - 70, c.y + 150); ctx.fill();
        ctx.restore();
      }
    }
    if (t > tCalled - 0.6) {
      const ta = 1;
      kinetic('THE', 960, 555, t, [Wd('h7', 'the')], { size: 34, weight: 800, ls: 14, color: P.gold, out: HOOK.tOut - 0.1 });
      kinetic('CANTILLON EFFECT', 960, 655, t, [tCalled, tEffect], { size: 132, weight: 900, fam: 'serif', color: P.cream, out: HOOK.tOut - 0.05 });
      const ul = inv(tEffect + 0.3, tEffect + 0.7, t) * (1 - inv(HOOK.tOut, HOOK.tOut + 0.3, t));
      if (ul > 0) alpha(1 - inv(HOOK.tOut, HOOK.tOut + 0.3, t), () => scribble(600, 740, 1320, 740, ul, 10, P.gold, 4, 2));
    }
  });
}

function hookIcon(i, t, t0) {
  const k = t - t0;
  if (i === 0) {
    at(-10, 95, 1, 0, () => house({ w: 170, h: 120, body: P.cream, roof: P.coral }));
    const v = Math.round(lerp(1200, 1950, E.out(inv(0.3, 2.2, k))) / 10) * 10;
    at(62, -62, 1, -0.18 + Math.sin(k * 3) * 0.03, () => priceTag('$' + v.toLocaleString('en-US'), { w: 190, h: 70, size: 36, c: P.white, hole: '#f8dcc0' }));
    at(-95, -55 - Math.abs(Math.sin(k * 4)) * 12, 0.9, 0, () => upArrow(38, P.coral));
  } else if (i === 1) {
    const lvl = lerp(0.85, 0.28, E.inOut(inv(0.2, 2.3, k)));
    at(0, 115, 0.95, 0, () => jar(lvl, { w: 150, h: 190, stroke: 'rgba(40,60,80,0.35)' }));
    for (let d = 0; d < 6; d++) {
      const a = ((k * 1.3 + d / 6) % 1);
      if (k > 0.3) alpha(1 - a, () => ellipse(52, 110 + a * 60, 6, 9, P.bill2));
    }
  } else {
    const g = E.out(inv(0.2, 2.6, k));
    const hs = [lerp(50, 70, g), lerp(60, 90, g), lerp(70, 205, g)];
    hs.forEach((h, j) => {
      rrect(-95 + j * 70, 110 - h, 50, h, 8, j === 2 ? P.gold2 : '#c9b27a');
    });
    at(-95 + 140 + 25, 110 - hs[2] - 2, 0.3, 0, () => {
      ellipse(0, 0, 54, 9, P.ink); rrect(-33, -70, 66, 70, 5, P.ink); rect(-33, -16, 66, 11, P.red);
    });
  }
}

// ================================================================= 2. CANTILLON
function cantillonScene() {
  const t0 = HOOK.tOut; // coin starts flipping here
  const frame = { x: 560, y: 450, rx: 200, ry: 255 };
  const tFlip = t0 + 0.05, flipD = 1.1;
  const tBg = t0 + 0.25;
  const tSky = S('c1') + 0.1;
  const tParis = Wd('c1', 'paris'), tName = Wd('c1', 'richard'), tExp = Wd('c1', 'experiment');
  const tPrint = Wd('c2', 'printing'), tFortune = Wd('c2', 'fortune'), tNoticed = Wd('c2', 'noticed');
  const tNew = S('c3'), tPoint = Wd('c3', 'point'), tRipple = Wd('c3', 'ripples');
  const tLens = tNoticed + 0.1;
  const tDive = tNew - 0.2;
  CANT = { tRipple, lens: { x: 960, y: 540, r: 430 } };
  sfx(t0, 'whoosh', 0.8);
  sfx(tBg, 'morph', 0.7);
  sfx(tParis, 'pop', 0.5);
  sfx(tName, 'pop', 0.6);
  sfx(tExp - 0.2, 'rise', 0.6);
  sfx(tFortune, 'coins', 0.9);
  sfx(tLens, 'whoosh', 0.7);
  sfx(tDive, 'morph', 0.8);
  sfx(tPoint, 'ding', 0.8);
  for (let k = 0; k < 10; k++) sfx(tPrint + 0.2 + k * 0.55, 'press', 0.35);

  scene(t0, CANT_END(), t => {
    // background: parchment circle expanding from the coin
    const bgP = E.inOut(inv(tBg, tBg + 1.0, t));
    const coinPos = flipPos(t);
    if (bgP < 1) {
      circle(coinPos.x, coinPos.y, bgP * 2300, P.paper);
    } else {
      rect(0, 0, W, H, P.paper);
    }
    // sun / sky wash
    alpha(inv(tSky, tSky + 1, t), () => bgGlow(1320, 330, 700, '#f7c98b', 0.55));

    const diveP = E.inOut(inv(tDive, tDive + 1.1, t));
    // Paris skyline, press and portrait all live in a group that the lens "dives" through
    const groupA = 1 - inv(tDive + 0.1, tDive + 0.7, t);
    if (groupA > 0) alpha(groupA, () => {
      const sky = E.out(inv(tSky, tSky + 1.4, t));
      paris(sky, t);
      // label
      const la = inv(tParis, tParis + 0.4, t);
      if (la > 0) {
        text('PARIS', 1540, 150, { size: 64, weight: 700, fam: 'hand', color: P.plum, a: la });
        text('1720', 1540, 212, { size: 48, weight: 800, ls: 8, color: P.coral2, a: inv(tParis + 0.2, tParis + 0.6, t) });
      }
      // press
      const ps = pop(t, tExp - 0.2, 0.6);
      if (ps > 0) at(1370, 930, ps * 1.35, 0, () => screwPress(t, tPrint));
      const pl = inv(tPrint + 0.6, tPrint + 1.0, t);
      if (pl > 0) at(1700, 380, 1, -0.08, () => {
        text('paper money!', 0, 0, { size: 60, fam: 'hand', weight: 700, color: P.coral2, a: pl });
        alpha(pl, () => { strokePartial(bezierPts([-40, 34], [-80, 90], [-150, 110], [-210, 150], 30), pl, 5, P.coral2); });
      });
      // notes flying out of the press over the city
      if (t > tPrint) {
        for (let i = 0; i < 70; i++) {
          const te = tPrint + 0.25 + i * 0.13 * (1 - Math.min(0.5, i / 140));
          const a = t - te;
          if (a < 0 || a > 5) continue;
          const b = billPath(i + 500, te, t, 1370, 690, 1.1);
          alpha(clamp(a * 6), () => at(b.x, b.y, 1, b.rot, () => {
            ctx.scale(1, Math.max(0.1, Math.abs(Math.cos(b.flip))));
            livre(90);
          }));
        }
      }
    });
    // portrait frame (coin -> oval), stays until the dive
    if (groupA > 0) alpha(groupA, () => {
      const fp = flipPos(t);
      at(fp.x, fp.y, 1, 0, () => {
        ctx.scale(fp.sx, 1);
        if (fp.face === 'coin') coin(fp.r);
        else portrait(fp.rx, fp.ry, t, t > tFortune + 0.3 && t < tFortune + 1.2);
      });
      // name plate
      const np = pop(t, tName, 0.5);
      if (np > 0) at(frame.x, frame.y + frame.ry + 70, np, 0, () => {
        rrect(-200, -44, 400, 88, 14, P.navy);
        text('RICHARD CANTILLON', 0, -10, { size: 30, weight: 800, ls: 4, color: P.cream });
        text('banker · c. 1680 – 1734', 0, 24, { size: 22, weight: 600, color: P.gold });
      });
      // pile of coins for "made a fortune"
      for (let i = 0; i < 9; i++) {
        const ci = pop(t, tFortune + i * 0.07, 0.4);
        if (ci <= 0) continue;
        const col = i < 5 ? 0 : i < 8 ? 1 : 2;
        const row = i < 5 ? i : i < 8 ? i - 5 : 0;
        at(frame.x - 300 + col * 0 + (col === 1 ? 70 : col === 2 ? 140 : 0), 905 - row * 16 - (1 - ci) * 80, 1, 0, () => {
          ellipse(0, 8, 46, 14, P.gold2);
          ellipse(0, 0, 46, 14, P.gold);
        });
      }
      if (t > tFortune) for (let k = 0; k < 5; k++) {
        const sp = inv(tFortune + 0.2 + k * 0.15, tFortune + 0.7 + k * 0.15, t);
        if (sp > 0 && sp < 1) sparkle(frame.x - 290 + rr(k, 2, -60, 160), 820 + rr(k, 3, -60, 40), 22 * Math.sin(sp * Math.PI), P.gold3, sp);
      }
    });

    // magnifying lens: appears on "noticed", then grows into the diagram circle
    const lensIn = pop(t, tLens, 0.6);
    if (lensIn > 0) {
      const L = CANT.lens;
      const lx = lerp(1180, L.x, diveP), ly = lerp(430, L.y, diveP);
      const lr = lerp(95, L.r, diveP);
      const wig = (1 - diveP) * Math.sin(t * 2.2) * 18;
      at(lx + wig, ly, lensIn, 0, () => {
        // lens interior: economy of dots
        circle(0, 0, lr, mix('#fff7e6', P.cream, diveP));
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, lr, 0, TAU); ctx.clip();
        dotEconomy(t, lr, diveP, tPoint, tRipple, Wd('c3', 'spread'), Wd('c3', 'enters'));
        ctx.restore();
        ring(0, 0, lr, lerp(16, 12, diveP), P.ink);
        alpha(1 - diveP, () => at(0, 0, lr / 95, 0, () => line(66, 66, 150, 150, 26, P.brown2)));
      });
    }
    // captions for c3
    if (t > tNew - 0.1) {
      const o = CANT_OUT - 0.4;
      const tEnters = Wd('c3', 'enters');
      kinetic("New money doesn't spread *evenly*", 960, 66, t, [Wd('c3', 'new'), Wd('c3', 'money'), Wd('c3', "doesn't"), Wd('c3', 'spread'), Wd('c3', 'evenly')], { size: 58, fam: 'serif', weight: 800, color: P.ink, accent: P.coral2, out: tEnters - 0.35 });
      kinetic('It enters at *one* point…', 960, 66, t, [tEnters - 0.05, tEnters + 0.1, Wd('c3', 'one'), tPoint], { size: 58, fam: 'serif', weight: 800, color: P.ink, accent: P.coral2, out: o });
      const ra = inv(tRipple, tRipple + 0.4, t) * (1 - inv(o, o + 0.3, t));
      text('…and ripples outward', 960, 1026, { size: 58, fam: 'hand', weight: 700, color: P.plum, a: ra });
      // "evenly?" myth: every dot lights at once, then gets crossed out
      const ev = Wd('c3', 'evenly');
      const xa = inv(ev + 0.1, ev + 0.45, t) * (1 - inv(tEnters - 0.4, tEnters - 0.1, t));
      if (xa > 0) alpha(1 - inv(tEnters - 0.4, tEnters - 0.1, t), () => {
        scribble(700, 300, 1220, 790, inv(ev + 0.1, ev + 0.35, t), 22, P.coral2, 5, 1);
        scribble(1220, 300, 700, 790, inv(ev + 0.3, ev + 0.55, t), 22, P.coral2, 5, 2);
      });
    }
  });
  // coin flip -> portrait frame
  function flipPos(t) {
    const p = inv(tFlip, tFlip + flipD, t);
    const e = E.inOut(p);
    const ang = e * Math.PI * 3; // 1.5 turns -> ends showing the back (portrait)
    const c = HOOK.coin;
    const x = lerp(c.x, frame.x, e), y = lerp(c.y, frame.y, e);
    const r = lerp(c.r, (frame.rx + frame.ry) / 2, e);
    const face = Math.cos(ang) > 0 && p < 0.5 ? 'coin' : Math.cos(ang) < 0 ? (p > 0.5 ? 'portrait' : 'coin') : 'portrait';
    return { x, y, sx: Math.max(0.02, Math.abs(Math.cos(ang))), face: p < 0.5 ? 'coin' : 'portrait', r, rx: lerp(c.r, frame.rx, e), ry: lerp(c.r, frame.ry, e) };
  }
}
let CANT = {}, CANT_OUT = 0;
function CANT_END() { CANT_OUT = Eend('c3') + 0.15; return CANT_OUT; }

function livre(w = 90) {
  const h = w * 0.62;
  rrect(-w / 2, -h / 2, w, h, 4, '#f6ecd2');
  ctx.strokeStyle = '#b08850'; ctx.lineWidth = 3;
  ctx.strokeRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12);
  text('100', 0, -4, { size: w * 0.24, weight: 900, fam: 'serif', color: '#7a5530' });
  text('LIVRES', 0, h * 0.24, { size: w * 0.1, weight: 800, ls: 2, color: '#7a5530' });
}

function portrait(rx, ry, t, wink) {
  // frame
  ellipse(0, 0, rx + 22, ry + 22, P.gold2);
  ellipse(0, 0, rx + 12, ry + 12, P.gold);
  ellipse(0, 0, rx, ry, '#5f7f80');
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.clip();
  const s = rx / 190;
  ctx.scale(s, ry / 240 * 1);
  bgGlow(0, -40, 260, '#8fb3b0', 0.6);
  // coat
  ellipse(0, 230, 190, 150, '#3a2d3f');
  poly([[-40, 110], [40, 110], [0, 200]], '#2a2130');
  // wig back mass
  ellipse(0, 40, 118, 120, '#d9d4ca');
  // neck
  rect(-28, 40, 56, 60, P.skin1);
  // cravat
  ellipse(0, 112, 42, 26, '#f7f2e8');
  ellipse(-14, 136, 20, 30, '#ece5d6', 0.3);
  ellipse(14, 136, 20, 30, '#ece5d6', -0.3);
  // face
  ellipse(0, -18, 64, 80, P.skin1);
  // wig curls
  for (let k = 0; k < 4; k++) {
    circle(-80, -30 + k * 34, 26, k % 2 ? '#e9e5dc' : '#dcd6ca');
    circle(80, -30 + k * 34, 26, k % 2 ? '#e9e5dc' : '#dcd6ca');
  }
  ctx.fillStyle = '#eeeae1';
  ctx.beginPath(); ctx.ellipse(0, -78, 78, 52, 0, Math.PI, 0); ctx.fill();
  ellipse(0, -70, 72, 26, '#eeeae1');
  circle(-54, -76, 24, '#e4dfd4'); circle(54, -76, 24, '#e4dfd4');
  // features
  const bl = blinkAmt(t, 21);
  ellipse(-22, -20, 6, 7 * (1 - bl * 0.9), P.ink);
  if (wink) line(12, -20, 32, -20, 5, P.ink);
  else ellipse(22, -20, 6, 7 * (1 - bl * 0.9), P.ink);
  line(-34, -38, -12, -40, 4, '#9a8a78');
  line(34, -38, 12, -40, 4, '#9a8a78');
  ctx.strokeStyle = '#c98e62'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(8, 8, -2, 10); ctx.stroke();
  ctx.strokeStyle = P.ink;
  ctx.beginPath(); ctx.arc(0, 18, 16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  circle(-38, 8, 10, 'rgba(232,102,79,0.25)');
  circle(38, 8, 10, 'rgba(232,102,79,0.25)');
  ctx.restore();
  // frame shine
  ctx.save();
  ctx.strokeStyle = 'rgba(255,240,200,0.6)'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, 0, rx + 12, ry + 12, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}

function paris(p, t) {
  if (p <= 0) return;
  const off = (1 - p) * 420;
  ctx.save();
  ctx.translate(0, off);
  // far layer
  ctx.fillStyle = '#c9a9a6';
  ctx.beginPath();
  ctx.moveTo(0, 1080); ctx.lineTo(0, 760);
  const far = [[0, 760], [90, 740], [160, 760], [230, 720], [300, 745], [380, 700], [440, 730], [520, 690], [600, 720], [700, 700], [780, 730], [860, 680], [950, 715], [1040, 690], [1120, 725], [1220, 700], [1300, 730], [1400, 690], [1500, 720], [1600, 700], [1700, 730], [1800, 710], [1920, 735]];
  for (const q of far) ctx.lineTo(q[0], q[1]);
  ctx.lineTo(1920, 1080); ctx.closePath(); ctx.fill();
  // Notre-Dame-like towers
  const tower = (x, y, w, h, c) => { rect(x, y - h, w, h, c); };
  ctx.fillStyle = '#b08f94';
  tower(880, 760, 70, 190, '#b08f94'); tower(990, 760, 70, 190, '#b08f94'); rect(930, 660, 80, 100, '#b08f94');
  poly([[925, 620], [1015, 620], [970, 560]], '#b08f94');
  // dome
  ctx.fillStyle = '#a88a90'; ctx.beginPath(); ctx.arc(1580, 690, 70, Math.PI, 0); ctx.fill();
  rect(1530, 690, 100, 80, '#a88a90'); rect(1574, 590, 12, 40, '#a88a90');
  // near rooftops
  const roofs = [[0, 150], [150, 190], [320, 160], [470, 210], [640, 170], [780, 150], [1080, 180], [1240, 150], [1400, 200], [1560, 160], [1720, 190]];
  roofs.forEach(([x, h], i) => {
    const w = i === roofs.length - 1 ? 220 : (roofs[i + 1][0] - x);
    const y = 1080 - h;
    const c = i % 2 ? '#8f6f86' : '#7e6078';
    rect(x, y, w, h, c);
    poly([[x - 6, y + 2], [x + w / 2, y - 55], [x + w + 6, y + 2]], i % 2 ? '#6d5068' : '#5f4560');
    for (let k = 0; k < 3; k++) {
      const lit = rnd(i * 5 + k, 8) > 0.45;
      rrect(x + 22 + k * (w - 44) / 3, y + 30, 24, 34, 4, lit ? '#f6cf7a' : '#5b4458');
    }
    rect(x + w * 0.7, y - 70, 18, 40, '#5f4560');
  });
  ctx.restore();
}

function screwPress(t, tPrint) {
  const cyc = t > tPrint ? (Math.sin((t - tPrint) * 11.4 - Math.PI / 2) + 1) / 2 : 0;
  // frame
  rect(-150, -330, 34, 330, P.brown);
  rect(116, -330, 34, 330, P.brown);
  rrect(-170, -360, 340, 44, 10, P.brown2);
  rrect(-170, -120, 340, 36, 8, P.brown2);
  rect(-180, -20, 360, 20, P.brown2);
  // screw
  const py = -290 + cyc * 120;
  rect(-12, -316, 24, py + 316, '#6b5a4a');
  line(-90 + Math.cos(t * 6) * 20, py - 20, 90 - Math.cos(t * 6) * 20, py - 20, 12, '#4a3a2e');
  // platen
  rrect(-100, py, 200, 30, 6, '#5a4838');
  // paper on bed
  rrect(-90, -150, 180, 26, 4, '#f6ecd2');
}

function dotEconomy(t, r, diveP, tPoint, tRipple, tEven = 1e9, tEvenEnd = 1e9) {
  const sp = 70;
  const n = Math.ceil(r / sp) + 1;
  const ringR = Math.max(0, (t - tRipple) * 260);
  const even = inv(tEven, tEven + 0.3, t) * (1 - inv(tEvenEnd - 0.4, tEvenEnd, t));
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const x = i * sp + (j % 2 ? sp / 2 : 0), y = j * sp * 0.87;
    const d = Math.hypot(x, y);
    if (d > r - 30 || d < 1) continue;
    const lit = clamp((ringR - d) / 60);
    const pulse = lit > 0 && lit < 1 ? 1 + Math.sin(lit * Math.PI) * 0.5 : 1;
    const c = mix(mixHex('#b9ab96', P.gold, even), P.coral, lit);
    const s = pulse * clamp(diveP * 1.3 + 0.35) * (1 + even * 0.15);
    // tiny person glyph
    circle(x, y - 9 * s, 6.5 * s, c);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(x, y + 8 * s, 10 * s, 9 * s, 0, Math.PI, 0); ctx.fill();
  }
  for (let k = 0; k < 3; k++) {
    const rk = (t - tRipple - k * 0.45) * 260;
    if (rk > 0 && rk < r) ring(0, 0, rk, 6, rgba(P.coral, 0.75 * (1 - rk / r)));
  }
  const pp = pop(t, tPoint - 0.1, 0.5, 3);
  if (pp > 0) {
    bgGlow(0, 0, 90, P.gold, 0.6 * pp);
    circle(0, 0, 20 * pp, P.gold);
    circle(0, 0, 9 * pp, '#fff3c4');
  }
}

// ================================================================= 3. RIPPLE (top-down pond)
let POND = {};
function pondBlob(scale = 1) {
  const pts = [];
  for (let k = 0; k < NS; k++) {
    const a = -Math.PI / 2 + (k / NS) * TAU;
    const r = (440 + 16 * Math.sin(3 * a + 1) + 9 * Math.sin(5 * a + 2)) * scale;
    pts.push([Math.cos(a) * r * 1.12, Math.sin(a) * r]);
  }
  return pts;
}
const POND_PADS = [
  { d: 150, a: -2.4, r: 34 }, { d: 250, a: 2.6, r: 40 }, { d: 330, a: -0.9, r: 30 },
  { d: 360, a: 1.5, r: 36 }, { d: 210, a: -1.6, r: 28 }, { d: 300, a: 3.6, r: 32 },
];
// where the five cast members stand in the pond (pond-local coords)
const POND_SPOTS = [[80, 34], [190, -60], [300, 60], [400, -40], [535, 30]];
const PRICE_TAGS = [
  { x: -150, y: -120 }, { x: 120, y: 210 }, { x: -300, y: 150 }, { x: 330, y: -250 },
  { x: -380, y: -200 }, { x: 60, y: -330 }, { x: -60, y: 330 }, { x: 420, y: 160 },
];

function rippleScene() {
  const t0 = CANT_OUT;
  const tDrop = S('r1'), tImpact = Eend('r1') - 0.25;
  const tFirst = Wd('r2', 'closest'), tLast = Wd('r2', 'last');
  const tCoin = Wd('r3', 'money'), tCoinHit = tCoin + 0.55;
  const tStand = Wd('r3', 'where');
  const tTilt = Eend('r3') + 0.05;
  POND = { tTilt, tImpact, tCoinHit, tStand };
  sfx(t0 + 0.1, 'morph', 0.7);
  sfx(tImpact, 'splash', 1);
  sfx(tImpact + 0.05, 'drip', 0.6);
  sfx(tCoin + 0.1, 'whoosh_down', 0.6);
  sfx(tCoinHit, 'coin_splash', 1);
  CAST_ORDER.forEach((w, i) => sfx(tStand + 0.25 + i * 0.14, 'pop', 0.45));
  sfx(tTilt, 'swoosh_long', 0.9);

  scene(t0, tTilt, t => {
    const tp = E.inOut(inv(t0, t0 + 1.2, t)); // lens -> pond morph
    // grass background washes in (colour morph of the whole backdrop)
    rect(0, 0, W, H, mix(P.paper, P.grass, tp));
    ctx.save();
    ctx.translate(CX, CY);
    pondWorld(t, tp);
    ctx.restore();
    // "where you stand in that pond": the cast appears at different distances
    CAST_ORDER.forEach((who, i) => {
      const s = pop(t, tStand + 0.25 + i * 0.14, 0.5) * 0.4;
      if (s <= 0) return;
      const p = pondCastPos(i);
      at(p.x, p.y, s, 0, () => person({ who, seed: i + 11, look: [-5, 0] }, t));
    });
  });
}

// Draws the pond in pond-local coords (origin = pond centre). tp = morph-in 0..1.
function pondWorld(t, tp, flat = 0) {
  const P0 = POND;
  // grass texture
  alpha(tp, () => {
    for (let i = 0; i < 26; i++) {
      const x = rr(i, 1, -1000, 1000), y = rr(i, 2, -560, 560);
      if (Math.hypot(x / 1.12, y) < 560) continue;
      ellipse(x, y, rr(i, 3, 60, 160), rr(i, 4, 30, 70), P.grass2);
    }
    // trees (top-down)
    const trees = [[-820, -380, 90], [-700, 330, 110], [760, -360, 100], [860, 260, 120], [-900, 40, 70], [640, 420, 70]];
    trees.forEach(([x, y, r], i) => {
      ellipse(x + 18, y + 22, r, r * 0.95, 'rgba(0,0,0,0.12)');
      circle(x, y, r, '#5f9a50');
      circle(x - r * 0.25, y - r * 0.25, r * 0.6, '#72ad5c');
    });
    // rocks
    [[-560, -240], [590, 120], [-520, 300], [520, -300]].forEach(([x, y], i) => {
      ellipse(x, y, 34, 24, '#b8b2a4'); ellipse(x - 6, y - 6, 22, 14, '#cfc9bc');
    });
  });
  // lens (cream disc + ink ring) morphing into the pond
  const blob = pondBlob();
  const lens = circleS(0, 0, CANT.lens.r + 6);
  const shore = align(lens, pondBlob(1.07), 'shore');
  const water = align(lens, blob, 'water');
  fillS(morph(lens, shore, tp), mix(P.ink, P.sand, clamp(tp * 2)));
  const wS = morph(circleS(0, 0, CANT.lens.r - 6), water, tp);
  fillS(wS, mix(P.cream, P.water, tp));
  ctx.save();
  tracePath(wS);
  ctx.clip();
  alpha(tp, () => bgGlow(0, 0, 420, '#7fd0cf', 0.5));
  // leftover dots from the diagram shrink away
  if (tp < 1) alpha(clamp(1 - tp * 1.8), () => dotEconomy(t, CANT.lens.r, 1, -99, CANT.tRipple));
  // lily pads bob when a ripple passes
  const ringHit = (d, tSrc) => {
    const ta = tSrc + d / 115;
    const k = t - ta;
    return k > 0 && k < 0.9 ? Math.sin(k * Math.PI * 3) * (1 - k / 0.9) : 0;
  };
  POND_PADS.forEach((p, i) => {
    const b = ringHit(p.d, P0.tImpact) + ringHit(p.d, P0.tCoinHit);
    const x = Math.cos(p.a) * p.d * 1.12, y = Math.sin(p.a) * p.d;
    at(x, y, tp * (1 + b * 0.12), 0, () => {
      lilyPad(p.r, p.a * 2, i % 2 ? '#5fa35a' : '#6cb062');
      if (i === 1 || i === 4) { circle(p.r * 0.2, -p.r * 0.2, 9, '#f4a6b8'); circle(p.r * 0.2, -p.r * 0.2, 4, '#ffe08a'); }
    });
  });
  // pads the cast will stand on
  POND_SPOTS.forEach(([dx, dy], i) => {
    if (i === 4) return;
    const s = pop(t, P0.tStand + 0.1 + i * 0.14, 0.5);
    if (s > 0) at(dx * 1.12, dy + 30, s, 0, () => lilyPad(48, 1 + i, '#5fa35a'));
  });
  // ripples
  const rings = (tSrc, color, n, w) => {
    for (let k = 0; k < n; k++) {
      const r = (t - tSrc - k * 0.28) * 115;
      if (r <= 0 || r > 540) continue;
      ctx.save();
      ctx.scale(1.12, 1);
      ring(0, 0, r, w * (1 - r / 700), rgba(color, 0.85 * (1 - r / 560)));
      ctx.restore();
    }
  };
  rings(P0.tImpact, '#e9fbff', 4, 9);
  rings(P0.tCoinHit, P.gold, 4, 12);
  // price tags floating on the water flip when the golden ripple reaches them
  PRICE_TAGS.forEach((g, i) => {
    const d = Math.hypot(g.x / 1.12, g.y);
    const hitT = P0.tCoinHit + d / 115;
    const ap = pop(t, P0.tCoinHit - 0.6 + i * 0.05, 0.45);
    if (ap <= 0) return;
    const hit = inv(hitT, hitT + 0.25, t);
    const bob = Math.sin(t * 2 + i) * 4;
    at(g.x, g.y + bob, ap * 0.62, Math.sin(i) * 0.2, () => {
      priceTag(hit > 0.5 ? '$' + (2 + (i % 3)) : '$1', { w: 150, h: 70, size: 38, c: mix(P.white, '#ffd9cf', hit), hole: P.water, tc: hit > 0.5 ? P.coral2 : P.ink });
      if (hit > 0) at(-58, -48, E.back(hit), 0, () => upArrow(20, P.coral));
    });
  });
  ctx.restore();
  // falling drop (from the gold point) and falling coin
  const dropP = inv(P0.tImpact - 1.9, P0.tImpact, t);
  if (t < P0.tImpact) {
    const lift = E.out(inv(CANT_OUT, CANT_OUT + 0.9, t));
    const fall = E.in(dropP);
    const r = lerp(lerp(20, 58, lift), 16, fall);
    const sh = lerp(lerp(0, 60, lift), 0, fall);
    ellipse(sh * 0.8, sh, r * 0.8, r * 0.7, rgba('#1b4a55', 0.35 * lift));
    at(0, -sh * 0.4, 1, 0, () => {
      const col = mix(P.gold, '#dff6ff', lift);
      // teardrop pointing up
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.9 * lift - r * (1 - lift));
      ctx.bezierCurveTo(r * 0.9, -r * 0.6, r, 0, r, r * 0.1);
      ctx.arc(0, r * 0.1, r, 0, Math.PI);
      ctx.bezierCurveTo(-r, 0, -r * 0.9, -r * 0.6, 0, -r * 1.9 * lift - r * (1 - lift));
      ctx.fill();
      alpha(0.7, () => ellipse(-r * 0.35, -r * 0.1, r * 0.18, r * 0.32, '#ffffff', 0.3));
    });
  }
  // splash droplets
  const sp = t - P0.tImpact;
  if (sp > 0 && sp < 0.8) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + 0.3;
      const d = sp * 260;
      alpha(1 - sp / 0.8, () => circle(Math.cos(a) * d * 1.12, Math.sin(a) * d - Math.sin(sp / 0.8 * Math.PI) * 40, 9 * (1 - sp), '#e9fbff'));
    }
  }
  // gold coin dropping in
  if (t > P0.tCoinHit - 0.7 && t < P0.tCoinHit) {
    const f = E.in(inv(P0.tCoinHit - 0.7, P0.tCoinHit, t));
    const r = lerp(90, 30, f);
    ellipse(lerp(60, 0, f), lerp(70, 0, f), r * 0.8, r * 0.6, 'rgba(20,60,70,0.35)');
    at(0, 0, r / 40, f * 6, () => coin(40));
  }
  const cs = t - P0.tCoinHit;
  if (cs > 0 && cs < 0.8) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const d = cs * 300;
      alpha(1 - cs / 0.8, () => circle(Math.cos(a) * d * 1.12, Math.sin(a) * d - Math.sin(cs / 0.8 * Math.PI) * 50, 10 * (1 - cs), P.gold3));
    }
  }
  // labels
  const la = (t0, t1) => inv(t0, t0 + 0.3, t) * (1 - inv(t1, t1 + 0.3, t));
  const tF = Wd('r2', 'closest') + 0.2, tL = Wd('r2', 'last');
  const fa = la(tF, P0.tCoinHit - 0.8);
  if (fa > 0) {
    text('first', -150, -185, { size: 64, fam: 'hand', weight: 700, color: P.white, a: fa });
    alpha(fa, () => strokePartial(bezierPts([-150, -150], [-150, -110], [-120, -90], [-80, -70], 20), fa, 5, P.white));
  }
  const lb = la(tL - 0.1, P0.tCoinHit - 0.8);
  if (lb > 0) {
    text('last', 700, -300, { size: 64, fam: 'hand', weight: 700, color: P.ink, a: lb });
    alpha(lb, () => strokePartial(bezierPts([680, -265], [660, -220], [600, -200], [540, -180], 20), lb, 5, P.ink));
  }
  const pa = la(Wd('r3', 'rising') - 0.1, P0.tTilt - 0.5);
  if (pa > 0) {
    at(0, -470, 1, 0, () => {
      rrect(-330, -46, 660, 92, 46, rgba(P.navy, 0.85 * pa));
      kinetic('ripple = *rising prices*', 0, 2, t, [Wd('r3', 'ripple'), Wd('r3', 'is'), Wd('r3', 'rising'), Wd('r3', 'prices')], { size: 52, fam: 'serif', weight: 800, color: P.cream, accent: P.gold });
    });
  }
}
function pondCastPos(i) {
  const [dx, dy] = POND_SPOTS[i];
  return { x: CX + dx * 1.12, y: CY + dy + 30 };
}

// ================================================================= 4. TOWN
let TOWN = {};
const TOWN_X = i => 330 + i * 315;
const TOWN_FEET = 935, GROUND_Y = 862;
function townScene() {
  const tTilt = POND.tTilt;
  const tilt = t => E.inOut(inv(tTilt, tTilt + 1.5, t));
  const tSign = Wd('t1', 'loaf') - 0.2, tDollar = Wd('t1', 'dollar');
  const tStack = Wd('t2', 'stack'), tHanded = Wd('t2', 'handed'), tLine = Wd('t2', 'line');
  const tSpend = Wd('t3', 'spends'), tHire = Wd('t3', 'hiring'), tProp = Wd('t3', 'property'), tYest = Wd('t3', "yesterday's");
  const tNext = Wd('t4', 'gets'), tChase = Wd('t4', 'chasing'), tCreep = Wd('t4', 'creep'), tPay = Wd('t4', 'pay');
  const tShop = Wd('t5', 'reaches'), tBoom = Wd('t5', 'booming'), tFifty = Wd('t5', 'dollar') - 0.1;
  const tTeach = S('t6'), tInc = Wd('t6', 'incomes'), tTwo = Wd('t6', 'two') - 0.05;
  const tStole = S('t7'), tLaw = Wd('t7', 'law') - 0.5;
  const tWealth = Wd('t8', 'wealth'), tBack = Wd('t8', 'back'), tFront = Wd('t8', 'front');
  const tOut = Eend('t8') + 0.1;
  TOWN = { tOut };
  const prices = [[-1, '$1.00'], [tCreep, '$1.20'], [tFifty, '$1.50'], [tTwo, '$2.00']];
  sfx(tSign, 'drop', 0.8);
  sfx(tStack, 'sparkle', 0.8); sfx(tHanded, 'coins', 0.8);
  sfx(tLine, 'ding', 0.5);
  sfx(tHire, 'whoosh', 0.5); sfx(tProp, 'stamp', 0.7); sfx(tYest, 'ding', 0.5);
  sfx(tNext, 'whoosh', 0.5);
  prices.slice(1).forEach(([pt], k) => sfx(pt, 'flip', 0.8 + k * 0.1));
  sfx(tTwo + 0.05, 'thud', 0.8);
  sfx(tShop, 'whoosh', 0.5); sfx(tBoom, 'register', 0.8);
  sfx(tTeach, 'spot', 0.5);
  sfx(tStole + 0.1, 'pop', 0.6); sfx(tLaw, 'pop', 0.6);
  sfx(tWealth, 'rise', 0.7); sfx(tBack + 0.2, 'coins', 0.6);
  sfx(tOut, 'morph', 0.9);

  const priceAt = t => { let cur = prices[0], prev = null; for (const p of prices) if (t >= p[0]) { prev = cur; cur = p; } return { cur, prev }; };

  TOWN.tEnd = tOut + 1.5;
  scene(tTilt, TOWN.tEnd, t => {
    const k = tilt(t);
    const outP = E.inOut(inv(tOut, tOut + 1.3, t));
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, mixHex('#f7dcb4', P.slate, outP));
    sky.addColorStop(1, mixHex('#fbeedb', P.slate, outP));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    alpha(1 - outP, () => {
      circle(1640, 210, 80 * k, '#fbd58a');
      // hills
      const hill = (y, amp, c, ph) => {
        ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, GROUND_Y);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y - Math.sin(x / 300 + ph) * amp - (1 - k) * 400 * 0);
        ctx.lineTo(W, GROUND_Y); ctx.fill();
      };
      at(0, (1 - k) * 300, 1, 0, () => { hill(700, 40, '#cfe0b0', 0.5); hill(760, 30, '#b6d396', 2.1); });
      // houses rise from behind the ground
      townHouses(t, k, tProp);
    });

    // ground: squashed pond world during the tilt, then the flat ground
    if (k < 1) {
      ctx.save();
      const cy = lerp(CY, 1150, k), sx = lerp(1, 2.3, k), sy = lerp(1, 0.16, k);
      ctx.translate(CX, cy); ctx.scale(sx, sy);
      rect(-2000, -1812, 4000, 3624, P.grass);
      pondWorld(t, 1);
      ctx.restore();
    } else {
      const gp = outP;
      if (gp <= 0) {
        rect(0, GROUND_Y, W, H - GROUND_Y, P.grass);
        rect(0, 905, W, 90, '#e2cf9f');
        rect(0, 905, W, 8, '#d3bd88');
      }
    }
    // ground -> money pipe (vector merge into the next scene)
    if (outP > 0) {
      const g0 = rrectS(-40, GROUND_Y, W + 80, H - GROUND_Y + 40, 4);
      const pipe = align(g0, pipeShape(), 'groundpipe');
      fillS(morph(g0, pipe, outP), mix(P.grass, PIPE_EMPTY, outP));
    }

    // price sign
    const signIn = pop(t, tSign, 0.6, 1.6);
    const signOut = E.inBack(inv(tWealth - 0.6, tWealth - 0.1, t));
    if (signIn > 0 && signOut < 1) {
      const pc = priceAt(t);
      const flipP = inv(pc.cur[0], pc.cur[0] + 0.35, t);
      const shake = pc.cur[0] > 0 ? Math.sin((t - pc.cur[0]) * 30) * 0.05 * (1 - inv(pc.cur[0], pc.cur[0] + 0.7, t)) : 0;
      at(960, lerp(-200, 175, clamp(signIn)) - signOut * 420, 1, shake, () => priceSign(pc, flipP, t, tYest));
    }

    // queue order badges
    const badgeA = pop(t, tLine, 0.4) * (1 - inv(tWealth - 0.4, tWealth - 0.1, t));

    // cast
    CAST_ORDER.forEach((who, i) => {
      const p0 = pondCastPos(i);
      const ki = E.inOut(inv(tTilt + 0.1 + i * 0.06, tTilt + 1.3 + i * 0.06, t));
      const x = lerp(p0.x, TOWN_X(i), ki), y = lerp(p0.y, TOWN_FEET, ki);
      const s = lerp(0.4, 0.95, ki);
      const morphP = inv(tOut + i * 0.05, tOut + 1.2 + i * 0.05, t);
      const spot = inv(tTeach, tTeach + 0.4, t) * (1 - inv(tStole - 0.2, tStole + 0.2, t));
      const dim = i < 3 ? spot * 0.9 : 0;
      let expr = 'smile', look = [0, 0], armL = 0.12, armR = 0.12, hold = null, holdFront = null;
      if (t > tStack - 0.2 && t < tYest) look = i === 0 ? [0, -4] : [-6, 0];
      if (i === 0) {
        if (t > tHanded - 0.3) { armL = armR = 0.62 * E.out(inv(tHanded - 0.3, tHanded, t)) * (1 - inv(tSpend + 2.1, tSpend + 2.5, t)) + 0.12; expr = 'happy'; }
        const n = Math.round(lerp(9, 0, inv(tSpend, tSpend + 2.2, t)));
        if (t > tHanded && n > 0 && t < tSpend + 2.3) holdFront = () => at(0, -112, 1, 0, () => billStack(n, 104));
        if (t > tWealth) expr = 'smug';
      }
      if (i === 1 && t > tNext + 0.5) { expr = 'happy'; armR = lerp(0.12, 2.3, inv(tPay - 0.3, tPay, t)) * (1 - inv(tShop, tShop + 0.4, t)) + 0.12; if (t > tPay - 0.3 && t < tShop + 0.4) hold = () => at(60, -290, 1, 0.2, () => paycheck('+$')); }
      if (i === 2 && t > tBoom) expr = 'happy';
      if (i >= 3 && t > tTwo) expr = 'worried';
      if (i >= 3 && t > tTeach && t < tTwo) look = [0, -5];
      if (t > tWealth && i >= 3) expr = 'worried';
      const detailA = 1 - inv(0, 0.22, morphP);
      if (detailA > 0) alpha(detailA, () => at(x, y, s, 0, () => person({ who, seed: i + 11, expr, look, armL, armR, hold, holdFront, dim }, t)));
      if (morphP > 0) {
        const sil = xf(pathS(PERSON_SIL), x, y, s);
        const node = MODERN_NODES[i];
        const tgt = align(sil, circleS(node.x, node.y, node.r), 'town2node' + i);
        const sh = morph(sil, tgt, E.inOut(inv(0.08, 1, morphP)));
        fillS(sh, mix(CAST[who].top, NODE_FILL, inv(0.3, 1, morphP)), clamp(morphP * 6));
      }
      // label
      const la = inv(tTilt + 1.2, tTilt + 1.6, t) * (1 - inv(tOut - 0.3, tOut, t));
      const swapT = i === 0 ? tFront : i === 4 ? tBack : 1e9;
      const sw = inv(swapT - 0.1, swapT + 0.25, t);
      if (la > 0) text(CAST_LABEL[who], x, 1020, { size: 26, weight: 800, ls: 3, color: P.ink, a: la * (1 - sw) * (1 - spot * (i < 3 ? 0.6 : 0)) });
      if (sw > 0) text(i === 0 ? 'front of the line' : 'back of the line', x, 1024, { size: 46, fam: 'hand', weight: 700, color: P.coral2, a: sw * (1 - inv(tOut - 0.3, tOut, t)) });
      if (badgeA > 0) at(x, TOWN_FEET - 330, badgeA, 0, () => {
        circle(0, 0, 26, i === 0 ? P.gold : P.navy3);
        text(String(i + 1), 0, 2, { size: 28, weight: 900, color: i === 0 ? P.ink : P.cream });
      });
    });
    // "first in line" label
    const fl = inv(tLine, tLine + 0.35, t) * (1 - inv(tSpend + 1, tSpend + 1.3, t));
    if (fl > 0) at(TOWN_X(0) + 120, 560, 1, -0.06, () => {
      text('first in line!', 70, -30, { size: 56, fam: 'hand', weight: 700, color: P.coral2, a: fl });
      alpha(fl, () => strokePartial(bezierPts([-10, -10], [-40, 20], [-70, 20], [-90, 30], 20), fl, 5, P.coral2));
    });

    // new money appears from a sparkle cloud above the banker
    const bx = TOWN_X(0);
    const cloud = life(t, tStack - 0.2, tHanded - 0.1, 0.4, 0.3);
    if (cloud > 0) {
      for (let k2 = 0; k2 < 7; k2++) sparkle(bx + Math.cos(k2 + t * 2) * 90, 330 + Math.sin(k2 * 2 + t * 3) * 50, 20 * cloud, P.gold3, t + k2);
      const dropP = E.in(inv(tHanded - 0.5, tHanded, t));
      at(bx, lerp(330, TOWN_FEET - 112 * 0.95, dropP), cloud * 0.95, 0, () => billStack(9, 104));
    }

    // money flows along the line
    const flows = [
      { from: 0, to: 1, a: tHire - 0.2, b: tHire + 1.2, n: 5 },
      { from: 0, to: 'house', a: tProp - 0.3, b: tProp + 0.6, n: 4 },
      { from: 0, to: 1, a: tNext - 0.1, b: tNext + 1.4, n: 5 },
      { from: 1, to: 2, a: tShop - 0.2, b: tShop + 1.3, n: 5 },
      { from: 2, to: 'sign', a: tChase - 0.3, b: tChase + 1.2, n: 4 },
    ];
    flows.forEach((f, fi) => {
      for (let j = 0; j < f.n; j++) {
        const te = f.a + (j / f.n) * (f.b - f.a - 0.8);
        const a = (t - te) / 0.8;
        if (a < 0 || a > 1) continue;
        const x0 = TOWN_X(f.from), y0 = TOWN_FEET - 290;
        let x1, y1;
        if (f.to === 'house') { x1 = 560; y1 = 640; } else if (f.to === 'sign') { x1 = 900; y1 = 230; } else { x1 = TOWN_X(f.to); y1 = TOWN_FEET - 250; }
        const u = E.sine(a);
        flyingBill(lerp(x0, x1, u), lerp(y0, y1, u) - Math.sin(u * Math.PI) * 180, a * 4 + j, a * 8 + j, 70, 1);
      }
    });

    // incomes haven't changed: cards over teacher & retiree
    for (const i of [3, 4]) {
      const ca = life(t, tInc - 0.2, tStole - 0.3, 0.5, 0.3);
      if (ca <= 0) continue;
      const lost = inv(tTwo + 0.1, tTwo + 0.5, t);
      at(TOWN_X(i), 470, ca, 0, () => {
        rrect(-125, -70, 250, 140, 18, P.white);
        text('$4', -70, 0, { size: 58, weight: 900, fam: 'serif', color: P.ink });
        text('buys', 12, -48, { size: 18, weight: 700, color: P.grey2, ls: 2 });
        for (let q = 0; q < 4; q++) {
          const gone = q >= 2 ? lost : 0;
          at(8 + (q % 2) * 70, -12 + Math.floor(q / 2) * 44, 0.42, 0, () => alpha(1 - gone * 0.75, () => bread(1)));
          if (gone > 0) at(8 + (q % 2) * 70, -12 + Math.floor(q / 2) * 44, E.back(gone), 0, () => crossMark(34, P.coral2, 7));
        }
        poly([[-14, 70], [14, 70], [0, 90]], P.white);
      });
    }
    const half = inv(tTwo + 0.5, tTwo + 0.8, t) * (1 - inv(tStole - 0.3, tStole, t));
    if (half > 0) text('same income, half the bread', (TOWN_X(3) + TOWN_X(4)) / 2, 345, { size: 50, fam: 'hand', weight: 700, color: P.coral2, a: half });

    // nobody stole anything / broke the law
    const n1 = life(t, tStole + 0.05, tWealth - 0.4, 0.5, 0.3), n2 = life(t, tLaw, tWealth - 0.4, 0.5, 0.3);
    if (n1 > 0) at(620, 330, n1, -0.05, () => noSign(() => moneySack(), 'no theft'));
    if (n2 > 0) at(1300, 330, n2, 0.05, () => noSign(() => gavel(), 'no crime'));

    // wealth bars + transfer arrow
    const wb = inv(tWealth - 0.2, tWealth + 0.3, t) * (1 - inv(tOut, tOut + 0.4, t));
    if (wb > 0) {
      const g = E.inOut(inv(tWealth + 0.2, tFront + 0.6, t));
      const target = [285, 150, 100, 45, 40];
      const base = 585;
      target.forEach((h1, i) => {
        const h = lerp(100, h1, g) * E.out(wb);
        const x = TOWN_X(i);
        rrect(x - 36, base - h, 72, h, 10, i === 0 ? P.gold : i < 3 ? '#e9c870' : '#d9b980');
        alpha(wb, () => rect(x - 40, base, 80, 5, P.ink));
      });
      const arr = bezierPts([TOWN_X(4) - 20, 500], [1500, 160], [500, 160], [TOWN_X(0) + 70, 272], 80);
      const ap = inv(tBack - 0.2, tFront + 0.3, t);
      alpha(wb, () => {
        strokePartial(arr, ap, 16, P.coral2, [2, 26]);
        if (ap > 0.97) arrowHead(TOWN_X(0) + 70, 272, 2.5, 30, P.coral2);
      });
      for (let j = 0; j < 8; j++) {
        const u = ((t - tBack) * 0.45 + j / 8) % 1;
        if (t > tBack && u < ap) { const q = pointAlong(arr, u); at(q[0], q[1], 0.45 * wb, 0, () => coin(40)); }
      }
      text('wealth quietly moves', 960, 150, { size: 64, fam: 'hand', weight: 700, color: P.coral2, a: inv(tWealth + 0.3, tWealth + 0.7, t) * wb });
    }
  });
}

function townHouses(t, k, tProp) {
  const hs = [
    { x: 150, w: 190, h: 150, body: '#f3e3c3', roof: '#c96f5a' },
    { x: 560, w: 220, h: 170, body: '#e8d3b0', roof: P.plum2, sold: true },
    { x: 1360, w: 200, h: 160, body: '#f6e6c8', roof: P.teal },
    { x: 1760, w: 210, h: 140, body: '#efdcbc', roof: '#c96f5a' },
  ];
  hs.forEach((h, i) => {
    const rise = E.back(inv(POND.tTilt + 0.9 + i * 0.1, POND.tTilt + 1.5 + i * 0.1, t), 1.4);
    at(h.x, GROUND_Y + (1 - rise) * 330, 1, 0, () => house({ w: h.w, h: h.h, body: h.body, roof: h.roof }));
    if (h.sold) {
      const s = pop(t, tProp, 0.4, 2.5);
      if (s > 0) at(h.x - 80, GROUND_Y - 40, s, -0.12, () => {
        rect(-4, 0, 8, 60, P.brown2);
        rrect(-70, -40, 140, 60, 8, P.coral2);
        text('SOLD', 0, -9, { size: 32, weight: 900, color: P.white, ls: 3 });
      });
    }
  });
  // bakery (centre)
  const rise = E.back(inv(POND.tTilt + 1.0, POND.tTilt + 1.6, t), 1.4);
  at(960, GROUND_Y + (1 - rise) * 330, 0.9, 0, () => {
    storefront();
    text('BAKERY', 0, -186, { size: 22, weight: 900, color: P.white, ls: 4 });
  });
}

function priceSign(pc, flipP, t, tOld) {
  line(-170, -95, -120, -210, 5, P.brown2);
  line(170, -95, 120, -210, 5, P.brown2);
  rrect(-270, -105, 540, 210, 18, P.brown);
  rrect(-256, -91, 512, 182, 10, '#2f4a43');
  at(-150, 10, 1.05, 0, () => bread(1));
  text('BREAD', 70, -52, { size: 26, weight: 800, ls: 8, color: rgba(P.cream, 0.75) });
  ctx.save();
  ctx.beginPath(); ctx.rect(-80, -38, 330, 118); ctx.clip();
  const up = pc.cur[0] > 0;
  if (pc.prev && flipP < 1 && up) text(pc.prev[1], 88, 22 - E.inOut(flipP) * 110, { size: 100, weight: 900, fam: 'serif', color: P.cream });
  const col = up ? mix(P.coral, P.cream, inv(0.4, 1.6, flipP * 0 + clamp((t - pc.cur[0]) / 1.2))) : P.cream;
  text(pc.cur[1], 88, 22 + (up ? (1 - E.out(flipP)) * 110 : 0), { size: 100, weight: 900, fam: 'serif', color: col });
  ctx.restore();
  const oa = inv(tOld, tOld + 0.3, t) * (1 - inv(tOld + 2.2, tOld + 2.5, t));
  if (oa > 0) at(0, 160, oa, -0.04, () => text('yesterday\'s price ✓', 0, 0, { size: 48, fam: 'hand', weight: 700, color: P.green2 }));
}

function paycheck(label) {
  rrect(-60, -34, 120, 68, 8, P.white);
  rect(-60, -34, 120, 16, P.green);
  text(label, 0, 12, { size: 30, weight: 900, color: P.green2 });
}
function moneySack() {
  ctx.fillStyle = '#b4875a';
  ctx.beginPath(); ctx.ellipse(0, 18, 52, 46, 0, 0, TAU); ctx.fill();
  poly([[-18, -28], [18, -28], [26, -48], [-26, -48]], '#b4875a');
  rect(-22, -30, 44, 8, P.brown2);
  text('$', 0, 22, { size: 48, weight: 900, fam: 'serif', color: '#7a5530' });
}
function gavel() {
  ctx.save();
  ctx.rotate(-0.6);
  rrect(-8, -10, 16, 90, 6, P.brown);
  rrect(-46, -40, 92, 40, 10, P.brown2);
  rect(-50, -36, 10, 32, '#caa27a');
  rect(40, -36, 10, 32, '#caa27a');
  ctx.restore();
  rrect(-40, 50, 80, 16, 6, P.brown2);
}
function noSign(icon, label) {
  circle(0, 0, 90, P.white);
  icon();
  ring(0, 0, 84, 14, P.coral2);
  line(-58, -58, 58, 58, 14, P.coral2);
  text(label, 0, 130, { size: 50, fam: 'hand', weight: 700, color: P.ink });
}

// ================================================================= 5. MODERN (pipeline)
const MODERN_NODES = [230, 590, 960, 1330, 1690].map((x, i) => ({ x, y: 470, r: 108 }));
function pipeShape() {
  const top = [], bot = [];
  for (let k = 0; k <= 40; k++) {
    const u = k / 40;
    const x = lerp(140, 1780, u);
    const th = lerp(46, 7, Math.pow(u, 0.8));
    top.push([x, 470 - th]);
    bot.push([x, 470 + th]);
  }
  return polyS(top.concat(bot.reverse()));
}
const PIPE_EMPTY = '#3b4966', NODE_FILL = '#f4ecdc';
const NODE_INFO = [
  { label: 'CENTRAL BANK', sub: 'creates money' },
  { label: 'BANKS & GOV’T', sub: 'lend · spend' },
  { label: 'ASSETS', sub: 'stocks · real estate' },
  { label: 'BUSINESSES', sub: 'goods · services' },
  { label: 'WAGES', sub: 'workers · savers' },
];
function nodeIcon(i, t, k) {
  if (i === 0) at(0, 58, 0.52, 0, () => bankBuilding({ c: P.navy3, d: P.navy3, sym: P.gold2 }));
  else if (i === 1) at(0, 58, 0.5, 0, () => capitol({ c: P.navy3, d: P.navy3 }));
  else if (i === 2) {
    at(-18, -8, 0.55, 0, () => chartIcon(1, { c: P.teal }));
    at(46, 58, 0.36, 0, () => house({ w: 150, h: 110, body: P.coral, roof: P.navy3 }));
  } else if (i === 3) at(0, 58, 0.52, 0, () => storefront({ c: '#e6d7bb' }));
  else at(0, 96, 0.42, 0, () => person({ who: 'you', seed: 51, noShadow: true, expr: k > 0.5 ? 'worried' : 'smile' }, t));
}

// ================================================================= 5. MODERN
function modernScene() {
  const t0 = TOWN.tEnd;
  const tToday = Wd('m1', "today's");
  const tCentral = Wd('m2', 'central'), tComm = Wd('m2', 'commercial'), tLoan = Wd('m2', 'loan');
  const tFirst = Wd('m3', 'first'), tCheap = Wd('m3', 'cheaply'), tBuy = Wd('m3', 'buy'), tBefore = Wd('m3', 'before');
  const tRise = Wd('m4', 'rise'), tTrick = Wd('m4', 'trickles'), tWages = Wd('m4', 'wages'), tLast = Wd('m4', 'last');
  const tChart = S('m5') - 0.4;
  const t2020 = Wd('m5', 'twenty'), tTril = Wd('m5', 'trillions'), tRecord = Wd('m5', 'record');
  const tYear = S('m6'), tGroc = Wd('m6', 'groceries'), tRent = Wd('m6', 'rent'), tAnd = Wd('m6', 'wages'), tBehind = Wd('m6', 'fell');
  const tOut = Eend('m6') + 0.1;
  MODERN = { tOut };
  const iconT = [0, 1, 2, 3, 4].map(i => t0 + 0.05 + i * 0.12);
  iconT.forEach(x => sfx(x, 'pop', 0.4));
  sfx(tCentral, 'coins', 0.7); sfx(tComm, 'ding', 0.5); sfx(tLoan, 'stamp', 0.6);
  sfx(tFirst, 'flow', 0.8, { dur: 1.2 }); sfx(tCheap, 'pop', 0.6); sfx(tBuy, 'flow', 0.7, { dur: 1.0 });
  sfx(tRise, 'rise', 0.8); sfx(tTrick, 'flow', 0.5, { dur: 1.0 }); sfx(tWages, 'drip', 0.7); sfx(tLast, 'thud', 0.8);
  sfx(tChart, 'morph', 0.9); sfx(tRecord, 'ding', 0.7); sfx(tGroc, 'pop', 0.6); sfx(tRent, 'pop', 0.6); sfx(tBehind, 'thud', 0.6);
  sfx(tOut, 'morph', 0.8);

  // the money "front" travelling along the pipe
  const frontX = t => {
    const keys = [[tCentral - 0.3, 140], [tCentral + 0.4, 250], [tFirst, 250], [tFirst + 1.1, 600], [tBuy, 600], [tBuy + 1.0, 970], [tTrick, 970], [tTrick + 1.2, 1340], [tWages - 0.2, 1340], [tWages + 1.2, 1780]];
    if (t <= keys[0][0]) return 0;
    for (let k = 1; k < keys.length; k++) if (t < keys[k][0]) return lerp(keys[k - 1][1], keys[k][1], E.inOut(inv(keys[k - 1][0], keys[k][0], t)));
    return 1780;
  };
  const pipe = pipeShape();
  const chartP = t => E.inOut(inv(tChart, tChart + 1.3, t));

  scene(t0, tOut + 1.6, t => {
    rect(0, 0, W, H, P.slate);
    const cp = chartP(t);
    const outP = E.inOut(inv(tOut, tOut + 1.3, t));
    // subtle grid
    alpha(0.06 * (1 - outP), () => { for (let x = 0; x < W; x += 80) rect(x, 0, 2, H, P.cream); for (let y = 0; y < H; y += 80) rect(0, y, W, 2, P.cream); });
    if (cp < 1) alpha(clamp(1 - cp * 2.2), () => pipeline(t));
    if (cp > 0) moneyChart(t, cp, outP);
    // header
    kinetic("TODAY'S WORLD", 960, 110, t, [tToday - 0.3, tToday], { size: 44, weight: 800, ls: 12, color: P.gold, out: tChart - 0.3 });
  });

  function pipeline(t) {
    const fx = frontX(t);
    // empty pipe + filled part
    const cpp = chartP(t);
    if (cpp <= 0) fillS(pipe, PIPE_EMPTY);
    if (fx > 0 && cpp <= 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, fx, H); ctx.clip();
      fillS(pipe, P.gold);
      // flowing stripes
      ctx.save(); tracePath(pipe); ctx.clip();
      for (let k = -2; k < 40; k++) {
        const x = ((t * 160) % 60) + k * 60;
        alpha(0.35, () => poly([[x, 400], [x + 18, 400], [x - 12, 540], [x - 30, 540]], P.gold3));
      }
      ctx.restore();
      ctx.restore();
      // bills riding the flow, thinning out downstream
      for (let j = 0; j < 36; j++) {
        const speed = 260;
        const x = 140 + ((t * speed + j * 97) % 1700);
        if (x > fx) continue;
        const keep = x < 600 ? 1 : x < 970 ? 0.75 : x < 1340 ? 0.4 : 0.15;
        if (rnd(j, 12) > keep) continue;
        flyingBill(x, 470 + Math.sin(t * 3 + j) * 10, Math.sin(j) * 0.4, t * 3 + j, 58, 0.95);
      }
    }
    // nodes
    MODERN_NODES.forEach((n, i) => {
      const reached = fx >= n.x - 20;
      const glow = i === 0 ? pop(t, tCentral - 0.1, 0.5) : i === 1 ? Math.max(pop(t, tComm, 0.5), reached ? 1 : 0) : reached ? 1 : 0;
      if (glow > 0) bgGlow(n.x, n.y, 190, P.gold, 0.45 * clamp(glow));
      const pulse = 1 + 0.06 * Math.sin(clamp((t - (i === 0 ? tCentral : i === 1 ? tComm : 0)) * 6) * Math.PI) * (i < 2 ? 1 : 0);
      at(n.x, n.y, pulse, 0, () => {
        circle(0, 0, n.r, NODE_FILL);
        ring(0, 0, n.r - 4, 8, reached && fx > 0 ? P.gold : P.navy3);
        const ip = pop(t, iconT[i], 0.5);
        if (ip > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(0, 0, n.r - 10, 0, TAU); ctx.clip();
          at(0, 0, ip, 0, () => nodeIcon(i, t, inv(tLast, tLast + 0.3, t)));
          ctx.restore();
        }
      });
      const la = inv(iconT[i] + 0.2, iconT[i] + 0.6, t);
      text(NODE_INFO[i].label, n.x, 632, { size: 27, weight: 800, ls: 3, color: P.cream, a: la });
      text(NODE_INFO[i].sub, n.x, 670, { size: 22, weight: 600, color: rgba(P.cream, 0.6), a: la });
    });
    // money created: coins burst at the central bank; loan paper at the banks
    for (let k = 0; k < 8; k++) {
      const a = t - tCentral - k * 0.08;
      if (a > 0 && a < 1) at(230 + Math.cos(k * 0.8 - 2.2) * a * 190, 470 + Math.sin(k * 0.8 - 2.2) * a * 190 + a * a * 120, 0.5 * (1 - a * 0.3), a * 5, () => alpha(1 - a, () => coin(36)));
    }
    const lp = life(t, tLoan - 0.1, tFirst + 1.5, 0.5, 0.3);
    if (lp > 0) at(700, 285, lp, 0.1, () => {
      rrect(-70, -85, 140, 170, 8, P.white);
      text('LOAN', 0, -52, { size: 28, weight: 900, ls: 4, color: P.navy3 });
      for (let q = 0; q < 4; q++) rect(-48, -20 + q * 22, 96 - (q % 2) * 30, 8, '#d4ccbb');
      text('$', 38, 62, { size: 36, weight: 900, fam: 'serif', color: P.green2 });
    });
    const cheap = life(t, tCheap - 0.1, tRise - 0.4, 0.5, 0.3);
    if (cheap > 0) at(590, 250, cheap, -0.05, () => {
      rrect(-150, -40, 300, 80, 40, P.teal);
      text('cheap loans', 0, 3, { size: 44, fam: 'hand', weight: 700, color: P.white });
    });
    const up = life(t, tRise - 0.1, tChart, 0.5, 0.3);
    if (up > 0) at(960, 250, up, 0, () => {
      rrect(-140, -40, 280, 80, 40, P.coral);
      text('prices', -26, 3, { size: 44, fam: 'hand', weight: 700, color: P.white });
      at(80, 2, 0.8, 0, () => upArrow(30, P.white));
    });
    const wait = life(t, tBefore - 0.1, tWages, 0.5, 0.3);
    if (wait > 0) at(1690, 280, wait, 0.04, () => text('…still waiting', 0, 0, { size: 50, fam: 'hand', weight: 700, color: P.sky }));
    const last = pop(t, tLast - 0.05, 0.3, 3);
    if (last > 0) at(1690, 280, lerp(1.8, 1, clamp(last)), -0.12, () => {
      rrect(-100, -44, 200, 88, 12, 'rgba(0,0,0,0)');
      ctx.strokeStyle = P.coral; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.roundRect(-100, -44, 200, 88, 12); ctx.stroke();
      text('LAST', 0, 4, { size: 54, weight: 900, ls: 6, color: P.coral });
    });
    // first -> last axis
    const ax = inv(tFirst - 0.2, tFirst + 0.6, t);
    if (ax > 0) {
      const g = ctx.createLinearGradient(230, 0, 1690, 0);
      g.addColorStop(0, P.gold); g.addColorStop(1, rgba(P.cream, 0.25));
      ctx.save(); ctx.globalAlpha *= ax;
      ctx.fillStyle = g; ctx.fillRect(230, 800, 1420 * ax, 8);
      arrowHead(230 + 1420 * ax + 14, 804, 0, 26, rgba(P.cream, 0.35));
      text('FIRST to get new money', 230, 850, { size: 28, weight: 800, ls: 3, color: P.gold, align: 'left' });
      text('LAST', 1690, 850, { size: 28, weight: 800, ls: 3, color: rgba(P.cream, 0.7), align: 'right' });
      ctx.restore();
    }
  }

  // --- the 2020 chart
  const X0 = 250, X1 = 1440, Y0 = 820, Y1 = 250;
  const yr = u => lerp(X0, X1, (u - 2020) / 4);
  const val = v => lerp(Y0, Y1, (v - 75) / 75);
  const SERIES = [
    { name: 'New money', c: '#7cc67f', node: 0, pts: [[2020, 100], [2020.2, 104], [2020.35, 115], [2020.5, 119], [2021, 125], [2021.5, 133], [2022, 140], [2022.5, 141], [2023, 139], [2023.5, 137], [2024, 137]] },
    { name: 'Stocks', c: P.gold, node: 2, pts: [[2020, 100], [2020.15, 93], [2020.22, 79], [2020.35, 92], [2020.5, 99], [2020.62, 108], [2020.8, 104], [2021, 116], [2021.5, 132], [2022, 146], [2022.4, 123], [2022.8, 112], [2023, 118], [2023.5, 136], [2024, 146]] },
    { name: 'Prices', c: P.coral, node: 3, pts: [[2020, 100], [2020.3, 99.5], [2020.6, 100.5], [2021, 101.5], [2021.3, 103.8], [2021.6, 106.2], [2022, 109], [2022.5, 114.5], [2023, 115.8], [2023.5, 118], [2024, 119.5]] },
    { name: 'Wages', c: '#6fd0c4', node: 4, pts: [[2020, 100], [2020.5, 103.4], [2021, 104.4], [2021.5, 105.5], [2022, 107.4], [2022.5, 109.8], [2023, 112.3], [2023.5, 114.8], [2024, 117.3]] },
  ];
  const sample = (pts, u) => {
    for (let k = 1; k < pts.length; k++) if (u <= pts[k][0]) {
      const a = pts[k - 1], b = pts[k];
      return lerp(a[1], b[1], E.sine(inv(a[0], b[0], u)));
    }
    return pts[pts.length - 1][1];
  };
  const linePts = (sr, uEnd) => {
    const o = [];
    for (let u = 2020; u <= uEnd + 1e-6; u += 0.02) o.push([yr(u), val(sample(sr.pts, u))]);
    return o;
  };
  const cursor = t => {
    const keys = [[t2020, 2020], [tRecord + 0.5, 2020.75], [tYear, 2021], [tGroc + 1.6, 2022.4], [tAnd, 2022.6], [tBehind + 1.4, 2023.6], [tOut, 2023.7]];
    if (t <= keys[0][0]) return 2020;
    for (let k = 1; k < keys.length; k++) if (t < keys[k][0]) return lerp(keys[k - 1][1], keys[k][1], E.inOut(inv(keys[k - 1][0], keys[k][0], t)));
    return 2023.7;
  };
  MODERN.wageEnd = t => { const u = cursor(t); return [yr(u), val(sample(SERIES[3].pts, u))]; };

  function moneyChart(t, cp, outP) {
    const u = cursor(t);
    // pipe collapses into the x axis
    const axis = rrectS(X0, Y0 - 3, X1 - X0, 6, 3);
    const pipeA = align(axis, pipe, 'axispipe');
    const ax = morph(pipeA, axis, cp);
    const fadeAll = 1 - outP;
    fillS(ax, mix(P.gold, P.cream, cp), fadeAll);
    alpha(cp * fadeAll, () => {
      rect(X0 - 3, Y1 - 20, 6, Y0 - Y1 + 20, rgba(P.cream, 0.5));
      for (let y = 2020; y <= 2024; y++) {
        const x = yr(y);
        rect(x - 1, Y0, 2, 14, rgba(P.cream, 0.6));
        if (y < 2024) text(String(y), x + (yr(y + 1) - x) / 2, Y0 + 40, { size: 26, weight: 700, color: rgba(P.cream, 0.75) });
      }
      alpha(0.08, () => { for (let y = 2021; y < 2024; y++) rect(yr(y) - 1, Y1, 2, Y0 - Y1, P.cream); });
      text('Illustrative, stylized from U.S. data 2020–2023: M2 money supply, S&P 500, CPI, average hourly earnings', X0, 900, { size: 18, weight: 500, color: rgba(P.cream, 0.45), align: 'left' });
    });
    // year counter
    alpha(inv(t2020 - 0.2, t2020 + 0.2, t) * fadeAll, () => text(String(Math.floor(u)), X0 + 20, Y1 - 10, { size: 110, weight: 900, fam: 'serif', color: rgba(P.cream, 0.14), align: 'left' }));
    // gap shading prices vs wages
    const gapA = inv(tBehind - 0.2, tBehind + 0.4, t) * fadeAll;
    if (gapA > 0 && u > 2021.55) {
      const top = [], bot = [];
      for (let q = 2021.55; q <= u; q += 0.02) { top.push([yr(q), val(sample(SERIES[2].pts, q))]); bot.push([yr(q), val(sample(SERIES[3].pts, q))]); }
      if (top.length > 2) alpha(gapA * 0.4, () => poly(top.concat(bot.reverse()), P.coral));
      alpha(gapA, () => text('wages fell behind', yr(2022.6), val(101), { size: 48, fam: 'hand', weight: 700, color: P.coral }));
    }
    // series lines, drawn up to the cursor
    SERIES.forEach((sr, i) => {
      const la = inv(t2020 - 0.2 + i * 0.1, t2020 + 0.2 + i * 0.1, t) * fadeAll;
      if (la <= 0) return;
      const pts = linePts(sr, u);
      const hl = i === 3 && t > tAnd - 0.3 ? 1 + 0.5 * Math.sin(clamp((t - tAnd + 0.3) / 0.8) * Math.PI) : 1;
      alpha(la, () => strokePoly(pts, 9 * hl, sr.c));
      const end = pts[pts.length - 1];
      if (i !== 3 || outP <= 0) alpha(la, () => circle(end[0], end[1], 11, sr.c));
    });
    // legend: node circles shrink into legend dots
    SERIES.forEach((sr, i) => {
      const n = MODERN_NODES[sr.node];
      const lx = 1560, ly = 330 + i * 90;
      const x = lerp(n.x, lx, cp), y = lerp(n.y, ly, cp), r = lerp(n.r, 16, E.out(inv(0, 0.6, cp)));
      alpha(fadeAll, () => circle(x, y, r, mix(NODE_FILL, sr.c, cp)));
      alpha(inv(0.7, 1, cp) * fadeAll, () => text(sr.name, lx + 34, ly + 2, { size: 34, weight: 700, color: P.cream, align: 'left' }));
    });
    // node 2 (banks) melts into the money dot
    const n2 = MODERN_NODES[1];
    if (cp < 1) circle(lerp(n2.x, 1560, cp), lerp(n2.y, 330, cp), lerp(n2.r, 16, E.out(inv(0, 0.6, cp))), mix(NODE_FILL, SERIES[0].c, cp));
    // annotations
    const tr = life(t, tTril, tYear + 0.5, 0.5, 0.3) * fadeAll;
    if (tr > 0) at(yr(2020.45), val(126) - 30, tr, -0.04, () => text('+ trillions of $', 0, 0, { size: 50, fam: 'hand', weight: 700, color: '#9fe0a1' }));
    const rc = life(t, tRecord, tYear + 1, 0.5, 0.3) * fadeAll;
    if (rc > 0) at(yr(2020.62), val(108) - 50, rc, 0, () => { sparkle(0, 0, 26, P.gold3, t); text('record highs', 0, -46, { size: 44, fam: 'hand', weight: 700, color: P.gold }); });
    const gr = pop(t, tGroc, 0.5) * fadeAll, rn = pop(t, tRent, 0.5) * fadeAll;
    if (gr > 0) at(yr(2021.55), val(114), gr, 0, () => { cart(); });
    if (rn > 0) at(yr(2022.2), val(122), rn, 0, () => { house({ w: 80, h: 60, body: P.cream, roof: P.coral }); at(52, -60, 0.6, 0, () => upArrow(28, P.coral)); });
  }
}
let MODERN = {};
function cart() {
  line(-50, -40, -34, 20, 7, P.cream);
  poly([[-40, -30], [48, -30], [38, 10], [-30, 10]], P.cream);
  circle(-20, 30, 9, P.cream); circle(26, 30, 9, P.cream);
  at(0, -54, 0.6, 0, () => upArrow(28, P.coral));
}

// ================================================================= 6. YOU
let YOU = {};
function youScene() {
  const t0 = MODERN.tOut;
  const head0 = MODERN.wageEnd(t0);
  const YX = 960, YF = 905, YS = 1.1;
  const tYou = Wd('y1', 'you');
  const tPay = Wd('y2', 'paycheck'), tBack = Wd('y2', 'back'), tRaise = Wd('y2', 'raise'), tArrive = Wd('y2', 'arrive'), tPrices = Wd('y2', 'prices');
  const tSave = Wd('y3', 'save'), tLeak = Wd('y3', 'leaks'), tEsc = Wd('y3', "it's") - 0.3, tDown = Wd('y3', 'down');
  const tHome = Wd('y4', 'home'), tRun = Wd('y4', 'run'), tSaveF = Wd('y4', 'save');
  const tMean = S('y5'), tOwn = Wd('y5', 'own'), tSource = Wd('y5', 'source'), tRich = Wd('y5', 'richer'), tNothing = Wd('y5', 'anything');
  const tGap = Wd('y6', 'gap');
  const tOut = Eend('y6') + 0.1;
  YOU = { tOut };
  sfx(t0 + 0.2, 'morph', 0.8);
  sfx(tYou, 'pop', 0.6); sfx(tPay, 'pop', 0.6); sfx(tBack - 0.4, 'whoosh', 0.6);
  sfx(tArrive, 'pop', 0.5); sfx(tPrices, 'pop', 0.6);
  sfx(tSave, 'coin', 0.8); sfx(tLeak, 'drip', 0.6); sfx(tLeak + 0.8, 'drip', 0.5); sfx(tEsc, 'morph', 0.8);
  sfx(tEsc + 0.6, 'escalator', 0.6, { dur: tHome - tEsc - 0.6 });
  sfx(tHome - 0.2, 'morph', 0.6); sfx(tRun, 'boing', 0.8); sfx(tRun + 0.3, 'run', 0.6, { dur: 2.2 });
  sfx(tOwn, 'pop', 0.6); sfx(tSource, 'coins', 0.7); sfx(tRich, 'rise', 0.6);
  sfx(tGap, 'thud', 0.8); sfx(tOut, 'swoosh_long', 0.9);

  const youPos = t => {
    let x = YX;
    x = lerp(x, 1330, E.inOut(inv(tBack - 0.5, tBack + 0.4, t)));
    x = lerp(x, 1250, E.inOut(inv(tSave - 0.6, tSave, t)));
    x = lerp(x, 960, E.inOut(inv(tEsc + 0.2, tEsc + 1.0, t)));
    x = lerp(x, 560, E.inOut(inv(tHome - 0.4, tHome + 0.4, t)));
    x = lerp(x, 430, E.inOut(inv(tMean - 0.2, tMean + 0.6, t)));
    let y = YF;
    const onEsc = inv(tEsc + 0.2, tEsc + 1.0, t) * (1 - inv(tHome - 0.4, tHome + 0.2, t));
    y = lerp(y, 668, E.inOut(onEsc));
    return { x, y };
  };
  // escalator geometry
  const EA = [380, 980], EB = [1540, 350];
  const eu = [EB[0] - EA[0], EB[1] - EA[1]], eL = Math.hypot(eu[0], eu[1]);
  const un = [eu[0] / eL, eu[1] / eL];
  const escPanel = polyS([[EA[0] - 150, EA[1]], EA, EB, [EB[0] + 150, EB[1]], [EB[0] + 150, EB[1] + 110], [EB[0] + 40, EB[1] + 110], [EA[0] + 40, EA[1] + 110], [EA[0] - 150, EA[1] + 110]]);
  const jarS = rrectS(760 - 120, 900 - 300, 240, 300, 30);
  const groundS = rrectS(-40, 905, W + 80, 200, 4);

  scene(t0, tOut + 1.3, t => {
    const p = inv(t0, t0 + 1.25, t);
    const hp = head0;
    const bgR = E.inOut(inv(0.05, 0.85, p)) * 2300;
    if (p < 1) circle(hp[0], hp[1], bgR, P.cream); else rect(0, 0, W, H, P.cream);
    alpha(inv(0.5, 1, p), () => bgGlow(960, 560, 700, '#f2cfa6', 0.55));
    const yp = youPos(t);

    // ---- queue (y2)
    const qa = inv(tBack - 0.5, tBack, t) * (1 - inv(tSave - 0.8, tSave - 0.3, t));
    if (qa > 0) {
      ['banker', 'builder', 'shop', 'teacher'].forEach((who, i) => {
        const x = lerp(-300, 290 + i * 245, E.out(inv(tBack - 0.6 + i * 0.07, tBack + 0.2 + i * 0.07, t))) - (1 - qa) * 400 * inv(tSave - 0.8, tSave - 0.3, t);
        if (i === 0) alpha(qa, () => bgGlow(x, YF - 160, 230, P.gold, 0.5));
        at(x, YF, 0.95, 0, () => person({ who, seed: 70 + i, dim: i === 0 ? 0 : 0.35 + i * 0.1, look: [6, 0] }, t));
      });
      alpha(qa, () => {
        text('front', 290, 1010, { size: 46, fam: 'hand', weight: 700, color: P.coral2 });
        text('back (you)', 1330, 1010, { size: 46, fam: 'hand', weight: 700, color: P.coral2 });
      });
    }
    // time line: prices move first, raise arrives later
    const tl = inv(tRaise - 0.4, tRaise, t) * (1 - inv(tSave - 0.8, tSave - 0.3, t));
    if (tl > 0) alpha(tl, () => {
      rect(360, 300, 1180 * E.out(tl), 6, P.ink);
      arrowHead(360 + 1180 * E.out(tl) + 10, 303, 0, 22, P.ink);
      text('time', 1560, 350, { size: 40, fam: 'hand', weight: 700, color: P.ink });
      const pf = pop(t, tPrices, 0.5), rf = pop(t, tArrive, 0.5);
      if (pf > 0) at(620, 303, pf, 0, () => { line(0, 0, 0, -120, 5, P.ink); at(70, -110, 1, 0, () => priceTag('prices ↑', { w: 190, h: 64, size: 30, c: P.coral, tc: P.white, hole: P.cream })); });
      if (rf > 0) at(1300, 303, rf, 0, () => { line(0, 0, 0, -120, 5, P.ink); at(0, -110, 1, 0, () => paycheck('raise')); });
      if (pf > 0 && rf > 0) text('first', 620, 350, { size: 36, fam: 'hand', weight: 700, color: P.coral2, a: pf });
      if (rf > 0) text('later', 1300, 350, { size: 36, fam: 'hand', weight: 700, color: P.teal2, a: rf });
    });

    // ---- jar -> escalator -> ground
    const jarIn = pop(t, tSave - 0.3, 0.5);
    const escP = E.inOut(inv(tEsc, tEsc + 0.9, t));
    const flatP = E.inOut(inv(tHome - 0.5, tHome + 0.3, t));
    if (jarIn > 0 && escP <= 0) {
      const lvl = lerp(0.8, 0.3, E.inOut(inv(tLeak - 0.3, tEsc, t)));
      at(760, 900, jarIn, 0, () => jar(lvl, { w: 240, h: 300, stroke: 'rgba(40,60,80,0.45)' }));
      for (let d = 0; d < 8; d++) {
        const a = ((t - tLeak) * 1.1 + d / 8) % 1;
        if (t > tLeak) alpha(1 - a, () => at(760 + 60, 880 + a * 80, 1, 0, () => { ellipse(0, 0, 9, 13, P.bill2); }));
      }
      const va = inv(tLeak, tLeak + 0.4, t);
      if (va > 0) text('value ↓', 560, 700, { size: 64, fam: 'hand', weight: 700, color: P.coral2, a: va });
      // coin dropping in on "save"
      const cd = inv(tSave, tSave + 0.6, t);
      if (cd > 0 && cd < 1) at(lerp(1150, 760, cd), lerp(600, 640, cd) - Math.sin(cd * Math.PI) * 160, 0.6, cd * 8, () => coin(40));
    }
    if (escP > 0) {
      const A = align(jarS, escPanel, 'jaresc');
      let S0 = morph(jarS, A, escP);
      if (flatP > 0) S0 = morph(A, align(A, groundS, 'escground'), flatP);
      fillS(S0, mix(mixHex('#c9dde2', P.navy3, escP), '#e2d3b3', flatP));
      if (escP < 0.3) alpha(1 - escP / 0.3, () => at(760, 900, 1, 0, () => jar(0.3, { w: 240, h: 300, stroke: 'rgba(40,60,80,0.45)' })));
      // steps + rail
      if (escP > 0.7 && flatP < 1) alpha(inv(0.7, 1, escP) * (1 - flatP * 3), () => escalatorSteps(t, EA, EB, un, eL));
    }
    // ground decorations while running (scrolls left)
    const runV = t > tRun ? Math.min(1, (t - tRun) / 0.6) * (1 - inv(tMean - 0.2, tMean + 0.6, t)) : 0;
    const scroll = t > tRun ? runDist(t, tRun, tMean) * 520 : 0;
    if (flatP > 0) alpha(flatP, () => {
      for (let k = -1; k < 12; k++) {
        const x = ((k * 230 - scroll) % 2530 + 2530) % 2530 - 200;
        rect(x, 830, 14, 75, '#d8c7a4');
        rect(x - 10, 846, 260, 10, '#d8c7a4');
        if (k % 3 === 0) { circle(x + 120, 880, 36, '#7fb068'); circle(x + 150, 890, 28, '#6fa35c'); }
      }
    });
    // the house that runs away
    const hIn = pop(t, tHome - 0.1, 0.5);
    if (hIn > 0) {
      const settle = E.inOut(inv(tMean - 0.2, tMean + 0.8, t));
      const hx = lerp(1250, 1640, settle) + (t > tRun ? Math.min(1, (t - tRun) / 0.5) * 60 * (1 - settle) : 0);
      const bob = runV * Math.abs(Math.sin(t * 14)) * 14;
      at(hx, 905 - bob, hIn * lerp(1, 0.85, settle), 0, () => {
        if (runV > 0) alpha(runV, () => {
          line(-40, -10, -40 + Math.sin(t * 14) * 30, 40, 12, P.ink);
          line(40, -10, 40 - Math.sin(t * 14) * 30, 40, 12, P.ink);
        });
        at(0, runV > 0 ? -30 * runV : 0, 1, 0, () => house({ w: 260, h: 190, body: '#f6e6c8', roof: P.coral }));
        const v = Math.round(lerp(300, 460, E.out(inv(tRun, tMean + 1, t))));
        at(170, -230, 1, 0.1 + Math.sin(t * 5) * 0.05, () => priceTag('$' + v + 'k', { w: 170, h: 66, size: 34, c: P.white, hole: P.cream }));
      });
      if (runV > 0.2) for (let k = 0; k < 4; k++) alpha(runV * 0.5, () => line(hx - 170 - k * 40, 760 + k * 35, hx - 230 - k * 40, 760 + k * 35, 6, P.ink));
    }

    // ---- owner: already owns assets, closest to the source
    const oIn = pop(t, tOwn - 0.1, 0.5);
    if (oIn > 0) {
      const src = inv(tSource - 0.3, tSource + 0.3, t);
      // pipe from the source (top right) pouring into the owner's pile
      alpha(src, () => {
        rrect(1090, -20, 60, 190, 12, P.gold2);
        rrect(1070, 160, 100, 40, 12, P.gold2);
        text('SOURCE', 1210, 120, { size: 26, weight: 800, ls: 4, color: P.gold2, align: 'left' });
        for (let k = 0; k < 8; k++) {
          const a = ((t - tSource) * 1.4 + k / 8) % 1;
          if (t > tSource) at(1120 + Math.sin(k * 3) * 8, 210 + a * 520, 0.42, a * 6 + k, () => alpha(clamp((1 - a) * 3), () => coin(40)));
        }
      });
      at(1440, 905, oIn, 0, () => loungeChair());
      at(1470, 905, oIn * 0.95, 0, () => {
        ctx.save(); ctx.rotate(-0.35); ctx.translate(-40, 30);
        person({ who: 'owner', seed: 90, expr: t > tNothing ? 'smug' : 'smile', armL: 2.4, armR: 2.4, noShadow: true }, t);
        ctx.restore();
      });
      if (t > tNothing) for (let k = 0; k < 3; k++) {
        const a = ((t - tNothing) * 0.6 + k / 3) % 1;
        text('z', 1560 + a * 60, 560 - a * 120, { size: 40 + k * 8, weight: 800, color: P.navy3, a: Math.sin(a * Math.PI) });
      }
      text('already owns assets', 1450, 1010, { size: 46, fam: 'hand', weight: 700, color: P.teal2, a: inv(tOwn + 0.2, tOwn + 0.6, t) });
    }

    // ---- wealth bars and the gap
    const bA = inv(tRich - 0.4, tRich, t);
    if (bA > 0) {
      const g = E.inOut(inv(tRich - 0.2, tOut - 0.3, t));
      const hY = lerp(110, 170, g) * E.out(bA), hO = lerp(140, 560, g) * E.out(bA);
      rrect(760, 905 - hY, 120, hY, 12, P.teal);
      rrect(1060, 905 - hO, 120, hO, 12, P.gold);
      text('YOU', 820, 940, { size: 26, weight: 800, ls: 4, color: P.ink, a: bA });
      text('OWNER', 1120, 940, { size: 26, weight: 800, ls: 4, color: P.ink, a: bA });
      const ga = inv(tGap - 0.3, tGap + 0.1, t);
      if (ga > 0) alpha(ga, () => {
        ctx.save(); ctx.setLineDash([10, 12]);
        strokePoly([[760, 905 - hY], [1180, 905 - hY]], 4, P.ink);
        ctx.restore();
        const top = 905 - hO, bot = 905 - hY;
        strokePoly([[960, top + 4], [960, bot - 4]], 6, P.coral2);
        arrowHead(960, top + 2, -Math.PI / 2, 18, P.coral2);
        arrowHead(960, bot - 2, Math.PI / 2, 18, P.coral2);
        text('THE GAP', 960, (top + bot) / 2, { size: 40, weight: 900, ls: 4, color: P.coral2, stroke: P.cream, strokeW: 14 });
      });
      YOU.gapMid = [960, 905 - (hO + hY) / 2];
    }

    // ---- YOU (drawn last, on top)
    const bodyP = inv(0.62, 1, p);
    if (p < 1) {
      const hm = E.inOut(inv(0, 0.7, p));
      const hx = lerp(hp[0], YX, hm), hy = lerp(hp[1], YF - 252 * YS, hm);
      const r = lerp(11, 45 * YS, hm);
      if (bodyP > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, hy + (YF + 20 - hy) * E.out(bodyP)); ctx.clip();
        at(YX, YF, YS, 0, () => person({ who: 'you', seed: 80 }, t));
        ctx.restore();
      }
      alpha(1 - inv(0.8, 1, p), () => circle(hx, hy, r, mix('#6fd0c4', P.skin2, inv(0.4, 0.8, p))));
    } else {
      const running = t > tRun && t < tMean + 0.4;
      const onEsc = t > tEsc + 0.4 && t < tHome;
      const walk = running ? t * 14 : onEsc ? t * 7 : 0;
      const wave = t > tYou - 0.1 && t < tPay - 0.2 ? 2.6 + Math.sin(t * 10) * 0.3 : 0.12;
      const hold = t > tPay - 0.3 && t < tSave - 0.6 ? () => at(70, -150, 1, 0.15, () => paycheck('$')) : running ? () => at(60, -120, 0.4, 0, () => jar(0.3, { w: 150, h: 180 })) : null;
      const expr = t > tLeak ? (t > tMean + 0.5 ? 'worried' : 'worried') : t > tBack ? 'neutral' : 'smile';
      const s = onEsc ? 0.95 : YS;
      at(yp.x, yp.y + (running ? -Math.abs(Math.sin(t * 14)) * 10 : 0), s, onEsc ? -0.1 : 0, () => person({ who: 'you', seed: 80, walk, walkAmp: running ? 0.6 : 0.4, armR: t > tPay - 0.3 && t < tSave - 0.6 ? 1.2 : wave, armL: running ? 0.6 + Math.sin(t * 14) * 0.4 : 0.12, hold, expr, look: t > tBack && t < tSave ? [-6, 0] : [0, 0] }, t));
    }
    const ya = inv(tYou - 0.1, tYou + 0.3, t) * (1 - inv(tPay + 0.5, tPay + 0.9, t));
    if (ya > 0) {
      text('you', 1330, 430, { size: 90, fam: 'hand', weight: 700, color: P.coral2, a: ya });
      alpha(ya, () => { strokePartial(bezierPts([1280, 470], [1230, 520], [1150, 560], [1060, 580], 30), ya, 7, P.coral2); if (ya > 0.95) arrowHead(1060, 580, 2.9, 22, P.coral2); });
    }
    const ea = inv(tDown - 0.2, tDown + 0.2, t) * (1 - inv(tHome - 0.5, tHome - 0.2, t));
    if (ea > 0) text('going down', 1380, 820, { size: 60, fam: 'hand', weight: 700, color: P.coral2, a: ea });
  });
}
function runDist(t, a, b) {
  // distance travelled (in units) with a 0.6s ramp-up and ramp-down around [a, b]
  const up = rampInt(t, a, 0.6);
  const down = rampInt(t, b - 0.2, 0.8);
  return up - down;
}
function escalatorSteps(t, A, B, un, L) {
  const step = 80;
  const off = (t * 110) % step;
  ctx.save();
  // treads & risers (sawtooth) along the top edge, moving down the incline
  for (let d = -step + (step - off); d < L; d += step) {
    const x = A[0] + un[0] * d, y = A[1] + un[1] * d;
    const run = step * Math.abs(un[0]), rise = step * Math.abs(un[1]);
    poly([[x, y + 2], [x, y - rise], [x + run, y - rise]], '#e8edf3');
    line(x, y - rise, x, y + 2, 5, '#9aa6b8', 'butt');
    line(x, y - rise, x + run, y - rise, 6, '#b8c2d0', 'butt');
  }
  // handrail on posts
  const rail = [[A[0] - 150, A[1] - 150], [A[0], A[1] - 150], [B[0], B[1] - 150], [B[0] + 150, B[1] - 150]];
  for (let k = 0; k <= 6; k++) { const q = pointAlong(rail, k / 6); line(q[0], q[1], q[0], q[1] + 150, 8, '#9aa6b8'); }
  strokePoly(rail, 16, P.ink);
  // chevrons on the side panel showing it moves down
  for (let k = 0; k < 7; k++) {
    const d = ((k / 7) * L + (L - (t * 110) % L)) % L;
    const x = A[0] + un[0] * d, y = A[1] + un[1] * d;
    at(x + 40, y + 62, 0.7, Math.atan2(un[1], un[0]) + Math.PI, () => arrowHead(0, 0, 0, 26, rgba(P.cream, 0.75)));
  }
  ctx.restore();
}
function loungeChair() {
  line(-120, 0, -60, -60, 10, P.brown2);
  line(80, 0, 20, -60, 10, P.brown2);
  poly([[-150, -70], [40, -70], [120, -190], [96, -200], [30, -86], [-150, -86]], P.coral);
  for (let k = 0; k < 4; k++) rect(-140 + k * 45, -86, 18, 16, '#f7e4d0');
}

// ================================================================= 7. WHY IT MATTERS
let MAT = {};
function mattersScene() {
  const t0 = YOU.tOut;
  const tCons = Wd('w1', 'conspiracy'), tMoves = Wd('w1', 'simply') - 0.25, tInvis = Wd('w1', 'invisible'), tNotice = Wd('w1', 'notice');
  const tInfl = S('w2'), tUp = Wd('w2', 'up'), tTransfer = Wd('w2', 'transfer'), tBack = Wd('w2', 'back'), tFront = Wd('w2', 'front');
  const tQ = Wd('w3', 'questions'), tQ1 = Wd('w3', 'where'), tQ2 = Wd('w3', 'who'), tQ3 = Wd('w3', 'what');
  const tOut = Eend('w3') + 0.15;
  MAT = { tOut, cards: [] };
  sfx(tCons, 'stamp', 0.8); sfx(tMoves, 'flow', 0.6, { dur: 1.5 }); sfx(tInvis, 'shimmer', 0.7);
  sfx(tInfl, 'pop', 0.7); sfx(tTransfer, 'morph', 0.8); sfx(tBack, 'coins', 0.6);
  sfx(tQ1, 'pop', 0.7); sfx(tQ2, 'pop', 0.7); sfx(tQ3, 'pop', 0.7);
  sfx(tOut, 'morph', 0.9);

  const cards = [
    { q: 'Where is new money going?', icon: 'compass', t: tQ1 },
    { q: 'Who benefits first?', icon: 'medal', t: tQ2 },
    { q: 'What am I storing my hard work in?', icon: 'vault', t: tQ3 },
  ];
  const cardRect = i => ({ x: 360, y: 300 + i * 190, w: 1200, h: 150 });
  MAT.cardRect = cardRect;
  MAT.cards = cards;

  const river = [];
  for (let k = 0; k <= 60; k++) { const u = k / 60; river.push([lerp(120, 1800, u), 640 + Math.sin(u * 5.5) * 90]); }

  scene(t0, tOut + 1.4, t => {
    // navy expands from the gap
    const p = inv(t0, t0 + 1.1, t);
    const gm = YOU.gapMid || [960, 600];
    if (p < 1) circle(gm[0], gm[1], E.inOut(p) * 2300, P.navy); else rect(0, 0, W, H, P.navy);
    const endP = inv(tOut, tOut + 1.2, t);

    // w1: not a conspiracy
    const ca = inv(tCons - 0.4, tCons, t) * (1 - inv(tMoves - 0.6, tMoves - 0.3, t));
    if (ca > 0) {
      kinetic("It's not a *conspiracy.*", 960, 200, t, [S('w1'), S('w1') + 0.25, Wd('w1', "isn't"), tCons - 0.1], { size: 84, fam: 'serif', weight: 900, accent: P.coral, out: tMoves - 0.6 });
      alpha(ca, () => at(960, 520, pop(t, tCons, 0.5), 0, () => noSign(() => hoodedFigure(), '')));
    }
    // river of money that becomes invisible
    const ra = inv(tMoves - 0.3, tMoves + 0.3, t) * (1 - inv(tInfl - 0.5, tInfl - 0.1, t));
    if (ra > 0) {
      const inv0 = inv(tInvis - 0.2, tNotice, t);
      alpha(ra, () => {
        kinetic("It's simply how new money *moves.*", 960, 200, t, tMoves + 0.05, { size: 72, fam: 'serif', weight: 900, accent: P.gold, out: tInvis - 0.4, stagger: 0.1 });
        kinetic('…and it’s *invisible.*', 960, 200, t, [tInvis - 0.3, tInvis - 0.15, tInvis], { size: 72, fam: 'serif', weight: 900, accent: P.sky, out: tInfl - 0.6 });
        ctx.save();
        ctx.globalAlpha *= 1 - inv0 * 0.85;
        strokePoly(river, 70, P.gold2);
        strokePoly(river, 40, P.gold);
        ctx.restore();
        if (inv0 > 0) { ctx.save(); ctx.setLineDash([16, 18]); ctx.globalAlpha *= inv0 * 0.6; strokePoly(river.map(q => [q[0], q[1] - 36]), 4, P.sky); strokePoly(river.map(q => [q[0], q[1] + 36]), 4, P.sky); ctx.restore(); }
        for (let j = 0; j < 14; j++) {
          const u = ((t - tMoves) * 0.12 + j / 14) % 1;
          const q = pointAlong(river, u);
          alpha(1 - inv0 * 0.9, () => at(q[0], q[1], 0.42, q[2], () => coin(40)));
        }
        // people walking by, not noticing
        for (let k = 0; k < 4; k++) {
          const x = ((t - tMoves) * 60 + k * 480) % 2100 - 100;
          at(x, 1000, 0.55, 0, () => person({ who: CAST_ORDER[k + 1], seed: 120 + k, walk: t * 7, expr: 'neutral', look: [8, 0] }, t));
        }
      });
    }
    // w2: inflation = a transfer
    const ia = inv(tInfl - 0.3, tInfl + 0.2, t) * (1 - inv(tQ - 0.6, tQ - 0.2, t));
    if (ia > 0) alpha(ia, () => {
      const tp = E.inOut(inv(tTransfer - 0.3, tTransfer + 0.6, t));
      kinetic('Inflation isn’t just prices going *up.*', 960, 180, t, tInfl, { size: 70, fam: 'serif', weight: 900, accent: P.coral, out: tTransfer - 0.4, stagger: 0.12 });
      kinetic('It’s a *transfer.*', 960, 180, t, [tTransfer - 0.35, tTransfer - 0.2, tTransfer], { size: 90, fam: 'serif', weight: 900, accent: P.gold });
      // price tag with arrow that bends into the transfer arrow
      at(960, 520, pop(t, tInfl, 0.5) * (1 - tp), 0, () => {
        priceTag('INFLATION', { w: 420, h: 120, size: 56, c: P.cream, hole: P.navy });
        at(0, -140, 1, 0, () => upArrow(60, P.coral));
      });
      if (tp > 0) {
        // back of the line: small grey people (right); front: banker (left)
        for (let k = 0; k < 4; k++) at(1260 + k * 140, 900, 0.62 * tp, 0, () => person({ who: CAST_ORDER[1 + k], seed: 130 + k, dim: 0.5, expr: 'worried', look: [-6, 0] }, t));
        alpha(tp, () => bgGlow(420, 760, 300, P.gold, 0.4));
        at(420, 900, 0.95 * tp, 0, () => person({ who: 'banker', seed: 140, expr: 'smug', look: [6, 0] }, t));
        const arr = bezierPts([1450, 560], [1250, 300], [700, 300], [560, 520], 70);
        const ap = inv(tBack - 0.4, tFront + 0.2, t);
        strokePartial(arr, ap, 22, P.coral, [2, 32]);
        if (ap > 0.97) arrowHead(560, 520, 2.1, 36, P.coral);
        for (let j = 0; j < 7; j++) {
          const u = ((t - tBack) * 0.5 + j / 7) % 1;
          if (t > tBack && u < ap) { const q = pointAlong(arr, u); at(q[0], q[1], 0.5, 0, () => coin(40)); }
        }
        text('back of the line', 1470, 1010, { size: 48, fam: 'hand', weight: 700, color: P.sky, a: inv(tBack, tBack + 0.3, t) });
        text('front of the line', 420, 1010, { size: 48, fam: 'hand', weight: 700, color: P.gold, a: inv(tFront, tFront + 0.3, t) });
      }
    });
    // w3: better questions
    if (t > tQ - 0.4) {
      const ha = inv(tQ - 0.4, tQ, t);
      kinetic('Start asking better questions', 960, 160, t, Wd('w3', 'start') - 0.1, { size: 64, fam: 'serif', weight: 900, accent: P.gold, out: tOut - 0.2, stagger: 0.08 });
      cards.forEach((c, i) => {
        const cp = pop(t, c.t - 0.1, 0.55, 1.4);
        if (cp <= 0 || endP > 0) return;
        const r = cardRect(i);
        at(r.x + r.w / 2, r.y + r.h / 2, cp, 0, () => questionCard(c, r, t));
      });
    }
  });
}
function questionCard(c, r, t) {
  rrect(-r.w / 2, -r.h / 2, r.w, r.h, 26, P.navy2);
  ctx.strokeStyle = rgba(P.gold, 0.35); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 26); ctx.stroke();
  at(-r.w / 2 + 95, 0, 0.9, 0, () => {
    circle(0, 0, 58, P.gold);
    if (c.icon === 'compass') compass(46, t);
    else if (c.icon === 'medal') at(0, 20, 0.62, 0, () => medal(46));
    else vault(40);
  });
  text(c.q, -r.w / 2 + 190, 4, { size: 54, fam: 'serif', weight: 800, color: P.cream, align: 'left' });
}
function hoodedFigure() {
  ctx.fillStyle = P.navy3;
  ctx.beginPath(); ctx.moveTo(-60, 70); ctx.quadraticCurveTo(-64, -60, 0, -70); ctx.quadraticCurveTo(64, -60, 60, 70); ctx.closePath(); ctx.fill();
  ellipse(0, -10, 32, 38, P.ink);
  ellipse(-12, -14, 6, 4, P.gold3); ellipse(12, -14, 6, 4, P.gold3);
}

// ================================================================= 8. END
function endScene() {
  const t0 = MAT.tOut;
  const tHear = Wd('e1', 'hear'), tHow = Wd('e1', 'how'), tMuch = Wd('e1', 'much');
  const tAsk = S('e2'), tWho = Wd('e2', 'who'), tFirst = Wd('e2', 'first');
  const tMove = tAsk - 0.35;
  const tMerge = Eend('e2') + 0.55;
  const tTitle = tMerge + 0.85;
  const tEnd = TL.duration;
  sfx(t0 + 0.1, 'morph', 0.8);
  sfx(t0 + 0.9, 'machine_start', 0.8, { until: tMerge });
  sfx(tHear, 'news', 0.7); sfx(tMuch + 0.2, 'scribble', 0.6);
  sfx(tMove, 'whoosh', 0.6);
  sfx(tWho, 'boom', 0.9); sfx(tFirst + 0.1, 'ding', 0.7);
  sfx(tMerge, 'morph', 0.9); sfx(tTitle - 0.1, 'coin', 0.8); sfx(tTitle + 0.1, 'outro', 1);
  const prAt = t => {
    const m = E.inOut(inv(tMove, tMove + 0.7, t));
    return { x: lerp(960, 400, m), y: lerp(790, 905, m), s: lerp(0.9, 0.66, m) };
  };
  const pr0 = prAt(t0 + 1);
  const parts = [
    rrectS(pr0.x - 215 * pr0.s, pr0.y - 350 * pr0.s, 430 * pr0.s, 320 * pr0.s, 38 * pr0.s),
    rrectS(pr0.x - 180 * pr0.s, pr0.y - 384 * pr0.s, 360 * pr0.s, 46 * pr0.s, 20 * pr0.s),
    polyS([[pr0.x - 205 * pr0.s, pr0.y - 44 * pr0.s], [pr0.x - 170 * pr0.s, pr0.y - 86 * pr0.s], [pr0.x + 170 * pr0.s, pr0.y - 86 * pr0.s], [pr0.x + 205 * pr0.s, pr0.y - 44 * pr0.s]]),
  ];
  const partCol = ['#eadcbc', P.navy3, P.navy3];
  const people = CAST_ORDER.map((who, i) => ({ who, x: 780 + i * 215, y: 905, s: 0.64, t0: tMove + 0.3 + i * 0.08 }));
  people.forEach(p => sfx(p.t0, 'pop', 0.35));
  const coinC = { x: 960, y: 380, r: 110 };
  const silPrinter = rrectS(-215, -384, 430, 384, 40);
  const silPerson = pathS(PERSON_SIL);

  scene(t0, tEnd + 1, t => {
    rect(0, 0, W, H, P.navy);
    const mp = E.inOut(inv(t0, t0 + 1.0, t));
    const run = inv(t0 + 0.9, t0 + 1.4, t);
    const mergeP = inv(tMerge, tMerge + 0.85, t);
    const pr = prAt(t);
    bgGlow(pr.x, pr.y - 200 * pr.s, 700 * pr.s + 150, P.gold, 0.16 * mp * (1 - mergeP));
    if (mergeP > 0) bgGlow(960, 520, 800, P.gold, 0.14 * inv(0.4, 1, mergeP) * (1 - inv(tEnd - 1.5, tEnd - 0.3, t)));
    // question cards -> printer parts
    if (mp < 1) {
      MAT.cards.forEach((c, i) => {
        const r = MAT.cardRect(i);
        const A = rrectS(r.x, r.y, r.w, r.h, 26);
        const B = align(A, parts[i], 'card2part' + i);
        fillS(morph(A, B, mp), mix(P.navy2, partCol[i], mp));
        if (mp < 0.25) alpha(1 - mp * 4, () => at(r.x + r.w / 2, r.y + r.h / 2, 1, 0, () => questionCard(c, r, t)));
      });
    }
    const liveA = mergeP > 0 ? 0 : 1;
    // bills flying free, then feeding the first person
    if (t > t0 + 1.1 && liveA > 0) {
      for (let i = 0; i < 70; i++) {
        const te = t0 + 1.1 + i * 0.12;
        if (te > tMove + 0.2) break;
        if (t < te || t - te > 4) continue;
        const b = billPath(i + 900, te, t, 960, 790 - 90 * 0.9, 1);
        flyingBill(b.x, b.y, b.rot, b.flip, 90, 1);
      }
      const feedA = tMove + 0.8;
      for (let i = 0; i < 14; i++) {
        const te = feedA + i * 0.2;
        const a = (t - te) / 0.9;
        if (a < 0 || a > 1) continue;
        const p0 = prAt(te);
        const u = E.sine(a);
        const bx = lerp(p0.x, people[0].x, u), by = lerp(p0.y - 100 * p0.s, people[0].y - 280 * people[0].s, u) - Math.sin(u * Math.PI) * 240;
        flyingBill(bx, by, a * 5 + i, a * 9, 80, 1);
      }
    }
    if (mp > 0.9 && liveA > 0) alpha(inv(0.9, 1, mp), () => at(pr.x, pr.y, pr.s, 0, () => printer(t, { run, spin: rampInt(t, t0 + 0.9, 0.5) * 2.4, lever: 1, runStart: t0 + 0.9 })));
    // the line of people returns (bookend of the opening)
    if (t > tMove && liveA > 0) {
      const glow = inv(tFirst - 0.2, tFirst + 0.4, t);
      people.forEach((p, i) => {
        const sc = life(t, p.t0) * p.s;
        if (sc <= 0) return;
        if (i === 0) alpha(glow, () => bgGlow(p.x, p.y - 150, 260, P.gold, 0.5));
        at(p.x, p.y, sc, 0, () => person({ who: p.who, seed: 150 + i, expr: i === 0 ? (glow > 0.5 ? 'happy' : 'smile') : i >= 3 && glow > 0.5 ? 'worried' : 'smile', dim: i === 0 ? 0 : glow * (0.2 + i * 0.12), look: [-5, 0] }, t));
      });
    }
    // everything merges into one coin
    if (mergeP > 0 && mergeP < 1) {
      const em = E.inOut(mergeP);
      const target = circleS(coinC.x, coinC.y, coinC.r);
      const sils = [{ S: xf(silPrinter, pr.x, pr.y, pr.s), c: '#eadcbc', key: 'endpr' }, ...people.map((p, i) => ({ S: xf(silPerson, p.x, p.y, p.s), c: CAST[p.who].top, key: 'endpp' + i }))];
      for (const sl of sils) fillS(morph(sl.S, align(sl.S, target, 'endc' + sl.key), em), mix(sl.c, P.gold, inv(0.3, 0.9, mergeP)));
    }
    // news banner
    const nb = inv(tHear - 0.2, tHear + 0.3, t) * (1 - inv(tMove - 0.2, tMove + 0.2, t));
    if (nb > 0) {
      const x = lerp(-1300, 0, E.out(nb)) - E.in(inv(tMove - 0.2, tMove + 0.2, t)) * 1400;
      at(x, 0, 1, 0, () => {
        rect(0, 965, 1500, 76, P.coral2);
        rect(0, 965, 250, 76, P.white);
        text('BREAKING', 125, 1004, { size: 30, weight: 900, ls: 3, color: P.coral2 });
        text('NEW MONEY CREATED', 290, 1004, { size: 36, weight: 800, ls: 4, color: P.white, align: 'left' });
      });
    }
    // "How much?" crossed out -> "Who gets it first?"
    const hm = inv(tHow - 0.2, tHow + 0.2, t) * (1 - inv(tAsk - 0.1, tAsk + 0.25, t));
    if (hm > 0) at(960, 190, 1, -0.03, () => {
      text('How much?', 0, 0, { size: 110, fam: 'serif', weight: 900, color: P.cream, a: hm });
      alpha(hm, () => scribble(-300, 8, 300, -6, inv(tMuch + 0.15, tMuch + 0.5, t), 16, P.coral, 6, 4));
    });
    if (t > tAsk - 0.1 && t < tMerge + 0.5) {
      kinetic('Who gets it *first?*', 960, 190, t, [tWho, Wd('e2', 'gets'), Wd('e2', 'it'), tFirst], { size: 120, fam: 'serif', weight: 900, out: tMerge - 0.1 });
      text('ASK', 960, 82, { size: 34, weight: 800, ls: 14, color: P.gold, a: inv(tAsk, tAsk + 0.3, t) * (1 - inv(tMerge - 0.1, tMerge + 0.2, t)) });
    }
    // title card
    if (mergeP >= 1) {
      at(coinC.x, coinC.y, 1, 0, () => coin(coinC.r));
      kinetic('THE', 960, 555, t, [tTitle], { size: 34, weight: 800, ls: 14, color: P.gold });
      kinetic('CANTILLON EFFECT', 960, 655, t, [tTitle + 0.1, tTitle + 0.25], { size: 132, weight: 900, fam: 'serif', color: P.cream });
      alpha(inv(tTitle + 0.6, tTitle + 1.0, t), () => scribble(600, 740, 1320, 740, inv(tTitle + 0.6, tTitle + 1.0, t), 10, P.gold, 4, 2));
      text('New money isn’t neutral. Who gets it first matters.', 960, 830, { size: 38, weight: 600, color: rgba(P.cream, 0.85), a: inv(tTitle + 0.9, tTitle + 1.4, t) });
      const cr = inv(tTitle + 1.3, tTitle + 1.8, t);
      alpha(cr, () => rect(900, 878, 120, 3, rgba(P.gold, 0.6)));
      text('By Kane Gulka ft. Opus 5.5', 960, 922, { size: 34, weight: 700, ls: 1, color: P.gold, a: cr });
    }
    // final fade
    const ff = inv(tEnd - 1.3, tEnd - 0.1, t);
    if (ff > 0) alpha(ff, () => rect(0, 0, W, H, '#0e1220'));
  });
}
