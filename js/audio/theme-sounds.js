// ── Per-Theme Sound Identity ──
// A theme's sonic character, declared once and reused however the theme is
// entered (HUD, URL, hidden trigger, typing, activity log) — the audio analogue
// of the per-theme icon. Each theme defines a `filter` tint applied across the
// effects bus while it's active, and may override the generic entry/exit cue
// with its own `cue` voice (e.g. the upside-down flip's tumble).

const THEME_SOUND = {
  "deep-sea": { filter: { type: "lowpass", freq: 700, q: 1.0 } },
  frozen: { filter: { type: "highpass", freq: 900, q: 0.7 } },
  blocky: { filter: { type: "bandpass", freq: 1200, q: 0.8 } },
  rainy: { filter: { type: "lowpass", freq: 2400, q: 0.6 } },
  paper: { filter: { type: "lowpass", freq: 3000, q: 0.6 } },
  vhs: { filter: { type: "bandpass", freq: 1600, q: 1.2 } },
  "upside-down": {
    filter: { type: "highpass", freq: 500, q: 0.8 },
    cue: "flip",
  },
  constellation: { filter: { type: "highpass", freq: 1400, q: 0.6 } },
  matrix: { filter: { type: "bandpass", freq: 1100, q: 1.4 } },
  wanted: { filter: { type: "bandpass", freq: 1500, q: 2.0 }, cue: "siren" },
};

// The bus tint for a theme, or null when the theme has none (→ neutral).
export function themeFilter(themeId) {
  return THEME_SOUND[themeId]?.filter || null;
}

// A theme's custom entry/exit cue voice, or null to use the generic whoosh.
export function themeCue(themeId) {
  return THEME_SOUND[themeId]?.cue || null;
}
