// Anti-doomscroll system (§14.5).
// Routes:
//   /gate      · the 15s pause + "what are you avoiding?" + intention
//   /doom      · the dashboard: urges log, budget, insights, no-scroll windows
// And exports openUrgeSheet() called by Mino's panel + a global FAB option.

import { el, clear, openSheet, closeSheet, toast, viewOnlyBanner } from '../utils/dom.js';
import { getState, subscribe, update, uid } from '../state.js';
import { todayKey, relative, fmtMinutes, fmtClock } from '../utils/format.js';
import { isCopilot, writeGate } from '../auth.js';

const TRIGGERS = [
  { id: 'bored',    label: 'bored',    emoji: '🥱' },
  { id: 'anxious',  label: 'anxious',  emoji: '🫥' },
  { id: 'avoid',    label: 'avoiding', emoji: '🌀' },
  { id: 'bed',      label: 'in bed',   emoji: '🛏' },
  { id: 'lonely',   label: 'lonely',   emoji: '🫧' },
  { id: 'tired',    label: 'tired',    emoji: '😶‍🌫' },
];

// ─── /gate · the 15-second pause screen ──────────────────────
export function renderGate(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(buildGate()); };
  paint();
  unsub = subscribe(paint);
  // Body class to calm petals, hide Mino, etc.
  document.body.dataset.gate = 'on';
  host.addEventListener('beforerouted', () => {
    unsub && unsub();
    document.body.dataset.gate = '';
    if (countdownHandle) { clearInterval(countdownHandle); countdownHandle = null; }
  }, { once: true });
}

let countdownHandle = null;

function buildGate() {
  const s = getState();
  const day = todayKey();
  const todayUsed = (s.doomscroll.dailyLog?.[day]?.mins || 0);
  const budget = s.doomscroll.budgetMins ?? 30;

  const wrap = el('div', { class: 'stack', style: { minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' } });

  // 15-second un-skippable pause
  const pauseEl = el('div', { class: 'card card--hero', style: { textAlign: 'center', padding: 'var(--space-6)' } }, [
    el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '2rem' } }, 'breathe with me'),
    el('div', { dataset: { pause: '' }, style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '3rem', margin: '20px 0', fontVariantNumeric: 'tabular-nums', color: 'var(--primary-deep)' } }, '15'),
    el('p', { class: 'muted', style: { margin: 0 } }, 'four in · seven out · the petals fall slow ✿'),
  ]);
  wrap.appendChild(pauseEl);

  // The question + intention form (revealed after countdown)
  const q = el('div', { class: 'card', style: { display: 'none' } }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-question' }),
      'what are you actually avoiding?'
    ]),
    el('p', { class: 'muted', style: { margin: '0 0 10px' } }, 'name it, even if "nothing · just the urge"'),
    el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', marginBottom: '10px' } },
      TRIGGERS.map((t) => el('button', {
        class: 'chip', type: 'button', style: { cursor: 'pointer' },
        onClick: () => logUrge(t.id, t.label, /* opened */ false),
      }, [t.emoji, ' ', t.label]))
    ),

    el('div', { class: 'section-divider' }, 'options'),

    el('div', { class: 'stack' }, [
      el('a', { class: 'btn btn--block', href: '#/thought' }, [
        el('i', { class: 'ph-duotone ph-cloud' }), ' park the thought instead ✿'
      ]),
      el('a', { class: 'btn btn--soft btn--block', href: '#/today' }, [
        el('i', { class: 'ph-duotone ph-flower' }), ' open Today · what\'s next?'
      ]),
      el('a', { class: 'btn btn--soft btn--block', href: '#/reading' }, [
        el('i', { class: 'ph-duotone ph-book-open' }), ' read instead'
      ]),
      el('a', { class: 'btn btn--soft btn--block', href: '#/people' }, [
        el('i', { class: 'ph-duotone ph-users' }), ' text Prakhar / Amma'
      ]),
    ]),

    el('div', { class: 'section-divider' }, 'still going to scroll?'),

    el('p', { class: 'muted', style: { margin: '0 0 10px', fontSize: '0.75rem' } },
      `today's budget: ${fmtMinutes(todayUsed)} / ${fmtMinutes(budget)}`),

    el('div', { class: 'row', style: { gap: '6px' } }, [5, 10, 15, 30].map((m) =>
      el('button', { class: 'btn btn--ghost', style: { flex: 1 }, onClick: () => goAnyway(m) }, `${m} min`))),
  ]);
  wrap.appendChild(q);

  // Run the 15s countdown
  if (countdownHandle) clearInterval(countdownHandle);
  let n = 15;
  countdownHandle = setInterval(() => {
    n -= 1;
    const t = pauseEl.querySelector('[data-pause]');
    if (t) t.textContent = String(n);
    if (n <= 0) {
      clearInterval(countdownHandle); countdownHandle = null;
      pauseEl.style.display = 'none';
      q.style.display = 'block';
    }
  }, 1000);

  return wrap;
}

