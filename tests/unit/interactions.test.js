import { describe, it, expect } from "vitest";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
  applyHoverDrift,
  createInteractions,
} from "../../js/interactions.js";

// The force helpers are the one choke point every particle module passes
// through, so remote pointers folded in here reach every particle on the
// site. Tests assert velocity deltas, not exact magnitudes — the formulas'
// tuning constants are free to move.

function makeForces(overrides = {}) {
  return {
    clickImpulse: { x: 0, y: 0, strength: 0 },
    isDragging: false,
    dragPos: { x: 0, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
    hover: { x: 0, y: 0, active: false },
    remotePointers: [],
    ...overrides,
  };
}

function makeParticle(x, y) {
  return { x, y, vx: 0, vy: 0 };
}

function remote(x, y, overrides = {}) {
  return {
    id: "peer",
    x,
    y,
    active: true,
    isDragging: false,
    holdStrength: 0,
    wellStrength: 0,
    ...overrides,
  };
}

describe("interactions — local force helpers", () => {
  it("repels a particle away from a fresh click impulse", () => {
    const forces = makeForces({
      clickImpulse: { x: 100, y: 100, strength: 5 },
    });
    const p = makeParticle(120, 100);
    applyRepulsion(forces, p, 200, 1);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vy).toBe(0);
  });

  it("attracts a particle toward the local drag point while dragging", () => {
    const forces = makeForces({ isDragging: true, dragPos: { x: 200, y: 0 } });
    const p = makeParticle(100, 0);
    applyAttraction(forces, p, 300, 0.5, 0);
    expect(p.vx).toBeGreaterThan(0);
  });

  it("pulls a particle into an active local well", () => {
    const forces = makeForces({
      isDragging: true,
      dragPos: { x: 0, y: 200 },
      wellStrength: 1,
    });
    const p = makeParticle(0, 100);
    applyWellForce(forces, p);
    expect(p.vy).toBeGreaterThan(0);
  });

  it("drifts a particle toward the hovering cursor, but not mid-drag", () => {
    const forces = makeForces({ hover: { x: 50, y: 0, active: true } });
    const p = makeParticle(0, 0);
    applyHoverDrift(forces, p, 100, 0.2);
    expect(p.vx).toBeGreaterThan(0);

    const dragging = makeForces({
      hover: { x: 50, y: 0, active: true },
      isDragging: true,
    });
    const q = makeParticle(0, 0);
    applyHoverDrift(dragging, q, 100, 0.2);
    expect(q.vx).toBe(0);
  });
});

describe("interactions — remote pointers as force sources", () => {
  it("a remote drag attracts even while the local pointer idles", () => {
    const forces = makeForces({
      remotePointers: [remote(200, 0, { isDragging: true })],
    });
    const p = makeParticle(100, 0);
    applyAttraction(forces, p, 300, 0.5, 0);
    expect(p.vx).toBeGreaterThan(0);
  });

  it("a remote drag applies the same math as a local one", () => {
    const local = makeForces({ isDragging: true, dragPos: { x: 200, y: 40 } });
    const viaRemote = makeForces({
      remotePointers: [remote(200, 40, { isDragging: true })],
    });
    const a = makeParticle(100, 0);
    const b = makeParticle(100, 0);
    applyAttraction(local, a, 300, 0.5, 0.3);
    applyAttraction(viaRemote, b, 300, 0.5, 0.3);
    expect(b).toEqual(a);
  });

  it("a remote well pulls with its own strength", () => {
    const forces = makeForces({
      remotePointers: [remote(0, 200, { isDragging: true, wellStrength: 1 })],
    });
    const p = makeParticle(0, 100);
    applyWellForce(forces, p);
    expect(p.vy).toBeGreaterThan(0);
  });

  it("local and remote forces stack", () => {
    const localOnly = makeForces({
      isDragging: true,
      dragPos: { x: 200, y: 0 },
    });
    const both = makeForces({
      isDragging: true,
      dragPos: { x: 200, y: 0 },
      remotePointers: [remote(250, 0, { isDragging: true })],
    });
    const a = makeParticle(100, 0);
    const b = makeParticle(100, 0);
    applyAttraction(localOnly, a, 300, 0.5, 0);
    applyAttraction(both, b, 300, 0.5, 0);
    expect(b.vx).toBeGreaterThan(a.vx);
  });

  it("a hovering remote pointer drifts particles; a dragging one doesn't", () => {
    const hovering = makeForces({ remotePointers: [remote(50, 0)] });
    const p = makeParticle(0, 0);
    applyHoverDrift(hovering, p, 100, 0.2);
    expect(p.vx).toBeGreaterThan(0);

    const dragging = makeForces({
      remotePointers: [remote(50, 0, { isDragging: true })],
    });
    const q = makeParticle(0, 0);
    applyHoverDrift(dragging, q, 100, 0.2);
    expect(q.vx).toBe(0);
  });

  it("tolerates a forces object with no remotePointers field", () => {
    const forces = makeForces();
    delete forces.remotePointers;
    const p = makeParticle(100, 0);
    applyAttraction(forces, p, 300, 0.5, 0);
    applyWellForce(forces, p);
    applyHoverDrift(forces, p, 100, 0.2);
    expect(p).toEqual(makeParticle(100, 0));
  });
});

