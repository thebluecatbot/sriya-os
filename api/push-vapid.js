// /api/push-vapid · GET → { publicKey }
// Returns the VAPID public key so the client can subscribe.
// Public by design — VAPID public keys are not secret.

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  if (!publicKey) return res.status(503).json({ error: 'VAPID_PUBLIC_KEY not configured' });
  return res.status(200).json({ publicKey });
}
