// Timer tab · full activity tracking.
// Sticky bar (in shell) reads timer.active. Here we render the full controls,
// recent log, 24h timeline strip, today's totals, category split, weekly heatmap.

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { fmtDuration, fmtMinutes, todayKey } from '../utils/format.js';

export function renderTimer(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(buildTimer()); };
  paint();
  unsub = subscribe(paint);
  // Live tick the active timer card every second
  const tick = setInterval(() => {
    const live = host.querySelector('[data-live-time]');
    if (live) {
      const s = getState();
      const t = s.timer.active;
      if (t?.startedAt) live.textContent = fmtDuration(elapsedMs(t));
    }
  }, 1000);
  host.addEventListener('beforerouted', () => { unsub && unsub(); clearInterval(tick); }, { once: true });
}

// ─── public actions (used by sticky bar + here) ─────────────
export function startTimer({ label, categoryId, person, note }) {
  update((d) => {
    if (d.timer.active) stopActive(d);
    d.timer.active = {
      label: label || '',
      categoryId: categoryId || 'other',
      categoryLabel: (d.timer.categories.find((c) => c.id === categoryId)?.label) || 'Other',
      person: person || null,
      note: note || '',
      startedAt: new Date().toISOString(),
      pausedAt: null,
      pausedMs: 0,
    };
  });
}

export function stopTimer() {
  update((d) => stopActive(d));
}

export function pauseTimer() {
  update((d) => {
    const a = d.timer.active;
    if (!a) return;
    if (a.pausedAt) {
      a.pausedMs += Date.now() - Date.parse(a.pausedAt);
      a.pausedAt = null;
    } else {
      a.pausedAt = new Date().toISOString();
    }
  });
}

function stopActive(d) {
  const a = d.timer.active;
  if (!a) return;
  // Settle any pending pause window
  if (a.pausedAt) {
    a.pausedMs += Date.now() - Date.parse(a.pausedAt);
    a.pausedAt = null;
  }
  const start = Date.parse(a.startedAt);
  const end = Date.now();
  const mins = Math.max(1, Math.round((end - start - a.pausedMs) / 60_000));
  d.timer.log.unshift({
    id: uid('tl'),
    label: a.label, categoryId: a.categoryId,
    person: a.person, note: a.note,
    mins,
    date: todayKey(new Date(start)),
    start: a.startedAt,
    end: new Date(end).toISOString(),
  });
  // Trim log if it gets huge
  if (d.timer.log.length > 2000) d.timer.log.length = 2000;
  d.timer.active = null;
}

function elapsedMs(active) {
  if (!active?.startedAt) return 0;
  let pause = active.pausedMs || 0;
  if (active.pausedAt) pause += Date.now() - Date.parse(active.pausedAt);
  return Date.now() - Date.parse(active.startedAt) - pause;
}

// Forgot-to-stop guard · Mino check-in is wired in mascot.js;
// here we just expose the threshold check helper.
export function isStaleTimer(s, hours = 3) {
  const a = s?.timer?.active;
  if (!a) return false;
  return elapsedMs(a) > hours * 3600_000;
}

// ─── view ────────────────────────────────────────────────────

function buildTimer() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['timer ', el('i', { class: 'ph-duotone ph-timer', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  wrap.appendChild(activeCard(s));
  wrap.appendChild(startBlock(s));
  wrap.appendChild(timelineCard(s));
  wrap.appendChild(totalsCard(s));
  wrap.appendChild(weeklyHeatmapCard(s));
  wrap.appendChild(categoriesCard(s));
  wrap.appendChild(logCard(s));

  return wrap;
}

function activeCard(s) {
  const a = s.timer.active;
  if (!a) {
    return el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-pause-circle' }), 'no activity']),
      el('p', { class: 'muted', style: { margin: 0 } }, 'tap a category below, or quick-start.'),
    ]);
  }
  const cat = s.timer.categories.find((c) => c.id === a.categoryId);
  const paused = !!a.pausedAt;
  return el('div', { class: 'card card--hero' }, [
    el('div', { class: 'row row--between' }, [
      el('div', null, [
        el('div', { class: 'row', style: { gap: '6px' } }, [
          el('span', { class: 'chip chip--primary' }, [cat?.emoji || '◌', ' ', cat?.label || 'Other']),
          a.person && a.person !== 'sriya' ? el('span', { class: 'chip' }, a.person) : null,
        ]),
        el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem', margin: '6px 0' } },
          a.label || 'tracking…'),
        el('div', { dataset: { liveTime: '' }, style: { fontVariantNumeric: 'tabular-nums', fontSize: '1.5rem' } },
          fmtDuration(elapsedMs(a))),
        paused ? el('div', { class: 'chip' }, 'paused') : null,
      ]),
    ]),
    el('div', { class: 'row', style: { marginTop: '12px', gap: '6px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => pauseTimer() }, [
        el('i', { class: paused ? 'ph-fill ph-play' : 'ph-fill ph-pause' }),
        ' ', paused ? 'resume' : 'pause'
      ]),
      el('button', { class: 'btn', onClick: () => stopTimer() }, [el('i', { class: 'ph-fill ph-stop-circle' }), ' stop & log']),
    ]),
  ]);
}

