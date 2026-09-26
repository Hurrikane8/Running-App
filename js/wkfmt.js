// Shared workout presentation helpers + the log-workout modal.

import { loadState, saveState } from './storage.js';
import { pacesForDate, racePaceForDate, goalPaceSec, workPaceKey, expectedRpe, estimateRaceTime, GOALS } from './plangen.js';
import { targetHR } from './hr.js';
import { profileSvg } from './charts.js';
import { vdotFromRace } from './paces.js';
import { fmtDist, fmtPace, fmtPaceDisplay, fmtPaceRangeDisplay, fmtTime, esc, kmToUnit, unitToKm, todayStr, KM_PER_MI } from './util.js';

export const TYPE_LABEL = {
  easy: 'Easy', recovery: 'Recovery', long: 'Long run', tempo: 'Threshold',
  intervals: 'VO2max', reps: 'Speed', mpace: 'Goal pace', strides: 'Strides',
  hills: 'Hills', xtrain: 'Cross-train', race: 'Race', tt: 'Time trial',
};

export const QUALITY_TYPES = new Set(['tempo', 'intervals', 'reps', 'mpace', 'hills', 'race', 'tt']);

export function chipFor(w) {
  if (w.status === 'done') return '<span class="chip done">✓ Done</span>';
  if (w.status === 'skipped') return '<span class="chip">Skipped</span>';
  return typeChip(w.type);
}

export function typeChip(type) {
  const q = QUALITY_TYPES.has(type) ? 'q' : '';
  return `<span class="chip ${q} chip-${type}">${TYPE_LABEL[type] || type}</span>`;
}

// What each session type is, why it's in the plan, how it should feel.
// Rendered as the run-type guide on the Plan tab.
export const TYPE_INFO = [
  { type: 'easy', what: 'Relaxed running that builds your aerobic base: heart, capillaries, mitochondria, tendons.', how: 'Conversational the whole way (RPE 3-4). Most of your week should feel this comfortable. That is the 80/20 rule at work.' },
  { type: 'long', what: 'The longest run of the week. Builds endurance, fuel economy and mental durability.', how: 'Easy effort, start slower than feels natural. On marathon/half plans every other long run finishes with a stretch at goal pace.' },
  { type: 'tempo', what: 'Threshold running, the pace you could hold for about an hour flat-out. Cruise intervals and continuous tempos raise the speed you can sustain without blowing up.', how: 'Comfortably hard (RPE 6-7): you could speak a sentence, not a paragraph.' },
  { type: 'intervals', what: 'VO2max repeats: 2-5 minute efforts that push your engine\'s ceiling. They grow from 800 m reps toward 1200 m as the plan builds.', how: 'Hard but controlled (RPE 8-9), even pacing across reps, jog recoveries. The last rep should feel like one more was possible.' },
  { type: 'reps', what: 'Short, fast repetitions (200-400 m) for speed and running economy, not fitness.', how: 'Quick and relaxed (RPE 8), never straining. Full recovery between reps is part of the workout.' },
  { type: 'mpace', what: 'Race-specific work at your goal pace: the projected race-day pace, so you rehearse the exact rhythm you will race at.', how: 'Locked to goal pace, no faster. Effort depends on the distance: RPE 8 at 5K pace, 5-6 at marathon pace.' },
  { type: 'hills', what: 'Uphill repeats building leg strength and power with less impact than flat speed work. The base phase\'s key session.', how: 'Strong uphill effort (RPE 7-8), tall posture, easy jog or walk back down. Run by effort, not pace.' },
  { type: 'tt', what: 'A solo time trial that measures your current fitness. Your result recalibrates every pace in the plan.', how: 'Race effort (RPE 9): controlled first third, hold the middle, empty the tank at the end. Log just the time-trial distance and time.' },
  { type: 'strides', what: 'An easy run finished with a few 20-30 s smooth accelerations (or 10 s hill sprints) to keep the legs sharp.', how: 'Easy pace throughout; strides build up, float, ease off. Never a sprint.' },
  { type: 'recovery', what: 'A deliberately short, gentle run that promotes blood flow after hard or long days.', how: 'Slower than feels necessary (RPE 2-3). Walking breaks are fine.' },
  { type: 'xtrain', what: 'Optional low-impact aerobic work (bike, swim, elliptical, incline walk) that keeps the engine on with less pounding.', how: 'Easy-to-steady effort (RPE 3-5), roughly the listed duration.' },
  { type: 'race', what: 'The day it all pays off.', how: 'Even or slightly negative splits. Trust the taper, execute your fueling plan.' },
];

