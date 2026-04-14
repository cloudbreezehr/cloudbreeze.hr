import { drawTrail } from './canvas-utils.js';
import { STAR_FADE_END, SHOOTING_X_SPREAD, SHOOTING_X_OFFSET, SHOOTING_ANGLE_MIN } from './sky.js';

// ── Click Fury ──
const FURY_MAX = 60;
const FURY_PER_CLICK = 1;
const FURY_IDLE_GRACE = 0.4;
const FURY_DECAY_BASE = 4;
const FURY_DECAY_ACCEL = 32;

// ── Lightning (Tier 1) ──
const FURY_TIER1 = 25;
const LIGHTNING_MAX_BOLTS = 6;
const LIGHTNING_STEPS_MIN = 14;
const LIGHTNING_STEPS_RANGE = 8;
const LIGHTNING_JITTER_X = 90;
const LIGHTNING_JITTER_Y = 30;
const LIGHTNING_BRANCH_CHANCE = 0.35;
const LIGHTNING_BRANCH_ANGLE = 0.9;
const LIGHTNING_BRANCH_LEN_MIN = 40;
const LIGHTNING_BRANCH_LEN_RANGE = 80;
const LIGHTNING_BRANCH_STEPS_MIN = 5;
const LIGHTNING_BRANCH_STEPS_RANGE = 4;
const LIGHTNING_BRANCH_JITTER_X = 40;
const LIGHTNING_BRANCH_JITTER_Y = 20;
const LIGHTNING_LIFE_MIN = 14;
const LIGHTNING_LIFE_RANGE = 10;
const LIGHTNING_FLASH_ALPHA = 0.08;
const LIGHTNING_START_SPREAD = 200;
const LIGHTNING_START_Y = 0.2;
const LIGHTNING_OPACITY = 0.95;
const LIGHTNING_BLOOM_WIDTH = 28;
const LIGHTNING_BLOOM_ALPHA = 0.07;
const LIGHTNING_OUTER_WIDTH = 12;
const LIGHTNING_OUTER_ALPHA = 0.15;
const LIGHTNING_MID_WIDTH = 5;
const LIGHTNING_MID_ALPHA = 0.5;
const LIGHTNING_CORE_WIDTH = 1.5;
const LIGHTNING_CORE_ALPHA = 1.0;
const LIGHTNING_FLICKER_COUNT_MIN = 1;
const LIGHTNING_FLICKER_COUNT_RANGE = 2;
const LIGHTNING_FLICKER_ALPHA = 0.6;
const LIGHTNING_MICRO_JITTER = 1.5;

// ── Aurora (Tier 2) ──
const FURY_TIER2 = 40;
const AURORA_RAMP = 10;
const AURORA_EASE = 0.02;
const AURORA_ALPHA = 0.15;
const AURORA_WAVE_COUNT = 4;
const AURORA_Y_MIN = 0.05;
const AURORA_Y_RANGE = 0.2;
const AURORA_SPEED_MIN = 0.005;
const AURORA_SPEED_RANGE = 0.008;
const AURORA_AMP_MIN = 15;
const AURORA_AMP_RANGE = 25;
const AURORA_WIDTH_MIN = 40;
const AURORA_WIDTH_RANGE = 60;
const AURORA_STEP = 24;
const AURORA_WAVE_FREQ = 6;
const AURORA_HARMONIC_PHASE = 1.3;
const AURORA_HARMONIC_FREQ = 3;
const AURORA_HARMONIC_AMP = 0.5;
const AURORA_BAND_MAIN_RATIO = 0.6;
const AURORA_BAND_HARMONIC_RATIO = 0.3;
const AURORA_BAND_OFFSET = 0.4;
const AURORA_HUE_SHIFT_MID = 20;
const AURORA_HUE_SHIFT_EDGE = 40;

// ── Meteors (Tier 3) ──
const FURY_TIER3 = 55;
const METEOR_POOL_SIZE = 20;
const METEOR_SPEED_MIN = 8;
const METEOR_SPEED_RANGE = 12;
const METEOR_LEN_MIN = 50;
const METEOR_LEN_RANGE = 80;
const METEOR_OPACITY_MIN = 0.4;
const METEOR_OPACITY_RANGE = 0.4;
const METEOR_LIFE_MIN = 18;
const METEOR_LIFE_RANGE = 18;
const METEOR_BURST_MIN = 2;
const METEOR_BURST_RANGE = 3;
const METEOR_LINE_WIDTH = 1.8;

