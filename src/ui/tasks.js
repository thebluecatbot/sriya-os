// Tasks tab · negotiable + non-negotiable in one place.
// Pipeline buckets (Today / Soon / Someday / Done), quick add, brain dump,
// full edit sheet, recurring tasks editor, non-negotiables editor,
// night-plan ritual.

import { el, clear, openSheet, closeSheet, toast, bloomAt, haptic } from '../utils/dom.js';
import { getState, update, subscribe, uid, TODAY } from '../state.js';
import { fmtMinutes, todayKey } from '../utils/format.js';
import { parseTask, parseBrainDump } from '../utils/parse-task.js';
import { pendingDays } from '../utils/recurrence.js';
import { currentUser } from '../auth.js';

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const BUCKETS = ['Today', 'Soon', 'Someday', 'Done'];

let activeBucket = 'Today';

export function renderTasks(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(buildTasks()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function buildTasks() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  // Header + actions
  wrap.appendChild(el('div', { class: 'row row--between', style: { alignItems: 'baseline' } }, [
    el('h1', null, ['tasks ', el('i', { class: 'ph-duotone ph-checks', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]),
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => openNightPlan() }, [
        el('i', { class: 'ph-fill ph-moon-stars' }), ' plan tmrw'
      ]),
      el('button', { class: 'btn btn--soft', onClick: () => openBrainDump() }, [
        el('i', { class: 'ph-fill ph-lightning' }), ' dump'
      ]),
      el('button', { class: 'btn', onClick: () => openFullAdd() }, [
        el('i', { class: 'ph-fill ph-plus' }), ' new'
      ]),
    ])
  ]));

  // Bucket tabs
  const tabRow = el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    BUCKETS.map((b) => {
      const count = countBucket(s, b);
      return el('button', {
        class: activeBucket === b ? 'chip chip--primary' : 'chip',
        type: 'button',
        style: { cursor: 'pointer' },
        onClick: () => { activeBucket = b; paintNow(); }
      }, `${b} · ${count}`);
    })
  );
  wrap.appendChild(tabRow);

  // The one main thing for today
  if (activeBucket === 'Today') wrap.appendChild(mainThingCard(s));

  // Quick add row (single line)
  wrap.appendChild(quickAddRow());

  // The list
  const list = tasksInBucket(s, activeBucket);
  if (list.length === 0) {
    wrap.appendChild(emptyStateCard(activeBucket));
  } else {
    wrap.appendChild(el('div', { class: 'stack' }, list.map((t) => taskCard(t, s))));
  }

  // Recurring tasks editor
  if (activeBucket === 'Today') wrap.appendChild(recurringCard(s));

  // Non-negotiables checklist + editor
  wrap.appendChild(nonNegotiablesCard(s));

  // End-of-day review chip
  if (activeBucket === 'Today') wrap.appendChild(endOfDayCard(s));

  return wrap;
}

function paintNow() {
  // Triggers paint via state notify without changing data (use silent update? simpler: just resubscribe re-run).
  update((d) => { d.tasks._uiTick = (d.tasks._uiTick || 0) + 1; }, { silent: false });
}

// ──────────────────────────────────────────────────────────────
// Cards
// ──────────────────────────────────────────────────────────────

function mainThingCard(s) {
  const main = s.tasks.negotiable.find((t) => t.id === s.tasks.mainThingByDate[todayKey()] && t.status !== 'done');
  if (!main) {
    return el('div', { class: 'card', style: { background: 'var(--surface-2)' } }, [
      el('div', { class: 'card__title' }, [
        el('i', { class: 'ph-fill ph-star', style: { color: 'var(--primary)' } }),
        'the one main thing', el('small', null, 'choose just one')
      ]),
      el('p', { class: 'muted', style: { margin: '0 0 6px' } }, 'if only one task ships today, which one?'),
      el('button', { class: 'btn btn--ghost', onClick: () => pickMainThing() }, 'pick one'),
    ]);
  }
  return el('div', { class: 'card card--hero', style: { background: 'var(--gradient-hero)' } }, [
    el('div', { class: 'row row--between' }, [
      el('div', null, [
        el('div', { class: 'chip chip--primary', style: { marginBottom: '6px' } }, '★ main thing'),
        el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem' } }, main.title),
      ]),
      el('button', { class: 'btn btn--soft', onClick: () => pickMainThing() }, 'change')
    ])
  ]);
}