// evidence = { plan, extraLogs } — logged workouts that let pace targets
// reflect actual performance, not just the calendar-based assumption.

// "8 km · easy pace 6:42 /km · HR 128-145" (or "easy 5.6 mph" in treadmill mode)
export function targetLine(w, profile, settings, evidence = {}) {
  const parts = [];
  if (w.distKm != null) parts.push(fmtDist(w.distKm, settings.units));
  if (w.durMin != null) parts.push(w.durMin >= 60 ? `${Math.floor(w.durMin / 60)} h ${w.durMin % 60 ? (w.durMin % 60) + ' min' : ''}`.trim() : `${w.durMin} min`);
  const pace = paceTarget(w, profile, settings, evidence);
  if (pace) parts.push(pace);
  // HR_ZONE_FRACTIONS keys line up 1:1 with paceKey values (easy, recovery,
  // marathon, threshold, interval); 'rep' and 'racepace' intentionally have
  // no zone and targetHR() returns null for them.
  const hr = profile ? targetHR(profile, hrZoneFor(w.paceKey, profile.goal)) : null;
  if (hr) parts.push(`HR ${hr[0]}–${hr[1]}`);
  // each part stays on one line; wrapping happens only between parts
  return parts.map((x) => `<span class="nw">${x}</span>`).join(' · ');
}

// Goal-pace running sits in a different HR zone depending on the race
// distance (5K pace is VO2max territory, marathon pace is not).
const GOALPACE_HR_ZONE = { '5k': 'interval', '10k': 'threshold', half: 'threshold', marathon: 'marathon' };
function hrZoneFor(paceKey, goal) {
  return paceKey === 'goalpace' ? GOALPACE_HR_ZONE[goal] || null : paceKey;
}

const EFFORT_ONLY = {
  hills: 'by effort (RPE 7-8)',
  tt: 'hard, even effort (RPE 9)',
  xtrain: null,
};

export function paceTarget(w, profile, settings, evidence = {}) {
  if (!w.paceKey || !profile) {
    if (w.type === 'long') return 'easy effort (RPE 3-4)';
    return EFFORT_ONLY[w.type] ?? null;
  }
  if (w.paceKey === 'goalpace') {
    const gp = goalPaceSec(profile, evidence.plan, evidence.extraLogs);
    return gp ? `goal pace ${fmtPaceDisplay(gp, settings)}` : null;
  }
  // Race-day pace is distance-aware (matches "Projected finish"), not one of
  // the fixed intensity-fraction zones below — resolve it separately.
  if (w.paceKey === 'racepace') {
    const pace = racePaceForDate(profile, w.date, w.distKm, evidence.plan, evidence.extraLogs);
    return `race pace ${fmtPaceDisplay(pace, settings)}`;
  }
  const p = pacesForDate(profile, w.date, evidence.plan, evidence.extraLogs); // paces reflect logged performance + projected fitness
  switch (w.paceKey) {
    case 'easy': return `easy ${fmtPaceRangeDisplay(p.easy, settings)}`;
    case 'recovery': return `recovery ${fmtPaceRangeDisplay(p.recovery, settings)}`;
    case 'marathon': return `goal pace ${fmtPaceDisplay(p.marathon, settings)}`;
    case 'threshold': return `threshold ${fmtPaceDisplay(p.threshold, settings)}`;
    case 'interval': return `interval ${fmtPaceDisplay(p.interval, settings)}`;
    case 'rep': return `rep pace ${fmtPaceDisplay(p.rep, settings)}`;
    default: return null;
  }
}

