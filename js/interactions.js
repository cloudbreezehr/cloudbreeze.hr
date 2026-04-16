import { defineConstants, notifySectionActivate } from "./dev/registry.js";

// ── Click Particles ──
const CLICK = defineConstants("interactions.click", {
  COUNT_MIN: {
    value: 6,
    min: 1,
    max: 30,
    step: 1,
    description: "Minimum particles per click burst",
  },
  COUNT_RANGE: {
    value: 5,
    min: 0,
    max: 20,
    step: 1,
    description: "Burst count variation",
  },
  SPEED_MIN: {
    value: 1.5,
    min: 0,
    max: 10,
    step: 0.1,
    description: "Minimum burst speed",
  },
  SPEED_RANGE: {
    value: 3,
    min: 0,
    max: 10,
    step: 0.1,
    description: "Speed variation",
  },
  RADIUS_MIN: {
    value: 1,
    min: 0.2,
    max: 5,
    step: 0.1,
    description: "Minimum particle radius",
  },
  RADIUS_RANGE: {
    value: 2,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Radius variation",
  },
  OPACITY_MIN: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum particle opacity",
  },
  OPACITY_RANGE: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Opacity variation",
  },
  LIFE_MIN: {
    value: 40,
    min: 5,
    max: 200,
    step: 1,
    description: "Minimum lifetime in frames",
  },
  LIFE_RANGE: {
    value: 30,
    min: 0,
    max: 200,
    step: 1,
    description: "Lifetime variation",
  },
  GRAVITY: {
    value: 0.02,
    min: 0,
    max: 0.2,
    step: 0.005,
    description: "Downward acceleration per frame",
  },
  FRICTION: {
    value: 0.97,
    min: 0.8,
    max: 1,
    step: 0.005,
    description: "Velocity damping per frame",
  },
  GLOW_RADIUS: {
    value: 3,
    min: 1,
    max: 10,
    step: 0.5,
    description: "Glow halo radius multiplier",
  },
  DRAW_THRESHOLD: {
    value: 0.005,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Min opacity to bother drawing",
  },
  BREEZE_FREQ: {
    value: 0.08,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Horizontal sine wave frequency",
  },
  BREEZE_AMP: {
    value: 0.3,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Horizontal sine wave amplitude",
  },
});

// ── Orbit Particles ──
const ORBIT = defineConstants("interactions.orbit", {
  MAX: {
    value: 60,
    min: 5,
    max: 200,
    step: 1,
    description: "Maximum orbit particles",
  },
  SPAWN_FACTOR: {
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Spawn chance multiplied by hold strength",
  },
  DIST_MIN: {
    value: 20,
    min: 5,
    max: 100,
    step: 1,
    description: "Minimum spawn distance from cursor",
  },
  DIST_RANGE: {
    value: 60,
    min: 0,
    max: 200,
    step: 5,
    description: "Spawn distance variation",
  },
  DIST_HOLD: {
    value: 40,
    min: 0,
    max: 100,
    step: 5,
    description: "Extra distance range from hold strength",
  },
  RADIUS_MIN: {
    value: 0.8,
    min: 0.2,
    max: 5,
    step: 0.1,
    description: "Minimum particle radius",
  },
  RADIUS_RANGE: {
    value: 1.8,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Radius variation",
  },
  OPACITY_MIN: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum orbit particle opacity",
  },
  OPACITY_HOLD: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Extra opacity from hold strength",
  },
  PULL_BASE: {
    value: 0.08,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Base inward pull force",
  },
  PULL_HOLD: {
    value: 0.2,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Extra pull from hold strength",
  },
  TANGENT_BASE: {
    value: 0.06,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Base tangential orbit force",
  },
  TANGENT_HOLD: {
    value: 0.18,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Extra tangent from hold strength",
  },
  FRICTION: {
    value: 0.94,
    min: 0.8,
    max: 1,
    step: 0.005,
    description: "Orbit velocity damping per frame",
  },
  OPACITY_EASE: {
    value: 0.06,
    min: 0.01,
    max: 0.3,
    step: 0.01,
    description: "Opacity interpolation speed",
  },
  GLOW_RADIUS: {
    value: 4,
    min: 1,
    max: 10,
    step: 0.5,
    description: "Glow halo radius multiplier",
  },
  DRAW_THRESHOLD: {
    value: 0.005,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Min opacity to bother drawing",
  },
});

