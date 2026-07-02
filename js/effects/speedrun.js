// ── Speedrun Mode ──
// Race the Cloudlog from zero against a clock. Arming is a deliberate act:
// a dialog spells out the rules, then the run backs up the visitor's real
// progress, resets the Cloudlog to empty, and starts the clock. Every
// secret must be rediscovered; the finish is 100% of the reachable
// non-milestone achievements. Stopping — by finishing, by choosing "end
// run", or on the next visit — always restores the backed-up progress
// (merged, so anything re-earned during the run is kept too), so the
// original Cloudlog is never at risk.
//
// The backup is a passport code (see achievements/passport.js) held in the
// prefs bag, which survives the reset; a run therefore also survives a
// reload, resuming the clock from where it left off.

import * as storage from "../achievements/storage.js";
import { SET_MASTERY_MAP, getAchievement } from "../achievements/registry.js";
import {
  resolveProgressCurrent,
  resolveProgressTotal,
} from "../achievements/progress.js";
import { exportPassport, importPassport } from "../achievements/passport.js";
import { trapFocus } from "../achievements/focus-trap.js";
import { playSfx } from "../audio/sfx.js";

// Clock refresh — a tenth-of-a-second display needs no more than this.
const TICK_MS = 100;
// Fallback removal delay — generously past the dialog's CSS fade.
const DIALOG_FADE_MS = 300;

// ── Persisted run state (in the prefs bag) ──
export const BEST_RUN_PREF = "speedrunBestMs";
const BACKUP_PREF = "speedrunBackup";
const STARTED_AT_PREF = "speedrunStartedAt";

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
let endBtnEl = null;
let tickTimer = null;
let runStartMs = 0;
let splitsSeen = null;
let finished = false;
let dialogEl = null;
let dialogEsc = null;
let releaseDialogFocus = null;

function emit(type, data = {}) {
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type, ...data } }),
  );
}

// A bulk write to storage bypasses the tracker's per-unlock callbacks, so
// tell the Cloudlog UI to repaint against the new state.
function announceBulkChange() {
  window.dispatchEvent(new CustomEvent("cloudlog-bulk-change"));
}

// The finish condition mirrors the completionist achievement: every
// reachable non-milestone unlocked.
function isRunComplete() {
  const total = resolveProgressTotal("non-meta-all");
  return total > 0 && resolveProgressCurrent("non-meta-all") >= total;
}

function runActive() {
  return typeof storage.getPref(STARTED_AT_PREF) === "number";
}

// ── HUD ──

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

  endBtnEl = document.createElement("button");
  endBtnEl.className = "speedrun-end";
  endBtnEl.textContent = "End run";
  // Before the finish this offers to end (and restore); once finished the
  // backup is already restored, so it's just a dismiss.
  endBtnEl.addEventListener("click", () =>
    finished ? unmountHud() : requestSpeedrun(),
  );

  hud.append(title, clockEl, splitsEl, endBtnEl);

  const best = storage.getPref(BEST_RUN_PREF);
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

  if (!finished && isRunComplete()) finalizeRun(elapsed);
}

// The run reached 100%. Freeze the clock, bank a personal best, and restore
// the backed-up progress right away so the finished run is reload-safe — but
// leave the HUD up, frozen on the final time, until the visitor closes it.
function finalizeRun(elapsed) {
  finished = true;
  stopClock();
  hudEl.classList.add("finished");
  addSplit("Every secret", elapsed);
  const best = storage.getPref(BEST_RUN_PREF);
  if (typeof best !== "number" || elapsed < best) {
    storage.setPref(BEST_RUN_PREF, elapsed);
  }
  emit("speedrun-finished", { ms: elapsed });
  playSfx("fanfare", { ui: true });
  restoreBackup();
  if (endBtnEl) endBtnEl.textContent = "Close";
}

function stopClock() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

// Build (or rebuild, on resume) the HUD for a run that started at
// `startedAt`. `seedSplits` pre-marks masteries already unlocked so a
// resumed run doesn't stamp them all at the resume time.
function mountHud(startedAt, { seedSplits = false } = {}) {
  runStartMs = startedAt;
  finished = false;
  splitsSeen = new Set();
  if (seedSplits) {
    for (const [setId, masteryId] of Object.entries(SET_MASTERY_MAP)) {
      if (storage.isUnlocked(masteryId)) splitsSeen.add(setId);
    }
  }
  hudEl = buildHud();
  document.body.appendChild(hudEl);
  void hudEl.offsetHeight;
  hudEl.classList.add("visible");
  tickTimer = setInterval(tick, TICK_MS);
  tick();
}

function unmountHud() {
  stopClock();
  if (hudEl) {
    hudEl.remove();
    hudEl = null;
  }
  clockEl = null;
  splitsEl = null;
  endBtnEl = null;
}

// ── Run lifecycle ──

