// Journal — calendar heatmap, free-form, multiple per day, voice-to-text,
// mood tags, prompt templates, "your day" auto-summary, search, photo attach,
// "on this day", gratitude mode, PIN lock.

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { todayKey, fmtDate, relative } from '../utils/format.js';

let mode = 'today';        // today | calendar | search | gratitude
let cursorDate = todayKey();
let pageSize = 30;
let unlocked = false;

const PROMPTS = [
  'how did the day feel?',
  'one thing that surprised me',
  'a small kindness — given or received',
  'what is loud inside?',
  'one tomorrow-thing',
  'a sentence about the body',
];

export function renderJournal(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['journal ', el('i', { class: 'ph-duotone ph-notebook', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  // PIN gate
  if (s.journal.pin && !unlocked) {
    wrap.appendChild(pinGate());
    return wrap;
  }

  // Mode pills
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
    pill('today',     'today',     'ph-flower'),
    pill('calendar',  'calendar',  'ph-calendar-blank'),
    pill('search',    'search',    'ph-magnifying-glass'),
    pill('gratitude', 'gratitude', 'ph-heart'),
  ]));

  if (mode === 'today')     wrap.appendChild(todayMode(s));
  if (mode === 'calendar')  wrap.appendChild(calendarMode(s));
  if (mode === 'search')    wrap.appendChild(searchMode(s));
  if (mode === 'gratitude') wrap.appendChild(gratitudeMode(s));

  return wrap;
}

function pill(id, label, icon) {
  return el('button', {
    class: mode === id ? 'chip chip--primary' : 'chip',
    type: 'button', style: { cursor: 'pointer' },
    onClick: () => { mode = id; cursorDate = todayKey(); rePaint(); }
  }, [el('i', { class: `ph ${icon}` }), ' ', label]);
}

function rePaint() {
  update((d) => { d.journal._uiTick = (d.journal._uiTick || 0) + 1; });
}

// ─── PIN gate ───
function pinGate() {
  const input = el('input', { class: 'input', type: 'password', placeholder: '••••', maxlength: 8, inputmode: 'numeric', style: { textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.5rem' } });
  return el('div', { class: 'card card--hero', style: { textAlign: 'center', padding: 'var(--space-6)' } }, [
    el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem' } }, 'locked ✿'),
    el('p', { class: 'muted', style: { margin: '8px 0 16px' } }, 'enter your PIN'),
    input,
    el('button', { class: 'btn btn--block', style: { marginTop: '12px' }, onClick: () => {
      const s = getState();
      if (s.journal.pin && hashPin(input.value) === s.journal.pin) {
        unlocked = true; rePaint();
      } else {
        toast('not quite. try again.');
        input.value = '';
      }
    } }, 'unlock'),
  ]);
}

// Very lightweight hash — not a security mechanism, just a deterrent against casual snooping
function hashPin(s) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

// ─── Today mode ───
function todayMode(s) {
  const day = todayKey();
  const entries = (s.journal.entries || []).filter((e) => e.date === day).sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  return el('div', { class: 'stack' }, [
    dayHeader(day),
    yourDayCard(s, day),
    addEntryCard(day),
    entries.length === 0 ? el('div', { class: 'empty card' }, [
      el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-notebook' })]),
      el('p', null, 'no entries today — two lines is enough ✿'),
    ]) : el('div', { class: 'stack' }, entries.map((e) => entryCard(e))),
    onThisDayCard(s, day),
  ]);
}

function dayHeader(date) {
  return el('div', { class: 'row row--between', style: { alignItems: 'baseline' } }, [
    el('h2', { style: { fontStyle: 'italic' } }, fmtDate(new Date(date + 'T00:00:00'))),
    el('div', { class: 'row', style: { gap: '4px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => { cursorDate = shiftDate(date, -1); rePaint(); } }, [el('i', { class: 'ph ph-caret-left' })]),
      el('button', { class: 'btn btn--soft', onClick: () => { cursorDate = todayKey(); rePaint(); } }, 'today'),
      el('button', { class: 'btn btn--soft', onClick: () => { cursorDate = shiftDate(date, +1); rePaint(); } }, [el('i', { class: 'ph ph-caret-right' })]),
      pinToggleBtn(),
    ]),
  ]);
}

function pinToggleBtn() {
  const s = getState();
  return el('button', { class: 'btn btn--soft', 'aria-label': 'PIN lock', onClick: () => togglePin() },
    [el('i', { class: s.journal.pin ? 'ph-fill ph-lock' : 'ph ph-lock-open' })]);
}

function togglePin() {
  const s = getState();
  if (s.journal.pin) {
    if (confirm('remove PIN lock?')) update((d) => { d.journal.pin = null; });
  } else {
    const v = prompt('set a 4-digit PIN (just a deterrent, not real encryption)');
    if (!v || !/^\d{4,8}$/.test(v)) { toast('needs 4–8 digits'); return; }
    update((d) => { d.journal.pin = hashPin(v); });
    toast('locked ✿');
  }
}

function shiftDate(date, dir) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + dir);
  return d.toISOString().slice(0, 10);
}

// "Your day" auto-summary — pulls from real data
function yourDayCard(s, day) {
  const ticks = s.nonNegotiables.tickLog[day] || {};
  const ticksCount = Object.values(ticks).filter(Boolean).length;
  const tasksDone = (s.tasks.negotiable || []).filter((t) => t.status === 'done' && (t.completedAt || '').slice(0, 10) === day).length;
  const meds = (s.health.medLog || []).filter((l) => l.date === day && l.taken).length;
  const timer = (s.timer.log || []).filter((e) => e.date === day).reduce((n, e) => n + (e.mins || 0), 0);
  const mood = (s.health.moodLog || []).find((l) => l.date === day);
  const workout = (s.health.workoutLog || []).filter((w) => w.date === day).length;
  const scrolled = s.doomscroll.dailyLog?.[day]?.mins || 0;
  const reads = (s.timer.log || []).filter((e) => e.date === day && e.categoryId === 'reading').reduce((n, e) => n + (e.mins || 0), 0);

  return el('div', { class: 'card card--hero' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-flower' }), 'your day', el('small', null, 'auto-summary')]),
    el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } }, [
      el('span', { class: 'chip' }, `${ticksCount} non-negs ticked`),
      el('span', { class: 'chip' }, `${tasksDone} tasks done`),
      meds ? el('span', { class: 'chip' }, `${meds} meds`) : null,
      timer ? el('span', { class: 'chip' }, `${Math.round(timer / 60 * 10) / 10}h tracked`) : null,
      reads ? el('span', { class: 'chip' }, `${reads}m reading`) : null,
      workout ? el('span', { class: 'chip' }, `${workout} workout`) : null,
      mood ? el('span', { class: 'chip chip--primary' }, `mood ${mood.score}/5`) : null,
      scrolled ? el('span', { class: 'chip' }, `${scrolled}m scroll`) : null,
    ]),
  ]);
}

