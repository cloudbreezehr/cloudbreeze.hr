// ── Visitor Location ──
// A coarse, city-level guess at where the visitor is, so the sky features
// (day phase, moon visibility, live weather) can reflect their location rather
// than the company's home town. Resolved from the request IP by a keyless
// public service: the IP a browser already sends with every request is enough
// for city granularity, so there's no permission prompt, no stored data, and
// nothing to consent to.
//
// Best-effort and non-blocking: the value starts at (and falls back to) the
// home town and upgrades in place once the lookup returns. Readers go through
// currentLocation() rather than capturing a value, so a slow, blocked, or
// failed lookup just leaves the sky pinned to the default.

import { HOME_LOCATION } from "./local.js";

const ENDPOINT = "https://ipwho.is/";
const FETCH_TIMEOUT_MS = 6000;
// A GPS fix can take longer than an IP lookup while the radio warms up, so
// give the browser a longer leash before treating it as a no-answer.
const PRECISE_TIMEOUT_MS = 12000;

// The best location known so far. A getter, not a constant, because it changes
// once (from the home town to the visitor's city) when the lookup lands.
let current = HOME_LOCATION;

export function currentLocation() {
  return current;
}

/**
 * One keyless IP-geolocation request → { latDeg, lonDeg, label }, or null on
 * any failure (offline, blocked, rate-limited, slow, malformed). Pure: reads
 * nothing and stores nothing, so the caller decides what to do with the result.
 */
export async function fetchIpLocation() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const latDeg = data?.latitude;
    const lonDeg = data?.longitude;
    const label = data?.city;
    if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || !label) {
      return null;
    }
    return { latDeg, lonDeg, label };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Kick off the one-shot lookup and, on success, upgrade the shared location in
 * place. Resolves to the location now in effect — the visitor's city, or the
 * unchanged home-town fallback — so a caller may await it when it wants the
 * settled value rather than reading currentLocation() later.
 */
export async function locateVisitor() {
  const found = await fetchIpLocation();
  if (found) current = found;
  return current;
}

/**
 * Ask the browser for a precise fix and, on success, upgrade the shared
 * location in place. This is the only path that can trigger the native
 * permission dialog, so it must be called from a user gesture unless the
 * permission is already granted. Resolves true when the location was upgraded,
 * false on denial, error, timeout, or an unavailable API — the caller keeps the
 * coarse fallback either way. The coarse city label is retained: naming the
 * precise point would need another network round-trip, and the visitor knows
 * where they are.
 */
export function requestPreciseLocation() {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latDeg = pos?.coords?.latitude;
        const lonDeg = pos?.coords?.longitude;
        if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) {
          resolve(false);
          return;
        }
        current = { latDeg, lonDeg, label: current.label };
        resolve(true);
      },
      () => resolve(false),
      { timeout: PRECISE_TIMEOUT_MS, maximumAge: 0, enableHighAccuracy: true },
    );
  });
}