function pickMainThing() {
  const s = getState();
  const candidates = s.tasks.negotiable.filter((t) => t.status !== 'done' && (t.category === 'Today' || t.category === 'Soon'));
  if (candidates.length === 0) { toast('add a task first'); return; }
  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted' }, 'just one · the rest is bonus.'),
    ...candidates.map((t) => el('button', {
      class: 'card', style: { textAlign: 'left', width: '100%', cursor: 'pointer' },
      onClick: () => {
        update((d) => { d.tasks.mainThingByDate[todayKey()] = t.id; });
        closeSheet();
        toast(`★ ${t.title}`);
      }
    }, [
      el('div', { style: { fontWeight: 600 } }, t.title),
      el('div', { class: 'muted', style: { fontSize: '0.75rem' } },
        [t.due, t.estMins ? fmtMinutes(t.estMins) : null, t.energy].filter(Boolean).join(' · ')),
    ])),
    el('button', { class: 'btn btn--ghost btn--block', onClick: () => {
      update((d) => { delete d.tasks.mainThingByDate[todayKey()]; });
      closeSheet();
    } }, 'clear'),
  ]), { title: 'the one main thing' });
}

function quickAddRow() {
  const input = el('input', {
    class: 'input', type: 'text',
    placeholder: 'add a task · "kal call amma 20min #social"',
    'aria-label': 'Quick add task',
  });
  function doAdd() {
    const v = input.value.trim();
    if (!v) return;
    const p = parseTask(v);
    update((d) => {
      d.tasks.negotiable.unshift({
        id: uid('t'), type: 'negotiable',
        title: p.title, emoji: p.emoji || '', category: p.category, due: p.due,
        estMins: p.estMins, priority: p.priority, energy: p.energy || 'light',
        person: 'sriya', subtasks: [], status: 'open',
        linkedModule: p.linkedModule || null,
        createdAt: new Date().toISOString(),
        addedBy: currentUser(),
      });
    });
    input.value = '';
    toast('added ✓');
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
  return el('div', { class: 'row', style: { gap: '8px' } }, [
    input,
    el('button', { class: 'btn', onClick: doAdd, 'aria-label': 'Add' }, [el('i', { class: 'ph-fill ph-plus' })]),
  ]);
}

function emptyStateCard(bucket) {
  const blurb = {
    Today:   'nothing for today · quick add above ✿',
    Soon:    'no upcoming tasks. add some, slowly.',
    Someday: 'someday-list is empty · that\'s fine, too.',
    Done:    'no completed tasks yet. one tick is enough.',
  }[bucket];
  return el('div', { class: 'card empty' }, [
    el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-flower' })]),
    el('p', null, blurb),
  ]);
}

function taskCard(t, s) {
  const isDone = t.status === 'done';
  const isMain = s.tasks.mainThingByDate[todayKey()] === t.id;
  const pd = pendingDays(t);
  const overdue = !isDone && t.due && t.due < todayKey();

  const card = el('div', {
    class: 'card',
    dataset: t.addedBy === 'prakhar' ? { taskId: t.id, addedBy: 'prakhar' } : { taskId: t.id },
    style: { padding: '12px 14px' }
  });

  // Row: checkbox + title + meta
  const head = el('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-start' } });

  const box = el('label', { class: 'check', dataset: { done: String(isDone) },
    style: { padding: 0, marginTop: '2px' } }, [
    el('span', { class: 'check__box', 'aria-hidden': 'true' }),
  ]);
  box.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const rect = box.querySelector('.check__box').getBoundingClientRect();
    const willBeDone = !isDone;
    update((d) => {
      const x = d.tasks.negotiable.find((x) => x.id === t.id);
      if (!x) return;
      x.status = willBeDone ? 'done' : 'open';
      x.completedAt = willBeDone ? new Date().toISOString() : null;
      if (willBeDone) {
        d.doneJar.byDate[todayKey()] = d.doneJar.byDate[todayKey()] || [];
        d.doneJar.byDate[todayKey()].push({ kind: 'task', id: t.id, label: t.title, at: x.completedAt });
      } else {
        // remove from done jar
        const day = todayKey();
        (d.doneJar.byDate[day] || []).splice(
          (d.doneJar.byDate[day] || []).findIndex((j) => j.kind === 'task' && j.id === t.id), 1
        );
      }
    });
    if (willBeDone) { bloomAt(rect.left + rect.width / 2, rect.top + rect.height / 2); haptic(8); }
  });
  head.appendChild(box);

  const body = el('div', { style: { flex: '1', minWidth: 0, cursor: 'pointer' },
    onClick: () => openEditSheet(t) });

  const title = el('div', null, [
    isMain ? el('span', { class: 'chip chip--primary', style: { marginRight: '6px' } }, '★') : null,
    t.emoji ? el('span', { style: { marginRight: '4px' } }, t.emoji) : null,
    el('span', { style: { fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--ink-mute)' : 'var(--ink)' } }, t.title),
  ]);
  body.appendChild(title);

  // Meta row
  const meta = el('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', marginTop: '4px', fontSize: '0.75rem' } });
  if (t.due) meta.appendChild(el('span', { class: overdue ? 'chip' : 'chip',
    style: overdue ? { color: 'var(--primary-deep)', borderColor: 'var(--primary-soft)' } : {} },
    [overdue ? el('i', { class: 'ph ph-clock-countdown' }) : el('i', { class: 'ph ph-calendar' }), ' ', fmtDue(t.due)]));
  if (t.estMins) meta.appendChild(el('span', { class: 'chip' }, [el('i', { class: 'ph ph-timer' }), ' ', fmtMinutes(t.estMins)]));
  if (t.energy === 'heavy') meta.appendChild(el('span', { class: 'chip' }, [el('i', { class: 'ph-fill ph-lightning' }), ' heavy']));
  if (t.energy === 'light') meta.appendChild(el('span', { class: 'chip' }, [el('i', { class: 'ph ph-feather' }), ' light']));
  if (t.linkedModule?.kind) meta.appendChild(el('span', { class: 'chip' }, `#${t.linkedModule.kind}`));
  if (t.recurringFrom) meta.appendChild(el('span', { class: 'chip' }, [el('i', { class: 'ph ph-arrows-clockwise' }), ' recurring']));
  if (!isDone && pd >= 2 && !t.recurringFrom) meta.appendChild(el('span', { class: 'chip',
    style: { color: 'var(--ink-soft)' } }, `pending ${pd}d`));
  if (t.person && t.person !== 'sriya') {
    const p = s.people.find((x) => x.id === t.person);
    if (p) meta.appendChild(el('span', { class: 'chip',
      style: { background: 'transparent', borderColor: p.color, color: p.color } }, `${p.emoji} ${p.name}`));
  }
  if (meta.children.length) body.appendChild(meta);

  // Subtasks (collapsed)
  if (t.subtasks?.length) {
    const done = t.subtasks.filter((st) => st.done).length;
    body.appendChild(el('div', { class: 'muted', style: { marginTop: '4px', fontSize: '0.75rem' } },
      `${done}/${t.subtasks.length} subtasks`));
  }

  head.appendChild(body);

  // Star "main thing" toggle
  const starBtn = el('button', {
    class: 'btn btn--soft', style: { padding: '6px 10px', flexShrink: 0 },
    'aria-label': isMain ? 'unset main thing' : 'set as main thing',
    onClick: (e) => {
      e.stopPropagation();
      update((d) => {
        const day = todayKey();
        if (d.tasks.mainThingByDate[day] === t.id) delete d.tasks.mainThingByDate[day];
        else d.tasks.mainThingByDate[day] = t.id;
      });
    }
  }, [el('i', { class: isMain ? 'ph-fill ph-star' : 'ph ph-star', style: { color: isMain ? 'var(--primary)' : 'var(--ink-mute)' } })]);
  head.appendChild(starBtn);

  card.appendChild(head);
  return card;
}

