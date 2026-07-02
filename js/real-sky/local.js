// ── Local Sky Estimate ──
// The real-sky layer needs the *visitor's* sun, but a static page has no
// geolocation (and shouldn't ask for it just to tint a canvas). The honest
// approximation: longitude from the clock's UTC offset — solar time is what
// drives day/night, and the offset tracks it to within a timezone's width —
// and the home latitude as a stand-in, which only softens the seasonal
// day-length swing, never flips day for night.

import { dayPhase } from "./astro.js";

// Pula, Croatia — the fallback latitude and the company's home coordinates.
export const HOME_LAT_DEG = 44.8666;
export const HOME_LON_DEG = 13.8496;

const MINUTES_PER_HOUR = 60;
const DEG_PER_HOUR = 15;

/** Best-effort visitor coordinates without asking for geolocation. */
export function estimatedLocation(date = new Date()) {
  const offsetHours = -date.getTimezoneOffset() / MINUTES_PER_HOUR;
  return { latDeg: HOME_LAT_DEG, lonDeg: offsetHours * DEG_PER_HOUR };
}

/** The visitor's local "day" | "golden" | "twilight" | "night". */
export function localDayPhase(date = new Date()) {
  const { latDeg, lonDeg } = estimatedLocation(date);
  return dayPhase(date, latDeg, lonDeg);
}