// A fake 2D context recording every halo it's asked to draw, so tests can
// assert what the well visuals render without a real canvas.
function recordingCtx() {
  const halos = [];
  const grad = { addColorStop() {} };
  return {
    halos,
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      halos.push({ x: x1, y: y1, r: r1 });
      return grad;
    },
    save() {},
    restore() {},
    beginPath() {},
    arc() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    stroke() {},
    set fillStyle(_) {},
    set strokeStyle(_) {},
    set lineWidth(_) {},
    set lineCap(_) {},
    set globalAlpha(_) {},
    set globalCompositeOperation(_) {},
  };
}

const wellPal = {
  orbitColor: [1, 2, 3],
  clickColor: [4, 5, 6],
  trailColor: [7, 8, 9],
};

describe("interactions — mirrored well visuals across the seam", () => {
  it("renders a linked peer's well aura at its position", () => {
    const inter = createInteractions();
    const ctx = recordingCtx();
    const forces = makeForces({
      remotePointers: [
        remote(300, 150, {
          isDragging: true,
          holdStrength: 1,
          wellStrength: 0.8,
        }),
      ],
    });
    inter.draw(ctx, wellPal, forces);
    // The aura is centred exactly on the source; orbit particles sit offset.
    expect(ctx.halos.some((h) => h.x === 300 && h.y === 150)).toBe(true);
  });

  it("fires distant-well once when a peer's well charges past the threshold", () => {
    const inter = createInteractions();
    const ctx = recordingCtx();
    const events = [];
    const onAch = (e) => events.push(e.detail);
    window.addEventListener("achievement", onAch);
    try {
      const forces = makeForces({
        remotePointers: [
          remote(300, 150, {
            isDragging: true,
            holdStrength: 1,
            wellStrength: 0.8,
          }),
        ],
      });
      for (let i = 0; i < 5; i++) inter.draw(ctx, wellPal, forces);
      expect(events.filter((d) => d.type === "distant-well")).toHaveLength(1);
    } finally {
      window.removeEventListener("achievement", onAch);
    }
  });

  it("does not fire distant-well for a barely-charged peer well", () => {
    const inter = createInteractions();
    const ctx = recordingCtx();
    const events = [];
    const onAch = (e) => events.push(e.detail);
    window.addEventListener("achievement", onAch);
    try {
      const forces = makeForces({
        remotePointers: [
          remote(10, 10, {
            isDragging: true,
            holdStrength: 0.5,
            wellStrength: 0.05,
          }),
        ],
      });
      for (let i = 0; i < 5; i++) inter.draw(ctx, wellPal, forces);
      expect(events.filter((d) => d.type === "distant-well")).toHaveLength(0);
    } finally {
      window.removeEventListener("achievement", onAch);
    }
  });

  it("burst() spawns mirrored particles that the next draw renders", () => {
    const inter = createInteractions();
    const ctx = recordingCtx();
    const forces = makeForces();
    inter.draw(ctx, wellPal, forces);
    const before = ctx.halos.length;
    inter.burst(100, 100, wellPal, { strength: 8, well: 1 });
    inter.draw(ctx, wellPal, forces);
    expect(ctx.halos.length).toBeGreaterThan(before);
  });
});
