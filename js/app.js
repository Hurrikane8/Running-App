// Bootstrap + tab router.

import { loadState } from './storage.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderToday } from './views/today.js';
import { renderWeek, resetWeekView } from './views/week.js';
import { renderProgress } from './views/progress.js';
import { renderSettings } from './views/settings.js';
import { GOALS, weekOf } from './plangen.js';
import { todayStr } from './util.js';

const view = document.getElementById('view');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');

let activeTab = 'today';

function refresh() {
  render(activeTab);
}

function render(tab) {
  activeTab = tab;
  const state = loadState();
  if (!state.profile || !state.plan) {
    topbar.hidden = true;
    tabbar.hidden = true;
    renderOnboarding(view, () => {
      resetWeekView();
      render('today');
    });
    return;
  }
  topbar.hidden = false;
  tabbar.hidden = false;

  const g = GOALS[state.profile.goal];
  const wk = weekOf(state.plan, todayStr());
  document.getElementById('topbar-meta').textContent =
    wk ? `${g.label} · Wk ${wk.idx + 1}/${state.plan.weeks.length}` : g.label;

  tabbar.querySelectorAll('.tab').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === tab));

  view.innerHTML = '';
  switch (tab) {
    case 'today': renderToday(view, refresh); break;
    case 'week': renderWeek(view, refresh); break;
    case 'progress': renderProgress(view); break;
    case 'settings': renderSettings(view, refresh, () => { resetWeekView(); render('today'); }); break;
  }
  window.scrollTo(0, 0);
}

tabbar.querySelectorAll('.tab').forEach((b) =>
  b.addEventListener('click', () => render(b.dataset.tab)));

render('today');

// PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  });
}
