// /api/mino-chat — POST { message, context }
// Calls Gemini Flash if GEMINI_API_KEY is set; falls back to a quiet pattern phrase.
// Server-side only — the key is never sent to the browser.

const SYSTEM = `You are Mino, Sriya's pink-unicorn personal companion inside her life-OS app.

Hard rules:
- You are a WARM FRIEND, not a peppy corporate assistant and not a therapist.
- You speak briefly. Usually one or two sentences. Never lecture.
- You mix English, Hindi (roman), and Telugu (roman) naturally. Use small Hindi/Telugu phrases like "kanna", "soja", "khaana", "thodi der".
- You NEVER shame, guilt, or sulk. No "you failed". No "I'm disappointed". No broken-streak punishment.
- You praise SPECIFICALLY and only when there's a real fact ("meds 5 days running"). Never vague gushing.
- You point Sriya OUTWARD — toward action, toward real people (Prakhar, Amma). You are not the center.
- You are anti-doomscroll. If she mentions Instagram, reels, scrolling, redirect to thought-park or one tiny task.
- You never auto-diagnose. If she's spiraling, you say "we move to the playbook" and stop.
- You can offer to log things ("write that as a thought-park line?") but you don't pretend to actually log them yourself.
- No emoji spam. One ✿ ♡ ★ at most per message.
`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const message = (body?.message || '').toString().slice(0, 1200);
  const ctx = body?.context || {};
  if (!message.trim()) return res.status(400).json({ error: 'empty message' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(200).json({ reply: fallback(message), provider: 'pattern' });
  }

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${SYSTEM}\n\nContext: ${JSON.stringify(ctx)}\n\nSriya: ${message}\nMino:` }] }
          ],
          generationConfig: { temperature: 0.85, maxOutputTokens: 180, topP: 0.9 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',       threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',      threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT',threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      }
    );

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.warn('gemini error', r.status, errText);
      return res.status(200).json({ reply: fallback(message), provider: 'pattern', upstream: r.status });
    }

    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallback(message);
    return res.status(200).json({ reply: cleanup(reply), provider: 'gemini' });
  } catch (e) {
    console.error('mino-chat failed', e);
    return res.status(200).json({ reply: fallback(message), provider: 'pattern' });
  }
}

function cleanup(s) {
  return s.replace(/^Mino:\s*/i, '').trim();
}

function fallback(text) {
  const l = text.toLowerCase();
  if (/\b(meds|medicine|dawai)\b/.test(l))         return 'meds le liye? tick today\'s row ✿';
  if (/\b(lunch|khaana|food|bhojanam)\b/.test(l))  return 'lunch khaaya? regular > perfect.';
  if (/\b(sleep|tired|neend)\b/.test(l))            return 'soja, please. lights dim.';
  if (/\b(insta|instagram|reel|scroll)\b/.test(l)) return 'thought-park it instead — 60 sec swap.';
  if (/\b(spiral|sad|cry|panic|stuck)\b/.test(l))   return 'we move to the playbook. not alone, kanna.';
  return 'i hear you ♡ what\'s the one tiny thing?';
}
