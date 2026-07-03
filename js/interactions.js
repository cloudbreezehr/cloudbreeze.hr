import { drawHaloParticle, rgbaStr } from "./canvas-utils.js";
import { notifySectionActivate } from "./dev/registry.js";
import { chance, prefersReducedMotion } from "./motion.js";
import { spawnRipple } from "./effects/ripple.js";
import { mirrorYWhenInverted, getViewportHeight } from "./viewport.js";
import {
  CLICK,
  ORBIT,
  HOLD,
  WELL,
  TRAIL,
  EDGE,
  IMPULSE,
} from "./interactions.constants.js";

// ── Force Helpers ──
// Each helper applies its force for the local pointer, then for every
// entry in `forces.remotePointers` (pointers of linked windows, in local
// coordinates; absent or empty solo). A remote pointer carries the same
// interaction state as the local one, so a neighbour's drag, hold, or
// well moves this window's particles through exactly the same math —
// remote pointers are force sources, not events.

function attractToward(p, x, y, hold, radius, force, tangentFactor) {
  const dx = x - p.x;
  const dy = y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < radius && dist > 5) {
    const f = force * (1 - dist / radius);
    const nx = dx / dist;
    const ny = dy / dist;
    p.vx += nx * f + -ny * f * hold * tangentFactor;
    p.vy += ny * f + nx * f * hold * tangentFactor;
  }
}

function wellToward(p, x, y, strength) {
  const dx = x - p.x;
  const dy = y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const f = (strength * WELL.FORCE_MAX) / (1 + dist * WELL.DISTANCE_DECAY);
  const nx = dx / dist;
  const ny = dy / dist;
  p.vx += nx * f + -ny * f * WELL.TANGENT;
  p.vy += ny * f + nx * f * WELL.TANGENT;
}

function driftToward(p, x, y, radius, strength) {
  const dx = x - p.x;
  const dy = y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < radius && dist > 1) {
    const f = strength * (1 - dist / radius);
    p.vx += (dx / dist) * f;
    p.vy += (dy / dist) * f;
  }
}

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
    attractToward(
      p,
      forces.dragPos.x,
      forces.dragPos.y,
      forces.holdStrength,
      radius,
      force,
      tangentFactor,
    );
  }
  const remotes = forces.remotePointers;
  if (remotes) {
    for (const rp of remotes) {
      if (rp.isDragging) {
        attractToward(
          p,
          rp.x,
          rp.y,
          rp.holdStrength,
          radius,
          force,
          tangentFactor,
        );
      }
    }
  }
}

export function applyWellForce(forces, p) {
  if (forces.wellStrength > 0) {
    wellToward(p, forces.dragPos.x, forces.dragPos.y, forces.wellStrength);
  }
  const remotes = forces.remotePointers;
  if (remotes) {
    for (const rp of remotes) {
      if (rp.wellStrength > 0) wellToward(p, rp.x, rp.y, rp.wellStrength);
    }
  }
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
  if (forces.hover.active && !forces.isDragging) {
    driftToward(p, forces.hover.x, forces.hover.y, radius, strength);
  }
  const remotes = forces.remotePointers;
  if (remotes) {
    for (const rp of remotes) {
      if (rp.active && !rp.isDragging) {
        driftToward(p, rp.x, rp.y, radius, strength);
      }
    }
  }
}

export { HOLD, WELL };

// ── Factory ──