function addEntryCard(day) {
  const ta = el('textarea', { class: 'input', rows: 5, placeholder: 'free-write — two lines is enough.', 'aria-label': 'Journal entry' });
  const moodSel = el('select', { class: 'select' }, [
    el('option', { value: '' }, 'mood (optional)'),
    el('option', { value: '1' }, '🌧 low (1)'),
    el('option', { value: '2' }, '🌫 meh (2)'),
    el('option', { value: '3' }, '☁️ okay (3)'),
    el('option', { value: '4' }, '⛅ good (4)'),
    el('option', { value: '5' }, '🌞 great (5)'),
  ]);
  const tagsInput = el('input', { class: 'input', placeholder: 'tags (comma-separated)', style: { flex: 1 } });
  const photoInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
  let photoDataURL = null;
  photoInput.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { photoDataURL = reader.result; toast('photo attached ✓'); };
    reader.readAsDataURL(f);
  });
  const voiceBtn = el('button', { class: 'btn btn--soft', type: 'button', 'aria-label': 'Voice input', onClick: () => startVoice(ta) }, [el('i', { class: 'ph-fill ph-microphone' }), ' voice']);

  const promptBar = el('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap' } },
    PROMPTS.map((p) => el('button', {
      class: 'chip', type: 'button', style: { cursor: 'pointer', fontSize: '0.7rem' },
      onClick: () => { ta.value = ta.value ? `${ta.value}\n\n${p}\n` : `${p}\n`; ta.focus(); }
    }, p)));

  function save(kind = 'entry') {
    const body = ta.value.trim();
    if (!body) { toast('write a line first'); return; }
    update((d) => {
      d.journal.entries.unshift({
        id: uid('j'), date: day, time: new Date().toISOString(),
        body, mood: moodSel.value ? parseInt(moodSel.value, 10) : null,
        tags: tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean),
        photo: photoDataURL || null, kind,
      });
      // Also update mood log if mood set + not yet logged today
      if (moodSel.value && !(d.health.moodLog || []).some((l) => l.date === day)) {
        const labels = { 1:'low', 2:'meh', 3:'okay', 4:'good', 5:'great' };
        d.health.moodLog.unshift({ id: uid('mo'), date: day, score: parseInt(moodSel.value, 10), label: labels[moodSel.value], time: new Date().toISOString() });
      }
    });
    ta.value = ''; moodSel.value = ''; tagsInput.value = ''; photoDataURL = null;
    toast(kind === 'gratitude' ? 'gratitude logged ✿' : 'saved ✿');
  }

  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-pen-nib' }), 'write']),
    el('div', { class: 'field__label' }, 'prompt (optional)'),
    promptBar,
    ta,
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [moodSel, tagsInput]),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
      voiceBtn,
      el('label', { class: 'btn btn--soft', style: { cursor: 'pointer' } }, [el('i', { class: 'ph ph-image' }), ' photo', photoInput]),
    ]),
    el('button', { class: 'btn btn--block', style: { marginTop: '8px' }, onClick: () => save() }, 'save'),
  ]);
}

