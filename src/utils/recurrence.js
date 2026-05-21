// Daily tick: spawn recurring task instances, run carry-over,
// run timer forgot-to-stop guard. Idempotent · safe to call on every app open.

import { todayKey } from './format.js';

export function runDailyTick(state, update) {
  const today = todayKey();
  if (state.tasks.lastTick === today) return;

  update((d) => {
    d.tasks.lastTick = today;

    // 1) Spawn recurring tasks for today
    const recurs = d.tasks.recurring || [];
    for (const r of recurs) {
      if (!shouldFireToday(r, today)) continue;
      if (r.lastSpawnedDate === today) continue;
      const id = `t-${today}-${r.id}`;
      // Don't duplicate if a task with this id already exists.
      if (d.tasks.negotiable.some((t) => t.id === id)) continue;
      d.tasks.negotiable.unshift({
        id,
        type: 'negotiable',
        title: r.title,
        emoji: r.emoji || '',
        category: 'Today',
        due: today,
        estMins: r.estMins || null,
        priority: r.priority || 'today',
        energy: r.energy || 'light',
        person: r.person || 'sriya',
        subtasks: [],
        status: 'open',
        linkedModule: r.linkedModule || null,
        recurringFrom: r.id,
        createdAt: new Date().toISOString(),
      });
      r.lastSpawnedDate = today;
    }

    // 2) Carry-over: tasks already in "Today" bucket with due<today stay open;
    //    we just compute pendingDays at render time. Nothing destructive here.
    //    Anything older than 14 days quietly moves to "Someday" so the Today bucket stays sane.
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const cutoff = twoWeeksAgo.toISOString();
    for (const t of d.tasks.negotiable) {
      if (t.status === 'done') continue;
      if (t.category === 'Today' && t.createdAt < cutoff) t.category = 'Someday';
    }
  });
}

function shouldFireToday(r, today) {
  const schedule = r.schedule || { kind: 'daily' };
  const dow = new Date(today + 'T00:00:00').getDay();
  switch (schedule.kind) {
    case 'daily':    return true;
    case 'weekdays': return dow >= 1 && dow <= 5;
    case 'weekends': return dow === 0 || dow === 6;
    case 'weekly':   return (schedule.days || []).includes(dow);
    case 'monthly':  return new Date().getDate() === (schedule.day || 1);
    default:         return true;
  }
}

// Helper: how many days has this open task been waiting?
export function pendingDays(task) {
  if (!task.createdAt) return 0;
  const created = new Date(task.createdAt);
  const diff = Date.now() - created.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}
