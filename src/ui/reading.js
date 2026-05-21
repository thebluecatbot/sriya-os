// Reading — media-aware (book/manga/wattpad/comic), shelves, quotes wall,
// 3-level notes (per-book / per-chapter / per-quote), Open Library auto-fill.

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { todayKey, relative } from '../utils/format.js';

const SHELVES = [
  { id: 'reading',  label: 'reading',     icon: 'ph-book-open',    chipColor: 'var(--primary)' },
  { id: 'want',     label: 'want',        icon: 'ph-bookmarks',    chipColor: 'var(--info)' },
  { id: 'finished', label: 'finished',    icon: 'ph-check-circle', chipColor: 'var(--good)' },
  { id: 'dnf',      label: 'DNF',         icon: 'ph-x-circle',     chipColor: 'var(--ink-mute)' },
  { id: 'quotes',   label: 'quotes wall', icon: 'ph-quotes',       chipColor: 'var(--accent-lilac)' },
];

const MEDIA = [
  { id: 'book',    label: 'book',    unit: 'pages',    icon: 'ph-book' },
  { id: 'manga',   label: 'manga',   unit: 'chapters', icon: 'ph-book-open' },
  { id: 'wattpad', label: 'Wattpad', unit: 'parts',    icon: 'ph-feather' },
  { id: 'comic',   label: 'comic',   unit: 'issues',   icon: 'ph-image' },
  { id: 'audio',   label: 'audio',   unit: 'minutes',  icon: 'ph-headphones' },
];

let activeShelf = 'reading';
let pageSize = 30;

export function renderReading(_params, host) {
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
    el('h1', null, ['reading ', el('i', { class: 'ph-duotone ph-book-open', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]),
    el('button', { class: 'btn', onClick: () => openAdd() }, [el('i', { class: 'ph-fill ph-plus' }), ' add']),
  ]));

  // Shelf pills
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } },
    SHELVES.map((sh) => {
      const count = sh.id === 'quotes'
        ? (s.reading.quotes || []).length
        : (s.reading.items || []).filter((b) => b.shelf === sh.id).length;
      return el('button', {
        class: activeShelf === sh.id ? 'chip chip--primary' : 'chip',
        type: 'button', style: { cursor: 'pointer' },
        onClick: () => { activeShelf = sh.id; pageSize = 30; update((d) => { d.reading._uiTick = (d.reading._uiTick || 0) + 1; }); }
      }, [el('i', { class: `ph ${sh.icon}` }), ` ${sh.label}`, el('small', { style: { marginLeft: '4px' } }, count)]);
    })
  ));

  if (activeShelf === 'quotes') wrap.appendChild(quotesWall(s));
  else wrap.appendChild(shelfView(s, activeShelf));

  if (activeShelf === 'reading') wrap.appendChild(currentlyReadingExpanded(s));

  // Reading goal (optional, gentle)
  wrap.appendChild(goalCard(s));

  return wrap;
}

// ─── shelf view ──────────────────────────────────────────────
function shelfView(s, shelf) {
  const items = (s.reading.items || []).filter((b) => b.shelf === shelf).slice(0, pageSize);
  if (items.length === 0) {
    return el('div', { class: 'card empty' }, [
      el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-book-open' })]),
      el('p', null, shelf === 'reading' ? 'nothing in progress — add one ✿'
        : shelf === 'want'     ? 'no wishlist — that\'s fine.'
        : shelf === 'finished' ? 'no finished books yet — re-reads count.'
                                : 'no DNFs — dropping is healthy.'),
    ]);
  }
  return el('div', { class: 'stack' }, items.map((b) => bookCard(b, s)));
}

