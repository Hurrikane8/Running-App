// Shared workout presentation helpers + the log-workout modal.

import { loadState, saveState } from './storage.js';
import { pacesForProfile } from './plangen.js';
import { fmtDist, fmtPaceDisplay, fmtPaceRangeDisplay, fmtTime, esc, kmToUnit, unitToKm, todayStr } from './util.js';

export const TYPE_LABEL = {
  easy: 'Easy', recovery: 'Recovery', long: 'Long run', tempo: 'Threshold',
  intervals: 'VO2max', reps: 'Speed', mpace: 'Goal pace', strides: 'Strides',
  hills: 'Hills', xtrain: 'Cross-train', race: 'Race',
};

export const QUALITY_TYPES = new Set(['tempo', 'intervals', 'reps', 'mpace', 'hills', 'race']);

export function chipFor(w) {
  if (w.status === 'done') return '<span class="chip done">✓ Done</span>';
  if (w.status === 'skipped') return '<span class="chip">Skipped</span>';
  const q = QUALITY_TYPES.has(w.type) ? 'q' : '';
  return `<span class="chip ${q}">${TYPE_LABEL[w.type] || w.type}</span>`;
}

// "8 km · easy pace 6:30–7:10 /km" (or "easy 5.2–6.0 mph" in treadmill mode)
export function targetLine(w, profile, settings) {
  const parts = [];
  if (w.distKm != null) parts.push(fmtDist(w.distKm, settings.units));
  if (w.durMin != null) parts.push(w.durMin >= 60 ? `${Math.floor(w.durMin / 60)} h ${w.durMin % 60 ? (w.durMin % 60) + ' min' : ''}`.trim() : `${w.durMin} min`);
  const pace = paceTarget(w, profile, settings);
  if (pace) parts.push(pace);
  return parts.join(' · ');
}

export function paceTarget(w, profile, settings) {
  if (!w.paceKey || !profile) return w.type === 'long' && !w.paceKey ? 'easy effort (RPE 3–4)' : null;
  const p = pacesForProfile(profile);
  switch (w.paceKey) {
    case 'easy': return `easy ${fmtPaceRangeDisplay(p.easy[0], p.easy[1], settings)}`;
    case 'marathon': return `goal pace ${fmtPaceDisplay(p.marathon, settings)}`;
    case 'threshold': return `threshold ${fmtPaceDisplay(p.threshold, settings)}`;
    case 'interval': return `interval ${fmtPaceDisplay(p.interval, settings)}`;
    case 'rep': return `rep pace ${fmtPaceDisplay(p.rep, settings)}`;
    default: return null;
  }
}

export function structureRows(w, profile, settings) {
  const rows = [];
  if (w.structure.warmup) rows.push(['Warm-up', w.structure.warmup]);
  rows.push(['Main set', decoratePaces(w.structure.main, w, profile, settings)]);
  if (w.structure.cooldown) rows.push(['Cool-down', w.structure.cooldown]);
  return rows.map(([k, v]) =>
    `<div class="structure-row"><div class="structure-label">${k}</div><div class="structure-body">${v}</div></div>`).join('');
}

function decoratePaces(text, w, profile, settings) {
  if (!profile) return esc(text);
  const p = pacesForProfile(profile);
  const map = {
    'easy pace': `easy pace <span class="pace-pill">${fmtPaceRangeDisplay(p.easy[0], p.easy[1], settings)}</span>`,
    'threshold pace': `threshold pace <span class="pace-pill">${fmtPaceDisplay(p.threshold, settings)}</span>`,
    'interval pace': `interval pace <span class="pace-pill">${fmtPaceDisplay(p.interval, settings)}</span>`,
    'repetition pace': `repetition pace <span class="pace-pill">${fmtPaceDisplay(p.rep, settings)}</span>`,
    'marathon (goal) pace': `marathon (goal) pace <span class="pace-pill">${fmtPaceDisplay(p.marathon, settings)}</span>`,
    'marathon pace': `marathon pace <span class="pace-pill">${fmtPaceDisplay(p.marathon, settings)}</span>`,
    'goal pace': `goal pace <span class="pace-pill">${fmtPaceDisplay(p.marathon, settings)}</span>`,
  };
  let out = esc(text);
  for (const [k, v] of Object.entries(map)) out = out.replace(new RegExp(k, 'i'), v);
  return out;
}

// ---- modal plumbing ----

