import { describe, it, expect } from "vitest";
import { ICONS } from "../../../js/effects/effect-icons.js";
import { INCANTATIONS } from "../../../js/effects/incantations.js";
import { CHEATS } from "../../../js/themes/wanted-cheats.js";

describe("effects/effect-icons", () => {
  it("every icon is a non-empty SVG string", () => {
    const ids = Object.keys(ICONS);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(typeof ICONS[id], id).toBe("string");
      expect(ICONS[id].startsWith("<svg"), id).toBe(true);
    }
  });

  // Each incantation and cheat must carry one of the shared icons, so the glyph
  // travels with the effect (weapon slot, cheatsheet, …). Catches a new entry
  // that forgets its icon or points at a typo'd one.
  it("every incantation carries a known icon", () => {
    const known = new Set(Object.values(ICONS));
    for (const inc of INCANTATIONS) {
      expect(known.has(inc.icon), inc.word).toBe(true);
    }
  });

  it("every cheat carries a known icon", () => {
    const known = new Set(Object.values(ICONS));
    for (const c of CHEATS) {
      expect(known.has(c.icon), c.code).toBe(true);
    }
  });

  // Each spell/cheat gets its own glyph — no duplicates across the whole set.
  it("no two effects share an icon", () => {
    const all = [
      ...INCANTATIONS.map((i) => i.icon),
      ...CHEATS.map((c) => c.icon),
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});
