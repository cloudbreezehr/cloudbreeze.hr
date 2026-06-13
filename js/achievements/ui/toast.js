// ── Achievement Toasts ──
// Slide-in notifications for unlock/re-lock, plus the activation
// ribbon and pulse ring shown when the Cloudlog is first enabled.
// Shares one container and a small queue so overlapping unlocks
// stagger cleanly.  buildAchievementToast is exported as the canonical
// toast renderer so persisted entries render identically to live ones.

import { POINT_TIERS, SETS } from "../registry.js";
import { resolveProgressCurrent, resolveProgressTotal } from "../progress.js";
import { announce } from "../announcer.js";
import {
  burstFireworks,
  launchRocketFireworks,
  rocketCountForTier,
} from "../../effects/fireworks.js";
import { showHintTooltip, hideHintTooltip } from "./tooltip.js";
import { CLOUD_CHECK_SVG, CLOUD_LOCK_SVG } from "./icons.js";
import { bindClickable } from "../../clickable.js";

// ── Toast Constants ──
export const TOAST_SLIDE_IN_MS = 400;
export const TOAST_HOLD_MS = 4000;
export const TOAST_SLIDE_OUT_MS = 300;
export const TOAST_STAGGER_MS = 200;
export const TOAST_MAX_VISIBLE = 3;
export const TOAST_RESUME_DELAY_MS = 800;

// ── Progress Bar ──
const PROGRESS_FULL = 1;
const PROGRESS_EMPTY = 0;

// ── Fireworks ──
// Delay the fireworks burst until the toast has finished sliding in
// so the particles anchor to the toast's final on-screen rect.
const FIREWORKS_DELAY_MS = TOAST_SLIDE_IN_MS;

// ── Activation callout ──
const ACTIVATION_TOAST_MS = 3000;
const ACTIVATION_FADE_MS = 400;
const PULSE_RING_MS = 800;

// ── State ──
let toastContainer = null;
let toastQueue = [];
let activeToasts = [];
let toastsPaused = false;
let queueCounterEl = null;
// Hover and keyboard-focus are independent pause sources — the timer
// only resumes when *both* are inactive.
let hoverActive = false;
let focusActive = false;

// Panel-facing callbacks injected by the facade.  Kept behind a
// configure function so this module doesn't import its parent and
// risk a circular dependency.  `isPanelOpen` defaults to a no-op so
// early toasts (before configureToasts runs) still open the panel.
let _openPanel = null;
let _isPanelOpen = () => false;
let _scrollToCard = null;
let _scrollToActivityEntryFor = null;
let _panelSlideMs = 0;

export function configureToasts({
  openPanel,
  isPanelOpen,
  scrollToCard,
  scrollToActivityEntryFor,
  panelSlideMs,
} = {}) {
  if (openPanel) _openPanel = openPanel;
  if (isPanelOpen) _isPanelOpen = isPanelOpen;
  if (scrollToCard) _scrollToCard = scrollToCard;
  if (scrollToActivityEntryFor)
    _scrollToActivityEntryFor = scrollToActivityEntryFor;
  if (typeof panelSlideMs === "number") _panelSlideMs = panelSlideMs;
}

function ensureToastContainer() {
  if (toastContainer) return;
  toastContainer = document.createElement("div");
  toastContainer.className = "achievement-toast-container";
  document.body.appendChild(toastContainer);

  toastContainer.addEventListener("mouseenter", () => {
    hoverActive = true;
    reconcilePauseState();
  });
  toastContainer.addEventListener("mouseleave", () => {
    hoverActive = false;
    reconcilePauseState();
    hideHintTooltip();
  });
  toastContainer.addEventListener("focusin", () => {
    focusActive = true;
    reconcilePauseState();
  });
  toastContainer.addEventListener("focusout", (e) => {
    // focusout fires for child-to-child transitions too; only react
    // when focus has actually left the container.
    if (e.relatedTarget && toastContainer.contains(e.relatedTarget)) return;
    focusActive = false;
    reconcilePauseState();
  });
  toastContainer.addEventListener("mouseover", (e) => {
    const toast = e.target.closest(".achievement-toast");
    if (toast && toast.dataset.hint)
      showHintTooltip(toast, toast.dataset.hint, true);
  });
}

function reconcilePauseState() {
  const shouldPause = hoverActive || focusActive;
  if (shouldPause && !toastsPaused) pauseToasts();
  else if (!shouldPause && toastsPaused) resumeToasts();
}

