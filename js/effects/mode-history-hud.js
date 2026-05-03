// ── Mode History HUD ──
// Top-of-viewport pill that tracks which sub-modes the visitor has
// discovered.  Appears only after the first discovery (hidden before that
// to avoid spoiling the easter eggs).  Retracted by default; hover or focus
// expands to show labels + activation time.  Clicking a discovered slot
// re-toggles that mode via the mode registry.
//
// Discovered state persists in localStorage so returning visitors keep
// their path visible.  Undiscovered slots show silhouettes only — no
// names, no triggers, no colors — so the HUD hints without spoiling.

import { Z_MODE_HISTORY_HUD } from "../layers.js";
import { defineConstants } from "../dev/registry.js";
import { prefersReducedMotion } from "../motion.js";
import {
  SUBMODE_IDS,
  SUBMODE_LABELS,
  SUBMODE_COLORS,
  toggleMode,
} from "../modes/registry.js";
import { modeIcon, undiscoveredIcon } from "../modes/icons.js";

const HUD = defineConstants("effects.modeHistoryHud", {
  // ms before the expanded HUD collapses after pointer leave
  COLLAPSE_DELAY_MS: 800,
  // ms a slot pulses after the mode is activated
  ACTIVE_PULSE_MS: 2400,
  // ms a slot shows the "newly discovered" shimmer
  NEW_DISCOVERY_HIGHLIGHT_MS: 10000,
});

const STORAGE_KEY = "cb_mode_history_v1";

// ── State ──
// Map<modeId, firstActivatedTimestampMs>.  Loaded lazily from storage.
let discovered = loadDiscovered();
let hudEl = null;
let slotsByMode = new Map();
let collapseTimer = 0;

// ── Public API ──

export function initModeHistoryHud() {
  // Listen for mode activations — every mode module dispatches this.
  window.addEventListener("achievement", (e) => {
    if (!e.detail) return;
    if (e.detail.type === "mode-activate") onModeActivate(e.detail.mode);
    if (e.detail.type === "mode-deactivate") onModeDeactivate(e.detail.mode);
  });

  // If the visitor has already discovered a mode in a past session, build
  // the HUD immediately.  Otherwise wait for the first discovery event.
  if (discovered.size > 0) ensureHud();
}

// ── Discovery tracking ──

function onModeActivate(modeId) {
  if (!SUBMODE_IDS.includes(modeId)) return;

  const firstDiscovery = !discovered.has(modeId);
  if (firstDiscovery) {
    discovered.set(modeId, Date.now());
    saveDiscovered();

    if (discovered.size === 1) {
      // First-ever discovery in this session (or ever).  Announce the HUD.
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "mode-history-reveal" },
        }),
      );
    }
  }

  ensureHud();
  if (firstDiscovery) rebuildSlots();
  syncActiveFromBody();
  pulse(modeId, firstDiscovery);
  updateTucked();
}

function onModeDeactivate(modeId) {
  syncActiveFromBody();
  updateTucked();
  // modeId reserved for future fine-grained handling (e.g. deactivation-
  // specific pulse); current behavior reads all state from body.classList.
  void modeId;
}

// Read body's sub-mode classes and mirror them to slot .active state.
// Source of truth is body.classList — the same flag rendering reads from —
// so the HUD can never drift out of sync no matter which modes overlap.
function syncActiveFromBody() {
  if (!hudEl) return;
  for (const id of SUBMODE_IDS) {
    const slot = slotsByMode.get(id);
    if (!slot) continue;
    slot.classList.toggle("active", document.body.classList.contains(id));
  }
}

// ── DOM ──

function ensureHud() {
  if (hudEl) return;

  hudEl = document.createElement("div");
  hudEl.className = "mode-history-hud tucked";
  hudEl.style.zIndex = String(Z_MODE_HISTORY_HUD);
  hudEl.setAttribute("aria-label", "Mode history");
  hudEl.setAttribute("role", "group");

  // Down-chevron handle — visible when tucked.  Click to expand.
  const expandHandle = document.createElement("button");
  expandHandle.type = "button";
  expandHandle.className = "mhh-handle mhh-handle-expand";
  expandHandle.setAttribute("aria-label", "Expand mode history");
  expandHandle.innerHTML = chevronSvg("down");
  hudEl.appendChild(expandHandle);

  const track = document.createElement("div");
  track.className = "mhh-track";
  hudEl.appendChild(track);

  // Up-chevron handle — visible when expanded.  Click to tuck even if a mode
  // is active.  The manual-tuck state lives in memory; a reload re-reveals
  // the HUD so its discoverability isn't lost between sessions.
  const tuckHandle = document.createElement("button");
  tuckHandle.type = "button";
  tuckHandle.className = "mhh-handle mhh-handle-tuck";
  tuckHandle.setAttribute("aria-label", "Tuck mode history");
  tuckHandle.innerHTML = chevronSvg("up");
  hudEl.appendChild(tuckHandle);

  // Parent to the nav so the HUD sticks to its bottom edge — when the nav
  // scrolls up/down during overscroll, the HUD rides along.  Falls back to
  // body if nav isn't found.
  const navEl = document.querySelector("nav");
  (navEl || document.body).appendChild(hudEl);

  // Hover reveals labels while the HUD is already visible (compact state).
  // Tuck ↔ expand transitions are click-only — those are commitments, not
  // drive-bys.  Focus also expands for keyboard users.
  hudEl.addEventListener("pointerenter", onHoverEnter);
  hudEl.addEventListener("pointerleave", scheduleTuck);
  hudEl.addEventListener("focusin", expand);
  hudEl.addEventListener("focusout", scheduleTuck);
  expandHandle.addEventListener("click", expand);
  tuckHandle.addEventListener("click", manualTuck);

  // Size slots consistently by the longest label so layout is stable.
  hudEl.style.setProperty("--mhh-slot-width", `${longestLabelCh()}ch`);

  rebuildSlots();
  syncActiveFromBody();
  updateTucked();

  // Slide-in reveal on first appearance
  requestAnimationFrame(() => hudEl.classList.add("ready"));
}

