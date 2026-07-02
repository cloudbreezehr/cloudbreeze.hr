// ── Speedrun Mode ──
// Spell SPEEDRUN and a run clock pins itself to the corner: elapsed time,
// a split for each theme set mastered during the run, and the finish when
// every reachable non-milestone achievement is unlocked. Nothing about the
// Cloudlog changes — the mode only *times* it, so the intended play is a
// fresh browser profile racing to 100%. The best finish persists and is
// stamped onto the completion card.

import * as storage from "../achievements/storage.js";
import { SET_MASTERY_MAP, getAchievement } from "../achievements/registry.js";
import {
  resolveProgressCurrent,
  resolveProgressTotal,
} from "../achievements/progress.js";
import { playSfx } from "../audio/sfx.js";

// Clock refresh — a tenth-of-a-second display needs no more than this.
const TICK_MS = 100;
// Storage pref key for the fastest full run.
export const BEST_RUN_PREF = "speedrunBestMs";

// ── Time formatting ──
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const TENTHS_DIVISOR = 100;

/** 754321 → "12:34.3"; hours appear only when reached. */
export function formatRunTime(ms) {
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const tenths = Math.floor((ms % MS_PER_SECOND) / TENTHS_DIVISOR);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const minutes =
    Math.floor(totalSeconds / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
  const hours = Math.floor(
    totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR),
  );
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}.${tenths}` : `${mm}:${ss}.${tenths}`;
}

let hudEl = null;
let clockEl = null;
let splitsEl = null;
let tickTimer = null;
let runStartMs = 0;
let splitsSeen = null;
let finished = false;

function emit(type, data = {}) {
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type, ...data } }),
  );
}

// The finish condition mirrors the completionist achievement: every
// reachable non-milestone unlocked.
function isRunComplete() {
  const total = resolveProgressTotal("non-meta-all");
  return total > 0 && resolveProgressCurrent("non-meta-all") >= total;
}

function buildHud() {
  const hud = document.createElement("div");
  hud.className = "speedrun-hud";
  hud.setAttribute("role", "timer");
  hud.setAttribute("aria-label", "Speedrun clock");

  const title = document.createElement("div");
  title.className = "speedrun-title";
  title.textContent = "any% · every secret";

  clockEl = document.createElement("div");
  clockEl.className = "speedrun-clock";
  clockEl.textContent = formatRunTime(0);

  splitsEl = document.createElement("ul");
  splitsEl.className = "speedrun-splits";

  const best = storage.getPref(BEST_RUN_PREF);
  hud.append(title, clockEl, splitsEl);
  if (typeof best === "number") {
    const pb = document.createElement("div");
    pb.className = "speedrun-best";
    pb.textContent = `pb ${formatRunTime(best)}`;
    hud.appendChild(pb);
  }
  return hud;
}

function addSplit(label, elapsedMs) {
  const li = document.createElement("li");
  li.className = "speedrun-split";
  li.textContent = `${label} — ${formatRunTime(elapsedMs)}`;
  splitsEl.appendChild(li);
}

function tick() {
  const elapsed = Date.now() - runStartMs;
  clockEl.textContent = formatRunTime(elapsed);

  // Splits: each theme set's mastery unlock, once, at the time it landed.
  for (const [setId, masteryId] of Object.entries(SET_MASTERY_MAP)) {
    if (splitsSeen.has(setId)) continue;
    if (storage.isUnlocked(masteryId)) {
      splitsSeen.add(setId);
      addSplit(getAchievement(masteryId)?.title || setId, elapsed);
    }
  }

  if (!finished && isRunComplete()) {
    finished = true;
    hudEl.classList.add("finished");
    addSplit("Every secret", elapsed);
    const best = storage.getPref(BEST_RUN_PREF);
    if (typeof best !== "number" || elapsed < best) {
      storage.setPref(BEST_RUN_PREF, elapsed);
    }
    emit("speedrun-finished", { ms: elapsed });
    playSfx("fanfare", { ui: true });
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

export function isSpeedrunArmed() {
  return hudEl != null;
}

export function armSpeedrun() {
  if (hudEl) return;
  runStartMs = Date.now();
  splitsSeen = new Set();
  finished = false;
  hudEl = buildHud();
  document.body.appendChild(hudEl);
  void hudEl.offsetHeight;
  hudEl.classList.add("visible");
  tickTimer = setInterval(tick, TICK_MS);
  playSfx("uiTick", { ui: true });
  emit("speedrun-armed");
}

export function disarmSpeedrun() {
  if (!hudEl) return;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  hudEl.remove();
  hudEl = null;
  clockEl = null;
  splitsEl = null;
}

export function toggleSpeedrun() {
  if (hudEl) disarmSpeedrun();
  else armSpeedrun();
}

// Test hook — drop the singleton and its timer.
export function _resetForTests() {
  disarmSpeedrun();
}