// ── Hold & Attract ──
const HOLD = defineConstants("interactions.hold", {
  RAMP_MS: {
    value: 3000,
    min: 500,
    max: 10000,
    step: 100,
    description: "Milliseconds to full hold strength",
  },
  ATTRACT_RADIUS_BASE: {
    value: 250,
    min: 50,
    max: 800,
    step: 10,
    description: "Base attraction radius in pixels",
  },
  ATTRACT_RADIUS_HOLD: {
    value: 200,
    min: 0,
    max: 500,
    step: 10,
    description: "Extra radius from hold strength",
  },
  ATTRACT_FORCE_BASE: {
    value: 0.12,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Base attraction force",
  },
  ATTRACT_FORCE_HOLD: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Extra force from hold strength",
  },
  ATTRACT_TANGENT_FACTOR: {
    value: 0.6,
    min: 0,
    max: 2,
    step: 0.01,
    description: "Tangential orbit factor during attraction",
  },
  BLAST_BASE: {
    value: 3,
    min: 0.5,
    max: 15,
    step: 0.5,
    description: "Release blast strength at zero hold",
  },
  BLAST_PER_SEC: {
    value: 4,
    min: 0,
    max: 20,
    step: 0.5,
    description: "Extra blast per second held",
  },
  BLAST_MAX: {
    value: 15,
    min: 1,
    max: 50,
    step: 1,
    description: "Maximum normal blast strength",
  },
  EXTRA_BURST_PER_SEC: {
    value: 5,
    min: 0,
    max: 20,
    step: 1,
    description: "Extra burst particles per second held",
  },
  EXTRA_BURST_MAX: {
    value: 20,
    min: 0,
    max: 60,
    step: 1,
    description: "Maximum extra burst particles",
  },
  EXTRA_BURST_LIFE_MIN: {
    value: 50,
    min: 10,
    max: 200,
    step: 5,
    description: "Minimum extra burst lifetime",
  },
  EXTRA_BURST_LIFE_RANGE: {
    value: 40,
    min: 0,
    max: 200,
    step: 5,
    description: "Extra burst lifetime variation",
  },
  ORBIT_THRESHOLD: {
    value: 0.5,
    min: 0.1,
    max: 1,
    step: 0.05,
    description: "Hold strength at which orbit is considered locked",
  },
});

// ── Gravity Well (long-press phase 2) ──
const WELL = defineConstants("interactions.well", {
  ACTIVATE_MS: {
    value: 10000,
    min: 2000,
    max: 30000,
    step: 500,
    description: "Milliseconds of hold to activate gravity well",
  },
  RAMP_MS: {
    value: 10000,
    min: 1000,
    max: 30000,
    step: 500,
    description: "Milliseconds from activation to full well strength",
  },
  FORCE_MAX: {
    value: 0.6,
    min: 0.1,
    max: 2,
    step: 0.05,
    description: "Maximum well pull force",
  },
  TANGENT: {
    value: 0.4,
    min: 0,
    max: 2,
    step: 0.05,
    description: "Tangential component of well force",
  },
  DISTANCE_DECAY: {
    value: 0.002,
    min: 0.0001,
    max: 0.02,
    step: 0.0005,
    description: "Inverse-distance falloff rate",
  },
  BLAST_MIN: {
    value: 20,
    min: 5,
    max: 80,
    step: 1,
    description: "Minimum well release blast",
  },
  BLAST_MAX: {
    value: 50,
    min: 10,
    max: 120,
    step: 1,
    description: "Maximum well release blast",
  },
  BURST_MAX: {
    value: 40,
    min: 5,
    max: 100,
    step: 1,
    description: "Maximum well burst particles",
  },
  BURST_LIFE_MIN: {
    value: 60,
    min: 10,
    max: 200,
    step: 5,
    description: "Well burst minimum lifetime",
  },
  BURST_LIFE_RANGE: {
    value: 50,
    min: 0,
    max: 200,
    step: 5,
    description: "Well burst lifetime variation",
  },
  ORBIT_SPAWN_BOOST: {
    value: 3,
    min: 1,
    max: 10,
    step: 0.5,
    description: "Orbit spawn rate multiplier during well",
  },
  ORBIT_MAX_BOOST: {
    value: 30,
    min: 0,
    max: 100,
    step: 5,
    description: "Extra max orbits during well",
  },
  AURA_RADIUS: {
    value: 80,
    min: 20,
    max: 300,
    step: 5,
    description: "Well aura glow radius",
  },
  AURA_OPACITY: {
    value: 0.15,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Well aura peak opacity",
  },
  AURA_PULSE_SPEED: {
    value: 2,
    min: 0.5,
    max: 10,
    step: 0.5,
    description: "Aura pulse animation speed",
  },
});