function startBlock(s) {
  const lbl = el('input', { class: 'input', placeholder: 'what are you doing?', 'aria-label': 'Activity label' });
  const sel = el('select', { class: 'select' }, s.timer.categories.map((c) =>
    el('option', { value: c.id }, `${c.emoji} ${c.label}`)));
  const note = el('input', { class: 'input', placeholder: 'note (optional)' });
  const pers = el('select', { class: 'select' }, s.people.map((p) =>
    el('option', { value: p.id, selected: p.id === 'sriya' }, `${p.emoji} ${p.name}`)));

  function start() {
    startTimer({
      label: lbl.value.trim(),
      categoryId: sel.value,
      note: note.value.trim(),
      person: pers.value,
    });
    lbl.value = ''; note.value = '';
    toast('tracking ✿');
  }

  // Quick-start chips by category (one-tap) · labelled "switch to X" when a timer is active.
  const hasActive = !!s.timer.active;
  const quick = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
    s.timer.categories.map((c) => {
      const isCurrent = hasActive && s.timer.active.categoryId === c.id;
      return el('button', {
        class: isCurrent ? 'chip chip--primary' : 'chip',
        type: 'button',
        style: { cursor: isCurrent ? 'default' : 'pointer', opacity: isCurrent ? 0.7 : 1 },
        disabled: isCurrent,
        onClick: () => {
          if (isCurrent) return;
          sel.value = c.id;
          startTimer({ categoryId: c.id, label: '', person: pers.value });
          toast(hasActive ? `switched → ${c.emoji} ${c.label}` : `${c.emoji} ${c.label}`);
        }
      }, [c.emoji, ' ', c.label]);
    })
  );

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [
      el('i', { class: 'ph-duotone ph-play-circle' }),
      hasActive ? 'switch / start fresh' : 'start',
    ]),
    el('div', { class: 'row', style: { gap: '6px' } }, [lbl, el('div', { style: { width: '50%' } }, sel)]),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [note, el('div', { style: { width: '40%' } }, pers)]),
    el('div', { class: 'field__label', style: { marginTop: '10px' } },
      hasActive ? 'one-tap switch to a different category' : 'or one-tap a category'),
    quick,
    el('div', { class: 'row', style: { gap: '6px', marginTop: '10px' } }, [
      el('button', { class: 'btn btn--block', onClick: start },
        hasActive
          ? [el('i', { class: 'ph-fill ph-arrows-left-right' }), ' switch']
          : [el('i', { class: 'ph-fill ph-play' }), ' start']),
      el('button', { class: 'btn btn--soft', onClick: () => openRetroactive() }, [el('i', { class: 'ph ph-clock-counter-clockwise' }), ' log past']),
    ]),
  ]);
}

