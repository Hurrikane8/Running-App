// Pure-logic regression suite for Stride's plan engine, pace math, HR targets,
// and storage migrations. No browser or server needed — imports the ES modules
// directly under Node.  Run:  node tests/logic.mjs
//
// This is a property sweep: it generates plans across the full matrix of goal x
// experience x days/week x starting-volume and asserts invariants that must hold
// for EVERY plan, so a bug that only appears for one odd combination still trips
// a failure.  Companion UI/PWA checks live in tests/e2e.mjs.

import {
  GOALS, generatePlan, replanFrom, estimateRaceTime, pacesForDate,
  projectedRaceTime, racePaceForDate, reshuffleWeek, missedWorkouts,
  vdotBreakdown, vdotForDate, workPaceKey, pickKeyDays, defaultRunDays,
} from '../js/plangen.js';
import { readFileSync, readdirSync } from 'node:fs';
import { trainingPaces, vdotFromRace, predictRace } from '../js/paces.js';
import { estimateMaxHR, resolveMaxHR, targetHR, HR_ZONE_FRACTIONS } from '../js/hr.js';
import { STATE_VERSION, importState } from '../js/storage.js';
import { todayStr, addDays, mondayOf, diffDays, dayIndex } from '../js/util.js';

// localStorage stub so storage.js (importState/saveState) works headless.
globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

let failures = 0;
let observations = 0;
function check(name, cond, extra = '') {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
}
// A non-failing recorded observation (judgment calls / ultra tuning we watch but
// don't gate the build on).
function note(name, detail) {
  observations++;
  console.log(`NOTE  ${name} — ${detail}`);
}

const ROAD_GOALS = ['5k', '10k', 'half', 'marathon', 'fitness'];
const ALL_GOALS = Object.keys(GOALS);
const EXPERIENCES = ['beginner', 'intermediate', 'advanced', 'elite'];
const DAYS = [2, 3, 4, 5, 6, 7];
const START_VOL = [15, 30, 40, 60];

function makeProfile(goal, experience, daysPerWeek, weeklyKm, weeksOut) {
  const g = GOALS[goal];
  const raceDate = (goal === 'fitness') ? null : addDays(mondayOf(todayStr()), weeksOut * 7 + 5);
  return {
    goal, raceDate, experience, daysPerWeek, weeklyKm,
    injuries: [], vdot: 42, vdotDate: todayStr(), refRace: null,
    goalTimeSec: null, age: null, restingHR: null, maxHR: null,
  };
}

function workoutKm(x) {
  return x.distKm ?? (x.durMin && x.type !== 'xtrain' ? x.durMin / 7 : 0);
}

// ---------------------------------------------------------------------------
// 1. Plan-structure property sweep
// ---------------------------------------------------------------------------
console.log('\n=== plan-structure sweep ===');
let combos = 0;
let nanFail = 0, longFail = 0, dupDateFail = 0, idxFail = 0, raceFail = 0,
    preStartFail = 0, deloadFail = 0, phaseOrderFail = 0, taperFail = 0,
    recoveryFail = 0;
const growthViolationsRoad = [];
const growthViolationsUltra = [];
const PHASE_ORDER = { base: 0, build: 1, peak: 2, taper: 3 };

