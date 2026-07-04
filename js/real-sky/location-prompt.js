// ── Precise-Location Controls ──
// Two non-naggy ways to upgrade the coarse IP location to a precise GPS fix: a
// faint floating button in the corner (always present until precise location is
// active, so changing your mind is a click away), and a one-time explanatory
// popover the button also opens, shown automatically the first time the sky is
// peeked. The browser's permission dialog fires only from an explicit Enable —
// never on its own. A standing grant is used silently at load. The one-time
// flag gates only the auto-popover, never the ability to enable, so the
// "You Are Here" achievement stays reachable for anyone willing, whatever they
// chose before.

import { requestPreciseLocation } from "./geolocate.js";
import { prefersReducedMotion } from "../motion.js";

const OFFER_SHOWN_KEY = "cloudbreeze-location-offer-shown";
const FADE_MS = 240;
// Gap between the card and the button it points down at.
const ANCHOR_GAP_PX = 10;

const PROMPT_TEXT =
  "Weather and sky are set from your network. Enable precise location for your exact spot.";
const BLOCKED_TEXT =
  "Location is blocked. Allow it in your browser settings, then use the button again.";

// A map-pin, tinted by the button's color via currentColor; sized in CSS.
const LOCATION_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
  '<path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3.3 4.5 8.5 4.5 8.5S12.5 9.3 12.5 6A4.5 4.5 0 0 0 8 1.5zm0 6.2A1.7 1.7 0 1 1 8 4.3a1.7 1.7 0 0 1 0 3.4z"/>' +
  "</svg>";

function offerShown() {
  try {
    return window.localStorage.getItem(OFFER_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markOfferShown() {
  try {
    window.localStorage.setItem(OFFER_SHOWN_KEY, "1");
  } catch {
    // ignore — localStorage may be unavailable
  }
}

// "granted" | "denied" | "prompt", or null when the Permissions API is
// unavailable (treat as undecided so the offer can still surface).
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

// Pin the card just above the anchor, right-aligned to it — the button lives in
// the bottom-right corner, so the card grows leftward from that edge.
function position(el, anchor) {
  const r = anchor.getBoundingClientRect();
  el.style.left = "auto";
  el.style.right = `${window.innerWidth - r.right}px`;
  el.style.bottom = `${window.innerHeight - r.top + ANCHOR_GAP_PX}px`;
}

// The explanatory card. `onEnable` runs the real request and resolves to
// whether the upgrade succeeded; on failure the card stays open with a blocked
// hint. `onClose` fires whenever the card leaves (dismiss or successful enable)
// so the caller can drop its handle.
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

  const enable = document.createElement("button");
  enable.type = "button";
  enable.className = "location-prompt-enable";
  enable.textContent = "Enable";

  el.append(dismiss, msg, enable);
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
      msg.textContent = BLOCKED_TEXT;
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
 * Silent path for a visitor who granted precise location on a past visit: use
 * it immediately so their sky is accurate from load, no UI. Resolves to whether
 * the location was upgraded. No achievement here — "You Are Here" rewards the
 * deliberate Enable, not an automatic reuse of a standing grant.
 */
export async function usePreciseLocationIfGranted(onUpgrade) {
  if ((await permissionState()) !== "granted") return false;
  const ok = await requestPreciseLocation();
  if (ok) onUpgrade?.();
  return ok;
}

/**
 * Mount the floating corner button and wire the popover it opens. Returns a
 * handle: offerOnce() shows the popover proactively at most once (skipped when
 * location is already decided), destroy() tears the controls down. On a
 * successful enable the button removes itself, `onUpgrade` runs, and the
 * achievement fires.
 */
export function mountLocationControls({ onUpgrade } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "location-button";
  button.setAttribute("aria-label", "Use precise location");
  button.title = "Use precise location";
  button.innerHTML = LOCATION_ICON;
  document.body.appendChild(button);

  let popover = null;
  let done = false;

  async function attemptEnable() {
    const ok = await requestPreciseLocation();
    if (ok) {
      done = true;
      onUpgrade?.();
      emitUnlock();
      button.remove();
    }
    return ok;
  }

  function openPopover() {
    if (popover || done || !button.isConnected) return;
    popover = renderPopover(button, {
      onEnable: attemptEnable,
      onClose: () => {
        popover = null;
      },
    });
  }

  button.addEventListener("click", openPopover);

  return {
    // Proactive nudge: the popover, at most once ever, and never when location
    // is already decided (a grant is used silently; a denial is respected —
    // the button stays as the quiet way back).
    async offerOnce() {
      if (done || offerShown()) return;
      const state = await permissionState();
      if (state === "granted" || state === "denied") return;
      markOfferShown();
      openPopover();
    },
    destroy() {
      popover?.close();
      popover = null;
      button.remove();
    },
  };
}

// Test hook — clear the auto-offer flag so a follow-up call offers again.
export function _resetForTests() {
  try {
    window.localStorage.removeItem(OFFER_SHOWN_KEY);
  } catch {
    // ignore
  }
}
