// ── Theme Alchemy ──
// Curated hybrids for specific theme pairs. Themes already stack as body
// classes while a single winner paints; when a stacked pair matches a combo
// below, the combo takes over the shared canvas look instead — a reward for
// the visitors who experiment with stacking. Pure data + a resolver; the
// render loop owns detection, CSS and the palette own the look.

export const COMBOS = [
  {
    id: "cryo-code",
    label: "Cryo-Code",
    themes: ["frozen", "matrix"],
  },
  {
    id: "signal-noir",
    label: "Signal Noir",
    themes: ["rainy", "vhs"],
  },
  {
    id: "storyboard",
    label: "Storyboard",
    themes: ["paper", "wanted"],
  },
];

export const COMBO_IDS = COMBOS.map((c) => c.id);

/**
 * The first combo whose member themes are all in `activeThemeIds`, or null.
 * Declaration order is the precedence — with three disjoint pairs it only
 * matters if a future combo shares a theme with an earlier one.
 */
export function activeCombo(activeThemeIds) {
  for (const combo of COMBOS) {
    if (combo.themes.every((t) => activeThemeIds.includes(t))) return combo;
  }
  return null;
}

/** The palette-override key a combo resolves under. */
export function comboPaletteKey(id) {
  return `combo:${id}`;
}
