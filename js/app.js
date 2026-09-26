// Bootstrap + tab router.
//
// Tabs live in the URL hash (#today, #week, …) so reload, the browser back
// button and Android's back gesture behave. Views can navigate with
// navigate(tab, { week, action }) — e.g. the Plan chart opens a given week.

import { loadState } from './storage.js';
import { renderOnboarding } from './views/onboarding.js';
import { renderToday } from './views/today.js';
import { renderWeek, resetWeekView, showWeek } from './views/week.js';
import { renderPlan } from './views/plan.js';
import { renderProgress } from './views/progress.js';
import { renderSettings } from './views/settings.js';
import { quoteForDate } from './quotes.js';
import { GOALS, weekOf } from './plangen.js';
import { todayStr } from './util.js';
import { closeModal, toast } from './wkfmt.js';

const TABS = ['today', 'week', 'plan', 'progress', 'settings'];
const view = document.getElementById('view');
const topbar = document.getElementById('topbar');
const tabbar = document.getElementById('tabbar');

let activeTab = 'today';
let pendingAction = null;

function refresh() {
  render(activeTab, { keepScroll: true });
}

function tabFromHash() {
  const t = location.hash.replace('#', '');
  return TABS.includes(t) ? t : 'today';
}

export function navigate(tab, opts = {}) {
  if (opts.week) showWeek(opts.week);
  pendingAction = opts.action || null;
  if (location.hash !== `#${tab}`) location.hash = tab; // → hashchange → render
  else render(tab);
}
window.addEventListener('stride:navigate', (e) => navigate(e.detail.tab, e.detail));
window.addEventListener('hashchange', () => { closeModal(); render(tabFromHash()); });

function render(tab, { keepScroll = false } = {}) {
  activeTab = tab;
  const state = loadState();
  if (!state.profile || !state.plan) {
    topbar.hidden = true;
    tabbar.hidden = true;
    renderOnboarding(view, () => {
      resetWeekView();
      navigate('today');
    });
    return;
  }
  topbar.hidden = false;
  tabbar.hidden = false;

  const g = GOALS[state.profile.goal];
  const wk = weekOf(state.plan, todayStr());
  document.getElementById('topbar-meta').textContent =
    wk ? `${g.label} · Wk ${wk.idx + 1}/${state.plan.weeks.length}` : g.label;

  tabbar.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });

  const y = window.scrollY;
  view.innerHTML = '';
  const action = pendingAction;
  pendingAction = null;
  switch (tab) {
    case 'today': renderToday(view, refresh); break;
    case 'week': renderWeek(view, refresh); break;
    case 'plan': renderPlan(view); break;
    case 'progress': renderProgress(view); break;
    case 'settings': renderSettings(view, refresh, () => { resetWeekView(); navigate('today'); }, action); break;
  }
  window.scrollTo(0, keepScroll ? y : 0);
}

// Daily quote splash — once per app session (cold launch), tap or timeout to dismiss.
function showSplash() {
  try {
    if (sessionStorage.getItem('stride.splashShown')) return;
    sessionStorage.setItem('stride.splashShown', '1');
  } catch { /* private mode: still show, just may repeat */ }
  const splash = document.getElementById('splash');
  const q = quoteForDate();
  document.getElementById('splash-quote').textContent = `“${q.t}”`;
  document.getElementById('splash-attr').textContent = q.a;
  splash.hidden = false;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    splash.classList.add('splash-out');
    setTimeout(() => { splash.hidden = true; }, 450);
  };
  splash.addEventListener('click', close);
  setTimeout(close, 3500);
}

tabbar.querySelectorAll('.tab').forEach((b) =>
  b.addEventListener('click', () => navigate(b.dataset.tab)));

showSplash();
render(tabFromHash());

// PWA service worker. The SW activates new versions immediately; when one
// takes over a page that was already controlled, offer a one-tap refresh
// so the new code is actually running (instead of needing two reloads).
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let shown = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || shown) return;
    shown = true;
    toast('Stride was updated. <button class="toast-btn" id="sw-reload">Refresh</button>', 60000);
    document.getElementById('sw-reload')?.addEventListener('click', () => location.reload());
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => reg.update?.())
      .catch((e) => console.warn('SW registration failed', e));
  });
}
