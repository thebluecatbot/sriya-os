// /api/realtime-config · returns Supabase URL + anon key so the client
// can open a Realtime subscription. Anon key is safe to expose — that's
// what it's designed for. No RLS bypass here.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) return res.status(200).json({});
  return res.status(200).json({ url, anonKey });
}
