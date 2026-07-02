import { describe, it, expect } from "vitest";
import {
  themeEnterLine,
  themeExitLine,
  comboLine,
  incantationLine,
} from "../../js/narration.js";
import { getThemeIds } from "../../js/themes/registry.js";
import { COMBO_IDS } from "../../js/themes/alchemy.js";
import { INCANTATIONS } from "../../js/effects/incantations.js";

describe("narration — coverage", () => {
  it("every registered theme has real enter and exit prose", () => {
    for (const id of getThemeIds()) {
      // The fallback ends in "activated"/"deactivated"; prose doesn't.
      expect(themeEnterLine(id), id).not.toMatch(/activated$/);
      expect(themeExitLine(id), id).not.toMatch(/deactivated$/);
    }
  });

  it("an unknown future theme still gets an announcement", () => {
    expect(themeEnterLine("plasma")).toBe("plasma theme activated");
    expect(themeExitLine("plasma")).toBe("plasma theme deactivated");
  });

  it("every combo has a fuse line", () => {
    for (const id of COMBO_IDS) {
      expect(comboLine(id), id).toContain("Two skies fuse");
    }
    expect(comboLine("nonsense")).toBeNull();
  });

  it("incantations narrate as their word plus their hint", () => {
    const boom = INCANTATIONS.find((i) => i.word === "BOOM");
    expect(incantationLine("BOOM")).toBe(`BOOM. ${boom.hint}.`);
    expect(incantationLine("XYZZY")).toBeNull();
  });
});