export function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-scrim"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const scrim = root.firstElementChild;
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
  root.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', closeModal));
  return scrim.firstElementChild;
}

export function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

// ---- log-workout modal (also used for ad-hoc runs) ----

// workout may be null → ad-hoc log. onSaved() re-renders the calling view.
export function openLogModal(workout, onSaved) {
  const state = loadState();
  const units = state.settings.units;
  const isAdhoc = !workout;
  const presetDist = workout?.distKm != null ? kmToUnit(workout.distKm, units).toFixed(1) : '';
  const el = openModal(`
    <button class="modal-close" aria-label="Close">×</button>
    <h2>${isAdhoc ? 'Log a run' : `Log: ${esc(workout.title)}`}</h2>
    <p class="sub">${isAdhoc ? 'An unplanned run — it still counts toward your totals.' : 'How did it go?'}</p>
    ${isAdhoc ? `<div class="field"><label>Date</label><input type="date" id="log-date" value="${todayStr()}" max="${todayStr()}"></div>` : ''}
    <div class="field-row">
      <div class="field"><label>Distance (${units})</label>
        <input type="number" inputmode="decimal" step="0.1" min="0" id="log-dist" value="${presetDist}" placeholder="0.0"></div>
    </div>
    <div class="field"><label>Time</label>
      <div class="field-row">
        <input type="number" inputmode="numeric" min="0" max="40" id="log-h" placeholder="h" style="flex:1">
        <input type="number" inputmode="numeric" min="0" max="59" id="log-m" placeholder="min" style="flex:1">
        <input type="number" inputmode="numeric" min="0" max="59" id="log-s" placeholder="sec" style="flex:1">
      </div>
    </div>
    <div class="field"><label>Effort (RPE 1 = easy stroll · 10 = all out)</label>
      <div class="rpe-row" id="log-rpe">
        ${Array.from({ length: 10 }, (_, i) => `<button data-rpe="${i + 1}">${i + 1}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label>Notes (optional)</label>
      <textarea id="log-notes" rows="2" placeholder="How it felt, route, weather…"></textarea></div>
    <div id="log-pace-preview" class="hint" style="margin-bottom:10px"></div>
    <div class="btn-row">
      ${!isAdhoc ? '<button class="btn ghost" id="log-skip">Skip workout</button>' : ''}
      <button class="btn primary" id="log-save">Save run</button>
    </div>
  `);

  let rpe = null;
  el.querySelectorAll('#log-rpe button').forEach((b) =>
    b.addEventListener('click', () => {
      rpe = parseInt(b.dataset.rpe, 10);
      el.querySelectorAll('#log-rpe button').forEach((x) => x.classList.toggle('on', x === b));
    }));

  const paceLine = () => {
    const distU = parseFloat(el.querySelector('#log-dist').value);
    const sec = timeSec();
    const prev = el.querySelector('#log-pace-preview');
    if (distU > 0 && sec > 0) {
      const distKm = unitToKm(distU, units);
      prev.textContent = `Pace: ${fmtPaceDisplay(sec / distKm, state.settings)} · ${fmtTime(sec)}`;
    } else prev.textContent = '';
  };
  const timeSec = () => {
    const h = parseInt(el.querySelector('#log-h').value || 0, 10);
    const m = parseInt(el.querySelector('#log-m').value || 0, 10);
    const s = parseInt(el.querySelector('#log-s').value || 0, 10);
    return h * 3600 + m * 60 + s;
  };
  el.addEventListener('input', paceLine);

  el.querySelector('#log-save').addEventListener('click', () => {
    const distU = parseFloat(el.querySelector('#log-dist').value);
    const sec = timeSec();
    if (!(distU > 0)) { el.querySelector('#log-dist').focus(); return; }
    const log = {
      distKm: unitToKm(distU, units),
      durSec: sec > 0 ? sec : null,
      rpe, notes: el.querySelector('#log-notes').value.trim() || null,
      loggedAt: new Date().toISOString(),
    };
    if (isAdhoc) {
      const date = el.querySelector('#log-date').value || todayStr();
      state.extraLogs.push({ id: Math.random().toString(36).slice(2), date, ...log });
    } else {
      workout.status = 'done';
      workout.log = log;
    }
    saveState();
    closeModal();
    onSaved();
  });

  const skip = el.querySelector('#log-skip');
  if (skip) skip.addEventListener('click', () => {
    workout.status = 'skipped';
    saveState();
    closeModal();
    onSaved();
  });
}
