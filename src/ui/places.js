// Places & Outings · Mumbai trip planner.
// Two views (places + restaurants), 6 zones from Powai, day-plan builder.

import { el, clear, openSheet, closeSheet, toast } from '../utils/dom.js';
import { getState, update, subscribe, uid } from '../state.js';
import { todayKey, fmtDate } from '../utils/format.js';
import { SEED_VENUES, ZONES, DAY_PLAN_TEMPLATES, venueById } from '../data/mumbai-places.js';

let view = 'all'; // all | restaurants | places | outings
let zoneFilter = 0;
let sortMode = 'proximity'; // proximity | zone | status | price
let pageSize = 40;

export function renderPlaces(_params, host) {
  // Seed BEFORE first paint (subscribers attach after first paint, so a seed
  // update inside build() would notify nobody).
  ensureSeed(getState());
  let unsub = null;
  const paint = () => { clear(host); host.appendChild(build()); };
  paint();
  unsub = subscribe(paint);
  host.addEventListener('beforerouted', () => unsub && unsub(), { once: true });
}

function build() {
  const s = getState();
  const wrap = el('div', { class: 'stack' });
  wrap.appendChild(el('h1', null, ['places ', el('i', { class: 'ph-duotone ph-map-pin', style: { color: 'var(--primary)', fontSize: '1.5rem' } })]));

  // View pills
  wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
    pill('all',         'all',         'ph-list-bullets', view),
    pill('restaurants', 'restaurants', 'ph-bowl-food',    view),
    pill('places',      'places',      'ph-map-pin',      view),
    pill('outings',     'outings',     'ph-confetti',     view),
  ]));

  if (view === 'outings') {
    wrap.appendChild(outingsView(s));
  } else {
    // Zone filter + sort row
    wrap.appendChild(el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
      el('button', {
        class: zoneFilter === 0 ? 'chip chip--primary' : 'chip',
        type: 'button', style: { cursor: 'pointer' },
        onClick: () => { zoneFilter = 0; rePaint(); }
      }, 'all zones'),
      ...ZONES.map((z) => el('button', {
        class: zoneFilter === z.id ? 'chip chip--primary' : 'chip',
        type: 'button', style: { cursor: 'pointer' },
        onClick: () => { zoneFilter = z.id; rePaint(); }
      }, `Z${z.id}`))
    ]));

    wrap.appendChild(zoneInfoCard(s));
    wrap.appendChild(venueList(s));

    // Pre-built day plans for the active zone (or all when no filter)
    wrap.appendChild(templateDayPlans(s));
  }

  // Add own place
  wrap.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-plus' }), 'add your own']),
    el('button', { class: 'btn btn--block', onClick: () => openAddPlace() }, '+ new place'),
  ]));

  return wrap;
}

function pill(value, label, icon, current) {
  return el('button', {
    class: current === value ? 'chip chip--primary' : 'chip',
    type: 'button', style: { cursor: 'pointer' },
    onClick: () => { view = value; pageSize = 40; rePaint(); }
  }, [el('i', { class: `ph ${icon}` }), ' ', label]);
}

function rePaint() {
  update((d) => { d.places._uiTick = (d.places._uiTick || 0) + 1; });
}

// ─── Ensure seed ─── (also tops-up new seed venues for existing users)
function ensureSeed(s) {
  const existingIds = new Set((s.places.items || []).map((v) => v.id));
  const missing = SEED_VENUES.filter((v) => !existingIds.has(v.id));
  if ((s.places.items || []).length === 0 || missing.length > 0) {
    update((d) => {
      const have = new Set((d.places.items || []).map((v) => v.id));
      for (const v of SEED_VENUES) {
        if (!have.has(v.id)) {
          d.places.items.push({ ...v, status: 'want' });
        }
      }
    });
  }
}

// ─── Zone info card ───
function zoneInfoCard(s) {
  if (zoneFilter === 0) return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-compass' }), 'from Powai', el('small', null, '6 zones')]),
    el('p', { class: 'muted', style: { margin: 0, fontSize: '0.75rem' } }, 'Powai has no train station · Kanjurmarg/Vikhroli (Central) or Ghatkopar (+Metro 1). Cab for South Mumbai.'),
  ]);
  const zone = ZONES.find((z) => z.id === zoneFilter);
  if (!zone) return el('div');
  return el('div', { class: 'card card--hero' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-fill ph-map-trifold' }), `Zone ${zone.id} · ${zone.label}`]),
    el('p', { class: 'muted', style: { margin: 0 } }, `${zone.areas} · ${zone.travelMins} min`),
  ]);
}