export function structureRows(w, profile, settings, evidence = {}) {
  const rows = [];
  if (w.structure.warmup) rows.push(['Warm-up', w.structure.warmup]);
  rows.push(['Main set', decoratePaces(w.structure.main, w, profile, settings, evidence)]);
  if (w.structure.cooldown) rows.push(['Cool-down', w.structure.cooldown]);
  return rows.map(([k, v]) =>
    `<div class="structure-row"><div class="structure-label">${k}</div><div class="structure-body">${v}</div></div>`).join('');
}

// Plain-text version (calendar export).
export function structureText(w, profile, settings, evidence = {}) {
  const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const out = [];
  if (w.structure.warmup) out.push(`Warm-up: ${w.structure.warmup}`);
  out.push(`Main set: ${strip(decoratePaces(w.structure.main, w, profile, settings, evidence))}`);
  if (w.structure.cooldown) out.push(`Cool-down: ${w.structure.cooldown}`);
  return out.join('\n');
}

// Turn pace phrases in a structure line ("at threshold pace") into the
// runner's actual numbers. One pass with a combined pattern, so inserted
// markup is never re-matched, and the matched text keeps its own casing
// ("Easy pace" at the start of a sentence stays capitalized). Distance reps
// also get a per-rep split ("≈1:47 per 400 m") — what a track runner needs.
function decoratePaces(text, w, profile, settings, evidence = {}) {
  if (!profile) return esc(text);
  const p = pacesForDate(profile, w.date, evidence.plan, evidence.extraLogs);
  const gp = goalPaceSec(profile, evidence.plan, evidence.extraLogs);
  const phrases = {
    'easy pace': { txt: fmtPaceRangeDisplay(p.easy, settings) },
    'recovery pace': { txt: fmtPaceRangeDisplay(p.recovery, settings) },
    'threshold pace': { key: 'threshold', sec: p.threshold },
    'interval pace': { key: 'interval', sec: p.interval },
    'repetition pace': { key: 'rep', sec: p.rep },
    // legacy marathon-goal workouts (fixed marathon-effort zone)
    'marathon (goal) pace': { key: 'marathon', sec: p.marathon },
    'marathon pace': { key: 'marathon', sec: p.marathon },
  };
  // "goal pace" = projected race-day pace for the goal distance (same number
  // as Projected finish and the race-day target), not a fixed zone.
  if (gp) phrases['goal pace'] = { key: 'goalpace', sec: gp };
  // Race day's own "race pace" — distance-aware (matches Projected finish).
  if (w.paceKey === 'racepace' && w.distKm) {
    phrases['race pace'] = { sec: racePaceForDate(profile, w.date, w.distKm, evidence.plan, evidence.extraLogs) };
  }
  const keys = Object.keys(phrases).sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[()]/g, '\\$&'));
  const re = new RegExp(keys.join('|'), 'gi');
  return esc(text).replace(re, (m) => {
    const ph = phrases[m.toLowerCase()];
    if (!ph) return m;
    const val = ph.txt ?? fmtPaceDisplay(ph.sec, settings);
    let split = '';
    const repM = w.work?.repM;
    if (ph.key && w.work?.paceKey === ph.key && repM && repM <= 1600 && settings.paceDisplay !== 'treadmill') {
      split = ` <span class="split">≈${fmtTime(ph.sec * repM / 1000)} per ${repM >= 1000 ? (repM / 1000) + ' km' : repM + ' m'}</span>`;
    }
    return `${m} <span class="pace-pill">${val}</span>${split}`;
  });
}

// ---- modal plumbing ----

