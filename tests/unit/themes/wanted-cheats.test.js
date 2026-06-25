import { describe, it, expect } from "vitest";
import {
  createCheatMatcher,
  CHEATS,
  CHEAT_CODES,
} from "../../../js/themes/wanted-cheats.js";

// Feed a string letter by letter; return the last non-null match (or null).
function feedWord(matcher, word) {
  let hit = null;
  for (const ch of word) hit = matcher.feed(ch) || hit;
  return hit;
}

describe("themes/wanted-cheats", () => {
  describe("createCheatMatcher", () => {
    it("fires when the rolling buffer ends with a code", () => {
      const m = createCheatMatcher();
      expect(feedWord(m, "HESOYAM")).toBe("HESOYAM");
    });

    it("ignores stray leading letters before a clean code", () => {
      const m = createCheatMatcher();
      feedWord(m, "ZZQXJ");
      expect(feedWord(m, "BUBBLECARS")).toBe("BUBBLECARS");
    });

    it("does not fire on a partial code", () => {
      const m = createCheatMatcher();
      expect(feedWord(m, "HESOYA")).toBe(null);
    });

    it("requires the code typed contiguously — a wrong letter mid-code blocks it", () => {
      const m = createCheatMatcher();
      expect(feedWord(m, "HESOXYAM")).toBe(null); // O mistyped as X
      // Typing it cleanly afterward still fires (buffer is a rolling suffix).
      expect(feedWord(m, "HESOYAM")).toBe("HESOYAM");
    });

    it("clears the buffer after a match so the next code starts fresh", () => {
      const m = createCheatMatcher(["AB", "BC"]);
      expect(m.feed("A")).toBe(null);
      expect(m.feed("B")).toBe("AB"); // fires + clears
      // The leftover "B" was cleared, so "C" alone can't complete "BC".
      expect(m.feed("C")).toBe(null);
    });
  });

  it("every cheat has a code, label, and run; CHEAT_CODES mirrors CHEATS", () => {
    expect(CHEAT_CODES).toEqual(CHEATS.map((c) => c.code));
    for (const c of CHEATS) {
      expect(c.code.length).toBeGreaterThan(0);
      expect(typeof c.label).toBe("string");
      expect(typeof c.run).toBe("function");
    }
  });
});
