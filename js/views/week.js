// Week calendar: 7-day grid, drag (desktop) + tap-to-move (mobile) rescheduling,
// per-workout logging, and week navigation across the whole plan.

import { loadState, saveState } from '../storage.js';
import { weekOf, findWorkout } from '../plangen.js';
import { todayStr, addDays, mondayOf, fmtDateShort, strToDate, DAY_ABBR, esc, fmtDist } from '../util.js';
import { chipFor, targetLine, openLogModal, openModal, closeModal, structureRows } from '../wkfmt.js';

let shownMonday = null;   // Monday of the displayed week
let movingId = null;      // workout id in tap-to-move mode

export function renderWeek(container, refresh) {
  const state = loadState();
  const { plan, profile, settings } = state;
  const today = todayStr();
  const evidence = { plan, extraLogs: state.extraLogs };
  if (!shownMonday) shownMonday = mondayOf(today);

  const week = plan.weeks.find((w) => w.start === shownMonday) || null;
  const weekNo = week ? week.idx + 1 : null;
  const planned = week ? week.workouts.filter((w) => w.type !== 'xtrain') : [];
  const plannedKm = planned.reduce((s, w) => s + (w.distKm ?? (w.durMin ? w.durMin / 7 : 0)), 0);
  const doneKm = planned.filter((w) => w.status === 'done').reduce((s, w) => s + (w.log?.distKm || 0), 0);

  let html = `
    <h1 class="screen-title">Week</h1>
    <div class="week-nav">
      <button class="btn" id="wk-prev" aria-label="Previous week">‹</button>
      <div class="label">
        <b>${week ? `Week ${weekNo} of ${plan.weeks.length}` : 'Outside plan'}</b>
        <span>${fmtDateShort(shownMonday)} to ${fmtDateShort(addDays(shownMonday, 6))}${week ? ` · <span class="phase-chip">${week.deload ? 'recovery' : week.phase}</span>` : ''}</span>
      </div>
      <button class="btn" id="wk-next" aria-label="Next week">›</button>
    </div>
  `;

  if (week) {
    html += `<div class="week-summary">
      <div class="stat-tile"><div class="v">${fmtDist(plannedKm, settings.units, 0)}</div><div class="k">planned</div></div>
      <div class="stat-tile"><div class="v">${fmtDist(doneKm, settings.units, 0)}</div><div class="k">completed</div></div>
      <div class="stat-tile"><div class="v">${planned.filter((w) => w.status === 'done').length}/${planned.length}</div><div class="k">sessions</div></div>
    </div>`;
  }

  if (movingId) {
    const mv = findWorkout(plan, movingId);
    html += `<div class="move-banner">
      <span>Moving “${esc(mv?.workout.title || '')}”: tap a day</span>
      <button id="cancel-move">Cancel</button>
    </div>`;
  }

  for (let d = 0; d < 7; d++) {
    const date = addDays(shownMonday, d);
    const isToday = date === today;
    const dayW = week ? week.workouts.filter((w) => w.date === date) : [];
    const dnum = strToDate(date).getDate();
    html += `<div class="day-row ${isToday ? 'today-row' : ''}" data-date="${date}">
      <div class="day-col"><b>${DAY_ABBR[d]}</b><span>${dnum}</span></div>
      <div class="day-main">`;
    if (!dayW.length) {
      html += `<div class="rest">${week ? 'Rest' : '-'}</div>`;
    }
    for (const w of dayW) {
      html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 0" data-wid="${w.id}">
        ${chipFor(w)}
        <div style="min-width:0">
          <div class="w-title">${esc(w.title)}</div>
          <div class="w-sub">${targetLine(w, profile, settings, evidence)}</div>
        </div>
      </div>`;
    }
    html += `</div><div class="day-actions">`;
    for (const w of dayW) {
      html += `<button class="icon-btn" data-detail="${w.id}" aria-label="Details for ${esc(w.title)}">
        <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
      if (w.status === 'planned' && w.type !== 'race') {
        html += `<button class="icon-btn" data-move="${w.id}" draggable="true" aria-label="Move ${esc(w.title)}">
          <svg viewBox="0 0 24 24"><path d="M8 9h8M8 12h8M8 15h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </button>`;
      }
    }
    html += `</div></div>`;
  }

  container.innerHTML = html;

  container.querySelector('#wk-prev').addEventListener('click', () => { shownMonday = addDays(shownMonday, -7); movingId = null; refresh(); });
  container.querySelector('#wk-next').addEventListener('click', () => { shownMonday = addDays(shownMonday, 7); movingId = null; refresh(); });
  container.querySelector('#cancel-move')?.addEventListener('click', () => { movingId = null; refresh(); });

  container.querySelectorAll('[data-detail]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); openDetail(b.dataset.detail, refresh); }));

  // tap-to-move
  container.querySelectorAll('[data-move]').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); movingId = b.dataset.move; refresh(); });
    // drag & drop (desktop)
    b.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', b.dataset.move);
      e.dataTransfer.effectAllowed = 'move';
    });
  });

  container.querySelectorAll('.day-row').forEach((row) => {
    row.addEventListener('click', () => {
      if (!movingId) return;
      moveWorkout(movingId, row.dataset.date);
      movingId = null;
      refresh();
    });
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('dragover'); });
    row.addEventListener('dragleave', () => row.classList.remove('dragover'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('dragover');
      const id = e.dataTransfer.getData('text/plain');
      if (id) { moveWorkout(id, row.dataset.date); refresh(); }
    });
  });
}

function moveWorkout(id, newDate) {
  const state = loadState();
  const found = findWorkout(state.plan, id);
  if (!found) return;
  // Keep workouts inside their plan week so weekly volume stays honest
  const wkStart = found.week.start;
  if (newDate < wkStart || newDate > addDays(wkStart, 6)) return;
  found.workout.date = newDate;
  found.week.workouts.sort((a, b) => a.date.localeCompare(b.date));
  saveState();
}

function openDetail(id, refresh) {
  const state = loadState();
  const found = findWorkout(state.plan, id);
  if (!found) return;
  const w = found.workout;
  const { profile, settings } = state;
  const evidence = { plan: state.plan, extraLogs: state.extraLogs };
  const el = openModal(`
    <button class="modal-close" aria-label="Close">×</button>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">${chipFor(w)}</div>
    <h2>${esc(w.title)}</h2>
    <p class="sub">${fmtDateShort(w.date)} · ${targetLine(w, profile, settings, evidence)}</p>
    <div class="structure">${structureRows(w, profile, settings, evidence)}</div>
    ${w.tip ? `<div class="tip">${esc(w.tip)}</div>` : ''}
    ${w.status === 'planned'
      ? `<div class="btn-row">
           <button class="btn primary" id="d-log">Log workout</button>
         </div>`
      : w.status === 'done'
        ? `<div class="btn-row"><button class="btn ghost" id="d-unlog">Undo log</button></div>`
        : `<div class="btn-row"><button class="btn ghost" id="d-unskip">Restore workout</button></div>`}
  `);
  el.querySelector('#d-log')?.addEventListener('click', () => { closeModal(); openLogModal(w, refresh); });
  el.querySelector('#d-unlog')?.addEventListener('click', () => {
    w.status = 'planned'; w.log = null; saveState(); closeModal(); refresh();
  });
  el.querySelector('#d-unskip')?.addEventListener('click', () => {
    w.status = 'planned'; saveState(); closeModal(); refresh();
  });
}

export function resetWeekView() {
  shownMonday = null;
  movingId = null;
}