export function createInteractions() {
  const clickParticles = [];
  const orbitParticles = [];
  const trailSegments = [];
  let holdStart = 0;
  let lastTrail = { x: 0, y: 0 };
  let trailDist = 0;

  // Drop oldest entries until below cap so bursts spawned mid-frame still land.
  function pushCapped(arr, item, max) {
    if (arr.length >= max) arr.splice(0, arr.length - max + 1);
    arr.push(item);
  }

  const cursorDot = document.getElementById("cursor");
  const cursorRing = document.getElementById("cursor-ring");

  return {
    // Called each frame from the render loop to draw click particles, orbits,
    // gravity well aura, and drag trail.
    draw(ctx, pal, forces) {
      // Halo opt bags hoisted out of the per-particle loops.  CLICK /
      // ORBIT / WELL are mutable at runtime, so rebuild the opts each
      // frame to pick up live edits, then reuse for every particle in
      // the frame to avoid per-particle allocation churn.
      const clickOpts = {
        midStop: CLICK.GLOW_MID_STOP,
        midAlpha: CLICK.GLOW_MID_ALPHA,
      };
      const orbitOpts = {
        midStop: ORBIT.GLOW_MID_STOP,
        midAlpha: ORBIT.GLOW_MID_ALPHA,
      };
      const auraOpts = {
        midStop: WELL.AURA_MID_STOP,
        midAlpha: WELL.AURA_MID_ALPHA,
      };

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
        drawHaloParticle(
          ctx,
          p.x,
          p.y,
          p.r * CLICK.GLOW_RADIUS,
          op,
          p.color,
          clickOpts,
        );
      }

      // Hold-to-charge orbit particles — spawn, orbit, and glow around cursor
      if (forces.isDragging && forces.holdStrength > HOLD.WARMUP_THRESHOLD) {
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
        if (chance(spawnChance) && orbitParticles.length < maxOrbit) {
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
          drawHaloParticle(
            ctx,
            p.x,
            p.y,
            p.r * ORBIT.GLOW_RADIUS,
            p.opacity,
            oc,
            orbitOpts,
          );
        }
      }

      // Gravity well aura — pulsing radial glow at cursor
      if (forces.wellStrength > 0 && forces.isDragging) {
        const auraR = WELL.AURA_RADIUS * (1 + forces.wellStrength);
        const pulse =
          WELL.AURA_PULSE_BASE +
          WELL.AURA_PULSE_AMP *
            Math.sin((performance.now() / 1000) * WELL.AURA_PULSE_SPEED);
        const auraOp = WELL.AURA_OPACITY * forces.wellStrength * pulse;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        drawHaloParticle(
          ctx,
          forces.dragPos.x,
          forces.dragPos.y,
          auraR,
          auraOp,
          oc,
          auraOpts,
        );
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
        s.x +=
          Math.sin(s.life * TRAIL.SWAY_FREQ_X + s.phase) * TRAIL.SWAY_AMP_X;
        s.y +=
          Math.cos(s.life * TRAIL.SWAY_FREQ_Y + s.phase) * TRAIL.SWAY_AMP_Y;
        const fade = 1 - s.life / s.maxLife;
        const op = s.opacity * fade;
        if (op < CLICK.DRAW_THRESHOLD || !s.prev) continue;
        const c = pal.trailColor;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.strokeStyle = rgbaStr(c, 1);
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

    // Spawn click burst particles at (x, y).
    click(x, y, pal) {
      if (prefersReducedMotion()) return;
      const count =
        CLICK.COUNT_MIN + Math.floor(Math.random() * CLICK.COUNT_RANGE);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = CLICK.SPEED_MIN + Math.random() * CLICK.SPEED_RANGE;
        pushCapped(
          clickParticles,
          {
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
          },
          CLICK.MAX,
        );
      }
    },

    // Spawn directional burst particles along a vertical edge (dock snap / undock release).
    // `centerAngle` points inward from the edge; particles scatter within a cone.
    edgeBurst(edgeX, top, height, type, pal) {
      if (prefersReducedMotion()) return;
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
        pushCapped(
          clickParticles,
          {
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
          },
          CLICK.MAX,
        );
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
      if (
        forces.holdStrength > HOLD.WARMUP_THRESHOLD &&
        prevHold <= HOLD.WARMUP_THRESHOLD
      ) {
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
          new CustomEvent("achievement", {
            detail: {
              type: "well-activate",
              x: forces.dragPos.x,
              y: forces.dragPos.y,
            },
          }),
        );
        cursorDot?.classList.add("gravity-well");
        cursorRing?.classList.add("gravity-well");
        if (!prefersReducedMotion()) {
          spawnRipple(
            forces.dragPos.x,
            mirrorYWhenInverted(forces.dragPos.y, getViewportHeight()),
            {
              className: "well-pulse-ring",
              count: WELL.PULSE_RING_COUNT,
              staggerMs: WELL.PULSE_RING_STAGGER_MS,
              duration: WELL.PULSE_RING_DURATION_MS,
              maxScale: WELL.PULSE_RING_MAX_SCALE,
              startOpacity: WELL.PULSE_RING_OPACITY,
              sound: "wellPulse",
            },
          );
        }
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
      if (prefersReducedMotion()) {
        // Quietly tear down the drag state without any particle burst.
        forces.isDragging = false;
        forces.wellStrength = 0;
        forces.holdStrength = 0;
        orbitParticles.length = 0;
        cursorDot?.classList.remove("gravity-well");
        cursorRing?.classList.remove("gravity-well");
        cursorDot?.style.removeProperty("--well-strength");
        cursorRing?.style.removeProperty("--well-strength");
        return;
      }
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
        const speed =
          blast *
          (HOLD.ORBIT_CONVERT_SPEED_MIN +
            Math.random() * HOLD.ORBIT_CONVERT_SPEED_RANGE);
        pushCapped(
          clickParticles,
          {
            x: p.x,
            y: p.y,
            vx: (dx / dist) * speed + p.vx,
            vy: (dy / dist) * speed + p.vy,
            r: p.r,
            opacity: p.opacity + HOLD.ORBIT_CONVERT_OPACITY_BOOST,
            life: 0,
            maxLife:
              HOLD.EXTRA_BURST_LIFE_MIN +
              Math.random() * HOLD.ORBIT_CONVERT_LIFE_RANGE,
            phase: Math.random() * Math.PI * 2,
            color: pal.clickColor,
          },
          CLICK.MAX,
        );
      });
      orbitParticles.length = 0;

      // Extra burst particles proportional to hold time
      const extraCount = Math.min(
        Math.floor(heldSec * HOLD.EXTRA_BURST_PER_SEC),
        HOLD.EXTRA_BURST_MAX,
      );
      for (let i = 0; i < extraCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed =
          blast *
          (HOLD.EXTRA_BURST_SPEED_MIN +
            Math.random() * HOLD.EXTRA_BURST_SPEED_RANGE);
        pushCapped(
          clickParticles,
          {
            x: forces.dragPos.x,
            y: forces.dragPos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r: CLICK.RADIUS_MIN + Math.random() * CLICK.RADIUS_RANGE,
            opacity: CLICK.OPACITY_MIN + Math.random() * CLICK.OPACITY_RANGE,
            life: 0,
            maxLife:
              HOLD.EXTRA_BURST_LIFE_MIN +
              Math.random() * HOLD.EXTRA_BURST_LIFE_RANGE,
            phase: Math.random() * Math.PI * 2,
            color: pal.clickColor,
          },
          CLICK.MAX,
        );
      }

      // Gravity well burst — massive particle explosion on release
      if (forces.wellStrength > 0) {
        const wellBurst = Math.floor(forces.wellStrength * WELL.BURST_MAX);
        for (let i = 0; i < wellBurst; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed =
            blast *
            (WELL.BURST_SPEED_FACTOR_MIN +
              Math.random() * WELL.BURST_SPEED_FACTOR_RANGE);
          pushCapped(
            clickParticles,
            {
              x: forces.dragPos.x,
              y: forces.dragPos.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              r: CLICK.RADIUS_MIN + Math.random() * WELL.BURST_RADIUS_RANGE,
              opacity:
                WELL.BURST_OPACITY_MIN +
                Math.random() * WELL.BURST_OPACITY_RANGE,
              life: 0,
              maxLife:
                WELL.BURST_LIFE_MIN + Math.random() * WELL.BURST_LIFE_RANGE,
              phase: Math.random() * Math.PI * 2,
              color: pal.clickColor,
            },
            CLICK.MAX,
          );
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
      if (prefersReducedMotion()) return;
      const dx = x - lastTrail.x;
      const dy = y - lastTrail.y;
      trailDist += Math.sqrt(dx * dx + dy * dy);
      if (trailDist > TRAIL.SPACING) {
        pushCapped(
          trailSegments,
          {
            x,
            y,
            prev: { x: lastTrail.x, y: lastTrail.y },
            width: TRAIL.WIDTH_MIN + Math.random() * TRAIL.WIDTH_RANGE,
            opacity: TRAIL.OPACITY_MIN + Math.random() * TRAIL.OPACITY_RANGE,
            life: 0,
            maxLife: TRAIL.LIFE_MIN + Math.random() * TRAIL.LIFE_RANGE,
            phase: Math.random() * Math.PI * 2,
          },
          TRAIL.MAX,
        );
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
