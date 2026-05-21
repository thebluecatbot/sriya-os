// One-shot helper: prints VAPID keys for setting up Web Push.
// Usage:  npm i --no-save web-push && node scripts/gen-vapid.mjs
// Copy the three lines into Vercel env vars (Production + Preview + Development).

import webpush from 'web-push';

const v = webpush.generateVAPIDKeys();
const subject = process.argv[2] || 'mailto:sanjukharat90@gmail.com';

console.log('\nAdd these to Vercel → Project → Settings → Environment Variables:\n');
console.log('VAPID_PUBLIC_KEY=' + v.publicKey);
console.log('VAPID_PRIVATE_KEY=' + v.privateKey);
console.log('VAPID_SUBJECT=' + subject);
console.log('CRON_SECRET=' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
console.log('\nAlso set NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same as VAPID_PUBLIC_KEY> if you want client to read at build time.');
console.log('(this app reads the public key from /api/push-vapid instead, so the client env var is optional)');
