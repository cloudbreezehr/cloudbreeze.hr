import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  RAPID_FIRE_WINDOW_MS,
  RAPID_FIRE_CLICKS,
  NIGHT_OWL_MS,
  NIGHT_OWL_CHECK_INTERVAL,
  AFTERSHOCK_WINDOW_MS,
  STORM_FORECASTER_THEME_COUNT,
  LONG_WATCH_MS,
} from "../../../js/achievements/tracker.js";
import { INCANTATION_WORDS } from "../../../js/effects/incantations.js";

// tracker.js collaborates with storage.js (module-level state) and reads
// registry/progress at runtime. Each test resets modules + localStorage so
// counters, unlocks, and progress items start fresh. Registry and progress
// are left real — they're data, not behavior, and mocking them would couple
// tests to an implementation seam that doesn't exist.

const SLACK_MS = 1000;
const PAST_RAPID_FIRE_WINDOW_MS = RAPID_FIRE_WINDOW_MS + SLACK_MS;
const WITHIN_AFTERSHOCK_MS = Math.floor(AFTERSHOCK_WINDOW_MS / 4);
const PAST_AFTERSHOCK_WINDOW_MS = AFTERSHOCK_WINDOW_MS + SLACK_MS;
// Push past NIGHT_OWL_MS by a full check-interval plus slack so the
// next interval tick is guaranteed to land after the threshold.
const PAST_NIGHT_OWL_MS = NIGHT_OWL_MS + NIGHT_OWL_CHECK_INTERVAL + SLACK_MS;
// Comfortably below NIGHT_OWL_MS for the "still hidden" branch.
const SHORT_VISIBLE_MS = Math.floor(NIGHT_OWL_MS / 5);
const LONG_HIDDEN_MS = 2 * NIGHT_OWL_MS;
// The Long Watch — half-window for "still building," past-window for "fired."
const HALF_LONG_WATCH_MS = LONG_WATCH_MS / 2;
const PAST_LONG_WATCH_MS = LONG_WATCH_MS + SLACK_MS;

const _activeTrackers = [];

// Reset modules, wire a live tracker on the window, and register it for
// cleanup. The tracker's setInterval for night-owl would otherwise leak
// between tests and cause one suite's advanceTimersByTime to trip another's
// assertions.
async function startTracker(onUnlock = () => {}, onRelock = () => {}) {
  vi.resetModules();
  localStorage.clear();
  const storage = await import("../../../js/achievements/storage.js");
  const { createTracker } = await import("../../../js/achievements/tracker.js");
  storage.activate();
  const tracker = createTracker(onUnlock, onRelock);
  tracker.start();
  _activeTrackers.push(tracker);
  return { storage, tracker };
}

function stopAllTrackers() {
  while (_activeTrackers.length) {
    const t = _activeTrackers.pop();
    try {
      t.stop();
    } catch {}
  }
}

function dispatchAchievement(type, data = {}) {
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type, ...data } }),
  );
}

function setTheme(theme) {
  if (theme === null) delete document.body.dataset.activeTheme;
  else document.body.dataset.activeTheme = theme;
}

describe("tracker — tryUnlock", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("calls onUnlock exactly once per achievement id", async () => {
    const onUnlock = vi.fn();
    await startTracker(onUnlock);

    dispatchAchievement("click");
    dispatchAchievement("click");

    const firstLightCalls = onUnlock.mock.calls.filter(
      (c) => c[0].id === "first-light",
    );
    expect(firstLightCalls).toHaveLength(1);
  });

  it("passes the full achievement object to onUnlock", async () => {
    const onUnlock = vi.fn();
    await startTracker(onUnlock);

    dispatchAchievement("click");

    const firstLight = onUnlock.mock.calls.find(
      (c) => c[0].id === "first-light",
    );
    expect(firstLight[0]).toMatchObject({
      id: "first-light",
      title: expect.any(String),
      points: expect.any(Number),
    });
  });

  it("persists unlocks via storage", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("click");

    expect(storage.isUnlocked("first-light")).toBe(true);
  });
});

describe("tracker — incantations", () => {
  beforeEach(() => {
    document.body.className = "";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks abracadabra on any incantation", async () => {
    const { storage } = await startTracker();
    dispatchAchievement("incantation", { word: INCANTATION_WORDS[0] });
    expect(storage.isUnlocked("abracadabra")).toBe(true);
  });

  it("unlocks overkill only when an incantation is maxed", async () => {
    const { storage } = await startTracker();
    dispatchAchievement("incantation", {
      word: INCANTATION_WORDS[0],
      maxed: false,
    });
    expect(storage.isUnlocked("overkill")).toBe(false);
    dispatchAchievement("incantation", {
      word: INCANTATION_WORDS[0],
      maxed: true,
    });
    expect(storage.isUnlocked("overkill")).toBe(true);
  });

  it("unlocks grimoire only after every incantation is cast", async () => {
    const { storage } = await startTracker();
    INCANTATION_WORDS.slice(0, -1).forEach((word) =>
      dispatchAchievement("incantation", { word }),
    );
    expect(storage.isUnlocked("grimoire")).toBe(false);
    dispatchAchievement("incantation", {
      word: INCANTATION_WORDS[INCANTATION_WORDS.length - 1],
    });
    expect(storage.isUnlocked("grimoire")).toBe(true);
  });
});

