// Today dashboard · the screen Sriya sees on every open.
// Pulls live from every module. Each card deep-links into its source.

import { $, el, clear, bloomAt, haptic, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid, TODAY } from '../state.js';
import { fmtClock, fmtDate, timeOfDay, todayKey, fmtMinutes } from '../utils/format.js';
import { say } from '../mino/voice.js';
import { nextAction } from '../mino/mascot.js';
import { openCapture } from './capture.js';
import { getModuleGroups } from './shell.js';
import { currentUser } from '../auth.js';

export function renderToday(_params, host) {
  let unsub = null;
  function paint() {
    clear(host);
    host.appendChild(buildToday());
  }
  paint();
  unsub = subscribe(paint);
  // Tick the clock every minute.
  const interval = setInterval(() => {
    const c = host.querySelector('[data-clock]');
    if (c) c.textContent = fmtClock();
  }, 30 * 1000);
  // Cleanup when leaving this view.
  host.addEventListener('beforerouted', () => { unsub && unsub(); clearInterval(interval); }, { once: true });
}

function buildToday() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(greetingCard(s));
  wrap.appendChild(nonNegotiablesCard(s));
  wrap.appendChild(topTasksCard(s));
  wrap.appendChild(medsCard(s));
  wrap.appendChild(revisionsCard(s));
  wrap.appendChild(timerCard(s));
  wrap.appendChild(scheduleStripCard(s));
  wrap.appendChild(journalNudge(s));
  wrap.appendChild(doneJarPeek(s));
  wrap.appendChild(blockCard(s));
  wrap.appendChild(rewardsCard(s));
  wrap.appendChild(allModulesCard());

  return wrap;
}

// Bottom of Today: every module as a one-tap tile, grouped.
function allModulesCard() {
  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-grid-four' }),
      'all modules', el('small', null, 'one tap to anywhere')
    ]),
  ]);
  getModuleGroups().forEach((group) => {
    card.appendChild(el('div', { class: 'field__label', style: { marginTop: '10px' } }, group.label));
    card.appendChild(el('div', { class: 'modules-grid' },
      group.modules.map((m) => el('a', {
        class: 'modules-grid__tile', href: `#${m.path}`,
      }, [
        el('i', { class: `ph-duotone ${m.icon}`, 'aria-hidden': 'true' }),
        el('span', null, m.label),
      ]))
    ));
  });
  return card;
}

// 1. Greeting + Mino
function greetingCard(s) {
  const time = fmtClock();
  const tod = timeOfDay();
  const hello = say(`greet_${tod === 'afternoon' ? 'afternoon' : tod === 'morning' ? 'morning' : tod === 'evening' ? 'evening' : 'night'}`);
  return el('div', { class: 'card card--hero' }, [
    el('div', { class: 'greeting' }, [
      el('div', null, [
        el('h1', null, hello),
        el('p', { class: 'muted', style: { margin: '4px 0 0' } }, fmtDate()),
      ]),
      el('div', { class: 'clock' }, [el('span', { dataset: { clock: '' } }, time)]),
    ]),
    el('div', { class: 'row', style: { marginTop: '12px', gap: '8px' } }, [
      el('button', { class: 'btn', onClick: () => openCapture() }, [
        el('i', { class: 'ph-fill ph-plus-circle', 'aria-hidden': 'true', style: { marginRight: '6px' } }),
        'quick capture'
      ]),
      el('button', { class: 'btn btn--ghost', onClick: () => window.openMoreDrawer() }, [
        el('i', { class: 'ph ph-dots-three-circle', 'aria-hidden': 'true', style: { marginRight: '6px' } }),
        'more'
      ]),
    ])
  ]);
}

function ico(name, weight = 'duotone') {
  return el('i', { class: `ph-${weight} ${name}`, 'aria-hidden': 'true' });
}

