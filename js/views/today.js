// "Today" view: today's workout, missed-workout reshuffle offer, quick actions.

import { loadState, saveState } from '../storage.js';
import { workoutsOn, weekOf, missedWorkouts, reshuffleWeek, GOALS, goalPrediction } from '../plangen.js';
import { todayStr, fmtDateLong, fmtTime, esc, diffDays } from '../util.js';
import { chipFor, targetLine, structureRows, openLogModal } from '../wkfmt.js';

export function renderToday(container, refresh) {
  const state = loadState();
  const { profile, plan, settings } = state;
  const today = todayStr();
  const week = weekOf(plan, today);
  const todays = workoutsOn(plan, today);
  const missed = missedWorkouts(plan, today);
  const g = GOALS[profile.goal];
  const evidence = { plan, extraLogs: state.extraLogs };

  let html = `
    <header class="mast">
      <div class="mast-top">
        <span class="eyebrow">${fmtDateLong(today)}</span>
        ${week ? `<span class="mast-meta">Wk ${week.idx + 1} · <span class="phase-chip">${week.deload ? 'recovery' : week.phase}</span></span>` : ''}
      </div>
      <h1 class="screen-title">Today</h1>
    </header>
  `;

  // Countdown / goal strip — wide accent readout
  if (plan?.raceDate && diffDays(today, plan.raceDate) >= 0) {
    const days = diffDays(today, plan.raceDate);
    const pred = goalPrediction(profile, plan, state.extraLogs);
    html += `<div class="race-strip">
      <div>
        <div class="rs-days">${days}</div>
        <div class="rs-label">days to ${esc(g.label)}</div>
      </div>
      ${pred && !g.ultra ? `<div class="rs-right">
        <div class="rs-pred">${fmtTime(pred)}</div>
        <div class="rs-label">projected finish</div>
      </div>` : ''}
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

  if (!todays.length) {
    const done = plan?.raceDate && diffDays(today, plan.raceDate) < 0;
    html += `<div class="card today-hero" style="text-align:center">
      <div class="today-title" style="font-size:24px">${done ? 'Plan complete' : 'Rest day'}</div>
      <p style="color:var(--ink-2); margin-top:6px">${done
        ? 'Your race has passed. Head to Settings to set a new goal and keep rolling.'
        : 'Recovery is where the adaptation happens. Walk, stretch, sleep well.'}</p>
    </div>`;
  }

  for (const w of todays) {
    html += `<div class="card today-hero spine" data-wt="${w.type}" style="--spine-color: var(--wt-${w.type})">
      <div class="session-head">
        <span class="today-date">Today's session</span>
        ${chipFor(w)}
      </div>
      <div class="today-title">${esc(w.title)}</div>
      <div class="today-target">${targetLine(w, profile, settings, evidence)}</div>
      <div class="structure">${structureRows(w, profile, settings, evidence)}</div>
      ${w.tip ? `<div class="tip">${esc(w.tip)}</div>` : ''}
      ${profile.injuries.length && ['tempo', 'intervals', 'reps', 'hills'].includes(w.type)
        ? '<div class="tip">Niggle-aware: if anything hurts beyond a 3/10, swap this for the same duration at easy effort on a bike or elliptical.</div>' : ''}
      ${w.status === 'planned'
        ? '<div class="btn-row"><button class="btn primary" data-log="' + w.id + '">Log this workout</button></div>'
        : w.log ? `<p class="hint" style="margin-top:12px">Logged: ${targetLogLine(w, settings.units)}</p>` : ''}
    </div>`;
  }

  html += `<button class="btn ghost" id="adhoc-log">+ Log an unplanned run</button>`;

  container.innerHTML = html;

  container.querySelectorAll('[data-log]').forEach((b) =>
    b.addEventListener('click', () => {
      const w = todays.find((x) => x.id === b.dataset.log);
      openLogModal(w, refresh);
    }));
  container.querySelector('#adhoc-log')?.addEventListener('click', () => openLogModal(null, refresh));
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
}

function targetLogLine(w, units) {
  const parts = [];
  if (w.log.distKm) parts.push(`${(units === 'mi' ? w.log.distKm / 1.609344 : w.log.distKm).toFixed(1)} ${units}`);
  if (w.log.durSec) parts.push(fmtTime(w.log.durSec));
  if (w.log.rpe) parts.push(`RPE ${w.log.rpe}`);
  return parts.join(' · ');
}