describe("tracker — click handler", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    // Deterministic viewport for quadrant / pixel-perfect tests.
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("increments totalClicks and unlocks first-light on first click", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("click");

    expect(storage.getCounter("totalClicks")).toBe(1);
    expect(storage.isUnlocked("first-light")).toBe(true);
  });

  it("unlocks rapid-fire once the click target lands inside the window", async () => {
    const { storage } = await startTracker();

    for (let i = 0; i < RAPID_FIRE_CLICKS; i++) {
      dispatchAchievement("click");
    }

    expect(storage.isUnlocked("rapid-fire")).toBe(true);
  });

  it("does not unlock rapid-fire when clicks span past the window", async () => {
    const { storage } = await startTracker();

    const half = Math.ceil(RAPID_FIRE_CLICKS / 2);
    for (let i = 0; i < half; i++) {
      dispatchAchievement("click");
    }
    vi.advanceTimersByTime(PAST_RAPID_FIRE_WINDOW_MS);
    for (let i = 0; i < RAPID_FIRE_CLICKS - half; i++) {
      dispatchAchievement("click");
    }

    expect(storage.isUnlocked("rapid-fire")).toBe(false);
  });

  it("unlocks vertigo when rapid-fire lands inside upside-down theme", async () => {
    const { storage } = await startTracker();
    setTheme("upside-down");

    for (let i = 0; i < RAPID_FIRE_CLICKS; i++) {
      dispatchAchievement("click");
    }

    expect(storage.isUnlocked("vertigo")).toBe(true);
  });

  it("does not unlock vertigo outside upside-down theme", async () => {
    const { storage } = await startTracker();

    for (let i = 0; i < RAPID_FIRE_CLICKS; i++) {
      dispatchAchievement("click");
    }

    expect(storage.isUnlocked("vertigo")).toBe(false);
  });

  it("records quadrants from click x/y", async () => {
    const { storage } = await startTracker();

    // 1000×800 viewport → midpoint (500, 400).
    dispatchAchievement("click", { x: 100, y: 100 }); // top-left
    dispatchAchievement("click", { x: 900, y: 100 }); // top-right
    dispatchAchievement("click", { x: 100, y: 700 }); // bottom-left
    dispatchAchievement("click", { x: 900, y: 700 }); // bottom-right

    expect(storage.getProgressItems("quadrants-clicked").sort()).toEqual([
      "bl",
      "br",
      "tl",
      "tr",
    ]);
  });

  it("unlocks pixel-perfect when the click lands near the viewport center", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("click", { x: 510, y: 405 });

    expect(storage.isUnlocked("pixel-perfect")).toBe(true);
  });

  it("does not unlock pixel-perfect for clicks outside the 30px radius", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("click", { x: 600, y: 400 });

    expect(storage.isUnlocked("pixel-perfect")).toBe(false);
  });

  it("unlocks aftershock on a click shortly after fury-lightning", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("fury-lightning");
    vi.advanceTimersByTime(WITHIN_AFTERSHOCK_MS);
    dispatchAchievement("click");

    expect(storage.isUnlocked("aftershock")).toBe(true);
  });

  it("does not unlock aftershock when the click lands outside the window", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("fury-lightning");
    vi.advanceTimersByTime(PAST_AFTERSHOCK_WINDOW_MS);
    dispatchAchievement("click");

    expect(storage.isUnlocked("aftershock")).toBe(false);
  });

  it("unlocks bioluminescent on click in deep-sea", async () => {
    const { storage } = await startTracker();
    setTheme("deep-sea");

    dispatchAchievement("click");

    expect(storage.isUnlocked("bioluminescent")).toBe(true);
  });

  it("unlocks pixel-burst on click in blocky", async () => {
    const { storage } = await startTracker();
    setTheme("blocky");

    dispatchAchievement("click");

    expect(storage.isUnlocked("pixel-burst")).toBe(true);
  });

  it("unlocks puddle-jump on click in rainy", async () => {
    const { storage } = await startTracker();
    setTheme("rainy");

    dispatchAchievement("click");

    expect(storage.isUnlocked("puddle-jump")).toBe(true);
  });

  it("unlocks rift-walker on click in upside-down", async () => {
    const { storage } = await startTracker();
    setTheme("upside-down");

    dispatchAchievement("click");

    expect(storage.isUnlocked("rift-walker")).toBe(true);
  });

  it("unlocks margin-notes only when a card click lands in paper theme", async () => {
    const { storage } = await startTracker();
    setTheme("paper");

    dispatchAchievement("click", { card: false });
    expect(storage.isUnlocked("margin-notes")).toBe(false);

    dispatchAchievement("click", { card: true });
    expect(storage.isUnlocked("margin-notes")).toBe(true);
  });
});

