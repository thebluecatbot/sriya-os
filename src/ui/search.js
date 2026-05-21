// Global search — one box that searches across every module.
// Triggered by long-press on the FAB or Ctrl/Cmd+K keyboard shortcut.

import { el, clear, openSheet, closeSheet } from '../utils/dom.js';
import { getState } from '../state.js';

export function openSearch() {
  const input = el('input', {
    class: 'input', placeholder: 'search everything — tasks, journal, quotes, UPSC, drafts, people…',
    'aria-label': 'Global search',
    autocomplete: 'off',
  });
  const results = el('div', { class: 'stack' });

  function paint() {
    results.innerHTML = '';
    const q = input.value.trim().toLowerCase();
    if (!q || q.length < 2) {
      results.appendChild(el('p', { class: 'muted', style: { textAlign: 'center', margin: 0 } }, 'type to search ✿'));
      return;
    }
    const groups = search(q);
    if (groups.every((g) => g.items.length === 0)) {
      results.appendChild(el('p', { class: 'muted', style: { textAlign: 'center', margin: 0 } }, 'no matches.'));
      return;
    }
    groups.forEach((g) => {
      if (g.items.length === 0) return;
      results.appendChild(el('div', { class: 'section-divider' }, [el('i', { class: `ph ${g.icon}` }), ' ', g.label, ` · ${g.items.length}`]));
      g.items.slice(0, 8).forEach((item) => results.appendChild(resultRow(item)));
      if (g.items.length > 8) results.appendChild(el('p', { class: 'muted', style: { fontSize: '0.7rem', textAlign: 'center' } }, `+ ${g.items.length - 8} more`));
    });
  }
  input.addEventListener('input', paint);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
  });
  paint();

  openSheet(el('div', { class: 'stack' }, [input, results]), { title: 'search' });
  setTimeout(() => input.focus(), 320);
}

function resultRow(item) {
  return el('button', {
    class: 'card', style: { textAlign: 'left', width: '100%', cursor: 'pointer', padding: '10px' },
    onClick: () => { closeSheet(); if (item.href) location.hash = item.href; }
  }, [
    el('div', { style: { fontWeight: 500 } }, item.title),
    item.sub ? el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, item.sub) : null,
  ]);
}

function search(q) {
  const s = getState();
  const groups = [];

  // Tasks
  groups.push({ label: 'tasks', icon: 'ph-checks', items:
    (s.tasks.negotiable || []).filter((t) => t.title?.toLowerCase().includes(q)).map((t) => ({
      title: t.title, sub: `${t.category}${t.due ? ' · ' + t.due : ''}${t.status === 'done' ? ' · done' : ''}`,
      href: '#/tasks',
    }))
  });

  // Non-negotiables
  const nnHits = [];
  (s.nonNegotiables.categories || []).forEach((c) => {
    (c.tasks || []).forEach((t) => {
      if (t.label?.toLowerCase().includes(q)) nnHits.push({ title: t.label, sub: `non-negotiable · ${c.label}`, href: '#/tasks' });
    });
  });
  groups.push({ label: 'non-negotiables', icon: 'ph-flower', items: nnHits });

  // Journal
  groups.push({ label: 'journal', icon: 'ph-notebook', items:
    (s.journal.entries || []).filter((e) => (e.body || '').toLowerCase().includes(q) || (e.tags || []).some((tag) => tag.toLowerCase().includes(q)))
      .map((e) => ({ title: e.body.slice(0, 80) + (e.body.length > 80 ? '…' : ''), sub: e.date, href: '#/journal' }))
  });

  // Reading quotes
  groups.push({ label: 'quotes', icon: 'ph-quotes', items:
    (s.reading.quotes || []).filter((qu) => qu.text?.toLowerCase().includes(q) || (qu.tags || []).some((t) => t.toLowerCase().includes(q)))
      .map((qu) => ({ title: `"${qu.text.slice(0, 80)}${qu.text.length > 80 ? '…' : ''}"`, sub: qu.bookTitle || '', href: '#/reading' }))
  });

  // Reading items
  groups.push({ label: 'books', icon: 'ph-book-open', items:
    (s.reading.items || []).filter((b) => (b.title + ' ' + (b.creator || '')).toLowerCase().includes(q))
      .map((b) => ({ title: b.title, sub: `${b.creator || ''} · ${b.shelf}`, href: '#/reading' }))
  });

  // UPSC topics
  const upscHits = [];
  Object.entries(s.upsc.syllabusTree || {}).forEach(([subj, node]) => {
    (node.topics || []).forEach((t) => {
      if (t.label?.toLowerCase().includes(q)) upscHits.push({ title: t.label, sub: `${subj} · ${t.status || 'not-started'}`, href: '#/upsc' });
    });
  });
  groups.push({ label: 'upsc topics', icon: 'ph-books', items: upscHits });

  // UPSC notes
  groups.push({ label: 'upsc notes', icon: 'ph-note', items:
    (s.upsc.topicNotes || []).filter((n) => (n.body || '').toLowerCase().includes(q))
      .map((n) => ({ title: n.title || n.body.slice(0, 80), sub: 'upsc note', href: '#/upsc' }))
  });

  // Current affairs
  groups.push({ label: 'current affairs', icon: 'ph-newspaper', items:
    (s.upsc.currentAffairs || []).filter((c) => (c.title + ' ' + (c.note || '')).toLowerCase().includes(q))
      .map((c) => ({ title: c.title, sub: `${c.date} · ${(c.tags || []).join(', ')}`, href: '#/upsc' }))
  });

  // Substack
  groups.push({ label: 'substack drafts', icon: 'ph-pen-nib', items:
    (s.substack.pieces || []).filter((p) => (p.title + ' ' + (p.body || '')).toLowerCase().includes(q))
      .map((p) => ({ title: p.title || 'untitled', sub: p.stage, href: '#/substack' }))
  });
  groups.push({ label: 'substack ideas', icon: 'ph-lightbulb', items:
    (s.substack.ideas || []).filter((i) => i.text.toLowerCase().includes(q))
      .map((i) => ({ title: i.text.slice(0, 80) + (i.text.length > 80 ? '…' : ''), sub: 'idea inbox', href: '#/substack' }))
  });

  // Places
  groups.push({ label: 'places', icon: 'ph-map-pin', items:
    (s.places.items || []).filter((v) => (v.name + ' ' + (v.area || '') + ' ' + (v.what || '')).toLowerCase().includes(q))
      .map((v) => ({ title: `${v.name}`, sub: `${v.area} · ${v.what}`, href: '#/places' }))
  });

  // Thought-park
  groups.push({ label: 'thought-park', icon: 'ph-cloud', items:
    (s.thoughtPark.items || []).filter((i) => i.text.toLowerCase().includes(q))
      .map((i) => ({ title: i.text.slice(0, 80), sub: i.triaged ? 'triaged' : 'parked', href: '#/thought' }))
  });

  // People
  groups.push({ label: 'people', icon: 'ph-users', items:
    (s.people || []).filter((p) => p.name.toLowerCase().includes(q))
      .map((p) => ({ title: `${p.emoji || ''} ${p.name}`, sub: p.role || '', href: '#/people' }))
  });

  return groups;
}

// Keyboard shortcut
export function bindSearchShortcut() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openSearch();
    }
  });
}
