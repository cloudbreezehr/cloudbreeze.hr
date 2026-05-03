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
  applyActive(modeId, true, firstDiscovery);
}

function onModeDeactivate(modeId) {
  applyActive(modeId, false, false);
}

// ── DOM ──

function ensureHud() {
  if (hudEl) return;

  hudEl = document.createElement("div");
  hudEl.className = "mode-history-hud collapsed";
  hudEl.style.zIndex = String(Z_MODE_HISTORY_HUD);
  hudEl.setAttribute("aria-label", "Mode history");
  hudEl.setAttribute("role", "group");

  const track = document.createElement("div");
  track.className = "mhh-track";
  hudEl.appendChild(track);

  document.body.appendChild(hudEl);

  hudEl.addEventListener("pointerenter", expand);
  hudEl.addEventListener("pointerleave", scheduleCollapse);
  hudEl.addEventListener("focusin", expand);
  hudEl.addEventListener("focusout", scheduleCollapse);

  rebuildSlots();

  // Slide-in reveal on first appearance
  requestAnimationFrame(() => hudEl.classList.add("ready"));
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

function applyActive(modeId, isActive, firstDiscovery) {
  const slot = slotsByMode.get(modeId);
  if (!slot) return;
  slot.classList.toggle("active", isActive);
  if (isActive && firstDiscovery && !prefersReducedMotion()) {
    slot.classList.add("just-discovered");
    setTimeout(
      () => slot.classList.remove("just-discovered"),
      HUD.NEW_DISCOVERY_HIGHLIGHT_MS,
    );
  }
  if (isActive && !prefersReducedMotion()) {
    slot.classList.add("pulse");
    setTimeout(() => slot.classList.remove("pulse"), HUD.ACTIVE_PULSE_MS);
  }
}

function expand() {
  if (!hudEl) return;
  clearTimeout(collapseTimer);
  hudEl.classList.remove("collapsed");
}

function scheduleCollapse() {
  if (!hudEl) return;
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    hudEl.classList.add("collapsed");
  }, HUD.COLLAPSE_DELAY_MS);
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