// ── Drag Trail ──
const TRAIL = defineConstants("interactions.trail", {
  SPACING: {
    value: 8,
    min: 2,
    max: 30,
    step: 1,
    description: "Minimum px between trail segments",
  },
  WIDTH_MIN: {
    value: 1,
    min: 0.2,
    max: 5,
    step: 0.1,
    description: "Minimum segment width",
  },
  WIDTH_RANGE: {
    value: 1.5,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Width variation",
  },
  OPACITY_MIN: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum segment opacity",
  },
  OPACITY_RANGE: {
    value: 0.1,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Opacity variation",
  },
  LIFE_MIN: {
    value: 25,
    min: 5,
    max: 100,
    step: 1,
    description: "Minimum segment lifetime",
  },
  LIFE_RANGE: {
    value: 15,
    min: 0,
    max: 100,
    step: 1,
    description: "Lifetime variation",
  },
  CURVE_JITTER: {
    value: 6,
    min: 0,
    max: 20,
    step: 0.5,
    description: "Control point offset for curve",
  },
});

// ── Edge Burst (dock snap / undock release) ──
const EDGE = defineConstants("interactions.edge", {
  SNAP_COUNT: {
    value: 30,
    min: 5,
    max: 60,
    step: 1,
    description: "Particles per dock snap burst",
  },
  SNAP_SPEED_MIN: {
    value: 3,
    min: 0.5,
    max: 12,
    step: 0.5,
    description: "Minimum snap particle speed",
  },
  SNAP_SPEED_RANGE: {
    value: 5,
    min: 0,
    max: 12,
    step: 0.5,
    description: "Snap speed variation",
  },
  SNAP_CONE: {
    value: 0.8,
    min: 0.2,
    max: 1.5,
    step: 0.05,
    description: "Snap cone half-angle (radians)",
  },
  SNAP_LIFE_MIN: {
    value: 35,
    min: 10,
    max: 100,
    step: 1,
    description: "Minimum snap particle lifetime (frames)",
  },
  SNAP_LIFE_RANGE: {
    value: 30,
    min: 0,
    max: 80,
    step: 1,
    description: "Snap lifetime variation",
  },
  SNAP_RADIUS_MIN: {
    value: 1.5,
    min: 0.5,
    max: 5,
    step: 0.1,
    description: "Minimum snap particle radius",
  },
  SNAP_RADIUS_RANGE: {
    value: 2.5,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Snap radius variation",
  },
  RELEASE_COUNT: {
    value: 18,
    min: 3,
    max: 40,
    step: 1,
    description: "Particles per undock release burst",
  },
  RELEASE_SPEED_MIN: {
    value: 1.5,
    min: 0.5,
    max: 8,
    step: 0.5,
    description: "Minimum release particle speed",
  },
  RELEASE_SPEED_RANGE: {
    value: 3,
    min: 0,
    max: 8,
    step: 0.5,
    description: "Release speed variation",
  },
  RELEASE_CONE: {
    value: 1.2,
    min: 0.3,
    max: 2,
    step: 0.05,
    description: "Release cone half-angle (radians)",
  },
  RELEASE_LIFE_MIN: {
    value: 45,
    min: 10,
    max: 120,
    step: 1,
    description: "Minimum release particle lifetime (frames)",
  },
  RELEASE_LIFE_RANGE: {
    value: 40,
    min: 0,
    max: 100,
    step: 1,
    description: "Release lifetime variation",
  },
  IMPULSE_SNAP: {
    value: 10,
    min: 2,
    max: 25,
    step: 0.5,
    description: "Click impulse strength for dock snap",
  },
  IMPULSE_RELEASE: {
    value: 6,
    min: 1,
    max: 20,
    step: 0.5,
    description: "Click impulse strength for undock release",
  },
  IMPULSE_RADIUS: {
    value: 300,
    min: 50,
    max: 600,
    step: 10,
    description: "Radius of dock impulse effect on existing particles",
  },
  STAGGER_POINTS: {
    value: 5,
    min: 1,
    max: 10,
    step: 1,
    description: "Number of impulse points along edge",
  },
  STAGGER_DELAY_MS: {
    value: 30,
    min: 5,
    max: 100,
    step: 5,
    description: "Delay between staggered impulse points (ms)",
  },
});

