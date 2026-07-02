// ── Live Weather (Open-Meteo) ──
// One keyless request for the current conditions over the company's home
// town. Pure fetch + WMO-code interpretation; the caller decides what to do
// with the result. Failures resolve to null — the site never depends on the
// network being kind.

import { HOME_LAT_DEG, HOME_LON_DEG } from "./local.js";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const FETCH_TIMEOUT_MS = 8000;

// WMO weather-code bands → a short human word for the footer badge.
const WMO_BANDS = [
  { max: 0, label: "clear" },
  { max: 2, label: "partly cloudy" },
  { max: 3, label: "overcast" },
  { max: 49, label: "foggy" },
  { max: 57, label: "drizzle" },
  { max: 67, label: "rain" },
  { max: 79, label: "snow" },
  { max: 82, label: "rain" },
  { max: 86, label: "snow" },
  { max: 99, label: "thunder" },
];

// Codes that mean water is actually falling right now.
const RAIN_BANDS = [
  [51, 67],
  [80, 82],
  [95, 99],
];

export function weatherLabel(code) {
  const band = WMO_BANDS.find((b) => code <= b.max);
  return band ? band.label : "sky";
}

export function isRaining(code) {
  return RAIN_BANDS.some(([lo, hi]) => code >= lo && code <= hi);
}

/**
 * Current conditions at home: { tempC, code, label, raining }, or null on
 * any failure (offline, blocked, slow, malformed).
 */
export async function fetchHomeWeather() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url =
      `${ENDPOINT}?latitude=${HOME_LAT_DEG}&longitude=${HOME_LON_DEG}` +
      "&current=temperature_2m,weather_code";
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const tempC = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof tempC !== "number" || typeof code !== "number") return null;
    return { tempC, code, label: weatherLabel(code), raining: isRaining(code) };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
