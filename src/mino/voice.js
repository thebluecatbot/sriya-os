// Mino's voice.
// Trilingual (English / Hindi-roman / Telugu-roman) — mixed, warm friend, a little cheeky,
// never peppy-corporate, never condescending, never guilt-trippy.
// Hard rule: Mino never shames. No "you failed", no sulking.

const POOL = {
  greet_morning: [
    'morning sunshine ✨',
    'uth gayi? coffee bana lo first',
    'good morning kanna ♡',
    'hey ✿ how is the brain today?',
    'subah ho gayi — softly into it',
    'inka ela undi nuvvu? good morning',
  ],
  greet_afternoon: [
    'lunch ho gaya?',
    'afternoon check-in — water ka glass?',
    'khaana khaaya ki nahi?',
    'half-day done, gently',
    'bhojanam aithyenda? lunch?',
  ],
  greet_evening: [
    'evening, friend ✿',
    'shaam ho gayi — chai?',
    'how was the day?',
    'samayam saayantram — light dimmer, brain dimmer',
    'wind-down time, slowly',
  ],
  greet_night: [
    'soja ab, please',
    'bed time, kanna',
    'rest is also work — promise',
    'lights low, phone away ✿',
    'late ho gayi — let\'s start closing things',
  ],

  ask_meds_morning: [
    'meds le liye?',
    'morning meds — yes or not yet?',
    'B12 / iron checked off?',
    'medicines first, scroll later',
  ],
  ask_breakfast: [
    'breakfast hua?',
    'khaali pet bilkul nahi — kuch khao',
    'something small to eat?',
  ],
  ask_lunch: [
    'lunch khaaya?',
    'meal regular, no numbers — just yes or no?',
    'bhojanam — yes? no?',
  ],
  ask_meds_evening: [
    'evening meds liye?',
    'night meds tick karo?',
  ],
  ask_dinner: [
    'dinner hua?',
    'kuch garam khao please',
  ],
  ask_journal: [
    'two lines journal — even bad day mein bhi?',
    'one line of how the day felt?',
    'journal — even a sentence counts ♡',
  ],
  ask_plan_tomorrow: [
    'plan tomorrow? just 3 things',
    'kal ke liye 3 tasks pick karein?',
    'tomorrow-me will thank tonight-you',
  ],

  praise_specific: [
    (fact) => `${fact} — visibly real, not vague gushing`,
    (fact) => `${fact}, that\'s not nothing`,
    (fact) => `noted: ${fact}. counts.`,
  ],
  encourage_behind: [
    'we shrink it, not skip it',
    'sirf ek choti task — pick one',
    'one tiny step counts. always',
    'jaipur was not built in a day, neither is a Tuesday',
  ],
  urge_redirect: [
    'urge logged. 60-second swap?',
    'thought-park or one tiny task instead?',
    'IG can wait 60 sec — what was it about really?',
    'text Prakhar instead of scrolling?',
  ],
  spiral_panic: [
    'okay. breathe with me. 4 in, 7 out.',
    'we move to the bestie playbook now',
    'not alone, kanna. one minute at a time',
  ],

  outward_nudge: [
    'message Amma, even a sticker counts',
    'Prakhar ko ping karo — small thing',
    'people > app, always',
  ],

  callout_default: [
    'tap me ♡',
    'i am here',
    'hii ✿',
  ],
};

export function say(key, ctx = {}) {
  const pool = POOL[key] || POOL.callout_default;
  const item = pool[Math.floor(Math.random() * pool.length)];
  return typeof item === 'function' ? item(ctx.fact ?? '') : item;
}

export function sayAll(key) { return POOL[key] || []; }