describe("tracker — drag handler", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks trail-blazer on the first drag", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("drag", { x: 100, y: 100 });

    expect(storage.isUnlocked("trail-blazer")).toBe(true);
  });

  it("unlocks the-long-drag when drag distance crosses 40% of the larger viewport side", async () => {
    const { storage } = await startTracker();

    // Threshold: 0.4 * max(1000, 800) = 400 px.
    dispatchAchievement("drag", { x: 100, y: 100 });
    dispatchAchievement("drag", { x: 550, y: 100 }); // dx=450, over threshold

    expect(storage.isUnlocked("the-long-drag")).toBe(true);
  });

  it("does not unlock the-long-drag when movement stays under the threshold", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("drag", { x: 100, y: 100 });
    dispatchAchievement("drag", { x: 200, y: 100 });

    expect(storage.isUnlocked("the-long-drag")).toBe(false);
  });

  it("resets drag tracking on a click so a subsequent drag starts a fresh distance", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("drag", { x: 100, y: 100 });
    dispatchAchievement("click");
    dispatchAchievement("drag", { x: 150, y: 100 });
    dispatchAchievement("drag", { x: 300, y: 100 }); // only 150 from new start

    expect(storage.isUnlocked("the-long-drag")).toBe(false);
  });

  it("unlocks snowdrift on drag in frozen theme", async () => {
    const { storage } = await startTracker();
    setTheme("frozen");

    dispatchAchievement("drag", { x: 100, y: 100 });

    expect(storage.isUnlocked("snowdrift")).toBe(true);
  });
});

describe("tracker — scroll handler", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks stargazer at 25% scroll", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("scroll", { progress: 0.3 });

    expect(storage.isUnlocked("stargazer")).toBe(true);
  });

  it("does not unlock stargazer below 25%", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("scroll", { progress: 0.2 });

    expect(storage.isUnlocked("stargazer")).toBe(false);
  });

  it("unlocks down-to-earth at the bottom", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("scroll", { progress: 0.96 });

    expect(storage.isUnlocked("down-to-earth")).toBe(true);
  });

  it("unlocks zenith only after reaching the bottom and scrolling back to the top", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("scroll", { progress: 0.04 });
    expect(storage.isUnlocked("zenith")).toBe(false);

    dispatchAchievement("scroll", { progress: 0.96 });
    dispatchAchievement("scroll", { progress: 0.04 });
    expect(storage.isUnlocked("zenith")).toBe(true);
  });

  it("unlocks scroll-surge when velocity exceeds 50", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("scroll", { progress: 0.5, velocity: 80 });

    expect(storage.isUnlocked("scroll-surge")).toBe(true);
  });

  it("unlocks scroll-surge for large negative velocity too (upward burst)", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("scroll", { progress: 0.5, velocity: -80 });

    expect(storage.isUnlocked("scroll-surge")).toBe(true);
  });

  it("unlocks disoriented when scrolling to the bottom in upside-down theme", async () => {
    const { storage } = await startTracker();
    setTheme("upside-down");

    dispatchAchievement("scroll", { progress: 0.96 });

    expect(storage.isUnlocked("disoriented")).toBe(true);
  });
});

describe("tracker — appearance-change handler", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks nightfall for the dark appearance", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("appearance-change", { appearance: "dark" });

    expect(storage.isUnlocked("nightfall")).toBe(true);
  });

  it("unlocks daybreak for the light appearance", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("appearance-change", { appearance: "light" });

    expect(storage.isUnlocked("daybreak")).toBe(true);
  });

  it("records appearances-used as a collection", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("appearance-change", { appearance: "dark" });
    dispatchAchievement("appearance-change", { appearance: "light" });

    expect(storage.getProgressItems("appearances-used").sort()).toEqual([
      "dark",
      "light",
    ]);
  });

  it("increments appearanceToggles counter", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("appearance-change", { appearance: "dark" });
    dispatchAchievement("appearance-change", { appearance: "light" });
    dispatchAchievement("appearance-change", { appearance: "auto" });

    expect(storage.getCounter("appearanceToggles")).toBe(3);
  });

  it("unlocks the appearance-toggles-3 progressive after three toggles", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("appearance-change", { appearance: "dark" });
    dispatchAchievement("appearance-change", { appearance: "light" });
    dispatchAchievement("appearance-change", { appearance: "auto" });

    // The progressive achievement with progressKey "appearance-toggles-3" is
    // "dusk-and-dawn" — confirm it unlocked by checking storage.
    expect(storage.isUnlocked("dusk-and-dawn")).toBe(true);
  });
});

