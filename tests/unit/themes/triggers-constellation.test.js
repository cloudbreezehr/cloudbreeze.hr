import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createConstellationTrigger } from "../../../js/themes/triggers.js";

// A stub ctx that mimics what createTheme hands to trigger.start(). Tests
// drive setForce/complete flags manually so the trigger can be exercised
// without spinning up the full factory.
function makeStubCtx(overrides = {}) {
  const state = {
    active: false,
    transitioning: false,
    force: 0,
    ...overrides,
  };
  const ctx = {
    setForce: vi.fn((f) => {
      state.force = f;
    }),
    complete: vi.fn(),
    isActive: () => state.active,
    isTransitioning: () => state.transitioning,
    state,
  };
  return ctx;
}

// Build a sky-like star object that's compatible with the trigger's
// screen-position math (depth × scrollProgress × parallaxScale).  With
// happy-dom's default scroll (0) the parallax shift is always zero, so
// star.x / star.y can be treated as direct screen coordinates.
function makeStar(constellationId, constellationIndex, x, y) {
  return {
    x,
    y,
    depth: 0.5,
    constellationId,
    constellationIndex,
  };
}

const CANVAS_W = 800;
const CANVAS_H = 600;

function dispatchClick(x, y) {
  document.body.dispatchEvent(
    new MouseEvent("click", {
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe("createConstellationTrigger", () => {
  let stars;
  const activeTriggers = [];
  const getStars = () => stars;
  const getCanvas = () => ({ width: CANVAS_W, height: CANVAS_H });

  // Wrap construction so afterEach can stop every trigger this case
  // produced.  Without this the capture-phase document listener bleeds
  // into the next test and intercepts unrelated clicks.
  function makeTrigger(overrides = {}) {
    const trig = createConstellationTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      ...overrides,
    });
    activeTriggers.push(trig);
    return trig;
  }

  beforeEach(() => {
    stars = [];
    activeTriggers.length = 0;
  });

  afterEach(() => {
    for (const t of activeTriggers) t.stop();
    activeTriggers.length = 0;
    document.body.className = "";
  });

  it("first tagged-star hit locks the candidate and pushes onto the chain", () => {
    stars = [
      makeStar(null, -1, 50, 50), // background star, untagged
      makeStar("orions-belt", 0, 100, 100),
      makeStar("orions-belt", 1, 200, 100),
      makeStar("orions-belt", 2, 300, 100),
    ];
    const ctx = makeStubCtx();
    const onChainChange = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onChainChange,
    });
    trigger.start(ctx);

    dispatchClick(100, 100);

    expect(onChainChange).toHaveBeenCalled();
    const state = onChainChange.mock.calls.at(-1)[0];
    expect(state.candidateId).toBe("orions-belt");
    expect(state.chain).toHaveLength(1);
    expect(ctx.setForce).toHaveBeenLastCalledWith(1 / 3);
  });

  it("reports chain length and constellation size to onCorrectHit", () => {
    stars = [
      makeStar("orions-belt", 0, 100, 100),
      makeStar("orions-belt", 1, 200, 100),
      makeStar("orions-belt", 2, 300, 100),
    ];
    const ctx = makeStubCtx();
    const onCorrectHit = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onCorrectHit,
    });
    trigger.start(ctx);

    dispatchClick(100, 100);
    dispatchClick(200, 100);

    expect(onCorrectHit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        constellationId: "orions-belt",
        chainLength: 2,
        total: 3,
      }),
    );
  });

  it("reaches force 1 and calls complete after every star of a constellation is hit", () => {
    stars = [
      makeStar("orions-belt", 0, 100, 100),
      makeStar("orions-belt", 1, 200, 100),
      makeStar("orions-belt", 2, 300, 100),
    ];
    const ctx = makeStubCtx();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
    });
    trigger.start(ctx);

    dispatchClick(100, 100);
    dispatchClick(200, 100);
    expect(ctx.complete).not.toHaveBeenCalled();
    dispatchClick(300, 100);

    expect(ctx.complete).toHaveBeenCalledOnce();
    const [payload] = ctx.complete.mock.calls[0];
    expect(payload).toEqual({ constellationId: "orions-belt" });
  });

  it("clicking an already-chained star toggles it back out", () => {
    stars = [
      makeStar("orions-belt", 0, 100, 100),
      makeStar("orions-belt", 1, 200, 100),
      makeStar("orions-belt", 2, 300, 100),
    ];
    const ctx = makeStubCtx();
    const onChainChange = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onChainChange,
    });
    trigger.start(ctx);

    dispatchClick(100, 100);
    dispatchClick(200, 100);
    expect(onChainChange.mock.calls.at(-1)[0].chain).toHaveLength(2);

    dispatchClick(200, 100);
    expect(onChainChange.mock.calls.at(-1)[0].chain).toHaveLength(1);
    expect(ctx.setForce).toHaveBeenLastCalledWith(1 / 3);
  });

  it("removing the last star clears the candidate so the user can pick a new one", () => {
    stars = [
      makeStar("orions-belt", 0, 100, 100),
      makeStar("cassiopeia", 0, 500, 100),
    ];
    const ctx = makeStubCtx();
    const onChainChange = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onChainChange,
    });
    trigger.start(ctx);

    dispatchClick(100, 100);
    expect(onChainChange.mock.calls.at(-1)[0].candidateId).toBe("orions-belt");
    dispatchClick(100, 100); // toggle out
    expect(onChainChange.mock.calls.at(-1)[0].candidateId).toBe(null);

    dispatchClick(500, 100);
    expect(onChainChange.mock.calls.at(-1)[0].candidateId).toBe("cassiopeia");
  });

  it("clicking a star of a different constellation while a candidate is locked is ignored", () => {
    stars = [
      makeStar("orions-belt", 0, 100, 100),
      makeStar("cassiopeia", 0, 500, 100),
    ];
    const ctx = makeStubCtx();
    const onWrongHit = vi.fn();
    const onChainChange = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onChainChange,
      onWrongHit,
    });
    trigger.start(ctx);

    dispatchClick(100, 100); // locks orions-belt
    onChainChange.mockClear();
    dispatchClick(500, 100); // cassiopeia star — should be wrong-hit

    expect(onWrongHit).toHaveBeenCalledOnce();
    expect(onChainChange).not.toHaveBeenCalled();
  });

  it("non-tagged stars and pure misses don't enter the chain", () => {
    stars = [
      makeStar(null, -1, 100, 100), // background
      makeStar("orions-belt", 0, 500, 500),
    ];
    const ctx = makeStubCtx();
    const onChainChange = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onChainChange,
    });
    trigger.start(ctx);

    dispatchClick(100, 100); // hits background star → no chain change
    dispatchClick(900, 900); // far from any star → no chain change

    expect(onChainChange).not.toHaveBeenCalled();
  });

  it("ignores clicks while isTransitioning is true", () => {
    stars = [makeStar("orions-belt", 0, 100, 100)];
    const ctx = makeStubCtx({ transitioning: true });
    const onChainChange = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onChainChange,
    });
    trigger.start(ctx);

    dispatchClick(100, 100);

    expect(ctx.setForce).not.toHaveBeenCalled();
    expect(onChainChange).not.toHaveBeenCalled();
  });

  it("ignores clicks on UI overlays (nav, achievement panel)", () => {
    stars = [makeStar("orions-belt", 0, 100, 100)];
    const nav = document.createElement("nav");
    document.body.appendChild(nav);

    const ctx = makeStubCtx();
    const onChainChange = vi.fn();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
      onChainChange,
    });
    trigger.start(ctx);

    // Dispatch the event from nav — capture-phase listener fires on document
    // but the closest("nav, ...") check short-circuits before hit-test.
    nav.dispatchEvent(
      new MouseEvent("click", {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      }),
    );

    expect(onChainChange).not.toHaveBeenCalled();
    nav.remove();
  });

  it("re-dispatches an intercepted click event so click-count milestones still tally", () => {
    stars = [makeStar("orions-belt", 0, 100, 100)];
    const ctx = makeStubCtx();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
    });
    trigger.start(ctx);

    const seen = vi.fn();
    window.addEventListener("achievement", seen);
    try {
      dispatchClick(100, 100);
      const clickEvents = seen.mock.calls.filter(
        (c) => c[0].detail.type === "click",
      );
      expect(clickEvents).toHaveLength(1);
      expect(clickEvents[0][0].detail.intercepted).toBe(true);
    } finally {
      window.removeEventListener("achievement", seen);
    }
  });

  it("during active state the trigger drains as the chain shrinks and completes at 0", () => {
    stars = [
      makeStar("orions-belt", 0, 100, 100),
      makeStar("orions-belt", 1, 200, 100),
      makeStar("orions-belt", 2, 300, 100),
    ];
    const ctx = makeStubCtx();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
    });
    trigger.start(ctx);

    // Activate: complete the constellation
    dispatchClick(100, 100);
    dispatchClick(200, 100);
    dispatchClick(300, 100);
    expect(ctx.complete).toHaveBeenCalledOnce();
    ctx.complete.mockClear();
    ctx.state.active = true;

    // Deactivation: re-clicking each star removes it; force grows 0→1.
    dispatchClick(100, 100);
    expect(ctx.setForce).toHaveBeenLastCalledWith(1 / 3);
    dispatchClick(200, 100);
    expect(ctx.setForce).toHaveBeenLastCalledWith(2 / 3);
    dispatchClick(300, 100);

    expect(ctx.complete).toHaveBeenCalledOnce();
    const [payload] = ctx.complete.mock.calls[0];
    expect(payload).toEqual({ constellationId: "orions-belt" });
  });

  it("getState snapshots the chain without leaking the internal array", () => {
    stars = [
      makeStar("orions-belt", 0, 100, 100),
      makeStar("orions-belt", 1, 200, 100),
    ];
    const ctx = makeStubCtx();
    const trigger = makeTrigger({
      getStars,
      getCanvas,
      hitRadius: 30,
    });
    trigger.start(ctx);

    dispatchClick(100, 100);
    const snap = trigger.getState();
    expect(snap.chain).toHaveLength(1);
    snap.chain.length = 0;
    // External mutation must not affect the trigger's own state.
    dispatchClick(200, 100);
    expect(trigger.getState().chain).toHaveLength(2);
  });
});
