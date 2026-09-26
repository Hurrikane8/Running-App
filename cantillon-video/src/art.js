// Illustration library: characters and props, all drawn in local coordinates.

// ---------------------------------------------------------------- characters
const CAST = {
  banker: { skin: P.skin1, top: '#2e3752', bottom: '#20263a', hair: 'short', hairC: '#3a2a20', hat: 'top', tie: P.red, collar: true },
  builder: { skin: P.skin3, top: '#ee9a33', bottom: '#3d5a80', hair: 'pony', hairC: '#24160f', hat: 'hard', vest: true },
  shop: { skin: P.skin2, top: P.coral, bottom: '#4a4f63', hair: 'short', hairC: '#1f1a17', apron: true, mustache: true },
  teacher: { skin: P.skin1, top: P.plum2, bottom: '#3c3552', hair: 'bun', hairC: '#8a4b2a', glasses: true },
  retiree: { skin: P.skin2, top: '#cbb48d', bottom: '#6b6f7c', hair: 'grey', hairC: '#eeeeee', cane: true, glasses: true, stoop: 1 },
  you: { skin: P.skin2, top: P.teal, bottom: '#2f3a55', hair: 'short', hairC: '#2b1d16' },
  owner: { skin: P.skin1, top: '#f4f0e6', bottom: '#8aa0b8', hair: 'short', hairC: '#c9a36a', shades: true },
  grey: { skin: '#b9bcc5', top: '#8d93a1', bottom: '#6d7382', hair: 'short', hairC: '#6d7382', plain: true },
};
const CAST_ORDER = ['banker', 'builder', 'shop', 'teacher', 'retiree'];
const CAST_LABEL = { banker: 'BANKER', builder: 'BUILDER', shop: 'SHOPKEEPER', teacher: 'TEACHER', retiree: 'RETIREE' };

// Person silhouette used for morphing (feet at 0,0; ~300 tall).
const PERSON_SIL = 'M0,-298 C28,-298 46,-278 46,-252 C46,-232 36,-217 22,-210 L44,-206 C58,-202 64,-190 66,-176 L74,-108 C75,-98 64,-96 60,-104 L54,-150 L54,-86 L30,-86 L28,0 L6,0 L4,-84 L-4,-84 L-6,0 L-28,0 L-30,-86 L-54,-86 L-54,-150 L-60,-104 C-64,-96 -75,-98 -74,-108 L-66,-176 C-64,-190 -58,-202 -44,-206 L-22,-210 C-36,-217 -46,-232 -46,-252 C-46,-278 -28,-298 0,-298 Z';

function blinkAmt(t, seed) {
  const period = 3.1 + rnd(seed, 9) * 1.8;
  const ph = (t + rnd(seed, 4) * period) % period;
  return ph < 0.13 ? Math.sin((ph / 0.13) * Math.PI) : 0;
}