for (const goal of ALL_GOALS) {
  const ultra = GOALS[goal].ultra;
  for (const experience of EXPERIENCES) {
    for (const daysPerWeek of DAYS) {
      for (const weeklyKm of START_VOL) {
        const weeksOut = Math.max(GOALS[goal].minWeeks, 14);
        const profile = makeProfile(goal, experience, daysPerWeek, weeklyKm, weeksOut);
        combos++;
        let plan;
        try { plan = generatePlan(profile); } catch (e) {
          check(`generate ${goal}/${experience}/${daysPerWeek}d/${weeklyKm}km`, false, e.message);
          continue;
        }

        // idx unique + contiguous 0..n-1
        const idxs = plan.weeks.map((w) => w.idx);
        const idxOk = idxs.every((v, i) => v === i);
        if (!idxOk) { idxFail++; if (idxFail <= 3) note('idx not contiguous (generate)', `${goal}/${experience}/${daysPerWeek}d: ${idxs.join(',')}`); }

        let lastPhase = -1;
        let lastFullKm = null;
        for (const w of plan.weeks) {
          // no NaN/negative
          for (const x of w.workouts) {
            const bad = (x.distKm != null && !(x.distKm >= 0)) || (x.durMin != null && !(x.durMin >= 0));
            if (bad) { nanFail++; if (nanFail <= 3) note('bad workout value', `${goal}/${experience}/${daysPerWeek}d wk${w.idx + 1} ${x.type} dist=${x.distKm} dur=${x.durMin}`); }
          }
          if (!(w.targetKm >= 0)) { nanFail++; }

          // no two workouts on the same date
          const dates = w.workouts.map((x) => x.date);
          if (new Set(dates).size !== dates.length) { dupDateFail++; if (dupDateFail <= 3) note('duplicate date in week', `${goal}/${experience}/${daysPerWeek}d wk${w.idx + 1}`); }

          // long run is the longest run of the week (non-ultra, distance-based)
          if (!ultra) {
            const long = w.workouts.find((x) => x.type === 'long');
            const maxOther = Math.max(0, ...w.workouts.filter((x) => x.type !== 'long' && x.type !== 'race' && x.distKm).map((x) => x.distKm));
            if (long && long.distKm && maxOther > long.distKm + 0.01) { longFail++; if (longFail <= 3) note('long not longest', `${goal}/${experience}/${daysPerWeek}d wk${w.idx + 1}: long ${long.distKm} < other ${maxOther}`); }
          }

          // recovery runs never exceed easy runs in the same week
          const easyKms = w.workouts.filter((x) => x.type === 'easy' && x.distKm).map((x) => x.distKm);
          const recKms = w.workouts.filter((x) => x.type === 'recovery' && x.distKm).map((x) => x.distKm);
          if (easyKms.length && recKms.length && Math.min(...recKms) > Math.max(...easyKms) + 0.01) {
            recoveryFail++; if (recoveryFail <= 3) note('recovery > easy', `${goal}/${experience}/${daysPerWeek}d wk${w.idx + 1}`);
          }

          // no workout before plan creation
          if (w.workouts.some((x) => x.date < plan.createdAt)) { preStartFail++; }

          // phases monotonic
          if (PHASE_ORDER[w.phase] < lastPhase) { phaseOrderFail++; if (phaseOrderFail <= 3) note('phase out of order', `${goal}/${experience}/${daysPerWeek}d wk${w.idx + 1} ${w.phase}`); }
          lastPhase = Math.max(lastPhase, PHASE_ORDER[w.phase]);

          // full-load growth (skip week 1 ramp-in, deloads, taper)
          if (!w.deload && w.phase !== 'taper' && w.idx > 0) {
            const km = w.workouts.reduce((s, x) => s + workoutKm(x), 0);
            if (lastFullKm != null) {
              const jump = km - lastFullKm;
              // 2-run-day weeks are just long run + one session: a new session
              // format is an inherent step of a few km
              const slack = Math.max(lastFullKm * 0.11, daysPerWeek <= 2 ? 4.0 : 3.0);
              if (jump > slack + 0.01) {
                const rec = { combo: `${goal}/${experience}/${daysPerWeek}d/${weeklyKm}`, wk: w.idx + 1, from: Math.round(lastFullKm), to: Math.round(km), pct: ((jump / lastFullKm) * 100).toFixed(0) };
                (ultra ? growthViolationsUltra : growthViolationsRoad).push(rec);
              }
            }
            lastFullKm = km;
          }
        }

        // deloads present for long-enough plans
        if (plan.weeks.length >= 5 && !plan.weeks.some((w) => w.deload)) { deloadFail++; if (deloadFail <= 3) note('no deload', `${goal}/${experience}/${daysPerWeek}d`); }

        // race day present exactly on raceDate (non-fitness)
        if (goal !== 'fitness') {
          const races = plan.weeks.flatMap((w) => w.workouts).filter((x) => x.type === 'race');
          if (races.length !== 1 || races[0].date !== profile.raceDate) {
            raceFail++; if (raceFail <= 5) note('race-day placement', `${goal}/${experience}/${daysPerWeek}d/${weeklyKm}km: ${races.length} races, date ${races[0]?.date} vs ${profile.raceDate}`);
          }
          // taper training load should ease toward the race. Compare each taper
          // week's NON-race running volume (the race workout itself is the full
          // race distance and legitimately dominates race-week volume, so it is
          // excluded from the trend).
          const taperWeeks = plan.weeks.filter((w) => w.phase === 'taper');
          const taperLoad = (wk) => wk.workouts.filter((x) => x.type !== 'race').reduce((s, x) => s + workoutKm(x), 0);
          for (let i = 1; i < taperWeeks.length; i++) {
            if (taperLoad(taperWeeks[i]) > taperLoad(taperWeeks[i - 1]) + 0.6) { taperFail++; if (taperFail <= 5) note('taper load not decreasing', `${goal}/${experience}/${daysPerWeek}d wk${taperWeeks[i].idx + 1}: ${taperLoad(taperWeeks[i - 1]).toFixed(1)}→${taperLoad(taperWeeks[i]).toFixed(1)}`); }
          }
        }
      }
    }
  }
}
console.log(`(${combos} plans generated)`);
check('No NaN/negative workout or week values', nanFail === 0, `${nanFail} bad`);
check('No duplicate dates within a week', dupDateFail === 0, `${dupDateFail} weeks`);
check('Long run is longest run of week (non-ultra)', longFail === 0, `${longFail} weeks`);
check('Recovery run never longer than easy run', recoveryFail === 0, `${recoveryFail} weeks`);
check('No workout scheduled before plan creation', preStartFail === 0, `${preStartFail} weeks`);
check('Phases always in order base→build→peak→taper', phaseOrderFail === 0, `${phaseOrderFail} weeks`);
check('Deloads present in long-enough plans', deloadFail === 0, `${deloadFail} plans`);
check('Race day present exactly on race date', raceFail === 0, `${raceFail} plans`);
check('Taper volume monotonically decreasing', taperFail === 0, `${taperFail} weeks`);
check('Week idx contiguous after generatePlan', idxFail === 0, `${idxFail} plans`);
check('Road-race full-load growth within slack (≤11% or +3km)', growthViolationsRoad.length === 0,
  growthViolationsRoad.slice(0, 6).map((v) => `${v.combo} wk${v.wk} ${v.from}->${v.to} (${v.pct}%)`).join(' | '));
