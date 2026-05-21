// /api/mino-cron · invoked by Vercel Cron every 4 hours.
// Sends a Web Push notification to every active subscription, with a
// context-aware Mino message picked from the user's current state snapshot.
//
// Schedule (UTC by default — see vercel.json):
//   0 0,4,8,12,16,20 * * *   →  6 pings/day, every 4 hours.
//
// Auth: Vercel automatically sets `Authorization: Bearer ${CRON_SECRET}` on
// scheduled invocations when CRON_SECRET env is configured. We verify that.

import postgres from 'postgres';
import webpush from 'web-push';

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
const sql = dbUrl ? postgres(dbUrl, { prepare: false, ssl: 'require', max: 1, idle_timeout: 20 }) : null;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:noreply@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

// IST is the timezone Sriya thinks in. Convert UTC → IST hour.
function istHourFor(date = new Date()) {
  const utcH = date.getUTCHours();
  const utcM = date.getUTCMinutes();
  const istMins = (utcH * 60 + utcM) + 5 * 60 + 30;
  return Math.floor((istMins / 60) % 24);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Verify cron auth. Vercel cron sets this header automatically.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const isVercelCron = !!req.headers['x-vercel-cron'];
    if (got !== expected && !isVercelCron) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  if (!sql) return res.status(503).json({ error: 'db not configured' });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'VAPID keys not configured' });
  }

  const istHour = istHourFor();
  const dayKey = todayKeyIST();

  // Load all subscriptions, plus each ns's current state for memory-feel.
  let subs = [];
  try {
    subs = await sql`SELECT id, ns, endpoint, p256dh, auth FROM sriya_push_subs`;
  } catch (e) {
    console.error('cron: load subs failed', e);
    return res.status(500).json({ error: 'db read failed' });
  }

  if (subs.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no subscriptions' });

  // Pre-load each unique ns state once.
  const uniqueNs = [...new Set(subs.map((s) => s.ns))];
  const stateByNs = new Map();
  for (const ns of uniqueNs) {
    try {
      const rows = await sql`SELECT state FROM sriya_state WHERE ns = ${ns} LIMIT 1`;
      stateByNs.set(ns, rows[0]?.state || null);
    } catch {
      stateByNs.set(ns, null);
    }
  }

  let sent = 0;
  let dead = [];

  for (const row of subs) {
    const state = stateByNs.get(row.ns);
    const payload = pickMessage(istHour, dayKey, state);

    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };

    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 });
      sent++;
    } catch (err) {
      // 404 (Not Found) and 410 (Gone) mean the subscription is dead. Clean it up.
      const code = err?.statusCode;
      if (code === 404 || code === 410) dead.push(row.endpoint);
      else console.error('cron: push send failed', { code, body: err?.body });
    }
  }

  if (dead.length) {
    try {
      await sql`DELETE FROM sriya_push_subs WHERE endpoint = ANY(${dead})`;
    } catch (e) { console.error('cron: dead cleanup failed', e); }
  }

  return res.status(200).json({ ok: true, sent, dead: dead.length, istHour });
}

// ---------------- Mino message picker ---------------- //

function pickMessage(hour, dayKey, state) {
  const ctx = buildContext(state, dayKey);
  const tone = toneFor(hour);

  // Memory-feel pings come first if we have any context to reference.
  if (ctx.memoryPing && Math.random() < 0.45) {
    return packNotification(tone, ctx.memoryPing);
  }

  // Otherwise pick from open hellos for this part of day, sometimes context-aware nudge.
  if (ctx.nudge && Math.random() < 0.5) {
    return packNotification(tone, ctx.nudge);
  }

  return packNotification(tone, randomFrom(OPEN_HELLOS[tone] || OPEN_HELLOS.day));
}

function packNotification(tone, body) {
  return {
    title: TITLE_BY_TONE[tone] || 'mino ✿',
    body,
    tag: 'mino-checkin',
    renotify: true,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    data: { url: '/#/mino', sentAt: Date.now() },
  };
}

