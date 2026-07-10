import { describe, it, expect, afterEach, vi } from "vitest";
import {
  ACHIEVEMENTS,
  SETS,
  POINT_TIERS,
  THEME_SETS,
  SET_MASTERY_MAP,
  getAchievement,
  sumPoints,
  getSetPrereqs,
  getAllNonMeta,
  getSpeedrunGoal,
  getReachableAchievements,
  isReachable,
  isBonus,
  isThemeSet,
  getProgressiveAchievements,
} from "../../../js/achievements/registry.js";
import { getThemeIds } from "../../../js/themes/registry.js";

describe("achievements/registry — data shape", () => {
  it("every achievement has the required fields", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id, a.id).toMatch(/^[a-z0-9-]+$/);
      expect(a.set, a.id).toMatch(/^[a-z0-9-]+$/);
      expect(typeof a.title, a.id).toBe("string");
      expect(a.title.length, a.id).toBeGreaterThan(0);
      expect(typeof a.description, a.id).toBe("string");
      expect(typeof a.points, a.id).toBe("number");
      expect(a.points, a.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("achievement IDs are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every achievement's set refers to a defined set", () => {
    const setIds = new Set(SETS.map((s) => s.id));
    setIds.add("meta"); // meta set exists implicitly
    for (const a of ACHIEVEMENTS) {
      expect(setIds.has(a.set), `${a.id} -> ${a.set}`).toBe(true);
    }
  });

  it("every achievement's points match a point tier", () => {
    const tierValues = new Set(Object.values(POINT_TIERS));
    for (const a of ACHIEVEMENTS) {
      expect(tierValues.has(a.points), `${a.id} (${a.points})`).toBe(true);
    }
  });
});

describe("Almanac set", () => {
  it("is a defined, core (non-theme) set", () => {
    const almanac = SETS.find((s) => s.id === "almanac");
    expect(almanac).toBeTruthy();
    expect(almanac.label).toBe("Almanac");
    // Core-like: always visible, no set-mastery capstone (that's theme-set only).
    expect(isThemeSet("almanac")).toBe(false);
    expect(SET_MASTERY_MAP.almanac).toBeUndefined();
  });

  it("groups exactly the real-sky and calendar achievements", () => {
    const ids = ACHIEVEMENTS.filter((a) => a.set === "almanac")
      .map((a) => a.id)
      .sort();
    expect(ids).toEqual(
      [
        "equal-night",
        "frequent-flyer",
        "golden-hour",
        "moonlit",
        "moonstruck",
        "over-the-moon",
        "rain-check",
        "regular",
        "snow-day",
        "star-shower",
        "sun-stands-still",
        "tenacious",
      ].sort(),
    );
  });
});

// The core-like sets carved out of the old Exploration set. Each is
// non-theme (always visible, no mastery capstone) with an explicit membership
// so a stray reassignment shows up as a failing diff.
describe("Exploration-split sets", () => {
  const cases = [
    {
      id: "cloudlog",
      label: "Cloudlog",
      ids: [
        "cloud-reader",
        "cloudlog-activated",
        "fine-print",
        "shortcut-master",
        "tab-tourist",
        "to-the-minute",
      ],
    },
    {
      id: "appearance",
      label: "Appearance",
      ids: [
        "daybreak",
        "dusk-and-dawn",
        "full-spectrum",
        "light-reading",
        "nightfall",
      ],
    },
    {
      id: "interaction",
      label: "Interaction",
      ids: [
        "down-to-earth",
        "first-light",
        "light-fingered",
        "magnetic-letters",
        "scroll-surge",
        "spark",
        "stargazer",
        "the-long-drag",
        "trail-blazer",
        "zenith",
      ],
    },
    {
      id: "incantations",
      label: "Incantations",
      ids: [
        "abracadabra",
        "clean-slate",
        "grimoire",
        "open-secrets",
        "overkill",
        "wordsmith",
      ],
    },
    {
      id: "terminal",
      label: "Terminal",
      ids: [
        "cloud-native",
        "in-season",
        "not-in-sudoers",
        "passport-issued",
        "passport-stamped",
        "scorched-earth",
        "shell-access",
        "terminal-velocity",
      ],
    },
    {
      id: "linked-skies",
      label: "Linked Skies",
      ids: [
        "distant-gravity",
        "fixed-stars",
        "ghost-hand",
        "parallel-skies",
        "star-courier",
        "triptych",
      ],
    },
  ];

  for (const { id, label, ids } of cases) {
    describe(`${label} set`, () => {
      it("is a defined, core (non-theme) set with no mastery capstone", () => {
        const set = SETS.find((s) => s.id === id);
        expect(set).toBeTruthy();
        expect(set.label).toBe(label);
        expect(set.color).toBeNull();
        expect(isThemeSet(id)).toBe(false);
        expect(SET_MASTERY_MAP[id]).toBeUndefined();
      });

      it("groups exactly its expected achievements", () => {
        const actual = ACHIEVEMENTS.filter((a) => a.set === id)
          .map((a) => a.id)
          .sort();
        expect(actual).toEqual([...ids].sort());
      });
    });
  }
});

describe("THEME_SETS", () => {
  it("matches the themes registry one-for-one", () => {
    expect([...THEME_SETS].sort()).toEqual([...getThemeIds()].sort());
  });

  it("SET_MASTERY_MAP has an entry per theme set", () => {
    for (const id of THEME_SETS) {
      expect(SET_MASTERY_MAP[id]).toBeTruthy();
    }
  });

  it("each mastery achievement id actually exists in ACHIEVEMENTS", () => {
    const knownIds = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const [setId, masteryId] of Object.entries(SET_MASTERY_MAP)) {
      expect(knownIds.has(masteryId), `${setId} -> ${masteryId}`).toBe(true);
    }
  });
});

