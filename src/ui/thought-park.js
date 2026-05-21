// Thought-park inbox — one place to park stray/spiraling thoughts.
// Triage to task / idea / journal line / delete.

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, subscribe, update, uid, TODAY } from '../state.js';
import { relative, todayKey } from '../utils/format.js';

let pageSize = 30;

export function renderThoughtPark(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['thought-park ', el('i', { class: 'ph-duotone ph-cloud', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  // Quick add
  const input = el('input', { class: 'input', placeholder: 'park a thought — type or speak', 'aria-label': 'Park a thought' });
  function doAdd() {
    const v = input.value.trim();
    if (!v) return;
    update((d) => {
      d.thoughtPark.items.unshift({ id: uid('p'), text: v, date: new Date().toISOString(), triaged: false });
    });
    input.value = '';
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

  wrap.appendChild(el('div', { class: 'card' }, [
    el('p', { class: 'muted', style: { margin: 0 } }, 'a container, not a list to act on. dump first, triage later.'),
    el('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } }, [
      input,
      el('button', { class: 'btn', onClick: doAdd, 'aria-label': 'Park' }, [el('i', { class: 'ph-fill ph-plus' })]),
    ]),
  ]));

  // Items
  const items = (s.thoughtPark.items || []).slice(0, pageSize);
  if (items.length === 0) {
    wrap.appendChild(el('div', { class: 'card empty' }, [
      el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-cloud' })]),
      el('p', null, 'empty park ✿ — that\'s perfectly fine.'),
    ]));
  } else {
    items.forEach((i) => wrap.appendChild(itemCard(i)));
  }

  if ((s.thoughtPark.items || []).length > pageSize) {
    wrap.appendChild(el('button', { class: 'btn btn--soft btn--block', onClick: () => {
      pageSize += 30;
      // Trigger repaint via state ping
      update((d) => { d.thoughtPark._uiTick = (d.thoughtPark._uiTick || 0) + 1; });
    } }, 'show older'));
  }

  return wrap;
}

function itemCard(i) {
  return el('div', { class: 'card', style: { padding: '12px 14px' } }, [
    el('div', { style: { whiteSpace: 'pre-wrap' } }, i.text),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, [
      el('span', { class: 'chip', style: { fontSize: '0.7rem' } }, relative(Date.parse(i.date))),
      i.triaged ? el('span', { class: 'chip chip--primary', style: { fontSize: '0.7rem' } }, 'triaged') : null,
    ]),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => triageToTask(i) }, [el('i', { class: 'ph ph-checks' }), ' task']),
      el('button', { class: 'btn btn--soft', onClick: () => triageToIdea(i) }, [el('i', { class: 'ph ph-pen-nib' }), ' idea']),
      el('button', { class: 'btn btn--soft', onClick: () => triageToJournal(i) }, [el('i', { class: 'ph ph-notebook' }), ' journal']),
      el('button', { class: 'btn btn--ghost', onClick: () => removeItem(i) }, [el('i', { class: 'ph ph-trash' })]),
    ]),
  ]);
}

function triageToTask(i) {
  update((d) => {
    d.tasks.negotiable.unshift({
      id: uid('t'), type: 'negotiable', title: i.text, emoji: '', category: 'Soon',
      due: '', estMins: null, priority: 'soon', energy: 'light', person: 'sriya',
      subtasks: [], status: 'open', linkedModule: null, createdAt: new Date().toISOString(),
    });
    const it = d.thoughtPark.items.find((x) => x.id === i.id);
    if (it) it.triaged = true;
  });
  toast('→ task ✓');
}
function triageToIdea(i) {
  update((d) => {
    d.substack.ideas.unshift({ id: uid('i'), text: i.text, createdAt: new Date().toISOString() });
    const it = d.thoughtPark.items.find((x) => x.id === i.id);
    if (it) it.triaged = true;
  });
  toast('→ substack idea ✓');
}
function triageToJournal(i) {
  update((d) => {
    d.journal.entries.unshift({
      id: uid('j'), date: todayKey(), time: new Date().toISOString(), body: i.text, mood: null,
    });
    const it = d.thoughtPark.items.find((x) => x.id === i.id);
    if (it) it.triaged = true;
  });
  toast('→ journal ✓');
}
function removeItem(i) {
  update((d) => { d.thoughtPark.items = d.thoughtPark.items.filter((x) => x.id !== i.id); });
}
