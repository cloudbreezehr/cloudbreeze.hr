// ── Per-Theme Sound Identity ──
// A theme's sonic character, declared once and reused however the theme is
// entered (HUD, URL, hidden trigger, typing, activity log) — the audio analogue
// of the per-theme icon. For now each theme defines a `filter` tint applied
// across the effects bus while it's active; activation cues and ambient land
// alongside as the layer grows.

const THEME_SOUND = {
  "deep-sea": { filter: { type: "lowpass", freq: 700, q: 1.0 } },
  frozen: { filter: { type: "highpass", freq: 900, q: 0.7 } },
  blocky: { filter: { type: "bandpass", freq: 1200, q: 0.8 } },
  rainy: { filter: { type: "lowpass", freq: 2400, q: 0.6 } },
  paper: { filter: { type: "lowpass", freq: 3000, q: 0.6 } },
  vhs: { filter: { type: "bandpass", freq: 1600, q: 1.2 } },
  "upside-down": { filter: { type: "highpass", freq: 500, q: 0.8 } },
  constellation: { filter: { type: "highpass", freq: 1400, q: 0.6 } },
};

// The bus tint for a theme, or null when the theme has none (→ neutral).
export function themeFilter(themeId) {
  return THEME_SOUND[themeId]?.filter || null;
}
