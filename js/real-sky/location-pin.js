// ── Precise-Location Pin ──
// A pin that lives inside the expanded "Systems online" badge and upgrades the
// coarse IP location to a precise GPS fix — refining the very weather and moon
// the badge is showing, so it reads as an enhancement to that, not a standalone
// control. The browser's permission dialog fires only from a tap on the pin; a
// standing grant is used silently at load (no pin needed then).

import { requestPreciseLocation } from "./geolocate.js";
import {
  showHintTooltip,
  hideHintTooltip,
} from "../achievements/ui/tooltip.js";

const TOOLTIP = "Use precise location";

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

/**
 * Create the pin control. Starts hidden; setVisible(true) reveals it (the badge
 * shows it only while displaying weather). A successful tap upgrades the
 * location, runs `onUpgrade`, fires the achievement, and retires the pin. Uses
 * the site's hint tooltip rather than the browser's native title.
 */
export function createLocationPin({ onUpgrade } = {}) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "location-pin";
  el.setAttribute("aria-label", TOOLTIP);
  el.innerHTML = LOCATION_ICON;
  el.hidden = true;

  let done = false;
  function retire() {
    done = true;
    el.hidden = true;
    hideHintTooltip();
  }

  el.addEventListener("mouseenter", () => showHintTooltip(el, TOOLTIP));
  el.addEventListener("mouseleave", hideHintTooltip);
  el.addEventListener("click", async (e) => {
    // The badge itself toggles the weather; keep this tap to the pin's job.
    e.stopPropagation();
    if (done) return;
    if (await requestPreciseLocation()) {
      onUpgrade?.();
      emitUnlock();
      retire();
    }
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