function logUrge(triggerId, triggerLabel, opened) {
  const now = new Date();
  update((d) => {
    d.doomscroll.urges.unshift({
      id: uid('u'), trigger: triggerId, triggerLabel,
      opened, mins: 0, at: now.toISOString(), date: todayKey(now),
      hour: now.getHours(),
    });
  });
  toast(`logged · ${triggerLabel}`);
}

function goAnyway(mins) {
  const now = new Date();
  update((d) => {
    const day = todayKey(now);
    d.doomscroll.dailyLog = d.doomscroll.dailyLog || {};
    d.doomscroll.dailyLog[day] = d.doomscroll.dailyLog[day] || { mins: 0, sessions: 0 };
    d.doomscroll.dailyLog[day].mins += mins;
    d.doomscroll.dailyLog[day].sessions += 1;
    d.doomscroll.urges.unshift({
      id: uid('u'), trigger: 'intentional', triggerLabel: `intent · ${mins}m`,
      opened: true, mins, at: now.toISOString(), date: day, hour: now.getHours(),
    });
  });
  toast(`okay · i'll check on you in ${mins} min ✿`);
  // Send self a reminder via Notification API if granted
  if ('Notification' in window && Notification.permission === 'granted') {
    setTimeout(() => {
      new Notification('time check ♡', { body: `you said ${mins} min · back to real things?`, icon: '/icons/icon-192.svg' });
    }, mins * 60_000);
  }
  // Leave the gate by going to Today
  location.hash = '/today';
}

// ─── Urge button (called from Mino's panel) ──────────────────
export function openUrgeSheet() {
  const wrap = el('div', { class: 'stack' });
  wrap.appendChild(el('p', { class: 'muted', style: { margin: 0 } }, 'log it. one breath. choose a 60-sec swap.'));

  // Trigger picker
  wrap.appendChild(el('div', { class: 'field__label' }, 'trigger'));
  const triggerWrap = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } });
  let chosen = null;
  TRIGGERS.forEach((t) => {
    const chip = el('button', { class: 'chip', type: 'button', style: { cursor: 'pointer' },
      onClick: () => {
        chosen = t;
        triggerWrap.querySelectorAll('.chip').forEach((c) => c.className = 'chip');
        chip.className = 'chip chip--primary';
      }
    }, [t.emoji, ' ', t.label]);
    triggerWrap.appendChild(chip);
  });
  wrap.appendChild(triggerWrap);

  // 60-second swaps
  wrap.appendChild(el('div', { class: 'section-divider' }, '60-second swap'));
  wrap.appendChild(el('div', { class: 'stack' }, [
    el('a', { class: 'btn btn--soft btn--block', href: '#/thought', onClick: () => closeSheet() },
      [el('i', { class: 'ph-duotone ph-cloud' }), ' dump to thought-park']),
    el('a', { class: 'btn btn--soft btn--block', href: '#/tasks', onClick: () => closeSheet() },
      [el('i', { class: 'ph-duotone ph-checks' }), ' one tiny task']),
    el('button', { class: 'btn btn--soft btn--block', onClick: () => { closeSheet(); toast('stretch · 4 in 7 out ✿'); } },
      [el('i', { class: 'ph-duotone ph-flower-tulip' }), ' a stretch']),
    el('a', { class: 'btn btn--soft btn--block', href: '#/people', onClick: () => closeSheet() },
      [el('i', { class: 'ph-duotone ph-chats-circle' }), ' text a real person']),
  ]));

  // Save log
  wrap.appendChild(el('button', { class: 'btn btn--block', style: { marginTop: '12px' }, onClick: () => {
    const t = chosen || { id: 'unknown', label: 'urge' };
    logUrge(t.id, t.label, false);
    closeSheet();
  } }, [el('i', { class: 'ph-fill ph-shield-check' }), ' log this urge']));

  openSheet(wrap, { title: 'urge button' });
}

