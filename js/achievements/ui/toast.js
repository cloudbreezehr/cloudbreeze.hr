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

// ── Toast Constants ──
export const TOAST_SLIDE_IN_MS = 400;
export const TOAST_HOLD_MS = 4000;
export const TOAST_SLIDE_OUT_MS = 300;
export const TOAST_STAGGER_MS = 200;
export const TOAST_MAX_VISIBLE = 3;
const TOAST_RESUME_DELAY_MS = 800;

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

// Panel-facing callbacks injected by the facade.  Kept behind a
// configure function so this module doesn't import its parent and
// risk a circular dependency.  `isPanelOpen` defaults to a no-op so
// early toasts (before configureToasts runs) still open the panel.
let _openPanel = null;
let _isPanelOpen = () => false;
let _scrollToCard = null;
let _scrollToActivityEntryFor = null;
let _setActiveTab = null;
let _panelSlideMs = 0;

export function configureToasts({
  openPanel,
  isPanelOpen,
  scrollToCard,
  scrollToActivityEntryFor,
  setActiveTab,
  panelSlideMs,
} = {}) {
  if (openPanel) _openPanel = openPanel;
  if (isPanelOpen) _isPanelOpen = isPanelOpen;
  if (scrollToCard) _scrollToCard = scrollToCard;
  if (scrollToActivityEntryFor)
    _scrollToActivityEntryFor = scrollToActivityEntryFor;
  if (setActiveTab) _setActiveTab = setActiveTab;
  if (typeof panelSlideMs === "number") _panelSlideMs = panelSlideMs;
}

function ensureToastContainer() {
  if (toastContainer) return;
  toastContainer = document.createElement("div");
  toastContainer.className = "achievement-toast-container";
  document.body.appendChild(toastContainer);

  toastContainer.addEventListener("mouseenter", pauseToasts);
  toastContainer.addEventListener("mouseleave", () => {
    resumeToasts();
    hideHintTooltip();
  });
  toastContainer.addEventListener("mouseover", (e) => {
    const toast = e.target.closest(".achievement-toast");
    if (toast && toast.dataset.hint)
      showHintTooltip(toast, toast.dataset.hint, true);
  });
}

function pauseToasts() {
  toastsPaused = true;
  for (const ref of activeToasts) {
    if (ref.timer) {
      clearTimeout(ref.timer);
      ref.timer = null;
      ref.remaining = Math.max(0, ref.dismissAt - Date.now());
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
    }
  }
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

// Standard click handler for any rendered toast: pulse the toast, then
// open the panel and scroll to the achievement's card.
export function wireToastClick(toast, achievement) {
  toast.addEventListener("click", () => {
    toast.classList.remove("clicked");
    void toast.offsetHeight;
    toast.classList.add("clicked");
    toast.addEventListener(
      "animationend",
      () => toast.classList.remove("clicked"),
      { once: true },
    );

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
  const rarityTier =
    achievement.points >= POINT_TIERS.LEGENDARY
      ? "legendary"
      : achievement.points >= POINT_TIERS.EPIC
        ? "epic"
        : null;
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

  const toastRef = { el: toast, dismissAt: Date.now() + TOAST_HOLD_MS };
  activeToasts.push(toastRef);

  // Auto dismiss (skip timer if queue is paused — resumeToasts will start it)
  if (!toastsPaused) {
    toastRef.timer = setTimeout(() => dismissToast(toastRef), TOAST_HOLD_MS);
  } else {
    toastRef.remaining = TOAST_HOLD_MS;
  }
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

// Routes click → Activity tab + scroll to the matching log entry.
// Re-locks are notification history; the Activity tab is where their
// context lives (timestamp, dismiss/restore actions).
export function wireRelockToastClick(toast, achievement) {
  toast.addEventListener("click", () => {
    function go() {
      if (_setActiveTab) _setActiveTab("activity");
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

  const toastRef = { el: toast, dismissAt: Date.now() + TOAST_HOLD_MS };
  activeToasts.push(toastRef);

  if (!toastsPaused) {
    toastRef.timer = setTimeout(() => dismissToast(toastRef), TOAST_HOLD_MS);
  } else {
    toastRef.remaining = TOAST_HOLD_MS;
  }
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

// ── Activation Pulse Ring ──

export function showActivationPulse(x, y) {
  const ring = document.createElement("div");
  ring.className = "achievement-pulse-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);

  setTimeout(() => ring.remove(), PULSE_RING_MS);
}

// Whether the given event target is inside the live toast container.
// Lets outside-click handlers exempt toast clicks from "click outside"
// dismissal — without this, clicking a toast would close the very
// panel the toast just opened.
export function toastContainerContains(node) {
  return !!(toastContainer && toastContainer.contains(node));
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
}

// Test hook — full reset including injected callbacks.
export function _resetForTests() {
  destroyToastContainer();
  _openPanel = null;
  _isPanelOpen = () => false;
  _scrollToCard = null;
  _scrollToActivityEntryFor = null;
  _setActiveTab = null;
  _panelSlideMs = 0;
}