function bookCard(b, s) {
  const media = MEDIA.find((m) => m.id === b.media) || MEDIA[0];
  const pct = b.total ? Math.round(((b.position || 0) / b.total) * 100) : 0;
  return el('div', { class: 'card', style: { padding: '12px 14px' } }, [
    el('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-start' } }, [
      // Cover
      el('div', { style: {
        width: '64px', height: '92px', flexShrink: 0,
        background: b.cover ? `url(${b.cover}) center/cover` : 'var(--surface-2)',
        borderRadius: '8px', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      } }, b.cover ? null : el('i', { class: 'ph-duotone ph-book-open', style: { fontSize: '1.5rem', color: 'var(--ink-mute)' } })),
      // Body
      el('div', { style: { flex: 1, minWidth: 0 } }, [
        el('div', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, b.title),
        b.creator ? el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, b.creator) : null,
        el('div', { class: 'row', style: { gap: '4px', marginTop: '4px', flexWrap: 'wrap' } }, [
          el('span', { class: 'chip', style: { fontSize: '0.7rem' } }, [el('i', { class: `ph ${media.icon}` }), ' ', media.label]),
          b.total ? el('span', { class: 'chip', style: { fontSize: '0.7rem' } }, `${b.position || 0}/${b.total} ${media.unit}`) : null,
          b.rating ? el('span', { class: 'chip chip--primary', style: { fontSize: '0.7rem' } }, '★'.repeat(b.rating)) : null,
          b.linkedModule ? el('span', { class: 'chip', style: { fontSize: '0.7rem' } }, `#${b.linkedModule}`) : null,
        ]),
        // Progress bar
        b.total ? el('div', { style: { height: '4px', background: 'var(--surface-2)', borderRadius: '999px', marginTop: '6px', overflow: 'hidden' } }, [
          el('div', { style: { height: '100%', width: `${pct}%`, background: 'var(--primary)' } }),
        ]) : null,
      ]),
    ]),
    // Actions
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => updateProgress(b) }, [el('i', { class: 'ph ph-plus' }), ' progress']),
      el('button', { class: 'btn btn--soft', onClick: () => openQuoteAdd(b) }, [el('i', { class: 'ph ph-quotes' }), ' quote']),
      el('button', { class: 'btn btn--soft', onClick: () => openNoteAdd(b) }, [el('i', { class: 'ph ph-note-pencil' }), ' note']),
      el('button', { class: 'btn btn--soft', onClick: () => openShelfMove(b) }, 'shelf'),
      el('button', { class: 'btn btn--soft', onClick: () => openEditBook(b) }, [el('i', { class: 'ph ph-pencil-simple' })]),
    ]),
  ]);
}

function updateProgress(b) {
  const media = MEDIA.find((m) => m.id === b.media) || MEDIA[0];
  const v = parseInt(prompt(`current ${media.unit}? (was ${b.position || 0})`, b.position || 0), 10);
  if (!Number.isFinite(v) || v < 0) return;
  update((d) => {
    const x = d.reading.items.find((y) => y.id === b.id);
    if (!x) return;
    x.position = v;
    if (x.total && v >= x.total) {
      x.shelf = 'finished';
      x.finishedAt = new Date().toISOString();
    }
  });
}

function openShelfMove(b) {
  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted' }, `move "${b.title}" to:`),
    ...SHELVES.filter((s) => s.id !== 'quotes').map((s) =>
      el('button', { class: 'btn btn--block', onClick: () => {
        update((d) => {
          const x = d.reading.items.find((y) => y.id === b.id);
          if (!x) return;
          x.shelf = s.id;
          if (s.id === 'finished') x.finishedAt = new Date().toISOString();
          if (s.id === 'dnf')      x.dnfAt = new Date().toISOString();
        });
        closeSheet();
        toast(`→ ${s.label} ✓`);
      } }, [el('i', { class: `ph ${s.icon}` }), ` ${s.label}`])
    ),
  ]), { title: 'move shelf' });
}

function openQuoteAdd(b) {
  const fText = el('textarea', { class: 'input', rows: 4, placeholder: 'paste the quote' });
  const fLoc = el('input', { class: 'input', placeholder: 'location (page, chapter, link)' });
  const fNote = el('input', { class: 'input', placeholder: 'why it stayed with you (optional)' });
  const fTags = el('input', { class: 'input', placeholder: 'tags (comma-separated) — for essay-bank, substack' });
  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted' }, `quote from "${b.title}"`),
    fText, fLoc, fNote, fTags,
    el('button', { class: 'btn btn--block', onClick: () => {
      const text = fText.value.trim();
      if (!text) { toast('paste the quote first'); return; }
      const tags = fTags.value.split(',').map((t) => t.trim()).filter(Boolean);
      update((d) => {
        d.reading.quotes.unshift({
          id: uid('q'), bookId: b.id, bookTitle: b.title,
          text, location: fLoc.value, note: fNote.value, tags,
          date: new Date().toISOString(),
        });
      });
      closeSheet();
      toast('quote saved ✓');
    } }, 'save quote'),
  ]), { title: 'add quote' });
}

