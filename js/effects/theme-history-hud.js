// ── Theme History HUD ──
// Top-of-viewport pill that tracks which themes the visitor has
// discovered.  Appears only after the first discovery (hidden before that
// to avoid spoiling the easter eggs).  Retracted by default; hover or focus
// expands to show labels + activation time.  Clicking a discovered slot
// re-toggles that theme via the theme registry.
//
// Discovered state persists in localStorage so returning visitors keep
// their path visible.  Undiscovered slots show silhouettes only — no
// names, no triggers, no colors — so the HUD hints without spoiling.

import { Z_THEME_HISTORY_HUD } from "../layers.js";
import { defineConstants } from "../dev/registry.js";
import { getThemes, getThemeIds, toggleTheme } from "../themes/registry.js";
import { formatRelativeTime } from "../time-ago.js";
import { reducedDuration } from "../motion.js";

// Placeholder silhouette for undiscovered themes — a generic "???" glyph so
// the HUD hints there's more without spoiling which themes exist or how to
// reach them.  currentColor lets CSS tint it to match the dim slot state.
const UNDISCOVERED_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="5.5"/>' +
  '<path d="M6 7a2 2 0 014 0c0 1-.7 1.3-1.5 1.8-.4.3-.5.5-.5 1.2"/>' +
  '<circle cx="8" cy="12" r="0.5" fill="currentColor"/>' +
  "</svg>";

export const HUD = defineConstants("effects.themeHistoryHud", {
  // ms before the expanded HUD collapses after pointer leave
  COLLAPSE_DELAY_MS: 800,
  // ms a slot pulses after the theme is activated
  ACTIVE_PULSE_MS: 2400,
  // ms a slot shows the "newly discovered" shimmer
  NEW_DISCOVERY_HIGHLIGHT_MS: 10000,
});

export const STORAGE_KEY = "cb_theme_history_v1";

// ── State ──
// Map<themeId, firstActivatedTimestampMs>.  Loaded lazily from storage.
let discovered = loadDiscovered();
let hudEl = null;
let handleEl = null;
let slotsByTheme = new Map();
let collapseTimer = 0;

// ── Public API ──

export function initThemeHistoryHud() {
  // Listen for theme activations — every theme module dispatches this.
  window.addEventListener("achievement", (e) => {
    if (!e.detail) return;
    if (e.detail.type === "theme-activate") onThemeActivate(e.detail.theme);
    if (e.detail.type === "theme-deactivate") onThemeDeactivate(e.detail.theme);
  });

  // If the visitor has already discovered a theme in a past session, build
  // the HUD immediately.  Otherwise wait for the first discovery event.
  if (discovered.size > 0) ensureHud();
}

// ── Discovery tracking ──

function onThemeActivate(themeId) {
  if (!getThemeIds().includes(themeId)) return;

  const firstDiscovery = !discovered.has(themeId);
  if (firstDiscovery) {
    discovered.set(themeId, Date.now());
    saveDiscovered();

    if (discovered.size === 1) {
      // First-ever discovery in this session (or ever).  Announce the HUD.
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "theme-history-reveal" },
        }),
      );
    }
  }

  ensureHud();
  if (firstDiscovery) rebuildSlots();
  syncActiveFromBody();
  pulse(themeId, firstDiscovery);
  updateTucked();
}

function onThemeDeactivate(themeId) {
  syncActiveFromBody();
  updateTucked();
  // themeId reserved for future fine-grained handling (e.g. deactivation-
  // specific pulse); current behavior reads all state from body.classList.
  void themeId;
}

// Read body's theme classes and mirror them to slot .active state.
// Source of truth is body.classList — the same flag rendering reads from —
// so the HUD can never drift out of sync no matter which themes overlap.
function syncActiveFromBody() {
  if (!hudEl) return;
  for (const m of getThemes()) {
    const slot = slotsByTheme.get(m.id);
    if (!slot) continue;
    slot.classList.toggle("active", document.body.classList.contains(m.id));
  }
}

// ── DOM ──

function ensureHud() {
  if (hudEl) return;

  hudEl = document.createElement("div");
  hudEl.className = "theme-history-hud tucked";
  hudEl.style.zIndex = String(Z_THEME_HISTORY_HUD);
  hudEl.setAttribute("aria-label", "Theme history");
  hudEl.setAttribute("role", "group");

  // Single disclosure button at the top-center.  Its label and chevron
  // rotate with state; keeping it as one element means keyboard focus
  // survives across toggles.
  const handleSlot = document.createElement("div");
  handleSlot.className = "thh-handle-slot";
  hudEl.appendChild(handleSlot);

  handleEl = document.createElement("button");
  handleEl.type = "button";
  handleEl.className = "thh-handle";
  handleEl.setAttribute("aria-expanded", "false");
  handleEl.setAttribute("aria-controls", "thh-track");
  handleEl.innerHTML = chevronSvg();
  syncHandleLabel();
  handleSlot.appendChild(handleEl);

  const track = document.createElement("div");
  track.className = "thh-track";
  track.id = "thh-track";
  hudEl.appendChild(track);

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
  hudEl.addEventListener("focusin", onHoverEnter);
  hudEl.addEventListener("focusout", scheduleTuck);
  handleEl.addEventListener("click", () => {
    if (hudEl.classList.contains("tucked")) expandClick();
    else manualTuck();
  });

  rebuildSlots();
  syncActiveFromBody();
  updateTucked();

  // Slide-in reveal on first appearance
  requestAnimationFrame(() => hudEl.classList.add("ready"));
}

