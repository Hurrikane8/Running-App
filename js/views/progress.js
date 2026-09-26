// Progress view: fitness trend (with the race-day projection and the logged
// efforts behind it), race equivalents, planned vs logged volume,
// consistency and intensity distribution, best efforts and records.

import { loadState } from '../storage.js';
import { vdotBreakdown, vdotForDate, estimateRaceTime } from '../plangen.js';
import { vdotFromRace } from '../paces.js';
import {
  mondayOf, addDays, todayStr, strToDate, fmtDist, fmtTime, fmtDuration, kmToUnit, MONTHS, esc,
} from '../util.js';
import { barChart, lineChart } from '../charts.js';

const KEY_TYPES = new Set(['tempo', 'intervals', 'reps', 'mpace', 'hills', 'tt', 'race']);
const dLabel = (s) => { const d = strToDate(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

// Every logged run: plan workouts with logs + ad-hoc extras.
function allRuns(state) {
  const runs = [];
  for (const w of state.plan?.weeks || []) {
    for (const x of w.workouts) {
      if (x.status === 'done' && x.log?.distKm) runs.push({ date: x.date, ...x.log, title: x.title, w: x });
    }
  }
  for (const e of state.extraLogs) {
    if (e.distKm) runs.push({ ...e, title: e.race ? 'Race / time trial' : 'Unplanned run', w: null });
  }
  return runs.sort((a, b) => a.date.localeCompare(b.date));
}

// Minutes at quality intensity in a logged run (main sets, races, TTs).
function hardMinutes(r) {
  if (!r.durSec) return 0;
  if (!r.w) return r.race ? r.durSec / 60 : 0;
  const t = r.w.type;
  if (t === 'race' || t === 'tt') return r.durSec / 60;
  if (!KEY_TYPES.has(t)) return 0;
  const km = r.w.work?.km;
  const pace = r.workPaceSec || (r.durSec / r.distKm) * 0.9;
  if (km && pace) return Math.min(r.durSec / 60, (km * pace) / 60);
  if (r.w.work?.repMin && r.w.work?.reps) return r.w.work.repMin * r.w.work.reps;
  return (r.durSec / 60) * 0.35;
}

const EFFORT_DISTS = [
  { km: 1.609, label: 'Mile' }, { km: 3, label: '3 km' }, { km: 5, label: '5K' },
  { km: 10, label: '10K' }, { km: 21.0975, label: 'Half marathon' }, { km: 42.195, label: 'Marathon' },
];

export function renderProgress(container) {
  const state = loadState();
  const { profile, plan, settings } = state;
  const units = settings.units;
  const runs = allRuns(state);
  const today = todayStr();
  const curMon = mondayOf(today);
  const evidence = [plan, state.extraLogs];

  // ---- totals ----
  const thisWeekKm = runs.filter((r) => r.date >= curMon).reduce((s, r) => s + r.distKm, 0);
  const monthStart = today.slice(0, 8) + '01';
  const thisMonthKm = runs.filter((r) => r.date >= monthStart).reduce((s, r) => s + r.distKm, 0);
  const allKm = runs.reduce((s, r) => s + r.distKm, 0);

  // ---- fitness ----
  const fb = vdotBreakdown(profile, today, ...evidence);
  const startDate = [profile.vdotDate, plan.weeks[0]?.start].filter(Boolean).sort().pop() || today;
  const vStart = vdotForDate(profile, startDate, ...evidence);
  const series = [];
  let lastD = null;
  for (let d = startDate; d <= today; d = addDays(d, 7)) {
    const v = vdotForDate(profile, d, ...evidence);
    series.push({ x: strToDate(d).getTime(), y: v, label: `${dLabel(d)}: VDOT ${v.toFixed(1)}`, tick: dLabel(d) });
    lastD = d;
  }
  if (lastD !== today) {
    series.push({ x: strToDate(today).getTime(), y: fb.blended, label: `Today: VDOT ${fb.blended.toFixed(1)}`, tick: 'Today' });
  }
  const projection = [];
  if (plan.raceDate && plan.raceDate > today) {
    const pts = [today];
    for (let d = addDays(today, 7); d < plan.raceDate; d = addDays(d, 7)) pts.push(d);
    pts.push(plan.raceDate);
    for (const d of pts) {
      const v = vdotForDate(profile, d, ...evidence);
      projection.push({ x: strToDate(d).getTime(), y: v, label: `${d === plan.raceDate ? 'Race day' : dLabel(d)} (projected): VDOT ${v.toFixed(1)}`, tick: d === plan.raceDate ? 'Race' : '' });
    }
  }
  const markers = (fb.points || []).map((p) => ({
    x: strToDate(p.date).getTime(), y: p.vdot, label: `${dLabel(p.date)} · ${p.title}: reads ${p.vdot.toFixed(1)}`,
  }));
  const equivalents = EFFORT_DISTS.slice(2).map((d) => `<div class="eq"><span class="k">${d.label}</span><span class="v">${fmtTime(estimateRaceTime(fb.blended, d.km))}</span></div>`).join('');
  const delta = fb.blended - vStart;

  // ---- weekly volume: last 12 weeks, logged vs planned ----
  const weekBars = [];
  for (let i = 11; i >= 0; i--) {
    const start = addDays(curMon, -7 * i);
    const end = addDays(start, 6);
    const km = runs.filter((r) => r.date >= start && r.date <= end).reduce((s, r) => s + r.distKm, 0);
    const pw = plan.weeks.find((w) => w.start === start);
    weekBars.push({
      label: dLabel(start), sub: `Week of ${dLabel(start)}`,
      value: kmToUnit(km, units), planned: pw ? kmToUnit(pw.targetKm, units) : null, current: i === 0,
    });
  }
  const firstIdx = weekBars.findIndex((b) => b.value > 0 || b.planned);
  const bars = weekBars.slice(Math.max(0, Math.min(firstIdx, 6)));

  // ---- consistency: last 4 completed plan weeks ----
  const doneWeeks = plan.weeks.filter((w) => addDays(w.start, 6) < today).slice(-4);
  let pKm = 0, lKm = 0, pSess = 0, dSess = 0, pKey = 0, dKey = 0;
  for (const w of doneWeeks) {
    const end = addDays(w.start, 6);
    const ws = w.workouts.filter((x) => x.type !== 'xtrain');
    pKm += w.targetKm;
    lKm += ws.filter((x) => x.status === 'done').reduce((s, x) => s + (x.log?.distKm || 0), 0)
      + state.extraLogs.filter((e) => e.date >= w.start && e.date <= end).reduce((s, e) => s + (e.distKm || 0), 0);
    pSess += ws.length; dSess += ws.filter((x) => x.status === 'done').length;
    const keys = ws.filter((x) => KEY_TYPES.has(x.type) || x.type === 'long');
    pKey += keys.length; dKey += keys.filter((x) => x.status === 'done').length;
  }
  const pctKm = pKm ? Math.round((lKm / pKm) * 100) : null;

  // ---- 80/20: last 28 days, by time ----
  const recent = runs.filter((r) => r.date > addDays(today, -28) && r.durSec);
  const totMin = recent.reduce((s, r) => s + r.durSec / 60, 0);
  const hardMin = recent.reduce((s, r) => s + hardMinutes(r), 0);
  const easyPct = totMin ? Math.round(((totMin - hardMin) / totMin) * 100) : null;

  // ---- best efforts: races, time trials, flagged ad-hoc races, reference race ----
  const efforts = runs.filter((r) => r.durSec && ((r.w && (r.w.type === 'race' || r.w.type === 'tt')) || (!r.w && r.race)))
    .map((r) => ({ km: r.distKm, sec: r.durSec, date: r.date, src: r.title }));
  if (profile.refRace?.timeSec) efforts.push({ km: profile.refRace.distKm, sec: profile.refRace.timeSec, date: null, src: 'entered' });
  const best = [];
  for (const d of EFFORT_DISTS) {
    const c = efforts.filter((e) => Math.abs(e.km - d.km) / d.km <= 0.03);
    if (!c.length) continue;
    const b = c.reduce((a, e) => (e.sec / e.km < a.sec / a.km ? e : a));
    best.push({ label: d.label, time: fmtTime((b.sec / b.km) * d.km), date: b.date, v: vdotFromRace(b.km, b.sec) });
  }
  const longest = runs.length ? runs.reduce((a, b) => (a.distKm >= b.distKm ? a : b)) : null;
  const weekTotals = new Map();
  for (const r of runs) weekTotals.set(mondayOf(r.date), (weekTotals.get(mondayOf(r.date)) || 0) + r.distKm);
  const biggestWeek = [...weekTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const timeOnFeet = runs.reduce((s, r) => s + (r.durSec || 0), 0);

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
      <h3>Fitness</h3>
      <div class="fit-head">
        <div class="hero-num sm">${fb.blended.toFixed(1)}<span class="unit">VDOT</span></div>
        <div class="fit-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)} since ${dLabel(startDate)}</div>
      </div>
      <div class="viz-sub">Solid line: your fitness so far${projection.length ? ' · dashed: projection to race day' : ''}${markers.length ? ' · dots: races, time trials and paced sessions it learned from' : ''}</div>
      <div class="chart-wrap" id="viz-fit">${series.length + projection.length < 2 ? '<div class="empty-note">Your fitness trend appears after your first week.</div>' : ''}</div>
      <div class="eq-grid" aria-label="Race equivalents at today's fitness">${equivalents}</div>
    </div>

    <div class="card viz-card">
      <h3>Weekly volume</h3>
      <div class="viz-sub">Logged ${units} per week against the plan</div>
      <div class="chart-wrap" id="viz-week"></div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:10px">Consistency</h3>
      ${doneWeeks.length ? `
        <div class="pr-row"><span class="k">Distance, last ${doneWeeks.length} wk</span><span class="v">${pctKm}%<span class="d">${fmtDist(lKm, units, 0)} of ${fmtDist(pKm, units, 0)}</span></span></div>
        <div class="pr-row"><span class="k">Sessions completed</span><span class="v">${dSess}/${pSess}</span></div>
        <div class="pr-row"><span class="k">Key sessions & long runs</span><span class="v">${dKey}/${pKey}</span></div>`
        : '<p class="hint">Your completion rate appears after your first full week.</p>'}
      ${easyPct != null ? `
        <div class="split-head"><span>Intensity, last 28 days (by time)</span><span class="${easyPct >= 75 ? 'ok' : 'warn'}">${easyPct >= 75 ? 'On the 80/20 target' : 'Too much hard running'}</span></div>
        <div class="split-bar" role="img" aria-label="${easyPct}% easy, ${100 - easyPct}% hard">
          <i class="easy" style="width:${easyPct}%"></i><i class="hard" style="width:${100 - easyPct}%"></i>
        </div>
        <div class="split-legend"><span><i class="easy"></i>Easy ${easyPct}%</span><span><i class="hard"></i>Hard ${100 - easyPct}%</span></div>` : ''}
    </div>

    <div class="card">
      <h3 style="margin-bottom:8px">Best efforts</h3>
      ${best.length ? best.map((b) => `<div class="pr-row"><span class="k">${b.label}</span><span><span class="v">${b.time}</span><span class="d">${b.date ? esc(dLabel(b.date)) : 'entered'} · VDOT ${b.v.toFixed(1)}</span></span></div>`).join('')
        : '<p class="hint">Races and time trials you log show up here with real times.</p>'}
    </div>

    <div class="card">
      <h3 style="margin-bottom:8px">Records</h3>
      ${runs.length ? '' : '<div class="empty-note">Records unlock as you log runs.</div>'}
      ${longest ? `<div class="pr-row"><span class="k">Longest run</span><span><span class="v">${fmtDist(longest.distKm, units)}</span><span class="d">${esc(dLabel(longest.date))}</span></span></div>` : ''}
      ${biggestWeek ? `<div class="pr-row"><span class="k">Biggest week</span><span><span class="v">${fmtDist(biggestWeek[1], units)}</span><span class="d">wk of ${esc(dLabel(biggestWeek[0]))}</span></span></div>` : ''}
      ${timeOnFeet ? `<div class="pr-row"><span class="k">Time on feet</span><span class="v">${fmtDuration(timeOnFeet)}</span></div>` : ''}
    </div>
  `;

  if (series.length + projection.length >= 2) {
    lineChart(container.querySelector('#viz-fit'), series, {
      projection, markers, fmtY: (v) => v.toFixed(0), fmtLabel: (v) => v.toFixed(1), ariaLabel: 'Fitness (VDOT) over time with race-day projection',
    });
  }
  barChart(container.querySelector('#viz-week'), bars, { unitLabel: units });
}
