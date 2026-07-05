// ── Precise-Location Pin ──
// A pin inside the expanded "Systems online" badge that upgrades the coarse IP
// location to a precise GPS fix — refining the very weather and moon the badge
// is showing, so it reads as an enhancement to that, not a standalone control.
// Tapping it opens a small card that explains and reassures before the browser
// prompt (and reports when the browser has location blocked, where the prompt
// never appears). A standing grant is used silently at load (no pin needed).

import { requestPreciseLocation } from "./geolocate.js";
import { prefersReducedMotion } from "../motion.js";
import {
  showHintTooltip,
  hideHintTooltip,
} from "../achievements/ui/tooltip.js";

const TOOLTIP = "Use precise location";
const PROMPT_TEXT = "Show weather for your exact spot.";
const REASSURE_TEXT = "Used only for the forecast — never saved.";
const BLOCKED_TEXT =
  "Location is blocked. Allow it in your browser's site settings, then tap again.";
const FADE_MS = 240;
// Gap between the card and the pin it points down at.
const ANCHOR_GAP_PX = 10;

// A map-pin, tinted by the badge's glow via currentColor; sized in CSS.
const LOCATION_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
  '<path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3.3 4.5 8.5 4.5 8.5S12.5 9.3 12.5 6A4.5 4.5 0 0 0 8 1.5zm0 6.2A1.7 1.7 0 1 1 8 4.3a1.7 1.7 0 0 1 0 3.4z"/>' +
  "</svg>";

// "granted" | "denied" | "prompt", or null when the Permissions API is
// unavailable (treat as undecided).
async function permissionState() {
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return null;
  }
}

function emitUnlock() {
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type: "precise-location" } }),
  );
}

/**
 * Silent path for a visitor who granted precise location before: use it at load
 * so their sky is accurate immediately, no UI. Resolves to whether the location
 * was upgraded. No achievement — "You Are Here" rewards the deliberate tap, not
 * an automatic reuse of a standing grant.
 */
export async function usePreciseLocationIfGranted(onUpgrade) {
  if ((await permissionState()) !== "granted") return false;
  const ok = await requestPreciseLocation();
  if (ok) onUpgrade?.();
  return ok;
}

// Position the card just above the pin, right-aligned to it (the badge sits in
// the bottom corner, so the card grows up and to the left).
function position(el, anchor) {
  const r = anchor.getBoundingClientRect();
  el.style.left = "auto";
  el.style.right = `${window.innerWidth - r.right}px`;
  el.style.bottom = `${window.innerHeight - r.top + ANCHOR_GAP_PX}px`;
}

// The explanatory card. `onEnable` runs the real request and resolves to whether
// the upgrade succeeded; on failure (including a browser-level block, where no
// prompt shows) the card stays open with a blocked hint so the tap isn't a
// silent no-op. `onClose` fires whenever the card leaves.
function renderPopover(anchor, { onEnable, onClose }) {
  const el = document.createElement("div");
  el.className = "location-prompt";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Precise location");

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "location-prompt-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "×";

  const msg = document.createElement("p");
  msg.className = "location-prompt-msg";
  msg.textContent = PROMPT_TEXT;

  const note = document.createElement("p");
  note.className = "location-prompt-note";
  note.textContent = REASSURE_TEXT;

  const enable = document.createElement("button");
  enable.type = "button";
  enable.className = "location-prompt-enable";
  enable.textContent = "Enable";

  el.append(dismiss, msg, note, enable);
  document.body.appendChild(el);

  position(el, anchor);
  const reposition = () => position(el, anchor);
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, { passive: true });

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition);
    if (prefersReducedMotion()) {
      el.remove();
      return;
    }
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_MS,
      easing: "ease-in",
    });
    anim.onfinish = () => el.remove();
  }

  dismiss.addEventListener("click", () => {
    close();
    onClose?.();
  });
  enable.addEventListener("click", async () => {
    enable.disabled = true;
    if (await onEnable()) {
      close();
      onClose?.();
    } else {
      // Blocked or unavailable — say so, and drop the note (the reassurance is
      // moot now) and the button (retrying needs a browser-settings change).
      msg.textContent = BLOCKED_TEXT;
      note.remove();
      enable.remove();
    }
  });

  if (!prefersReducedMotion()) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: "ease-out",
    });
  }

  return { close };
}

/**
 * Create the pin control. Starts hidden; setVisible(true) reveals it (the badge
 * shows it only while displaying weather). Tapping opens the explanatory card;
 * enabling from there upgrades the location, runs `onUpgrade`, fires the
 * achievement, and retires the pin. Uses the site's hint tooltip on hover, not
 * the browser's native title.
 */
export function createLocationPin({ onUpgrade } = {}) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "location-pin";
  el.setAttribute("aria-label", TOOLTIP);
  el.innerHTML = LOCATION_ICON;
  el.hidden = true;

  let done = false;
  let popover = null;

  function closePopover() {
    popover?.close();
    popover = null;
  }
  function retire() {
    done = true;
    el.hidden = true;
    hideHintTooltip();
    closePopover();
  }

  async function attemptEnable() {
    const ok = await requestPreciseLocation();
    if (ok) {
      onUpgrade?.();
      emitUnlock();
      retire();
    }
    return ok;
  }

  el.addEventListener("mouseenter", () => showHintTooltip(el, TOOLTIP));
  el.addEventListener("mouseleave", hideHintTooltip);
  el.addEventListener("click", (e) => {
    // The badge itself toggles the weather; keep this tap to the pin's job.
    e.stopPropagation();
    hideHintTooltip();
    if (done || popover || !el.isConnected) return;
    popover = renderPopover(el, {
      onEnable: attemptEnable,
      onClose: () => {
        popover = null;
      },
    });
  });

  return {
    el,
    // Show only while it can still act (before a successful grant retires it).
    setVisible(show) {
      if (!done) el.hidden = !show;
    },
    // Drop the pin for good — precise location is already in effect.
    retire,
  };
}
