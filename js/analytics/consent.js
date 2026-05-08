// ── Analytics Consent ──
// No cookies, no banner.  Sending is blocked when the browser signals DNT
// or the user has explicitly opted out via localStorage.  Consent is
// evaluated lazily so a late-flipped opt-out takes effect on the next
// track() call without reloading.

import { KEYS, localGet, localSet, localRemove } from "./storage.js";

function dntEnabled() {
  const v =
    (typeof navigator !== "undefined" && navigator.doNotTrack) ||
    (typeof window !== "undefined" && window.doNotTrack);
  return v === "1" || v === "yes";
}

export function isOptedOut() {
  return localGet(KEYS.OPT_OUT) === "1";
}

export function optOut() {
  localSet(KEYS.OPT_OUT, "1");
}

export function optIn() {
  localRemove(KEYS.OPT_OUT);
}

export function allowed() {
  if (dntEnabled()) return false;
  if (isOptedOut()) return false;
  return true;
}
