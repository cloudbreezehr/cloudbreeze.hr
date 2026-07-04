import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Integration test: exercises initConstellation() end-to-end through
// the real factory, real createConstellationTrigger, and real playWipe.
// No module mocks — the planted-star pipeline runs through createSky as
// well so the test reflects how the production module receives stars.

const WIPE_COVER_MS = 400;
const WIPE_REVEAL_MS = 600;
const SLACK_MS = 50;

function stageDom() {
  document.body.innerHTML = `
    <canvas id="bg-canvas"></canvas>
    <a class="nav-logo" href="#"></a>
    <svg class="cloud-svg"></svg>
  `;
  const canvas = document.getElementById("bg-canvas");
  canvas.width = 800;
  canvas.height = 600;
  // happy-dom doesn't size the canvas from CSS — pin width/height props
  // directly so the trigger's hit-test screen-position math has real
  // values to work against.
}

const activeInstances = [];
let starScreenInstances = null;

async function setupConstellation() {
  vi.resetModules();
  stageDom();
  const sky = await import("../../js/sky.js");
  sky.createSky(120);
  starScreenInstances = sky.starScreenInstances;
  const { initConstellation } =
    await import("../../js/themes/constellation.js");
  const instance = initConstellation();
  if (instance && instance.stop) activeInstances.push(instance);
  return { getSkyStars: sky.getSkyStars };
}

