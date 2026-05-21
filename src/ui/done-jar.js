// Done jar · every tick lands here. A counter to "no output = no rest is a lie."

import { el, clear, toast } from '../utils/dom.js';
import { getState, subscribe, update } from '../state.js';
import { todayKey, fmtDate } from '../utils/format.js';

export function renderDoneJar(_params, host) {
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });

  wrap.appendChild(el('h1', null, ['done jar ', el('i', { class: 'ph-duotone ph-confetti', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  const today = todayKey();
  const todayItems = s.doneJar.byDate[today] || [];

  // Mino's specific-praise hero
  wrap.appendChild(el('div', { class: 'card card--hero' }, [
    el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.5rem' } },
      todayItems.length === 0 ? 'every tick lands here ✿' : praise(todayItems)),
    el('p', { class: 'muted', style: { margin: '6px 0 0' } },
      todayItems.length === 0
        ? 'no output = no rest is a lie. one tiny thing is enough.'
        : `${todayItems.length} today · keeps growing ♡`),
  ]));

  // Today's jar (latest first)
  if (todayItems.length > 0) {
    wrap.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-flower' }), 'today']),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
        [...todayItems].reverse().map((i) => el('span', { class: 'chip chip--primary' }, i.label || 'done'))),
    ]));
  }

  // Recent days (last 14)
  const recentDays = Object.keys(s.doneJar.byDate)
    .filter((d) => d !== today)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14);

  if (recentDays.length === 0) {
    wrap.appendChild(el('div', { class: 'empty card' }, [
      el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-flower' })]),
      el('p', null, 'history will fill in as you tick things off.'),
    ]));
  } else {
    wrap.appendChild(el('div', { class: 'section-divider' }, 'past days'));
    recentDays.forEach((d) => {
      const items = s.doneJar.byDate[d] || [];
      wrap.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'card__title' }, [
          el('i', { class: 'ph-duotone ph-calendar-blank' }),
          fmtDate(new Date(d + 'T00:00:00')), el('small', null, `${items.length}`)
        ]),
        el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
          items.slice(-30).map((i) => el('span', { class: 'chip' }, i.label || 'done'))),
      ]));
    });
  }

  return wrap;
}

function praise(items) {
  const recent = items.slice(-3).map((i) => i.label).filter(Boolean);
  if (recent.length === 0) return 'kept showing up today ✿';
  if (recent.length === 1) return `${recent[0]} · counts.`;
  return `${recent.join(' · ')} · visibly real, not vague gushing.`;
}