// ── Impulse ──
const IMPULSE = defineConstants("interactions.impulse", {
  DECAY: {
    value: 0.88,
    min: 0.5,
    max: 0.99,
    step: 0.01,
    description: "Click impulse strength decay rate",
  },
});

// ── Force Helpers ──

export function applyRepulsion(forces, p, radius, damping) {
  if (forces.clickImpulse.strength > 0.05) {
    const dx = p.x - forces.clickImpulse.x;
    const dy = p.y - forces.clickImpulse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius && dist > 1) {
      const f = forces.clickImpulse.strength * (1 - dist / radius) * damping;
      p.vx += (dx / dist) * f;
      p.vy += (dy / dist) * f;
    }
  }
}

export function applyAttraction(forces, p, radius, force, tangentFactor) {
  if (forces.isDragging) {
    const dx = forces.dragPos.x - p.x;
    const dy = forces.dragPos.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < radius && dist > 5) {
      const f = force * (1 - dist / radius);
      const nx = dx / dist;
      const ny = dy / dist;
      p.vx += nx * f + -ny * f * forces.holdStrength * tangentFactor;
      p.vy += ny * f + nx * f * forces.holdStrength * tangentFactor;
    }
  }
}

export function applyWellForce(forces, p) {
  if (forces.wellStrength <= 0) return;
  const dx = forces.dragPos.x - p.x;
  const dy = forces.dragPos.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const f =
    (forces.wellStrength * WELL.FORCE_MAX) / (1 + dist * WELL.DISTANCE_DECAY);
  const nx = dx / dist;
  const ny = dy / dist;
  p.vx += nx * f + -ny * f * WELL.TANGENT;
  p.vy += ny * f + nx * f * WELL.TANGENT;
}

/**
 * Gentle drift toward the cursor on hover (no click/drag required).
 * Particles within `radius` receive a soft pull toward the hover point.
 * The force is intentionally weak — decorative, not interactive.
 *
 * @param {object} forces - Shared forces object (needs forces.hover)
 * @param {object} p      - Particle with {x, y, vx, vy}
 * @param {number} radius - Influence radius in pixels
 * @param {number} strength - Maximum force at cursor center
 */
export function applyHoverDrift(forces, p, radius, strength) {
  if (!forces.hover.active || forces.isDragging) return;
  const dx = forces.hover.x - p.x;
  const dy = forces.hover.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < radius && dist > 1) {
    const f = strength * (1 - dist / radius);
    p.vx += (dx / dist) * f;
    p.vy += (dy / dist) * f;
  }
}

// Re-export for cross-module use (atmosphere, particles)
export { HOLD, WELL };

// ── Factory ──

