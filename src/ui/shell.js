// App shell wiring: nav active state, sticky activity bar, FAB, "more" drawer.

import { $, $$, el, openSheet, closeSheet } from '../utils/dom.js';
import { fmtDuration } from '../utils/format.js';
import { getState, subscribe } from '../state.js';
import { openCapture } from './capture.js';
import { navigate, onRoute } from '../router.js';

import { canAccess } from '../auth.js';

// All modules grouped for sidebar + drawer + Today grid
export const RAW_MODULE_GROUPS = [
  {
    label: 'daily',
    modules: [
      { path: '/today',    label: 'Today',     icon: 'ph-flower' },
      { path: '/tasks',    label: 'Tasks',     icon: 'ph-checks' },
      { path: '/timer',    label: 'Timer',     icon: 'ph-timer' },
      { path: '/calendar', label: 'Calendar',  icon: 'ph-calendar-heart' },
      { path: '/done-jar', label: 'Done jar',  icon: 'ph-confetti' },
    ],
  },
  {
    label: 'mind & body',
    modules: [
      { path: '/health',   label: 'Health',     icon: 'ph-flower-tulip' },
      { path: '/mino',     label: 'Mino',       icon: 'ph-heart' },
      { path: '/focus',    label: 'Focus',      icon: 'ph-target' },
      { path: '/thought',  label: 'Thought park', icon: 'ph-cloud' },
      { path: '/playbook', label: 'Playbook',   icon: 'ph-magic-wand' },
      { path: '/doom',     label: 'No-scroll',  icon: 'ph-shield-check' },
    ],
  },
  {
    label: 'study & create',
    modules: [
      { path: '/upsc',     label: 'UPSC',      icon: 'ph-books' },
      { path: '/reading',  label: 'Reading',   icon: 'ph-book-open' },
      { path: '/substack', label: 'Substack',  icon: 'ph-pen-nib' },
      { path: '/journal',  label: 'Journal',   icon: 'ph-notebook' },
    ],
  },
  {
    label: 'life',
    modules: [
      { path: '/people',   label: 'People',    icon: 'ph-users-three' },
      { path: '/places',   label: 'Places',    icon: 'ph-map-pin' },
      { path: '/reviews',  label: 'Reviews',   icon: 'ph-chart-line-up' },
      { path: '/me',       label: 'Me',        icon: 'ph-sparkle' },
    ],
  },
];

// Visible modules: filter out anything the current user can't access (e.g. /journal for Prakhar)
export const MODULE_GROUPS = RAW_MODULE_GROUPS
  .map((g) => ({ ...g, modules: g.modules.filter((m) => canAccess(m.path)) }))
  .filter((g) => g.modules.length > 0);

// Flat list for sidebar + drawer (excludes Today since it's the homepage)
const MORE_LINKS = MODULE_GROUPS.flatMap((g) => g.modules)
  .filter((m) => !['/today','/tasks','/timer','/mino','/me'].includes(m.path));

export function mountShell() {
  mountSidebar();
  // Nav active state
  onRoute((path) => {
    $$('.nav__tab, .sidebar__link').forEach((tab) => {
      tab.classList.toggle('is-active', `#${path}` === tab.getAttribute('href'));
    });
  });

  // Mino tab opens her panel (no separate page)
  $('.nav__tab[data-tab="mino"]').addEventListener('click', (e) => {
    e.preventDefault();
    import('../mino/panel.js').then((m) => m.openMinoPanel());
  });

  // Quick-capture FAB
  $('#capture-fab').addEventListener('click', openCapture);

  // Sticky activity bar
  mountActivityBar();

  // "More" drawer · long press / right-click Tasks tab; or via a small more button
  // (For now, a sheet with all secondary modules opens from a button in Today and from Me.)
  window.openMoreDrawer = openMoreDrawer;
}

function mountActivityBar() {
  const bar = $('#activity-bar');
  const label = bar.querySelector('.activity-bar__label');
  const time  = bar.querySelector('.activity-bar__time');
  const stop  = bar.querySelector('[data-action="stop-timer"]');

  stop.addEventListener('click', async () => {
    const { stopTimer } = await import('./timer.js');
    stopTimer();
  });
  // Tap the label/time to jump to Timer tab
  label.addEventListener('click', () => { location.hash = '/timer'; });
  time.addEventListener('click',  () => { location.hash = '/timer'; });

  function paint() {
    const s = getState();
    const t = s?.timer?.active;
    if (!t || !t.startedAt) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    label.textContent = t.label || t.categoryLabel || 'tracking';
    const ms = Date.now() - Date.parse(t.startedAt);
    time.textContent = fmtDuration(ms);
  }

  subscribe(paint);
  setInterval(paint, 1000);
  paint();
}

function mountSidebar() {
  const sidebar = $('#sidebar');
  if (!sidebar) return;
  sidebar.innerHTML = '';
  sidebar.appendChild(el('div', { class: 'sidebar__title' }, 'sriya ✿'));
  MODULE_GROUPS.forEach((group) => {
    sidebar.appendChild(el('div', { class: 'sidebar__section' }, group.label));
    group.modules.forEach((m) => {
      sidebar.appendChild(el('a', { class: 'sidebar__link', href: `#${m.path}` }, [
        el('i', { class: `ph-duotone ${m.icon}`, 'aria-hidden': 'true' }),
        el('span', null, m.label),
      ]));
    });
  });
  // Search shortcut hint at the bottom
  sidebar.appendChild(el('div', { class: 'sidebar__section', style: { marginTop: '20px' } }, 'shortcuts'));
  sidebar.appendChild(el('button', {
    class: 'sidebar__link',
    style: { width: '100%', background: 'transparent', border: 'none', textAlign: 'left' },
    onClick: () => import('./search.js').then((m) => m.openSearch()),
  }, [
    el('i', { class: 'ph-duotone ph-magnifying-glass', 'aria-hidden': 'true' }),
    el('span', null, 'search · ⌘K'),
  ]));
}

function openMoreDrawer() {
  const wrap = el('div', { class: 'stack' });
  MODULE_GROUPS.forEach((group) => {
    wrap.appendChild(el('div', { class: 'section-divider' }, group.label));
    wrap.appendChild(el('div', { class: 'modules-grid' },
      group.modules.map((m) => el('a', {
        class: 'modules-grid__tile', href: `#${m.path}`,
        onClick: (e) => {
          // Belt + braces: close the sheet first then force-navigate so the
          // hashchange fires even if the link default is swallowed by a parent.
          e.preventDefault();
          closeSheet();
          setTimeout(() => { location.hash = m.path; }, 60);
        },
      }, [
        el('i', { class: `ph-duotone ${m.icon}`, 'aria-hidden': 'true' }),
        el('span', null, m.label),
      ]))
    ));
  });
  openSheet(wrap, { title: 'all modules' });
}
