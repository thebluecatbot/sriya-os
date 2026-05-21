// People · Sriya, Prakhar, Amma, + custom. Each with emoji + color theme.
// Assignable across modules (tasks, timer, calendar).

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { todayKey } from '../utils/format.js';
import { PERSON_SVGS, PEOPLE_EMOJIS } from '../data/person-svgs.js';
import { currentUser } from '../auth.js';

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
  // Recent activity per person · tasks assigned + timer entries with this person
  const myTasks = (s.tasks.negotiable || []).filter((t) => t.person === p.id);
  const openTasks = myTasks.filter((t) => t.status !== 'done').length;
  const doneTasks = myTasks.filter((t) => t.status === 'done').length;
  const timerEntries = (s.timer.log || []).filter((e) => e.person === p.id);
  const minsWith = timerEntries.reduce((n, e) => n + (e.mins || 0), 0);

  const isSelf = p.id === 'sriya';

  const avatarHTML = PERSON_SVGS[p.svgId || p.id];
  const avatar = avatarHTML
    ? el('div', { class: 'person-avatar', style: { width: '48px', height: '48px', flexShrink: 0 }, html: avatarHTML })
    : el('div', { class: 'person-avatar', style: { width: '48px', height: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--surface-2)', fontSize: '1.5rem' } }, p.emoji || '✿');

  return el('div', {
    class: 'card',
    dataset: p.addedBy === 'prakhar' ? { addedBy: 'prakhar' } : {},
    style: { borderLeft: `4px solid ${p.color || 'var(--primary)'}` }
  }, [
    el('div', { class: 'row row--between' }, [
      el('div', { class: 'row', style: { gap: '12px', alignItems: 'center' } }, [
        avatar,
        el('div', null, [
          el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.25rem' } }, p.name),
          el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, p.role || (isSelf ? 'you' : '')),
        ]),
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
  const p = existing
    ? { ...existing }
    : { id: uid('p'), name: '', emoji: '✿', color: '#F47BA7', role: '', svgId: null, addedBy: currentUser() };
  const fName = el('input', { class: 'input', value: p.name, placeholder: 'name' });
  const fEmoji = el('input', { class: 'input', value: p.emoji, maxlength: 4, style: { width: '64px' } });
  const fColor = el('input', { type: 'color', value: p.color, style: { width: '64px', height: '44px', border: '1px solid var(--line)', borderRadius: '8px' } });
  const fRole = el('input', { class: 'input', value: p.role || '', placeholder: 'relationship / role (optional)' });

  // SVG-icon picker
  const svgGrid = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '8px' } });
  function paintSvgGrid() {
    svgGrid.innerHTML = '';
    // "no svg" tile
    svgGrid.appendChild(el('button', {
      type: 'button',
      class: !p.svgId ? 'modules-grid__tile chip--primary' : 'modules-grid__tile',
      style: { width: '54px', height: '54px', padding: '4px', cursor: 'pointer' },
      onClick: () => { p.svgId = null; paintSvgGrid(); }
    }, [el('span', { style: { fontSize: '1.5rem' } }, p.emoji || '✿')]));
    Object.keys(PERSON_SVGS).forEach((key) => {
      svgGrid.appendChild(el('button', {
        type: 'button',
        class: p.svgId === key ? 'modules-grid__tile chip--primary' : 'modules-grid__tile',
        style: { width: '54px', height: '54px', padding: '4px', cursor: 'pointer' },
        title: key,
        html: PERSON_SVGS[key],
        onClick: () => { p.svgId = key; paintSvgGrid(); }
      }));
    });
  }
  paintSvgGrid();

  // Emoji picker
  const emojiGrid = el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px', maxHeight: '180px', overflowY: 'auto', padding: '6px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' } },
    PEOPLE_EMOJIS.map((e) => el('button', {
      type: 'button', class: 'chip', style: { cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px' },
      onClick: () => { fEmoji.value = e; p.emoji = e; }
    }, e))
  );

  openSheet(el('div', { class: 'stack' }, [
    el('div', { class: 'row', style: { gap: '6px' } }, [fEmoji, fName]),
    el('div', { class: 'field__label' }, 'pick an illustrated icon'),
    svgGrid,
    el('div', { class: 'field__label', style: { marginTop: '4px' } }, 'or pick an emoji'),
    emojiGrid,
    el('div', { class: 'row', style: { gap: '6px', alignItems: 'center' } }, [
      el('span', { class: 'field__label' }, 'color'), fColor,
    ]),
    fRole,
    el('button', { class: 'btn btn--block', onClick: () => {
      const name = fName.value.trim();
      if (!name) { toast('needs a name'); return; }
      update((d) => {
        p.name = name; p.emoji = fEmoji.value || '✿'; p.color = fColor.value; p.role = fRole.value;
        if (!p.addedBy) p.addedBy = currentUser();
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
