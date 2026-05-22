// Entry · sets up state, theme, router, shell, Mino.

import { initState, getState, subscribe, update } from './state.js';
import * as auth from './auth.js';
import { showLoginGate } from './ui/login.js';
import { startRouter, registerRoute, setRouteHost } from './router.js';
import { mountShell } from './ui/shell.js';
import { mountMino } from './mino/mascot.js';
import { renderToday } from './ui/today.js';
import { renderMe, applyMode } from './ui/me.js';
import { renderTasks } from './ui/tasks.js';
import { renderTimer } from './ui/timer.js';
import { renderHealth } from './ui/health.js';
import { renderCalendar } from './ui/calendar.js';
import { renderDoneJar } from './ui/done-jar.js';
import { renderFocus } from './ui/focus.js';
import { renderThoughtPark } from './ui/thought-park.js';
import { renderGate, renderDoomDash } from './ui/doomscroll.js';
import { renderReviews } from './ui/reviews.js';
import { renderPlaybook } from './ui/playbook.js';
import { renderUPSC } from './ui/upsc.js';
import { renderReading } from './ui/reading.js';
import { renderJournal } from './ui/journal.js';
import { renderSubstack } from './ui/substack.js';
import { renderPlaces } from './ui/places.js';
import { renderPeople } from './ui/people.js';
import { bindSearchShortcut, openSearch } from './ui/search.js';
import { mountUnlocks } from './mino/unlocks.js';
import { placeholder } from './ui/placeholder.js';
import { runDailyTick } from './utils/recurrence.js';
import { mountNotifications } from './utils/notifications.js';
import { mountSyncStatus } from './ui/sync-status.js';
import { $ } from './utils/dom.js';

(async function main() {
  auth.init();
  setRouteHost($('#view'));

  if (!auth.isLoggedIn()) {
    // Show login first. Boot the rest after a successful login.
    showLoginGate({ onLogin: bootApp });
    return;
  }
  await bootApp();
})();

async function bootApp() {
  await initState();
  applyInitialTheme(getState());
  subscribe(applyInitialTheme); // re-apply on any settings change

  runDailyTick(getState(), update);

  registerRoutes();
  mountShell();
  mountSyncStatus();
  mountMino();
  mountNotifications();
  mountUnlocks();
  bindSearchShortcut();
  bindGlobalShortcuts();
  startRouter();
  // Lock copilot out of private modules
  window.addEventListener('hashchange', enforceRouteAccess);
  enforceRouteAccess();
  registerSW();
  bindVisibility();
  bindOffline();
}

function enforceRouteAccess() {
  const path = location.hash.replace(/^#/, '');
  if (path && !auth.canAccess(path)) {
    location.hash = '/today';
  }
}

function bindGlobalShortcuts() {
  // Long-press the FAB → open search
  const fab = $('#capture-fab');
  if (!fab) return;
  let timer = null;
  fab.addEventListener('mousedown',  () => { timer = setTimeout(() => openSearch(), 500); });
  fab.addEventListener('touchstart', () => { timer = setTimeout(() => openSearch(), 500); }, { passive: true });
  ['mouseup','mouseleave','touchend','touchcancel'].forEach((ev) => fab.addEventListener(ev, () => clearTimeout(timer)));

  // Escape closes any open sheet
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const sheet = $('#sheet-root');
      if (sheet && sheet.getAttribute('aria-hidden') === 'false') {
        sheet.setAttribute('aria-hidden', 'true');
        setTimeout(() => { while (sheet.firstChild) sheet.removeChild(sheet.firstChild); }, 300);
      }
    }
  });
}

function registerRoutes() {
  registerRoute('/today',    renderToday,    { title: 'today' });
  registerRoute('/tasks',    renderTasks,    { title: 'tasks' });
  registerRoute('/timer',    renderTimer,    { title: 'timer' });
  registerRoute('/calendar', renderCalendar, { title: 'calendar' });
  registerRoute('/mino',   (params, host) => { import('./mino/panel.js').then((m) => m.openMinoPanel()); renderToday(params, host); });
  registerRoute('/me',     renderMe, { title: 'me' });

  // More drawer modules
  registerRoute('/health',   renderHealth,      { title: 'health' });
  registerRoute('/reading',  renderReading,     { title: 'reading' });
  registerRoute('/upsc',     renderUPSC,        { title: 'upsc' });
  registerRoute('/done-jar', renderDoneJar,     { title: 'done jar' });
  registerRoute('/focus',    renderFocus,       { title: 'focus' });
  registerRoute('/thought',  renderThoughtPark, { title: 'thought park' });
  registerRoute('/gate',     renderGate,        { title: 'gate' });
  registerRoute('/doom',     renderDoomDash,    { title: 'anti-doomscroll' });
  registerRoute('/reviews',  renderReviews,     { title: 'reviews' });
  registerRoute('/playbook', renderPlaybook,    { title: 'playbook' });

  registerRoute('/substack', renderSubstack, { title: 'substack' });
  registerRoute('/journal',  renderJournal,  { title: 'journal' });
  registerRoute('/people',   renderPeople,   { title: 'people' });
  registerRoute('/places',   renderPlaces,   { title: 'places' });
}

function applyInitialTheme(s) {
  if (!s) return;
  document.body.dataset.theme  = s.settings.theme;
  document.body.dataset.petals = s.settings.petalsOn ? 'on' : 'off';
  document.body.dataset.motion = s.settings.motion === 'reduce' ? 'reduce' : '';
  document.documentElement.dataset.fontSize = s.settings.fontSize;
  document.documentElement.dataset.contrast = s.settings.contrast === 'high' ? 'high' : '';
  document.documentElement.dataset.dyslexic = s.settings.dyslexiaFont ? 'on' : '';
  applyMode(s.settings.mode);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  // Skip SW on localhost during dev · it caches modules and confuses live edits.
  const isLocalDev = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (isLocalDev) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    return;
  }

  // Remember whether there was already a controlling SW BEFORE we register.
  // The first install on a fresh device will fire controllerchange too, and we
  // don't want to reload on first load — only on actual UPDATES from now on.
  const hadController = !!navigator.serviceWorker.controller;

  // Auto-reload the page when the SW updates and takes over. The sw.js install
  // handler calls skipWaiting() and activate calls clients.claim() — once the
  // new SW becomes the controller, this listener fires and we reload to pick
  // up the new HTML/JS. Without this, mobile Chrome (Android in particular)
  // keeps serving the old cached assets even though a new SW is installed,
  // which is exactly what was happening to the phone.
  let _reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;          // skip first-install case
    if (_reloading) return;               // avoid double-reload loops
    _reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('/sw.js')
    .then((reg) => {
      // Poll every 60s for a new SW. Cheap & quiet — Chrome dedupes.
      setInterval(() => reg.update().catch(() => {}), 60_000);
      // Also check on tab focus — a long-backgrounded mobile PWA picks up
      // a new version the moment Sriya brings it forward.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('SW register failed', e));
}

function bindVisibility() {
  const apply = () => { document.body.dataset.tabHidden = document.hidden ? 'true' : ''; };
  document.addEventListener('visibilitychange', apply);
  apply();
}

function bindOffline() {
  const indicator = () => {
    const off = !navigator.onLine;
    document.body.style.outline = off ? '2px solid var(--warn)' : '';
  };
  window.addEventListener('online', indicator);
  window.addEventListener('offline', indicator);
}
