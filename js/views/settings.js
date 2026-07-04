// Settings: units, goal & fitness updates (with plan regeneration from the
// current week), plan overview, backup/restore, reset.

import { loadState, saveState, resetState, exportState, importState } from '../storage.js';
import { GOALS, replanFrom, pacesForProfile } from '../plangen.js';
import { vdotFromRace } from '../paces.js';
import { todayStr, addDays, esc, fmtPaceRangeDisplay, fmtPaceDisplay, kmToUnit, unitToKm } from '../util.js';
import { openModal, closeModal } from '../wkfmt.js';

const RACE_INPUT_DISTS = [
  { key: '1mi', label: '1 mile', km: 1.609 },
  { key: '5k', label: '5K', km: 5 },
  { key: '10k', label: '10K', km: 10 },
  { key: 'half', label: 'Half marathon', km: 21.0975 },
  { key: 'marathon', label: 'Marathon', km: 42.195 },
];

export function renderSettings(container, refresh, restartOnboarding) {
  const state = loadState();
  const { profile, plan, settings } = state;
  const units = settings.units;
  const p = pacesForProfile(profile);
  const g = GOALS[profile.goal];

  container.innerHTML = `
    <h1 class="screen-title">Settings</h1>
    <p class="screen-sub">Your plan adapts when anything here changes.</p>

    <div class="card">
      <h3 style="margin-bottom:10px">Units</h3>
      <div class="seg" id="set-units">
        <button data-units="km" class="${units === 'km' ? 'on' : ''}">Kilometres</button>
        <button data-units="mi" class="${units === 'mi' ? 'on' : ''}">Miles</button>
      </div>
      <h3 style="margin:16px 0 10px">Pace display</h3>
      <div class="seg" id="set-pacedisplay">
        <button data-pd="outdoor" class="${settings.paceDisplay !== 'treadmill' ? 'on' : ''}">Outdoor</button>
        <button data-pd="treadmill" class="${settings.paceDisplay === 'treadmill' ? 'on' : ''}">Treadmill</button>
      </div>
      ${settings.paceDisplay === 'treadmill'
        ? '<p class="hint">Pace targets show as treadmill speed in mph (treadmill consoles are mph), independent of your distance units.</p>' : ''}
    </div>

    <div class="card">
      <h3 style="margin-bottom:8px">Goal &amp; plan</h3>
      <div class="pr-row"><span class="k">Goal</span><span class="v">${g.label}</span></div>
      ${profile.raceDate ? `<div class="pr-row"><span class="k">Race date</span><span class="v">${esc(profile.raceDate)}</span></div>` : ''}
      <div class="pr-row"><span class="k">Run days</span><span class="v">${profile.daysPerWeek} / week</span></div>
      <div class="pr-row"><span class="k">Experience</span><span class="v" style="text-transform:capitalize">${profile.experience}</span></div>
      <div class="btn-row"><button class="btn" id="edit-goal">Change goal or schedule</button></div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:8px">Fitness &amp; paces</h3>
      <div class="pr-row"><span class="k">Fitness score (VDOT)</span><span class="v">${profile.vdot}</span></div>
      <div class="pr-row"><span class="k">Easy pace</span><span class="v">${fmtPaceRangeDisplay(p.easy[0], p.easy[1], settings)}</span></div>
      <div class="pr-row"><span class="k">Threshold</span><span class="v">${fmtPaceDisplay(p.threshold, settings)}</span></div>
      <div class="pr-row"><span class="k">Interval</span><span class="v">${fmtPaceDisplay(p.interval, settings)}</span></div>
      <div class="btn-row"><button class="btn" id="edit-fitness">Update fitness (new race / time trial)</button></div>
    </div>

    <div class="card">
      <h3 style="margin-bottom:6px">Data</h3>
      <p class="hint" style="margin-bottom:12px">Your plan and every logged workout live only in this browser. Export a JSON backup regularly — it restores everything if local storage is ever cleared.</p>
      <div class="btn-row" style="margin-top:0">
        <button class="btn" id="export-data">Export data</button>
        <button class="btn" id="import-data">Import data</button>
      </div>
      <div class="btn-row"><button class="btn ghost danger" id="reset-all">Erase everything &amp; start over</button></div>
    </div>
    <input type="file" id="import-file" accept="application/json" hidden>
  `;

  container.querySelectorAll('#set-units button').forEach((b) =>
    b.addEventListener('click', () => { settings.units = b.dataset.units; saveState(); refresh(); }));
  container.querySelectorAll('#set-pacedisplay button').forEach((b) =>
    b.addEventListener('click', () => { settings.paceDisplay = b.dataset.pd; saveState(); refresh(); }));

  container.querySelector('#edit-goal').addEventListener('click', () => openGoalModal(refresh));
  container.querySelector('#edit-fitness').addEventListener('click', () => openFitnessModal(refresh));

  container.querySelector('#export-data').addEventListener('click', () => {
    const blob = new Blob([exportState()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stride-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  const fileInput = container.querySelector('#import-file');
  container.querySelector('#import-data').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    try { importState(await f.text()); location.reload(); }
    catch (e) { alert(`Import failed: ${e.message}`); }
  });

  container.querySelector('#reset-all').addEventListener('click', () => {
    const el = openModal(`
      <h2>Erase everything?</h2>
      <p class="sub">Your plan, logs and records will be permanently deleted from this device.</p>
      <div class="btn-row">
        <button class="btn ghost" id="c-no">Keep my data</button>
        <button class="btn primary danger" id="c-yes" style="background:#c03030;color:#fff">Erase</button>
      </div>`);
    el.querySelector('#c-no').addEventListener('click', closeModal);
    el.querySelector('#c-yes').addEventListener('click', () => {
      resetState(); closeModal(); restartOnboarding();
    });
  });
}

function openGoalModal(refresh) {
  const state = loadState();
  const { profile } = state;
  const goalOpts = Object.entries(GOALS).map(([k, g]) =>
    `<option value="${k}" ${profile.goal === k ? 'selected' : ''}>${g.label}</option>`).join('');
  const el = openModal(`
    <button class="modal-close" aria-label="Close">×</button>
    <h2>Change goal or schedule</h2>
    <p class="sub">Past weeks and logs are kept; the plan regenerates from this week.</p>
    <div class="field"><label>Goal</label><select id="gm-goal">${goalOpts}</select></div>
    <div class="field" id="gm-date-wrap" ${profile.goal === 'fitness' ? 'hidden' : ''}>
      <label>Race date</label>
      <input type="date" id="gm-date" min="${addDays(todayStr(), 7)}" value="${profile.raceDate || ''}">
    </div>
    <div class="field"><label>Run days per week</label>
      <select id="gm-days">${[2, 3, 4, 5, 6, 7].map((n) =>
        `<option value="${n}" ${profile.daysPerWeek === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
    </div>
    <div class="field"><label>Experience</label>
      <select id="gm-exp">${['beginner', 'intermediate', 'advanced', 'elite'].map((x) =>
        `<option value="${x}" ${profile.experience === x ? 'selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select>
    </div>
    <div class="btn-row"><button class="btn primary" id="gm-save">Rebuild my plan</button></div>
  `);
  const goalSel = el.querySelector('#gm-goal');
  goalSel.addEventListener('change', () => {
    el.querySelector('#gm-date-wrap').hidden = goalSel.value === 'fitness';
  });
  el.querySelector('#gm-save').addEventListener('click', () => {
    const goal = goalSel.value;
    const raceDate = goal === 'fitness' ? null : (el.querySelector('#gm-date').value || null);
    if (goal !== 'fitness' && !raceDate) { el.querySelector('#gm-date').focus(); return; }
    profile.goal = goal;
    profile.raceDate = raceDate;
    profile.daysPerWeek = parseInt(el.querySelector('#gm-days').value, 10);
    profile.experience = el.querySelector('#gm-exp').value;
    state.plan = replanFrom(state.plan, profile, todayStr());
    saveState();
    closeModal();
    refresh();
  });
}

function openFitnessModal(refresh) {
  const state = loadState();
  const { profile, settings } = state;
  const distOpts = RACE_INPUT_DISTS.map((d) => `<option value="${d.key}">${d.label}</option>`).join('');
  const el = openModal(`
    <button class="modal-close" aria-label="Close">×</button>
    <h2>Update fitness</h2>
    <p class="sub">Enter a recent race or time-trial result and your training paces recalculate. You can also correct your weekly volume.</p>
    <div class="field"><label>Distance</label><select id="fm-dist">${distOpts}</select></div>
    <div class="field"><label>Time</label>
      <div class="field-row">
        <input type="number" inputmode="numeric" min="0" max="30" id="fm-h" placeholder="h" style="flex:1">
        <input type="number" inputmode="numeric" min="0" max="59" id="fm-m" placeholder="min" style="flex:1">
        <input type="number" inputmode="numeric" min="0" max="59" id="fm-s" placeholder="sec" style="flex:1">
      </div>
    </div>
    <div class="field"><label>Current weekly distance (${settings.units})</label>
      <input type="number" inputmode="decimal" min="0" id="fm-weekly" value="${Math.round(kmToUnit(profile.weeklyKm, settings.units))}"></div>
    <div class="btn-row"><button class="btn primary" id="fm-save">Recalculate &amp; adapt plan</button></div>
  `);
  el.querySelector('#fm-save').addEventListener('click', () => {
    const d = RACE_INPUT_DISTS.find((x) => x.key === el.querySelector('#fm-dist').value);
    const sec = (parseInt(el.querySelector('#fm-h').value || 0, 10) * 3600)
      + (parseInt(el.querySelector('#fm-m').value || 0, 10) * 60)
      + parseInt(el.querySelector('#fm-s').value || 0, 10);
    const weekly = parseFloat(el.querySelector('#fm-weekly').value);
    if (weekly >= 0) profile.weeklyKm = unitToKm(weekly, settings.units);
    if (sec >= 240) {
      profile.refRace = { distKm: d.km, timeSec: sec, label: d.label };
      profile.vdot = Math.round(vdotFromRace(d.km, sec) * 10) / 10;
    }
    state.plan = replanFrom(state.plan, profile, todayStr());
    saveState();
    closeModal();
    refresh();
  });
}
