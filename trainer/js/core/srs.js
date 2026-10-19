// SM-2 spaced repetition (SuperMemo 2) with a same-day relearn step.
// Card state: { ef, interval (days), reps, due (ISO date), lapses, seen }

const DAY = 24 * 60 * 60 * 1000;

export const GRADES = [
  { q: 1, label: 'Igen', en: 'Again' },
  { q: 3, label: 'Svårt', en: 'Hard' },
  { q: 4, label: 'Bra', en: 'Good' },
  { q: 5, label: 'Lätt', en: 'Easy' },
];

export function newState() {
  return { ef: 2.5, interval: 0, reps: 0, due: null, lapses: 0, seen: 0 };
}

/** Apply a review with quality q (0–5) and return the new state. */
export function review(state, q, now = new Date()) {
  const s = { ...newState(), ...state };
  s.seen += 1;
  if (q < 3) {
    s.reps = 0;
    s.lapses += 1;
    s.interval = 0;
    s.due = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // see it again in 10 min
  } else {
    s.reps += 1;
    if (s.reps === 1) s.interval = 1;
    else if (s.reps === 2) s.interval = 6;
    else s.interval = Math.round(s.interval * s.ef);
    if (q === 5) s.interval = Math.round(s.interval * 1.3) || 1;
    s.due = new Date(now.getTime() + s.interval * DAY).toISOString();
  }
  s.ef = Math.max(1.3, s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return s;
}

export function isDue(state, now = new Date()) {
  return !state || !state.due || new Date(state.due) <= now;
}

/** 0 = new/unknown … 1 = well known (interval of three weeks or more). */
export function mastery(state) {
  if (!state || !state.seen) return 0;
  if (state.reps === 0) return 0.1;
  return Math.min(1, 0.2 + (state.interval / 21) * 0.8);
}
