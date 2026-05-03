// ── Time of Day Palette Tint ──
// Shifts sky colors subtly based on the user's local clock.  Dawn warms,
// midday is neutral, dusk reddens, night cools.  The effect is additive to
// the existing palette system: we tint the base sky stops after resolution,
// so sub-mode CSS filters still have final say per mode.
//
// Tinting is cached per minute so the render loop can call through every
// frame without re-allocating arrays.  Cache keys on the base palette ref +
// time bucket, so palette swaps (theme toggle, sub-mode) invalidate cleanly.

import { lerpColor } from "./colors.js";
import { defineConstants } from "./dev/registry.js";

const TOD = defineConstants("effects.timeOfDay", {
  // Cache granularity — tint is recomputed when the minute bucket changes.
  // Set to 0 to disable the time-of-day effect entirely.
  STRENGTH_SCALE: { value: 1, min: 0, max: 2, step: 0.05 },
  // Update every N minutes.  Finer is smoother, coarser is cheaper.
  UPDATE_INTERVAL_MIN: { value: 1, min: 1, max: 30, step: 1 },
});

// Tint keyframes across a 24-hour day (hour → { rgb, strength }).  Strength
// is the mix factor applied to each sky color stop.
const KEYFRAMES = [
  { hour: 0, rgb: [20, 25, 50], strength: 0.14 },
  { hour: 5, rgb: [30, 25, 60], strength: 0.1 },
  { hour: 6, rgb: [255, 180, 140], strength: 0.1 },
  { hour: 8, rgb: [255, 230, 200], strength: 0.05 },
  { hour: 12, rgb: [255, 255, 255], strength: 0.0 },
  { hour: 16, rgb: [255, 200, 150], strength: 0.06 },
  { hour: 18, rgb: [255, 140, 80], strength: 0.12 },
  { hour: 20, rgb: [180, 80, 120], strength: 0.12 },
  { hour: 22, rgb: [40, 40, 80], strength: 0.13 },
  { hour: 24, rgb: [20, 25, 50], strength: 0.14 }, // wraps to midnight
];

function resolveTint(hourFloat) {
  // Find the two keyframes that bracket the current hour.
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (hourFloat >= a.hour && hourFloat <= b.hour) {
      const t = (hourFloat - a.hour) / (b.hour - a.hour);
      return {
        rgb: [
          a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t,
          a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t,
          a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t,
        ],
        strength: a.strength + (b.strength - a.strength) * t,
      };
    }
  }
  return { rgb: [255, 255, 255], strength: 0 };
}

function tintStops(stops, tint, strength) {
  // rgba stops — we only mix rgb; keep alpha.
  const tinted = new Array(stops.length);
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const t = [tint[0], tint[1], tint[2], s[3]];
    tinted[i] = lerpColor(s, t, strength);
  }
  return tinted;
}

let _cachedPalette = null;
let _cachedSource = null;
let _cachedBucket = -1;

function currentMinuteBucket() {
  const now = new Date();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  return Math.floor(minuteOfDay / TOD.UPDATE_INTERVAL_MIN);
}

/**
 * Tint the sky stops of a resolved palette by the time-of-day curve.
 * Returns the input untouched when STRENGTH_SCALE is zero, which makes the
 * effect fully disable-able from the dev console.
 *
 * Cache invalidates when either the source palette reference or the minute
 * bucket changes — so theme/submode swaps flow through as normal, and the
 * tint updates once per minute otherwise.
 */
export function applyTimeOfDay(palette) {
  if (TOD.STRENGTH_SCALE <= 0) return palette;

  const bucket = currentMinuteBucket();
  if (_cachedSource === palette && _cachedBucket === bucket) {
    return _cachedPalette;
  }

  const now = new Date();
  const hourFloat = now.getHours() + now.getMinutes() / 60;
  const tint = resolveTint(hourFloat);
  const strength = tint.strength * TOD.STRENGTH_SCALE;

  if (strength <= 0) {
    _cachedSource = palette;
    _cachedBucket = bucket;
    _cachedPalette = palette;
    return palette;
  }

  const tinted = {
    ...palette,
    skyTop: tintStops(palette.skyTop, tint.rgb, strength),
    skyBot: tintStops(palette.skyBot, tint.rgb, strength),
  };
  _cachedSource = palette;
  _cachedBucket = bucket;
  _cachedPalette = tinted;
  return tinted;
}