let lastFocus = null;
function onModalKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
  if (e.key !== 'Tab') return;
  // keep keyboard focus inside the dialog
  const modal = document.querySelector('#modal-root .modal');
  if (!modal) return;
  const f = [...modal.querySelectorAll('button, input, select, textarea, [href]')].filter((x) => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}

export function openModal(html) {
  const root = document.getElementById('modal-root');
  lastFocus = document.activeElement;
  root.innerHTML = `<div class="modal-scrim"><div class="modal" role="dialog" aria-modal="true" tabindex="-1">${html}</div></div>`;
  const scrim = root.firstElementChild;
  const modal = scrim.firstElementChild;
  const title = modal.querySelector('h2');
  if (title) { title.id ||= 'modal-title'; modal.setAttribute('aria-labelledby', title.id); }
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
  root.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', onModalKey);
  modal.focus({ preventScroll: true });
  return modal;
}

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root || !root.innerHTML) return;
  root.innerHTML = '';
  document.removeEventListener('keydown', onModalKey);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}

// ---- workout profile + post-run coaching ----

// Intensity-profile graphic for a structured workout (null for legacy
// workouts or single-effort runs, where it would be a flat block).
export function workoutProfile(w, profile, evidence = {}) {
  if (!w.segments || w.segments.length < 2 || !profile) return '';
  const p = pacesForDate(profile, w.date, evidence.plan, evidence.extraLogs);
  const gp = goalPaceSec(profile, evidence.plan, evidence.extraLogs) || p.threshold;
  const pace = {
    easy: (p.easy[0] + p.easy[1]) / 2, recovery: (p.recovery[0] + p.recovery[1]) / 2, jog: p.easy[0] + 20,
    threshold: p.threshold, interval: p.interval, rep: p.rep, marathon: p.marathon, goalpace: gp,
    race: gp, hill: p.interval, stride: p.rep,
  };
  const minutesOf = (s) => (s.min != null ? s.min : (s.km * (pace[s.z] || pace.easy)) / 60);
  const goalH = { '5k': 0.88, '10k': 0.8, half: 0.7, marathon: 0.58 }[profile.goal] ?? 0.75;
  const totalMin = w.segments.reduce((a, s) => a + minutesOf(s), 0);
  return `<figure class="wk-profile-wrap" aria-label="Session intensity profile, about ${Math.round(totalMin)} minutes">
    ${profileSvg(w.segments, minutesOf, { goalH })}
    <figcaption><span>Start</span><span>≈ ${Math.round(totalMin)} min</span></figcaption>
  </figure>`;
}

const EASY_TYPES = new Set(['easy', 'recovery', 'long', 'strides']);

