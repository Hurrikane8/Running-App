// Plan tab: race-day projection, the periodization at a glance (weekly
// volume shaded by phase), a tappable week-by-week list with each week's key
// sessions, and the session guide.

import { loadState } from '../storage.js';
import { GOALS, projectedRaceTime, estimateRaceTime, vdotForDate, vdotBreakdown } from '../plangen.js';
import { todayStr, addDays, esc, fmtDist, fmtTime, diffDays, mondayOf, kmToUnit } from '../util.js';
import { TYPE_INFO, typeChip, QUALITY_TYPES } from '../wkfmt.js';
import { phaseChart } from '../charts.js';

const go = (tab, detail = {}) => window.dispatchEvent(new CustomEvent('stride:navigate', { detail: { tab, ...detail } }));

export function renderPlan(container) {
  const state = loadState();
  const { plan, profile, settings } = state;
  const units = settings.units;
  const g = GOALS[profile.goal];
  const today = todayStr();
  const curMonday = mondayOf(today);

  const fb = vdotBreakdown(profile, today, plan, state.extraLogs);
  const evidenceLine = fb.nPoints > 0
    ? `<p class="hint" style="margin-top:6px">Adjusted by ${fb.nPoints} logged effort${fb.nPoints === 1 ? '' : 's'}: ${Math.abs(fb.residual).toFixed(1)} VDOT ${fb.residual >= 0 ? 'ahead of' : 'behind'} the plan's projection.</p>`
    : '<p class="hint" style="margin-top:6px">Log races, time trials and main-set paces and this projection calibrates to how you actually run.</p>';

  let hero = '';
  if (g.distKm) {
    const proj = projectedRaceTime(profile, plan, state.extraLogs);
    if (proj.projected != null) {
      let goalLine = '';
      if (profile.goalTimeSec) {
        const diff = proj.projected - profile.goalTimeSec;
        goalLine = `<div class="goal-line">Goal ${fmtTime(profile.goalTimeSec)} · ${diff <= 0
          ? `<span style="color:var(--good)">on track (${fmtTime(-diff)} to spare)</span>`
          : `<span style="color:var(--accent-text)">${fmtTime(diff)} to find</span>`}</div>`;
      }
      hero = `
        <div class="card today-hero spine">
          <div class="today-date">Projected ${esc(g.label)} finish</div>
          <div class="hero-num">${fmtTime(proj.projected)}</div>
          ${goalLine}
          <p class="hint" style="margin-top:4px">
            Today's fitness: ${fmtTime(proj.current)}. The projection assumes the plan is followed
            through race day (≈ +${proj.gain.toFixed(1)} VDOT).
            ${g.ultra ? '<br>Ultra estimates assume a flat, runnable course. Terrain and vert add time.' : ''}
          </p>
          ${evidenceLine}
        </div>`;
    } else {
      hero = `
        <div class="card today-hero spine">
          <div class="today-date">Estimated ${esc(g.label)} (today's fitness)</div>
          <div class="hero-num">${fmtTime(proj.current)}</div>
          <p class="hint" style="margin-top:6px">Race date has passed. Set a new goal in Settings for a fresh projection.</p>
          ${evidenceLine}
        </div>`;
    }
  } else {
    hero = `
      <div class="card today-hero spine">
        <div class="today-date">Estimated 5K at today's fitness</div>
        <div class="hero-num">${fmtTime(estimateRaceTime(vdotForDate(profile, today, plan, state.extraLogs), 5))}</div>
        <p class="hint" style="margin-top:6px">No race on the calendar. Set one in Settings to get a race-day projection.</p>
        ${evidenceLine}
      </div>`;
  }

  const daysToRace = plan.raceDate ? diffDays(today, plan.raceDate) : null;
  const peakKm = Math.max(...plan.weeks.map((w) => w.targetKm));
  const curWeek = plan.weeks.find((w) => w.start === curMonday);
  const stats = `
    <div class="week-summary">
      ${daysToRace != null && daysToRace >= 0
        ? `<div class="stat-tile"><div class="v">${daysToRace}</div><div class="k">days to race</div></div>`
        : `<div class="stat-tile"><div class="v">${plan.weeks.length}</div><div class="k">weeks total</div></div>`}
      <div class="stat-tile"><div class="v">${curWeek ? `${curWeek.idx + 1}/${plan.weeks.length}` : '-'}</div><div class="k">current week</div></div>
      <div class="stat-tile"><div class="v">${fmtDist(peakKm, units, 0)}</div><div class="k">peak week</div></div>
    </div>`;

  const loggedKm = (w) => {
    const end = addDays(w.start, 6);
    return w.workouts.filter((x) => x.status === 'done').reduce((s, x) => s + (x.log?.distKm || 0), 0)
      + state.extraLogs.filter((e) => e.date >= w.start && e.date <= end).reduce((s, e) => s + (e.distKm || 0), 0);
  };

  const weekRows = plan.weeks.map((w) => {
    const cur = w.start === curMonday;
    const past = addDays(w.start, 6) < today;
    const keys = w.workouts.filter((x) => QUALITY_TYPES.has(x.type) || x.type === 'long');
    const dots = keys.map((x) => `<i style="--c: var(--wt-${x.type})" title="${esc(x.title)}"></i>`).join('');
    const logged = past || cur ? loggedKm(w) : 0;
    return `<button class="plan-week-row ${cur ? 'cur' : ''} ${past ? 'past' : ''}" data-week="${w.start}"
        aria-label="Week ${w.idx + 1}, ${w.deload ? 'recovery' : w.phase}, ${fmtDist(w.targetKm, units, 0)}">
      <span class="wn">W${w.idx + 1}</span>
      <span class="ph phase-chip">${w.deload ? 'recovery' : w.phase}</span>
      <span class="kdots">${dots}</span>
      <span class="bar"><i style="width:${Math.max(4, Math.round((w.targetKm / peakKm) * 100))}%"></i>${logged ? `<b style="left:${Math.min(100, Math.round((logged / peakKm) * 100))}%"></b>` : ''}</span>
      <span class="km">${fmtDist(w.targetKm, units, 0)}</span>
    </button>`;
  }).join('');

  container.innerHTML = `
    <header class="mast">
      <div class="mast-top">
        <span class="eyebrow">${esc(g.label)}${plan.raceDate ? ` · ${esc(plan.raceDate)}` : ''}</span>
        <span class="mast-meta num">${plan.weeks.length} wk</span>
      </div>
      <h1 class="screen-title">Plan</h1>
    </header>
    ${hero}
    ${stats}
    <div class="card viz-card">
      <h3>Periodization</h3>
      <div class="viz-sub">Planned ${units} per week by phase · lighter bars are recovery weeks · tap a week to open it</div>
      <div class="chart-wrap" id="viz-phase"></div>
    </div>
    <div class="card">
      <h3 style="margin-bottom:8px">Week by week</h3>
      ${weekRows}
    </div>
    <div class="card">
      <h3 style="margin-bottom:4px">Know your sessions</h3>
      <p class="hint" style="margin-bottom:6px">What each run type is for, and how it should feel.</p>
      ${TYPE_INFO.map((t) => `
        <div class="type-guide-row">
          ${typeChip(t.type)}
          <div>
            <div class="tg-what">${t.what}</div>
            <div class="tg-how">${t.how}</div>
          </div>
        </div>`).join('')}
    </div>
  `;

  phaseChart(container.querySelector('#viz-phase'), plan.weeks.map((w) => {
    const past = w.start <= curMonday;
    return {
      label: `W${w.idx + 1}`, value: kmToUnit(w.targetKm, units), phase: w.phase, deload: w.deload,
      current: w.start === curMonday, logged: past ? kmToUnit(loggedKm(w), units) : 0,
      onTap: () => go('week', { week: w.start }),
    };
  }), { unitLabel: units });

  container.querySelectorAll('[data-week]').forEach((b) =>
    b.addEventListener('click', () => go('week', { week: b.dataset.week })));
}
