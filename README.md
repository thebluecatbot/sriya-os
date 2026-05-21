# sriya — webOS

A private life-OS PWA for one user. Pink, soft, feminine. Mino the unicorn lives bottom-right.

Vanilla JavaScript, hash routing, no build step, localStorage as the working store, Neon Postgres as the mirror, Vercel for hosting.

This repo is the **Wave 1** scaffold (per §17 of the build spec). Daily drivers, study, content, places, etc. land in later waves.

---

## Wave 1 — what's shipped

- Installable PWA shell — `manifest.webmanifest`, `sw.js`, Phosphor icons, Fraunces + Inter
- **Design system** — Blush / Lavender / Peachy / Sakura palettes, dark mode (plum/mauve, never harsh black), petal-fall animation, soft rounded cards, gentle gradients, petal-bloom on check
- **Today dashboard** — greeting · clock · non-negotiables checklist · top 3 tasks · meds due · revisions due · running timer · schedule strip · journal nudge · done jar peek · 15-day block · rewards · more drawer
- **Mino mascot** — bottom-right floating unicorn (idle bob, mood states, never sad/sulky), tap-to-open panel with one-next-action, check-in row, panic → playbook button, chat (Gemini Flash + pattern-matcher fallback), snooze · chattiness · quiet-hours controls
- **App shell** — bottom nav (Today · Tasks · Timer · Mino · Me), more drawer (Health, Reading, UPSC, Substack, Journal, People, Playbook, Focus, Places, Thought-park), sticky activity bar at top, global quick-capture FAB
- **Quick capture** — type or speak (Web Speech API), smart routing (task / idea / quote / thought-park / journal / log)
- **Me / settings** — theme variant picker, light/dark/auto, petals toggle, reduced motion, font size, high contrast, dyslexia font, language hint, export/import JSON, reset
- **State layer** — `src/state.js` with localStorage namespace `sriya.v3.*` (guests get `guest.<name>.*`), `update()` / `subscribe()` / `persist()` (debounced), mirror to Neon via `/api/state`
- **API routes** — `/api/state` (GET/POST JSON blob, JSONB column in Neon), `/api/mino-chat` (Gemini Flash + safety + offline fallback). Both degrade gracefully when no DB / no key.

---

## Run locally

A static server is enough for the UI (the API routes need `vercel dev` to run; without them the app still works, it just won't sync to Neon).

```sh
# 1) static server only (UI works, no Neon sync)
python -m http.server 5173 --bind 127.0.0.1
# then open http://127.0.0.1:5173/

# 2) full dev with API routes (Neon + Gemini)
npm i -g vercel
npm install
vercel link            # link to your Vercel project
vercel env pull        # pulls .env.local
vercel dev             # http://localhost:3000
```

Service worker is **disabled on localhost** during dev to avoid serving stale modules. It registers on real deployments.

---

## Environment variables

Copy `.env.local.example` → `.env.local` and fill in:

```sh
DATABASE_URL=postgres://...    # Neon free tier: https://neon.tech
GEMINI_API_KEY=...             # Mino's chat (optional — pattern-matcher works without)
GROQ_API_KEY=...               # alternative; pick one
```

On Vercel, add the same vars under **Project → Settings → Environment Variables**.

> **Note on the Gemini key you pasted in chat:** treat that one as exposed and **rotate it** at https://aistudio.google.com/apikey before deploying anywhere public. The fresh key goes into `.env.local` and Vercel env, never into source code.

---

## Deploy

```sh
vercel              # preview
vercel --prod       # production
```

`vercel.json` already sets the right `Service-Worker-Allowed` header and disables cache on `sw.js`.

---

## Android — install as a PWA

1. Open the deployed URL in Chrome.
2. Tap the **⋮ menu → Add to Home screen** (or wait for the install prompt).
3. The app installs as "sriya" with the pink unicorn icon. It opens full-screen and works offline.
4. **Notifications** — Android supports full PWA notifications. Wave 1 has the plumbing; reminders for meds / revisions / "plan tomorrow" land with Health (Wave 2) and UPSC (Wave 4).

---

## Project layout

```
.
├── index.html                 # entry — links CSS + boots /src/app.js
├── manifest.webmanifest       # PWA manifest
├── sw.js                      # service worker (prod only)
├── vercel.json                # headers + clean URLs
├── package.json               # only deps: @neondatabase/serverless
├── icons/                     # PWA icons + Mino mascot SVG
├── api/
│   ├── state.js               # GET/POST namespaced JSON blob → Neon
│   └── mino-chat.js           # Gemini Flash + pattern fallback
└── src/
    ├── app.js                 # entry: state init, router, shell, Mino
    ├── router.js              # hash router
    ├── state.js               # STATE + persist + Neon sync
    ├── design/
    │   ├── tokens.css         # theme variants, fonts, spacing
    │   ├── components.css     # cards, buttons, nav, sheets, etc.
    │   └── petals.css         # background petal-fall animation
    ├── mino/
    │   ├── mascot.js          # floating mascot + day-part check-ins
    │   ├── panel.js           # tap-to-open sheet (next action, chat, controls)
    │   └── voice.js           # trilingual phrase pool
    ├── ui/
    │   ├── shell.js           # nav, sticky bar, FAB, more drawer
    │   ├── today.js           # Today dashboard (13 cards)
    │   ├── capture.js         # quick capture sheet
    │   ├── me.js              # settings / backup
    │   └── placeholder.js     # Wave-2+ tabs
    └── utils/
        ├── dom.js             # el(), openSheet, toast, bloomAt, haptic
        └── format.js          # dates, durations, dayPart, inQuietHours
```

---

## Adding a route (any wave)

```js
// in src/app.js → registerRoutes()
import { renderHealth } from './ui/health.js';
registerRoute('/health', renderHealth, { title: 'health' });
```

Each render function takes `(params, host)` and writes into `host`. Subscribe to state changes with `subscribe(paint)` — see `src/ui/today.js` and `src/ui/me.js` for the pattern.

---

## Design rules (never break)

1. **Mino never looks sad.** No sulking, no guilt, no shame.
2. **No punishing streaks.** No red "you failed" states.
3. **No calorie counting, no weigh-in.** Meals are yes/no only.
4. **Capture beats organize.** Quick capture is one tap, voice-first.
5. **Speed and lightness are features.** No bundler, paginate long lists, never block the main thread on Neon sync.
6. **Backup before polish.** Data loss is unacceptable — JSON export + Neon mirror.

Full reference: see `WEBOS-BUILD-SPEC.md` (in the `my app` folder — outside this repo).
