/* ==========================================================================
   Timeline: every beat is pinned to a narration cue, so re-recording the
   voice re-times the picture automatically.
   ========================================================================== */

const T = {};
const SFX = []; // { t, type, ...opts } consumed by the audio engine
const sfx = (type, t, o = {}) => SFX.push({ t, type, ...o });

/* world layout */
const LV = [20, 540, 1060, 1580]; // ledge tops, first → last in line
const LEDGE = [
  [60, 720],
  [360, 1020],
  [60, 720],
  [360, 1020],
];
const PX = [250, 830, 260, 830]; // where each person stands
const HX = [575, 600, 470, 600]; // where each person's money heap sits
const BX = [115, 955, 115, 955]; // baskets
const TAP0 = { x: 465, y: -618 }; // tap body (outlet = +110, +112)
const VIT = { x: 540, y: 1040 }; // savings note inside the vitrine
const TITLE = { x: 540, y: -470 };
const QY = -190; // the queue's ledge in the finale
const QX = [300, 490, 680, 870];

function initTimeline() {
  /* hook */
  T.nobody = Ws('hook1', 'nobody');
  T.touched = Ws('hook1', 'touched');
  T.your = Ws('hook1', 'your');
  T.money = Ws('hook1', 'money');
  T.h2 = L('hook2').start;
  T.so = Ws('hook2', 'so');
  T.why = Ws('hook2', 'why');
  T.is = Ws('hook2', 'is');
  T.it = Ws('hook2', 'it');
  T.shrink = Ws('hook2', 'shrinking');
  T.sq = [T.why + 0.02, T.it + 0.03, T.shrink + 0.34];
  /* leak → title */
  T.leak = L('leak').start;
  T.follow = Ws('leak', 'follow');
  T.find = Ws('leak', 'find');
  T.a300 = Ws('leak', 'a');
  T.y300 = Ws('leak', 'threehundredyearold');
  T.idea = Ws('leak', 'idea');
  T.the = Ws('title', 'the');
  T.cant = Ws('title', 'cantillon');
  T.effect = Ws('title', 'effect');
  T.titleEnd = L('title').end;
  T.formed = T.effect + 0.5;
  /* paris */
  T.paris = L('paris').start;
  T.y1720 = Ws('paris', 'seventeentwenty');
  T.parisW = Ws('paris', 'paris');
  T.printing = Ws('paris', 'printing');
  T.paper = Ws('paris', 'paper');
  T.crazy = Ws('paris', 'crazy');
  T.parisEnd = L('paris').end;
  T.banker = Ws('banker', 'banker');
  T.richard = Ws('banker', 'richard');
  T.cantW = Ws('banker', 'cantillon');
  T.got = Ws('banker', 'got');
  T.rich = Ws('banker', 'rich');
  T.bankerEnd = L('banker').end;
  T.figured = Ws('why', 'figured');
  T.whyW = Ws('why', 'why');
  T.whyEnd = L('why').end;
  /* the line */
  T.never = L('never').start;
  T.neverW = Ws('never', 'never');
  T.reaches = Ws('never', 'reaches');
  T.everyone = Ws('never', 'everyone');
  T.once = Ws('never', 'once');
  T.pours = Ws('pours', 'pours');
  T.one = Ws('pours', 'one');
  T.spot = Ws('pours', 'spot');
  T.flows = Ws('pours', 'flows');
  T.lineW = Ws('pours', 'line');
  T.first = L('first').start;
  T.firstW = Ws('first', 'first');
  T.spend = Ws('first', 'spend');
  T.todays = Ws('first', 'todays');
  T.prices1 = Ws('first', 'prices');
  T.pushes = Ws('pushes', 'pushes');
  T.up = Ws('pushes', 'up');
  T.next = L('next').start;
  T.nextW = Ws('next', 'next');
  T.person = Ws('next', 'person');
  T.money2 = Ws('next', 'money');
  T.after = Ws('next', 'after');
  T.cost = Ws('next', 'cost');
  T.more = Ws('next', 'more');
  T.end = L('end').start;
  T.endW = Ws('end', 'end');
  T.line2 = Ws('end', 'line');
  T.usually = Ws('end', 'usually');
  T.paycheck = Ws('end', 'paycheck');
  T.prices2 = Ws('end', 'prices');
  T.climbed = Ws('end', 'climbed');
  T.same = Ws('same', 'same');
  T.money3 = Ws('same', 'money');
  T.less = Ws('same', 'less');
  T.stuff = Ws('same', 'stuff');
  T.sameEnd = L('same').end;
  /* today */
  T.today = Ws('today', 'today');
  T.enters = Ws('today', 'enters');
  T.banks = Ws('today', 'banks');
  T.financial = Ws('today', 'financial');
  T.markets = Ws('today', 'markets');
  T.stocks = Ws('assets', 'stocks');
  T.homes = Ws('assets', 'homes');
  T.rise = Ws('assets', 'rise');
  T.first2 = Ws('assets', 'first');
  T.wages = Ws('assets', 'wages');
  T.last = Ws('assets', 'last');
  T.assetsEnd = L('assets').end;
  T.own = Ws('wave', 'own');
  T.assetsW = Ws('wave', 'assets');
  T.ride = Ws('wave', 'ride');
  T.waveW = Ws('wave', 'wave');
  T.dont = Ws('wave', 'dont');
  T.chase = Ws('wave', 'chase');
  T.waveEnd = L('wave').end;
  /* finale */
  T.stole = L('stole').start;
  T.stoleW = Ws('stole', 'stole');
  T.anything = Ws('stole', 'anything');
  T.winners = Ws('tap', 'winners');
  T.closer = Ws('tap', 'closer');
  T.tapW = Ws('tap', 'tap');
  T.tapEnd = L('tap').end;
  T.ask = L('ask').start;
  T.appears = Ws('ask', 'appears');
  T.askW = Ws('ask', 'ask');
  T.question = Ws('ask', 'question');
  T.who = Ws('question', 'who');
  T.gets = Ws('question', 'gets');
  T.it2 = Ws('question', 'it');
  T.first3 = Ws('question', 'first');
  T.qEnd = L('question').end;
  T.drop = T.qEnd + 0.75; // the question mark's dot lets go
  T.land = DUR - 0.95; // …and lands on the vitrine
  T.panUpStart = T.waveEnd + 0.3;

  /* derived beats */
  T.pressLand = T.printing + 0.3;
  T.stamps = [];
  {
    let s = T.pressLand + 0.18;
    while (s < T.bankerEnd + 0.2) {
      T.stamps.push(s);
      const k = prog(s, T.pressLand, T.crazy);
      s += lerp(0.46, 0.13, E.out2(k));
    }
  }
  T.zoomOut = T.never - 0.05;
  T.transfer = [
    // [start, end] of the heap moving level i → i+1
    [T.nextW - 0.05, T.money2 + 0.35],
    [T.end + 0.05, T.end + 0.8],
    [T.line2 - 0.25, T.usually + 0.1],
  ];
  T.buy = [
    [T.todays + 0.35, 0.14, 4], // start, gap, loaves
    [T.cost - 0.35, 0.18, 3],
    [T.transfer[1][1] + 0.12, 0.12, 2.5],
    [T.climbed - 0.3, 0.2, 2],
  ];
  T.priceSteps = [
    [-1, 1.0],
    [T.pushes + 0.08, 1.3],
    [T.more + 0.02, 1.6],
    [T.transfer[2][0] - 0.05, 2.0],
  ];
  T.overview = T.same - 0.55;
  T.chart = T.markets + 0.1;
  T.pourModern = [T.today + 0.55, T.banks + 0.1];
  T.transferModern = [T.financial - 0.2, T.markets + 0.35];

}