function pauseToasts() {
  toastsPaused = true;
  for (const ref of activeToasts) {
    if (ref.timer) {
      clearTimeout(ref.timer);
      ref.timer = null;
      ref.remaining = Math.max(0, ref.dismissAt - Date.now());
      freezeProgressBar(ref);
    }
  }
}

function resumeToasts() {
  toastsPaused = false;
  for (const ref of activeToasts) {
    if (ref.remaining != null) {
      const delay = Math.max(ref.remaining, TOAST_RESUME_DELAY_MS);
      ref.dismissAt = Date.now() + delay;
      ref.timer = setTimeout(() => dismissToast(ref), delay);
      ref.remaining = null;
      const fromScale =
        ref.progressFrozen != null ? ref.progressFrozen : PROGRESS_FULL;
      startProgressDrain(ref, delay, fromScale);
    }
  }
}

// Surfaces hidden queue depth.  Lazily created on overflow; removed
// when the queue empties.  Visual anchoring at the top of the stack
// is handled by CSS `order` — DOM position is irrelevant.
function updateQueueCounter() {
  if (!toastContainer) return;
  if (toastQueue.length === 0) {
    if (queueCounterEl) {
      queueCounterEl.remove();
      queueCounterEl = null;
    }
    return;
  }
  if (!queueCounterEl) {
    queueCounterEl = document.createElement("div");
    queueCounterEl.className = "achievement-toast-queue-counter";
    toastContainer.appendChild(queueCounterEl);
  }
  queueCounterEl.textContent = `+${toastQueue.length} more`;
}

function appendProgressBar(toast) {
  const track = document.createElement("div");
  track.className = "achievement-toast-progress";
  const fill = document.createElement("div");
  fill.className = "achievement-toast-progress-fill";
  track.appendChild(fill);
  toast.appendChild(track);
  return fill;
}

// Current scale = remaining proportion of the active drain.  Returns
// the frozen value while paused, and the live interpolation otherwise.
function currentProgressScale(ref) {
  if (ref.progressFrozen != null) return ref.progressFrozen;
  if (ref.progressStart == null) return PROGRESS_FULL;
  const elapsed = Date.now() - ref.progressStart;
  return (
    ref.progressFrom *
    Math.max(PROGRESS_EMPTY, PROGRESS_FULL - elapsed / ref.progressDuration)
  );
}

// Two-stage paint forces a layout flush so the starting scale is
// committed before the transition rule changes.
function startProgressDrain(ref, durationMs, fromScale = PROGRESS_FULL) {
  ref.progressFrom = fromScale;
  ref.progressStart = Date.now();
  ref.progressDuration = durationMs;
  ref.progressFrozen = null;
  const fill = ref.progressFill;
  if (!fill) return;
  fill.style.transition = "none";
  fill.style.transform = `scaleX(${fromScale})`;
  void fill.offsetHeight;
  fill.style.transition = `transform ${durationMs}ms linear`;
  fill.style.transform = `scaleX(${PROGRESS_EMPTY})`;
}

// Freeze the bar at its currently-interpolated scale.  Records the
// scale on the ref so resume can pick the drain up from the same point.
function freezeProgressBar(ref) {
  const scale = currentProgressScale(ref);
  ref.progressFrozen = scale;
  const fill = ref.progressFill;
  if (!fill) return;
  fill.style.transition = "none";
  fill.style.transform = `scaleX(${scale})`;
}

// Single source of truth for the rarity-from-points mapping.  Fireworks
// and toast click-pulse both consult this so a tier change lands in one
// place.
export function rarityTierFor(points) {
  if (points >= POINT_TIERS.LEGENDARY) return "legendary";
  if (points >= POINT_TIERS.EPIC) return "epic";
  return null;
}

// Build the achievement-toast DOM for a given achievement.  Canonical
// toast renderer — persisted entries use this so they render identically
// to the originating live toast.  Returns the element without attaching
// any click handler — callers decide whether the toast is clickable and
// what clicking does.
export function buildAchievementToast(achievement) {
  const set = SETS.find((s) => s.id === achievement.set);
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  if (set && set.color) {
    toast.style.setProperty("--toast-accent", set.color);
  }
  const rarity = rarityTierFor(achievement.points);
  if (rarity) toast.dataset.rarity = rarity;

  toast.innerHTML = `
    <div class="achievement-toast-icon">${CLOUD_CHECK_SVG}</div>
    <div class="achievement-toast-body">
      <div class="achievement-toast-title">${achievement.title}</div>
      <div class="achievement-toast-desc">${achievement.description}</div>
    </div>
    <div class="achievement-toast-pts">${achievement.points}</div>
  `;

  if (achievement.hint) toast.dataset.hint = achievement.hint;
  return toast;
}

