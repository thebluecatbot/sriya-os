// Mino reward unlocks — cute accessories earned at consistency milestones.
// Never taken away. Celebrated by Mino on unlock.

import { getState, update, subscribe, uid } from '../state.js';
import { todayKey } from '../utils/format.js';
import { toast } from '../utils/dom.js';

export const UNLOCKS = [
  { id: 'default',  label: 'starter look',  emoji: '✿',   check: () => true },
  { id: 'flower',   label: 'flower crown',  emoji: '🌸', why: 'journal 7 days',           check: (s) => uniqueDays(s.journal.entries || [], 'date') >= 7 },
  { id: 'wings',    label: 'tiny wings',    emoji: '🦋', why: 'meds 14 days running',     check: (s) => medsStreak(s) >= 14 },
  { id: 'star',     label: 'sparkle star',  emoji: '⭐', why: 'a scroll-light week (under budget 7 days)',  check: (s) => scrollLightDays(s) >= 7 },
  { id: 'bow',      label: 'silky bow',     emoji: '🎀', why: 'finish 1 book',            check: (s) => (s.reading.items || []).filter((b) => b.shelf === 'finished').length >= 1 },
  { id: 'sushi',    label: 'snack pouch',   emoji: '🍱', why: 'a full Matunga outing',     check: (s) => (s.places.outings || []).length >= 1 },
  { id: 'cap',      label: 'graduate cap',  emoji: '🎓', why: '10 UPSC revisions done',   check: (s) => (s.upsc.revisions || []).filter((r) => r.done).length >= 10 },
  { id: 'tea',      label: 'chai cup',      emoji: '🍵', why: 'a 7-day mood streak',       check: (s) => uniqueDays(s.health.moodLog || [], 'date') >= 7 },
  { id: 'ribbon',   label: 'rainbow ribbon',emoji: '🌈', why: 'ship 1 substack post',      check: (s) => (s.substack.pieces || []).filter((p) => p.stage === 'Published').length >= 1 },
  { id: 'heart',    label: 'sparkly heart', emoji: '💖', why: 'gratitude logged 5 times',  check: (s) => (s.journal.entries || []).filter((e) => e.kind === 'gratitude').length >= 5 },
];

function uniqueDays(arr, key) {
  return new Set(arr.map((x) => x[key])).size;
}

function medsStreak(s) {
  const set = new Set((s.health.medLog || []).filter((l) => l.taken).map((l) => l.date));
  let n = 0;
  const d = new Date();
  while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function scrollLightDays(s) {
  const budget = s.doomscroll.budgetMins ?? 30;
  const last7 = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last7.push(todayKey(d));
  }
  return last7.filter((d) => (s.doomscroll.dailyLog?.[d]?.mins ?? 0) <= budget).length;
}

// Recompute on every state change. Persist newly-unlocked ids; show a toast for new ones.
let mounted = false;
export function mountUnlocks() {
  if (mounted) return;
  mounted = true;
  const tick = () => {
    const s = getState();
    if (!s?.mino) return;
    const already = new Set(s.mino.unlocks || []);
    const newly = [];
    for (const u of UNLOCKS) {
      if (!already.has(u.id) && u.check(s)) newly.push(u);
    }
    if (newly.length === 0) return;
    update((d) => {
      d.mino.unlocks = d.mino.unlocks || [];
      for (const u of newly) {
        if (!d.mino.unlocks.includes(u.id)) d.mino.unlocks.push(u.id);
      }
    }, { silent: true });
    for (const u of newly) {
      toast(`✦ unlocked: ${u.emoji} ${u.label} — ${u.why}`, 4000);
    }
  };
  subscribe(tick);
  tick();
}

// Return the currently-equipped accessory emoji (top of unlock chain) for Mino UI overlay.
export function equippedAccessory(s) {
  const eq = s.mino?.equippedAccessoryId;
  if (eq) {
    const u = UNLOCKS.find((x) => x.id === eq);
    if (u) return u.emoji;
  }
  // Default = the most-recently unlocked
  const unlocks = s.mino?.unlocks || [];
  const last = unlocks[unlocks.length - 1];
  if (last && last !== 'default') {
    const u = UNLOCKS.find((x) => x.id === last);
    if (u) return u.emoji;
  }
  return null;
}