if (growthViolationsUltra.length) note('ultra full-load growth spikes (low priority per scope)',
  `${growthViolationsUltra.length} transitions, worst e.g. ` + growthViolationsUltra.sort((a, b) => b.pct - a.pct).slice(0, 3).map((v) => `${v.combo} wk${v.wk} ${v.from}->${v.to} (${v.pct}%)`).join(' | '));

// ---------------------------------------------------------------------------
// 2. replanFrom — mid-plan change (the confirmed bug lives here)
// ---------------------------------------------------------------------------
console.log('\n=== replanFrom (mid-plan change) ===');
{
  const created = addDays(mondayOf(todayStr()), -21); // 3 weeks ago
  const profile = makeProfile('10k', 'intermediate', 5, 35, 11);
  profile.vdotDate = created;
  const plan = generatePlan(profile, created);
  // log a workout in a past week to test preservation
  const pastWeek = plan.weeks[0];
  const someWorkout = pastWeek.workouts.find((x) => x.distKm);
  if (someWorkout) { someWorkout.status = 'done'; someWorkout.log = { distKm: someWorkout.distKm, durSec: 1800, rpe: 5 }; }

  const replanned = replanFrom(plan, { ...profile, daysPerWeek: 6 }, todayStr());
  const idxs = replanned.weeks.map((w) => w.idx);
  const contiguous = idxs.every((v, i) => v === i);
  check('replanFrom: week idx contiguous (no 1,2,3,1,2,3 restart)', contiguous, `idx: ${idxs.join(',')}`);

  const numbers = replanned.weeks.map((w) => w.idx + 1);
  const uniqueNumbers = new Set(numbers).size === numbers.length;
  check('replanFrom: displayed week numbers unique', uniqueNumbers, `Wk: ${numbers.join(',')}`);

  // past weeks preserved (weeks before current Monday kept)
  const curMonday = mondayOf(todayStr());
  const keptPast = replanned.weeks.filter((w) => w.start < curMonday).length;
  check('replanFrom: past weeks preserved', keptPast >= 3, `${keptPast} past weeks`);

  // logged workout survived
  const stillLogged = replanned.weeks.flatMap((w) => w.workouts).some((x) => x.status === 'done' && x.log);
  check('replanFrom: logged workout preserved', stillLogged);

  // deload cadence sanity: at most a reasonable number, and they exist
  check('replanFrom: still has deloads', replanned.weeks.some((w) => w.deload));
}