describe("getAchievement", () => {
  it("returns the definition by id", () => {
    const some = ACHIEVEMENTS[0];
    expect(getAchievement(some.id)).toBe(some);
  });

  it("returns null for unknown ids", () => {
    expect(getAchievement("nope-nope")).toBeNull();
  });
});

describe("sumPoints", () => {
  it("returns 0 for an empty list", () => {
    expect(sumPoints([])).toBe(0);
  });

  it("sums points from real achievement ids", () => {
    const [a, b] = ACHIEVEMENTS;
    expect(sumPoints([{ id: a.id }, { id: b.id }])).toBe(a.points + b.points);
  });

  it("ignores entries whose id isn't in the registry", () => {
    const [a] = ACHIEVEMENTS;
    expect(sumPoints([{ id: a.id }, { id: "bogus" }])).toBe(a.points);
  });
});

describe("getSetPrereqs", () => {
  it("excludes the mastery achievement from the prereq list", () => {
    for (const setId of THEME_SETS) {
      const prereqs = getSetPrereqs(setId);
      const masteryId = SET_MASTERY_MAP[setId];
      expect(prereqs).not.toContain(masteryId);
    }
  });

  it("returns only ids belonging to the requested set", () => {
    for (const setId of THEME_SETS) {
      const prereqs = getSetPrereqs(setId);
      for (const id of prereqs) {
        expect(getAchievement(id).set).toBe(setId);
      }
    }
  });

  it("returns an empty list for unknown sets", () => {
    expect(getSetPrereqs("no-such-set")).toEqual([]);
  });
});

describe("getAllNonMeta", () => {
  it("holds exactly the reachable, non-meta, non-bonus achievements", () => {
    const nonMeta = new Set(getAllNonMeta());
    for (const a of ACHIEVEMENTS) {
      const shouldCount = a.set !== "meta" && !isBonus(a) && isReachable(a);
      expect(nonMeta.has(a.id)).toBe(shouldCount);
    }
  });

  it("excludes every bonus achievement so they can't gate 100%", () => {
    const nonMeta = new Set(getAllNonMeta());
    const bonus = ACHIEVEMENTS.filter(isBonus);
    expect(bonus.length).toBeGreaterThan(0);
    for (const a of bonus) expect(nonMeta.has(a.id)).toBe(false);
  });
});

describe("getSpeedrunGoal", () => {
  it("holds exactly the reachable, non-meta, non-bonus, non-patient achievements", () => {
    const goal = new Set(getSpeedrunGoal());
    for (const a of ACHIEVEMENTS) {
      const shouldCount =
        a.set !== "meta" && !isBonus(a) && !a.patient && isReachable(a);
      expect(goal.has(a.id), a.id).toBe(shouldCount);
    }
  });

  it("skips patient entries while getAllNonMeta still gates completion on them", () => {
    const goal = new Set(getSpeedrunGoal());
    const nonMeta = new Set(getAllNonMeta());
    const patient = ACHIEVEMENTS.filter((a) => a.patient === true);
    expect(patient.length).toBeGreaterThan(0);
    for (const a of patient) {
      expect(goal.has(a.id), a.id).toBe(false);
      expect(nonMeta.has(a.id), a.id).toBe(true);
    }
  });

  it("marks no bonus entry patient — bonus already sits outside every goal", () => {
    for (const a of ACHIEVEMENTS.filter((a) => a.patient === true)) {
      expect(a.bonus, a.id).toBeUndefined();
    }
  });
});