// 3. Non-negotiables (grouped checklist) — with inline add UI
function nonNegotiablesCard(s) {
  const t = todayKey();
  const ticks = s.nonNegotiables.tickLog[t] || {};
  const total = s.nonNegotiables.categories.reduce((n, c) => n + c.tasks.length, 0);
  const done = Object.values(ticks).filter(Boolean).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const card = el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      ico('ph-flower'),
      'non-negotiables',
      el('small', null, `${done}/${total} • ${pct}%`),
    ]),
  ]);

  s.nonNegotiables.categories.forEach((cat) => {
    card.appendChild(el('div', { class: 'chip', style: { margin: '8px 0 4px' } }, `${cat.emoji} ${cat.label}`));
    cat.tasks.forEach((task) => {
      const isDone = !!ticks[task.id];
      const row = el('label', { class: 'check', dataset: { done: String(isDone) } }, [
        el('span', { class: 'check__box', 'aria-hidden': 'true' }),
        el('span', { class: 'check__label' }, `${task.emoji} ${task.label}`),
      ]);
      row.addEventListener('click', (e) => {
        e.preventDefault();
        const rect = row.querySelector('.check__box').getBoundingClientRect();
        const willBeDone = !ticks[task.id];
        update((d) => {
          const day = todayKey();
          d.nonNegotiables.tickLog[day] = d.nonNegotiables.tickLog[day] || {};
          d.nonNegotiables.tickLog[day][task.id] = willBeDone;
          d.doneJar.byDate[day] = d.doneJar.byDate[day] || [];
          if (willBeDone) {
            d.doneJar.byDate[day].push({ kind: 'nonneg', id: task.id, label: task.label, at: new Date().toISOString(), addedBy: currentUser() });
          } else {
            d.doneJar.byDate[day] = d.doneJar.byDate[day].filter((j) => !(j.kind === 'nonneg' && j.id === task.id));
          }
        });
        if (willBeDone) {
          bloomAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
          haptic(10);
        }
      });
      card.appendChild(row);
    });
  });

  // Inline add + edit buttons
  card.appendChild(el('div', { class: 'row', style: { gap: '6px', marginTop: '12px', flexWrap: 'wrap' } }, [
    el('button', { class: 'btn', onClick: () => openAddNonNeg() }, [
      el('i', { class: 'ph-fill ph-plus' }), ' add'
    ]),
    el('button', { class: 'btn btn--ghost', onClick: () => openManageNonNeg() }, [
      el('i', { class: 'ph ph-pencil-simple' }), ' edit / manage'
    ]),
  ]));

  return card;
}

// Quick add sheet · pick category (or new) · label + emoji
function openAddNonNeg() {
  const s = getState();
  const fLabel = el('input', { class: 'input', placeholder: 'e.g. drink water', autocapitalize: 'off' });
  const fEmoji = el('input', { class: 'input', placeholder: '✿', maxlength: 4, style: { width: '64px' } });

  const catSelect = el('select', { class: 'select' }, [
    ...s.nonNegotiables.categories.map((c) => el('option', { value: c.id }, `${c.emoji} ${c.label}`)),
    el('option', { value: '__new__' }, '+ new category…'),
  ]);
  const fNewCatLabel = el('input', { class: 'input', placeholder: 'category name', style: { display: 'none' } });
  const fNewCatEmoji = el('input', { class: 'input', placeholder: 'emoji', maxlength: 4, style: { width: '64px', display: 'none' } });
  catSelect.addEventListener('change', () => {
    const isNew = catSelect.value === '__new__';
    fNewCatLabel.style.display = isNew ? '' : 'none';
    fNewCatEmoji.style.display = isNew ? '' : 'none';
  });

  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted', style: { margin: 0 } }, 'add a non-negotiable for every day.'),
    el('div', { class: 'row', style: { gap: '6px' } }, [fEmoji, fLabel]),
    el('label', { class: 'field' }, [
      el('span', { class: 'field__label' }, 'category'),
      catSelect,
    ]),
    el('div', { class: 'row', style: { gap: '6px' } }, [fNewCatEmoji, fNewCatLabel]),
    el('button', { class: 'btn btn--block', onClick: () => {
      const label = fLabel.value.trim();
      if (!label) { toast('needs a label'); return; }
      const emoji = fEmoji.value.trim() || '✿';
      let catId = catSelect.value;
      update((d) => {
        if (catId === '__new__') {
          const newLabel = fNewCatLabel.value.trim() || 'new';
          const newEmoji = fNewCatEmoji.value.trim() || '✿';
          catId = uid('nc');
          d.nonNegotiables.categories.push({ id: catId, label: newLabel, emoji: newEmoji, tasks: [], addedBy: currentUser() });
        }
        const cat = d.nonNegotiables.categories.find((c) => c.id === catId);
        if (!cat) return;
        cat.tasks.push({ id: uid('nn'), label, emoji, addedBy: currentUser() });
      });
      closeSheet();
      toast('added ✿');
    } }, 'add'),
  ]), { title: 'new non-negotiable' });
}

