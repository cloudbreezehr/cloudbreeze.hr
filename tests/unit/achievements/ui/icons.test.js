import { describe, it, expect } from "vitest";
import {
  CLOUD_CHECK_SVG,
  CLOUD_LOCK_SVG,
  CLOUD_HIDDEN_SVG,
} from "../../../../js/achievements/ui/icons.js";

// icons.js is a plain constants module — the tests pin the shape that
// consumers rely on rather than the exact SVG markup.  If the visual
// design changes the constant can be edited; what tests care about is
// that every icon is a well-formed <svg> element of the expected
// flavor (unlocked / locked / hidden).

describe("achievements/ui/icons", () => {
  it("exports SVG strings that parse as a single <svg> root", () => {
    for (const svg of [CLOUD_CHECK_SVG, CLOUD_LOCK_SVG, CLOUD_HIDDEN_SVG]) {
      const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(parsed.querySelector("parsererror")).toBeNull();
      expect(parsed.documentElement.tagName.toLowerCase()).toEqual("svg");
    }
  });

  it("check icon is full opacity and includes the check stroke", () => {
    // Two <path> elements: the cloud and the check mark.  Opacity is
    // unset (so it inherits full opacity from the stroke color).
    expect(CLOUD_CHECK_SVG).not.toContain('opacity="0.4"');
    const paths = (CLOUD_CHECK_SVG.match(/<path/g) || []).length;
    expect(paths).toEqual(2);
  });

  it("lock icon is faded and has no check mark", () => {
    expect(CLOUD_LOCK_SVG).toContain('opacity="0.4"');
    const paths = (CLOUD_LOCK_SVG.match(/<path/g) || []).length;
    expect(paths).toEqual(1);
  });

  it("hidden icon is faded and contains a question glyph", () => {
    expect(CLOUD_HIDDEN_SVG).toContain('opacity="0.4"');
    expect(CLOUD_HIDDEN_SVG).toContain(">?<");
    expect(CLOUD_HIDDEN_SVG).toContain("<text");
  });
});