function beginRun() {
  // A lingering finished HUD from a previous run is dismissed first.
  unmountHud();
  // Snapshot the real Cloudlog into the prefs bag (which resetProgress
  // preserves), then wipe to zero. The backup is what makes the reset safe.
  storage.setPref(BACKUP_PREF, exportPassport());
  const startedAt = Date.now();
  storage.setPref(STARTED_AT_PREF, startedAt);
  storage.resetProgress();
  announceBulkChange();

  mountHud(startedAt);
  playSfx("uiTick", { ui: true });
  emit("speedrun-armed");
}

// Merge the backed-up progress back in (keeping anything re-earned during the
// run, by earliest timestamp) and clear the persisted run so it's no longer
// active. Idempotent — a missing backup is a no-op. Does not touch the HUD.
function restoreBackup() {
  const backup = storage.getPref(BACKUP_PREF);
  if (typeof backup === "string") importPassport(backup);
  storage.setPref(BACKUP_PREF, null);
  storage.setPref(STARTED_AT_PREF, null);
  announceBulkChange();
}

// The user chose to stop mid-run: restore and tear the HUD down.
function endRun() {
  restoreBackup();
  unmountHud();
  playSfx("panelClose", { ui: true });
}

// ── Confirm dialogs ──

function buildDialog({ title, body, confirmLabel, cancelLabel, onConfirm }) {
  const overlay = document.createElement("div");
  overlay.className = "speedrun-dialog-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", title);

  const panel = document.createElement("div");
  panel.className = "speedrun-dialog";

  const h = document.createElement("h2");
  h.className = "speedrun-dialog-title";
  h.textContent = title;

  const p = document.createElement("p");
  p.className = "speedrun-dialog-body";
  // Trusted static copy; the rules read as a few short lines.
  p.innerHTML = body;

  const actions = document.createElement("div");
  actions.className = "speedrun-dialog-actions";
  const cancel = document.createElement("button");
  cancel.className = "speedrun-dialog-cancel";
  cancel.textContent = cancelLabel;
  cancel.addEventListener("click", closeDialog);
  const confirm = document.createElement("button");
  confirm.className = "speedrun-dialog-confirm";
  confirm.textContent = confirmLabel;
  confirm.addEventListener("click", () => {
    closeDialog();
    onConfirm();
  });
  actions.append(cancel, confirm);

  panel.append(h, p, actions);
  overlay.appendChild(panel);
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) closeDialog();
  });
  return { overlay, confirm };
}

function openDialog(config) {
  if (dialogEl) return;
  const { overlay, confirm } = buildDialog(config);
  dialogEl = overlay;
  document.body.appendChild(overlay);
  void overlay.offsetHeight;
  overlay.classList.add("visible");
  playSfx("panelOpen", { ui: true });
  releaseDialogFocus = trapFocus(overlay, { initialFocus: confirm });
  dialogEsc = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeDialog();
    }
  };
  document.addEventListener("keydown", dialogEsc);
}

function closeDialog() {
  if (!dialogEl) return;
  const el = dialogEl;
  dialogEl = null;
  if (releaseDialogFocus) {
    releaseDialogFocus();
    releaseDialogFocus = null;
  }
  if (dialogEsc) {
    document.removeEventListener("keydown", dialogEsc);
    dialogEsc = null;
  }
  el.classList.remove("visible");
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), DIALOG_FADE_MS);
}

// ── Public entry ──

/**
 * The user-facing toggle: opens the start dialog when idle, or the
 * end-run dialog when a run is live. Both explain what will happen before
 * anything touches the Cloudlog.
 */
export function requestSpeedrun() {
  if (dialogEl) {
    closeDialog();
    return;
  }
  if (runActive()) {
    openDialog({
      title: "End the run?",
      body:
        "Your original Cloudlog will be restored — plus anything you " +
        "unlocked during the run. Your best time is kept.",
      confirmLabel: "End & restore",
      cancelLabel: "Keep running",
      onConfirm: endRun,
    });
    return;
  }
  openDialog({
    title: "Start a speedrun?",
    body:
      "Race the Cloudlog <strong>from zero</strong>: the clock starts now " +
      "and every secret in the sky must be rediscovered, as fast as you " +
      "can.<br /><br />Your current progress is <strong>safely backed " +
      "up</strong> and restored the moment you finish or stop — nothing " +
      "is lost.",
    confirmLabel: "Start the run",
    cancelLabel: "Not now",
    onConfirm: beginRun,
  });
}

/**
 * Boot hook: if a run was left active (this visit, or a prior one that
 * reloaded), resume it — the clock picks up from the stored start time and
 * the reset Cloudlog is already in place.
 */
export function initSpeedrun() {
  if (hudEl) return;
  const startedAt = storage.getPref(STARTED_AT_PREF);
  if (typeof startedAt === "number") {
    mountHud(startedAt, { seedSplits: true });
  }
}

export function isSpeedrunArmed() {
  return hudEl != null;
}

// Test hook — tear down the HUD, dialog, and timer WITHOUT restoring the
// backup, so a test/HMR teardown can't disturb persisted run state.
export function _resetForTests() {
  unmountHud();
  if (dialogEl) closeDialog();
}