describe("tracker — hold / well / fury / misc handlers", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("hold unlocks gathering-storm", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("hold");

    expect(storage.isUnlocked("gathering-storm")).toBe(true);
  });

  it("hold-full unlocks eye-of-the-storm", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("hold-full");

    expect(storage.isUnlocked("eye-of-the-storm")).toBe(true);
  });

  it("click-burst unlocks spark", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("click-burst");

    expect(storage.isUnlocked("spark")).toBe(true);
  });

  it("well-activate unlocks event-horizon; 3 activations unlock void-caller", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("well-activate");
    expect(storage.isUnlocked("event-horizon")).toBe(true);
    expect(storage.isUnlocked("void-caller")).toBe(false);

    dispatchAchievement("well-activate");
    dispatchAchievement("well-activate");
    expect(storage.isUnlocked("void-caller")).toBe(true);
  });

  it("well-full unlocks singularity", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("well-full");

    expect(storage.isUnlocked("singularity")).toBe(true);
  });

  it("well-activate unlocks pressure-drop in deep-sea", async () => {
    const { storage } = await startTracker();
    setTheme("deep-sea");

    dispatchAchievement("well-activate");

    expect(storage.isUnlocked("pressure-drop")).toBe(true);
  });

  it("well-activate unlocks monsoon in rainy", async () => {
    const { storage } = await startTracker();
    setTheme("rainy");

    dispatchAchievement("well-activate");

    expect(storage.isUnlocked("monsoon")).toBe(true);
  });

  it("well-activate unlocks bad-tracking in vhs", async () => {
    const { storage } = await startTracker();
    setTheme("vhs");

    dispatchAchievement("well-activate");

    expect(storage.isUnlocked("bad-tracking")).toBe(true);
  });

  it("fury-lightning unlocks fury-unleashed; 5 triggers unlock chain-lightning", async () => {
    const { storage } = await startTracker();

    for (let i = 0; i < 4; i++) dispatchAchievement("fury-lightning");
    expect(storage.isUnlocked("fury-unleashed")).toBe(true);
    expect(storage.isUnlocked("chain-lightning")).toBe(false);

    dispatchAchievement("fury-lightning");
    expect(storage.isUnlocked("chain-lightning")).toBe(true);
  });

  it.each([
    { theme: "blocky", unlock: "8-bit-storm" },
    { theme: "rainy", unlock: "thunder-roll" },
    { theme: "deep-sea", unlock: "storm-surge" },
    { theme: "frozen", unlock: "frozen-lightning" },
    { theme: "upside-down", unlock: "glitch" },
    { theme: "paper", unlock: "ink-splatter" },
  ])("fury-lightning unlocks $unlock in $theme", async ({ theme, unlock }) => {
    const { storage } = await startTracker();
    setTheme(theme);

    dispatchAchievement("fury-lightning");

    expect(storage.isUnlocked(unlock)).toBe(true);
  });

  it("fury-aurora unlocks northern-lights", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("fury-aurora");

    expect(storage.isUnlocked("northern-lights")).toBe(true);
  });

  it("snow-globe unlocks snow-globe; blizzard in frozen; permafrost in deep-sea", async () => {
    {
      const { storage } = await startTracker();
      dispatchAchievement("snow-globe");
      expect(storage.isUnlocked("snow-globe")).toBe(true);
      stopAllTrackers();
    }
    {
      const { storage } = await startTracker();
      setTheme("frozen");
      dispatchAchievement("snow-globe");
      expect(storage.isUnlocked("blizzard")).toBe(true);
      stopAllTrackers();
    }
    {
      const { storage } = await startTracker();
      setTheme("deep-sea");
      dispatchAchievement("snow-globe");
      expect(storage.isUnlocked("permafrost")).toBe(true);
    }
  });

  it("orbit unlocks orbit-lock; deep-orbit inside deep-sea", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("orbit");
    expect(storage.isUnlocked("orbit-lock")).toBe(true);
    expect(storage.isUnlocked("deep-orbit")).toBe(false);

    setTheme("deep-sea");
    dispatchAchievement("orbit");
    expect(storage.isUnlocked("deep-orbit")).toBe(true);
  });

  it.each([
    { event: "upside-down-warning", unlock: "boundary-break" },
    { event: "frost-breath", unlock: "frost-breath" },
    { event: "contact-click", unlock: "landfall" },
    { event: "linkedin-click", unlock: "connected" },
    { event: "dev-console-open", unlock: "reverse-engineer" },
    { event: "logo-parallax", unlock: "magnetic-letters" },
    { event: "theme-history-reveal", unlock: "historian" },
    { event: "cloudlog-activate", unlock: "cloudlog-activated" },
    { event: "timestamp-toggle", unlock: "time-warp" },
    { event: "cloudlog-shortcut", unlock: "shortcut-master" },
    { event: "cursor-idle", unlock: "idle-hands" },
  ])("$event unlocks $unlock", async ({ event, unlock }) => {
    const { storage } = await startTracker();

    dispatchAchievement(event);

    expect(storage.isUnlocked(unlock)).toBe(true);
  });

  it("panel-open unlocks cloud-reader only on the first open", async () => {
    const onUnlock = vi.fn();
    const { storage } = await startTracker(onUnlock);

    dispatchAchievement("panel-open");
    dispatchAchievement("panel-open");

    expect(storage.isUnlocked("cloud-reader")).toBe(true);
    const matches = onUnlock.mock.calls.filter(
      (c) => c[0].id === "cloud-reader",
    );
    expect(matches).toHaveLength(1);
  });

  it("cursor-idle records the animation name as progress", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("cursor-idle", { animation: "blink" });

    expect(storage.getProgressItems("idle-animations")).toContain("blink");
  });

  it("jellyfish-pulse increments the counter (progressive checked elsewhere)", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("jellyfish-pulse");
    dispatchAchievement("jellyfish-pulse");

    expect(storage.getCounter("jellyfishPulses")).toBe(2);
  });

  it("paper-stroke increments the counter", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("paper-stroke");

    expect(storage.getCounter("paperStrokes")).toBe(1);
  });

  it("ignores unknown event types without throwing", async () => {
    await startTracker();

    expect(() => dispatchAchievement("not-a-real-event")).not.toThrow();
  });
});

