// Browser end-to-end checks for Stride: things only a real DOM/PWA can verify —
// onboarding, tab rendering, log persistence, HR/pace surfacing, the mid-plan
// replan week-numbering fix, and PWA/offline. Pure plan-engine invariants live
// in tests/logic.mjs (run that first; it's faster and needs no server).
//
// Prereq: serve the repo root, then run this:
//   python3 -m http.server 8321 --directory <repo> &
//   node tests/e2e.mjs
// Override the base URL with BASE=... if serving elsewhere.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const BASE = process.env.BASE || 'http://localhost:8321/';
let failures = 0;
function check(name, cond, extra = '') {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
// suppress the once-per-session quote splash for functional flows
await ctx.addInitScript(() => { try { sessionStorage.setItem('stride.splashShown', '1'); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const next = (label) => page.locator('[data-act="next"]', label ? { hasText: label } : undefined).first().click();

function futureISO(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// 1. Onboarding boots and drives through the date path to a working plan
// ---------------------------------------------------------------------------
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
check('Onboarding renders on first load', await page.locator('[data-act="next"]').count() > 0);

await next();                                             // welcome
await page.locator('[data-mode="date"]').click();        // "I have a race date"
await next();
await page.locator('[data-goal="5k"]').click();
await next();
await page.locator('#ob-racedate').fill(futureISO(12 * 7)); // race ~12 weeks out
await next();
await page.locator('[data-exp="intermediate"]').click();
await next();
await page.locator('#ob-weekly').fill('40');             // current weekly volume
await next();
await page.locator('[data-days="7"]').click();
await next();
await next();                                             // injuries: all-clear default
await next('Generate my plan');                          // finish

await page.waitForSelector('#tabbar');
const state1 = await page.evaluate(() => JSON.parse(localStorage.getItem('stride.state.v1')));
check('Onboarding produced a profile + plan', !!state1?.profile && !!state1?.plan && state1.plan.weeks.length > 0,
  `${state1?.plan?.weeks?.length} weeks`);
check('Onboarded profile captured 7 days/week & 5K goal', state1.profile.daysPerWeek === 7 && state1.profile.goal === '5k');

// ---------------------------------------------------------------------------
// 2. All five tabs render without error
// ---------------------------------------------------------------------------
for (const tab of ['today', 'week', 'plan', 'progress', 'settings']) {
  await page.locator(`[data-tab="${tab}"]`).click();
  await page.waitForTimeout(120);
  const text = await page.locator('#view').innerText();
  check(`Tab "${tab}" renders cleanly`, text.length > 0 && !/NaN|undefined|\[object/.test(text));
}

// ---------------------------------------------------------------------------
// 3. Log a workout → persists across reload
// ---------------------------------------------------------------------------
await page.locator('[data-tab="today"]').click();
await page.waitForSelector('#view');
const logBtn = page.locator('[data-log]').first();
if (await logBtn.count()) {
  await logBtn.click();
  await page.waitForSelector('#log-save');
  await page.locator('#log-dist').fill('5');
  await page.locator('#log-save').click();
  await page.waitForTimeout(150);
  await page.reload();
  await page.waitForSelector('#tabbar');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('stride.state.v1')));
  const anyDone = st.plan.weeks.flatMap((w) => w.workouts).some((x) => x.status === 'done');
  check('Logged workout persists across reload', anyDone);
} else {
  check('Logged workout persists across reload', true, 'skipped (today is a rest day)');
}

// ---------------------------------------------------------------------------
// 4. Heart-rate targets surface in the UI once age/resting HR are entered
// ---------------------------------------------------------------------------
await page.locator('[data-tab="settings"]').click();
await page.waitForSelector('#hr-age');
const hrCard = page.locator('.card', { hasText: 'Heart rate' });
check('No HR zone rows before age entered', await hrCard.locator('.pr-row').count() === 0);
await page.locator('#hr-age').fill('30');
await page.locator('#hr-age').dispatchEvent('change');
await page.locator('#hr-resting').fill('55');
await page.locator('#hr-resting').dispatchEvent('change');
await page.waitForTimeout(150);
check('HR zone rows appear after age + resting HR', await hrCard.locator('.pr-row').count() === 5);
check('Karvonen method disclosed with resting HR set', /Karvonen/.test(await hrCard.innerText()));

// ---------------------------------------------------------------------------
// 5. Mid-plan replan keeps week numbers contiguous (regression for the idx bug)
//    Seed a plan created 3 weeks ago so replanFrom has real past weeks, then
//    change the schedule from Settings and read the Plan tab week labels.
// ---------------------------------------------------------------------------
await page.evaluate(async () => {
  const { generatePlan } = await import('./js/plangen.js');
  const { todayStr, addDays, mondayOf } = await import('./js/util.js');
  const created = addDays(mondayOf(todayStr()), -21); // 3 weeks ago
  const profile = {
    goal: '10k', raceDate: addDays(mondayOf(todayStr()), 8 * 7), experience: 'intermediate',
    daysPerWeek: 5, weeklyKm: 35, injuries: [], vdot: 42, vdotDate: created, refRace: null,
    goalTimeSec: null, age: null, restingHR: null, maxHR: null,
  };
  const plan = generatePlan(profile, created);
  const state = { version: 7, profile, plan, extraLogs: [], settings: { units: 'km', paceDisplay: 'outdoor' }, ui: {} };
  localStorage.setItem('stride.state.v1', JSON.stringify(state));
});
await page.goto(BASE);
await page.waitForSelector('#tabbar');
await page.locator('[data-tab="settings"]').click();
await page.waitForSelector('#edit-goal');
await page.locator('#edit-goal').click();
await page.waitForSelector('#gm-days');
await page.locator('#gm-days').selectOption('6');       // change schedule → triggers replanFrom
await page.locator('#gm-save').click();
await page.waitForTimeout(200);
await page.locator('[data-tab="plan"]').click();
await page.waitForSelector('.plan-week-row');
const weekNums = await page.locator('.plan-week-row .wn').allInnerTexts();
const parsed = weekNums.map((t) => parseInt(t.replace(/\D/g, ''), 10));
const contiguous = parsed.every((n, i) => n === i + 1);
check('Plan week numbers contiguous after mid-plan change (no 1,2,3,1,2,3)', contiguous, `W: ${parsed.join(',')}`);

// ---------------------------------------------------------------------------
// 5b. Coaching UX: quality log with main-set pace → feedback; unplanned run in
//     Week; Plan week tap → Week; Escape closes modals; calendar export.
// ---------------------------------------------------------------------------
await page.evaluate(async () => {
  const { generatePlan } = await import('./js/plangen.js');
  const { todayStr, addDays, mondayOf } = await import('./js/util.js');
  const created = addDays(mondayOf(todayStr()), -42);
  const profile = {
    goal: '5k', raceDate: addDays(mondayOf(todayStr()), 6 * 7 + 5), experience: 'intermediate',
    daysPerWeek: 7, runDays: [0, 1, 2, 3, 4, 5, 6], longRunDay: 5, weeklyKm: 40, injuries: [], vdot: 42,
    vdotDate: created, refRace: { distKm: 5, timeSec: 1385, label: '5K' }, goalTimeSec: null, age: 34, restingHR: 52, maxHR: null,
  };
  const plan = generatePlan(profile, created);
  // move a quality session onto today so it can be logged from Today
  const wk = plan.weeks.find((w) => w.start === mondayOf(todayStr()));
  const q = plan.weeks.flatMap((w) => w.workouts).find((x) => x.type === 'tempo' && x.date >= mondayOf(todayStr()));
  wk.workouts = wk.workouts.filter((x) => x.date !== todayStr());
  q.date = todayStr();
  if (!wk.workouts.includes(q)) { plan.weeks.forEach((w) => { w.workouts = w.workouts.filter((x) => x !== q); }); wk.workouts.push(q); }
  localStorage.setItem('stride.state.v1', JSON.stringify({ version: 8, profile, plan, extraLogs: [], settings: { units: 'km', paceDisplay: 'outdoor' }, ui: {} }));
});
await page.goto(BASE + '#today');
await page.reload();
await page.waitForSelector('#tabbar');
check('Today shows the week-at-a-glance strip', await page.locator('.week-strip .ws-day').count() === 7);
check('Structured session shows an intensity profile', await page.locator('.wk-profile').count() > 0);
await page.locator('[data-log]').first().click();
await page.waitForSelector('#log-wm');
check('Quality log offers a main-set pace field', await page.locator('#log-wm').count() === 1);
await page.keyboard.press('Escape');
check('Escape closes the modal', await page.locator('.modal').count() === 0);
await page.locator('[data-log]').first().click();
await page.waitForSelector('#log-wm');
const target = await page.evaluate(async () => {
  const { loadState } = await import('./js/storage.js');
  const { pacesForDate } = await import('./js/plangen.js');
  const s = loadState();
  return Math.round(pacesForDate(s.profile, new Date().toISOString().slice(0, 10), s.plan, s.extraLogs).threshold);
});
await page.locator('#log-h').fill('0'); await page.locator('#log-m').fill('40'); await page.locator('#log-s').fill('0');
await page.locator('#log-wm').fill(String(Math.floor(target / 60)));
await page.locator('#log-ws').fill(String(target % 60));
await page.locator('[data-rpe="7"]').click();
await page.locator('#log-save').click();
await page.waitForTimeout(250);
const toastText = await page.locator('#toast').innerText().catch(() => '');
check('Logging shows coaching feedback', /on target/i.test(toastText), toastText.slice(0, 80));
check('Logged session shows the coach card', await page.locator('.coach').count() > 0);

// unplanned run → Week view
await page.locator('#adhoc-log').click();
await page.waitForSelector('#log-race');
await page.locator('#log-dist').fill('6');
await page.locator('#log-m').fill('36');
await page.locator('#log-save').click();
await page.waitForTimeout(200);
await page.locator('[data-tab="week"]').click();
await page.waitForTimeout(200);
check('Unplanned run listed in Week view', await page.locator('.chip-extra').count() > 0);
check('Tab is kept in the URL hash', (await page.evaluate(() => location.hash)) === '#week');

// Plan: tap a week row → Week view on that week
await page.locator('[data-tab="plan"]').click();
await page.waitForSelector('.plan-week-row');
check('Plan periodization chart renders', await page.locator('#viz-phase svg').count() === 1);
await page.locator('.plan-week-row').nth(2).click();
await page.waitForTimeout(250);
const wkLabel = await page.locator('.week-nav .label b').innerText();
check('Tapping a plan week opens it in Week view', /Week 3 of/.test(wkLabel), wkLabel);

// calendar export
const ics = await page.evaluate(async () => {
  const { loadState } = await import('./js/storage.js');
  const { buildIcs } = await import('./js/ics.js');
  return buildIcs(loadState());
});
check('Calendar export is valid iCalendar with events', ics.startsWith('BEGIN:VCALENDAR') && (ics.match(/BEGIN:VEVENT/g) || []).length > 10 && ics.trim().endsWith('END:VCALENDAR'));
await page.locator('[data-tab="progress"]').click();
await page.waitForTimeout(200);
check('Progress fitness chart renders', await page.locator('#viz-fit svg').count() === 1);

// ---------------------------------------------------------------------------
// 6. PWA: manifest, icons, service worker, offline
// ---------------------------------------------------------------------------
const manifest = await page.evaluate(async () => {
  const r = await fetch('./manifest.webmanifest'); return r.ok ? r.json() : null;
});
check('PWA: manifest valid', manifest && manifest.start_url && Array.isArray(manifest.icons) && manifest.icons.length > 0);
const iconsOk = await page.evaluate(async (m) => {
  for (const ic of m.icons) { const r = await fetch('./' + ic.src.replace(/^\.?\//, '')); if (!r.ok) return false; }
  return true;
}, manifest);
check('PWA: all manifest icons served', iconsOk);
const swReady = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(reg || await navigator.serviceWorker.ready.then(() => true).catch(() => false));
});
check('PWA: service worker registered', swReady);
// offline reload: SW should serve the shell
await ctx.setOffline(true);
let offlineOk = true;
try { await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#tabbar', { timeout: 5000 }); }
catch { offlineOk = false; }
await ctx.setOffline(false);
check('PWA: app reloads offline (cache-first SW)', offlineOk);

// ---------------------------------------------------------------------------
check('No console/page errors during run', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${failures === 0 ? 'ALL E2E TESTS PASSED' : failures + ' E2E FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