// ─── /doom · dashboard ───────────────────────────────────────
export function renderDoomDash(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(buildDash()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function buildDash() {
  const s = getState();
  const day = todayKey();
  const usedToday = s.doomscroll.dailyLog?.[day]?.mins || 0;
  const budget = s.doomscroll.budgetMins ?? 30;
  const overBudget = usedToday > budget;
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['anti-doomscroll ', el('i', { class: 'ph-duotone ph-shield-check', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  if (isCopilot()) wrap.appendChild(viewOnlyBanner('view-only · sriya\'s no-scroll'));

  // Today's status
  wrap.appendChild(el('div', { class: 'card card--hero' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-eye' }), 'today']),
    el('div', { class: 'row row--between' }, [
      el('div', null, [
        el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '2rem' } },
          `${fmtMinutes(usedToday)}`),
        el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, `of ${fmtMinutes(budget)} budget · ${overBudget ? 'over (no shame)' : 'still ok'}`),
      ]),
      el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn btn--soft', onClick: () => {
          if (!writeGate('doomscroll', 'write')) return;
          addManualMins();
        } }, '+ log'),
      ]),
    ]),
    el('div', { style: { marginTop: '10px', height: '8px', background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden' } }, [
      el('div', { style: {
        height: '100%', width: `${Math.min(100, (usedToday / budget) * 100)}%`,
        background: overBudget ? 'var(--primary-deep)' : 'var(--primary)',
      } }),
    ]),
  ]));

  // Quick urge button
  wrap.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-hand' }), 'feel the pull?']),
    el('button', { class: 'btn btn--block', onClick: () => openUrgeSheet() }, [el('i', { class: 'ph-fill ph-shield-check' }), ' urge button']),
  ]));

  // Budget + no-scroll windows config
  wrap.appendChild(budgetCard(s));
  wrap.appendChild(noScrollWindowsCard(s));

  // Insights (after at least a week of data)
  wrap.appendChild(insightsCard(s));

  // Recent urges
  wrap.appendChild(urgesLogCard(s));

  return wrap;
}

function addManualMins() {
  const v = parseInt(prompt('honest minutes scrolled (today, no shame)', '15'), 10);
  if (!Number.isFinite(v) || v <= 0) return;
  update((d) => {
    const day = todayKey();
    d.doomscroll.dailyLog = d.doomscroll.dailyLog || {};
    d.doomscroll.dailyLog[day] = d.doomscroll.dailyLog[day] || { mins: 0, sessions: 0 };
    d.doomscroll.dailyLog[day].mins += v;
    d.doomscroll.dailyLog[day].sessions += 1;
  });
  toast('logged · just data, no judgment');
}