function fmtDue(d) {
  if (!d) return '';
  const today = todayKey();
  if (d === today) return 'today';
  const t = new Date(d); const now = new Date(today);
  const diff = Math.round((t - now) / 86_400_000);
  if (diff === 1)  return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0 && diff < 7)  return `+${diff}d`;
  if (diff < 0)             return `${diff}d`;
  return d.slice(5);
}

// ──────────────────────────────────────────────────────────────
// Full add / edit sheet
// ──────────────────────────────────────────────────────────────

export function openFullAdd() {
  openEditSheet(null);
}

// ──────────────────────────────────────────────────────────────
// Night-plan ritual · "plan tomorrow"
// ──────────────────────────────────────────────────────────────
export function openNightPlan() {
  const today = todayKey();
  const tmrw = tomorrowKey();

  const carryList = el('div', { class: 'stack' });
  const tmrwList = el('div', { class: 'stack' });
  const addInput = el('input', { class: 'input', placeholder: 'add one · "yoga 20min", "iron stock check"', 'aria-label': 'Add tomorrow task' });

  function paint() {
    const s = getState();
    carryList.innerHTML = '';
    tmrwList.innerHTML = '';

    // Carryover = today's open tasks that aren't already moved
    const carryover = s.tasks.negotiable.filter((t) =>
      t.status !== 'done' && (t.category === 'Today' || t.due === today) && t.due !== tmrw
    );
    if (carryover.length === 0) carryList.appendChild(el('p', { class: 'muted', style: { margin: 0 } }, 'nothing leftover from today ✿'));
    else carryover.forEach((t) => carryList.appendChild(carryRow(t, () => moveToTomorrow(t), paint, false)));

    // Tomorrow = tasks with due=tomorrow
    const tmrwTasks = s.tasks.negotiable.filter((t) => t.status !== 'done' && t.due === tmrw);
    if (tmrwTasks.length === 0) tmrwList.appendChild(el('p', { class: 'muted', style: { margin: 0 } }, 'nothing planned yet · add 3 things, no more.'));
    else tmrwTasks.forEach((t) => tmrwList.appendChild(carryRow(t, () => unmoveFromTomorrow(t), paint, true)));
  }

  function moveToTomorrow(t) {
    update((d) => {
      const x = d.tasks.negotiable.find((y) => y.id === t.id);
      if (!x) return;
      x.due = tmrw;
      x.category = 'Today'; // 'Today' bucket reused for tomorrow's main work; renderer compares dates
    });
  }
  function unmoveFromTomorrow(t) {
    update((d) => {
      const x = d.tasks.negotiable.find((y) => y.id === t.id);
      if (!x) return;
      x.due = '';
      x.category = 'Soon';
    });
  }
  function doAdd() {
    const v = addInput.value.trim();
    if (!v) return;
    const p = parseTask(v);
    update((d) => {
      d.tasks.negotiable.unshift({
        id: uid('t'), type: 'negotiable',
        title: p.title, emoji: p.emoji || '', category: 'Today', due: tmrw,
        estMins: p.estMins, priority: p.priority, energy: p.energy || 'light',
        person: 'sriya', subtasks: [], status: 'open',
        linkedModule: p.linkedModule || null,
        createdAt: new Date().toISOString(),
        addedBy: currentUser(),
      });
    });
    addInput.value = '';
    paint();
  }
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

  paint();

  openSheet(el('div', { class: 'stack' }, [
    el('div', { class: 'card', style: { background: 'var(--gradient-hero)' } }, [
      el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem' } }, 'plan tomorrow ✿'),
      el('p', { class: 'muted', style: { margin: '4px 0 0' } }, 'tomorrow-you will thank tonight-you. just 3.'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [
        el('i', { class: 'ph-duotone ph-arrow-arc-right' }),
        'carry from today', el('small', null, 'no shame')
      ]),
      carryList,
      el('button', { class: 'btn btn--soft btn--block', onClick: () => {
        const s = getState();
        s.tasks.negotiable
          .filter((t) => t.status !== 'done' && (t.category === 'Today' || t.due === today) && t.due !== tmrw)
          .forEach((t) => moveToTomorrow(t));
        paint();
      } }, 'carry everything →'),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [
        el('i', { class: 'ph-duotone ph-list-checks' }),
        'tomorrow', el('small', null, 'just 3 ideal')
      ]),
      tmrwList,
      el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
        addInput,
        el('button', { class: 'btn', onClick: doAdd }, [el('i', { class: 'ph-fill ph-plus' })]),
      ]),
    ]),

    el('button', { class: 'btn btn--block', onClick: () => { closeSheet(); toast('locked in ✿ sleep well, kanna'); } }, [
      el('i', { class: 'ph-fill ph-moon' }), ' lock in & soja'
    ]),
  ]), { title: 'plan tomorrow' });
}