// ---------------------------------------------------------------------------
// 3. Week-1 scheduled vs entered volume (judgment call — measure, don't gate)
// Measured against a MONDAY start so the number reflects a full first week; a
// mid-week start legitimately trims days before "today" (partial first week),
// which is intended behaviour, not under-scheduling.
// ---------------------------------------------------------------------------
console.log('\n=== week-1 scheduled vs entered volume (full Monday-start week) ===');
const mondayStart = mondayOf(todayStr());
for (const daysPerWeek of [4, 5, 6, 7]) {
  const profile = makeProfile('5k', 'intermediate', daysPerWeek, 40, 12);
  profile.raceDate = addDays(mondayStart, 12 * 7);
  profile.vdotDate = mondayStart;
  const plan = generatePlan(profile, mondayStart);
  const wk1 = plan.weeks[0].targetKm;
  const gap = 40 - wk1;
  note(`5k/intermediate/${daysPerWeek}d, entered 40km`, `full week 1 = ${wk1}km (gap ${gap}km, ${Math.round(gap / 40 * 100)}%) — conservative intro, intended`);
}

// ---------------------------------------------------------------------------
// 4. Pace math
// ---------------------------------------------------------------------------
console.log('\n=== pace math ===');
{
  const p40 = trainingPaces(40), p50 = trainingPaces(50);
  check('Higher VDOT → faster easy pace', p50.easy[0] < p40.easy[0] && p50.easy[1] < p40.easy[1]);
  check('Higher VDOT → faster threshold', p50.threshold < p40.threshold);
  check('Zone ordering recovery > easy(slow) > threshold > interval > rep (sec/km)',
    p40.recovery[0] > p40.easy[0] && p40.easy[1] > p40.threshold && p40.threshold > p40.interval && p40.interval > p40.rep,
    `rec ${p40.recovery[0].toFixed(0)} easySlow ${p40.easy[0].toFixed(0)} thr ${p40.threshold.toFixed(0)} int ${p40.interval.toFixed(0)} rep ${p40.rep.toFixed(0)}`);
  check('Recovery band is 30-45s/km slower than easy at each edge',
    Math.abs((p40.recovery[0] - p40.easy[0]) - 45) < 0.6 && Math.abs((p40.recovery[1] - p40.easy[1]) - 30) < 0.6);

  // race pace matches projected finish / distance
  const profile = makeProfile('5k', 'intermediate', 5, 30, 12);
  const plan = generatePlan(profile);
  const proj = projectedRaceTime(profile, plan, []);
  const rp = racePaceForDate(profile, profile.raceDate, 5, plan, []);
  check('Race pace ≈ projected finish ÷ distance', Math.abs(rp - proj.projected / 5) < 0.5, `rp ${rp.toFixed(1)} vs ${(proj.projected / 5).toFixed(1)}`);
}

// ---------------------------------------------------------------------------
// 5. Heart rate (Karvonen + fallback)
// ---------------------------------------------------------------------------
console.log('\n=== heart rate ===');
{
  check('220-age', estimateMaxHR(30) === 190);
  const [lo, hi] = HR_ZONE_FRACTIONS.threshold;
  const kar = targetHR({ age: 30, restingHR: 55, maxHR: null }, 'threshold');
  check('Karvonen matches ((max-rest)*i)+rest',
    kar[0] === Math.round((190 - 55) * lo + 55) && kar[1] === Math.round((190 - 55) * hi + 55), JSON.stringify(kar));
  const fb = targetHR({ age: 30, restingHR: null, maxHR: null }, 'threshold');
  check('Fallback matches max*i', fb[0] === Math.round(190 * lo) && fb[1] === Math.round(190 * hi), JSON.stringify(fb));
  check('Karvonen ≠ fallback for same person', kar[0] !== fb[0] || kar[1] !== fb[1]);
  check('Max-HR override wins over 220-age', resolveMaxHR({ age: 30, restingHR: null, maxHR: 200 }) === 200);
  check('No age/override → null (no misleading guess)', targetHR({ age: null, restingHR: null, maxHR: null }, 'easy') === null);
  check('Rep pace has no HR zone', targetHR({ age: 30, restingHR: 55, maxHR: null }, 'rep') === null);
  check('Race pace has no HR zone', targetHR({ age: 30, restingHR: 55, maxHR: null }, 'racepace') === null);
}

