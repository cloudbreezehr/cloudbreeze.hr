// ── Word of the Day ──
// One incantation is "in season" each day, the same one for every visitor.
// Derived from the daily key, so there's nothing to store or sync.

import { INCANTATION_WORDS } from "../effects/incantations.js";
import { dayKey, hashString } from "./seed.js";

export function wordOfTheDay(date = new Date()) {
  return INCANTATION_WORDS[hashString(dayKey(date)) % INCANTATION_WORDS.length];
}