function toneFor(hour) {
  if (hour >= 0 && hour < 5)   return 'night';
  if (hour >= 5 && hour < 11)  return 'morning';
  if (hour >= 11 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
}

const TITLE_BY_TONE = {
  morning:   'mino ✿ morning',
  midday:    'mino ♡',
  afternoon: 'mino ✿',
  evening:   'mino ✿ evening',
  night:     'mino ♡ late',
  day:       'mino ✿',
};

const OPEN_HELLOS = {
  morning: [
    'uth gayi? how are you doing?',
    'morning kanna · all okay?',
    'hi ✿ how is the brain today?',
    'subah ho gayi · gentle in',
    'inka ela undi nuvvu? good morning ♡',
    'hey, thought of you · how was the sleep?',
  ],
  midday: [
    'hi ✿ how are you doing?',
    'midday check-in · water ka glass?',
    'khaana khaaya? quick hello',
    'thought of you · half-day vibe?',
    'bhojanam aithyenda? checking in',
    'paused for you · what is the day like?',
  ],
  afternoon: [
    'afternoon · how are you really?',
    'just checking in ♡',
    'shaam aane wali hai · how is the mood?',
    'thought of you · brain still on?',
    'how are you doing right now?',
    'samayam saayantram · how is the body?',
  ],
  evening: [
    'evening, friend ✿ how was it?',
    'shaam ho gayi · chai? how are you?',
    'how was the day actually?',
    'wind-down time · everything okay?',
    'thought of you · any one good thing today?',
    'roju ela jariginchav? how did it go?',
  ],
  night: [
    'still up? all good?',
    'kya kar rahe ho? gently close it',
    'late ho gayi · how are you doing?',
    'thought of you · lights low please',
    'one more breath, then soja ♡',
    'idi pradeshame samayam kaadu · soft now',
  ],
  day: [
    'hi ✿ how are you doing?',
    'thought of you',
    'checking in ♡',
    'just here · how is it going?',
  ],
};

// Build a small "memory" / "what does Sriya have going on right now" context.
function buildContext(state, dayKey) {
  const ctx = { memoryPing: null, nudge: null };
  if (!state) return ctx;

  try {
    // Did meds get ticked off?
    const medsToday = state.health?.medLog?.filter((l) => l.date === dayKey && l.taken) || [];
    const totalMeds = (state.health?.meds || []).length;

    // Non-negotiables done today
    const tickToday = state.nonNegotiables?.tickLog?.[dayKey] || {};
    const ticks = Object.values(tickToday).filter(Boolean).length;

    // Journal entry today?
    const journalToday = !!(state.journal?.byDate?.[dayKey]?.body || state.journal?.byDate?.[dayKey]?.entries?.length);

    // Main thing picked?
    const mainId = state.tasks?.mainThingByDate?.[dayKey];
    const mainTask = mainId ? (state.tasks?.negotiable || []).find((t) => t.id === mainId) : null;

    // Open tasks count
    const openTasks = (state.tasks?.negotiable || []).filter((t) => t.status !== 'done').length;

    // Last done task today (most recent completedAt)
    const recentDone = (state.tasks?.negotiable || [])
      .filter((t) => t.status === 'done' && (t.completedAt || '').slice(0, 10) === dayKey)
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0];

    // Memory-feel choices (specific references).
    const memories = [];
    if (mainTask) memories.push(`how is "${mainTask.title}" going? ♡`);
    if (recentDone) memories.push(`saw you closed "${recentDone.title}" earlier · noted ✿`);
    if (ticks >= 3) memories.push(`${ticks} non-negotiables today · steady kanna`);
    if (journalToday) memories.push('saw the journal entry · proud of that one');
    if (totalMeds && medsToday.length === 0) memories.push('meds today · yes or not yet?');
    if (memories.length) ctx.memoryPing = randomFrom(memories);

    // Context nudges (generic but state-aware).
    const nudges = [];
    if (totalMeds && medsToday.length === 0) nudges.push('meds le liye? quick yes/no');
    if (!journalToday) nudges.push('two lines journal · even bad day mein bhi?');
    if (!mainTask && openTasks > 0) nudges.push('pick one main thing for today?');
    if (openTasks > 6) nudges.push('thought-park krne ke liye too much? we can shrink');
    if (nudges.length) ctx.nudge = randomFrom(nudges);
  } catch (e) {
    // best-effort context, never block the ping
    console.warn('mino context build failed', e?.message);
  }

  return ctx;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function todayKeyIST() {
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