describe("isBonus", () => {
  it("flags only achievements with the bonus field", () => {
    for (const a of ACHIEVEMENTS) {
      expect(isBonus(a)).toBe(a.bonus === true);
    }
  });

  it("every bonus achievement is hidden until earned", () => {
    for (const a of ACHIEVEMENTS.filter(isBonus)) {
      expect(a.hidden, a.id).toBe(true);
    }
  });
});

describe("isThemeSet", () => {
  it("returns true for registered theme sets", () => {
    for (const id of THEME_SETS) expect(isThemeSet(id)).toBe(true);
  });

  it("returns false for non-theme sets", () => {
    expect(isThemeSet("exploration")).toBe(false);
    expect(isThemeSet("meta")).toBe(false);
    expect(isThemeSet("made-up")).toBe(false);
  });
});

describe("getProgressiveAchievements", () => {
  it("returns only achievements with a progressKey", () => {
    const progressive = getProgressiveAchievements();
    expect(progressive.length).toBeGreaterThan(0);
    for (const a of progressive) expect(a.progressKey).toBeTruthy();
  });
});

describe("device reachability", () => {
  // Model a touch-only device by stubbing the (hover: none) query device.js
  // reads; everything else resolves false (hover-capable).
  function setTouchOnly(touchOnly) {
    window.matchMedia = vi.fn((query) => ({
      matches: query === "(hover: none)" ? touchOnly : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
  }

  afterEach(() => {
    delete window.matchMedia;
  });

  // Keyboard/hover-only achievements that should drop out on touch.
  // (reverse-engineer is reachable on touch via the #dev URL; magnetic-letters
  // by tapping the wordmark — so neither is gated.)
  const KEYBOARD_ONLY = [
    "shortcut-master",
    "cheat-code",
    "cheat-the-system",
    "cheat-sheet",
  ];
  const HOVER_ONLY = ["idle-hands", "idle-watcher", "phosphor-burn"];
  // Multi-window play needs a desktop-style window manager.
  const MULTIWINDOW_ONLY = [
    "parallel-skies",
    "star-courier",
    "triptych",
    "fixed-stars",
    "ghost-hand",
    "distant-gravity",
  ];
  const GATED = [...KEYBOARD_ONLY, ...HOVER_ONLY, ...MULTIWINDOW_ONLY];
  // Motion is the inverse — reachable on touch, not on hover-capable desktops.
  const MOTION_ONLY = ["good-vibrations"];

  it("tags exactly the capability-gated achievements with a requires", () => {
    const required = ACHIEVEMENTS.filter((a) => a.requires).map((a) => a.id);
    expect(new Set(required)).toEqual(new Set([...GATED, ...MOTION_ONLY]));
    for (const a of ACHIEVEMENTS) {
      if (a.requires)
        expect(["keyboard", "hover", "multiwindow", "motion"]).toContain(
          a.requires,
        );
    }
  });

  it("counts every achievement except motion-only as reachable on a hover-capable device", () => {
    setTouchOnly(false);
    const reachableIds = new Set(getReachableAchievements().map((a) => a.id));
    for (const id of MOTION_ONLY) expect(reachableIds.has(id), id).toBe(false);
    expect(getReachableAchievements()).toHaveLength(
      ACHIEVEMENTS.length - MOTION_ONLY.length,
    );
    for (const a of ACHIEVEMENTS) {
      if (!MOTION_ONLY.includes(a.id)) expect(isReachable(a), a.id).toBe(true);
    }
  });

  it("drops capability-gated achievements on a touch-only device", () => {
    setTouchOnly(true);
    const reachableIds = new Set(getReachableAchievements().map((a) => a.id));
    for (const id of GATED) {
      expect(reachableIds.has(id), id).toBe(false);
    }
    for (const id of MOTION_ONLY) expect(reachableIds.has(id), id).toBe(true);
    expect(getReachableAchievements()).toHaveLength(
      ACHIEVEMENTS.length - GATED.length,
    );
  });

  it("excludes unreachable entries from completionist and set prereqs on touch", () => {
    setTouchOnly(true);
    expect(getAllNonMeta()).not.toContain("phosphor-burn");
    expect(getAllNonMeta()).not.toContain("shortcut-master");
    // phosphor-burn would otherwise block the VHS set-mastery on touch.
    expect(getSetPrereqs("vhs")).not.toContain("phosphor-burn");
    expect(getSetPrereqs("vhs").length).toBeGreaterThan(0);
  });
});