// Slot width is sized to the longest label among *discovered* themes.  Unknown
// themes show "???" which is narrower, so the track stays compact until the
// user unlocks a long-named theme — then it grows to accommodate.  +2 ch of
// padding for breathing room around the widest label.
function applySlotWidth() {
  let max = 3; // "???" placeholder width
  for (const m of getThemes()) {
    if (discovered.has(m.id) && m.label.length > max) max = m.label.length;
  }
  hudEl.style.setProperty("--thh-slot-width", `${max + 2}ch`);
}

function rebuildSlots() {
  if (!hudEl) return;
  applySlotWidth();
  const track = hudEl.querySelector(".thh-track");
  track.replaceChildren();
  slotsByTheme = new Map();

  for (const theme of getThemes()) {
    const { id, label, color, icon } = theme;
    const isDiscovered = discovered.has(id);
    const slot = document.createElement(isDiscovered ? "button" : "div");
    slot.className =
      "thh-slot " + (isDiscovered ? "discovered" : "undiscovered");
    if (isDiscovered) {
      slot.type = "button";
      slot.style.setProperty("--theme-color", color);
      slot.dataset.theme = id;
      slot.setAttribute(
        "aria-label",
        `Revisit ${label} theme (discovered ${formatRelativeTime(discovered.get(id))})`,
      );
      // `silent: true` skips the deactivation achievement — leaving a theme
      // from the HUD shouldn't count as discovering the original exit.
      slot.addEventListener("click", () => toggleTheme(id, { silent: true }));
    } else {
      slot.setAttribute("role", "presentation");
      slot.setAttribute("aria-label", "Undiscovered theme");
    }

    const iconWrap = document.createElement("span");
    iconWrap.className = "thh-icon";
    iconWrap.innerHTML = isDiscovered ? icon : UNDISCOVERED_ICON;
    slot.appendChild(iconWrap);

    const labelEl = document.createElement("span");
    labelEl.className = "thh-label";
    labelEl.textContent = isDiscovered ? label : "???";
    slot.appendChild(labelEl);

    // Newly discovered: temporarily mark for extra shimmer
    if (
      isDiscovered &&
      Date.now() - discovered.get(id) < HUD.NEW_DISCOVERY_HIGHLIGHT_MS
    ) {
      slot.classList.add("just-discovered");
      setTimeout(
        () => slot.classList.remove("just-discovered"),
        reducedDuration(HUD.NEW_DISCOVERY_HIGHLIGHT_MS),
      );
    }

    track.appendChild(slot);
    slotsByTheme.set(id, slot);
  }
}

function pulse(themeId, firstDiscovery) {
  const slot = slotsByTheme.get(themeId);
  if (!slot) return;
  if (firstDiscovery) {
    slot.classList.add("just-discovered");
    setTimeout(
      () => slot.classList.remove("just-discovered"),
      reducedDuration(HUD.NEW_DISCOVERY_HIGHLIGHT_MS),
    );
  }
  slot.classList.add("pulse");
  setTimeout(
    () => slot.classList.remove("pulse"),
    reducedDuration(HUD.ACTIVE_PULSE_MS),
  );
}

// Three user intents, tracked as explicit state (clearer than a pile of
// booleans).  "auto" means the HUD reacts to hover/theme-changes; "pinned"
// means the user explicitly chose to keep the HUD open; "tucked" means
// the user explicitly chose to hide it.  Reloads reset to auto.
let userIntent = "auto";

function expandClick() {
  if (!hudEl) return;
  userIntent = "pinned";
  clearTimeout(collapseTimer);
  hudEl.classList.remove("tucked");
  hudEl.classList.add("expanded");
  syncHandleLabel();
}

function manualTuck() {
  if (!hudEl) return;
  userIntent = "tucked";
  clearTimeout(collapseTimer);
  hudEl.classList.remove("expanded");
  hudEl.classList.add("tucked");
  syncHandleLabel();
}

// Hover: only reveal labels if the HUD isn't pinned-open and isn't tucked.
// Transitions in/out of tucked/pinned are click-only — those are commitments,
// not drive-bys.
function onHoverEnter() {
  if (!hudEl) return;
  if (userIntent !== "auto") return;
  if (hudEl.classList.contains("tucked")) return;
  clearTimeout(collapseTimer);
  hudEl.classList.add("expanded");
}

function scheduleTuck() {
  if (!hudEl) return;
  if (userIntent !== "auto") return;
  clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    hudEl.classList.remove("expanded");
    updateTucked();
  }, HUD.COLLAPSE_DELAY_MS);
}

// Computes the tucked class from userIntent + active-theme state.  Called
// after any state change that could affect visibility (theme activate/deact,
// init).  Pinned state ignores this — user's intent takes precedence.
function updateTucked() {
  if (!hudEl) return;
  if (userIntent === "pinned") return;
  if (hudEl.classList.contains("expanded")) return;
  if (userIntent === "tucked") {
    hudEl.classList.add("tucked");
    syncHandleLabel();
    return;
  }
  const anyActive = getThemes().some((m) =>
    document.body.classList.contains(m.id),
  );
  hudEl.classList.toggle("tucked", !anyActive);
  syncHandleLabel();
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

// Single chevron; CSS flips its orientation based on the HUD's tucked state.
function chevronSvg() {
  return (
    '<svg viewBox="0 0 12 6" aria-hidden="true">' +
    '<path d="M1 1l5 4 5-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>"
  );
}

// Reflect the HUD's tucked state onto the disclosure button — aria-label
// and aria-expanded both stay in sync with whatever the visual state is.
function syncHandleLabel() {
  if (!handleEl || !hudEl) return;
  const tucked = hudEl.classList.contains("tucked");
  handleEl.setAttribute(
    "aria-label",
    tucked ? "Expand theme history" : "Tuck theme history",
  );
  handleEl.setAttribute("aria-expanded", tucked ? "false" : "true");
}