describe("tracker — theme-activate / theme-deactivate", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it.each([
    { theme: "deep-sea", unlock: "the-depths" },
    { theme: "frozen", unlock: "first-frost" },
    { theme: "blocky", unlock: "resolution-drop" },
    { theme: "rainy", unlock: "first-drop" },
    { theme: "paper", unlock: "first-sketch" },
    { theme: "vhs", unlock: "tracking-lost" },
    { theme: "upside-down", unlock: "the-flip" },
  ])(
    "theme-activate unlocks $unlock on first $theme activation",
    async ({ theme, unlock }) => {
      const { storage } = await startTracker();

      dispatchAchievement("theme-activate", { theme });

      expect(storage.isUnlocked(unlock)).toBe(true);
    },
  );

  it("unlocks theme-hopper after 3 distinct themes activate in a session", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    dispatchAchievement("theme-activate", { theme: "blocky" });
    expect(storage.isUnlocked("theme-hopper")).toBe(false);
    dispatchAchievement("theme-activate", { theme: "rainy" });
    expect(storage.isUnlocked("theme-hopper")).toBe(true);
  });

  it("unlocks persistent after 1000 lifetime clicks", async () => {
    const { storage } = await startTracker();
    // Seed the counter near the threshold to avoid 1000 dispatches.
    storage.setCounter("totalClicks", 999);
    dispatchAchievement("click", {});
    expect(storage.isUnlocked("persistent")).toBe(true);
    expect(storage.isUnlocked("devoted")).toBe(false);
  });

  it("unlocks wish-granted on a shooting-star click", async () => {
    const { storage } = await startTracker();
    dispatchAchievement("shooting-star-clicked", {});
    expect(storage.isUnlocked("wish-granted")).toBe(true);
  });

  it("unlocks open-secrets when the cheatsheet is discovered", async () => {
    const { storage } = await startTracker();
    dispatchAchievement("cheatsheet-discovered", {});
    expect(storage.isUnlocked("open-secrets")).toBe(true);
  });

  it("unlocks sound-on when sound is enabled", async () => {
    const { storage } = await startTracker();
    dispatchAchievement("sound-enabled", {});
    expect(storage.isUnlocked("sound-on")).toBe(true);
  });

  it("unlocks triple-stack when three themes are active at once", async () => {
    const { storage } = await startTracker();
    document.body.classList.add("frozen", "deep-sea");
    dispatchAchievement("theme-activate", { theme: "deep-sea" });
    expect(storage.isUnlocked("triple-stack")).toBe(false);
    document.body.classList.add("blocky");
    dispatchAchievement("theme-activate", { theme: "blocky" });
    expect(storage.isUnlocked("triple-stack")).toBe(true);
  });

  it("announces a non-silent theme activation to the live region", async () => {
    await startTracker();
    dispatchAchievement("theme-activate", { theme: "frozen" });
    vi.advanceTimersByTime(100);
    // resetModules across tests can leave stale (empty) live nodes in
    // the DOM, so assert that *some* live region carries the message.
    const announced = [
      ...document.querySelectorAll('[aria-live="polite"]'),
    ].some((el) => el.textContent.toLowerCase().includes("activated"));
    expect(announced).toBe(true);
  });

  it("does not announce a silent theme activation", async () => {
    await startTracker();
    // Clear any text left in live regions by earlier tests so this
    // assertion only sees what the silent dispatch produces (nothing).
    document
      .querySelectorAll('[aria-live="polite"]')
      .forEach((el) => (el.textContent = ""));
    dispatchAchievement("theme-activate", { theme: "frozen", silent: true });
    vi.advanceTimersByTime(100);
    const announced = [
      ...document.querySelectorAll('[aria-live="polite"]'),
    ].some((el) => el.textContent.toLowerCase().includes("frozen"));
    expect(announced).toBe(false);
  });

  it("records themes-activated across every theme for elemental progress", async () => {
    const { storage } = await startTracker();

    for (const theme of [
      "deep-sea",
      "frozen",
      "blocky",
      "rainy",
      "paper",
      "vhs",
      "upside-down",
    ]) {
      dispatchAchievement("theme-activate", { theme });
    }

    expect(storage.getProgressItems("themes-activated").sort()).toEqual([
      "blocky",
      "deep-sea",
      "frozen",
      "paper",
      "rainy",
      "upside-down",
      "vhs",
    ]);
  });

  it("increments totalThemeActivations", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    dispatchAchievement("theme-activate", { theme: "frozen" });

    expect(storage.getCounter("totalThemeActivations")).toBe(2);
  });

  it("ignores theme-activate without a theme field", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", {});

    expect(storage.getCounter("totalThemeActivations")).toBe(0);
  });

  it.each([
    { theme: "deep-sea", unlock: "resurface" },
    { theme: "frozen", unlock: "thaw" },
    { theme: "blocky", unlock: "defrag" },
    { theme: "rainy", unlock: "rainbow" },
    { theme: "paper", unlock: "blank-page" },
    { theme: "vhs", unlock: "tape-eject" },
    { theme: "upside-down", unlock: "restoration" },
  ])(
    "theme-deactivate unlocks $unlock on non-silent $theme exit",
    async ({ theme, unlock }) => {
      const { storage } = await startTracker();

      dispatchAchievement("theme-deactivate", { theme });

      expect(storage.isUnlocked(unlock)).toBe(true);
    },
  );

  it("skips the deactivation achievement when data.silent is true (HUD toggle)", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-deactivate", { theme: "frozen", silent: true });

    expect(storage.isUnlocked("thaw")).toBe(false);
  });

  it("ignores theme-deactivate without a theme field", async () => {
    await startTracker();

    expect(() => dispatchAchievement("theme-deactivate", {})).not.toThrow();
  });
});

