import { describe, it, expect } from "vitest";
import {
  applyRepulsion,
  applyAttraction,
  applyWellForce,
  applyHoverDrift,
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