/* camera: one continuous move through the world */
function camKeyed(t) {
  const k = [
    // [t, x, y, z, ease]
    [0, 540, 960, 1],
    [T.leak - 0.15, 540, 985, 1.05, E.ioSine],
    [T.leak + 3.4, 540, TITLE.y + 120, 1, E.io4],
    [T.titleEnd + 0.4, 540, TITLE.y + 110, 1.04, E.ioSine],
    [T.paris + 0.8, 540, -250, 1, E.io3],
    [T.whyEnd, 540, -250, 1.02, E.ioSine],
    [T.never + 1.55, 540, 470, 0.56, E.io4],
    [T.lineW + 0.3, 540, 500, 0.58, E.ioSine],
    [T.firstW + 0.2, 540, -150, 0.94, E.io4],
    [T.nextW - 0.05, 540, -130, 0.95, E.ioSine],
    [T.money2 + 0.4, 540, 400, 0.95, E.io3],
    [T.end + 0.2, 540, 420, 0.95, E.ioSine],
    [T.line2 + 0.35, 540, 1440, 0.95, E.io3],
    [T.overview, 540, 1460, 0.96, E.ioSine],
    [T.same + 0.45, 540, 551, 0.66, E.io4],
    [T.today - 0.1, 540, 560, 0.66, E.ioSine],
    [T.today + 0.7, 540, 170, 0.76, E.io4],
    [T.chart, 540, 190, 0.76, E.ioSine],
    [T.chart + 1.0, 540, 960, 1, E.io4],
    [T.dont, 540, 960, 1, E.ioSine],
    [T.waveEnd + 0.1, 580, 975, 1, E.ioSine],
    [T.stole + 0.75, 540, -400, 1, E.io4],
    [T.question, 540, -390, 1.02, E.ioSine],
    [T.drop, 540, -400, 1.02, E.ioSine],
    [T.land, 540, 960, 1, E.io2],
    [DUR, 540, 960, 1],
  ];
  let i = 1;
  while (i < k.length - 1 && t > k[i][0]) i++;
  const a = k[i - 1];
  const b = k[i];
  const u = t <= a[0] ? 0 : (b[4] || E.io3)(prog(t, a[0], b[0]));
  return { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u), z: lerp(a[3], b[3], u), r: 0 };
}
/** full camera at time t (pure: keys + hand-held drift + impact shake) */
function camAt(t) {
  const c = camKeyed(t);
  if (t > T.drop && t <= T.land) {
    // follow the falling drop of money all the way down to the vitrine
    const u = E.io2(prog(t, T.drop, T.land));
    const c0 = camAt(T.drop);
    const d = dropFall(t);
    c.z = lerp(c0.z, 1, u);
    c.x = lerp(c0.x, 540, u);
    const fy = lerp(QL.dot[1], VIT.y - 296, u);
    c.y = d[1] - (fy - 960) / c.z;
  }
  const amp = REDUCED ? 0 : win(t, 0.3, DUR - 0.6, 1.5, 1.5);
  c.x += Math.sin(t * 0.73) * 3 * amp;
  c.y += Math.sin(t * 0.51 + 1) * 4 * amp;
  c.r = Math.sin(t * 0.37) * 0.0035 * amp;
  let sh = 0;
  for (const s of T.sq) sh += wob(t, s, 9, 12) * 5;
  sh += wob(t, T.pressLand, 10, 10) * 7;
  sh += wob(t, T.land, 10, 12) * 3;
  c.y += sh * amp;
  return c;
}
function camera(t) {
  Object.assign(CAM, camAt(t));
}
/** frame → world for a given camera */
function f2wC(c, x, y) {
  const dx = x - 540;
  const dy = y - 960;
  const co = Math.cos(-c.r);
  const si = Math.sin(-c.r);
  return [c.x + (dx * co - dy * si) / c.z, c.y + (dx * si + dy * co) / c.z];
}