describe("tracker — progressive re-evaluation", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks the count-based 'curious-mind' (unlocks-5) once five achievements are unlocked", async () => {
    const { storage } = await startTracker();

    // Drive five distinct one-liner unlocks.
    dispatchAchievement("click-burst"); // spark
    dispatchAchievement("hold"); // gathering-storm
    dispatchAchievement("hold-full"); // eye-of-the-storm
    dispatchAchievement("fury-aurora"); // northern-lights
    dispatchAchievement("contact-click"); // landfall

    // curious-mind requires 5 unlocks. After 5, the count-based progressive
    // should fire — bringing the total to 6.
    expect(storage.isUnlocked("curious-mind")).toBe(true);
  });

  it("re-locks a progressive achievement when its count drops below the threshold", async () => {
    const onRelock = vi.fn();
    const { storage } = await startTracker(() => {}, onRelock);

    dispatchAchievement("appearance-change", { appearance: "dark" });
    dispatchAchievement("appearance-change", { appearance: "light" });
    dispatchAchievement("appearance-change", { appearance: "auto" });
    expect(storage.isUnlocked("dusk-and-dawn")).toBe(true);

    // Simulate state drift by rolling back the counter. A subsequent event
    // re-runs the progressive check and should trigger a relock.
    storage.setCounter("appearanceToggles", 1);
    dispatchAchievement("appearance-change", { appearance: "dark" });

    expect(storage.isUnlocked("dusk-and-dawn")).toBe(false);
    const ids = onRelock.mock.calls.map((c) => c[0].id);
    expect(ids).toContain("dusk-and-dawn");
  });
});

describe("tracker — catchUp", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("retroactively unlocks session-derived achievements", async () => {
    const { storage, tracker } = await startTracker();

    dispatchAchievement("click");
    dispatchAchievement("scroll", { progress: 0.3 });
    dispatchAchievement("scroll", { progress: 0.96 });
    dispatchAchievement("drag", { x: 1, y: 1 });
    dispatchAchievement("fury-lightning");
    dispatchAchievement("fury-aurora");
    dispatchAchievement("snow-globe");
    dispatchAchievement("well-activate");
    dispatchAchievement("well-full");

    // Relock everything (simulates activation-after-the-fact).
    const ids = [
      "first-light",
      "stargazer",
      "down-to-earth",
      "trail-blazer",
      "fury-unleashed",
      "northern-lights",
      "snow-globe",
      "event-horizon",
      "singularity",
    ];
    for (const id of ids) {
      storage.relock(id);
      expect(storage.isUnlocked(id)).toBe(false);
    }

    tracker.catchUp();

    for (const id of ids) {
      expect(storage.isUnlocked(id)).toBe(true);
    }
  });

  it("retroactively unlocks chain-lightning / void-caller when session counts are high", async () => {
    const { storage, tracker } = await startTracker();

    for (let i = 0; i < 5; i++) dispatchAchievement("fury-lightning");
    for (let i = 0; i < 3; i++) dispatchAchievement("well-activate");
    storage.relock("chain-lightning");
    storage.relock("void-caller");
    expect(storage.isUnlocked("chain-lightning")).toBe(false);
    expect(storage.isUnlocked("void-caller")).toBe(false);

    tracker.catchUp();

    expect(storage.isUnlocked("chain-lightning")).toBe(true);
    expect(storage.isUnlocked("void-caller")).toBe(true);
  });
});

describe("tracker — lifecycle (start / stop)", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("start subscribes to window achievement events", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("click");

    expect(storage.isUnlocked("first-light")).toBe(true);
  });

  it("stop unsubscribes from window achievement events", async () => {
    const { storage, tracker } = await startTracker();

    tracker.stop();
    dispatchAchievement("click");

    expect(storage.isUnlocked("first-light")).toBe(false);
  });

  it("records today's session day on start", async () => {
    const { storage } = await startTracker();

    const days = storage.getState().counters.sessionDays;
    expect(days).toContain("2026-05-08");
  });

  it("does not duplicate today's session day across repeated starts", async () => {
    const { storage, tracker } = await startTracker();

    // Already started once. Stop and start again.
    tracker.stop();
    tracker.start();

    const days = storage
      .getState()
      .counters.sessionDays.filter((d) => d === "2026-05-08");
    expect(days).toHaveLength(1);
  });
});