// Measure the longest label in character units — no hardcoded width, grows
// automatically when a new mode with a longer name is registered.
function longestLabelCh() {
  let max = 0;
  for (const id of SUBMODE_IDS) {
    const len = (SUBMODE_LABELS[id] || id).length;
    if (len > max) max = len;
  }
  // +1 ch padding so ascenders/descenders aren't flush against slot edges.
  return max + 1;
}

function rebuildSlots() {
  if (!hudEl) return;
  const track = hudEl.querySelector(".mhh-track");
  track.replaceChildren();
  slotsByMode = new Map();

  for (const id of SUBMODE_IDS) {
    const isDiscovered = discovered.has(id);
    const slot = document.createElement(isDiscovered ? "button" : "div");
    slot.className =
      "mhh-slot " + (isDiscovered ? "discovered" : "undiscovered");
    if (isDiscovered) {
      slot.type = "button";
      slot.style.setProperty("--mode-color", SUBMODE_COLORS[id]);
      slot.dataset.mode = id;
      slot.setAttribute(
        "aria-label",
        `Revisit ${SUBMODE_LABELS[id]} mode (discovered ${formatRelative(discovered.get(id))})`,
      );
      slot.addEventListener("click", () => toggleMode(id));
    } else {
      slot.setAttribute("role", "presentation");
      slot.setAttribute("aria-label", "Undiscovered mode");
    }

    const iconWrap = document.createElement("span");
    iconWrap.className = "mhh-icon";
    iconWrap.innerHTML = isDiscovered ? modeIcon(id) : undiscoveredIcon();
    slot.appendChild(iconWrap);

    const label = document.createElement("span");
    label.className = "mhh-label";
    label.textContent = isDiscovered ? SUBMODE_LABELS[id] : "???";
    slot.appendChild(label);

    // Newly discovered: temporarily mark for extra shimmer
    if (
      isDiscovered &&
      Date.now() - discovered.get(id) < HUD.NEW_DISCOVERY_HIGHLIGHT_MS
    ) {
      slot.classList.add("just-discovered");
      setTimeout(
        () => slot.classList.remove("just-discovered"),
        HUD.NEW_DISCOVERY_HIGHLIGHT_MS,
      );
    }

    track.appendChild(slot);
    slotsByMode.set(id, slot);
  }
}

function pulse(modeId, firstDiscovery) {
  if (prefersReducedMotion()) return;
  const slot = slotsByMode.get(modeId);
  if (!slot) return;
  if (firstDiscovery) {
    slot.classList.add("just-discovered");
    setTimeout(
      () => slot.classList.remove("just-discovered"),
      HUD.NEW_DISCOVERY_HIGHLIGHT_MS,
    );
  }
  slot.classList.add("pulse");
  setTimeout(() => slot.classList.remove("pulse"), HUD.ACTIVE_PULSE_MS);
}

// User manually tucked via the up-chevron.  Overrides the "active mode keeps
// HUD visible" rule.  In-memory only — a page reload restores discoverability.
let userTucked = false;

function expand() {
  if (!hudEl) return;
  userTucked = false;
  clearTimeout(collapseTimer);
  hudEl.classList.remove("tucked");
  hudEl.classList.add("expanded");
}

// Pointer enter: only reveal labels if the HUD is already visible.  Hovering
// the tiny tucked chevron shouldn't silently slide the full HUD open —
// expanding from tucked is a click action.
function onHoverEnter() {
  if (!hudEl || hudEl.classList.contains("tucked")) return;
  expand();
}

function manualTuck() {
  if (!hudEl) return;
  userTucked = true;
  clearTimeout(collapseTimer);
  hudEl.classList.remove("expanded");
  hudEl.classList.add("tucked");
}

function scheduleTuck() {
  if (!hudEl) return;
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    hudEl.classList.remove("expanded");
    updateTucked();
  }, HUD.COLLAPSE_DELAY_MS);
}

// Tucked iff:
//   - the user has manually tucked it, OR
//   - no mode is currently active.
// An active mode keeps the HUD in compact-visible state until manually tucked.
function updateTucked() {
  if (!hudEl) return;
  if (hudEl.classList.contains("expanded")) return;
  if (userTucked) {
    hudEl.classList.add("tucked");
    return;
  }
  const anyActive = SUBMODE_IDS.some((id) =>
    document.body.classList.contains(id),
  );
  hudEl.classList.toggle("tucked", !anyActive);
}

// ── Persistence ──

function loadDiscovered() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveDiscovered() {
  try {
    const obj = Object.fromEntries(discovered);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // localStorage full or unavailable — silently continue
  }
}

// ── Helpers ──

function chevronSvg(direction) {
  const path = direction === "up" ? "M1 5l5-4 5 4" : "M1 1l5 4 5-4";
  return (
    '<svg viewBox="0 0 12 6" aria-hidden="true">' +
    `<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
    "</svg>"
  );
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
