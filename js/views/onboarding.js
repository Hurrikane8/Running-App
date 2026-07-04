// Multi-step onboarding interview → profile → generated plan.

import { loadState, saveState } from '../storage.js';
import { GOALS, generatePlan, planWeeksFor } from '../plangen.js';
import { vdotFromRace, DEFAULT_VDOT } from '../paces.js';
import { esc, unitToKm, todayStr, addDays } from '../util.js';

const RACE_INPUT_DISTS = [
  { key: '1mi', label: '1 mile', km: 1.609 },
  { key: '5k', label: '5K', km: 5 },
  { key: '10k', label: '10K', km: 10 },
  { key: 'half', label: 'Half marathon', km: 21.0975 },
  { key: 'marathon', label: 'Marathon', km: 42.195 },
];

const INJURY_OPTS = [
  ['knee', 'Knee pain'], ['shin', 'Shin splints'], ['achilles', 'Achilles / calf'],
  ['plantar', 'Plantar fascia / foot'], ['itb', 'IT band / hip'], ['back', 'Lower back'],
];

const draft = {
  goal: null, raceDate: null, experience: null,
  units: 'km', weeklyDist: '', daysPerWeek: null,
  refDist: '', refH: '', refM: '', refS: '',
  injuries: [],
};

let step = 0;
let rerender = null;

const steps = [stepWelcome, stepGoal, stepRaceDate, stepExperience, stepAbility, stepDays, stepInjuries, stepUnitsConfirm];

export function renderOnboarding(container, onDone) {
  rerender = () => renderOnboarding(container, onDone);
  const total = steps.length;
  const bars = Array.from({ length: total - 1 }, (_, i) =>
    `<i class="${i < step ? 'on' : ''}"></i>`).join('');
  container.innerHTML = `
    ${step > 0 ? `<div class="ob-progress">${bars}</div>` : ''}
    <div class="ob-step">${steps[step](onDone)}</div>
  `;
  wire(container, onDone);
}

function navButtons(canNext, nextLabel = 'Continue') {
  return `<div class="ob-nav">
    ${step > 0 ? '<button class="btn back" data-act="back">←</button>' : ''}
    <button class="btn primary" data-act="next" ${canNext ? '' : 'disabled'}>${nextLabel}</button>
  </div>`;
}

function stepWelcome() {
  return `
    <div style="padding-top:12vh; text-align:center">
      <svg viewBox="0 0 24 24" style="width:64px;height:64px;color:var(--accent)" aria-hidden="true">
        <path d="M3 17 L10 10 L14 14 L21 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <h1 style="font-size:34px">Stride</h1>
      <p class="lead" style="max-width:340px;margin:8px auto 30px">
        Your personal running coach. Answer a few questions and get an
        adaptive, science-based training plan — stored only on this device.
      </p>
      <button class="btn primary" data-act="next" style="max-width:280px">Build my plan</button>
    </div>`;
}

function stepGoal() {
  const opts = Object.entries(GOALS).map(([k, g]) => `
    <button class="opt ${draft.goal === k ? 'selected' : ''}" data-goal="${k}">
      ${g.label}
      ${k === 'fitness' ? '<small>No race — build fitness &amp; consistency</small>' : ''}
    </button>`).join('');
  return `
    <h1>What are you training for?</h1>
    <p class="lead">Pick a race distance, or train for general fitness.</p>
    <div class="opt-grid two">${opts}</div>
    ${navButtons(!!draft.goal)}`;
}

function stepRaceDate() {
  const g = GOALS[draft.goal];
  const min = addDays(todayStr(), 14);
  const max = addDays(todayStr(), 400);
  let note = '';
  if (draft.raceDate) {
    const weeks = planWeeksFor(draft.goal, draft.raceDate);
    note = weeks < g.minWeeks
      ? `<p class="hint">⚠ That's ${weeks} weeks away — shorter than the recommended ${g.minWeeks}+ weeks for a ${g.label}. The plan will be compressed; adjust expectations accordingly.</p>`
      : `<p class="hint">That gives you a ${weeks}-week plan — a good runway for a ${g.label}.</p>`;
  }
  return `
    <h1>When is your race?</h1>
    <p class="lead">The plan length, build and taper are calculated from this date.</p>
    <div class="field">
      <label>Race date</label>
      <input type="date" id="ob-racedate" min="${min}" max="${max}" value="${draft.raceDate || ''}">
    </div>
    ${note}
    ${navButtons(!!draft.raceDate)}`;
}