describe("tracker — moonlit", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks moonlit when start() runs between midnight and 5am", async () => {
    vi.setSystemTime(new Date("2026-05-08T02:30:00"));
    const { storage } = await startTracker();

    expect(storage.isUnlocked("moonlit")).toBe(true);
  });

  it("does not unlock moonlit during the day", async () => {
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    const { storage } = await startTracker();

    expect(storage.isUnlocked("moonlit")).toBe(false);
  });
});

describe("tracker — night-owl", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks night-owl after the cumulative-visible threshold", async () => {
    const { storage } = await startTracker();

    vi.advanceTimersByTime(PAST_NIGHT_OWL_MS);

    expect(storage.isUnlocked("night-owl")).toBe(true);
  });

  it("does not count time while the page is hidden", async () => {
    const { storage } = await startTracker();

    vi.advanceTimersByTime(SHORT_VISIBLE_MS);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(LONG_HIDDEN_MS);

    // Only the visible portion accumulated — well below the threshold.
    expect(storage.isUnlocked("night-owl")).toBe(false);
  });
});

describe("tracker — the-long-watch", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks after LONG_WATCH_MS uninterrupted in a single theme", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    vi.advanceTimersByTime(PAST_LONG_WATCH_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(true);
  });

  it("does not unlock when the user deactivates before the threshold", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS);
    dispatchAchievement("theme-deactivate", { theme: "frozen" });
    vi.advanceTimersByTime(PAST_LONG_WATCH_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(false);
  });

  it("resets the watch when the user switches to a different theme", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS);
    // theme-factory dispatches deactivate of the prior theme before
    // activating the new one; mirror that here.
    dispatchAchievement("theme-deactivate", { theme: "frozen" });
    dispatchAchievement("theme-activate", { theme: "deep-sea" });
    // The remaining half of the original window plus slack — together
    // less than a fresh PAST_LONG_WATCH_MS, so the watch should not fire.
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS + SLACK_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(false);

    // Continuing in deep-sea past the full window from the switch
    // moment does fire — the timer was restarted, not destroyed.
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS);
    expect(storage.isUnlocked("the-long-watch")).toBe(true);
  });

  it("clears the timer on silent deactivations too", async () => {
    // Programmatic deactivations (e.g. HUD toggle) carry silent=true and
    // skip exit achievements, but the user's theme experience still ended,
    // so the watch must clear regardless of silent.
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS);
    dispatchAchievement("theme-deactivate", { theme: "frozen", silent: true });
    vi.advanceTimersByTime(PAST_LONG_WATCH_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(false);
  });

  it("ignores theme-deactivate without a theme field (no spurious clear)", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS);
    dispatchAchievement("theme-deactivate", {});
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS + SLACK_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(true);
  });

  it("catchUp starts the watch when a theme is already active", async () => {
    // Simulates Cloudlog-after-the-fact: the user entered a theme, then
    // triple-clicked to activate the achievement system.
    const { storage, tracker } = await startTracker();

    setTheme("frozen");
    tracker.catchUp();
    vi.advanceTimersByTime(PAST_LONG_WATCH_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(true);
  });

  it("catchUp does not start the watch when no theme is active", async () => {
    const { storage, tracker } = await startTracker();

    tracker.catchUp();
    vi.advanceTimersByTime(PAST_LONG_WATCH_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(false);
  });

  it("stop() clears the timer so a pending watch does not fire later", async () => {
    const { storage, tracker } = await startTracker();

    dispatchAchievement("theme-activate", { theme: "frozen" });
    vi.advanceTimersByTime(HALF_LONG_WATCH_MS);
    tracker.stop();
    vi.advanceTimersByTime(PAST_LONG_WATCH_MS);

    expect(storage.isUnlocked("the-long-watch")).toBe(false);
  });
});