function timelineCard(s) {
  // 24h timeline strip for today
  const day = todayKey();
  const entries = s.timer.log.filter((e) => e.date === day);
  const HOURS = 24;
  const bar = el('div', { style: {
    position: 'relative', height: '34px', borderRadius: '14px',
    background: 'var(--surface-2)', overflow: 'hidden', border: '1px solid var(--line)',
  } });
  // Hour ticks
  for (let h = 0; h <= HOURS; h += 6) {
    bar.appendChild(el('div', { style: {
      position: 'absolute', left: `${(h / HOURS) * 100}%`, top: 0, bottom: 0,
      width: '1px', background: 'var(--line)',
    } }));
  }
  // Entry blocks
  for (const e of entries) {
    const start = Date.parse(e.start);
    const end = Date.parse(e.end);
    const sH = (new Date(start).getHours() * 60 + new Date(start).getMinutes()) / 60;
    const eH = (new Date(end).getHours()   * 60 + new Date(end).getMinutes())   / 60;
    const cat = s.timer.categories.find((c) => c.id === e.categoryId);
    const left = (sH / HOURS) * 100;
    const width = Math.max(0.6, ((eH - sH) / HOURS) * 100);
    bar.appendChild(el('div', {
      title: `${e.label || cat?.label} · ${fmtMinutes(e.mins)}`,
      style: {
        position: 'absolute', left: `${left}%`, top: 0, bottom: 0,
        width: `${width}%`, background: cat?.color || 'var(--primary)',
        opacity: 0.7,
      }
    }));
  }
  // Active block on the strip
  const a = s.timer.active;
  if (a?.startedAt) {
    const st = new Date(a.startedAt);
    const sH = (st.getHours() * 60 + st.getMinutes()) / 60;
    const now = new Date();
    const eH = (now.getHours() * 60 + now.getMinutes()) / 60;
    const cat = s.timer.categories.find((c) => c.id === a.categoryId);
    bar.appendChild(el('div', {
      style: {
        position: 'absolute', left: `${(sH / HOURS) * 100}%`, top: 0, bottom: 0,
        width: `${Math.max(0.4, ((eH - sH) / HOURS) * 100)}%`,
        background: cat?.color || 'var(--primary)',
        boxShadow: '0 0 0 2px white inset',
      }
    }));
  }
  const labels = el('div', { class: 'row', style: { justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--ink-mute)', marginTop: '4px' } },
    ['12a','6a','12p','6p','12a'].map((l) => el('span', null, l)));
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-bar' }), '24h timeline']),
    bar,
    labels,
    el('div', { class: 'muted', style: { fontSize: '0.75rem', marginTop: '8px' } }, untrackedSummary(s)),
  ]);
}

function untrackedSummary(s) {
  const day = todayKey();
  const tracked = s.timer.log.filter((e) => e.date === day).reduce((n, e) => n + (e.mins || 0), 0);
  const a = s.timer.active;
  const live = a ? Math.round(elapsedMs(a) / 60_000) : 0;
  const now = new Date();
  const elapsed = now.getHours() * 60 + now.getMinutes();
  const untracked = Math.max(0, elapsed - tracked - live);
  return `tracked ${fmtMinutes(tracked + live)} · untracked ${fmtMinutes(untracked)} today`;
}

function totalsCard(s) {
  const day = todayKey();
  const totals = {};
  for (const e of s.timer.log) if (e.date === day) totals[e.categoryId] = (totals[e.categoryId] || 0) + (e.mins || 0);
  // include live
  const a = s.timer.active;
  if (a) totals[a.categoryId] = (totals[a.categoryId] || 0) + Math.round(elapsedMs(a) / 60_000);
  const ordered = s.timer.categories.map((c) => ({ c, m: totals[c.id] || 0 })).filter((x) => x.m > 0);
  ordered.sort((a, b) => b.m - a.m);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-chart-pie-slice' }), 'today by category']),
    ordered.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'nothing tracked yet.') :
      el('div', { class: 'stack' }, ordered.map(({ c, m }) => {
        const total = ordered.reduce((n, x) => n + x.m, 0) || 1;
        const pct = Math.round((m / total) * 100);
        const overBudget = c.budgetMins && m > c.budgetMins;
        return el('div', null, [
          el('div', { class: 'row row--between', style: { fontSize: '0.875rem', marginBottom: '2px' } }, [
            el('span', null, `${c.emoji} ${c.label}`),
            el('span', { class: 'muted', style: { color: overBudget ? 'var(--primary-deep)' : 'var(--ink-mute)' } },
              `${fmtMinutes(m)}${c.budgetMins ? ` / ${fmtMinutes(c.budgetMins)}` : ''}`),
          ]),
          el('div', { style: { height: '6px', background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden' } }, [
            el('div', { style: {
              height: '100%',
              width: `${pct}%`,
              background: c.color || 'var(--primary)',
              opacity: overBudget ? 1 : 0.85,
            } })
          ]),
        ]);
      })),
  ]);
}