// Coach's read on a logged run: { tone: 'good'|'warn'|'info', text }[].
export function logFeedback(w, log, profile, settings, evidence = {}) {
  const out = [];
  if (!log || !profile) return out;
  const units = settings.units;
  const pace = log.durSec && log.distKm ? log.durSec / log.distKm : null;
  const isEffort = w && (w.type === 'tt' || w.type === 'race');
  if ((isEffort || (!w && log.race)) && log.durSec && log.distKm >= 1.5) {
    const v = vdotFromRace(log.distKm, log.durSec);
    const eq = [5, 10].map((d) => `${d}K ${fmtTime(estimateRaceTime(v, d))}`).join(' · ');
    out.push({ tone: 'good', text: `Fitness reading: VDOT ${v.toFixed(1)} (equivalent ${eq}). Your paces now reflect it.` });
    return out;
  }
  if (!w) return out;
  const key = workPaceKey(w);
  if (key) {
    const target = workTargetSec(w, profile, evidence);
    if (log.workPaceSec && target) {
      const diff = log.workPaceSec - target; // + = slower
      const s = Math.abs(Math.round(units === 'mi' ? diff * 1.609344 : diff));
      if (Math.abs(diff) <= target * 0.02) out.push({ tone: 'good', text: `Main set ${fmtPace(log.workPaceSec, units)}: right on target. Exactly the stimulus the session is for.` });
      else if (diff < 0) out.push({ tone: diff < -target * 0.05 ? 'warn' : 'good', text: `Main set ${fmtPace(log.workPaceSec, units)}, ${s} s/${units} faster than target. ${diff < -target * 0.05 ? 'Strong, but racing workouts costs recovery. If it felt controlled, your paces will sharpen on their own.' : 'Nicely done; if that felt controlled your paces will creep up.'}` });
      else out.push({ tone: 'info', text: `Main set ${fmtPace(log.workPaceSec, units)}, ${s} s/${units} off target. Heat, hills and tired legs all cost time. One session changes little; a pattern will adjust your paces.` });
    } else {
      out.push({ tone: 'info', text: 'Add the main-set pace from your watch laps next time. It is what lets the plan sharpen your paces.' });
    }
    const exp = expectedRpe(key, profile.goal);
    if (log.rpe && exp && log.rpe >= exp + 3) out.push({ tone: 'warn', text: `RPE ${log.rpe} is well above what this session should feel like (about ${Math.round(exp)}). Sleep, stress or a niggle? Keep the next two days truly easy.` });
  } else if (EASY_TYPES.has(w.type) && pace) {
    const p = pacesForDate(profile, w.date, evidence.plan, evidence.extraLogs);
    const band = w.type === 'recovery' ? p.recovery : p.easy; // [slow, fast]
    if (pace < band[1] - 8) out.push({ tone: 'warn', text: `${fmtPace(pace, units)} is quicker than your ${w.type === 'recovery' ? 'recovery' : 'easy'} range (${fmtPaceRangeDisplay(band, { ...settings, paceDisplay: 'outdoor' })}). Keep easy days easy so the key sessions land. That is the 80/20 rule.` });
    else if (pace <= band[0] + 15) out.push({ tone: 'good', text: `${fmtPace(pace, units)}, right in the ${w.type === 'recovery' ? 'recovery' : 'easy'} zone. This is how aerobic fitness is built.` });
    else out.push({ tone: 'good', text: `${fmtPace(pace, units)}, relaxed and slower than the range. Perfectly fine on an easy day.` });
    if (log.rpe && log.rpe >= 7) out.push({ tone: 'warn', text: `RPE ${log.rpe} on an easy run is a flag. If it keeps happening, check sleep, heat, fuelling, or take an extra rest day.` });
  }
  if (w.distKm && log.distKm < w.distKm * 0.7 && !isEffort) out.push({ tone: 'info', text: 'Shorter than planned. No need to make it up later; consistency beats catching up.' });
  return out;
}

export function feedbackHtml(items) {
  if (!items.length) return '';
  return `<div class="coach">${items.map((f) => `<p class="coach-${f.tone}">${esc(f.text)}</p>`).join('')}</div>`;
}

// "8.1 km · 42:10 · 5:12 /km · RPE 6"
export function logLine(log, settings) {
  const parts = [fmtDist(log.distKm, settings.units)];
  if (log.durSec) parts.push(fmtTime(log.durSec), fmtPaceDisplay(log.durSec / log.distKm, settings));
  if (log.rpe) parts.push(`RPE ${log.rpe}`);
  return parts.map((x) => `<span class="nw">${x}</span>`).join(' · ');
}

let toastTimer = null;
export function toast(html, ms = 4200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  el.onclick = () => el.classList.remove('show');
}

// ---- log-workout modal (also used for ad-hoc runs) ----

// Target pace (sec/km) of a workout's main set, or null.
export function workTargetSec(w, profile, evidence = {}) {
  const key = workPaceKey(w);
  if (!key || !profile) return null;
  if (key === 'goalpace') return goalPaceSec(profile, evidence.plan, evidence.extraLogs);
  const p = pacesForDate(profile, w.date, evidence.plan, evidence.extraLogs);
  return p[key] ?? null;
}

