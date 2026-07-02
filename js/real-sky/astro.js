// ── Astronomy ──
// Pure celestial math for the real-sky layer: where the sun actually is,
// what the moon actually looks like, and which meteor showers are actually
// falling tonight. Deterministic functions of (date, place) — no network,
// no DOM — so the sky can be honest even offline.
//
// Accuracy target is "a human looking up would agree", not an ephemeris:
// the low-precision NOAA solar formulas (±0.01°) and a mean synodic moon
// (±0.5 day) are far beyond what a background canvas needs.

const MS_PER_DAY = 86400000;
const DEG = Math.PI / 180;

// Julian date of the Unix epoch, and of the J2000.0 reference epoch.
const JULIAN_UNIX_EPOCH = 2440587.5;
const JULIAN_J2000 = 2451545.0;

// ── Solar position (low-precision NOAA almanac formulas) ──
const SUN_MEAN_ANOMALY_BASE = 357.529;
const SUN_MEAN_ANOMALY_RATE = 0.98560028;
const SUN_MEAN_LONGITUDE_BASE = 280.459;
const SUN_MEAN_LONGITUDE_RATE = 0.98564736;
const SUN_EQ_CENTER_1 = 1.915;
const SUN_EQ_CENTER_2 = 0.02;
const OBLIQUITY_BASE = 23.439;
const OBLIQUITY_RATE = 0.00000036;
const GMST_BASE_HOURS = 18.697374558;
const GMST_RATE_HOURS = 24.06570982441908;
const HOURS_TO_DEG = 15;

function julianDaysSinceJ2000(date) {
  return date.getTime() / MS_PER_DAY + JULIAN_UNIX_EPOCH - JULIAN_J2000;
}

/** Solar declination in degrees — how far north/south the sun stands. */
export function solarDeclinationDeg(date) {
  const d = julianDaysSinceJ2000(date);
  const g = (SUN_MEAN_ANOMALY_BASE + SUN_MEAN_ANOMALY_RATE * d) * DEG;
  const q = SUN_MEAN_LONGITUDE_BASE + SUN_MEAN_LONGITUDE_RATE * d;
  const L =
    (q + SUN_EQ_CENTER_1 * Math.sin(g) + SUN_EQ_CENTER_2 * Math.sin(2 * g)) *
    DEG;
  const e = (OBLIQUITY_BASE - OBLIQUITY_RATE * d) * DEG;
  return Math.asin(Math.sin(e) * Math.sin(L)) / DEG;
}

/**
 * Solar elevation above the horizon in degrees at (latDeg, lonDeg).
 * Negative when the sun is below the horizon.
 */
export function solarElevationDeg(date, latDeg, lonDeg) {
  const d = julianDaysSinceJ2000(date);
  const g = (SUN_MEAN_ANOMALY_BASE + SUN_MEAN_ANOMALY_RATE * d) * DEG;
  const q = SUN_MEAN_LONGITUDE_BASE + SUN_MEAN_LONGITUDE_RATE * d;
  const L =
    (q + SUN_EQ_CENTER_1 * Math.sin(g) + SUN_EQ_CENTER_2 * Math.sin(2 * g)) *
    DEG;
  const e = (OBLIQUITY_BASE - OBLIQUITY_RATE * d) * DEG;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const decl = Math.asin(Math.sin(e) * Math.sin(L));
  const gmstHours = GMST_BASE_HOURS + GMST_RATE_HOURS * d;
  const lstDeg = ((gmstHours % 24) * HOURS_TO_DEG + lonDeg) % 360;
  const hourAngle = lstDeg * DEG - ra;
  const lat = latDeg * DEG;
  return (
    Math.asin(
      Math.sin(lat) * Math.sin(decl) +
        Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle),
    ) / DEG
  );
}

// ── Day phase ──
// Elevation bands: full daylight, golden hour, civil twilight, night.
const GOLDEN_MAX_ELEVATION_DEG = 6;
const TWILIGHT_MIN_ELEVATION_DEG = -6;