// ---------------------------------------------------------------------------
// 6. Storage migrations v1..v7 (via importState + localStorage stub)
// ---------------------------------------------------------------------------
console.log('\n=== storage migrations ===');
{
  // Seed a v1-shaped backup and import it → should migrate to current version.
  const created = mondayOf(todayStr());
  const base = generatePlan(makeProfile('5k', 'intermediate', 5, 30, 12));
  const v1 = {
    version: 1,
    settings: { units: 'km' },
    profile: { goal: '5k', raceDate: base.raceDate, experience: 'intermediate', daysPerWeek: 5, weeklyKm: 30, injuries: [], vdot: 42, refRace: null },
    plan: base,
    extraLogs: [],
    ui: {},
  };
  // stale paceKeys the migrations should repair
  const recov = v1.plan.weeks.flatMap((w) => w.workouts).find((x) => x.type === 'recovery');
  if (recov) recov.paceKey = 'easy';
  const race = v1.plan.weeks.flatMap((w) => w.workouts).find((x) => x.type === 'race');
  if (race) race.paceKey = 'marathon';

  const migrated = importState(JSON.stringify(v1));
  check('v1 import → current STATE_VERSION', migrated.version === STATE_VERSION, `${migrated.version}`);
  check('migration: paceDisplay defaulted', migrated.settings.paceDisplay === 'outdoor');
  check('migration: vdotDate added', !!migrated.profile.vdotDate);
  check('migration: HR fields added as null', migrated.profile.age === null && migrated.profile.restingHR === null && migrated.profile.maxHR === null);
  const recov2 = migrated.plan.weeks.flatMap((w) => w.workouts).find((x) => x.type === 'recovery');
  check('migration v5: recovery paceKey → recovery', !recov2 || recov2.paceKey === 'recovery');
  const race2 = migrated.plan.weeks.flatMap((w) => w.workouts).find((x) => x.type === 'race');
  check('migration v6: race paceKey → racepace', !race2 || race2.paceKey === 'racepace');
}

// ---------------------------------------------------------------------------
// 7. reshuffleWeek — priority sessions survive
// ---------------------------------------------------------------------------
console.log('\n=== reshuffle ===');
{
  const profile = makeProfile('half', 'intermediate', 5, 40, 12);
  const plan = generatePlan(profile);
  // pick a mid week and pretend today is its Thursday with early workouts missed
  const wk = plan.weeks[3];
  const thursday = addDays(wk.start, 3);
  const longBefore = wk.workouts.find((x) => x.type === 'long');
  const ok = reshuffleWeek(plan, thursday);
  check('reshuffle returns true for a real week', ok === true);
  const wkAfter = plan.weeks.find((w) => w.start === wk.start);
  const longAfter = wkAfter.workouts.find((x) => x.type === 'long');
  check('reshuffle keeps the long run (not skipped)', !longBefore || (longAfter && longAfter.status !== 'skipped'));
  check('reshuffle leaves no planned workout in the past', missedWorkouts(plan, thursday).length === 0,
    `${missedWorkouts(plan, thursday).length} still past`);
}