function entryCard(e) {
  return el('div', { class: 'card', style: { borderLeft: '3px solid var(--primary)' } }, [
    el('div', { class: 'row row--between' }, [
      el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, [
        relative(Date.parse(e.time)),
        e.mood ? el('span', { class: 'chip chip--primary', style: { marginLeft: '6px', fontSize: '0.7rem' } }, `mood ${e.mood}/5`) : null,
        e.kind === 'gratitude' ? el('span', { class: 'chip', style: { marginLeft: '6px', fontSize: '0.7rem' } }, [el('i', { class: 'ph-fill ph-heart' }), ' gratitude']) : null,
      ]),
      el('div', { class: 'row', style: { gap: '4px' } }, [
        el('button', { class: 'btn btn--soft', onClick: () => editEntry(e) }, [el('i', { class: 'ph ph-pencil-simple' })]),
        el('button', { class: 'btn btn--soft', onClick: () => {
          if (!confirm('delete this entry?')) return;
          update((d) => { d.journal.entries = d.journal.entries.filter((x) => x.id !== e.id); });
        } }, [el('i', { class: 'ph ph-trash' })]),
      ]),
    ]),
    el('p', { style: { whiteSpace: 'pre-wrap', margin: '8px 0 0' } }, e.body),
    e.photo ? el('img', { src: e.photo, alt: 'attached photo', style: { maxWidth: '100%', borderRadius: 'var(--radius-md)', marginTop: '8px' } }) : null,
    (e.tags || []).length ? el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px', marginTop: '4px' } },
      e.tags.map((t) => el('span', { class: 'chip', style: { fontSize: '0.65rem' } }, `#${t}`))) : null,
  ]);
}

function editEntry(e) {
  const ta = el('textarea', { class: 'input', rows: 8, value: e.body });
  openSheet(el('div', { class: 'stack' }, [
    ta,
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--block', onClick: () => {
        update((d) => {
          const x = d.journal.entries.find((y) => y.id === e.id);
          if (x) x.body = ta.value;
        });
        closeSheet(); toast('saved ✓');
      } }, 'save'),
      el('button', { class: 'btn btn--ghost', onClick: () => closeSheet() }, 'cancel'),
    ]),
  ]), { title: 'edit entry' });
}

// ─── Calendar mode (heatmap) ───
function calendarMode(s) {
  const wrap = el('div', { class: 'stack' });

  // Heatmap: last 8 weeks × 7 days, intensity by entry count
  const today = new Date();
  const days = [];
  for (let i = 8 * 7 - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const entriesByDate = {};
  (s.journal.entries || []).forEach((e) => entriesByDate[e.date] = (entriesByDate[e.date] || 0) + 1);

  wrap.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-calendar-blank' }), 'last 8 weeks']),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gridAutoRows: '1fr', gap: '3px' } },
      days.map((d) => {
        const n = entriesByDate[d] || 0;
        const intensity = Math.min(100, 12 + n * 28);
        return el('button', {
          style: {
            aspectRatio: '1', borderRadius: '4px',
            background: n ? `color-mix(in srgb, var(--primary) ${intensity}%, var(--surface-2))` : 'var(--surface-2)',
            border: d === todayKey() ? '1.5px solid var(--primary-deep)' : '1px solid var(--line)',
            cursor: 'pointer', padding: 0,
          },
          title: `${d} · ${n} entries`,
          onClick: () => { cursorDate = d; mode = 'today'; rePaint(); }
        });
      })
    ),
    el('p', { class: 'muted', style: { fontSize: '0.7rem', marginTop: '8px' } }, 'darker = more entries. gaps are fine — just days.'),
  ]));

  // Entries on the cursor date
  const entries = (s.journal.entries || []).filter((e) => e.date === cursorDate);
  wrap.appendChild(el('div', { class: 'section-divider' }, fmtDate(new Date(cursorDate + 'T00:00:00'))));
  entries.forEach((e) => wrap.appendChild(entryCard(e)));
  if (entries.length === 0) wrap.appendChild(el('p', { class: 'muted', style: { textAlign: 'center' } }, '— no entries —'));

  return wrap;
}