function person(o, t = 0) {
  const c = { ...CAST[o.who || 'you'], ...o };
  const walk = o.walk || 0, wa = o.walkAmp === undefined ? 0.35 : o.walkAmp;
  const bob = o.bob || 0;
  const stoop = c.stoop ? 6 : 0;
  ctx.save();
  if (o.dim) ctx.filter = `saturate(${1 - o.dim * 0.85}) brightness(${1 - o.dim * 0.25})`;
  // shadow
  if (!o.noShadow) ellipse(0, 0, 58, 10, 'rgba(0,0,0,0.13)');
  ctx.translate(0, -bob);
  // legs
  const leg = (sx, ang) => {
    ctx.save();
    ctx.translate(sx * 14, -90);
    ctx.rotate(ang);
    rrect(-11, 0, 22, 84, 10, c.bottom);
    ellipse(sx * 3, 84, 17, 9, P.ink);
    ctx.restore();
  };
  leg(-1, Math.sin(walk) * wa);
  leg(1, -Math.sin(walk) * wa);
  if (c.cane) {
    line(66, -104, 78, -2, 7, P.brown2);
    ctx.strokeStyle = P.brown2; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(58, -104, 10, Math.PI, 0); ctx.stroke();
  }
  ctx.translate(stoop * 0.5, 0);
  // back arm
  const arm = (side, ang) => {
    ctx.save();
    ctx.translate(side * 40, -194);
    ctx.rotate(side * ang);
    line(0, 0, side * 6, 88, 21, c.top);
    circle(side * 6, 92, 11, c.skin);
    ctx.restore();
  };
  const aL = o.armL === undefined ? 0.12 : o.armL, aR = o.armR === undefined ? 0.12 : o.armR;
  // torso
  ctx.fillStyle = c.top;
  ctx.beginPath();
  ctx.moveTo(-36, -208);
  ctx.quadraticCurveTo(0, -214, 36, -208);
  ctx.quadraticCurveTo(52, -204, 54, -170);
  ctx.lineTo(56, -96);
  ctx.quadraticCurveTo(56, -82, 40, -82);
  ctx.lineTo(-40, -82);
  ctx.quadraticCurveTo(-56, -82, -56, -96);
  ctx.lineTo(-54, -170);
  ctx.quadraticCurveTo(-52, -204, -36, -208);
  ctx.fill();
  if (c.collar) {
    poly([[-16, -210], [16, -210], [0, -176]], '#f7f3ea');
  }
  if (c.tie) poly([[0, -196], [7, -186], [4, -140], [0, -130], [-4, -140], [-7, -186]], c.tie);
  if (c.vest) {
    rect(-54, -150, 108, 10, '#f7e45a');
    rect(-54, -122, 108, 10, '#f7e45a');
  }
  if (c.apron) {
    rrect(-36, -176, 72, 102, 10, '#f7f3ea');
    line(-24, -176, -18, -206, 5, '#f7f3ea');
    line(24, -176, 18, -206, 5, '#f7f3ea');
    rrect(-16, -140, 32, 20, 5, '#e3dccd');
  }
  if (o.holdFront) o.holdFront();
  arm(-1, aL);
  arm(1, aR);
  // neck + head
  rect(-10, -222, 20, 18, c.skin);
  const hx = 0, hy = -252;
  if (c.hair === 'pony') ellipse(hx + 44, hy + 10, 14, 30, c.hairC, -0.5);
  if (c.hair === 'long') rrect(hx - 50, hy - 20, 100, 90, 30, c.hairC);
  circle(hx - 44, hy + 2, 9, c.skin);
  circle(hx + 44, hy + 2, 9, c.skin);
  circle(hx, hy, 45, c.skin);
  // hair
  if (c.hair === 'short' || c.hair === 'pony' || c.hair === 'bun' || c.hair === 'long') {
    ctx.fillStyle = c.hairC;
    ctx.beginPath();
    ctx.arc(hx, hy, 47, Math.PI * 1.03, Math.PI * 1.97);
    ctx.quadraticCurveTo(hx + 30, hy - 24, hx + 6, hy - 22);
    ctx.quadraticCurveTo(hx - 20, hy - 30, hx - 30, hy - 14);
    ctx.quadraticCurveTo(hx - 40, hy - 6, hx - 47, hy - 2);
    ctx.fill();
    if (c.hair === 'bun') circle(hx + 4, hy - 52, 19, c.hairC);
  } else if (c.hair === 'grey') {
    ellipse(hx - 40, hy - 10, 12, 20, c.hairC, 0.3);
    ellipse(hx + 40, hy - 10, 12, 20, c.hairC, -0.3);
  }
  // face
  const bl = blinkAmt(t, o.seed || 1);
  const lx = (o.look ? o.look[0] : 0), ly = (o.look ? o.look[1] : 0);
  const ey = hy - 4 + ly;
  const eyeH = 6 * (1 - bl * 0.9);
  ellipse(hx - 15 + lx, ey, 5.5, eyeH, P.ink);
  ellipse(hx + 15 + lx, ey, 5.5, eyeH, P.ink);
  circle(hx - 27, hy + 14, 8, 'rgba(232,102,79,0.22)');
  circle(hx + 27, hy + 14, 8, 'rgba(232,102,79,0.22)');
  const expr = o.expr || 'smile';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  if (expr === 'smile') {
    ctx.beginPath(); ctx.arc(hx + lx * 0.5, hy + 12, 11, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else if (expr === 'happy') {
    ctx.fillStyle = '#7a2e2a';
    ctx.beginPath(); ctx.arc(hx + lx * 0.5, hy + 12, 13, 0, Math.PI); ctx.closePath(); ctx.fill();
  } else if (expr === 'worried') {
    ctx.beginPath(); ctx.arc(hx + lx * 0.5, hy + 26, 9, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke();
    line(hx - 22 + lx, ey - 16, hx - 8 + lx, ey - 20, 4, P.ink);
    line(hx + 22 + lx, ey - 16, hx + 8 + lx, ey - 20, 4, P.ink);
  } else if (expr === 'shock') {
    ellipse(hx + lx * 0.5, hy + 20, 7, 9, '#7a2e2a');
    line(hx - 22 + lx, ey - 20, hx - 8 + lx, ey - 17, 4, P.ink);
    line(hx + 22 + lx, ey - 20, hx + 8 + lx, ey - 17, 4, P.ink);
  } else if (expr === 'smug') {
    ctx.beginPath(); ctx.arc(hx + 4, hy + 10, 12, 0.15 * Math.PI, 0.6 * Math.PI); ctx.stroke();
  } else {
    line(hx - 8, hy + 18, hx + 8, hy + 18, 4, P.ink);
  }
  if (c.mustache) {
    ellipse(hx - 9, hy + 8, 11, 5, c.hairC, 0.2);
    ellipse(hx + 9, hy + 8, 11, 5, c.hairC, -0.2);
  }
  if (c.glasses) {
    ctx.strokeStyle = '#3a3040'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(hx - 15 + lx, ey, 11, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx + 15 + lx, ey, 11, 0, TAU); ctx.stroke();
    line(hx - 4 + lx, ey, hx + 4 + lx, ey, 3, '#3a3040');
  }
  if (c.shades) {
    rrect(hx - 29, ey - 8, 24, 15, 5, P.ink);
    rrect(hx + 5, ey - 8, 24, 15, 5, P.ink);
    line(hx - 6, ey - 3, hx + 6, ey - 3, 3, P.ink);
  }
  // hats
  if (c.hat === 'top') {
    ctx.save(); ctx.translate(hx, hy - 36); ctx.rotate(-0.08);
    ellipse(0, 0, 54, 9, P.ink);
    rrect(-33, -70, 66, 70, 5, P.ink);
    rect(-33, -16, 66, 11, P.red);
    ctx.restore();
  } else if (c.hat === 'hard') {
    ctx.fillStyle = '#f5c13b';
    ctx.beginPath(); ctx.ellipse(hx, hy - 24, 48, 40, 0, Math.PI, 0); ctx.fill();
    rrect(hx - 58, hy - 28, 116, 12, 6, '#e5a92a');
    rect(hx - 6, hy - 64, 12, 36, '#e5a92a');
  }
  if (o.hold) o.hold();
  ctx.restore();
}

// ---------------------------------------------------------------- money
function bill(o = {}) {
  const w = o.w || 120, h = w * 0.5;
  rrect(-w / 2, -h / 2, w, h, w * 0.06, o.c1 || P.bill);
  ctx.strokeStyle = o.c2 || P.bill2;
  ctx.lineWidth = w * 0.03;
  ctx.beginPath(); ctx.roundRect(-w / 2 + w * 0.07, -h / 2 + w * 0.06, w * 0.86, h - w * 0.12, w * 0.03); ctx.stroke();
  circle(0, 0, h * 0.3, o.c3 || P.bill3);
  text('$', 0, h * 0.02, { size: h * 0.42, weight: 800, color: o.c2 || P.bill2 });
  circle(-w * 0.33, 0, h * 0.09, o.c2 || P.bill2);
  circle(w * 0.33, 0, h * 0.09, o.c2 || P.bill2);
}
function coin(r = 40, o = {}) {
  circle(0, r * 0.08, r, o.edge || P.gold2);
  circle(0, 0, r, o.c || P.gold);
  ring(0, 0, r * 0.78, r * 0.08, o.edge || P.gold2);
  if (!o.blank) text(o.sym || '$', 0, r * 0.04, { size: r * 1.0, weight: 800, fam: 'serif', color: o.edge || P.gold2 });
  // shine
  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.9, Math.PI * 1.1, Math.PI * 1.45); ctx.arc(0, 0, r * 0.7, Math.PI * 1.45, Math.PI * 1.1, true); ctx.fill();
  ctx.restore();
}
// Stack of bills (for "a stack of new money")
function billStack(n, w = 130) {
  for (let i = 0; i < n; i++) {
    at(rr(i, 5, -4, 4), -i * 9, 1, rr(i, 6, -0.04, 0.04), () => {
      rrect(-w / 2, -w * 0.12, w, w * 0.24, 6, i % 2 ? P.bill2 : '#7fb46b');
      rect(-w * 0.12, -w * 0.12, w * 0.24, w * 0.24, '#f0e2b0');
    });
  }
}
// Flying bill with 3D flutter
function flyingBill(x, y, rot, flip, w = 110, a = 1) {
  alpha(a, () => at(x, y, 1, rot, () => {
    ctx.scale(1, Math.max(0.08, Math.abs(Math.cos(flip))));
    bill({ w, c1: Math.cos(flip) < 0 ? '#8dbc74' : P.bill });
  }));
}

// ---------------------------------------------------------------- food / prices
function bread(s = 1) {
  at(0, 0, s, 0, () => {
    ellipse(0, 6, 62, 30, '#b8743f');
    ellipse(0, 0, 62, 30, '#d9954f');
    ctx.strokeStyle = '#f2c88a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 26 - 10, -16); ctx.lineTo(i * 26 + 8, 10); ctx.stroke(); }
  });
}
function priceTag(label, o = {}) {
  const w = o.w || 170, h = o.h || 80, c = o.c || P.cream;
  poly([[-w / 2, -h / 2], [w / 2 - 22, -h / 2], [w / 2, 0], [w / 2 - 22, h / 2], [-w / 2, h / 2]], c);
  circle(w / 2 - 24, 0, 7, o.hole || P.navy);
  text(label, -10, 3, { size: o.size || 40, weight: 800, fam: 'serif', color: o.tc || P.ink });
}

// ---------------------------------------------------------------- buildings
function house(o = {}) {
  const w = o.w || 200, h = o.h || 150, body = o.body || P.cream, roof = o.roof || P.coral;
  rect(w * 0.18, -h - w * 0.42, w * 0.14, w * 0.3, o.chim || P.brown);
  poly([[-w / 2 - 16, -h + 4], [0, -h - w * 0.5], [w / 2 + 16, -h + 4]], roof);
  rect(-w / 2, -h, w, h, body);
  rect(-w / 2, -h, w, 10, 'rgba(0,0,0,0.08)');
  rrect(-w * 0.12, -h * 0.55, w * 0.24, h * 0.55, 6, o.door || P.brown2);
  rrect(-w * 0.4, -h * 0.72, w * 0.2, w * 0.2, 4, o.win || '#bfe0e6');
  rrect(w * 0.2, -h * 0.72, w * 0.2, w * 0.2, 4, o.win || '#bfe0e6');
}
function bankBuilding(o = {}) {
  const c = o.c || P.cream, d = o.d || P.navy3;
  poly([[-120, -150], [0, -215], [120, -150]], c);
  rect(-128, -150, 256, 16, d);
  for (let i = 0; i < 5; i++) rect(-104 + i * 48, -128, 22, 110, c);
  rect(-136, -18, 272, 18, c);
  rect(-150, 0, 300, 14, d);
  if (!o.noSym) text('$', 0, -170, { size: 42, weight: 900, fam: 'serif', color: o.sym || P.gold2 });
}
function capitol(o = {}) {
  const c = o.c || P.cream, d = o.d || P.navy3;
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(0, -130, 60, Math.PI, 0); ctx.fill();
  rect(-4, -226, 8, 30, c);
  circle(0, -228, 9, c);
  rect(-70, -132, 140, 14, d);
  for (let i = 0; i < 4; i++) rect(-58 + i * 36, -118, 18, 90, c);
  rect(-120, -28, 240, 28, c);
  rect(-130, 0, 260, 12, d);
}
function storefront(o = {}) {
  const c = o.c || P.cream;
  rect(-110, -150, 220, 150, c);
  for (let i = 0; i < 6; i++) {
    const x = -120 + i * 40;
    ctx.fillStyle = i % 2 ? P.cream : P.coral;
    ctx.beginPath(); ctx.moveTo(x, -176); ctx.lineTo(x + 40, -176); ctx.lineTo(x + 40, -140);
    ctx.arc(x + 20, -140, 20, 0, Math.PI); ctx.closePath(); ctx.fill();
  }
  rect(-124, -196, 248, 22, P.coral2);
  rrect(-80, -110, 70, 110, 5, P.brown2);
  rrect(10, -110, 76, 60, 5, '#bfe0e6');
}
function chartIcon(p = 1, o = {}) {
  line(-90, 70, -90, -80, 8, o.axis || P.navy3);
  line(-90, 70, 100, 70, 8, o.axis || P.navy3);
  const pts = [[-70, 40], [-30, 10], [0, 25], [40, -30], [80, -70]];
  strokePartial(pts, p, 12, o.c || P.teal);
  if (p > 0.95) arrowHead(80, -70, -0.78, 22, o.c || P.teal);
}
function jar(level, o = {}) {
  const w = o.w || 170, h = o.h || 220;
  // glass
  rrect(-w / 2, -h, w, h, 26, 'rgba(210,235,240,0.35)');
  // contents
  const fh = (h - 20) * clamp(level);
  ctx.save();
  ctx.beginPath(); ctx.roundRect(-w / 2 + 8, -h + 8, w - 16, h - 16, 20); ctx.clip();
  rect(-w / 2, -fh - 8, w, fh + 8, o.fill || P.bill);
  for (let i = 0; i < 10; i++) {
    const yy = -rnd(i, 3) * fh;
    if (fh > 10) at(rr(i, 4, -w * 0.3, w * 0.3), yy - 8, 0.45, rr(i, 5, -0.6, 0.6), () => bill({ w: 110 }));
  }
  ctx.restore();
  ctx.strokeStyle = o.stroke || 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h, w, h, 26); ctx.stroke();
  rrect(-w / 2 - 10, -h - 26, w + 20, 30, 10, o.lid || P.gold2);
  // highlight
  alpha(0.5, () => rrect(-w / 2 + 16, -h + 26, 12, h * 0.55, 6, '#ffffff'));
}
function magnifier(o = {}) {
  line(60, 60, 150, 150, 26, o.handle || P.brown2);
  ring(0, 0, 90, 16, o.rim || P.ink);
  alpha(0.18, () => circle(0, 0, 84, '#ffffff'));
}
function lilyPad(r = 40, rot = 0, c = P.green) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, rot + 0.35, rot + TAU - 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) {
    const a = rot + 0.8 + k * 1.1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8); ctx.stroke();
  }
}
function upArrow(size, c) {
  poly([[0, -size], [size * 0.7, -size * 0.2], [size * 0.25, -size * 0.2], [size * 0.25, size * 0.8], [-size * 0.25, size * 0.8], [-size * 0.25, -size * 0.2], [-size * 0.7, -size * 0.2]], c);
}
function checkMark(size, c, w = 12) {
  strokePoly([[-size * 0.5, 0], [-size * 0.12, size * 0.4], [size * 0.55, -size * 0.45]], w, c);
}
function crossMark(size, c, w = 12) {
  line(-size / 2, -size / 2, size / 2, size / 2, w, c);
  line(size / 2, -size / 2, -size / 2, size / 2, w, c);
}
function sparkle(x, y, r, c = P.gold3, rot = 0) {
  if (r <= 0) return;
  at(x, y, r, rot, () => {
    poly([[0, -1], [0.22, -0.22], [1, 0], [0.22, 0.22], [0, 1], [-0.22, 0.22], [-1, 0], [-0.22, -0.22]], c);
  });
}
function clockIcon(r, c = P.ink, t = 0) {
  circle(0, 0, r, P.cream);
  ring(0, 0, r, r * 0.14, c);
  line(0, 0, 0, -r * 0.6, r * 0.12, c);
  const a = t * 3;
  line(0, 0, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.12, c);
}
function medal(r = 50) {
  poly([[-30, -90], [-8, -90], [10, -30], [-12, -30]], P.coral);
  poly([[30, -90], [8, -90], [-10, -30], [12, -30]], P.teal);
  at(0, 10, 1, 0, () => coin(r, { sym: '1' }));
}
function compass(r = 55, t = 0) {
  circle(0, 0, r, P.cream);
  ring(0, 0, r, 9, P.gold2);
  at(0, 0, 1, Math.sin(t * 2) * 0.3 + 0.5, () => {
    poly([[0, -r * 0.75], [r * 0.18, 0], [-r * 0.18, 0]], P.coral);
    poly([[0, r * 0.75], [r * 0.18, 0], [-r * 0.18, 0]], P.navy3);
  });
  circle(0, 0, 6, P.ink);
}
function vault(r = 55) {
  rrect(-r, -r, 2 * r, 2 * r, 14, P.cream);
  ring(0, 0, r * 0.62, 9, P.gold2);
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3;
    line(0, 0, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 7, P.navy3);
  }
  circle(0, 0, 10, P.navy3);
}
