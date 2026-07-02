// ── Local Sky Estimate ──
// The real-sky layer needs the *visitor's* sun, but a static page has no
// geolocation (and shouldn't ask for it just to tint a canvas). The honest
// approximation: longitude from the clock's UTC offset — solar time is what
// drives day/night, and the offset tracks it to within a timezone's width —
// and a reference location's latitude as a stand-in, which only softens the
// seasonal day-length swing, never flips day for night.
//
// The reference location is a parameter (default: the company's home town), so
// a real visitor location can be plugged in later without touching this math.

import { dayPhase } from "./astro.js";

// Pula, Croatia — the company's home town, and the default reference location
// for the real-sky features. Pass a different { latDeg, lonDeg, label } to
// retarget them (e.g. the visitor's own location).
export const HOME_LOCATION = {
  latDeg: 44.8666,
  lonDeg: 13.8496,
  label: "Pula",
};

const MINUTES_PER_HOUR = 60;
const DEG_PER_HOUR = 15;

/**
 * Best-effort visitor coordinates without asking for geolocation: longitude
 * from the clock's UTC offset, latitude borrowed from `location` (the reference
 * place — the longitude estimate already tracks the visitor).
 */
export function estimatedLocation(date = new Date(), location = HOME_LOCATION) {
  const offsetHours = -date.getTimezoneOffset() / MINUTES_PER_HOUR;
  return { latDeg: location.latDeg, lonDeg: offsetHours * DEG_PER_HOUR };
}

/** The visitor's local "day" | "golden" | "twilight" | "night". */
export function localDayPhase(date = new Date(), location = HOME_LOCATION) {
  const { latDeg, lonDeg } = estimatedLocation(date, location);
  return dayPhase(date, latDeg, lonDeg);
}