function carryRow(t, onAction, repaint, isInTomorrow) {
  return el('div', { class: 'row row--between', style: { padding: '4px 0' } }, [
    el('div', { style: { flex: 1, minWidth: 0 } }, [
      el('div', { style: { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [
        t.emoji ? `${t.emoji} ` : '', t.title
      ]),
      el('div', { class: 'muted', style: { fontSize: '0.7rem' } },
        [t.estMins ? fmtMinutes(t.estMins) : null, t.energy].filter(Boolean).join(' · ')),
    ]),
    el('button', {
      class: isInTomorrow ? 'btn btn--ghost' : 'btn btn--soft',
      style: { padding: '4px 10px' },
      onClick: () => { onAction(); repaint(); }
    }, isInTomorrow ? [el('i', { class: 'ph ph-x' })] : '→ tmrw'),
  ]);
}

export function openEditSheet(existing) {
  const s = getState();
  const t = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid('t'), type: 'negotiable',
    title: '', emoji: '', category: 'Today', due: '',
    estMins: null, priority: 'soon', energy: 'light',
    person: 'sriya', subtasks: [], status: 'open',
    linkedModule: null, createdAt: new Date().toISOString(),
    addedBy: currentUser(),
  };
  const fTitle = el('input', { class: 'input', value: t.title, placeholder: 'what is it?', 'aria-label': 'Title' });
  const fEmoji = el('input', { class: 'input', value: t.emoji || '', maxlength: 2, style: { width: '64px' }, placeholder: '✿' });
  const fDue   = el('input', { class: 'input', type: 'date', value: t.due || '' });
  const fEst   = el('input', { class: 'input', type: 'number', min: 0, step: 5, value: t.estMins || '', placeholder: 'minutes' });
  const fBucket = el('select', { class: 'select' }, BUCKETS.filter((b) => b !== 'Done').map((b) =>
    el('option', { value: b, selected: t.category === b }, b)));
  const fPriority = el('select', { class: 'select' }, [['today','today'], ['soon','soon'], ['someday','someday']].map(([v, l]) =>
    el('option', { value: v, selected: t.priority === v }, l)));
  const fEnergy = el('select', { class: 'select' }, [['light','light'], ['heavy','heavy']].map(([v, l]) =>
    el('option', { value: v, selected: t.energy === v }, l)));
  const fPerson = el('select', { class: 'select' }, s.people.map((p) =>
    el('option', { value: p.id, selected: t.person === p.id }, `${p.emoji} ${p.name}`)));
  const fCompletion = el('input', { class: 'input', type: 'number', min: 5, step: 5, value: t.completionTimerMins || '', placeholder: 'finish-by (min)' });
  const fScheduled = el('input', { class: 'input', type: 'datetime-local', value: t.scheduledAt ? t.scheduledAt.slice(0, 16) : '' });

  // Subtasks editor
  const subWrap = el('div', { class: 'stack' });
  function paintSubs() {
    subWrap.innerHTML = '';
    t.subtasks.forEach((st, i) => {
      const cb = el('label', { class: 'check', dataset: { done: String(!!st.done) }, style: { padding: 0 } }, [
        el('span', { class: 'check__box', 'aria-hidden': 'true' }),
      ]);
      const ti = el('input', { class: 'input', value: st.title, style: { flex: '1' } });
      const rm = el('button', { class: 'btn btn--soft', 'aria-label': 'Remove', onClick: () => { t.subtasks.splice(i, 1); paintSubs(); } }, [el('i', { class: 'ph ph-x' })]);
      cb.addEventListener('click', (e) => { e.preventDefault(); st.done = !st.done; cb.dataset.done = String(st.done); });
      ti.addEventListener('input', () => { st.title = ti.value; });
      subWrap.appendChild(el('div', { class: 'row', style: { gap: '6px' } }, [cb, ti, rm]));
    });
  }
  paintSubs();

  const sheet = openSheet(el('div', { class: 'stack' }, [
    el('div', { class: 'row', style: { gap: '6px' } }, [fEmoji, fTitle]),

    el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
      labeled('bucket', fBucket),
      labeled('priority', fPriority),
    ]),
    el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
      labeled('due', fDue),
      labeled('est (min)', fEst),
    ]),
    el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
      labeled('energy', fEnergy),
      labeled('with', fPerson),
    ]),
    el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
      labeled('schedule (date+time)', fScheduled),
      labeled('finish-by timer (min)', fCompletion),
    ]),

    // "start now" · only for existing tasks; sets timerStartedAt and auto-starts activity timer
    existing ? el('button', {
      class: 'btn btn--soft btn--block',
      onClick: async () => {
        const completionMins = parseInt(fCompletion.value, 10) || t.estMins || 30;
        update((d) => {
          const x = d.tasks.negotiable.find((y) => y.id === t.id);
          if (!x) return;
          x.timerStartedAt = new Date().toISOString();
          x.completionTimerMins = completionMins;
        });
        // Also kick off an activity timer using the task's title + linked category
        const tm = await import('./timer.js');
        const catId = t.linkedModule?.kind || 'other';
        tm.startTimer({ label: t.title, categoryId: catId, person: t.person, note: '' });
        closeSheet();
        toast(`tracking · ${completionMins}m countdown ✿`);
      }
    }, [el('i', { class: 'ph-fill ph-play' }), ' start now (+ track time)']) : null,

    el('div', { class: 'field__label' }, 'subtasks'),
    subWrap,
    el('button', { class: 'btn btn--soft', onClick: () => { t.subtasks.push({ id: uid('st'), title: '', done: false }); paintSubs(); } }, '+ subtask'),

    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn--block', onClick: () => {
        t.title = fTitle.value.trim();
        t.emoji = fEmoji.value;
        t.category = fBucket.value;
        t.priority = fPriority.value;
        t.due = fDue.value;
        t.energy = fEnergy.value;
        t.person = fPerson.value;
        const est = parseInt(fEst.value, 10);
        t.estMins = Number.isFinite(est) && est > 0 ? est : null;
        const ct = parseInt(fCompletion.value, 10);
        t.completionTimerMins = Number.isFinite(ct) && ct > 0 ? ct : null;
        t.scheduledAt = fScheduled.value ? new Date(fScheduled.value).toISOString() : '';
        if (!t.title) { toast('needs a title'); return; }
        update((d) => {
          const i = d.tasks.negotiable.findIndex((x) => x.id === t.id);
          if (i === -1) d.tasks.negotiable.unshift(t);
          else d.tasks.negotiable[i] = t;
        });
        closeSheet();
        toast(existing ? 'saved ✓' : 'added ✓');
      } }, existing ? 'save' : 'add'),
      existing ? el('button', { class: 'btn btn--ghost', onClick: () => {
        if (!confirm('delete this task?')) return;
        update((d) => { d.tasks.negotiable = d.tasks.negotiable.filter((x) => x.id !== t.id); });
        closeSheet();
      } }, [el('i', { class: 'ph ph-trash' })]) : null,
    ]),
  ]), { title: existing ? 'edit task' : 'new task' });
}

