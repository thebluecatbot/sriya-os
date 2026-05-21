# Anti-doomscroll — Android one-time setup

The PWA can't block another app from inside Android — the OS provides the trigger, sriya provides the brain. This is a 10-minute, one-time setup. Once it's done, every time you tap Instagram, you land in **sriya's gate** first (15-second pause + Mino + "what are you actually avoiding?").

There are three good ways, ranked. Pick one.

---

## Option A — Bouncer (recommended, free, no root)

Bouncer is a tiny Android app that lets you put a "speed bump" in front of any other app.

1. **Install Bouncer** from the Play Store: https://play.google.com/store/apps/details?id=com.samruston.permission — actually the one you want is **"Bouncer — Pause before opening"** by Mindberg. (Or any equivalent: "Intenty", "One Sec — Pause Before Opening".)
2. **Move Instagram off the home screen.** Long-press → **Remove from home**. It still lives in the app drawer.
3. **In Bouncer**, tap **Add app → Instagram**.
4. **Set the speed-bump action** to **"Open a URL"** and paste:
   ```
   https://sriya.vercel.app/#/gate
   ```
   (Or `http://YOUR-PHONE-IP:5174/#/gate` if you're still on the local dev server.)
5. Set the pause to **at least 15 seconds** (Bouncer's default is 10; bump it).
6. **Install sriya as a PWA** if you haven't: open the URL in Chrome, tap ⋮ → **Add to Home screen**. The gate now opens in its own full-screen window.

**Test it.** Tap Instagram. Bouncer's pause appears → sriya's gate opens → you see Mino + the 15-sec breath + the question + your options.

---

## Option B — Stock Android Digital Wellbeing (free, no extra app)

Less flexible (it blocks instead of redirecting), but works without installing anything.

1. **Settings → Digital Wellbeing & Parental controls → Dashboard**.
2. Tap **Instagram → App timer**, set to **1 minute**.
3. When the timer hits, Android grays out the icon and shows "App paused".
4. **Manually open sriya's gate** by tapping the sriya icon on your home screen (which you've moved to where Instagram used to be).

This works as a soft block, but doesn't auto-route to the gate — you have to remember to open sriya.

---

## Option C — Routine via Android's built-in Routines/Modes (Pixel / Samsung)

Pixel ("Modes") and Samsung ("Modes & Routines") let you trigger automations when an app launches.

### Pixel (Android 14+)
1. **Settings → Digital Wellbeing → Modes → Create custom Mode**.
2. Trigger: **"When app opens" → Instagram**.
3. Action: **Open URL** → `https://sriya.vercel.app/#/gate`.

### Samsung (One UI 6+)
1. Open **Modes and Routines → + → Custom routine**.
2. **If** → **App opened** → Instagram.
3. **Then** → **Open link** → paste the gate URL.

If your phone doesn't expose "App opened" as a trigger, fall back to Option A.

---

## After the setup — what the gate does

When the gate opens, you see:

1. **15-second un-skippable pause** — Mino + a falling-petal animation + "breathe with me" + a countdown.
2. **The question** — "what are you actually avoiding right now?" with 6 trigger chips (bored / anxious / avoiding / in bed / lonely / tired).
3. **Better options first** — park the thought · open Today · read instead · text a real person.
4. **Still want to scroll** — set an intention (5 / 10 / 15 / 30 min). Mino notes the time and pings you when it's up.

Every gate visit is logged with the trigger and the hour. After ~2 weeks of urges, the **insights** card on `/doom` shows the real pattern ("most urges when avoiding UPSC", "peak hour 23:00 in bed"). Patterns, not verdicts.

---

## No-scroll windows

In sriya, open **More → anti-doomscroll → no-scroll windows** and set 2–3 of:

- **First hour awake** (06:00 → 07:00) — protects the morning brain.
- **Before bed** (22:00 → 23:30) — protects sleep.
- **Study blocks** (whatever they are) — protects focus.

During these windows the gate is **firmer** — Mino skips the gentle exit, the only option is "park or close."

---

## Two anti-goals to remember

- **No streak punishment.** Going over budget is data, not a verdict. The gate never says "you failed."
- **It's not about willpower.** The whole system is about adding 15 seconds of friction so the choice is a real one. Friction wins quietly.

---

## When it stops working

Apps update. Bouncer / Modes / Wellbeing rules occasionally break after Android updates. If the gate stops opening:

1. Reboot the phone.
2. Open the bouncing app and toggle Instagram off/on.
3. Verify the gate URL still loads in Chrome.
4. Reinstall the PWA if needed.

If you ever uninstall the bouncing app, the gate just stops appearing — you don't lose your sriya data, ever.