// ---------------------------------------------------------------------------
// 8. Fitness evidence (regression: on-target sessions used to read as a big
//    fitness DROP because whole-session averages include warm-up/jogs)
// ---------------------------------------------------------------------------
console.log('\n=== fitness evidence ===');
{
  const today = todayStr();
  const created = addDays(mondayOf(today), -35);
  const profile = makeProfile('5k', 'intermediate', 7, 40, 7);
  profile.vdot = 42; profile.vdotDate = created;
  const fresh = () => generatePlan(profile, created);
  const past = (plan) => plan.weeks.flatMap((w) => w.workouts).filter((x) => x.date < today);
  const quality = (plan) => past(plan).filter((x) => workPaceKey(x));
  const base = vdotBreakdown(profile, today, null, []);
  const raceDay = profile.raceDate;
  const baseRace = vdotForDate(profile, raceDay, null, []);

  // (a) whole-session logs only (warm-up + jogs included) → no evidence at all
  const planA = fresh();
  for (const x of past(planA).filter((w) => w.type !== 'tt' && w.type !== 'race')) {
    const p = trainingPaces(42);
    x.status = 'done';
    x.log = { distKm: x.distKm || 5, durSec: Math.round((x.distKm || 5) * (p.easy[0] + p.easy[1]) / 2), rpe: 6 };
  }
  const bA = vdotBreakdown(profile, today, planA, []);
  check('Whole-session averages are not fitness evidence', bA.nPoints === 0 && Math.abs(bA.blended - base.blended) < 1e-9,
    `n=${bA.nPoints} blended ${bA.blended.toFixed(2)} vs ${base.blended.toFixed(2)}`);

  // (b) main sets run exactly at target (target = baseline pace on that day)
  const planB = fresh();
  let nQ = 0;
  for (const x of quality(planB)) {
    const key = workPaceKey(x);
    const target = pacesForDate(profile, x.date, null, [])[key];
    if (!target) continue;
    nQ++;
    x.status = 'done';
    x.log = { distKm: x.distKm, durSec: 2400, rpe: null, workPaceSec: target };
  }
  const bB = vdotBreakdown(profile, today, planB, []);
  check('On-target main sets leave fitness unchanged (±0.3)', nQ > 0 && Math.abs(bB.blended - base.blended) <= 0.3,
    `${nQ} sessions, blended ${bB.blended.toFixed(2)} vs baseline ${base.blended.toFixed(2)}`);
  const rB = vdotForDate(profile, raceDay, planB, []);
  check('On-target main sets keep the race-day projection (±0.3)', Math.abs(rB - baseRace) <= 0.3,
    `${rB.toFixed(2)} vs ${baseRace.toFixed(2)}`);

  // (c) RPE far above expectation lowers the reading
  const planC = fresh();
  for (const x of quality(planC)) {
    const key = workPaceKey(x);
    const target = pacesForDate(profile, x.date, null, [])[key];
    if (!target) continue;
    x.status = 'done';
    x.log = { distKm: x.distKm, durSec: 2400, rpe: 10, workPaceSec: target };
  }
  check('Main sets that felt far too hard lower fitness', vdotBreakdown(profile, today, planC, []).blended < base.blended - 0.2);

  // (d) a fast race lifts both today's fitness and the race-day projection
  const fastV = base.baseline + 2;
  const raceSec = predictRace(fastV, 5);
  const extra = [{ id: 'r', date: addDays(today, -3), distKm: 5, durSec: raceSec, rpe: 10, race: true }];
  const bD = vdotBreakdown(profile, today, null, extra);
  const rD = vdotForDate(profile, raceDay, null, extra);
  check('Fast race lifts today\'s fitness', bD.blended > base.blended + 0.5, `${bD.blended.toFixed(2)} vs ${base.blended.toFixed(2)}`);
  check('Fast race lifts the race-day projection by the same residual', Math.abs((rD - baseRace) - (bD.blended - base.blended)) < 0.05,
    `race-day +${(rD - baseRace).toFixed(2)} today +${(bD.blended - base.blended).toFixed(2)}`);
  // an unflagged hard ad-hoc run is not a race
  const unflagged = [{ ...extra[0], race: false }];
  check('Unflagged ad-hoc run is not evidence', vdotBreakdown(profile, today, null, unflagged).nPoints === 0);
  // evidence before the fitness anchor is superseded
  const old = [{ ...extra[0], date: addDays(created, -10) }];
  check('Evidence before vdotDate is ignored', vdotBreakdown(profile, today, null, old).nPoints === 0);
}