function labeled(label, control) {
  return el('label', { class: 'field', style: { flex: '1 1 140px', margin: 0 } }, [
    el('span', { class: 'field__label' }, label),
    control,
  ]);
}

// ──────────────────────────────────────────────────────────────
// Brain dump
// ──────────────────────────────────────────────────────────────

function openBrainDump() {
  const ta = el('textarea', {
    class: 'input', rows: 8,
    placeholder: 'one task per line · paste a list, ramble, voice-to-text… we split it.',
  });
  const preview = el('div', { class: 'stack' });
  let parsed = [];

  ta.addEventListener('input', () => {
    parsed = parseBrainDump(ta.value);
    preview.innerHTML = '';
    if (parsed.length === 0) {
      preview.appendChild(el('p', { class: 'muted' }, 'preview will appear here…'));
      return;
    }
    parsed.forEach((p) => preview.appendChild(el('div', { class: 'card', style: { padding: '8px 12px' } }, [
      el('div', { style: { fontWeight: 500 } }, p.title),
      el('div', { class: 'muted', style: { fontSize: '0.75rem' } },
        [p.category, p.due, p.estMins ? fmtMinutes(p.estMins) : null, p.energy].filter(Boolean).join(' · ')),
    ])));
  });

  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted', style: { margin: 0 } }, 'one line per task. dates: today / kal / repu / parson. estimates: 20min / 1h. tags: #upsc / #social.'),
    ta,
    el('div', { class: 'field__label' }, 'preview'),
    preview,
    el('button', { class: 'btn btn--block', onClick: () => {
      if (parsed.length === 0) { toast('nothing to add'); return; }
      update((d) => {
        for (const p of parsed) {
          d.tasks.negotiable.unshift({
            id: uid('t'), type: 'negotiable',
            title: p.title, emoji: p.emoji || '',
            category: p.category, due: p.due,
            estMins: p.estMins, priority: p.priority,
            energy: p.energy || 'light',
            person: 'sriya', subtasks: [], status: 'open',
            linkedModule: p.linkedModule || null,
            createdAt: new Date().toISOString(),
          });
        }
      });
      closeSheet();
      toast(`${parsed.length} task${parsed.length === 1 ? '' : 's'} added ✓`);
    } }, 'add all'),
  ]), { title: 'brain dump' });

  setTimeout(() => ta.focus(), 320);
}

