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

// A linked peer's well charged past this, rendered in this window, is the
// "distant well" discovery — a neighbour's gravity well blooming in your sky.
const DISTANT_WELL_MIN_STRENGTH = 0.2;

// ── Well Visuals ──
// Render one pointer source's well: the orbit swarm circling it and the pulsing
// aura while it charges, into `pool` (that source's own orbit particles). The
// local pointer and every linked peer go through here, so a neighbour's well
// blooms in this window exactly as the local one does. `source` is
// {x, y, holdStrength, wellStrength, isDragging}. Orbits fade out when the
// source stops charging — a released local well clears its pool via a burst; a
// remote's simply eases away.
function drawWell(ctx, pal, source, pool, orbitOpts, auraOpts) {
  const charging =
    source.isDragging && source.holdStrength > HOLD.WARMUP_THRESHOLD;

  // Spawn orbit particles while charging (boosted during a gravity well).
  if (charging) {
    const spawnMul =
      source.wellStrength > 0
        ? 1 + source.wellStrength * WELL.ORBIT_SPAWN_BOOST
        : 1;
    const maxOrbit =
      ORBIT.MAX +
      (source.wellStrength > 0
        ? Math.floor(source.wellStrength * WELL.ORBIT_MAX_BOOST)
        : 0);
    const spawnChance = source.holdStrength * ORBIT.SPAWN_FACTOR * spawnMul;
    if (chance(spawnChance) && pool.length < maxOrbit) {
      const angle = Math.random() * Math.PI * 2;
      const dist =
        ORBIT.DIST_MIN +
        Math.random() *
          (ORBIT.DIST_RANGE + source.holdStrength * ORBIT.DIST_HOLD);
      pool.push({
        x: source.x + Math.cos(angle) * dist,
        y: source.y + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        r: ORBIT.RADIUS_MIN + Math.random() * ORBIT.RADIUS_RANGE,
        opacity: 0,
        targetOpacity:
          ORBIT.OPACITY_MIN + source.holdStrength * ORBIT.OPACITY_HOLD,
      });
    }
  }

  // Update and draw orbit particles — pulling inward with a tangential orbit,
  // easing toward the charge's target opacity, or toward zero once it ends.
  const oc = pal.orbitColor;
  const pull = ORBIT.PULL_BASE + source.holdStrength * ORBIT.PULL_HOLD;
  const orbit = ORBIT.TANGENT_BASE + source.holdStrength * ORBIT.TANGENT_HOLD;
  for (let i = pool.length - 1; i >= 0; i--) {
    const p = pool[i];
    const dx = source.x - p.x;
    const dy = source.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    p.vx += nx * pull + -ny * orbit;
    p.vy += ny * pull + nx * orbit;
    p.vx *= ORBIT.FRICTION;
    p.vy *= ORBIT.FRICTION;
    p.x += p.vx;
    p.y += p.vy;
    const target = charging ? p.targetOpacity : 0;
    p.opacity += (target - p.opacity) * ORBIT.OPACITY_EASE;
    if (!charging && p.opacity < ORBIT.DRAW_THRESHOLD) {
      pool.splice(i, 1);
      continue;
    }
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

  // Gravity well aura — pulsing radial glow at the source.
  if (source.wellStrength > 0 && source.isDragging) {
    const auraR = WELL.AURA_RADIUS * (1 + source.wellStrength);
    const pulse =
      WELL.AURA_PULSE_BASE +
      WELL.AURA_PULSE_AMP *
        Math.sin((performance.now() / 1000) * WELL.AURA_PULSE_SPEED);
    const auraOp = WELL.AURA_OPACITY * source.wellStrength * pulse;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawHaloParticle(ctx, source.x, source.y, auraR, auraOp, oc, auraOpts);
    ctx.restore();
  }
}

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

  // Orbit pools for linked peers' wells, keyed by pointer id and pruned when a
  // pointer leaves the live list. The local pointer keeps its own orbitParticles.
  const remoteWells = new Map();
  // A neighbour's well blooming here is a once-per-load discovery.
  let distantWellFired = false;

  // Scatter a ring of click-burst particles at (x, y).
  function spawnClickBurst(x, y, color) {
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
          color,
        },
        CLICK.MAX,
      );
    }
  }

  // Explode a well's stored charge into a burst at (x, y); `blast` sets speed.
  function spawnWellBurst(x, y, color, wellStrength, blast) {
    const wellBurst = Math.floor(wellStrength * WELL.BURST_MAX);
    for (let i = 0; i < wellBurst; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed =
        blast *
        (WELL.BURST_SPEED_FACTOR_MIN +
          Math.random() * WELL.BURST_SPEED_FACTOR_RANGE);
      pushCapped(
        clickParticles,
        {
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: CLICK.RADIUS_MIN + Math.random() * WELL.BURST_RADIUS_RANGE,
          opacity:
            WELL.BURST_OPACITY_MIN + Math.random() * WELL.BURST_OPACITY_RANGE,
          life: 0,
          maxLife: WELL.BURST_LIFE_MIN + Math.random() * WELL.BURST_LIFE_RANGE,
          phase: Math.random() * Math.PI * 2,
          color,
        },
        CLICK.MAX,
      );
    }
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

      // Well visuals for the local pointer and every charging linked peer.
      // Local uses the persistent orbit pool (converted to a burst on release);
      // each remote keeps its own pool, so a neighbour's well blooms here too.
      drawWell(
        ctx,
        pal,
        {
          x: forces.dragPos.x,
          y: forces.dragPos.y,
          holdStrength: forces.holdStrength,
          wellStrength: forces.wellStrength,
          isDragging: forces.isDragging,
        },
        orbitParticles,
        orbitOpts,
        auraOpts,
      );
      const remotes = forces.remotePointers;
      if (remotes && remotes.length) {
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const live = new Set();
        for (const rp of remotes) {
          live.add(rp.id);
          let pool = remoteWells.get(rp.id);
          if (!pool) {
            pool = [];
            remoteWells.set(rp.id, pool);
          }
          drawWell(ctx, pal, rp, pool, orbitOpts, auraOpts);
          // Only celebrate a well the player can actually see bloom — its
          // source must land on this window's slice, not off-canvas.
          if (
            !distantWellFired &&
            rp.wellStrength > DISTANT_WELL_MIN_STRENGTH &&
            rp.x >= 0 &&
            rp.x <= cw &&
            rp.y >= 0 &&
            rp.y <= ch
          ) {
            distantWellFired = true;
            window.dispatchEvent(
              new CustomEvent("achievement", {
                detail: { type: "distant-well" },
              }),
            );
          }
        }
        // Drop pools whose pointer has left the live list.
        for (const id of remoteWells.keys()) {
          if (!live.has(id)) remoteWells.delete(id);
        }
      } else if (remoteWells.size) {
        remoteWells.clear();
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
      spawnClickBurst(x, y, pal.clickColor);
    },

    // Mirror a burst arriving from a linked window — a click scatter, plus a
    // well-release explosion when `well` (0..1) is set. Silent under reduced
    // motion, like the local click burst it mirrors.
    burst(x, y, pal, { strength = HOLD.BLAST_BASE, well = 0 } = {}) {
      if (prefersReducedMotion()) return;
      spawnClickBurst(x, y, pal.clickColor);
      if (well > 0) spawnWellBurst(x, y, pal.clickColor, well, strength);
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
    // Returns a { x, y, strength, well } blast descriptor to mirror into linked
    // windows, or null when there's nothing to mirror.
    releaseDrag(forces, pal) {
      if (!forces.isDragging) return null;
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
        return null;
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

      // Gravity well burst — massive particle explosion on release.
      if (forces.wellStrength > 0) {
        spawnWellBurst(
          forces.dragPos.x,
          forces.dragPos.y,
          pal.clickColor,
          forces.wellStrength,
          blast,
        );
        cursorDot?.classList.remove("gravity-well");
        cursorRing?.classList.remove("gravity-well");
        cursorDot?.style.removeProperty("--well-strength");
        cursorRing?.style.removeProperty("--well-strength");
      }

      // Hand the blast back so the caller can mirror it into linked windows.
      const releasedWell = forces.wellStrength;
      forces.isDragging = false;
      forces.holdStrength = 0;
      forces.wellStrength = 0;
      return {
        x: forces.dragPos.x,
        y: forces.dragPos.y,
        strength: blast,
        well: releasedWell,
      };
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
