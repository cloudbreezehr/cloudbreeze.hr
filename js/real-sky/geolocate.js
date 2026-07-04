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