// ---------------------------------------------------------------------------
// 9. Training engine v2 — programming invariants across the sweep
// ---------------------------------------------------------------------------
console.log('\n=== training engine v2 ===');
{
  const KEY = new Set(['tempo', 'intervals', 'reps', 'mpace', 'hills', 'tt']);
  const cycd = (a, b) => Math.min(((b - a) % 7 + 7) % 7, ((a - b) % 7 + 7) % 7);
  let dayBeforeLong = 0, keyAdjacent = 0, deloadBeforeTaper = 0, noSharpener = 0, noHills = 0,
    stale = 0, capFail = 0, noTT = 0, mpLongFail = 0, plansChecked = 0;
  const capNotes = [];
  for (const goal of ROAD_GOALS) {
    for (const experience of EXPERIENCES) {
      for (const daysPerWeek of DAYS) {
        for (const weeklyKm of START_VOL) {
          const profile = makeProfile(goal, experience, daysPerWeek, weeklyKm, 14);
          const plan = generatePlan(profile);
          plansChecked++;
          const pre = plan.weeks.filter((w) => w.phase !== 'taper');
          const taper = plan.weeks.filter((w) => w.phase === 'taper');
          if (taper.length && pre.length && pre[pre.length - 1].deload) deloadBeforeTaper++;
          for (const w of plan.weeks) {
            const long = w.workouts.find((x) => x.type === 'long');
            const keys = w.workouts.filter((x) => KEY.has(x.type));
            const dow = (x) => dayIndex(x.date);
            if (long && daysPerWeek >= 4 && keys.some((k) => (dow(long) - dow(k) + 7) % 7 === 1)) dayBeforeLong++;
            if (daysPerWeek >= 5) {
              for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
                if (cycd(dow(keys[i]), dow(keys[j])) < 2) keyAdjacent++;
              }
            }
            // Daniels-style volume caps on the main set (with rounding slack)
            for (const k of keys) {
              if (!k.work?.km || daysPerWeek <= 2) continue; // 2-day weeks: session floors dominate
              const lim = { threshold: Math.max(0.15 * w.targetKm, 4.1), interval: Math.max(0.12 * w.targetKm, 3.3), rep: Math.max(0.08 * w.targetKm, 2.5) }[k.work.paceKey];
              if (lim && k.work.km > lim + 0.01) { capFail++; if (capNotes.length < 3) capNotes.push(`${goal}/${experience}/${daysPerWeek}d/${weeklyKm} wk${w.idx + 1} ${k.title} ${k.work.km}km of ${w.targetKm}`); }
            }
          }
          // hills in base (road plans with a base of 3+ weeks and a key slot)
          const base = plan.weeks.filter((w) => w.phase === 'base');
          if (base.length >= 3 && !base.some((w) => w.workouts.some((x) => x.type === 'hills'))) noHills++;
          // variety: threshold sessions don't all share one structure
          const tempos = plan.weeks.flatMap((w) => w.workouts).filter((x) => x.type === 'tempo').map((x) => x.structure.main);
          if (tempos.length >= 3 && new Set(tempos).size < 2) stale++;
          if (goal !== 'fitness') {
            const rw = plan.weeks[plan.weeks.length - 1];
            const race = rw.workouts.find((x) => x.type === 'race');
            const r = dayIndex(race.date);
            const runDays = defaultRunDays(daysPerWeek, 5);
            const canSharpen = [r - 3, r - 4, r - 5].some((d) => runDays.includes(d));
            if (canSharpen && !rw.workouts.some((x) => x.title === 'Race-week sharpener')) noSharpener++;
          }
          if (weeklyKm >= 10 && !plan.weeks[1]?.workouts.some((x) => x.type === 'tt')) noTT++;
          if (goal === 'marathon' && experience !== 'beginner' && weeklyKm >= 40 && daysPerWeek >= 4) {
            const maxLong = Math.max(...plan.weeks.flatMap((w) => w.workouts).filter((x) => x.type === 'long').map((x) => x.distKm));
            if (maxLong < 28) { mpLongFail++; note('marathon peak long run', `${experience}/${daysPerWeek}d/${weeklyKm}: ${maxLong} km`); }
          }
        }
      }
    }
  }
  console.log(`(${plansChecked} road plans checked)`);
  check('No key session the day before the long run (≥4 run days)', dayBeforeLong === 0, `${dayBeforeLong} weeks`);
  check('Key sessions at least 2 days apart (≥5 run days)', keyAdjacent === 0, `${keyAdjacent} pairs`);
  check('No deload in the week right before the taper', deloadBeforeTaper === 0, `${deloadBeforeTaper} plans`);
  check('Race week has a goal-pace sharpener', noSharpener === 0, `${noSharpener} plans`);
  check('Hill work appears in base', noHills === 0, `${noHills} plans`);
  check('Threshold sessions progress (not one repeated structure)', stale === 0, `${stale} plans`);
  check('Main-set volume within Daniels caps', capFail === 0, capNotes.join(' | '));
  check('No race time on file → time trial in week 2', noTT === 0, `${noTT} plans`);
  check('Marathon peak long run ≥ 28 km (intermediate+, 40+ km/wk)', mpLongFail === 0, `${mpLongFail} plans`);

  // default schedules: Tue/Thu key days around a Saturday long run
  check('5-day default: key days Tue+Thu', JSON.stringify(pickKeyDays(defaultRunDays(5, 5), 5, 2)) === '[1,3]',
    JSON.stringify(pickKeyDays(defaultRunDays(5, 5), 5, 2)));
  check('7-day default: key days Tue+Thu', JSON.stringify(pickKeyDays(defaultRunDays(7, 5), 5, 2)) === '[1,3]');
  check('Sunday long run: key days avoid Sat/Mon', pickKeyDays(defaultRunDays(6, 6), 6, 2).every((d) => d !== 5 && d !== 0));
}