const splitPace = (secPerKm, units) => {
  if (!(secPerKm > 0)) return ['', ''];
  const spu = Math.round(units === 'mi' ? secPerKm * KM_PER_MI : secPerKm);
  return [String(Math.floor(spu / 60)), String(spu % 60).padStart(2, '0')];
};

// workout: a plan workout, or null for an ad-hoc run. existing: an ad-hoc
// log entry to edit. A workout that already has a log opens in edit mode.
// onSaved(info) re-renders the caller; info = { workout, log, adhoc } lets
// it show post-run feedback.
export function openLogModal(workout, onSaved, existing = null) {
  const state = loadState();
  const units = state.settings.units;
  const isAdhoc = !workout;
  const prev = isAdhoc ? existing : workout.log;
  const editing = !!prev;
  const evidence = { plan: state.plan, extraLogs: state.extraLogs };
  const isEffort = workout && (workout.type === 'tt' || workout.type === 'race');
  const workKey = workout ? workPaceKey(workout) : null;
  const workTarget = workout ? workTargetSec(workout, state.profile, evidence) : null;

  const presetKm = prev?.distKm ?? (workout?.type === 'tt' ? workout.work?.km : workout?.distKm);
  const presetDist = presetKm != null ? String(Math.round(kmToUnit(presetKm, units) * 100) / 100) : '';
  const t = prev?.durSec || 0;
  const [pm, ps] = splitPace(prev?.workPaceSec, units);
  const title = isAdhoc ? (editing ? 'Edit run' : 'Log a run') : `${editing ? 'Edit' : 'Log'}: ${esc(workout.title)}`;
  const sub = isAdhoc ? 'An unplanned run. It still counts toward your totals.'
    : isEffort ? 'Enter the time-trial / race itself, not the warm-up or cool-down.'
      : 'How did it go?';
  const el = openModal(`
    <button class="modal-close" aria-label="Close">×</button>
    <h2 id="modal-title">${title}</h2>
    <p class="sub">${sub}</p>
    ${isAdhoc ? `<div class="field"><label for="log-date">Date</label><input type="date" id="log-date" value="${esc(prev?.date || todayStr())}" max="${todayStr()}"></div>` : ''}
    <div class="field"><label for="log-dist">${isEffort ? 'Race distance' : 'Distance'} (${units})</label>
      <input type="number" inputmode="decimal" step="0.01" min="0" id="log-dist" value="${presetDist}" placeholder="0.0"></div>
    <div class="field"><label>${isEffort ? 'Finish time' : 'Time'}</label>
      <div class="field-row">
        <input type="number" inputmode="numeric" min="0" max="40" id="log-h" placeholder="h" aria-label="Hours" value="${t ? Math.floor(t / 3600) || '' : ''}">
        <input type="number" inputmode="numeric" min="0" max="59" id="log-m" placeholder="min" aria-label="Minutes" value="${t ? Math.floor((t % 3600) / 60) : ''}">
        <input type="number" inputmode="numeric" min="0" max="59" id="log-s" placeholder="sec" aria-label="Seconds" value="${t ? t % 60 : ''}">
      </div>
    </div>
    ${workKey ? `<div class="field"><label>Main-set pace (/${units}) · optional</label>
      <div class="field-row">
        <input type="number" inputmode="numeric" min="1" max="20" id="log-wm" placeholder="min" aria-label="Main-set pace minutes" value="${pm}">
        <input type="number" inputmode="numeric" min="0" max="59" id="log-ws" placeholder="sec" aria-label="Main-set pace seconds" value="${ps}">
      </div>
      <p class="hint">Average pace of just the ${workKey === 'threshold' ? 'tempo / cruise reps' : workKey === 'goalpace' || workKey === 'marathon' ? 'goal-pace segments' : 'hard reps'} (from your watch laps)${workTarget ? `. Target ${fmtPace(workTarget, units)}` : ''}. This is what sharpens your paces; the whole-run average includes the warm-up and jogs.</p>
    </div>` : ''}
    ${isAdhoc ? `<label class="check-row"><input type="checkbox" id="log-race" ${prev?.race ? 'checked' : ''}> This was a race or all-out time trial <span class="hint">(updates your fitness)</span></label>` : ''}
    <div class="field"><label>Effort (RPE 1 = easy stroll · 10 = all out)</label>
      <div class="rpe-row" id="log-rpe" role="radiogroup" aria-label="Effort">
        ${Array.from({ length: 10 }, (_, i) => `<button type="button" data-rpe="${i + 1}" class="${prev?.rpe === i + 1 ? 'on' : ''}" aria-pressed="${prev?.rpe === i + 1}">${i + 1}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label for="log-notes">Notes (optional)</label>
      <textarea id="log-notes" rows="2" placeholder="How it felt, route, weather…">${esc(prev?.notes || '')}</textarea></div>
    <div id="log-pace-preview" class="hint" style="margin-bottom:10px"></div>
    <div class="btn-row">
      ${!isAdhoc && !editing ? '<button class="btn ghost" id="log-skip">Skip workout</button>' : ''}
      ${isAdhoc && editing ? '<button class="btn ghost danger" id="log-delete">Delete run</button>' : ''}
      <button class="btn primary" id="log-save">${editing ? 'Save changes' : 'Save run'}</button>
    </div>
  `);

  let rpe = prev?.rpe ?? null;
  el.querySelectorAll('#log-rpe button').forEach((b) =>
    b.addEventListener('click', () => {
      rpe = parseInt(b.dataset.rpe, 10);
      el.querySelectorAll('#log-rpe button').forEach((x) => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    }));

  const num = (id) => parseInt(el.querySelector(id)?.value || 0, 10) || 0;
  const timeSec = () => num('#log-h') * 3600 + num('#log-m') * 60 + num('#log-s');
  const workPace = () => {
    if (!el.querySelector('#log-wm')) return null;
    const spu = num('#log-wm') * 60 + num('#log-ws');
    return spu >= 90 ? (units === 'mi' ? spu / KM_PER_MI : spu) : null;
  };
  const paceLine = () => {
    const distU = parseFloat(el.querySelector('#log-dist').value);
    const sec = timeSec();
    const out = el.querySelector('#log-pace-preview');
    out.textContent = distU > 0 && sec > 0
      ? `Average: ${fmtPaceDisplay(sec / unitToKm(distU, units), state.settings)} · ${fmtTime(sec)}` : '';
  };
  el.addEventListener('input', paceLine);
  paceLine();

  el.querySelector('#log-save').addEventListener('click', () => {
    const distU = parseFloat(el.querySelector('#log-dist').value);
    const sec = timeSec();
    if (!(distU > 0)) { el.querySelector('#log-dist').focus(); return; }
    const log = {
      distKm: unitToKm(distU, units),
      durSec: sec > 0 ? sec : null,
      rpe, notes: el.querySelector('#log-notes').value.trim() || null,
      loggedAt: prev?.loggedAt || new Date().toISOString(),
    };
    const wp = workPace();
    if (wp) log.workPaceSec = wp;
    if (isAdhoc) {
      const date = el.querySelector('#log-date').value || todayStr();
      const race = el.querySelector('#log-race').checked;
      if (editing) Object.assign(existing, { date, ...log, race });
      else state.extraLogs.push({ id: Math.random().toString(36).slice(2), date, ...log, race });
    } else {
      workout.status = 'done';
      workout.log = log;
    }
    saveState();
    closeModal();
    onSaved({ workout, log, adhoc: isAdhoc });
  });

  el.querySelector('#log-skip')?.addEventListener('click', () => {
    workout.status = 'skipped';
    saveState();
    closeModal();
    onSaved(null);
  });
  el.querySelector('#log-delete')?.addEventListener('click', () => {
    state.extraLogs = state.extraLogs.filter((x) => x !== existing);
    saveState();
    closeModal();
    onSaved(null);
  });
}
