// "Today" view: the day's session (with its intensity profile and targets),
// the week at a glance, post-run coaching, missed-workout reshuffle, and
// end-of-plan next steps.

import { loadState, saveState } from '../storage.js';
import { workoutsOn, weekOf, missedWorkouts, reshuffleWeek, GOALS, projectedRaceTime, replanFrom } from '../plangen.js';
import { todayStr, fmtDateLong, fmtTime, esc, diffDays, addDays, mondayOf, DAY_ABBR, fmtDateShort } from '../util.js';
import {
  chipFor, targetLine, structureRows, openLogModal, workoutProfile, logFeedback, feedbackHtml, logLine, toast,
} from '../wkfmt.js';

const go = (tab, detail = {}) => window.dispatchEvent(new CustomEvent('stride:navigate', { detail: { tab, ...detail } }));

export function renderToday(container, refresh) {
  const state = loadState();
  const { profile, plan, settings } = state;
  const today = todayStr();
  const week = weekOf(plan, today);
  const todays = workoutsOn(plan, today);
  const missed = missedWorkouts(plan, today);
  const g = GOALS[profile.goal];
  const evidence = { plan, extraLogs: state.extraLogs };
  const lastWeek = plan.weeks[plan.weeks.length - 1];
  const planOver = !week && lastWeek && today > addDays(lastWeek.start, 6);

  let html = `
    <header class="mast">
      <div class="mast-top">
        <span class="eyebrow">${fmtDateLong(today)}</span>
        ${week ? `<span class="mast-meta">Wk ${week.idx + 1} · <span class="phase-chip">${week.deload ? 'recovery' : week.phase}</span></span>` : ''}
      </div>
      <h1 class="screen-title">Today</h1>
    </header>
  `;

  // Countdown + race-day projection (same number as the Plan tab and the
  // race-day pace target)
  if (plan?.raceDate && diffDays(today, plan.raceDate) >= 0) {
    const days = diffDays(today, plan.raceDate);
    const proj = projectedRaceTime(profile, plan, state.extraLogs);
    const pred = proj?.projected ?? proj?.current;
    let goalNote = '';
    if (pred && profile.goalTimeSec && !g.ultra) {
      const diff = pred - profile.goalTimeSec;
      goalNote = `<div class="rs-goal">${diff <= 0 ? `goal ${fmtTime(profile.goalTimeSec)} ✓` : `goal ${fmtTime(profile.goalTimeSec)} · ${fmtTime(diff)} to find`}</div>`;
    }
    html += `<button class="race-strip" id="race-strip" aria-label="Open plan">
      <div>
        <div class="rs-days">${days}</div>
        <div class="rs-label">${days === 1 ? 'day' : 'days'} to ${esc(g.label)}</div>
      </div>
      ${pred && !g.ultra ? `<div class="rs-right">
        <div class="rs-pred">${fmtTime(pred)}</div>
        <div class="rs-label">projected finish</div>
        ${goalNote}
      </div>` : ''}
    </button>`;
  }

  // Week at a glance
  if (week) html += weekStrip(week, state, today);

  if (state.ui.planUpgraded) {
    html += `<div class="banner">
      <b>Your plan got smarter.</b> From next week: key sessions spaced Tue/Thu-style around your long run,
      workouts that progress week to week, race-specific goal-pace work, a proper taper, and time trials
      that calibrate your paces. Past weeks, this week and all your logs are unchanged.
      <div class="btn-row"><button class="btn ghost" id="dismiss-upgrade">Got it</button>
      <button class="btn secondary" id="see-plan">See the plan</button></div>
    </div>`;
  }

  // Missed-workout reshuffle offer
  if (missed.length && state.ui.reshuffleDismissed !== today) {
    html += `<div class="banner">
      <b>${missed.length === 1 ? 'A workout was missed' : `${missed.length} workouts were missed`} this week.</b>
      Want me to reshuffle the rest of the week so the key sessions still fit?
      <div class="btn-row">
        <button class="btn primary" id="do-reshuffle">Reshuffle my week</button>
        <button class="btn ghost" id="dismiss-reshuffle">Leave it</button>
      </div>
    </div>`;
  }

  if (planOver) {
    const race = !!plan.raceDate;
    html += `<div class="card today-hero spine" style="text-align:center">
      <div class="today-title" style="font-size:26px">${race ? 'Plan complete' : 'Block complete'}</div>
      <p style="color:var(--ink-2); margin:6px 0 4px">${race
        ? 'Race day has come and gone. Log the result if you haven\'t, take a few easy days, then pick the next goal.'
        : 'Twelve weeks of consistent work banked. The next block picks up from your current training load.'}</p>
      <div class="btn-row">${race
        ? '<button class="btn primary" id="next-goal">Set my next goal</button>'
        : '<button class="btn primary" id="next-block">Start the next 12-week block</button>'}</div>
    </div>`;
  } else if (!todays.length) {
    const next = nextWorkout(plan, today);
    html += `<div class="card today-hero rest-card">
      <div class="today-date">Rest day</div>
      <div class="today-title" style="margin-top:8px">Recover and absorb</div>
      <p style="color:var(--ink-2)">Adaptation happens between the sessions. Walk, stretch, eat well, sleep.</p>
      ${next ? `<button class="next-up" data-open-week="${mondayOf(next.date)}">
        <span class="today-date">${next.date === addDays(today, 1) ? 'Tomorrow' : fmtDateShort(next.date)}</span>
        <span class="next-row">${chipFor(next)}<b>${esc(next.title)}</b></span>
        <span class="w-sub">${targetLine(next, profile, settings, evidence)}</span>
      </button>` : ''}
    </div>`;
  }

  for (const w of todays) {
    const fb = w.status === 'done' && w.log ? logFeedback(w, w.log, profile, settings, evidence) : [];
    html += `<div class="card today-hero spine" data-wt="${w.type}" style="--spine-color: var(--wt-${w.type})">
      <div class="session-head">
        <span class="today-date">Today's session</span>
        ${chipFor(w)}
      </div>
      <div class="today-title">${esc(w.title)}</div>
      <div class="today-target">${targetLine(w, profile, settings, evidence)}</div>
      ${workoutProfile(w, profile, evidence)}
      <div class="structure">${structureRows(w, profile, settings, evidence)}</div>
      ${w.status === 'planned' && w.tip ? `<div class="tip">${esc(w.tip)}</div>` : ''}
      ${profile.injuries.length && w.status === 'planned' && ['tempo', 'intervals', 'reps', 'hills', 'mpace', 'tt'].includes(w.type)
        ? '<div class="tip">Niggle-aware: if anything hurts beyond a 3/10, swap this for the same duration at easy effort on a bike or elliptical.</div>' : ''}
      ${w.status === 'planned'
        ? `<div class="btn-row"><button class="btn primary" data-log="${w.id}">Log this workout</button></div>`
        : w.log ? `<div class="logged-line"><span class="chip done">✓ Logged</span> ${logLine(w.log, settings)}</div>
          ${feedbackHtml(fb)}
          <div class="btn-row"><button class="btn ghost small" data-edit="${w.id}">Edit log</button></div>` : ''}
    </div>`;
  }

  // Unplanned runs logged today
  for (const e of state.extraLogs.filter((x) => x.date === today)) {
    html += `<button class="card extra-card" data-extra="${esc(e.id)}">
      <span class="chip chip-extra">${e.race ? 'Race' : 'Extra run'}</span>
      <span class="logged-line">${logLine(e, settings)}</span>
    </button>`;
  }

  html += `<button class="btn ghost" id="adhoc-log">+ Log an unplanned run</button>`;
  container.innerHTML = html;

  const afterLog = (info) => {
    refresh();
    if (!info) return;
    const fb = logFeedback(info.workout, info.log, profile, settings, evidence);
    toast(fb.length ? `<b>Saved.</b> ${esc(fb[0].text)}` : '<b>Saved.</b> Nice work.');
  };
  container.querySelectorAll('[data-log], [data-edit]').forEach((b) =>
    b.addEventListener('click', () => {
      const w = todays.find((x) => x.id === (b.dataset.log || b.dataset.edit));
      openLogModal(w, afterLog);
    }));
  container.querySelectorAll('[data-extra]').forEach((b) =>
    b.addEventListener('click', () => {
      const e = state.extraLogs.find((x) => x.id === b.dataset.extra);
      openLogModal(null, afterLog, e);
    }));
  container.querySelector('#adhoc-log')?.addEventListener('click', () => openLogModal(null, afterLog));
  container.querySelector('#race-strip')?.addEventListener('click', () => go('plan'));
  container.querySelectorAll('[data-open-week]').forEach((b) =>
    b.addEventListener('click', () => go('week', { week: b.dataset.openWeek })));
  container.querySelector('#do-reshuffle')?.addEventListener('click', () => {
    reshuffleWeek(state.plan, today);
    saveState();
    refresh();
  });
  container.querySelector('#dismiss-reshuffle')?.addEventListener('click', () => {
    state.ui.reshuffleDismissed = today;
    saveState();
    refresh();
  });
  container.querySelector('#dismiss-upgrade')?.addEventListener('click', () => {
    state.ui.planUpgraded = false; saveState(); refresh();
  });
  container.querySelector('#see-plan')?.addEventListener('click', () => {
    state.ui.planUpgraded = false; saveState(); go('plan');
  });
  container.querySelector('#next-goal')?.addEventListener('click', () => go('settings', { action: 'edit-goal' }));
  container.querySelector('#next-block')?.addEventListener('click', () => {
    state.plan = replanFrom(state.plan, profile, today);
    saveState();
    refresh();
  });
}