function stepExperience() {
  const opts = [
    ['beginner', 'Beginner', 'New to running, or returning after a long break'],
    ['intermediate', 'Intermediate', 'Running regularly for 1–3 years, some races done'],
    ['advanced', 'Advanced', 'Several years of structured training and racing'],
    ['elite', 'Competitive', 'High volume, racing at a high level'],
  ].map(([k, l, d]) => `
    <button class="opt ${draft.experience === k ? 'selected' : ''}" data-exp="${k}">
      ${l}<small>${d}</small>
    </button>`).join('');
  return `
    <h1>Your running experience</h1>
    <p class="lead">This sets how aggressive the plan can safely be.</p>
    <div class="opt-grid">${opts}</div>
    ${navButtons(!!draft.experience)}`;
}

function stepAbility() {
  const distOpts = RACE_INPUT_DISTS.map((d) =>
    `<option value="${d.key}" ${draft.refDist === d.key ? 'selected' : ''}>${d.label}</option>`).join('');
  return `
    <h1>Current fitness</h1>
    <p class="lead">Your typical week now, plus a recent race or time trial if you have one — it makes your pace targets much more accurate.</p>
    <div class="field">
      <label>Current weekly distance (${draft.units})</label>
      <input type="number" inputmode="decimal" min="0" max="300" id="ob-weekly" value="${esc(draft.weeklyDist)}" placeholder="e.g. 20">
    </div>
    <div class="field">
      <label>Recent race / time trial (optional)</label>
      <select id="ob-refdist">
        <option value="">None — estimate from experience</option>
        ${distOpts}
      </select>
    </div>
    <div class="field-row" id="ob-reftime" ${draft.refDist ? '' : 'hidden'}>
      <div class="field"><label>Hours</label><input type="number" inputmode="numeric" min="0" max="30" id="ob-h" value="${esc(draft.refH)}" placeholder="0"></div>
      <div class="field"><label>Minutes</label><input type="number" inputmode="numeric" min="0" max="59" id="ob-m" value="${esc(draft.refM)}" placeholder="25"></div>
      <div class="field"><label>Seconds</label><input type="number" inputmode="numeric" min="0" max="59" id="ob-s" value="${esc(draft.refS)}" placeholder="0"></div>
    </div>
    <p class="hint">No recent time? No problem — you can run a time trial later and update your fitness in Settings.</p>
    ${navButtons(abilityValid())}`;
}

function abilityValid() {
  const wd = parseFloat(draft.weeklyDist);
  if (!(wd >= 0)) return false;
  if (draft.refDist) {
    const t = refTimeSec();
    if (!t || t < 240) return false;
  }
  return true;
}

function refTimeSec() {
  return (parseInt(draft.refH || 0, 10) * 3600) + (parseInt(draft.refM || 0, 10) * 60) + parseInt(draft.refS || 0, 10);
}

function stepDays() {
  const opts = [2, 3, 4, 5, 6, 7].map((n) => `
    <button class="opt ${draft.daysPerWeek === n ? 'selected' : ''}" data-days="${n}" style="text-align:center">
      <b style="font-size:20px">${n}</b><small>days / week</small>
    </button>`).join('');
  return `
    <h1>How many days can you run?</h1>
    <p class="lead">Be realistic — a plan you can hit beats a plan you admire.</p>
    <div class="opt-grid two">${opts}</div>
    ${navButtons(!!draft.daysPerWeek)}`;
}

function stepInjuries() {
  const opts = INJURY_OPTS.map(([k, l]) => `
    <button class="opt ${draft.injuries.includes(k) ? 'selected' : ''}" data-injury="${k}">${l}</button>`).join('');
  return `
    <h1>Any current niggles?</h1>
    <p class="lead">Select anything bothering you now. The plan will progress more gently and offer low-impact substitutions.</p>
    <div class="opt-grid two">
      <button class="opt ${draft.injuries.length === 0 ? 'selected' : ''}" data-injury="none" style="grid-column:1/-1">All clear — no issues</button>
      ${opts}
    </div>
    ${navButtons(true)}`;
}