// Full manage sheet · edit/delete/reorder categories and tasks
function openManageNonNeg() {
  const host = el('div', { class: 'stack' });
  function paintManager() {
    host.innerHTML = '';
    const state = getState();
    state.nonNegotiables.categories.forEach((cat, ci) => {
      const cCard = el('div', { class: 'card', style: { padding: '10px' } });
      const eEmoji = el('input', { class: 'input', value: cat.emoji, maxlength: 4, style: { width: '54px' } });
      const eLabel = el('input', { class: 'input', value: cat.label, style: { flex: '1' } });
      const eDel = el('button', { class: 'btn btn--soft', onClick: () => {
        if (!confirm(`delete the whole "${cat.label}" group?`)) return;
        update((d) => { d.nonNegotiables.categories.splice(ci, 1); });
        paintManager();
      } }, [el('i', { class: 'ph ph-trash' })]);
      eEmoji.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].emoji = eEmoji.value; }));
      eLabel.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].label = eLabel.value; }));
      cCard.appendChild(el('div', { class: 'row', style: { gap: '6px' } }, [eEmoji, eLabel, eDel]));

      cat.tasks.forEach((task, ti) => {
        const tEmoji = el('input', { class: 'input', value: task.emoji, maxlength: 4, style: { width: '54px' } });
        const tLabel = el('input', { class: 'input', value: task.label, style: { flex: '1' } });
        const tDel = el('button', { class: 'btn btn--soft', onClick: () => {
          update((d) => d.nonNegotiables.categories[ci].tasks.splice(ti, 1));
          paintManager();
        } }, [el('i', { class: 'ph ph-x' })]);
        tEmoji.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].tasks[ti].emoji = tEmoji.value; }));
        tLabel.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].tasks[ti].label = tLabel.value; }));
        cCard.appendChild(el('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, [tEmoji, tLabel, tDel]));
      });
      cCard.appendChild(el('button', { class: 'btn btn--ghost', style: { marginTop: '6px' }, onClick: () => {
        update((d) => d.nonNegotiables.categories[ci].tasks.push({ id: uid('nn'), label: 'new', emoji: '✿', addedBy: currentUser() }));
        paintManager();
      } }, '+ task'));
      host.appendChild(cCard);
    });
    host.appendChild(el('button', { class: 'btn btn--block', onClick: () => {
      update((d) => d.nonNegotiables.categories.push({ id: uid('nc'), label: 'new category', emoji: '✿', tasks: [], addedBy: currentUser() }));
      paintManager();
    } }, '+ category'));
  }
  paintManager();
  openSheet(host, { title: 'manage non-negotiables' });
}

// 4. Top 3 tasks (with "one main thing" flagged) · energy-aware order
function topTasksCard(s) {
  const today = todayKey();
  const main = s.tasks.mainThingByDate[today];
  const todayMood = (s.health.moodLog || []).find((l) => l.date === today)?.score; // 1..5
  // Fresh (4/5+) → heavy first. Low (1/2) → light first. Unknown → as-is.
  const open = s.tasks.negotiable.filter((t) => t.status !== 'done');
  let ordered = open;
  if (todayMood >= 4) ordered = open.slice().sort((a, b) => (b.energy === 'heavy') - (a.energy === 'heavy'));
  else if (todayMood <= 2) ordered = open.slice().sort((a, b) => (a.energy === 'heavy') - (b.energy === 'heavy'));
  // main thing always first
  if (main) ordered = [...ordered.filter((t) => t.id === main), ...ordered.filter((t) => t.id !== main)];
  const list = ordered.slice(0, 3);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-checks'), 'today', el('small', null, list.length ? 'top 3' : 'nothing planned')]),
    list.length ? el('div', { class: 'stack' }, list.map((t) =>
      el('label', { class: 'check' }, [
        el('span', { class: 'check__box', 'aria-hidden': 'true' }),
        el('span', { class: 'check__label' }, [
          t.id === main ? el('span', { class: 'chip chip--primary', style: { marginRight: '6px' } }, '★ main') : null,
          t.title || 'untitled'
        ]),
        el('span', { class: 'check__meta' }, t.estMins ? fmtMinutes(t.estMins) : ''),
      ])
    )) : el('div', { class: 'empty' }, [
      el('div', { class: 'empty__art' }, '✿'),
      el('p', null, 'no tasks yet · quick capture below'),
      el('button', { class: 'btn', onClick: () => openCapture() }, 'add one'),
    ])
  ]);
}