// ──────────────────────────────────────────────────────────────
// Recurring tasks
// ──────────────────────────────────────────────────────────────

function recurringCard(s) {
  const recurs = s.tasks.recurring || [];
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-arrows-clockwise' }),
      'recurring', el('small', null, `${recurs.length} active`)
    ]),
    recurs.length ? el('div', { class: 'stack' }, recurs.map((r) =>
      el('div', { class: 'row row--between' }, [
        el('div', null, [
          el('div', null, [r.emoji ? `${r.emoji} ` : '', r.title]),
          el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, scheduleLabel(r.schedule)),
        ]),
        el('button', { class: 'btn btn--soft', onClick: () => openRecurringEdit(r) }, 'edit')
      ])
    )) : el('p', { class: 'muted', style: { margin: 0 } }, 'no recurring tasks yet · set up daily/weekly habits below.'),
    el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: () => openRecurringEdit(null) }, '+ add recurring'),
  ]);
}

function scheduleLabel(sch = { kind: 'daily' }) {
  if (sch.kind === 'daily')    return 'every day';
  if (sch.kind === 'weekdays') return 'mon–fri';
  if (sch.kind === 'weekends') return 'sat–sun';
  if (sch.kind === 'weekly') {
    const names = ['sun','mon','tue','wed','thu','fri','sat'];
    return (sch.days || []).map((d) => names[d]).join('/');
  }
  if (sch.kind === 'monthly')  return `day ${sch.day} of month`;
  return '';
}