function clickAt(x, y) {
  document.body.dispatchEvent(
    new MouseEvent("click", {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

// Compute the screen position of a star through the renderer's own
// projection helper — the same one the trigger hit-tests with.  Raw star
// positions live in sky-tile space while the test canvas is 800×600, so
// the click target isn't just (star.x, star.y).
function clickStar(s, canvas) {
  const sp = 0; // no scroll → no parallax shift in this test
  const [inst] = starScreenInstances(s, sp, canvas);
  clickAt(inst.x, inst.y);
}

function flushWipe() {
  vi.advanceTimersByTime(WIPE_COVER_MS + WIPE_REVEAL_MS + SLACK_MS);
}

function starsOf(constellationId, getSkyStars) {
  return getSkyStars().filter((s) => s.constellationId === constellationId);
}

describe("theme-constellation integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    if (!Element.prototype.animate) {
      Element.prototype.animate = function () {
        const handle = { onfinish: null };
        queueMicrotask(() => handle.onfinish && handle.onfinish());
        return handle;
      };
    }
  });

  afterEach(() => {
    for (const inst of activeInstances) inst.stop();
    activeInstances.length = 0;
    vi.useRealTimers();
    document.body.className = "";
    document.body.removeAttribute("data-active-theme");
    document.body.removeAttribute("data-last-theme");
    document.body.innerHTML = "";
    delete Element.prototype.animate;
  });

  it("plants tagged stars and exposes them via getSkyStars", async () => {
    const { getSkyStars } = await setupConstellation();
    const tagged = getSkyStars().filter((s) => s.constellationId);
    // 3 + 5 + 7 + 5 = 20 planted stars (orions-belt, cassiopeia,
    // ursa-major, lyra) — exact count from constellations.js point
    // arrays.
    expect(tagged.length).toBe(20);
    // Each tagged star carries both fields so the chain logic can index
    // distinct stars even within a constellation.
    for (const s of tagged) {
      expect(typeof s.constellationId).toBe("string");
      expect(typeof s.constellationIndex).toBe("number");
      expect(s.constellationIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it("activates after clicking every star of one constellation", async () => {
    const { getSkyStars } = await setupConstellation();
    const targets = starsOf("orions-belt", getSkyStars);
    expect(targets.length).toBe(3);

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    try {
      for (const s of targets)
        clickStar(s, document.getElementById("bg-canvas"));
      flushWipe();

      expect(document.body.classList.contains("constellation")).toBe(true);

      const activateEvents = listener.mock.calls.filter(
        (c) =>
          c[0].detail.type === "theme-activate" &&
          c[0].detail.theme === "constellation",
      );
      expect(activateEvents).toHaveLength(1);

      const formed = listener.mock.calls.filter(
        (c) => c[0].detail.type === "constellation-formed",
      );
      expect(formed).toHaveLength(1);
      expect(formed[0][0].detail.constellationId).toBe("orions-belt");
    } finally {
      window.removeEventListener("achievement", listener);
    }
  });

  it("embers a constellation's remaining stars once a candidate is locked", async () => {
    const { getSkyStars } = await setupConstellation();
    const canvas = document.getElementById("bg-canvas");
    const orion = starsOf("orions-belt", getSkyStars);
    const cassio = starsOf("cassiopeia", getSkyStars);

    // One correct click locks the candidate at force ~1/3 — below the staged
    // hint threshold, so this exercises the engagement ember, not the ramp.
    clickStar(orion[0], canvas);

    const remaining = orion.filter((s) => s !== orion[0]);
    for (const s of remaining) expect(s.hintPulse).toBeGreaterThan(0);
    // The clicked star and an un-started constellation stay dark — the ember
    // guides completion without spoiling the puzzle cold.
    expect(orion[0].hintPulse).toBe(0);
    for (const s of cassio) expect(s.hintPulse).toBe(0);
  });

  it("intercepted star clicks dispatch a click event with intercepted: true", async () => {
    const { getSkyStars } = await setupConstellation();
    const target = starsOf("orions-belt", getSkyStars)[0];

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    try {
      clickStar(target, document.getElementById("bg-canvas"));
      const clickEvents = listener.mock.calls.filter(
        (c) => c[0].detail.type === "click",
      );
      expect(clickEvents.length).toBeGreaterThanOrEqual(1);
      // At least one of the click events for this click should carry
      // the intercepted flag (the trigger re-dispatches with it).
      const intercepted = clickEvents.filter(
        (c) => c[0].detail.intercepted === true,
      );
      expect(intercepted).toHaveLength(1);
    } finally {
      window.removeEventListener("achievement", listener);
    }
  });

  it("wrong-constellation hits are ignored after a candidate is locked", async () => {
    const { getSkyStars } = await setupConstellation();
    const orion = starsOf("orions-belt", getSkyStars)[0];
    const cassio = starsOf("cassiopeia", getSkyStars)[0];

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    try {
      clickStar(orion, document.getElementById("bg-canvas")); // locks orions-belt
      const beforeStars = listener.mock.calls.filter(
        (c) => c[0].detail.type === "star-clicked",
      ).length;
      clickStar(cassio, document.getElementById("bg-canvas")); // wrong constellation
      const afterStars = listener.mock.calls.filter(
        (c) => c[0].detail.type === "star-clicked",
      ).length;
      // Wrong-hit should not dispatch a star-clicked event.
      expect(afterStars).toBe(beforeStars);
    } finally {
      window.removeEventListener("achievement", listener);
    }
  });

  it("refreshes the particle chain to isActive: true immediately after gesture activation", async () => {
    // Regression: the trigger's emit() inside the completing click ran
    // before the factory's runMidpoint flipped isActive=true at the
    // wipe midpoint.  Without an explicit refresh in onActivate, the
    // particle renderer kept chainState.isActive=false until the user's
    // next click — chain lines rendered at LINE_OPACITY_BASE instead of
    // LINE_OPACITY_ACTIVE and the cosmic-dust pass was gated off.
    const setChainCalls = [];
    vi.doMock("../../js/particles/constellation.js", () => ({
      createConstellation: () => ({
        setChain: (state) =>
          setChainCalls.push({ ...state, chain: state.chain.slice() }),
        draw: () => {},
      }),
    }));
    try {
      const { getSkyStars } = await setupConstellation();
      const targets = starsOf("orions-belt", getSkyStars);
      for (const s of targets)
        clickStar(s, document.getElementById("bg-canvas"));
      flushWipe();

      expect(setChainCalls.length).toBeGreaterThan(0);
      expect(setChainCalls.at(-1).isActive).toBe(true);
    } finally {
      vi.doUnmock("../../js/particles/constellation.js");
    }
  });

  it("clears a stale partial chain when activation runs without a gesture payload", async () => {
    // Regression: HUD-toggling the theme on while the trigger still
    // held a partial chain ([a, b] with candidateId set but no
    // activatedConstellationId) left target() unable to resolve a
    // constellation in the active branch — force was pinned at 0 and
    // gesture deactivation became unreachable.  onActivate's reset on
    // the no-payload path clears the stale state.
    const setChainCalls = [];
    vi.doMock("../../js/particles/constellation.js", () => ({
      createConstellation: () => ({
        setChain: (state) =>
          setChainCalls.push({ ...state, chain: state.chain.slice() }),
        draw: () => {},
      }),
    }));
    try {
      const { getSkyStars } = await setupConstellation();
      const targets = starsOf("orions-belt", getSkyStars);
      clickStar(targets[0], document.getElementById("bg-canvas"));
      clickStar(targets[1], document.getElementById("bg-canvas"));
      // Sanity: trigger has a partial chain before HUD activation.
      expect(setChainCalls.at(-1).chain).toHaveLength(2);

      const { toggleTheme } = await import("../../js/themes/registry.js");
      toggleTheme("constellation");
      flushWipe();

      expect(document.body.classList.contains("constellation")).toBe(true);
      const last = setChainCalls.at(-1);
      expect(last.chain).toEqual([]);
      expect(last.candidateId).toBe(null);
      expect(last.isActive).toBe(true);
    } finally {
      vi.doUnmock("../../js/particles/constellation.js");
    }
  });

  it("clears trigger state on HUD-toggled deactivation so the next click starts fresh", async () => {
    // Regression: activating via gesture, deactivating via toggleTheme
    // (HUD path) used to leave the trigger's chain array intact.  The
    // next click on a tagged star removed it from that stale chain
    // instead of starting a new one, and the rest of the prior
    // constellation re-appeared in the renderer.
    const { getSkyStars } = await setupConstellation();
    const targets = starsOf("orions-belt", getSkyStars);
    for (const s of targets) clickStar(s, document.getElementById("bg-canvas"));
    flushWipe();
    expect(document.body.classList.contains("constellation")).toBe(true);

    const { toggleTheme } = await import("../../js/themes/registry.js");
    toggleTheme("constellation");
    flushWipe();
    expect(document.body.classList.contains("constellation")).toBe(false);

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    try {
      clickStar(targets[0], document.getElementById("bg-canvas"));
      const starClicks = listener.mock.calls.filter(
        (c) => c[0].detail.type === "star-clicked",
      );
      expect(starClicks).toHaveLength(1);
      // Chain has exactly one entry — the just-clicked star — not the
      // prior activation chain minus that entry.
      expect(starClicks[0][0].detail.chainLength).toBe(1);
    } finally {
      window.removeEventListener("achievement", listener);
    }
  });

  it("re-clicking every active star deactivates the theme via the reverse wipe", async () => {
    const { getSkyStars } = await setupConstellation();
    const targets = starsOf("orions-belt", getSkyStars);

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    try {
      // Activate
      for (const s of targets)
        clickStar(s, document.getElementById("bg-canvas"));
      flushWipe();
      expect(document.body.classList.contains("constellation")).toBe(true);

      // Re-click every star to drive deactivation force 0 → 1
      for (const s of targets)
        clickStar(s, document.getElementById("bg-canvas"));
      flushWipe();

      expect(document.body.classList.contains("constellation")).toBe(false);

      const deactivateEvents = listener.mock.calls.filter(
        (c) =>
          c[0].detail.type === "theme-deactivate" &&
          c[0].detail.theme === "constellation",
      );
      expect(deactivateEvents).toHaveLength(1);
    } finally {
      window.removeEventListener("achievement", listener);
    }
  });

  it("emits achievement events for each constellation drawn so the tracker can map ids", async () => {
    const { getSkyStars } = await setupConstellation();
    const targets = starsOf("ursa-major", getSkyStars);
    expect(targets.length).toBe(7);

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    try {
      for (const s of targets)
        clickStar(s, document.getElementById("bg-canvas"));
      flushWipe();

      const formed = listener.mock.calls.filter(
        (c) => c[0].detail.type === "constellation-formed",
      );
      expect(formed).toHaveLength(1);
      expect(formed[0][0].detail.constellationId).toBe("ursa-major");
    } finally {
      window.removeEventListener("achievement", listener);
    }
  });
});