// Standard click handler for any rendered toast: pulse on press-down
// for a physical-button feel, then open the panel and scroll to the
// achievement's card on the full click.
export function wireToastClick(toast, achievement) {
  // Pulse fires on pointerdown so the toast visually depresses the
  // moment the user presses — no wait for the release event.
  toast.addEventListener("pointerdown", () => {
    toast.classList.remove("clicked");
    void toast.offsetHeight;
    toast.classList.add("clicked");
    toast.addEventListener("animationend", () => toast.classList.remove("clicked"), {
      once: true,
    });
  });

  // Navigation fires on the full click so a drag (pointerdown without
  // pointerup at the same position) doesn't route to the panel.
  bindClickable(toast, () => {
    if (!_isPanelOpen()) {
      if (_openPanel) _openPanel();
      setTimeout(() => {
        if (_scrollToCard) _scrollToCard(achievement.id);
      }, _panelSlideMs);
    } else if (_scrollToCard) {
      _scrollToCard(achievement.id);
    }
  });
}

export function showToast(achievement) {
  ensureToastContainer();

  if (activeToasts.length >= TOAST_MAX_VISIBLE) {
    toastQueue.push(achievement);
    updateQueueCounter();
    return;
  }

  const set = SETS.find((s) => s.id === achievement.set);
  const toast = buildAchievementToast(achievement);
  wireToastClick(toast, achievement);

  toastContainer.appendChild(toast);

  // Slide in
  void toast.offsetHeight;
  toast.classList.add("enter");

  // Fireworks burst around the toast after slide-in completes.  Epic+ and
  // legendary achievements also launch rockets from the bottom of the viewport
  // — these rise for ~1s and detonate mid-air shortly after the toast burst.
  const accentColor = (set && set.color) || null;
  const rarityTier = rarityTierFor(achievement.points);
  setTimeout(() => {
    if (!toast.parentNode) return;
    const rect = toast.getBoundingClientRect();
    burstFireworks(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      color: accentColor,
    });
    if (rarityTier) {
      launchRocketFireworks({
        count: rocketCountForTier(rarityTier),
        color: accentColor,
      });
    }
  }, FIREWORKS_DELAY_MS);

  registerToast(toast);
}

// Build the active-toast ref, wire it into the queue, and either start
// the drain or stash a frozen-at-full state for resumeToasts to pick up.
function registerToast(toast) {
  const ref = {
    el: toast,
    dismissAt: Date.now() + TOAST_HOLD_MS,
    progressFill: appendProgressBar(toast),
  };
  activeToasts.push(ref);

  if (!toastsPaused) {
    ref.timer = setTimeout(() => dismissToast(ref), TOAST_HOLD_MS);
    startProgressDrain(ref, TOAST_HOLD_MS);
  } else {
    ref.remaining = TOAST_HOLD_MS;
    ref.progressFrozen = PROGRESS_FULL;
  }
  return ref;
}

function dismissToast(toastRef) {
  if (!toastRef.el) return;
  toastRef.el.classList.remove("enter");
  toastRef.el.classList.add("exit");

  setTimeout(() => {
    if (toastRef.el && toastRef.el.parentNode) {
      toastRef.el.remove();
    }
    const idx = activeToasts.indexOf(toastRef);
    if (idx !== -1) activeToasts.splice(idx, 1);

    // Process queue
    if (toastQueue.length > 0 && activeToasts.length < TOAST_MAX_VISIBLE) {
      const next = toastQueue.shift();
      updateQueueCounter();
      setTimeout(() => showToast(next), TOAST_STAGGER_MS);
    }
  }, TOAST_SLIDE_OUT_MS);
}

// ── Re-lock Toast ──

// Canonical re-lock-toast renderer.  Persisted entries use this so they
// render identically to the originating live toast.
export function buildRelockToast(achievement) {
  const set = SETS.find((s) => s.id === achievement.set);
  const toast = document.createElement("div");
  toast.className = "achievement-toast achievement-toast-relock";
  if (set && set.color) {
    toast.style.setProperty("--toast-accent", set.color);
  }

  const total = achievement.progressKey
    ? resolveProgressTotal(achievement.progressKey)
    : 0;
  const collected = achievement.progressKey
    ? Math.min(resolveProgressCurrent(achievement.progressKey), total)
    : 0;
  const progressHint = total > 0 ? ` (${collected}/${total})` : "";

  toast.innerHTML = `
    <div class="achievement-toast-icon achievement-toast-relock-icon">${CLOUD_LOCK_SVG}</div>
    <div class="achievement-toast-body">
      <div class="achievement-toast-title">Re-locked: ${achievement.title}</div>
      <div class="achievement-toast-desc">New content added${progressHint}</div>
    </div>
  `;

  return toast;
}

