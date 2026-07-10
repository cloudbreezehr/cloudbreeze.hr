// ── Progressive Achievement Resolvers ──
// Two kinds of progress:
//   Collection — fixed set of items that must be collected (appearances, quadrants).
//     Stored in localStorage via storage.addProgressItem; total = set size.
//   Count — derived numeric tally (unlocks, points, days, set mastery).
//     Computed on demand from storage state; nothing stored per-key.
//
// Both expose the same read API (resolveProgressCurrent / resolveProgressTotal)
// so callers can treat them uniformly.

import * as storage from "./storage.js";
import {
  countCoreBonus,
  getAllNonMeta,
  getReachableAchievements,
  getSetPrereqs,
  sumPoints,
  THEME_SETS,
} from "./registry.js";
import { IDLE_ANIMATION_NAMES } from "../effects/cursor-idle.js";
import { INCANTATION_WORDS } from "../effects/incantations.js";
import { CHEAT_CODES } from "../themes/wanted-cheats.js";
import { COMBO_IDS } from "../themes/alchemy.js";
import { commandNames } from "../terminal/commands.js";

export const APPEARANCES = ["dark", "light", "auto"];
export const QUADRANTS = ["tl", "tr", "bl", "br"];
export const PANEL_TABS = ["achievements", "activity"];

// ── Thresholds for count-based achievements ──
const APPEARANCE_TOGGLES_TOTAL = 3;
const CURIOUS_MIND_TOTAL = 5;
const DEDICATED_TOTAL = 15;
const HUNDRED_POINTS = 100;
const FIVEHUNDRED_POINTS = 500;
const THOUSAND_POINTS = 1000;
const PERSISTENT_DAYS = 3;
const TENACIOUS_DAYS = 7;
const JELLYFISH_PULSES_TOTAL = 5;
const PAPER_STROKES_TOTAL = 10;
// Lifetime-click milestones. Exported so the unlock and the progress bar
// fill to the same threshold — one source for both.
export const COMMITTED_CLICKS = 1000;
export const DEVOTED_CLICKS = 10000;

export const PROGRESS_ITEMS = {
  "idle-animations": () => IDLE_ANIMATION_NAMES,
  "themes-activated": () => THEME_SETS,
  "appearances-used": () => APPEARANCES,
  "almanac-appearances": () => APPEARANCES,
  "panel-tabs-visited": () => PANEL_TABS,
  "quadrants-clicked": () => QUADRANTS,
  "incantations-cast": () => INCANTATION_WORDS,
  "themes-heard": () => THEME_SETS,
  "wanted-cheats-entered": () => CHEAT_CODES,
  "combos-discovered": () => COMBO_IDS,
  "terminal-commands-run": () => commandNames(),
};

// Overachiever mirrors the completion percent's crossing past 100%, in bar
// form: every core slot, then a single extra slot that any bonus (except the
// capstone itself) can fill. The core/bonus split comes from countCoreBonus,
// so the crossing has one definition however it is displayed.
const OVERACHIEVER_ID = "overachiever";

function overachieverCounts() {
  const targets = getReachableAchievements().filter(
    (a) => a.id !== OVERACHIEVER_ID,
  );
  return countCoreBonus(targets, (id) => storage.isUnlocked(id));
}

function countNonMetaUnlocked() {
  const ids = new Set(getAllNonMeta());
  return storage.getUnlocked().filter((u) => ids.has(u.id)).length;
}

function countSetUnlocked(setId) {
  const prereqs = getSetPrereqs(setId);
  return prereqs.filter((id) => storage.isUnlocked(id)).length;
}

function countSessionDays() {
  return (storage.getState().counters.sessionDays || []).length;
}

function countAppearanceToggles() {
  return storage.getCounter("appearanceToggles");
}

function countUnlocks() {
  return storage.getUnlocked().length;
}

function countPoints() {
  return sumPoints(storage.getUnlocked());
}