function openRecurringEdit(existing) {
  const r = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: uid('r'), title: '', emoji: '', schedule: { kind: 'daily' },
    estMins: null, priority: 'today', energy: 'light', person: 'sriya', lastSpawnedDate: null,
  };
  const fTitle = el('input', { class: 'input', value: r.title, placeholder: 'e.g. drink water 8x' });
  const fEmoji = el('input', { class: 'input', value: r.emoji, maxlength: 2, style: { width: '64px' }, placeholder: '✿' });
  const fKind  = el('select', { class: 'select' }, ['daily','weekdays','weekends','weekly','monthly'].map((k) =>
    el('option', { value: k, selected: r.schedule.kind === k }, k)));
  const dayRow = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px' } });
  function paintDays() {
    dayRow.innerHTML = '';
    if (r.schedule.kind !== 'weekly') return;
    ['sun','mon','tue','wed','thu','fri','sat'].forEach((n, i) => {
      const active = (r.schedule.days || []).includes(i);
      const chip = el('button', {
        class: active ? 'chip chip--primary' : 'chip',
        type: 'button', style: { cursor: 'pointer' },
        onClick: () => {
          r.schedule.days = r.schedule.days || [];
          const idx = r.schedule.days.indexOf(i);
          if (idx === -1) r.schedule.days.push(i); else r.schedule.days.splice(idx, 1);
          paintDays();
        }
      }, n);
      dayRow.appendChild(chip);
    });
  }
  fKind.addEventListener('change', () => {
    r.schedule = { kind: fKind.value, days: r.schedule.days || [] };
    paintDays();
  });
  paintDays();

  openSheet(el('div', { class: 'stack' }, [
    el('div', { class: 'row', style: { gap: '6px' } }, [fEmoji, fTitle]),
    labeled('repeats', fKind),
    dayRow,
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--block', onClick: () => {
        r.title = fTitle.value.trim();
        r.emoji = fEmoji.value;
        if (!r.title) { toast('needs a title'); return; }
        update((d) => {
          d.tasks.recurring = d.tasks.recurring || [];
          const i = d.tasks.recurring.findIndex((x) => x.id === r.id);
          if (i === -1) d.tasks.recurring.push(r); else d.tasks.recurring[i] = r;
        });
        closeSheet();
        toast(existing ? 'saved ✓' : 'recurring added ✓');
      } }, 'save'),
      existing ? el('button', { class: 'btn btn--ghost', onClick: () => {
        if (!confirm('remove this recurring task?')) return;
        update((d) => { d.tasks.recurring = d.tasks.recurring.filter((x) => x.id !== r.id); });
        closeSheet();
      } }, [el('i', { class: 'ph ph-trash' })]) : null,
    ]),
  ]), { title: existing ? 'edit recurring' : 'new recurring' });
}

// ──────────────────────────────────────────────────────────────
// Non-negotiables editor (inline card + sheet for full CRUD)
// ──────────────────────────────────────────────────────────────

function nonNegotiablesCard(s) {
  const t = todayKey();
  const ticks = s.nonNegotiables.tickLog[t] || {};
  const total = s.nonNegotiables.categories.reduce((n, c) => n + c.tasks.length, 0);
  const done = Object.values(ticks).filter(Boolean).length;
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-flower' }),
      'non-negotiables', el('small', null, `${done}/${total}`)
    ]),
    el('p', { class: 'muted', style: { margin: '0 0 6px' } }, 'daily baseline · tick on Today, edit here.'),
    el('button', { class: 'btn btn--ghost', onClick: () => openNonNegEditor() }, [
      el('i', { class: 'ph ph-pencil-simple' }), ' edit'
    ]),
  ]);
}

