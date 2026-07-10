// Progress view: weekly/monthly volume, pace trend, personal records.

import { loadState } from '../storage.js';
import { mondayOf, addDays, todayStr, strToDate, fmtDist, fmtTime, fmtPace, kmToUnit, MONTHS, esc } from '../util.js';
import { barChart, paceLineChart } from '../charts.js';

// Collect every logged run: plan workouts with logs + ad-hoc extras.
function allRuns(state) {
  const runs = [];
  if (state.plan) {
    for (const w of state.plan.weeks) {
      for (const x of w.workouts) {
        if (x.status === 'done' && x.log?.distKm) {
          runs.push({ date: x.date, distKm: x.log.distKm, durSec: x.log.durSec, title: x.title });
        }
      }
    }
  }
  for (const e of state.extraLogs) {
    if (e.distKm) runs.push({ date: e.date, distKm: e.distKm, durSec: e.durSec, title: 'Unplanned run' });
  }
  return runs.sort((a, b) => a.date.localeCompare(b.date));
}

export function renderProgress(container) {
  const state = loadState();
  const units = state.settings.units;
  const runs = allRuns(state);
  const today = todayStr();

  // ---- weekly totals: last 12 weeks incl. current ----
  const curMon = mondayOf(today);
  const weekBars = [];
  for (let i = 11; i >= 0; i--) {
    const start = addDays(curMon, -7 * i);
    const end = addDays(start, 6);
    const km = runs.filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + r.distKm, 0);
    const d = strToDate(start);
    weekBars.push({
      label: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
      sub: `Wk of ${d.getDate()} ${MONTHS[d.getMonth()]}`,
      value: kmToUnit(km, units), current: i === 0,
    });
  }

  // ---- totals ----
  const thisWeekKm = runs.filter((r) => r.date >= curMon).reduce((s, r) => s + r.distKm, 0);
  const monthStart = today.slice(0, 8) + '01';
  const thisMonthKm = runs.filter((r) => r.date >= monthStart).reduce((s, r) => s + r.distKm, 0);
  const allKm = runs.reduce((s, r) => s + r.distKm, 0);

  // ---- pace trend: runs with time, last 90 days ----
  const cutoff = addDays(today, -90);
  const paced = runs.filter((r) => r.durSec && r.distKm >= 2 && r.date >= cutoff)
    .map((r) => {
      const d = strToDate(r.date);
      return { x: d.getTime(), label: `${d.getDate()} ${MONTHS[d.getMonth()]} · ${r.title}`, secPerKm: r.durSec / r.distKm };
    });

  // ---- PRs ----
  const prDists = [
    { km: 5, label: 'Fastest 5K+' }, { km: 10, label: 'Fastest 10K+' },
    { km: 21.0975, label: 'Fastest half+' }, { km: 42.195, label: 'Fastest marathon+' },
  ];
  const prs = [];
  for (const pd of prDists) {
    const cands = runs.filter((r) => r.durSec && r.distKm >= pd.km * 0.98);
    if (!cands.length) continue;
    const best = cands.reduce((a, b) => (a.durSec / a.distKm <= b.durSec / b.distKm ? a : b));
    prs.push({ label: pd.label, value: fmtPace(best.durSec / best.distKm, units), date: best.date });
  }
  const longest = runs.length ? runs.reduce((a, b) => (a.distKm >= b.distKm ? a : b)) : null;
  const weekTotals = new Map();
  for (const r of runs) {
    const m = mondayOf(r.date);
    weekTotals.set(m, (weekTotals.get(m) || 0) + r.distKm);
  }
  const biggestWeek = [...weekTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  container.innerHTML = `
    <header class="mast">
      <div class="mast-top">
        <span class="eyebrow">Training log</span>
        <span class="mast-meta num">${runs.length} run${runs.length === 1 ? '' : 's'}</span>
      </div>
      <h1 class="screen-title">Progress</h1>
    </header>

    <div class="week-summary">
      <div class="stat-tile"><div class="v">${fmtDist(thisWeekKm, units, 0)}</div><div class="k">this week</div></div>
      <div class="stat-tile"><div class="v">${fmtDist(thisMonthKm, units, 0)}</div><div class="k">this month</div></div>
      <div class="stat-tile"><div class="v">${fmtDist(allKm, units, 0)}</div><div class="k">all time</div></div>
    </div>

    <div class="card viz-card">
      <h3>Weekly volume</h3>
      <div class="viz-sub">Logged distance (${units}) per week, last 12 weeks</div>
      <div class="chart-wrap" id="viz-week"></div>
    </div>

    <div class="card viz-card">
      <h3>Pace trend</h3>
      <div class="viz-sub">Average pace (/${units}) of timed runs ≥ ${units === 'mi' ? '1.2 mi' : '2 km'}, last 90 days · up = faster</div>
      <div class="chart-wrap" id="viz-pace">
        ${paced.length < 2 ? '<div class="empty-note">Log a couple of timed runs and your trend appears here.</div>' : ''}
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:8px">Personal records</h3>
      ${prs.length || longest ? '' : '<div class="empty-note">Records unlock as you log runs.</div>'}
      ${prs.map((p) => `<div class="pr-row"><span class="k">${p.label}</span><span><span class="v">${p.value}</span><span class="d">${esc(p.date)}</span></span></div>`).join('')}
      ${longest ? `<div class="pr-row"><span class="k">Longest run</span><span><span class="v">${fmtDist(longest.distKm, units)}</span><span class="d">${esc(longest.date)}</span></span></div>` : ''}
      ${biggestWeek ? `<div class="pr-row"><span class="k">Biggest week</span><span><span class="v">${fmtDist(biggestWeek[1], units)}</span><span class="d">wk of ${esc(biggestWeek[0])}</span></span></div>` : ''}
      ${runs.some((r) => r.durSec) ? `<div class="pr-row"><span class="k">Time on feet</span><span class="v">${fmtTime(runs.reduce((s, r) => s + (r.durSec || 0), 0))}</span></div>` : ''}
    </div>
  `;

  barChart(container.querySelector('#viz-week'), weekBars, { unitLabel: units });
  if (paced.length >= 2) {
    paceLineChart(container.querySelector('#viz-pace'), paced, {
      units, fmtPaceFn: (spk) => fmtPace(spk, units),
    });
  }
}