export const PROGRESS_COUNTS = {
  "appearance-toggles-3": {
    current: countAppearanceToggles,
    total: () => APPEARANCE_TOGGLES_TOTAL,
  },
  "unlocks-5": { current: countUnlocks, total: () => CURIOUS_MIND_TOTAL },
  "unlocks-15": { current: countUnlocks, total: () => DEDICATED_TOTAL },
  "non-meta-half": {
    current: countNonMetaUnlocked,
    total: () => Math.ceil(getAllNonMeta().length / 2),
  },
  "non-meta-all": {
    current: countNonMetaUnlocked,
    total: () => getAllNonMeta().length,
  },
  "beyond-100": {
    current: () => {
      const { coreUnlocked, bonusUnlocked } = overachieverCounts();
      return coreUnlocked + Math.min(bonusUnlocked, 1);
    },
    total: () => overachieverCounts().coreTotal + 1,
  },
  "points-100": { current: countPoints, total: () => HUNDRED_POINTS },
  "points-500": { current: countPoints, total: () => FIVEHUNDRED_POINTS },
  "points-1000": { current: countPoints, total: () => THOUSAND_POINTS },
  "days-3": { current: countSessionDays, total: () => PERSISTENT_DAYS },
  "days-7": { current: countSessionDays, total: () => TENACIOUS_DAYS },
  "jellyfish-pulses": {
    current: () => storage.getCounter("jellyfishPulses"),
    total: () => JELLYFISH_PULSES_TOTAL,
  },
  "paper-strokes": {
    current: () => storage.getCounter("paperStrokes"),
    total: () => PAPER_STROKES_TOTAL,
  },
  "clicks-1000": {
    current: () => storage.getCounter("totalClicks"),
    total: () => COMMITTED_CLICKS,
  },
  "clicks-10000": {
    current: () => storage.getCounter("totalClicks"),
    total: () => DEVOTED_CLICKS,
  },
  "deep-sea-set": {
    current: () => countSetUnlocked("deep-sea"),
    total: () => getSetPrereqs("deep-sea").length,
  },
  "frozen-set": {
    current: () => countSetUnlocked("frozen"),
    total: () => getSetPrereqs("frozen").length,
  },
  "blocky-set": {
    current: () => countSetUnlocked("blocky"),
    total: () => getSetPrereqs("blocky").length,
  },
  "rainy-set": {
    current: () => countSetUnlocked("rainy"),
    total: () => getSetPrereqs("rainy").length,
  },
  "paper-set": {
    current: () => countSetUnlocked("paper"),
    total: () => getSetPrereqs("paper").length,
  },
  "vhs-set": {
    current: () => countSetUnlocked("vhs"),
    total: () => getSetPrereqs("vhs").length,
  },
  "upside-down-set": {
    current: () => countSetUnlocked("upside-down"),
    total: () => getSetPrereqs("upside-down").length,
  },
  "constellation-set": {
    current: () => countSetUnlocked("constellation"),
    total: () => getSetPrereqs("constellation").length,
  },
  "matrix-set": {
    current: () => countSetUnlocked("matrix"),
    total: () => getSetPrereqs("matrix").length,
  },
  "wanted-set": {
    current: () => countSetUnlocked("wanted"),
    total: () => getSetPrereqs("wanted").length,
  },
};

export function isCollectionProgress(progressKey) {
  return progressKey in PROGRESS_ITEMS;
}

export function resolveProgressCurrent(progressKey) {
  if (progressKey in PROGRESS_COUNTS) {
    return PROGRESS_COUNTS[progressKey].current();
  }
  return storage.getProgressItems(progressKey).length;
}

export function resolveProgressTotal(progressKey) {
  if (progressKey in PROGRESS_COUNTS) {
    return PROGRESS_COUNTS[progressKey].total();
  }
  const resolver = PROGRESS_ITEMS[progressKey];
  return resolver ? resolver().length : 0;
}
