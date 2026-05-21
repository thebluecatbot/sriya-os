// People — Sriya, Prakhar, Amma, + custom. Each with emoji + color theme.
// Assignable across modules (tasks, timer, calendar).

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { todayKey } from '../utils/format.js';

export function renderPeople(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('div', { class: 'row row--between', style: { alignItems: 'baseline' } }, [
    el('h1', null, ['people ', el('i', { class: 'ph-duotone ph-users-three', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]),
    el('button', { class: 'btn', onClick: () => openPersonEdit(null) }, [el('i', { class: 'ph-fill ph-plus' }), ' add']),
  ]));

  wrap.appendChild(el('p', { class: 'muted', style: { margin: 0 } }, 'assignable across tasks, timer, calendar.'),
  );

  (s.people || []).forEach((p) => wrap.appendChild(personCard(p, s)));

  return wrap;
}

function personCard(p, s) {
  // Recent activity per person — tasks assigned + timer entries with this person
  const myTasks = (s.tasks.negotiable || []).filter((t) => t.person === p.id);
  const openTasks = myTasks.filter((t) => t.status !== 'done').length;
  const doneTasks = myTasks.filter((t) => t.status === 'done').length;
  const timerEntries = (s.timer.log || []).filter((e) => e.person === p.id);
  const minsWith = timerEntries.reduce((n, e) => n + (e.mins || 0), 0);

  const isSelf = p.id === 'sriya';

  return el('div', { class: 'card', style: { borderLeft: `4px solid ${p.color || 'var(--primary)'}` } }, [
    el('div', { class: 'row row--between' }, [
      el('div', null, [
        el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem' } },
          `${p.emoji || '✿'} ${p.name}`),
        el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, p.role || (isSelf ? 'you' : '')),
      ]),
      !isSelf ? el('div', { class: 'row', style: { gap: '4px' } }, [
        el('button', { class: 'btn btn--soft', onClick: () => openPersonEdit(p) }, [el('i', { class: 'ph ph-pencil-simple' })]),
        el('button', { class: 'btn btn--soft', onClick: () => removePerson(p) }, [el('i', { class: 'ph ph-trash' })]),
      ]) : el('button', { class: 'btn btn--soft', onClick: () => openPersonEdit(p) }, 'edit'),
    ]),
    el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px', marginTop: '8px' } }, [
      el('span', { class: 'chip' }, [el('i', { class: 'ph ph-list-checks' }), ` ${openTasks} open · ${doneTasks} done`]),
      minsWith ? el('span', { class: 'chip' }, [el('i', { class: 'ph ph-timer' }), ` ${Math.round(minsWith / 60 * 10) / 10}h together`]) : null,
    ]),
  ]);
}

function openPersonEdit(existing) {
  const p = existing ? { ...existing } : { id: uid('p'), name: '', emoji: '✿', color: '#F47BA7', role: '' };
  const fName = el('input', { class: 'input', value: p.name, placeholder: 'name' });
  const fEmoji = el('input', { class: 'input', value: p.emoji, maxlength: 2, style: { width: '64px' } });
  const fColor = el('input', { type: 'color', value: p.color, style: { width: '64px', height: '44px', border: '1px solid var(--line)', borderRadius: '8px' } });
  const fRole = el('input', { class: 'input', value: p.role || '', placeholder: 'relationship / role (optional)' });

  openSheet(el('div', { class: 'stack' }, [
    el('div', { class: 'row', style: { gap: '6px' } }, [fEmoji, fName]),
    el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
      el('span', { class: 'field__label' }, 'color'), fColor,
    ]),
    fRole,
    el('button', { class: 'btn btn--block', onClick: () => {
      const name = fName.value.trim();
      if (!name) { toast('needs a name'); return; }
      update((d) => {
        p.name = name; p.emoji = fEmoji.value || '✿'; p.color = fColor.value; p.role = fRole.value;
        const i = d.people.findIndex((x) => x.id === p.id);
        if (i === -1) d.people.push(p); else d.people[i] = p;
      });
      closeSheet(); toast(existing ? 'saved ✓' : 'added ✓');
    } }, 'save'),
  ]), { title: existing ? 'edit person' : 'new person' });
}

function removePerson(p) {
  if (p.id === 'sriya') { toast('can\'t remove yourself ✿'); return; }
  if (!confirm(`remove ${p.name}? tasks assigned to them stay, just orphan-tagged.`)) return;
  update((d) => { d.people = d.people.filter((x) => x.id !== p.id); });
  toast('removed');
}