// ─── Venue list ───
function venueList(s) {
  let items = (s.places.items || []).slice();
  if (view === 'restaurants') items = items.filter((v) => v.kind === 'restaurant');
  if (view === 'places')      items = items.filter((v) => v.kind === 'place');
  if (zoneFilter !== 0)        items = items.filter((v) => v.zone === zoneFilter);

  if (sortMode === 'proximity') items.sort((a, b) => (a.travelMins || 999) - (b.travelMins || 999));
  if (sortMode === 'zone')      items.sort((a, b) => a.zone - b.zone);
  if (sortMode === 'status')    items.sort((a, b) => STATUS_RANK[a.status || 'want'] - STATUS_RANK[b.status || 'want']);

  if (items.length === 0) {
    return el('div', { class: 'card empty' }, [
      el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-map-pin' })]),
      el('p', null, 'no items in this filter ✿'),
    ]);
  }

  // Group by zone if we're showing all zones
  if (zoneFilter === 0) {
    const byZone = {};
    items.forEach((v) => (byZone[v.zone] = byZone[v.zone] || []).push(v));
    const wrap = el('div', { class: 'stack' });
    Object.keys(byZone).map(Number).sort((a, b) => a - b).forEach((zid) => {
      const zone = ZONES.find((z) => z.id === zid) || { label: 'standalone', areas: '', travelMins: '' };
      wrap.appendChild(el('div', { class: 'section-divider' }, [`Z${zid} · ${zone.label}`]));
      byZone[zid].slice(0, pageSize).forEach((v) => wrap.appendChild(venueCard(v)));
    });
    if (items.length > pageSize) {
      wrap.appendChild(el('button', { class: 'btn btn--soft btn--block', onClick: () => { pageSize += 40; rePaint(); } }, 'show more'));
    }
    return wrap;
  }

  return el('div', { class: 'stack' }, items.slice(0, pageSize).map(venueCard));
}

const STATUS_RANK = { want: 0, planned: 1, visited: 2, skip: 3 };
const STATUS_CHIPS = {
  want:    { label: 'want',    icon: 'ph-bookmark-simple' },
  planned: { label: 'planned', icon: 'ph-calendar-check' },
  visited: { label: 'visited', icon: 'ph-check-circle' },
  skip:    { label: 'skip',    icon: 'ph-x-circle' },
};

function venueCard(v) {
  const status = v.status || 'want';
  return el('div', { class: 'card', style: { padding: '12px 14px' } }, [
    el('div', { class: 'row row--between' }, [
      el('div', { style: { flex: 1, minWidth: 0 } }, [
        el('div', null, [
          v.kind === 'restaurant' ? el('span', { class: 'chip', style: { fontSize: '0.65rem', marginRight: '6px' } }, [el('i', { class: 'ph ph-bowl-food' }), ' r']) : null,
          el('strong', null, v.name),
        ]),
        el('div', { class: 'muted', style: { fontSize: '0.75rem' } }, `${v.area} · ${v.what}`),
        el('div', { class: 'row', style: { gap: '4px', flexWrap: 'wrap', marginTop: '4px', fontSize: '0.7rem' } }, [
          el('span', { class: 'chip' }, [el('i', { class: 'ph ph-car' }), ` ${v.travelMins || '·'}m`]),
          v.price ? el('span', { class: 'chip' }, v.price) : null,
          v.vegStatus && v.vegStatus !== '·' ? el('span', { class: 'chip' }, v.vegStatus) : null,
          (v.flags || []).map((f) => el('span', { class: 'chip', style: { color: 'var(--primary-deep)' } }, f)),
        ]),
        v.whyGo ? el('p', { class: 'muted', style: { margin: '6px 0 0', fontSize: '0.75rem' } }, v.whyGo) : null,
      ]),
    ]),
    el('div', { class: 'row', style: { gap: '6px', marginTop: '8px', flexWrap: 'wrap' } }, [
      ...Object.entries(STATUS_CHIPS).map(([key, info]) => el('button', {
        class: status === key ? 'chip chip--primary' : 'chip',
        type: 'button', style: { cursor: 'pointer', fontSize: '0.7rem' },
        onClick: () => setStatus(v.id, key),
      }, [el('i', { class: `ph ${info.icon}` }), ' ', info.label])),
      el('button', { class: 'btn btn--soft', style: { marginLeft: 'auto', fontSize: '0.7rem' }, onClick: () => openInMaps(v) }, [el('i', { class: 'ph ph-map-pin' }), ' maps']),
      el('button', { class: 'btn btn--soft', style: { fontSize: '0.7rem' }, onClick: () => addToOuting(v) }, [el('i', { class: 'ph ph-plus' }), ' to outing']),
    ]),
  ]);
}