function weeklyHeatmapCard(s) {
  // Sum mins/day for the last 7 days, colored intensity per total.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const total = s.timer.log.filter((e) => e.date === key).reduce((n, e) => n + (e.mins || 0), 0);
    days.push({ key, label: ['s','m','t','w','t','f','s'][d.getDay()], total });
  }
  const max = Math.max(60, ...days.map((d) => d.total));
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar-dots' }), 'this week']),
    el('div', { class: 'row', style: { gap: '6px', justifyContent: 'space-between' } },
      days.map((d) => el('div', { style: { textAlign: 'center', flex: 1 } }, [
        el('div', { style: {
          height: '54px', borderRadius: '12px',
          background: `color-mix(in srgb, var(--primary) ${Math.round((d.total / max) * 70 + 8)}%, var(--surface-2))`,
        } }),
        el('div', { class: 'muted', style: { fontSize: '0.7rem', marginTop: '4px' } }, d.label),
        el('div', { style: { fontSize: '0.7rem' } }, d.total ? fmtMinutes(d.total) : '·'),
      ]))
    ),
  ]);
}

function categoriesCard(s) {
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-tag' }), 'categories', el('small', null, `${s.timer.categories.length}`)]),
    el('p', { class: 'muted', style: { margin: 0 } }, 'edit names, colours, and daily budgets (e.g. Doomscroll ≤ 30 min).'),
    el('button', { class: 'btn btn--ghost', style: { marginTop: '8px' }, onClick: openCategoriesEditor }, 'edit'),
  ]);
}

function openCategoriesEditor() {
  const wrap = el('div', { class: 'stack' });
  function paintIt() {
    wrap.innerHTML = '';
    const s = getState();
    s.timer.categories.forEach((c, i) => {
      const eEmoji = el('input', { class: 'input', value: c.emoji, maxlength: 2, style: { width: '54px' } });
      const eLabel = el('input', { class: 'input', value: c.label, style: { flex: '1' } });
      const eColor = el('input', { type: 'color', value: c.color || '#E66B95', style: { width: '40px', height: '40px', border: '1px solid var(--line)', borderRadius: '8px', background: 'transparent' } });
      const eBudget = el('input', { class: 'input', type: 'number', min: 0, value: c.budgetMins || '', placeholder: 'min/day', style: { width: '100px' } });
      const eDel = el('button', { class: 'btn btn--soft', onClick: () => {
        if (!confirm(`delete category "${c.label}"?`)) return;
        update((d) => d.timer.categories.splice(i, 1));
        paintIt();
      } }, [el('i', { class: 'ph ph-trash' })]);
      eEmoji.addEventListener('change', () => update((d) => { d.timer.categories[i].emoji = eEmoji.value; }));
      eLabel.addEventListener('change', () => update((d) => { d.timer.categories[i].label = eLabel.value; }));
      eColor.addEventListener('change', () => update((d) => { d.timer.categories[i].color = eColor.value; }));
      eBudget.addEventListener('change', () => update((d) => {
        const v = parseInt(eBudget.value, 10);
        d.timer.categories[i].budgetMins = Number.isFinite(v) && v > 0 ? v : null;
      }));
      wrap.appendChild(el('div', { class: 'card', style: { padding: '10px' } }, [
        el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [eEmoji, eLabel, eColor, eDel]),
        el('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, [
          el('span', { class: 'field__label' }, 'daily budget:'),
          eBudget,
          el('span', { class: 'muted', style: { fontSize: '0.75rem' } }, 'minutes (optional)'),
        ]),
      ]));
    });
    wrap.appendChild(el('button', { class: 'btn btn--block', onClick: () => {
      update((d) => d.timer.categories.push({ id: uid('c'), label: 'new', emoji: '◌', color: '#A684E4' }));
      paintIt();
    } }, '+ category'));
  }
  paintIt();
  openSheet(wrap, { title: 'categories' });
}