function nextWorkout(plan, today) {
  for (let i = 1; i <= 7; i++) {
    const w = plan.weeks.flatMap((wk) => wk.workouts).find((x) => x.date === addDays(today, i) && x.status === 'planned');
    if (w) return w;
  }
  return null;
}

// Mon–Sun strip: a dot per session in its run-type color, ✓ when done, a
// struck-through dot when missed, and a ring on today. Tap → Week view.
function weekStrip(week, state, today) {
  const cells = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(week.start, d);
    const ws = week.workouts.filter((x) => x.date === date);
    const extra = state.extraLogs.some((x) => x.date === date);
    const dots = ws.map((w) => {
      const missed = w.status === 'planned' && date < today && w.type !== 'race';
      const cls = w.status === 'done' ? 'done' : w.status === 'skipped' || missed ? 'missed' : '';
      return `<i class="ws-dot ${cls}" style="--c: var(--wt-${w.type})" title="${esc(w.title)}"></i>`;
    }).join('') + (extra ? '<i class="ws-dot done extra" title="Extra run"></i>' : '');
    cells.push(`<div class="ws-day ${date === today ? 'is-today' : ''} ${date < today ? 'past' : ''}">
      <span class="ws-name">${DAY_ABBR[d][0]}</span>
      <span class="ws-dots">${dots || '<i class="ws-rest"></i>'}</span>
    </div>`);
  }
  const planned = week.workouts.filter((x) => x.type !== 'xtrain');
  const done = planned.filter((x) => x.status === 'done').length;
  return `<button class="week-strip" data-open-week="${week.start}" aria-label="This week: ${done} of ${planned.length} sessions done. Open week">
    ${cells.join('')}
    <span class="ws-count">${done}/${planned.length}</span>
  </button>`;
}
