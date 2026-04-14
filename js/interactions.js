// ── Click Particles ──
const CLICK_COUNT_MIN = 6;
const CLICK_COUNT_RANGE = 5;
const CLICK_SPEED_MIN = 1.5;
const CLICK_SPEED_RANGE = 3;
const CLICK_RADIUS_MIN = 1;
const CLICK_RADIUS_RANGE = 2;
const CLICK_OPACITY_MIN = 0.3;
const CLICK_OPACITY_RANGE = 0.4;
const CLICK_LIFE_MIN = 40;
const CLICK_LIFE_RANGE = 30;
const CLICK_GRAVITY = 0.02;
const CLICK_FRICTION = 0.97;
const CLICK_GLOW_RADIUS = 3;
const CLICK_DRAW_THRESHOLD = 0.005;
const CLICK_BREEZE_FREQ = 0.08;
const CLICK_BREEZE_AMP = 0.3;

// ── Orbit Particles ──
const ORBIT_MAX = 60;
const ORBIT_SPAWN_FACTOR = 0.35;
const ORBIT_DIST_MIN = 20;
const ORBIT_DIST_RANGE = 60;
const ORBIT_DIST_HOLD = 40;
const ORBIT_RADIUS_MIN = 0.8;
const ORBIT_RADIUS_RANGE = 1.8;
const ORBIT_OPACITY_MIN = 0.15;
const ORBIT_OPACITY_HOLD = 0.3;
const ORBIT_PULL_BASE = 0.08;
const ORBIT_PULL_HOLD = 0.2;
const ORBIT_TANGENT_BASE = 0.06;
const ORBIT_TANGENT_HOLD = 0.18;
const ORBIT_FRICTION = 0.94;
const ORBIT_OPACITY_EASE = 0.06;
const ORBIT_GLOW_RADIUS = 4;
const ORBIT_DRAW_THRESHOLD = 0.005;

// ── Hold & Attract ──
const HOLD_RAMP_MS = 3000;
export const ATTRACT_RADIUS_BASE = 250;
export const ATTRACT_RADIUS_HOLD = 200;
export const ATTRACT_FORCE_BASE = 0.12;
export const ATTRACT_FORCE_HOLD = 0.4;
export const ATTRACT_TANGENT_FACTOR = 0.6;
export const BLAST_BASE = 3;
const BLAST_PER_SEC = 4;
const BLAST_MAX = 15;
const EXTRA_BURST_PER_SEC = 5;
const EXTRA_BURST_MAX = 20;
const EXTRA_BURST_LIFE_MIN = 50;
const EXTRA_BURST_LIFE_RANGE = 40;

// ── Gravity Well (long-press phase 2) ──
const WELL_ACTIVATE_MS = 10000;
const WELL_RAMP_MS = 10000;
const WELL_FORCE_MAX = 0.6;
const WELL_TANGENT = 0.4;
const WELL_DISTANCE_DECAY = 0.002;
const WELL_BLAST_MIN = 20;
const WELL_BLAST_MAX = 50;
const WELL_BURST_MAX = 40;
const WELL_BURST_LIFE_MIN = 60;
const WELL_BURST_LIFE_RANGE = 50;
const WELL_ORBIT_SPAWN_BOOST = 3;
const WELL_ORBIT_MAX_BOOST = 30;
const WELL_AURA_RADIUS = 80;
const WELL_AURA_OPACITY = 0.15;
const WELL_AURA_PULSE_SPEED = 2;

// ── Drag Trail ──
const TRAIL_SPACING = 8;
const TRAIL_WIDTH_MIN = 1;
const TRAIL_WIDTH_RANGE = 1.5;
const TRAIL_OPACITY_MIN = 0.15;
const TRAIL_OPACITY_RANGE = 0.1;
const TRAIL_LIFE_MIN = 25;
const TRAIL_LIFE_RANGE = 15;
const TRAIL_CURVE_JITTER = 6;