// Routes click → matching Activity-log entry.  Re-locks are
// notification history; the Activity tab is where their context lives
// (timestamp, dismiss/restore actions).  The activity-scroll target
// owns the tab switch itself, so this only has to delegate.
export function wireRelockToastClick(toast, achievement) {
  bindClickable(toast, () => {
    function go() {
      if (_scrollToActivityEntryFor)
        _scrollToActivityEntryFor(achievement.id, "achievement-relocked");
    }
    if (!_isPanelOpen()) {
      if (_openPanel) _openPanel();
      setTimeout(go, _panelSlideMs);
    } else {
      go();
    }
  });
}

export function showRelockToast(achievement) {
  ensureToastContainer();

  const toast = buildRelockToast(achievement);
  wireRelockToastClick(toast, achievement);

  toastContainer.appendChild(toast);
  void toast.offsetHeight;
  toast.classList.add("enter");

  registerToast(toast);
}

// ── Activation Toast ──

export function showActivationToast(message) {
  announce(message);
  const toast = document.createElement("div");
  toast.className = "achievement-activation-toast";
  toast.innerHTML = `
    <div class="achievement-activation-icon">${CLOUD_CHECK_SVG}</div>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  void toast.offsetHeight;
  toast.classList.add("visible");

  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), ACTIVATION_FADE_MS);
  }, ACTIVATION_TOAST_MS);
}

// ── First-unlock celebration ──
// A one-time rocket volley for a visitor's very first unlock, marking
// the "oh, this site does something" moment regardless of the
// achievement's tier.  Skipped under reduced motion by the fireworks
// module's own gate.
const FIRST_UNLOCK_ROCKETS = 3;

export function celebrateFirstUnlock() {
  launchRocketFireworks({ count: FIRST_UNLOCK_ROCKETS });
}

// ── Undo Toast ──
// Confirmation + reversal for a just-performed action.  Auto-dismisses
// like the activation toast, but carries an "Undo" button that fires the
// supplied callback and clears the toast immediately.
const UNDO_TOAST_MS = 5000;

export function showUndoToast(message, onUndo) {
  announce(message);
  // Replace any existing undo toast so rapid dismissals don't stack.
  const prior = document.querySelector(".achievement-undo-toast");
  if (prior) prior.remove();

  const toast = document.createElement("div");
  toast.className = "achievement-undo-toast";
  const label = document.createElement("span");
  label.textContent = message;
  const btn = document.createElement("button");
  btn.className = "achievement-undo-btn";
  btn.textContent = "Undo";
  toast.appendChild(label);
  toast.appendChild(btn);
  document.body.appendChild(toast);

  let dismissTimer = null;
  function dismiss() {
    if (dismissTimer) clearTimeout(dismissTimer);
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), ACTIVATION_FADE_MS);
  }
  btn.addEventListener("click", () => {
    if (onUndo) onUndo();
    dismiss();
  });

  void toast.offsetHeight;
  toast.classList.add("visible");
  dismissTimer = setTimeout(dismiss, UNDO_TOAST_MS);
}

// ── Activation Pulse Ring ──

export function showActivationPulse(x, y) {
  const ring = document.createElement("div");
  ring.className = "achievement-pulse-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);

  setTimeout(() => ring.remove(), PULSE_RING_MS);
}

// Drop the container and any queued/active toasts.  Use during full UI
// teardown so no DOM or pending timers are left behind.
export function destroyToastContainer() {
  for (const ref of activeToasts) {
    if (ref.timer) clearTimeout(ref.timer);
  }
  if (toastContainer && toastContainer.parentNode) toastContainer.remove();
  toastContainer = null;
  toastQueue = [];
  activeToasts = [];
  toastsPaused = false;
  queueCounterEl = null;
  hoverActive = false;
  focusActive = false;
}

// Test hook — full reset including injected callbacks.
export function _resetForTests() {
  destroyToastContainer();
  _openPanel = null;
  _isPanelOpen = () => false;
  _scrollToCard = null;
  _scrollToActivityEntryFor = null;
  _panelSlideMs = 0;
}