function openNonNegEditor() {
  const wrap = el('div', { class: 'stack' });
  function paintEditor() {
    wrap.innerHTML = '';
    const s = getState();
    s.nonNegotiables.categories.forEach((cat, ci) => {
      const catCard = el('div', { class: 'card' });
      const head = el('div', { class: 'row', style: { gap: '6px' } });
      const eEmoji = el('input', { class: 'input', value: cat.emoji, maxlength: 2, style: { width: '54px' } });
      const eLabel = el('input', { class: 'input', value: cat.label, style: { flex: '1' } });
      const eDel = el('button', { class: 'btn btn--soft', 'aria-label': 'Delete category', onClick: () => {
        if (!confirm(`delete "${cat.label}"?`)) return;
        update((d) => d.nonNegotiables.categories.splice(ci, 1));
        paintEditor();
      } }, [el('i', { class: 'ph ph-trash' })]);
      eEmoji.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].emoji = eEmoji.value; }));
      eLabel.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].label = eLabel.value; }));
      head.append(eEmoji, eLabel, eDel);
      catCard.appendChild(head);

      // Tasks inside this category
      cat.tasks.forEach((task, ti) => {
        const tEmoji = el('input', { class: 'input', value: task.emoji, maxlength: 2, style: { width: '54px' } });
        const tLabel = el('input', { class: 'input', value: task.label, style: { flex: '1' } });
        const tDel = el('button', { class: 'btn btn--soft', 'aria-label': 'Delete task', onClick: () => {
          update((d) => d.nonNegotiables.categories[ci].tasks.splice(ti, 1));
          paintEditor();
        } }, [el('i', { class: 'ph ph-x' })]);
        tEmoji.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].tasks[ti].emoji = tEmoji.value; }));
        tLabel.addEventListener('change', () => update((d) => { d.nonNegotiables.categories[ci].tasks[ti].label = tLabel.value; }));
        catCard.appendChild(el('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, [tEmoji, tLabel, tDel]));
      });
      catCard.appendChild(el('button', { class: 'btn btn--ghost', style: { marginTop: '6px' }, onClick: () => {
        update((d) => d.nonNegotiables.categories[ci].tasks.push({ id: uid('nn'), label: 'new', emoji: '✿' }));
        paintEditor();
      } }, '+ task'));
      wrap.appendChild(catCard);
    });
    wrap.appendChild(el('button', { class: 'btn btn--block', onClick: () => {
      update((d) => d.nonNegotiables.categories.push({ id: uid('nc'), label: 'new category', emoji: '✿', tasks: [] }));
      paintEditor();
    } }, '+ category'));
  }
  paintEditor();
  openSheet(wrap, { title: 'non-negotiables' });
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function tasksInBucket(s, bucket) {
  const all = s.tasks.negotiable;
  let list;
  if (bucket === 'Done') {
    list = all.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  } else {
    list = all.filter((t) => t.status !== 'done' && t.category === bucket);
  }
  // Order: main thing first, then priority today > soon > someday, then createdAt asc
  const main = s.tasks.mainThingByDate[todayKey()];
  const rank = { today: 0, soon: 1, someday: 2 };
  list.sort((a, b) => {
    if (a.id === main) return -1;
    if (b.id === main) return 1;
    return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1)
      || (a.due || '9999').localeCompare(b.due || '9999');
  });
  return list;
}

function countBucket(s, bucket) {
  if (bucket === 'Done') return s.tasks.negotiable.filter((t) => t.status === 'done').length;
  return s.tasks.negotiable.filter((t) => t.status !== 'done' && t.category === bucket).length;
}

function endOfDayCard(s) {
  const day = todayKey();
  const todayTasks = s.tasks.negotiable.filter((t) => t.category === 'Today');
  const done = todayTasks.filter((t) => t.status === 'done').length;
  const total = todayTasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return el('div', { class: 'card', style: { background: 'var(--surface-2)' } }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-flower-tulip' }),
      'today, gently', el('small', null, `${pct}%`)
    ]),
    el('p', { class: 'muted', style: { margin: 0 } },
      total === 0 ? 'add anything · even one tiny thing is enough.' :
      pct === 100 ? 'all today-tasks done. enjoy the dusk ✿' :
      `${done} done, ${total - done} pending. carries to tomorrow, no shame.`),
  ]);
}