function logCard(s) {
  const recent = s.timer.log.slice(0, 20);
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-list-bullets' }), 'recent log', el('small', null, `${s.timer.log.length} total`)]),
    recent.length === 0 ? el('p', { class: 'muted', style: { margin: 0 } }, 'no entries yet.') :
      el('div', { class: 'stack' }, recent.map((e) => {
        const cat = s.timer.categories.find((c) => c.id === e.categoryId);
        return el('div', { class: 'row row--between' }, [
          el('div', null, [
            el('div', null, [e.label || cat?.label || '·']),
            el('div', { class: 'muted', style: { fontSize: '0.7rem' } },
              `${cat?.emoji || ''} ${cat?.label || ''} · ${e.date} · ${new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`),
          ]),
          el('div', { class: 'row', style: { gap: '6px' } }, [
            el('span', { class: 'chip' }, fmtMinutes(e.mins)),
            el('button', { class: 'btn btn--soft', 'aria-label': 'Quick-resume', onClick: () => startTimer({
              label: e.label, categoryId: e.categoryId, person: e.person, note: ''
            }) }, [el('i', { class: 'ph ph-arrow-clockwise' })]),
            el('button', { class: 'btn btn--soft', 'aria-label': 'Edit', onClick: () => openEditEntry(e) }, [el('i', { class: 'ph ph-pencil-simple' })]),
          ]),
        ]);
      })),
  ]);
}

function openEditEntry(entry) {
  const s = getState();
  const e = JSON.parse(JSON.stringify(entry));
  const fLabel = el('input', { class: 'input', value: e.label || '' });
  const fCat = el('select', { class: 'select' }, s.timer.categories.map((c) =>
    el('option', { value: c.id, selected: e.categoryId === c.id }, `${c.emoji} ${c.label}`)));
  const fStart = el('input', { class: 'input', type: 'datetime-local', value: e.start ? e.start.slice(0, 16) : '' });
  const fEnd   = el('input', { class: 'input', type: 'datetime-local', value: e.end   ? e.end.slice(0, 16)   : '' });
  const fNote = el('input', { class: 'input', value: e.note || '' });

  openSheet(el('div', { class: 'stack' }, [
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'label'), fLabel]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'category'), fCat]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'start'), fStart]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'end'),   fEnd]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'note'), fNote]),
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--block', onClick: () => {
        const start = new Date(fStart.value).toISOString();
        const end   = new Date(fEnd.value).toISOString();
        const mins  = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
        update((d) => {
          const i = d.timer.log.findIndex((x) => x.id === e.id);
          if (i >= 0) d.timer.log[i] = {
            ...e,
            label: fLabel.value, categoryId: fCat.value, note: fNote.value,
            start, end, mins, date: start.slice(0, 10),
          };
        });
        closeSheet(); toast('saved ✓');
      } }, 'save'),
      el('button', { class: 'btn btn--ghost', onClick: () => {
        if (!confirm('delete entry?')) return;
        update((d) => { d.timer.log = d.timer.log.filter((x) => x.id !== e.id); });
        closeSheet();
      } }, [el('i', { class: 'ph ph-trash' })]),
    ]),
  ]), { title: 'edit entry' });
}

function openRetroactive() {
  const s = getState();
  const fLabel = el('input', { class: 'input', placeholder: 'what was it?' });
  const fCat = el('select', { class: 'select' }, s.timer.categories.map((c) =>
    el('option', { value: c.id }, `${c.emoji} ${c.label}`)));
  const now = new Date();
  const oneHourAgo = new Date(now - 3600_000);
  const fStart = el('input', { class: 'input', type: 'datetime-local', value: oneHourAgo.toISOString().slice(0, 16) });
  const fEnd   = el('input', { class: 'input', type: 'datetime-local', value: now.toISOString().slice(0, 16) });

  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted', style: { margin: 0 } }, 'forgot to start? log it after the fact.'),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'label'), fLabel]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'category'), fCat]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'start'), fStart]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label' }, 'end'), fEnd]),
    el('button', { class: 'btn btn--block', onClick: () => {
      const start = new Date(fStart.value).toISOString();
      const end   = new Date(fEnd.value).toISOString();
      const mins  = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 60_000));
      update((d) => {
        d.timer.log.unshift({
          id: uid('tl'),
          label: fLabel.value || '', categoryId: fCat.value, person: 'sriya', note: '',
          mins, date: start.slice(0, 10), start, end,
        });
      });
      closeSheet(); toast('logged ✓');
    } }, 'log it'),
  ]), { title: 'log past activity' });
}