export function createInteractions() {
  const clickParticles = [];
  const orbitParticles = [];
  const trailSegments = [];
  let holdStart = 0;
  let lastTrail = { x: 0, y: 0 };
  let trailDist = 0;

  const cursorDot = document.getElementById("cursor");
  const cursorRing = document.getElementById("cursor-ring");

  return {
    // Called each frame from the render loop to draw click particles, orbits,
    // gravity well aura, and drag trail.
    draw(ctx, pal, forces) {
      // Click burst particles
      for (let i = clickParticles.length - 1; i >= 0; i--) {
        const p = clickParticles[i];
        p.life++;
        if (p.life > p.maxLife) {
          clickParticles.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= CLICK.FRICTION;
        p.vy *= CLICK.FRICTION;
        p.vy += CLICK.GRAVITY;
        // Breeze curve
        p.x +=
          Math.sin(p.life * CLICK.BREEZE_FREQ + p.phase) * CLICK.BREEZE_AMP;
        const fade = 1 - p.life / p.maxLife;
        const op = p.opacity * fade;
        if (op < CLICK.DRAW_THRESHOLD) continue;
        const c = p.color;
        const grad = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.r * CLICK.GLOW_RADIUS,
        );
        grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${op})`);
        grad.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${op * 0.4})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * CLICK.GLOW_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hold-to-charge orbit particles — spawn, orbit, and glow around cursor
      if (forces.isDragging && forces.holdStrength > 0.1) {
        // Spawn new orbit particles (boosted during gravity well)
        const spawnMul =
          forces.wellStrength > 0
            ? 1 + forces.wellStrength * WELL.ORBIT_SPAWN_BOOST
            : 1;
        const maxOrbit =
          ORBIT.MAX +
          (forces.wellStrength > 0
            ? Math.floor(forces.wellStrength * WELL.ORBIT_MAX_BOOST)
            : 0);
        const spawnChance = forces.holdStrength * ORBIT.SPAWN_FACTOR * spawnMul;
        if (Math.random() < spawnChance && orbitParticles.length < maxOrbit) {
          const angle = Math.random() * Math.PI * 2;
          const dist =
            ORBIT.DIST_MIN +
            Math.random() *
              (ORBIT.DIST_RANGE + forces.holdStrength * ORBIT.DIST_HOLD);
          orbitParticles.push({
            x: forces.dragPos.x + Math.cos(angle) * dist,
            y: forces.dragPos.y + Math.sin(angle) * dist,
            vx: 0,
            vy: 0,
            r: ORBIT.RADIUS_MIN + Math.random() * ORBIT.RADIUS_RANGE,
            opacity: 0,
            targetOpacity:
              ORBIT.OPACITY_MIN + forces.holdStrength * ORBIT.OPACITY_HOLD,
          });
        }
      }
      // Update and draw orbit particles
      const oc = pal.orbitColor;
      for (let i = orbitParticles.length - 1; i >= 0; i--) {
        const p = orbitParticles[i];
        const dx = forces.dragPos.x - p.x;
        const dy = forces.dragPos.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / dist;
        const ny = dy / dist;
        // Pull inward + orbit tangent
        const pull = ORBIT.PULL_BASE + forces.holdStrength * ORBIT.PULL_HOLD;
        const orbit =
          ORBIT.TANGENT_BASE + forces.holdStrength * ORBIT.TANGENT_HOLD;
        p.vx += nx * pull + -ny * orbit;
        p.vy += ny * pull + nx * orbit;
        p.vx *= ORBIT.FRICTION;
        p.vy *= ORBIT.FRICTION;
        p.x += p.vx;
        p.y += p.vy;
        p.opacity += (p.targetOpacity - p.opacity) * ORBIT.OPACITY_EASE;
        // Draw with glow
        if (p.opacity > ORBIT.DRAW_THRESHOLD) {
          const grad = ctx.createRadialGradient(
            p.x,
            p.y,
            0,
            p.x,
            p.y,
            p.r * ORBIT.GLOW_RADIUS,
          );
          grad.addColorStop(0, `rgba(${oc[0]},${oc[1]},${oc[2]},${p.opacity})`);
          grad.addColorStop(
            0.3,
            `rgba(${oc[0]},${oc[1]},${oc[2]},${p.opacity * 0.4})`,
          );
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * ORBIT.GLOW_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Gravity well aura — pulsing radial glow at cursor
      if (forces.wellStrength > 0 && forces.isDragging) {
        const auraR = WELL.AURA_RADIUS * (1 + forces.wellStrength);
        const pulse =
          0.8 +
          0.2 * Math.sin((performance.now() / 1000) * WELL.AURA_PULSE_SPEED);
        const auraOp = WELL.AURA_OPACITY * forces.wellStrength * pulse;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const auraGrad = ctx.createRadialGradient(
          forces.dragPos.x,
          forces.dragPos.y,
          0,
          forces.dragPos.x,
          forces.dragPos.y,
          auraR,
        );
        auraGrad.addColorStop(0, `rgba(${oc[0]},${oc[1]},${oc[2]},${auraOp})`);
        auraGrad.addColorStop(
          0.5,
          `rgba(${oc[0]},${oc[1]},${oc[2]},${auraOp * 0.3})`,
        );
        auraGrad.addColorStop(1, "transparent");
        ctx.fillStyle = auraGrad;
        ctx.beginPath();
        ctx.arc(forces.dragPos.x, forces.dragPos.y, auraR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Drag breeze trail
      for (let i = trailSegments.length - 1; i >= 0; i--) {
        const s = trailSegments[i];
        s.life++;
        if (s.life > s.maxLife) {
          trailSegments.splice(i, 1);
          continue;
        }
        s.x += Math.sin(s.life * 0.06 + s.phase) * 0.4;
        s.y += Math.cos(s.life * 0.05 + s.phase) * 0.2;
        const fade = 1 - s.life / s.maxLife;
        const op = s.opacity * fade;
        if (op < CLICK.DRAW_THRESHOLD || !s.prev) continue;
        const c = pal.trailColor;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
        ctx.lineWidth = s.width * fade;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.prev.x, s.prev.y);
        ctx.quadraticCurveTo(
          (s.prev.x + s.x) / 2 + Math.sin(s.phase) * TRAIL.CURVE_JITTER,
          (s.prev.y + s.y) / 2 + Math.cos(s.phase) * TRAIL.CURVE_JITTER,
          s.x,
          s.y,
        );
        ctx.stroke();
        ctx.restore();
      }
    },

    // Spawn click burst particles at (x, y). Skipped in blocky mode.
    click(x, y, pal) {
      notifySectionActivate("interactions.click");
      const count =
        CLICK.COUNT_MIN + Math.floor(Math.random() * CLICK.COUNT_RANGE);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = CLICK.SPEED_MIN + Math.random() * CLICK.SPEED_RANGE;
        clickParticles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: CLICK.RADIUS_MIN + Math.random() * CLICK.RADIUS_RANGE,
          opacity: CLICK.OPACITY_MIN + Math.random() * CLICK.OPACITY_RANGE,
          life: 0,
          maxLife: CLICK.LIFE_MIN + Math.random() * CLICK.LIFE_RANGE,
          phase: Math.random() * Math.PI * 2,
          color: pal.clickColor,
        });
      }
    },

    // Spawn directional burst particles along a vertical edge (dock snap / undock release).
    // `centerAngle` points inward from the edge; particles scatter within a cone.
    edgeBurst(edgeX, top, height, type, pal) {
      const isSnap = type === "snap";
      const count = isSnap ? EDGE.SNAP_COUNT : EDGE.RELEASE_COUNT;
      const speedMin = isSnap ? EDGE.SNAP_SPEED_MIN : EDGE.RELEASE_SPEED_MIN;
      const speedRange = isSnap
        ? EDGE.SNAP_SPEED_RANGE
        : EDGE.RELEASE_SPEED_RANGE;
      const cone = isSnap ? EDGE.SNAP_CONE : EDGE.RELEASE_CONE;
      const lifeMin = isSnap ? EDGE.SNAP_LIFE_MIN : EDGE.RELEASE_LIFE_MIN;
      const lifeRange = isSnap ? EDGE.SNAP_LIFE_RANGE : EDGE.RELEASE_LIFE_RANGE;
      const rMin = isSnap ? EDGE.SNAP_RADIUS_MIN : CLICK.RADIUS_MIN;
      const rRange = isSnap ? EDGE.SNAP_RADIUS_RANGE : CLICK.RADIUS_RANGE;
      // Inward direction: left edge → right (0), right edge → left (π)
      const inwardAngle = edgeX < window.innerWidth / 2 ? 0 : Math.PI;

      for (let i = 0; i < count; i++) {
        const t = Math.random();
        const y = top + t * height;
        const angle = inwardAngle + (Math.random() - 0.5) * cone * 2;
        const speed = speedMin + Math.random() * speedRange;
        clickParticles.push({
          x: edgeX,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: rMin + Math.random() * rRange,
          opacity: CLICK.OPACITY_MIN + Math.random() * CLICK.OPACITY_RANGE,
          life: 0,
          maxLife: lifeMin + Math.random() * lifeRange,
          phase: Math.random() * Math.PI * 2,
          color: pal.clickColor,
        });
      }
    },

    // Fire staggered impulses along an edge to push existing particles away.
    edgeImpulse(forces, edgeX, top, height, type) {
      const strength =
        type === "snap" ? EDGE.IMPULSE_SNAP : EDGE.IMPULSE_RELEASE;
      const points = EDGE.STAGGER_POINTS;
      for (let i = 0; i < points; i++) {
        const y = top + ((i + 0.5) / points) * height;
        const delay = i * EDGE.STAGGER_DELAY_MS;
        setTimeout(() => {
          forces.clickImpulse.x = edgeX;
          forces.clickImpulse.y = y;
          forces.clickImpulse.strength = strength;
        }, delay);
      }
    },

    // Compute holdStrength and wellStrength from hold duration. Call each frame.
    updateHold(forces, now) {
      if (!forces.isDragging) return;
      const heldMs = now - holdStart;
      const prevHold = forces.holdStrength;
      forces.holdStrength = Math.min(heldMs / HOLD.RAMP_MS, 1);
      if (forces.holdStrength > 0.1 && prevHold <= 0.1) {
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "hold", duration: heldMs },
          }),
        );
      }
      if (
        forces.holdStrength >= HOLD.ORBIT_THRESHOLD &&
        prevHold < HOLD.ORBIT_THRESHOLD
      ) {
        window.dispatchEvent(
          new CustomEvent("achievement", { detail: { type: "orbit" } }),
        );
      }
      if (forces.holdStrength >= 1 && prevHold < 1) {
        notifySectionActivate("interactions.hold");
        window.dispatchEvent(
          new CustomEvent("achievement", { detail: { type: "hold-full" } }),
        );
      }
      const prevWell = forces.wellStrength;
      forces.wellStrength =
        heldMs > WELL.ACTIVATE_MS
          ? Math.min((heldMs - WELL.ACTIVATE_MS) / WELL.RAMP_MS, 1)
          : 0;
      if (forces.wellStrength > 0 && prevWell === 0) {
        notifySectionActivate("interactions.well");
        window.dispatchEvent(
          new CustomEvent("achievement", { detail: { type: "well-activate" } }),
        );
        cursorDot?.classList.add("gravity-well");
        cursorRing?.classList.add("gravity-well");
      }
      if (forces.wellStrength >= 1 && prevWell < 1) {
        window.dispatchEvent(
          new CustomEvent("achievement", { detail: { type: "well-full" } }),
        );
      }
      if (forces.wellStrength > 0) {
        cursorDot?.style.setProperty(
          "--well-strength",
          forces.wellStrength.toFixed(3),
        );
        cursorRing?.style.setProperty(
          "--well-strength",
          forces.wellStrength.toFixed(3),
        );
      }
    },

    // End the drag: convert orbits to burst, apply well blast, reset state.
    releaseDrag(forces, pal) {
      if (!forces.isDragging) return;
      const heldSec = (performance.now() - holdStart) / 1000;
      const normalBlast = Math.min(
        HOLD.BLAST_BASE + heldSec * HOLD.BLAST_PER_SEC,
        HOLD.BLAST_MAX,
      );
      const wellBlast =
        forces.wellStrength > 0
          ? WELL.BLAST_MIN +
            forces.wellStrength * (WELL.BLAST_MAX - WELL.BLAST_MIN)
          : 0;
      const blast = Math.max(normalBlast, wellBlast);

      // Repel all nearby motes
      forces.clickImpulse.x = forces.dragPos.x;
      forces.clickImpulse.y = forces.dragPos.y;
      forces.clickImpulse.strength = blast;

      // Convert orbit particles into burst particles
      orbitParticles.forEach((p) => {
        const dx = p.x - forces.dragPos.x;
        const dy = p.y - forces.dragPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = blast * (0.4 + Math.random() * 0.6);
        clickParticles.push({
          x: p.x,
          y: p.y,
          vx: (dx / dist) * speed + p.vx,
          vy: (dy / dist) * speed + p.vy,
          r: p.r,
          opacity: p.opacity + 0.1,
          life: 0,
          maxLife: HOLD.EXTRA_BURST_LIFE_MIN + Math.random() * 30,
          phase: Math.random() * Math.PI * 2,
          color: pal.clickColor,
        });
      });
      orbitParticles.length = 0;

      // Extra burst particles proportional to hold time
      const extraCount = Math.min(
        Math.floor(heldSec * HOLD.EXTRA_BURST_PER_SEC),
        HOLD.EXTRA_BURST_MAX,
      );
      for (let i = 0; i < extraCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = blast * (0.3 + Math.random() * 0.7);
        clickParticles.push({
          x: forces.dragPos.x,
          y: forces.dragPos.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: CLICK.RADIUS_MIN + Math.random() * 2.5,
          opacity: CLICK.OPACITY_MIN + Math.random() * CLICK.OPACITY_RANGE,
          life: 0,
          maxLife:
            HOLD.EXTRA_BURST_LIFE_MIN +
            Math.random() * HOLD.EXTRA_BURST_LIFE_RANGE,
          phase: Math.random() * Math.PI * 2,
          color: pal.clickColor,
        });
      }

      // Gravity well burst — massive particle explosion on release
      if (forces.wellStrength > 0) {
        const wellBurst = Math.floor(forces.wellStrength * WELL.BURST_MAX);
        for (let i = 0; i < wellBurst; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = blast * (0.5 + Math.random() * 0.8);
          clickParticles.push({
            x: forces.dragPos.x,
            y: forces.dragPos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r: CLICK.RADIUS_MIN + Math.random() * 3,
            opacity: 0.4 + Math.random() * 0.4,
            life: 0,
            maxLife:
              WELL.BURST_LIFE_MIN + Math.random() * WELL.BURST_LIFE_RANGE,
            phase: Math.random() * Math.PI * 2,
            color: pal.clickColor,
          });
        }
        cursorDot?.classList.remove("gravity-well");
        cursorRing?.classList.remove("gravity-well");
        cursorDot?.style.removeProperty("--well-strength");
        cursorRing?.style.removeProperty("--well-strength");
      }

      forces.isDragging = false;
      forces.holdStrength = 0;
      forces.wellStrength = 0;
    },

    // Record the start of a drag interaction.
    startDrag(forces, x, y) {
      forces.isDragging = true;
      holdStart = performance.now();
      forces.dragPos.x = x;
      forces.dragPos.y = y;
      lastTrail = { x, y };
      trailDist = 0;
    },

    // Add a trail segment along the drag path. Returns true if a segment was added.
    addTrail(forces, x, y) {
      forces.dragPos.x = x;
      forces.dragPos.y = y;
      const dx = x - lastTrail.x;
      const dy = y - lastTrail.y;
      trailDist += Math.sqrt(dx * dx + dy * dy);
      if (trailDist > TRAIL.SPACING) {
        trailSegments.push({
          x,
          y,
          prev: { x: lastTrail.x, y: lastTrail.y },
          width: TRAIL.WIDTH_MIN + Math.random() * TRAIL.WIDTH_RANGE,
          opacity: TRAIL.OPACITY_MIN + Math.random() * TRAIL.OPACITY_RANGE,
          life: 0,
          maxLife: TRAIL.LIFE_MIN + Math.random() * TRAIL.LIFE_RANGE,
          phase: Math.random() * Math.PI * 2,
        });
        lastTrail = { x, y };
        trailDist = 0;
        return true;
      }
      return false;
    },

    // Decay impulse strength each frame.
    decayImpulse(forces) {
      forces.clickImpulse.strength *= IMPULSE.DECAY;
    },
  };
}