function setStatus(id, status) {
  update((d) => {
    const v = d.places.items.find((x) => x.id === id);
    if (!v) return;
    v.status = status;
  });
}

function openInMaps(v) {
  const q = encodeURIComponent(`${v.name} ${v.area} Mumbai`);
  const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('Powai, Mumbai')}&destination=${q}&travelmode=driving`;
  window.open(url, '_blank', 'noopener');
}

// ─── Outings: day-plan builder ───
let workingOuting = null; // ephemeral builder state

function addToOuting(v) {
  if (!workingOuting) workingOuting = { id: uid('o'), date: todayKey(), placeIds: [], notes: '' };
  if (!workingOuting.placeIds.includes(v.id)) workingOuting.placeIds.push(v.id);
  toast(`+ ${v.name}`);
  view = 'outings';
  rePaint();
}

function outingsView(s) {
  const outings = (s.places.outings || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const builder = el('div', { class: 'card card--hero' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-confetti' }), 'day-plan builder']),
  ]);
  if (workingOuting && workingOuting.placeIds.length > 0) {
    const venues = workingOuting.placeIds.map((id) => s.places.items.find((v) => v.id === id)).filter(Boolean);
    const sameZone = new Set(venues.map((v) => v.zone)).size === 1;
    const totalMins = venues.reduce((n, v) => n + (v.travelMins || 30) + 60, 0); // travel + ~60min per stop
    const effort = totalMins < 180 ? 'light' : totalMins < 360 ? 'medium' : 'big day out';
    builder.appendChild(el('div', { class: 'stack' }, [
      el('input', { class: 'input', type: 'date', value: workingOuting.date,
        onChange: (e) => { workingOuting.date = e.target.value; } }),
      el('div', { class: 'stack' }, venues.map((v, i) => el('div', { class: 'row row--between' }, [
        el('span', null, [el('strong', null, `${i + 1}. ${v.name}`), el('span', { class: 'muted', style: { fontSize: '0.75rem' } }, ` · ${v.area} · ~${v.travelMins}m`)]),
        el('button', { class: 'btn btn--soft', onClick: () => { workingOuting.placeIds.splice(i, 1); rePaint(); } }, [el('i', { class: 'ph ph-x' })]),
      ]))),
      el('div', { class: 'row', style: { gap: '6px', flexWrap: 'wrap' } }, [
        el('span', { class: 'chip' }, `${venues.length} spots`),
        el('span', { class: 'chip' }, `~${Math.round(totalMins / 60)}h`),
        el('span', { class: 'chip' }, `effort: ${effort}`),
        sameZone ? el('span', { class: 'chip chip--primary' }, 'same zone ✓') : el('span', { class: 'chip', style: { color: 'var(--primary-deep)' } }, 'multiple zones · heavy'),
      ]),
      el('div', { class: 'row', style: { gap: '6px' } }, [
        el('button', { class: 'btn btn--block', onClick: () => saveOuting() }, 'save outing'),
        el('button', { class: 'btn btn--ghost', onClick: () => { workingOuting = null; rePaint(); } }, 'clear'),
      ]),
    ]));
  } else {
    builder.appendChild(el('p', { class: 'muted', style: { margin: 0 } }, 'tap "+ to outing" on any venue to start building. or pick a template below.'));
  }

  const saved = outings.length === 0
    ? el('div', { class: 'card empty' }, [
        el('div', { class: 'empty__art' }, [el('i', { class: 'ph-duotone ph-map-trifold' })]),
        el('p', null, 'no outings saved yet.'),
      ])
    : el('div', { class: 'stack' }, outings.map((o) => outingCard(o, s)));

  return el('div', { class: 'stack' }, [builder, el('div', { class: 'section-divider' }, 'saved outings'), saved]);
}

function saveOuting() {
  if (!workingOuting || workingOuting.placeIds.length === 0) { toast('add at least one spot'); return; }
  update((d) => {
    d.places.outings = d.places.outings || [];
    const o = { ...workingOuting };
    // Set status of each spot to "planned"
    for (const id of o.placeIds) {
      const v = d.places.items.find((x) => x.id === id);
      if (v) v.status = 'planned';
    }
    // Add a calendar event
    d.calendar.events = d.calendar.events || [];
    d.calendar.events.push({
      id: uid('ev'), title: `outing · ${o.placeIds.length} spots`,
      date: o.date, start: '11:00', end: '20:00',
      sourceModule: 'outing', sourceId: o.id, color: 'var(--accent-mint)',
    });
    d.places.outings.unshift(o);
  });
  workingOuting = null;
  toast('outing saved + added to calendar ✓');
  rePaint();
}

function outingCard(o, s) {
  const venues = (o.placeIds || []).map((id) => s.places.items.find((v) => v.id === id)).filter(Boolean);
  return el('div', { class: 'card' }, [
    el('div', { class: 'row row--between' }, [
      el('strong', null, fmtDate(new Date(o.date + 'T00:00:00'))),
      el('button', { class: 'btn btn--soft', onClick: () => {
        if (!confirm('delete this outing?')) return;
        update((d) => { d.places.outings = d.places.outings.filter((x) => x.id !== o.id); });
      } }, [el('i', { class: 'ph ph-trash' })]),
    ]),
    el('div', { class: 'stack', style: { marginTop: '6px' } }, venues.map((v, i) =>
      el('div', { class: 'muted', style: { fontSize: '0.85rem' } }, `${i + 1}. ${v.name} · ${v.area}`)
    )),
  ]);
}

// ─── Pre-built day-plan templates ───
function templateDayPlans(s) {
  const filtered = zoneFilter === 0 ? DAY_PLAN_TEMPLATES : DAY_PLAN_TEMPLATES.filter((p) => p.zone === zoneFilter);
  if (filtered.length === 0) return el('div');
  return el('div', { class: 'card' }, [
    el('div', { class: 'card__title' }, [el('i', { class: 'ph-duotone ph-bookmarks' }), 'plan-a-day templates', el('small', null, `${filtered.length}`)]),
    el('div', { class: 'stack' }, filtered.map((p) => el('div', { class: 'row row--between' }, [
      el('div', null, [
        el('div', null, p.label),
        el('div', { class: 'muted', style: { fontSize: '0.7rem' } },
          p.spots.map((id) => venueById(id, s.places.items)?.name).filter(Boolean).join(' → ')),
      ]),
      el('button', { class: 'btn btn--soft', onClick: () => useTemplate(p) }, 'use'),
    ]))),
  ]);
}

function useTemplate(p) {
  workingOuting = { id: uid('o'), date: todayKey(), placeIds: [...p.spots], notes: p.label };
  view = 'outings';
  rePaint();
  toast(`loaded · ${p.label}`);
}

// ─── Add own place ───
function openAddPlace() {
  const fName = el('input', { class: 'input', placeholder: 'place name' });
  const fKind = el('select', { class: 'select' }, [['restaurant','restaurant'], ['place','place']].map(([v, l]) => el('option', { value: v }, l)));
  const fArea = el('input', { class: 'input', placeholder: 'area (e.g. Powai)' });
  const fZone = el('select', { class: 'select' }, [0, ...ZONES.map((z) => z.id)].map((id) => el('option', { value: id }, id === 0 ? 'unzoned' : `Z${id}`)));
  const fWhat = el('input', { class: 'input', placeholder: 'what is it?' });
  const fTravel = el('input', { class: 'input', type: 'number', min: 0, value: 30, placeholder: 'travel from Powai (min)' });

  openSheet(el('div', { class: 'stack' }, [
    fName, el('div', { class: 'row', style: { gap: '6px' } }, [fKind, fZone]), fArea, fWhat, fTravel,
    el('button', { class: 'btn btn--block', onClick: () => {
      const name = fName.value.trim();
      if (!name) { toast('needs a name'); return; }
      update((d) => d.places.items.push({
        id: uid('pl'), name, kind: fKind.value, zone: parseInt(fZone.value, 10),
        area: fArea.value, what: fWhat.value, travelMins: parseInt(fTravel.value, 10) || 30,
        status: 'want', vegStatus: '·', whyGo: '',
      }));
      closeSheet(); toast('added ✓');
    } }, 'add'),
  ]), { title: 'new place' });
}