function stepUnitsConfirm() {
  const g = GOALS[draft.goal];
  const weeks = draft.goal === 'fitness' || !draft.raceDate ? 12 : planWeeksFor(draft.goal, draft.raceDate);
  return `
    <h1>Almost there</h1>
    <p class="lead">Choose your units, then we'll build the plan.</p>
    <div class="field">
      <label>Distance units</label>
      <div class="seg" id="ob-units">
        <button data-units="km" class="${draft.units === 'km' ? 'on' : ''}">Kilometres</button>
        <button data-units="mi" class="${draft.units === 'mi' ? 'on' : ''}">Miles</button>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <h3 style="margin-bottom:10px">Your plan</h3>
      <div class="pr-row"><span class="k">Goal</span><span class="v">${g.label}</span></div>
      ${draft.raceDate ? `<div class="pr-row"><span class="k">Race date</span><span class="v">${esc(draft.raceDate)}</span></div>` : ''}
      <div class="pr-row"><span class="k">Length</span><span class="v">${weeks} weeks</span></div>
      <div class="pr-row"><span class="k">Run days</span><span class="v">${draft.daysPerWeek} / week</span></div>
    </div>
    ${navButtons(true, 'Generate my plan')}`;
}

function buildProfile() {
  const weeklyKm = unitToKm(parseFloat(draft.weeklyDist) || 0, draft.units);
  let vdot;
  let refRace = null;
  if (draft.refDist) {
    const d = RACE_INPUT_DISTS.find((x) => x.key === draft.refDist);
    refRace = { distKm: d.km, timeSec: refTimeSec(), label: d.label };
    vdot = vdotFromRace(d.km, refRace.timeSec);
  } else {
    vdot = DEFAULT_VDOT[draft.experience];
  }
  return {
    goal: draft.goal,
    raceDate: draft.goal === 'fitness' ? null : draft.raceDate,
    experience: draft.experience,
    daysPerWeek: draft.daysPerWeek,
    weeklyKm,
    refRace,
    injuries: draft.injuries.slice(),
    vdot: Math.round(vdot * 10) / 10,
  };
}

function wire(container, onDone) {
  container.querySelectorAll('[data-goal]').forEach((b) =>
    b.addEventListener('click', () => { draft.goal = b.dataset.goal; rerender(); }));
  container.querySelectorAll('[data-exp]').forEach((b) =>
    b.addEventListener('click', () => { draft.experience = b.dataset.exp; rerender(); }));
  container.querySelectorAll('[data-days]').forEach((b) =>
    b.addEventListener('click', () => { draft.daysPerWeek = parseInt(b.dataset.days, 10); rerender(); }));
  container.querySelectorAll('[data-injury]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.injury;
      if (k === 'none') draft.injuries = [];
      else {
        const i = draft.injuries.indexOf(k);
        i >= 0 ? draft.injuries.splice(i, 1) : draft.injuries.push(k);
      }
      rerender();
    }));
  container.querySelectorAll('#ob-units [data-units]').forEach((b) =>
    b.addEventListener('click', () => { draft.units = b.dataset.units; rerender(); }));

  const dateInput = container.querySelector('#ob-racedate');
  if (dateInput) dateInput.addEventListener('change', () => { draft.raceDate = dateInput.value || null; rerender(); });

  const weekly = container.querySelector('#ob-weekly');
  const refdist = container.querySelector('#ob-refdist');
  const syncAbility = () => {
    draft.weeklyDist = container.querySelector('#ob-weekly')?.value ?? draft.weeklyDist;
    draft.refH = container.querySelector('#ob-h')?.value ?? draft.refH;
    draft.refM = container.querySelector('#ob-m')?.value ?? draft.refM;
    draft.refS = container.querySelector('#ob-s')?.value ?? draft.refS;
    const next = container.querySelector('[data-act="next"]');
    if (next) next.disabled = !abilityValid();
  };
  if (weekly) ['input', 'change'].forEach((ev) => container.addEventListener(ev, syncAbility));
  if (refdist) refdist.addEventListener('change', () => { draft.refDist = refdist.value; rerender(); });

  container.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.disabled) return;
      if (b.dataset.act === 'back') { step = prevStep(); rerender(); return; }
      if (step === steps.length - 1) {
        const state = loadState();
        state.settings.units = draft.units;
        state.profile = buildProfile();
        state.plan = generatePlan(state.profile);
        saveState();
        onDone();
        return;
      }
      step = nextStep();
      rerender();
    }));
}

function nextStep() {
  let s = step + 1;
  if (steps[s] === stepRaceDate && draft.goal === 'fitness') s++;
  return s;
}
function prevStep() {
  let s = step - 1;
  if (steps[s] === stepRaceDate && draft.goal === 'fitness') s--;
  return s;
}