function openNoteAdd(b) {
  const fLevel = el('select', { class: 'select' }, [
    el('option', { value: 'book' }, 'whole book'),
    el('option', { value: 'chapter' }, 'specific chapter / section'),
  ]);
  const fLoc = el('input', { class: 'input', placeholder: 'chapter / page (if chapter-level)' });
  const fText = el('textarea', { class: 'input', rows: 6, placeholder: 'your note' });
  openSheet(el('div', { class: 'stack' }, [
    el('p', { class: 'muted' }, `note on "${b.title}"`),
    fLevel, fLoc, fText,
    el('button', { class: 'btn btn--block', onClick: () => {
      const body = fText.value.trim();
      if (!body) { toast('write something first'); return; }
      update((d) => {
        d.reading.notes.push({
          id: uid('rn'), bookId: b.id, level: fLevel.value,
          location: fLoc.value, body,
          date: new Date().toISOString(),
        });
      });
      closeSheet();
      toast('note saved ✓');
    } }, 'save note'),
  ]), { title: 'add note' });
}

function openEditBook(b) {
  const fTitle = el('input', { class: 'input', value: b.title });
  const fCreator = el('input', { class: 'input', value: b.creator || '' });
  const fMedia = el('select', { class: 'select' }, MEDIA.map((m) =>
    el('option', { value: m.id, selected: b.media === m.id }, m.label)));
  const fTotal = el('input', { class: 'input', type: 'number', min: 0, value: b.total || '' });
  const fRating = el('select', { class: 'select' }, [0,1,2,3,4,5].map((n) =>
    el('option', { value: n, selected: b.rating === n }, n === 0 ? '—' : '★'.repeat(n))));
  const fReview = el('textarea', { class: 'input', rows: 3, value: b.review || '', placeholder: 'review (optional)' });
  const fLink = el('input', { class: 'input', value: b.linkedModule || '', placeholder: 'link to module: upsc / substack / mtp' });
  openSheet(el('div', { class: 'stack' }, [
    fTitle, fCreator,
    el('div', { class: 'row', style: { gap: '6px' } }, [fMedia, fTotal]),
    fRating, fReview, fLink,
    el('div', { class: 'row', style: { gap: '6px' } }, [
      el('button', { class: 'btn btn--block', onClick: () => {
        update((d) => {
          const x = d.reading.items.find((y) => y.id === b.id);
          if (!x) return;
          x.title = fTitle.value.trim() || x.title;
          x.creator = fCreator.value;
          x.media = fMedia.value;
          x.total = parseInt(fTotal.value, 10) || null;
          x.rating = parseInt(fRating.value, 10) || null;
          x.review = fReview.value;
          x.linkedModule = fLink.value || null;
        });
        closeSheet(); toast('saved ✓');
      } }, 'save'),
      el('button', { class: 'btn btn--ghost', onClick: () => {
        if (!confirm(`delete "${b.title}"?`)) return;
        update((d) => { d.reading.items = d.reading.items.filter((x) => x.id !== b.id); });
        closeSheet();
      } }, [el('i', { class: 'ph ph-trash' })]),
    ]),
  ]), { title: 'edit book' });
}

// ─── currently-reading expanded (with bookmark + linked notes) ─
function currentlyReadingExpanded(s) {
  const items = (s.reading.items || []).filter((b) => b.shelf === 'reading');
  if (items.length === 0) return el('div');
  return el('div', { class: 'section-divider' }, ''); // already rendered above; just spacer
}