// 5. Meds due today
function medsCard(s) {
  const day = todayKey();
  const taken = new Set(s.health.medLog.filter((l) => l.date === day && l.taken).map((l) => l.medId));
  const due = s.health.meds.filter((m) => m.schedule && m.schedule !== 'asneeded');
  if (due.length === 0) {
    return el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [ico('ph-pill'), 'meds', el('small', null, 'set up in Health')]),
      el('p', { class: 'muted' }, 'add medicines in Health → meds.'),
    ]);
  }
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-pill'), 'meds', el('small', null, `${taken.size}/${due.length}`)]),
    el('div', { class: 'stack' }, due.map((m) => {
      const isDone = taken.has(m.id);
      const row = el('label', { class: 'check', dataset: { done: String(isDone) } }, [
        el('span', { class: 'check__box', 'aria-hidden': 'true' }),
        el('span', { class: 'check__label' }, `💊 ${m.name}${m.dose ? ` · ${m.dose}` : ''}`),
        el('span', { class: 'check__meta' }, m.schedule || ''),
      ]);
      row.addEventListener('click', (e) => {
        e.preventDefault();
        update((d) => {
          // Clean any prior entries today for this med, then add a single
          // fresh entry so toggling on/off is always consistent.
          d.health.medLog = d.health.medLog.filter((l) => !(l.date === day && l.medId === m.id));
          if (!isDone) {
            d.health.medLog.push({
              id: `ml-${Date.now()}`, medId: m.id, date: day,
              time: new Date().toISOString(), taken: true,
            });
            // also drop in done jar
            d.doneJar.byDate[day] = d.doneJar.byDate[day] || [];
            d.doneJar.byDate[day].push({ kind: 'med', id: m.id, label: m.name, at: new Date().toISOString() });
          } else {
            // remove med entry from done jar too
            d.doneJar.byDate[day] = (d.doneJar.byDate[day] || []).filter((j) => !(j.kind === 'med' && j.id === m.id));
          }
        });
      });
      return row;
    }))
  ]);
}

// 6. Revisions due (UPSC) · Wave 4 fleshes this out
function revisionsCard(s) {
  const due = (s.upsc.revisions || []).filter((r) => r.dueDate === todayKey() && !r.done);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-book-open'), 'revisions', el('small', null, due.length ? `${due.length} due` : 'all clear')]),
    due.length
      ? el('div', { class: 'stack' }, due.slice(0, 3).map((r) => el('div', { class: 'card__row' }, [
          el('span', null, r.topic || r.label),
          el('span', { class: 'chip', style: { marginLeft: 'auto' } }, r.stage || 'R1'),
        ])))
      : el('p', { class: 'muted', style: { margin: 0 } }, 'no UPSC revisions today · set up the syllabus tree in Wave 4.')
  ]);
}

// 7. Running timer
function timerCard(s) {
  const t = s.timer.active;
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-timer'), 'timer', el('small', null, t ? 'live' : 'idle')]),
    t
      ? el('p', { style: { margin: 0 } }, [el('strong', null, t.label || t.categoryLabel || 'tracking'), ' · see bar above'])
      : el('div', null, [
          el('p', { class: 'muted', style: { margin: '0 0 8px' } }, 'no activity tracked right now.'),
          el('a', { class: 'btn btn--ghost', href: '#/timer' }, 'open Timer'),
        ])
  ]);
}

// 8. Schedule strip · Wave 2 fleshes the calendar
function scheduleStripCard(s) {
  const today = todayKey();
  const evts = (s.calendar.events || []).filter((e) => e.date === today).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-calendar-heart'), 'schedule', el('small', null, evts.length ? `${evts.length} blocks` : 'open')]),
    evts.length
      ? el('div', { class: 'stack' }, evts.slice(0, 4).map((e) => el('div', { class: 'card__row' }, [
          el('span', { class: 'chip' }, e.start || '·'),
          el('span', null, e.title),
        ])))
      : el('p', { class: 'muted', style: { margin: 0 } }, 'nothing scheduled today · calendar opens in Wave 2.')
  ]);
}