// ── Impulse ──
const IMPULSE_DECAY = 0.88;

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
      p.vx += nx * f + (-ny) * f * forces.holdStrength * tangentFactor;
      p.vy += ny * f + nx * f * forces.holdStrength * tangentFactor;
    }
  }
}

export function applyWellForce(forces, p) {
  if (forces.wellStrength <= 0) return;
  const dx = forces.dragPos.x - p.x;
  const dy = forces.dragPos.y - p.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const f = forces.wellStrength * WELL_FORCE_MAX / (1 + dist * WELL_DISTANCE_DECAY);
  const nx = dx / dist;
  const ny = dy / dist;
  p.vx += nx * f + (-ny) * f * WELL_TANGENT;
  p.vy += ny * f + nx * f * WELL_TANGENT;
}

// ── Factory ──

export function createInteractions() {
  const clickParticles = [];
  const orbitParticles = [];
  const trailSegments = [];
  let holdStart = 0;
  let lastTrail = { x: 0, y: 0 };
  let trailDist = 0;

  const cursorDot = document.getElementById('cursor');
  const cursorRing = document.getElementById('cursor-ring');

  return {
    // Called each frame from the render loop to draw click particles, orbits,
    // gravity well aura, and drag trail.
    draw(ctx, pal, forces) {
      // Click burst particles
      for (let i = clickParticles.length - 1; i >= 0; i--) {
        const p = clickParticles[i];
        p.life++;
        if (p.life > p.maxLife) { clickParticles.splice(i, 1); continue; }
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= CLICK_FRICTION;
        p.vy *= CLICK_FRICTION;
        p.vy += CLICK_GRAVITY;
        // Breeze curve
        p.x += Math.sin(p.life * CLICK_BREEZE_FREQ + p.phase) * CLICK_BREEZE_AMP;
        const fade = 1 - p.life / p.maxLife;
        const op = p.opacity * fade;
        if (op < CLICK_DRAW_THRESHOLD) continue;
        const c = p.color;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * CLICK_GLOW_RADIUS);
        grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${op})`);
        grad.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${op * 0.4})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * CLICK_GLOW_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hold-to-charge orbit particles — spawn, orbit, and glow around cursor
      if (forces.isDragging && forces.holdStrength > 0.1) {
        // Spawn new orbit particles (boosted during gravity well)
        const spawnMul = forces.wellStrength > 0 ? 1 + forces.wellStrength * WELL_ORBIT_SPAWN_BOOST : 1;
        const maxOrbit = ORBIT_MAX + (forces.wellStrength > 0 ? Math.floor(forces.wellStrength * WELL_ORBIT_MAX_BOOST) : 0);
        const spawnChance = forces.holdStrength * ORBIT_SPAWN_FACTOR * spawnMul;
        if (Math.random() < spawnChance && orbitParticles.length < maxOrbit) {
          const angle = Math.random() * Math.PI * 2;
          const dist = ORBIT_DIST_MIN + Math.random() * (ORBIT_DIST_RANGE + forces.holdStrength * ORBIT_DIST_HOLD);
          orbitParticles.push({
            x: forces.dragPos.x + Math.cos(angle) * dist,
            y: forces.dragPos.y + Math.sin(angle) * dist,
            vx: 0, vy: 0,
            r: ORBIT_RADIUS_MIN + Math.random() * ORBIT_RADIUS_RANGE,
            opacity: 0,
            targetOpacity: ORBIT_OPACITY_MIN + forces.holdStrength * ORBIT_OPACITY_HOLD,
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
        const pull = ORBIT_PULL_BASE + forces.holdStrength * ORBIT_PULL_HOLD;
        const orbit = ORBIT_TANGENT_BASE + forces.holdStrength * ORBIT_TANGENT_HOLD;
        p.vx += nx * pull + (-ny) * orbit;
        p.vy += ny * pull + nx * orbit;
        p.vx *= ORBIT_FRICTION;
        p.vy *= ORBIT_FRICTION;
        p.x += p.vx;
        p.y += p.vy;
        p.opacity += (p.targetOpacity - p.opacity) * ORBIT_OPACITY_EASE;
        // Draw with glow
        if (p.opacity > ORBIT_DRAW_THRESHOLD) {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * ORBIT_GLOW_RADIUS);
          grad.addColorStop(0, `rgba(${oc[0]},${oc[1]},${oc[2]},${p.opacity})`);
          grad.addColorStop(0.3, `rgba(${oc[0]},${oc[1]},${oc[2]},${p.opacity * 0.4})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * ORBIT_GLOW_RADIUS, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Gravity well aura — pulsing radial glow at cursor
      if (forces.wellStrength > 0 && forces.isDragging) {
        const auraR = WELL_AURA_RADIUS * (1 + forces.wellStrength);
        const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 1000 * WELL_AURA_PULSE_SPEED);
        const auraOp = WELL_AURA_OPACITY * forces.wellStrength * pulse;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const auraGrad = ctx.createRadialGradient(
          forces.dragPos.x, forces.dragPos.y, 0,
          forces.dragPos.x, forces.dragPos.y, auraR
        );
        auraGrad.addColorStop(0, `rgba(${oc[0]},${oc[1]},${oc[2]},${auraOp})`);
        auraGrad.addColorStop(0.5, `rgba(${oc[0]},${oc[1]},${oc[2]},${auraOp * 0.3})`);
        auraGrad.addColorStop(1, 'transparent');
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
        if (s.life > s.maxLife) { trailSegments.splice(i, 1); continue; }
        s.x += Math.sin(s.life * 0.06 + s.phase) * 0.4;
        s.y += Math.cos(s.life * 0.05 + s.phase) * 0.2;
        const fade = 1 - s.life / s.maxLife;
        const op = s.opacity * fade;
        if (op < CLICK_DRAW_THRESHOLD || !s.prev) continue;
        const c = pal.trailColor;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},1)`;
        ctx.lineWidth = s.width * fade;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.prev.x, s.prev.y);
        ctx.quadraticCurveTo(
          (s.prev.x + s.x) / 2 + Math.sin(s.phase) * TRAIL_CURVE_JITTER,
          (s.prev.y + s.y) / 2 + Math.cos(s.phase) * TRAIL_CURVE_JITTER,
          s.x, s.y
        );
        ctx.stroke();
        ctx.restore();
      }
    },

    // Spawn click burst particles at (x, y). Skipped in blocky mode.
    click(x, y, pal) {
      const count = CLICK_COUNT_MIN + Math.floor(Math.random() * CLICK_COUNT_RANGE);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = CLICK_SPEED_MIN + Math.random() * CLICK_SPEED_RANGE;
        clickParticles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: CLICK_RADIUS_MIN + Math.random() * CLICK_RADIUS_RANGE,
          opacity: CLICK_OPACITY_MIN + Math.random() * CLICK_OPACITY_RANGE,
          life: 0,
          maxLife: CLICK_LIFE_MIN + Math.random() * CLICK_LIFE_RANGE,
          phase: Math.random() * Math.PI * 2,
          color: pal.clickColor,
        });
      }
    },

    // Compute holdStrength and wellStrength from hold duration. Call each frame.
    updateHold(forces, now) {
      if (!forces.isDragging) return;
      const heldMs = now - holdStart;
      forces.holdStrength = Math.min(heldMs / HOLD_RAMP_MS, 1);
      const prevWell = forces.wellStrength;
      forces.wellStrength = heldMs > WELL_ACTIVATE_MS
        ? Math.min((heldMs - WELL_ACTIVATE_MS) / WELL_RAMP_MS, 1)
        : 0;
      if (forces.wellStrength > 0 && prevWell === 0) {
        cursorDot?.classList.add('gravity-well');
        cursorRing?.classList.add('gravity-well');
      }
      if (forces.wellStrength > 0) {
        cursorDot?.style.setProperty('--well-strength', forces.wellStrength.toFixed(3));
        cursorRing?.style.setProperty('--well-strength', forces.wellStrength.toFixed(3));
      }
    },

    // End the drag: convert orbits to burst, apply well blast, reset state.
    releaseDrag(forces, pal) {
      if (!forces.isDragging) return;
      const heldSec = (performance.now() - holdStart) / 1000;
      const normalBlast = Math.min(BLAST_BASE + heldSec * BLAST_PER_SEC, BLAST_MAX);
      const wellBlast = forces.wellStrength > 0
        ? WELL_BLAST_MIN + forces.wellStrength * (WELL_BLAST_MAX - WELL_BLAST_MIN)
        : 0;
      const blast = Math.max(normalBlast, wellBlast);

      // Repel all nearby motes
      forces.clickImpulse.x = forces.dragPos.x;
      forces.clickImpulse.y = forces.dragPos.y;
      forces.clickImpulse.strength = blast;

      // Convert orbit particles into burst particles
      orbitParticles.forEach(p => {
        const dx = p.x - forces.dragPos.x;
        const dy = p.y - forces.dragPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const speed = blast * (0.4 + Math.random() * 0.6);
        clickParticles.push({
          x: p.x, y: p.y,
          vx: (dx / dist) * speed + p.vx,
          vy: (dy / dist) * speed + p.vy,
          r: p.r,
          opacity: p.opacity + 0.1,
          life: 0,
          maxLife: EXTRA_BURST_LIFE_MIN + Math.random() * 30,
          phase: Math.random() * Math.PI * 2,
          color: pal.clickColor,
        });
      });
      orbitParticles.length = 0;

      // Extra burst particles proportional to hold time
      const extraCount = Math.min(Math.floor(heldSec * EXTRA_BURST_PER_SEC), EXTRA_BURST_MAX);
      for (let i = 0; i < extraCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = blast * (0.3 + Math.random() * 0.7);
        clickParticles.push({
          x: forces.dragPos.x, y: forces.dragPos.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: CLICK_RADIUS_MIN + Math.random() * 2.5,
          opacity: CLICK_OPACITY_MIN + Math.random() * CLICK_OPACITY_RANGE,
          life: 0,
          maxLife: EXTRA_BURST_LIFE_MIN + Math.random() * EXTRA_BURST_LIFE_RANGE,
          phase: Math.random() * Math.PI * 2,
          color: pal.clickColor,
        });
      }

      // Gravity well burst — massive particle explosion on release
      if (forces.wellStrength > 0) {
        const wellBurst = Math.floor(forces.wellStrength * WELL_BURST_MAX);
        for (let i = 0; i < wellBurst; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = blast * (0.5 + Math.random() * 0.8);
          clickParticles.push({
            x: forces.dragPos.x, y: forces.dragPos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r: CLICK_RADIUS_MIN + Math.random() * 3,
            opacity: 0.4 + Math.random() * 0.4,
            life: 0,
            maxLife: WELL_BURST_LIFE_MIN + Math.random() * WELL_BURST_LIFE_RANGE,
            phase: Math.random() * Math.PI * 2,
            color: pal.clickColor,
          });
        }
        cursorDot?.classList.remove('gravity-well');
        cursorRing?.classList.remove('gravity-well');
        cursorDot?.style.removeProperty('--well-strength');
        cursorRing?.style.removeProperty('--well-strength');
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
      if (trailDist > TRAIL_SPACING) {
        trailSegments.push({
          x, y,
          prev: { x: lastTrail.x, y: lastTrail.y },
          width: TRAIL_WIDTH_MIN + Math.random() * TRAIL_WIDTH_RANGE,
          opacity: TRAIL_OPACITY_MIN + Math.random() * TRAIL_OPACITY_RANGE,
          life: 0,
          maxLife: TRAIL_LIFE_MIN + Math.random() * TRAIL_LIFE_RANGE,
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
      forces.clickImpulse.strength *= IMPULSE_DECAY;
    },
  };
}
