import { describe, it, expect } from "vitest";
import { wordOfTheDay } from "../../../js/daily/word.js";
import { INCANTATION_WORDS } from "../../../js/effects/incantations.js";

describe("daily/word", () => {
  it("picks a real incantation, the same one all day", () => {
    const morning = wordOfTheDay(new Date(2026, 6, 2, 8, 0));
    const night = wordOfTheDay(new Date(2026, 6, 2, 23, 0));
    expect(morning).toBe(night);
    expect(INCANTATION_WORDS).toContain(morning);
  });

  it("rotates across days", () => {
    // With ~28 words, four consecutive days colliding on one word would
    // point at a broken hash — not bad luck.
    const words = [2, 3, 4, 5].map((d) =>
      wordOfTheDay(new Date(2026, 6, d, 12, 0)),
    );
    expect(new Set(words).size).toBeGreaterThan(1);
  });
});
