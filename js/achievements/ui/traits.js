// ── Achievement trait badges ──
// The small corner glyph that visualises an achievement's trait (see `traitOf`
// in the registry). One entry per id in the ACHIEVEMENT_TRAITS vocabulary;
// buildTraitBadge turns a trait id into its badge element.

import {
  CALENDAR_BADGE_SVG,
  PATIENT_BADGE_SVG,
  BONUS_BADGE_SVG,
} from "./icons.js";

export const TRAIT_BADGES = {
  calendar: {
    svg: CALENDAR_BADGE_SVG,
    label: "A real-world moment — the sky has to line up",
  },
  patient: {
    svg: PATIENT_BADGE_SVG,
    label: "Comes with time — return visits or the right hour",
  },
  bonus: {
    svg: BONUS_BADGE_SVG,
    label: "Bonus — beyond 100%",
  },
};

// Build the corner badge element for a trait id, or null for an unknown one.
// The label rides as the accessible name; the glyph itself is decorative.
export function buildTraitBadge(trait) {
  const spec = TRAIT_BADGES[trait];
  if (!spec) return null;
  const el = document.createElement("span");
  el.className = `achievement-trait-badge achievement-trait-badge--${trait}`;
  el.innerHTML = spec.svg;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", spec.label);
  return el;
}