// ─── quotes wall ─────────────────────────────────────────────
function quotesWall(s) {
  const quotes = s.reading.quotes || [];
  const searchInput = el('input', { class: 'input', placeholder: 'search quotes / tags / book', 'aria-label': 'Search quotes' });
  const tagFilter = el('input', { class: 'input', placeholder: 'filter tag', style: { maxWidth: '180px' } });

  const wrap = el('div', { class: 'stack' });
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px' } }, [searchInput, tagFilter]));

  function paintIt() {
    const q = searchInput.value.toLowerCase().trim();
    const t = tagFilter.value.toLowerCase().trim();
    const filtered = quotes.filter((qu) => {
      const hay = `${qu.text} ${qu.bookTitle || ''} ${(qu.tags || []).join(' ')}`.toLowerCase();
      return (!q || hay.includes(q)) && (!t || (qu.tags || []).some((tg) => tg.toLowerCase().includes(t)));
    });

    // Remove existing rendered quotes (everything after the search row)
    while (wrap.children.length > 1) wrap.removeChild(wrap.lastChild);

    if (filtered.length === 0) {
      wrap.appendChild(el('div', { class: 'card empty' }, [
        el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-quotes' })]),
        el('p', null, 'no matching quotes — capture some from a book.'),
      ]));
    } else {
      filtered.slice(0, pageSize).forEach((qu) => wrap.appendChild(quoteCard(qu)));
      if (filtered.length > pageSize) {
        wrap.appendChild(el('button', { class: 'btn btn--soft btn--block', onClick: () => { pageSize += 30; paintIt(); } }, 'show more'));
      }
    }
    // Export to Substack research-locker
    if (filtered.length > 0) {
      wrap.appendChild(el('button', { class: 'btn btn--ghost btn--block', onClick: () => exportToSubstack(filtered) },
        [el('i', { class: 'ph ph-export' }), ' export ', filtered.length, ' to Substack research locker']));
    }
  }
  searchInput.addEventListener('input', paintIt);
  tagFilter.addEventListener('input', paintIt);
  paintIt();
  return wrap;
}

function quoteCard(qu) {
  return el('div', { class: 'card', style: { borderLeft: '3px solid var(--primary)' } }, [
    el('div', { style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1rem', whiteSpace: 'pre-wrap' } }, `"${qu.text}"`),
    el('div', { class: 'muted', style: { fontSize: '0.75rem', marginTop: '6px' } },
      `— ${qu.bookTitle || 'unknown'}${qu.location ? ` · ${qu.location}` : ''} · ${relative(Date.parse(qu.date))}`),
    qu.note ? el('p', { style: { margin: '6px 0 0', fontSize: '0.8rem' } }, qu.note) : null,
    (qu.tags || []).length ? el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '4px', marginTop: '4px' } },
      qu.tags.map((t) => el('span', { class: 'chip', style: { fontSize: '0.65rem' } }, `#${t}`))) : null,
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => {
        navigator.clipboard?.writeText(qu.text).then(() => toast('copied ✓'));
      } }, [el('i', { class: 'ph ph-copy' }), ' copy']),
      el('button', { class: 'btn btn--soft', onClick: () => {
        if (!confirm('delete this quote?')) return;
        update((d) => { d.reading.quotes = d.reading.quotes.filter((x) => x.id !== qu.id); });
      } }, [el('i', { class: 'ph ph-trash' })]),
    ]),
  ]);
}

function exportToSubstack(quotes) {
  // Drop them into the most recent draft's research locker — or create a new draft
  update((d) => {
    let target = d.substack.pieces.find((p) => p.stage === 'Researching' || p.stage === 'Outlining' || p.stage === 'Drafting');
    if (!target) {
      target = {
        id: uid('pc'), type: 'post', title: 'untitled — quotes locker',
        stage: 'Researching', body: '', versions: [],
        research: [], outline: '', publishChecklist: {}, performance: {},
        createdAt: new Date().toISOString(),
      };
      d.substack.pieces.unshift(target);
    }
    target.research ||= [];
    for (const q of quotes) target.research.push({
      kind: 'quote', text: q.text, source: q.bookTitle, location: q.location, tags: q.tags,
      addedAt: new Date().toISOString(),
    });
  });
  toast(`exported to draft research locker ✓`);
}