/** "day" | "golden" | "twilight" | "night" for the given moment and place. */
export function dayPhase(date, latDeg, lonDeg) {
  const elevation = solarElevationDeg(date, latDeg, lonDeg);
  if (elevation > GOLDEN_MAX_ELEVATION_DEG) return "day";
  if (elevation > 0) return "golden";
  if (elevation > TWILIGHT_MIN_ELEVATION_DEG) return "twilight";
  return "night";
}

// ── Moon phase ──
// Mean synodic cycle anchored at the new moon of 2000-01-06 18:14 UTC.
const SYNODIC_DAYS = 29.530588853;
const NEW_MOON_EPOCH_MS = Date.UTC(2000, 0, 6, 18, 14);
// Illumination this close to 1 reads as "full" to a human eye (±~1 day).
const FULL_MOON_MIN_ILLUMINATION = 0.97;

/**
 * { phase, illumination, waxing, isFull } — `phase` runs 0→1 across one
 * new-moon-to-new-moon cycle (0.5 = full); `illumination` is the lit
 * fraction of the disc.
 */
export function moonPhase(date) {
  const days = (date.getTime() - NEW_MOON_EPOCH_MS) / MS_PER_DAY;
  const phase =
    (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return {
    phase,
    illumination,
    waxing: phase < 0.5,
    isFull: illumination >= FULL_MOON_MIN_ILLUMINATION,
  };
}

// ── Meteor showers ──
// The dependable annual showers, as [month, day] windows with their peak
// night. Dates drift by ±1 day across years — well within how loosely a
// human experiences "shower season".
const RAMP_DAYS = 7;
export const METEOR_SHOWERS = [
  {
    id: "quadrantids",
    name: "Quadrantids",
    start: [1, 1],
    peak: [1, 3],
    end: [1, 10],
  },
  { id: "lyrids", name: "Lyrids", start: [4, 16], peak: [4, 22], end: [4, 25] },
  {
    id: "eta-aquariids",
    name: "Eta Aquariids",
    start: [4, 24],
    peak: [5, 6],
    end: [5, 20],
  },
  {
    id: "perseids",
    name: "Perseids",
    start: [7, 17],
    peak: [8, 12],
    end: [8, 24],
  },
  {
    id: "orionids",
    name: "Orionids",
    start: [10, 2],
    peak: [10, 21],
    end: [11, 7],
  },
  {
    id: "leonids",
    name: "Leonids",
    start: [11, 6],
    peak: [11, 17],
    end: [11, 30],
  },
  {
    id: "geminids",
    name: "Geminids",
    start: [12, 4],
    peak: [12, 14],
    end: [12, 17],
  },
];

function dayOfYear(date) {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - startOfYear) / MS_PER_DAY) + 1;
}

function monthDayToDoy(year, [month, day]) {
  return dayOfYear(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * The meteor shower active on `date`, with intensity ramping 0→1 toward its
 * peak night, or null outside every window.
 */
export function activeMeteorShower(date) {
  const year = date.getUTCFullYear();
  const doy = dayOfYear(date);
  for (const shower of METEOR_SHOWERS) {
    const start = monthDayToDoy(year, shower.start);
    const end = monthDayToDoy(year, shower.end);
    if (doy < start || doy > end) continue;
    const peak = monthDayToDoy(year, shower.peak);
    const intensity = Math.max(0, 1 - Math.abs(doy - peak) / RAMP_DAYS);
    return { id: shower.id, name: shower.name, intensity };
  }
  return null;
}

// ── Seasonal moments ──
// Detected from the solar declination itself rather than a date table, so
// the check never needs updating: the declination pins near ±obliquity for
// a couple of days around each solstice and sweeps through zero at each
// equinox.
const SOLSTICE_MIN_DECL_DEG = 23.43;
const EQUINOX_MAX_DECL_DEG = 0.2;

/** "solstice" | "equinox" | null for the given date. */
export function seasonalMoment(date) {
  const decl = Math.abs(solarDeclinationDeg(date));
  if (decl >= SOLSTICE_MIN_DECL_DEG) return "solstice";
  if (decl <= EQUINOX_MAX_DECL_DEG) return "equinox";
  return null;
}