// ---------------------------------------------------------------------------
// 10. replanFrom v2 — continuity across a mid-plan change
// ---------------------------------------------------------------------------
console.log('\n=== replan continuity ===');
{
  const created = addDays(mondayOf(todayStr()), -42); // 6 weeks in
  const profile = makeProfile('half', 'intermediate', 5, 40, 8);
  profile.vdotDate = created;
  const plan = generatePlan(profile, created);
  const curMonday = mondayOf(todayStr());
  const idxCur = plan.weeks.findIndex((w) => w.start === curMonday);
  const prevFull = plan.weeks.slice(0, idxCur).filter((w) => !w.deload).pop();
  const re = replanFrom(plan, { ...profile, daysPerWeek: 6, runDays: null }, todayStr());
  // first full (not partially-elapsed, non-deload) regenerated week
  const firstFull = re.weeks.find((w) => w.start > curMonday && !w.deload && w.phase !== 'taper');
  check('Replan keeps the training load (no drop to onboarding volume)',
    firstFull && firstFull.targetKm >= prevFull.targetKm * 0.85, `${prevFull.targetKm} → ${firstFull?.targetKm}`);
  const longOf = (w) => w?.workouts.find((x) => x.type === 'long')?.distKm || 0;
  check('Replan keeps long-run progression', longOf(firstFull) >= longOf(prevFull) * 0.9, `${longOf(prevFull)} → ${longOf(firstFull)}`);
  let run = 0, maxRun = 0;
  for (const w of re.weeks) { if (w.deload || w.phase === 'taper') run = 0; else maxRun = Math.max(maxRun, ++run); }
  check('Replan keeps the deload rhythm (≤4 load weeks in a row)', maxRun <= 4, `${maxRun}`);
  check('Replan keeps week numbering contiguous', re.weeks.every((w, i) => w.idx === i));

  // a week with a logged key session is left intact
  const plan2 = generatePlan(profile, created);
  const cur2 = plan2.weeks.find((w) => w.start === curMonday);
  const q = cur2.workouts.find((x) => ['tempo', 'intervals', 'hills', 'mpace', 'tt'].includes(x.type)) || cur2.workouts[0];
  q.status = 'done'; q.log = { distKm: q.distKm || 5, durSec: 1800, rpe: 7 };
  const before = JSON.stringify(cur2.workouts.map((x) => [x.date, x.type, x.distKm]));
  const re2 = replanFrom(plan2, { ...profile, daysPerWeek: 4, runDays: null }, todayStr());
  const after = JSON.stringify(re2.weeks.find((w) => w.start === curMonday).workouts.map((x) => [x.date, x.type, x.distKm]));
  check('Week with logged sessions is kept as-is (change applies next Monday)', before === after);
  check('Next week follows the new schedule', re2.weeks.find((w) => w.start === addDays(curMonday, 7))?.workouts.filter((x) => x.type !== 'xtrain').length <= 4);
}

// ---------------------------------------------------------------------------
// 11. Storage v7 → v8 upgrade & service-worker shell
// ---------------------------------------------------------------------------
console.log('\n=== v8 upgrade & SW shell ===');
{
  const created = addDays(mondayOf(todayStr()), -21);
  const profile = makeProfile('5k', 'intermediate', 7, 40, 8);
  profile.vdotDate = created;
  delete profile.runDays; delete profile.longRunDay;
  const plan = generatePlan(profile, created);
  const pastLogged = plan.weeks[0].workouts[0];
  pastLogged.status = 'done'; pastLogged.log = { distKm: 5, durSec: 1500, rpe: 3 };
  const cur = plan.weeks.find((w) => w.start === mondayOf(todayStr()));
  const curSig = JSON.stringify(cur.workouts.map((x) => x.id));
  const v7 = { version: 7, settings: { units: 'km', paceDisplay: 'outdoor' }, profile, plan, extraLogs: [], ui: {} };
  const m = importState(JSON.stringify(v7));
  check('v8: profile gains runDays + longRunDay', Array.isArray(m.profile.runDays) && m.profile.runDays.length === 7 && m.profile.longRunDay === 5);
  check('v8: past logs preserved', m.plan.weeks[0].workouts.some((x) => x.status === 'done' && x.log?.durSec === 1500));
  check('v8: current week untouched', JSON.stringify(m.plan.weeks.find((w) => w.start === mondayOf(todayStr())).workouts.map((x) => x.id)) === curSig);
  check('v8: future weeks regenerated with structured sessions',
    m.plan.weeks.filter((w) => w.start > mondayOf(todayStr())).flatMap((w) => w.workouts).some((x) => x.segments));
  check('v8: upgrade notice flagged', m.ui.planUpgraded === true);
  check('v8: week idx contiguous', m.plan.weeks.every((w, i) => w.idx === i));

  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const jsFiles = [
    ...readdirSync(new URL('../js/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `./js/${f}`),
    ...readdirSync(new URL('../js/views/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `./js/views/${f}`),
  ];
  const missing = jsFiles.filter((f) => !sw.includes(`'${f}'`));
  check('Service worker precaches every JS module', missing.length === 0, missing.join(', '));
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? 'ALL LOGIC TESTS PASSED' : failures + ' FAILURE(S)'} — ${observations} observation(s) recorded`);
process.exit(failures === 0 ? 0 : 1);