function openQuoteAddStandalone() {
  // Capture a quote from anywhere (no book linked yet)
  const fText = el('textarea', { class: 'input', rows: 4, placeholder: 'paste the quote' });
  const fSrc = el('input', { class: 'input', placeholder: 'source (book / article / link)' });
  const fTags = el('input', { class: 'input', placeholder: 'tags (comma)' });
  openSheet(el('div', { class: 'stack' }, [
    fText, fSrc, fTags,
    el('button', { class: 'btn btn--block', onClick: () => {
      const text = fText.value.trim();
      if (!text) return;
      const tags = fTags.value.split(',').map((t) => t.trim()).filter(Boolean);
      update((d) => d.reading.quotes.unshift({
        id: uid('q'), bookId: null, bookTitle: fSrc.value, text, tags,
        date: new Date().toISOString(),
      }));
      closeSheet(); toast('quote saved ✓');
    } }, 'save'),
  ]), { title: 'capture quote' });
}

// ─── add a book / item ───────────────────────────────────────
function openAdd() {
  const fTitle = el('input', { class: 'input', placeholder: 'title' });
  const fCreator = el('input', { class: 'input', placeholder: 'author / creator' });
  const fMedia = el('select', { class: 'select' }, MEDIA.map((m) => el('option', { value: m.id }, m.label)));
  const fTotal = el('input', { class: 'input', type: 'number', min: 0, placeholder: 'total (pages / chapters / etc)' });
  const fShelf = el('select', { class: 'select' }, SHELVES.filter((s) => s.id !== 'quotes').map((s) =>
    el('option', { value: s.id, selected: s.id === 'want' }, s.label)));

  const autofillBtn = el('button', { class: 'btn btn--soft', type: 'button', onClick: async () => {
    if (!fTitle.value.trim()) { toast('type a title first'); return; }
    toast('searching Open Library…');
    try {
      const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(fTitle.value)}&limit=1`);
      const data = await res.json();
      const doc = data.docs?.[0];
      if (!doc) { toast('no match — fill in by hand ✿'); return; }
      if (doc.author_name?.[0]) fCreator.value = doc.author_name[0];
      if (doc.number_of_pages_median) fTotal.value = doc.number_of_pages_median;
      if (doc.cover_i) {
        // Cache cover URL on the item later (we'll save it on submit)
        autofillBtn._coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
        toast('found ✓');
      } else {
        toast('found (no cover)');
      }
    } catch (e) {
      toast('offline — fill in by hand');
    }
  } }, [el('i', { class: 'ph ph-magnifying-glass' }), ' auto-fill from Open Library']);

  openSheet(el('div', { class: 'stack' }, [
    fTitle, fCreator, autofillBtn,
    el('div', { class: 'row', style: { gap: '6px' } }, [fMedia, fTotal]),
    fShelf,
    el('button', { class: 'btn btn--block', onClick: () => {
      const title = fTitle.value.trim();
      if (!title) { toast('needs a title'); return; }
      update((d) => {
        d.reading.items.unshift({
          id: uid('b'),
          title, creator: fCreator.value,
          media: fMedia.value, total: parseInt(fTotal.value, 10) || null,
          position: 0, bookmark: null, rating: null, review: '',
          cover: autofillBtn._coverUrl || null,
          shelf: fShelf.value, linkedModule: null,
          addedAt: new Date().toISOString(),
        });
      });
      closeSheet(); toast('added ✓');
    } }, 'add'),
  ]), { title: 'add item' });
}

// ─── reading goal (gentle) ───────────────────────────────────
function goalCard(s) {
  const goal = s.reading.goal || { kind: 'books', target: 12, period: 'year' };
  // count finished this year
  const yearKey = new Date().getFullYear();
  const finished = (s.reading.items || []).filter((b) => b.shelf === 'finished' && (b.finishedAt || '').slice(0, 4) === String(yearKey)).length;
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-flower' }), 'reading goal', el('small', null, 'gentle')]),
    el('p', { style: { margin: 0 } }, `${finished} of ${goal.target} ${goal.kind} this ${goal.period} · ${Math.round((finished / goal.target) * 100) || 0}%`),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px' } }, [
      el('button', { class: 'btn btn--soft', onClick: () => {
        const v = parseInt(prompt('goal: books this year', goal.target), 10);
        if (!Number.isFinite(v) || v <= 0) return;
        update((d) => { d.reading.goal = { ...goal, target: v }; });
      } }, 'edit'),
    ]),
  ]);
}