describe("tracker — storm-forecaster", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks after STORM_FORECASTER_THEME_COUNT distinct themes see lightning", async () => {
    const { storage } = await startTracker();
    const themes = ["frozen", "deep-sea", "rainy"];
    expect(themes).toHaveLength(STORM_FORECASTER_THEME_COUNT);

    for (let i = 0; i < themes.length - 1; i++) {
      setTheme(themes[i]);
      dispatchAchievement("fury-lightning");
      expect(storage.isUnlocked("storm-forecaster")).toBe(false);
    }

    setTheme(themes[themes.length - 1]);
    dispatchAchievement("fury-lightning");
    expect(storage.isUnlocked("storm-forecaster")).toBe(true);
  });

  it("does not count repeated triggers in the same theme", async () => {
    const { storage } = await startTracker();
    setTheme("frozen");

    for (let i = 0; i < STORM_FORECASTER_THEME_COUNT + 2; i++) {
      dispatchAchievement("fury-lightning");
    }

    expect(storage.isUnlocked("storm-forecaster")).toBe(false);
  });

  it("excludes the no-theme (default canvas) state from the set", async () => {
    const { storage } = await startTracker();

    // No theme active — should not contribute.
    setTheme(null);
    dispatchAchievement("fury-lightning");
    setTheme(null);
    dispatchAchievement("fury-lightning");
    setTheme(null);
    dispatchAchievement("fury-lightning");
    expect(storage.isUnlocked("storm-forecaster")).toBe(false);

    // Adding genuine themes after — the no-theme triggers are still
    // ignored, so we need STORM_FORECASTER_THEME_COUNT real ones.
    const themes = ["frozen", "deep-sea", "rainy"];
    for (const theme of themes) {
      setTheme(theme);
      dispatchAchievement("fury-lightning");
    }
    expect(storage.isUnlocked("storm-forecaster")).toBe(true);
  });

  it("catchUp retroactively unlocks when the threshold is already met", async () => {
    const { storage, tracker } = await startTracker();

    const themes = ["frozen", "deep-sea", "rainy"];
    for (const theme of themes) {
      setTheme(theme);
      dispatchAchievement("fury-lightning");
    }
    storage.relock("storm-forecaster");
    expect(storage.isUnlocked("storm-forecaster")).toBe(false);

    tracker.catchUp();

    expect(storage.isUnlocked("storm-forecaster")).toBe(true);
  });
});

describe("tracker — tab-tourist", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks after panel-open credits one tab and panel-tab-switch credits the other", async () => {
    const { storage } = await startTracker();

    // Initial open lands on the Achievements tab.
    dispatchAchievement("panel-open", { tab: "achievements" });
    expect(storage.isUnlocked("tab-tourist")).toBe(false);

    // User switches to the Activity tab — completes the pair.
    dispatchAchievement("panel-tab-switch", { tab: "activity" });
    expect(storage.isUnlocked("tab-tourist")).toBe(true);
  });

  it("unlocks via two switch events alone (no initial panel-open credit)", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("panel-tab-switch", { tab: "achievements" });
    dispatchAchievement("panel-tab-switch", { tab: "activity" });

    expect(storage.isUnlocked("tab-tourist")).toBe(true);
  });

  it("ignores panel-open without a tab field", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("panel-open", {});
    dispatchAchievement("panel-tab-switch", { tab: "activity" });

    // Only one tab credited; not enough to unlock yet.
    expect(storage.isUnlocked("tab-tourist")).toBe(false);
  });

  it("repeating the same tab does not advance progress", async () => {
    const { storage } = await startTracker();

    for (let i = 0; i < 5; i++) {
      dispatchAchievement("panel-tab-switch", { tab: "achievements" });
    }

    expect(storage.isUnlocked("tab-tourist")).toBe(false);
  });
});

describe("tracker — cartographers-almanac", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("unlocks after panel-open under each of the three appearance preferences", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("panel-open", { appearance: "dark" });
    expect(storage.isUnlocked("cartographers-almanac")).toBe(false);

    dispatchAchievement("panel-open", { appearance: "light" });
    expect(storage.isUnlocked("cartographers-almanac")).toBe(false);

    dispatchAchievement("panel-open", { appearance: "auto" });
    expect(storage.isUnlocked("cartographers-almanac")).toBe(true);
  });

  it("repeating the same appearance does not advance progress", async () => {
    const { storage } = await startTracker();

    for (let i = 0; i < 5; i++) {
      dispatchAchievement("panel-open", { appearance: "dark" });
    }

    expect(storage.isUnlocked("cartographers-almanac")).toBe(false);
  });

  it("ignores panel-open without an appearance field", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("panel-open", {});
    dispatchAchievement("panel-open", { appearance: "light" });
    dispatchAchievement("panel-open", { appearance: "auto" });

    // Only two appearances credited.
    expect(storage.isUnlocked("cartographers-almanac")).toBe(false);
  });
});

describe("tracker — vhs handlers", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.activeTheme;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
  });

  afterEach(() => {
    stopAllTrackers();
    vi.useRealTimers();
  });

  it("vhs-cursor-still unlocks phosphor-burn", async () => {
    const { storage } = await startTracker();

    dispatchAchievement("vhs-cursor-still");

    expect(storage.isUnlocked("phosphor-burn")).toBe(true);
  });

  it("vhs-glitch unlocks channel-surfer after the threshold count", async () => {
    const { storage } = await startTracker();

    for (let i = 0; i < 4; i++) dispatchAchievement("vhs-glitch");
    expect(storage.isUnlocked("channel-surfer")).toBe(false);

    dispatchAchievement("vhs-glitch");
    expect(storage.isUnlocked("channel-surfer")).toBe(true);
  });

  it("vhs-glitch counts accumulate across the session, not per-theme", async () => {
    const { storage } = await startTracker();

    // Glitches outside vhs (theoretical, but the handler doesn't gate on
    // theme) still count — channel-surfer's contract is "5 glitches in
    // one session" not "5 while VHS is the active theme".
    for (let i = 0; i < 5; i++) dispatchAchievement("vhs-glitch");
    expect(storage.isUnlocked("channel-surfer")).toBe(true);
  });
});
