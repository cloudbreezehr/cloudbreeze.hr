import { describe, it, expect } from "vitest";
import {
  COMBOS,
  COMBO_IDS,
  activeCombo,
  comboPaletteKey,
} from "../../../js/themes/alchemy.js";
import { getThemeIds } from "../../../js/themes/registry.js";
import { resolvePalette, palettes } from "../../../js/colors.js";

describe("themes/alchemy — combo registry", () => {
  it("every combo references registered themes only", () => {
    const known = getThemeIds();
    for (const combo of COMBOS) {
      for (const theme of combo.themes) {
        expect(known, `${combo.id} → ${theme}`).toContain(theme);
      }
    }
  });

  it("resolves a combo only when the full pair is stacked", () => {
    expect(activeCombo(["frozen", "matrix"])?.id).toBe("cryo-code");
    expect(activeCombo(["frozen", "matrix", "rainy"])?.id).toBe("cryo-code");
    expect(activeCombo(["frozen"])).toBeNull();
    expect(activeCombo(["matrix", "rainy"])).toBeNull();
    expect(activeCombo([])).toBeNull();
  });

  it("resolves signal-noir and storyboard from their pairs", () => {
    expect(activeCombo(["vhs", "rainy"])?.id).toBe("signal-noir");
    expect(activeCombo(["wanted", "paper"])?.id).toBe("storyboard");
  });
});

describe("themes/alchemy — palette hybrids", () => {
  it("every combo has a palette override in both appearances", () => {
    for (const id of COMBO_IDS) {
      for (const appearance of ["dark", "light"]) {
        const pal = resolvePalette(appearance, comboPaletteKey(id));
        expect(pal.clickColor, `${id}/${appearance}`).not.toEqual(
          palettes[appearance].clickColor,
        );
        // Base keys survive the merge — the hybrid overrides, not replaces.
        expect(pal.cloudWhite).toEqual(palettes[appearance].cloudWhite);
      }
    }
  });
});