function budgetCard(s) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-target' }), 'doom budget']),
    el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
      [10, 20, 30, 45, 60].map((m) => el('button', {
        class: s.doomscroll.budgetMins === m ? 'chip chip--primary' : 'chip',
        type: 'button', style: { cursor: 'pointer' },
        onClick: () => update((d) => { d.doomscroll.budgetMins = m; })
      }, `${m}m`))
    ),
  ]);
}

function noScrollWindowsCard(s) {
  const windows = s.doomscroll.noScrollWindows || [];
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-moon-stars' }), 'no-scroll windows']),
    el('p', { class: 'muted', style: { margin: '0 0 8px', fontSize: '0.75rem' } }, 'mino is firmer at the gate during these.'),
    windows.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'no windows yet · recommended: 1h after wake, 1h before bed.') :
      el('div', { class: 'stack' }, windows.map((w, i) => el('div', { class: 'row row--between' }, [
        el('span', null, `${w.from} → ${w.to}${w.label ? ` · ${w.label}` : ''}`),
        el('button', { class: 'btn btn--soft', onClick: () => update((d) => { d.doomscroll.noScrollWindows.splice(i, 1); }) }, [el('i', { class: 'ph ph-trash' })]),
      ]))),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => addWindow('06:00','07:00','first hour awake') }, '+ wake'),
      el('button', { class: 'btn btn--soft', onClick: () => addWindow('22:00','23:30','before bed') }, '+ bed'),
      el('button', { class: 'btn btn--soft', onClick: () => addWindow('10:00','12:00','study block') }, '+ study'),
    ]),
  ]);
}

function addWindow(from, to, label) {
  update((d) => {
    d.doomscroll.noScrollWindows = d.doomscroll.noScrollWindows || [];
    d.doomscroll.noScrollWindows.push({ from, to, label });
  });
}

function insightsCard(s) {
  const urges = s.doomscroll.urges || [];
  if (urges.length < 5) {
    return el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-line-up' }), 'insights', el('small', null, `${urges.length}/14d`)]),
      el('p', { class: 'muted', style: { margin: 0 } }, 'patterns emerge after about two weeks of urges logged.'),
    ]);
  }

  // Group by trigger
  const byTrigger = {};
  for (const u of urges) byTrigger[u.triggerLabel || u.trigger] = (byTrigger[u.triggerLabel || u.trigger] || 0) + 1;
  const topTrig = Object.entries(byTrigger).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Group by hour
  const hourBuckets = Array(24).fill(0);
  for (const u of urges) hourBuckets[u.hour ?? 12] += 1;
  const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-line-up' }), 'insights', el('small', null, `${urges.length} urges`)]),
    el('div', { class: 'stack' }, [
      el('p', { style: { margin: 0 } }, [el('strong', null, 'most urges hit when: '), topTrig.map(([k, v]) => `${k} (${v})`).join(' · ')]),
      el('p', { style: { margin: 0 } }, [el('strong', null, 'peak hour: '), `${peakHour}:00 · gate gets firmer then`]),
      el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'pattern, not verdict. used to plan, not to punish.'),
    ]),
  ]);
}

function urgesLogCard(s) {
  const urges = (s.doomscroll.urges || []).slice(0, 20);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-bullets' }), 'recent urges', el('small', null, `${(s.doomscroll.urges || []).length} total`)]),
    urges.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'no urges logged yet.') :
      el('div', { class: 'stack' }, urges.map((u) => el('div', { class: 'row row--between' }, [
        el('div', null, [
          el('div', null, u.triggerLabel || u.trigger),
          el('div', { class: 'muted', style: { fontSize: '0.7rem' } }, `${relative(Date.parse(u.at))}${u.opened ? ` · scrolled ${fmtMinutes(u.mins)}` : ' · resisted ✿'}`),
        ]),
        el('span', { class: u.opened ? 'chip' : 'chip chip--primary' }, u.opened ? 'open' : 'parked'),
      ]))),
  ]);
}
