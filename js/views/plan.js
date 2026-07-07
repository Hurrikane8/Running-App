// Plan tab: projected race time + full week-by-week plan breakdown.

import { loadState } from '../storage.js';
import { GOALS, projectedRaceTime, estimateRaceTime, vdotForDate, vdotBreakdown } from '../plangen.js';
import { todayStr, addDays, esc, fmtDist, fmtTime, diffDays, mondayOf } from '../util.js';
import { TYPE_INFO, typeChip } from '../wkfmt.js';

export function renderPlan(container) {
  const state = loadState();
  const { plan, profile, settings } = state;
  const units = settings.units;
  const g = GOALS[profile.goal];
  const today = todayStr();
  const curMonday = mondayOf(today);

  const fb = vdotBreakdown(profile, today, plan, state.extraLogs);
  const evidenceLine = fb.nPoints > 0
    ? `<p class="hint" style="margin-top:6px">Blends your entered fitness with ${fb.nPoints} recent logged effort${fb.nPoints === 1 ? '' : 's'}.</p>`
    : '';

  let hero = '';
  if (g.distKm) {
    const proj = projectedRaceTime(profile, plan, state.extraLogs);
    if (proj.projected != null) {
      let goalLine = '';
      if (profile.goalTimeSec) {
        const diff = proj.projected - profile.goalTimeSec;
        goalLine = `<div style="font-size:15px; font-weight:750; margin-top:6px">
          Goal: ${fmtTime(profile.goalTimeSec)} — ${diff <= 0
            ? `<span style="color:var(--good)">on track (${fmtTime(-diff)} ahead)</span>`
            : `<span style="color:var(--accent-text)">${fmtTime(diff)} to close</span>`}
        </div>`;
      }
      hero = `
        <div class="card today-hero" style="text-align:center">
          <div class="today-date">Projected ${esc(g.label)} finish</div>
          <div class="today-title" style="font-size:44px; font-variant-numeric:tabular-nums">${fmtTime(proj.projected)}</div>
          ${goalLine}
          <p class="hint" style="margin-top:4px">
            At today's fitness: ${fmtTime(proj.current)} · projection assumes the plan is
            followed through race day (≈ +${proj.gain.toFixed(1)} VDOT).
            ${g.ultra ? '<br>Ultra estimates assume a flat, runnable course — terrain and vert add time.' : ''}
          </p>
          ${evidenceLine}
        </div>`;
    } else {
      hero = `
        <div class="card today-hero" style="text-align:center">
          <div class="today-date">Estimated ${esc(g.label)} (today's fitness)</div>
          <div class="today-title" style="font-size:44px; font-variant-numeric:tabular-nums">${fmtTime(proj.current)}</div>
          <p class="hint" style="margin-top:2px">Race date has passed — set a new goal in Settings for a fresh projection.</p>
          ${evidenceLine}
        </div>`;
    }
  } else {
    hero = `
      <div class="card today-hero" style="text-align:center">
        <div class="today-date">Estimated 5K at today's fitness</div>
        <div class="today-title" style="font-size:44px; font-variant-numeric:tabular-nums">${fmtTime(estimateRaceTime(vdotForDate(profile, today, plan, state.extraLogs), 5))}</div>
        <p class="hint" style="margin-top:2px">No race on the calendar — set one in Settings to get a race-day projection.</p>
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
      <div class="stat-tile"><div class="v">${curWeek ? `${curWeek.idx + 1}/${plan.weeks.length}` : '—'}</div><div class="k">current week</div></div>
      <div class="stat-tile"><div class="v">${fmtDist(peakKm, units, 0)}</div><div class="k">peak week</div></div>
    </div>`;

  const weekRows = plan.weeks.map((w) => {
    const cur = w.start === curMonday;
    const past = addDays(w.start, 6) < today;
    return `<div class="plan-week-row ${cur ? 'cur' : ''}" style="${past ? 'opacity:.55' : ''}">
      <span class="wn">W${w.idx + 1}</span>
      <span class="ph phase-chip">${w.deload ? 'recovery' : w.phase}</span>
      <span class="bar"><i style="width:${Math.max(4, Math.round((w.targetKm / peakKm) * 100))}%"></i></span>
      <span class="km">${fmtDist(w.targetKm, units, 0)}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <h1 class="screen-title">Plan</h1>
    <p class="screen-sub">${g.label}${plan.raceDate ? ` · ${esc(plan.raceDate)}` : ''} · ${plan.weeks.length} weeks</p>
    ${hero}
    ${stats}
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
}