// ─── Search mode ───
function searchMode(s) {
  const q = el('input', { class: 'input', placeholder: 'search journal · text, tags, mood' });
  const wrap = el('div', { class: 'stack' });
  wrap.appendChild(el('div', { class: 'card' }, [q]));
  const results = el('div', { class: 'stack' });
  wrap.appendChild(results);

  function paintResults() {
    results.innerHTML = '';
    const term = q.value.trim().toLowerCase();
    if (!term) { results.appendChild(el('p', { class: 'muted', style: { textAlign: 'center' } }, 'type to search.')); return; }
    const matches = (s.journal.entries || []).filter((e) =>
      e.body.toLowerCase().includes(term)
      || (e.tags || []).some((t) => t.toLowerCase().includes(term))
      || `${e.mood || ''}/5`.includes(term)
    ).slice(0, pageSize);
    if (matches.length === 0) { results.appendChild(el('p', { class: 'muted', style: { textAlign: 'center' } }, 'no matches.')); return; }
    matches.forEach((e) => results.appendChild(entryCard(e)));
  }
  q.addEventListener('input', paintResults);
  paintResults();
  return wrap;
}

// ─── Gratitude mode ───
function gratitudeMode(s) {
  const day = todayKey();
  const gratitudes = (s.journal.entries || []).filter((e) => e.kind === 'gratitude').slice(0, pageSize);
  const ta = el('textarea', { class: 'input', rows: 3, placeholder: 'three small things — even tiny ones' });

  return el('div', { class: 'stack' }, [
    el('div', { class: 'card card--hero' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-fill ph-heart', style: { color: 'var(--primary)' } }), 'gratitude']),
      el('p', { class: 'muted', style: { margin: 0 } }, 'this stays. nothing about being grateful for not having "worse". just real, ordinary good.'),
    ]),
    el('div', { class: 'card' }, [
      ta,
      el('button', { class: 'btn btn--block', style: { marginTop: '8px' }, onClick: () => {
        const body = ta.value.trim();
        if (!body) return;
        update((d) => d.journal.entries.unshift({
          id: uid('j'), date: day, time: new Date().toISOString(), body, kind: 'gratitude', tags: ['gratitude'],
        }));
        ta.value = '';
        toast('logged ✿');
      } }, 'log gratitude'),
    ]),
    el('div', { class: 'section-divider' }, 'past gratitudes'),
    gratitudes.length === 0 ? el('p', { class: 'muted', style: { textAlign: 'center' } }, 'nothing yet.') :
      el('div', { class: 'stack' }, gratitudes.map((e) => entryCard(e))),
  ]);
}

// ─── On this day ───
function onThisDayCard(s, day) {
  const [_, mm, dd] = day.split('-');
  const matches = (s.journal.entries || []).filter((e) => e.date !== day && e.date.endsWith(`-${mm}-${dd}`));
  if (matches.length === 0) return el('div');
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-clock-clockwise' }), 'on this day', el('small', null, `${matches.length}`)]),
    el('div', { class: 'stack' }, matches.slice(0, 3).map((e) => el('div', { class: 'muted', style: { fontSize: '0.85rem' } }, [
      el('strong', null, e.date), ' · ', e.body.slice(0, 120), e.body.length > 120 ? '…' : '',
    ]))),
  ]);
}

// ─── Voice ───
function startVoice(target) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('voice not available'); return; }
  const rec = new SR();
  rec.lang = navigator.language || 'en-IN';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (e) => {
    let txt = '';
    for (const r of e.results) txt += r[0].transcript;
    target.value = (target.value || '') + (target.value ? ' ' : '') + txt;
  };
  rec.onerror = () => toast('mic error');
  rec.onend = () => toast('listening done');
  rec.start();
  toast('listening… ✿');
}
