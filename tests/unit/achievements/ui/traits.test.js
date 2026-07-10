import { describe, it, expect } from "vitest";
import {
  TRAIT_BADGES,
  buildTraitBadge,
} from "../../../../js/achievements/ui/traits.js";
import { ACHIEVEMENT_TRAITS } from "../../../../js/achievements/registry.js";

describe("achievements/ui/traits", () => {
  it("has a badge for exactly the registry's trait vocabulary", () => {
    expect(Object.keys(TRAIT_BADGES).sort()).toEqual(
      [...ACHIEVEMENT_TRAITS].sort(),
    );
  });

  it("every badge carries a glyph and an accessible label", () => {
    for (const [trait, spec] of Object.entries(TRAIT_BADGES)) {
      expect(spec.svg, trait).toContain("<svg");
      expect(spec.label, trait).toBeTruthy();
    }
  });

  describe("buildTraitBadge", () => {
    it("builds a labelled img span with the trait's modifier class and glyph", () => {
      const el = buildTraitBadge("calendar");
      expect(el.tagName).toBe("SPAN");
      expect(el.classList.contains("achievement-trait-badge")).toBe(true);
      expect(el.classList.contains("achievement-trait-badge--calendar")).toBe(
        true,
      );
      expect(el.getAttribute("role")).toBe("img");
      expect(el.getAttribute("aria-label")).toBe(TRAIT_BADGES.calendar.label);
      expect(el.querySelector("svg")).not.toBeNull();
    });

    it("returns null for an unknown trait", () => {
      expect(buildTraitBadge("nope")).toBeNull();
      expect(buildTraitBadge(null)).toBeNull();
    });
  });
});