// 9. Journal nudge
function journalNudge(s) {
  const day = todayKey();
  const wrote = (s.journal.entries || []).some((j) => j.date === day);
  return el('a', { class: 'card', href: '#/journal', style: { display: 'block' } }, [
    el('div', { class: 'card__title' }, [ico('ph-notebook'), 'journal', el('small', null, wrote ? 'wrote today ✓' : 'gentle nudge')]),
    el('p', { class: 'muted', style: { margin: 0 } }, wrote ? say('praise_specific', { fact: 'journaled' }) : 'one or two lines · even bad day mein bhi ♡'),
  ]);
}

// 10. Done jar peek
function doneJarPeek(s) {
  const day = todayKey();
  const items = s.doneJar.byDate[day] || [];
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-confetti'), 'done jar', el('small', null, `${items.length} so far`)]),
    items.length
      ? el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
          items.slice(-8).map((i) => el('span', { class: 'chip chip--primary' }, i.label || 'done')))
      : el('p', { class: 'muted', style: { margin: 0 } }, 'every tick lands here · no output = no rest is a lie.'),
  ]);
}

// 11. 15-day block / focus
function blockCard(s) {
  const b = s.block || {};
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-target'), 'this block', el('small', null, b.endsOn || '·')]),
    el('p', { style: { margin: '0 0 6px' } }, b.label || 'no current block set'),
    b.focus ? el('p', { class: 'muted', style: { margin: 0 } }, `focus: ${b.focus}`) : null,
    el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => editBlock() }, b.label ? 'edit' : 'set block'),
  ]);
}

function editBlock() {
  import('../utils/dom.js').then(({ openSheet, closeSheet }) => {
    const s = getState();
    const b = s.block || {};
    const fLabel = el('input', { class: 'input', value: b.label || '', placeholder: 'e.g. "ground UPSC base"' });
    const fEnds  = el('input', { class: 'input', type: 'date', value: b.endsOn || '' });
    const fFocus = el('input', { class: 'input', value: b.focus || '', placeholder: 'one-line focus' });
    openSheet(el('div', { class: 'stack' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'label'), fLabel]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'ends on'), fEnds]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'focus'), fFocus]),
      el('button', { class: 'btn btn--block', onClick: () => {
        update((d) => { d.block = { label: fLabel.value, endsOn: fEnds.value, focus: fFocus.value }; });
        closeSheet();
      }}, 'save')
    ]), { title: '15-day block' });
  });
}

// 12. Rewards
function rewardsCard(s) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [ico('ph-gift'), 'rewards', el('small', null, 'pick when earned')]),
    el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
      s.rewards.map((r) => el('span', { class: 'chip' }, `${r.emoji} ${r.label}`))),
    el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => editRewards() }, 'edit')
  ]);
}

function editRewards() {
  import('../utils/dom.js').then(({ openSheet, closeSheet }) => {
    const s = getState();
    const list = el('div', { class: 'stack' });
    const draw = () => {
      list.innerHTML = '';
      getState().rewards.forEach((r, i) => {
        const e = el('input', { class: 'input', value: r.emoji, style: { width: '56px' }, maxlength: 2 });
        const lbl = el('input', { class: 'input', value: r.label, style: { flex: '1' } });
        const rm  = el('button', { class: 'btn btn--soft', onClick: () => { update((d) => d.rewards.splice(i, 1)); draw(); }}, '×');
        e.addEventListener('change',   () => update((d) => { d.rewards[i].emoji = e.value; }));
        lbl.addEventListener('change', () => update((d) => { d.rewards[i].label = lbl.value; }));
        list.appendChild(el('div', { class: 'row', style: { gap: '6px' } }, [e, lbl, rm]));
      });
    };
    draw();
    openSheet(el('div', { class: 'stack' }, [
      list,
      el('button', { class: 'btn btn--block', onClick: () => {
        update((d) => d.rewards.push({ id: `r-${Date.now()}`, label: 'new reward', emoji: '✿' })); draw();
      }}, '+ add'),
      el('button', { class: 'btn btn--ghost btn--block', onClick: () => closeSheet() }, 'done'),
    ]), { title: 'rewards' });
  });
}