// ── Factory ──

export function createFury() {
  let clickFury = 0;
  let lastClickTime = 0;
  const lightningBolts = [];
  const auroraWaves = [];
  let auroraIntensity = 0;
  const meteorPool = Array.from({length: METEOR_POOL_SIZE}, () => ({
    active: false, x: 0, y: 0, angle: 0, speed: 0,
    len: 0, life: 0, maxLife: 0, opacity: 0,
  }));

  function spawnLightning(x1, y1, x2, y2, depth) {
    const isBranch = depth > 0;
    const stepsMin = isBranch ? LIGHTNING_BRANCH_STEPS_MIN : LIGHTNING_STEPS_MIN;
    const stepsRange = isBranch ? LIGHTNING_BRANCH_STEPS_RANGE : LIGHTNING_STEPS_RANGE;
    const jitterX = isBranch ? LIGHTNING_BRANCH_JITTER_X : LIGHTNING_JITTER_X;
    const jitterY = isBranch ? LIGHTNING_BRANCH_JITTER_Y : LIGHTNING_JITTER_Y;
    const steps = stepsMin + Math.floor(Math.random() * stepsRange);
    const points = [{x: x1, y: y1}];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const envelope = Math.sin(t * Math.PI);
      const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitterX * envelope;
      const ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitterY * envelope;
      points.push({x: nx, y: ny});
      if (depth < 2 && Math.random() < LIGHTNING_BRANCH_CHANCE) {
        const bAngle = Math.atan2(ny - points[points.length - 2].y, nx - points[points.length - 2].x)
                      + (Math.random() - 0.5) * LIGHTNING_BRANCH_ANGLE;
        const bLen = LIGHTNING_BRANCH_LEN_MIN + Math.random() * LIGHTNING_BRANCH_LEN_RANGE;
        spawnLightning(nx, ny, nx + Math.cos(bAngle) * bLen, ny + Math.sin(bAngle) * bLen, depth + 1);
      }
    }
    const maxLife = LIGHTNING_LIFE_MIN + Math.random() * LIGHTNING_LIFE_RANGE;
    const flickerCount = LIGHTNING_FLICKER_COUNT_MIN + Math.floor(Math.random() * LIGHTNING_FLICKER_COUNT_RANGE);
    const flickerFrames = [];
    for (let f = 0; f < flickerCount; f++) {
      flickerFrames.push(2 + Math.floor(Math.random() * (maxLife * 0.6)));
    }
    lightningBolts.push({ points, depth, life: 0, maxLife, flickerFrames });
  }

  return {
    // Draw fury effects: decay, lightning, aurora, meteors.
    draw(ctx, canvas, pal, sp, dt, now) {
      // Fury decay — no decay while actively clicking, then ramps up fast
      const idleSec = (now - lastClickTime) / 1000;
      if (idleSec >= FURY_IDLE_GRACE) {
        const decayRate = FURY_DECAY_BASE + (idleSec - FURY_IDLE_GRACE) * FURY_DECAY_ACCEL;
        clickFury = Math.max(0, clickFury - dt * decayRate);
      }

      // Tier 1: Lightning bolts — multi-layer rendering
      let flashThisFrame = false;
      for (let i = lightningBolts.length - 1; i >= 0; i--) {
        const bolt = lightningBolts[i];
        bolt.life++;
        if (bolt.life > bolt.maxLife) { lightningBolts.splice(i, 1); continue; }
        if (bolt.life === 1) flashThisFrame = true;

        const t = bolt.life / bolt.maxLife;
        let fade = Math.pow(1 - t, 2.5);
        const isFlicker = bolt.flickerFrames.indexOf(bolt.life) !== -1;
        if (isFlicker) fade = Math.max(fade, LIGHTNING_FLICKER_ALPHA);

        const col = pal.lightningColor;
        const sc = pal.lightningShadow;
        const branchScale = bolt.depth === 0 ? 1 : 0.45;
        const jitterSeed = bolt.life * 7.13;

        const tracePath = (jitter) => {
          const pts = bolt.points;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let p = 1; p < pts.length; p++) {
            const jx = jitter ? Math.sin(jitterSeed + p * 3.7) * LIGHTNING_MICRO_JITTER : 0;
            const jy = jitter ? Math.cos(jitterSeed + p * 2.3) * LIGHTNING_MICRO_JITTER : 0;
            if (p < pts.length - 1) {
              const mx = (pts[p].x + jx + pts[p + 1].x) * 0.5;
              const my = (pts[p].y + jy + pts[p + 1].y) * 0.5;
              ctx.quadraticCurveTo(pts[p].x + jx, pts[p].y + jy, mx, my);
            } else {
              ctx.lineTo(pts[p].x + jx, pts[p].y + jy);
            }
          }
        };

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'lighter';

        ctx.globalAlpha = fade * LIGHTNING_BLOOM_ALPHA * branchScale * LIGHTNING_OPACITY;
        ctx.strokeStyle = `rgb(${sc[0]},${sc[1]},${sc[2]})`;
        ctx.lineWidth = LIGHTNING_BLOOM_WIDTH * branchScale;
        tracePath(false);
        ctx.stroke();

        ctx.globalAlpha = fade * LIGHTNING_OUTER_ALPHA * branchScale * LIGHTNING_OPACITY;
        ctx.lineWidth = LIGHTNING_OUTER_WIDTH * branchScale;
        tracePath(false);
        ctx.stroke();

        ctx.globalAlpha = fade * LIGHTNING_MID_ALPHA * branchScale * LIGHTNING_OPACITY;
        ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.lineWidth = LIGHTNING_MID_WIDTH * branchScale;
        tracePath(true);
        ctx.stroke();

        ctx.globalAlpha = fade * LIGHTNING_CORE_ALPHA * LIGHTNING_OPACITY;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = LIGHTNING_CORE_WIDTH * branchScale;
        tracePath(true);
        ctx.stroke();

        ctx.restore();
      }
      if (flashThisFrame) {
        const fc = pal.lightningFlash;
        ctx.save();
        ctx.globalAlpha = LIGHTNING_FLASH_ALPHA;
        ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},1)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Tier 2: Aurora borealis
      const auroraTarget = clickFury >= FURY_TIER2 ? Math.min((clickFury - FURY_TIER2) / AURORA_RAMP, 1) : 0;
      auroraIntensity += (auroraTarget - auroraIntensity) * AURORA_EASE;
      if (auroraIntensity > 0.01) {
        while (auroraWaves.length < AURORA_WAVE_COUNT) {
          auroraWaves.push({
            y: canvas.height * (AURORA_Y_MIN + Math.random() * AURORA_Y_RANGE),
            phase: Math.random() * Math.PI * 2,
            speed: AURORA_SPEED_MIN + Math.random() * AURORA_SPEED_RANGE,
            amp: AURORA_AMP_MIN + Math.random() * AURORA_AMP_RANGE,
            width: AURORA_WIDTH_MIN + Math.random() * AURORA_WIDTH_RANGE,
            hue: pal.auroraHueBase + Math.random() * pal.auroraHueRange,
          });
        }
        const waveY = (w, t, mainScale, harmonicScale) =>
          Math.sin(w.phase + t * AURORA_WAVE_FREQ) * w.amp * mainScale
          + Math.sin(w.phase * AURORA_HARMONIC_PHASE + t * AURORA_HARMONIC_FREQ) * w.amp * harmonicScale;

        const traceEdge = (w, mainScale, harmonicScale, yBase, reverse) => {
          const steps = Math.ceil(canvas.width / AURORA_STEP);
          for (let i = 1; i <= steps; i++) {
            const x = reverse
              ? Math.max(canvas.width - i * AURORA_STEP, 0)
              : Math.min(i * AURORA_STEP, canvas.width);
            const y = yBase + waveY(w, x / canvas.width, mainScale, harmonicScale);
            if (i < steps) {
              const nx = reverse
                ? Math.max(canvas.width - (i + 1) * AURORA_STEP, 0)
                : Math.min((i + 1) * AURORA_STEP, canvas.width);
              const ny = yBase + waveY(w, nx / canvas.width, mainScale, harmonicScale);
              ctx.quadraticCurveTo(x, y, (x + nx) * 0.5, (y + ny) * 0.5);
            } else {
              ctx.lineTo(x, y);
            }
          }
        };

        auroraWaves.forEach(w => {
          w.phase += w.speed;
          if (pal.auroraHueBase < 60 && w.hue > 60) w.hue = (w.hue - 120 + 360) % 360;
          if (pal.auroraHueBase >= 60 && w.hue < 60) w.hue = pal.auroraHueBase + Math.random() * pal.auroraHueRange;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = auroraIntensity * AURORA_ALPHA;
          const grad = ctx.createLinearGradient(0, w.y - w.width, 0, w.y + w.width);
          grad.addColorStop(0, 'transparent');
          grad.addColorStop(0.3, `hsla(${w.hue}, 80%, 60%, 0.6)`);
          grad.addColorStop(0.5, `hsla(${w.hue + AURORA_HUE_SHIFT_MID}, 70%, 50%, 0.8)`);
          grad.addColorStop(0.7, `hsla(${w.hue + AURORA_HUE_SHIFT_EDGE}, 80%, 60%, 0.6)`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          const botBase = w.y + w.width * AURORA_BAND_OFFSET;
          ctx.beginPath();
          ctx.moveTo(0, w.y + waveY(w, 0, 1, AURORA_HARMONIC_AMP));
          traceEdge(w, 1, AURORA_HARMONIC_AMP, w.y, false);
          ctx.lineTo(canvas.width, botBase + waveY(w, 1, AURORA_BAND_MAIN_RATIO, AURORA_BAND_HARMONIC_RATIO));
          traceEdge(w, AURORA_BAND_MAIN_RATIO, AURORA_BAND_HARMONIC_RATIO, botBase, true);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      }

      // Tier 3: Meteor shower
      meteorPool.forEach(m => {
        if (!m.active) return;
        m.life++;
        if (m.life > m.maxLife) { m.active = false; return; }
        const p = m.life / m.maxLife;
        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        const fade = p < 0.08 ? p / 0.08 : (1 - p) / 0.92;
        const op = m.opacity * fade;
        const tailX = m.x - Math.cos(m.angle) * m.len * Math.min(1, p * 3);
        const tailY = m.y - Math.sin(m.angle) * m.len * Math.min(1, p * 3);
        drawTrail(ctx, m.x, m.y, tailX, tailY, pal.meteorColors, op, METEOR_LINE_WIDTH);
      });
    },

    // Handle a click: bump fury, spawn lightning/meteors based on tier.
    click(cx, cy, canvas, sp) {
      clickFury = Math.min(clickFury + FURY_PER_CLICK, FURY_MAX);
      lastClickTime = performance.now();

      // Tier 1: Lightning
      if (clickFury >= FURY_TIER1 && lightningBolts.length < LIGHTNING_MAX_BOLTS) {
        const startX = cx + (Math.random() - 0.5) * LIGHTNING_START_SPREAD;
        const startY = Math.random() * canvas.height * LIGHTNING_START_Y;
        spawnLightning(startX, startY, cx, cy, 0);
      }

      // Tier 3: Meteor shower burst
      if (clickFury >= FURY_TIER3 && sp < STAR_FADE_END) {
        const count = METEOR_BURST_MIN + Math.floor(Math.random() * METEOR_BURST_RANGE);
        for (let i = 0; i < count; i++) {
          const m = meteorPool.find(m => !m.active);
          if (!m) break;
          m.x = Math.random() * canvas.width * SHOOTING_X_SPREAD + canvas.width * SHOOTING_X_OFFSET;
          m.y = Math.random() * canvas.height * 0.3;
          m.angle = Math.PI * SHOOTING_ANGLE_MIN + Math.random() * Math.PI * 0.25;
          m.speed = METEOR_SPEED_MIN + Math.random() * METEOR_SPEED_RANGE;
          m.len = METEOR_LEN_MIN + Math.random() * METEOR_LEN_RANGE;
          m.opacity = METEOR_OPACITY_MIN + Math.random() * METEOR_OPACITY_RANGE;
          m.life = 0;
          m.maxLife = METEOR_LIFE_MIN + Math.random() * METEOR_LIFE_RANGE;
          m.active = true;
        }
      }
    },
  };
}
