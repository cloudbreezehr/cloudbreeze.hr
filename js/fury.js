import { drawTrail } from "./canvas-utils.js";
import { SKY_SHARED } from "./sky.js";
import { defineConstants } from "./dev/registry.js";

// ── Click Fury ──
const FURY = defineConstants("fury.click", {
  MAX: {
    value: 60,
    min: 10,
    max: 200,
    step: 1,
    description: "Maximum fury accumulation",
  },
  PER_CLICK: {
    value: 1,
    min: 0.1,
    max: 10,
    step: 0.1,
    description: "Fury added per click",
  },
  IDLE_GRACE: {
    value: 0.4,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Seconds before fury begins decaying",
  },
  DECAY_BASE: {
    value: 4,
    min: 0,
    max: 20,
    step: 0.5,
    description: "Base decay rate per second",
  },
  DECAY_ACCEL: {
    value: 32,
    min: 0,
    max: 100,
    step: 1,
    description: "Decay acceleration after grace period",
  },
});

// ── Lightning (Tier 1) ──
const LN = defineConstants("fury.lightning", {
  TIER: {
    value: 25,
    min: 0,
    max: 100,
    step: 1,
    description: "Fury threshold to activate lightning",
  },
  MAX_BOLTS: {
    value: 6,
    min: 1,
    max: 20,
    step: 1,
    description: "Maximum simultaneous bolts",
  },
  STEPS_MIN: {
    value: 14,
    min: 3,
    max: 50,
    step: 1,
    description: "Minimum segments per bolt",
  },
  STEPS_RANGE: {
    value: 8,
    min: 0,
    max: 30,
    step: 1,
    description: "Segment count variation",
  },
  JITTER_X: {
    value: 90,
    min: 0,
    max: 300,
    step: 5,
    description: "Horizontal jitter in pixels",
  },
  JITTER_Y: {
    value: 30,
    min: 0,
    max: 200,
    step: 5,
    description: "Vertical jitter in pixels",
  },
  BRANCH_CHANCE: {
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Chance of branching at each segment",
  },
  BRANCH_ANGLE: {
    value: 0.9,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Branch angle deviation in radians",
  },
  BRANCH_LEN_MIN: {
    value: 40,
    min: 5,
    max: 200,
    step: 5,
    description: "Minimum branch length",
  },
  BRANCH_LEN_RANGE: {
    value: 80,
    min: 0,
    max: 300,
    step: 5,
    description: "Branch length variation",
  },
  BRANCH_STEPS_MIN: {
    value: 5,
    min: 1,
    max: 20,
    step: 1,
    description: "Minimum segments per branch",
  },
  BRANCH_STEPS_RANGE: {
    value: 4,
    min: 0,
    max: 15,
    step: 1,
    description: "Branch segment variation",
  },
  BRANCH_JITTER_X: {
    value: 40,
    min: 0,
    max: 150,
    step: 5,
    description: "Branch horizontal jitter",
  },
  BRANCH_JITTER_Y: {
    value: 20,
    min: 0,
    max: 100,
    step: 5,
    description: "Branch vertical jitter",
  },
  LIFE_MIN: {
    value: 14,
    min: 3,
    max: 60,
    step: 1,
    description: "Minimum bolt lifetime in frames",
  },
  LIFE_RANGE: {
    value: 10,
    min: 0,
    max: 40,
    step: 1,
    description: "Lifetime variation",
  },
  FLASH_ALPHA: {
    value: 0.08,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Full-screen flash overlay opacity",
  },
  START_SPREAD: {
    value: 200,
    min: 10,
    max: 600,
    step: 10,
    description: "Bolt origin horizontal spread",
  },
  START_Y: {
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Max start Y as fraction of canvas height",
  },
  OPACITY: {
    value: 0.95,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Overall bolt opacity multiplier",
  },
  BLOOM_WIDTH: {
    value: 28,
    min: 1,
    max: 60,
    step: 1,
    description: "Outermost bloom layer width",
  },
  BLOOM_ALPHA: {
    value: 0.07,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Bloom layer opacity",
  },
  OUTER_WIDTH: {
    value: 12,
    min: 1,
    max: 40,
    step: 1,
    description: "Outer glow layer width",
  },
  OUTER_ALPHA: {
    value: 0.15,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Outer glow opacity",
  },
  MID_WIDTH: {
    value: 5,
    min: 0.5,
    max: 20,
    step: 0.5,
    description: "Mid layer width",
  },
  MID_ALPHA: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Mid layer opacity",
  },
  CORE_WIDTH: {
    value: 1.5,
    min: 0.2,
    max: 10,
    step: 0.1,
    description: "Core white line width",
  },
  CORE_ALPHA: {
    value: 1.0,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Core line opacity",
  },
  FLICKER_COUNT_MIN: {
    value: 1,
    min: 0,
    max: 5,
    step: 1,
    description: "Minimum flicker re-brightens",
  },
  FLICKER_COUNT_RANGE: {
    value: 2,
    min: 0,
    max: 5,
    step: 1,
    description: "Flicker count variation",
  },
  FLICKER_ALPHA: {
    value: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Flicker brightness floor",
  },
  MICRO_JITTER: {
    value: 1.5,
    min: 0,
    max: 10,
    step: 0.1,
    description: "Frame-to-frame position jitter",
  },
});

// ── Aurora (Tier 2) ──
const AURORA = defineConstants("fury.aurora", {
  TIER: {
    value: 40,
    min: 0,
    max: 100,
    step: 1,
    description: "Fury threshold to activate aurora",
  },
  RAMP: {
    value: 10,
    min: 1,
    max: 50,
    step: 1,
    description: "Fury range over which aurora ramps to full intensity",
  },
  EASE: {
    value: 0.02,
    min: 0.001,
    max: 0.2,
    step: 0.001,
    description: "Intensity easing speed per frame",
  },
  ALPHA: {
    value: 0.15,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Peak aurora opacity",
  },
  WAVE_COUNT: {
    value: 4,
    min: 1,
    max: 10,
    step: 1,
    description: "Number of aurora wave bands",
  },
  Y_MIN: {
    value: 0.05,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Minimum Y position as fraction of canvas",
  },
  Y_RANGE: {
    value: 0.2,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Y position variation",
  },
  SPEED_MIN: {
    value: 0.005,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Minimum wave phase speed",
  },
  SPEED_RANGE: {
    value: 0.008,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Phase speed variation",
  },
  AMP_MIN: {
    value: 15,
    min: 0,
    max: 100,
    step: 1,
    description: "Minimum wave amplitude in pixels",
  },
  AMP_RANGE: {
    value: 25,
    min: 0,
    max: 100,
    step: 1,
    description: "Amplitude variation",
  },
  WIDTH_MIN: {
    value: 40,
    min: 5,
    max: 200,
    step: 5,
    description: "Minimum band width in pixels",
  },
  WIDTH_RANGE: {
    value: 60,
    min: 0,
    max: 200,
    step: 5,
    description: "Band width variation",
  },
  STEP: {
    value: 24,
    min: 4,
    max: 80,
    step: 2,
    description: "Horizontal pixel step for wave rendering",
  },
  WAVE_FREQ: {
    value: 6,
    min: 1,
    max: 20,
    step: 0.5,
    description: "Primary wave frequency",
  },
  HARMONIC_PHASE: {
    value: 1.3,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Harmonic phase offset",
  },
  HARMONIC_FREQ: {
    value: 3,
    min: 0.5,
    max: 10,
    step: 0.5,
    description: "Harmonic frequency multiplier",
  },
  HARMONIC_AMP: {
    value: 0.5,
    min: 0,
    max: 2,
    step: 0.01,
    description: "Harmonic amplitude scale",
  },
  BAND_MAIN_RATIO: {
    value: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Bottom edge main wave ratio",
  },
  BAND_HARMONIC_RATIO: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Bottom edge harmonic ratio",
  },
  BAND_OFFSET: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Bottom edge Y offset as fraction of band width",
  },
  HUE_SHIFT_MID: {
    value: 20,
    min: 0,
    max: 180,
    step: 1,
    description: "Gradient midpoint hue shift",
  },
  HUE_SHIFT_EDGE: {
    value: 40,
    min: 0,
    max: 180,
    step: 1,
    description: "Gradient edge hue shift",
  },
});

// ── Meteors (Tier 3) ──
const METEOR = defineConstants("fury.meteors", {
  TIER: {
    value: 55,
    min: 0,
    max: 100,
    step: 1,
    description: "Fury threshold to activate meteor shower",
  },
  POOL_SIZE: {
    value: 20,
    min: 5,
    max: 60,
    step: 1,
    description: "Maximum simultaneous meteors",
  },
  SPEED_MIN: {
    value: 8,
    min: 1,
    max: 40,
    step: 0.5,
    description: "Minimum travel speed in px/frame",
  },
  SPEED_RANGE: {
    value: 12,
    min: 0,
    max: 40,
    step: 0.5,
    description: "Speed variation",
  },
  LEN_MIN: {
    value: 50,
    min: 5,
    max: 250,
    step: 5,
    description: "Minimum tail length in pixels",
  },
  LEN_RANGE: {
    value: 80,
    min: 0,
    max: 250,
    step: 5,
    description: "Tail length variation",
  },
  OPACITY_MIN: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum opacity",
  },
  OPACITY_RANGE: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Opacity variation",
  },
  LIFE_MIN: {
    value: 18,
    min: 5,
    max: 100,
    step: 1,
    description: "Minimum lifetime in frames",
  },
  LIFE_RANGE: {
    value: 18,
    min: 0,
    max: 100,
    step: 1,
    description: "Lifetime variation",
  },
  BURST_MIN: {
    value: 2,
    min: 1,
    max: 10,
    step: 1,
    description: "Minimum meteors per click burst",
  },
  BURST_RANGE: {
    value: 3,
    min: 0,
    max: 10,
    step: 1,
    description: "Burst count variation",
  },
  LINE_WIDTH: {
    value: 1.8,
    min: 0.2,
    max: 5,
    step: 0.1,
    description: "Trail stroke width in pixels",
  },
});

// ── Shared bolt helpers (used by fury + ambient lightning in rain) ──

export function spawnBolt(targetArray, x1, y1, x2, y2, depth) {
  const isBranch = depth > 0;
  const stepsMin = isBranch ? LN.BRANCH_STEPS_MIN : LN.STEPS_MIN;
  const stepsRange = isBranch ? LN.BRANCH_STEPS_RANGE : LN.STEPS_RANGE;
  const jitterX = isBranch ? LN.BRANCH_JITTER_X : LN.JITTER_X;
  const jitterY = isBranch ? LN.BRANCH_JITTER_Y : LN.JITTER_Y;
  const steps = stepsMin + Math.floor(Math.random() * stepsRange);
  const points = [{ x: x1, y: y1 }];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const envelope = Math.sin(t * Math.PI);
    const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitterX * envelope;
    const ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitterY * envelope;
    points.push({ x: nx, y: ny });
    if (depth < 2 && Math.random() < LN.BRANCH_CHANCE) {
      const bAngle =
        Math.atan2(
          ny - points[points.length - 2].y,
          nx - points[points.length - 2].x,
        ) +
        (Math.random() - 0.5) * LN.BRANCH_ANGLE;
      const bLen = LN.BRANCH_LEN_MIN + Math.random() * LN.BRANCH_LEN_RANGE;
      spawnBolt(
        targetArray,
        nx,
        ny,
        nx + Math.cos(bAngle) * bLen,
        ny + Math.sin(bAngle) * bLen,
        depth + 1,
      );
    }
  }
  const maxLife = LN.LIFE_MIN + Math.random() * LN.LIFE_RANGE;
  const flickerCount =
    LN.FLICKER_COUNT_MIN + Math.floor(Math.random() * LN.FLICKER_COUNT_RANGE);
  const flickerFrames = [];
  for (let f = 0; f < flickerCount; f++) {
    flickerFrames.push(2 + Math.floor(Math.random() * (maxLife * 0.6)));
  }
  targetArray.push({ points, depth, life: 0, maxLife, flickerFrames });
}

export function renderBolt(ctx, bolt, pal) {
  const t = bolt.life / bolt.maxLife;
  let fade = Math.pow(1 - t, 2.5);
  const isFlicker = bolt.flickerFrames.indexOf(bolt.life) !== -1;
  if (isFlicker) fade = Math.max(fade, LN.FLICKER_ALPHA);

  const col = pal.lightningColor;
  const sc = pal.lightningShadow;
  const branchScale = bolt.depth === 0 ? 1 : 0.45;
  const jitterSeed = bolt.life * 7.13;

  const tracePath = (jitter) => {
    const pts = bolt.points;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let p = 1; p < pts.length; p++) {
      const jx = jitter ? Math.sin(jitterSeed + p * 3.7) * LN.MICRO_JITTER : 0;
      const jy = jitter ? Math.cos(jitterSeed + p * 2.3) * LN.MICRO_JITTER : 0;
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
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "lighter";

  ctx.globalAlpha = fade * LN.BLOOM_ALPHA * branchScale * LN.OPACITY;
  ctx.strokeStyle = `rgb(${sc[0]},${sc[1]},${sc[2]})`;
  ctx.lineWidth = LN.BLOOM_WIDTH * branchScale;
  tracePath(false);
  ctx.stroke();

  ctx.globalAlpha = fade * LN.OUTER_ALPHA * branchScale * LN.OPACITY;
  ctx.lineWidth = LN.OUTER_WIDTH * branchScale;
  tracePath(false);
  ctx.stroke();

  ctx.globalAlpha = fade * LN.MID_ALPHA * branchScale * LN.OPACITY;
  ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
  ctx.lineWidth = LN.MID_WIDTH * branchScale;
  tracePath(true);
  ctx.stroke();

  ctx.globalAlpha = fade * LN.CORE_ALPHA * LN.OPACITY;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = LN.CORE_WIDTH * branchScale;
  tracePath(true);
  ctx.stroke();

  ctx.restore();
}

// ── Factory ──

export function createFury() {
  let clickFury = 0;
  let lastClickTime = 0;
  const lightningBolts = [];
  const auroraWaves = [];
  let auroraIntensity = 0;
  const meteorPool = Array.from({ length: METEOR.POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    len: 0,
    life: 0,
    maxLife: 0,
    opacity: 0,
  }));

  return {
    // Draw fury effects: decay, lightning, aurora, meteors.
    draw(ctx, canvas, pal, sp, dt, now) {
      // Fury decay — no decay while actively clicking, then ramps up fast
      const idleSec = (now - lastClickTime) / 1000;
      if (idleSec >= FURY.IDLE_GRACE) {
        const decayRate =
          FURY.DECAY_BASE + (idleSec - FURY.IDLE_GRACE) * FURY.DECAY_ACCEL;
        clickFury = Math.max(0, clickFury - dt * decayRate);
      }

      // Tier 1: Lightning bolts — multi-layer rendering
      let flashThisFrame = false;
      for (let i = lightningBolts.length - 1; i >= 0; i--) {
        const bolt = lightningBolts[i];
        bolt.life++;
        if (bolt.life > bolt.maxLife) {
          lightningBolts.splice(i, 1);
          continue;
        }
        if (bolt.life === 1) flashThisFrame = true;
        renderBolt(ctx, bolt, pal);
      }
      if (flashThisFrame) {
        const fc = pal.lightningFlash;
        ctx.save();
        ctx.globalAlpha = LN.FLASH_ALPHA;
        ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},1)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Tier 2: Aurora borealis
      const auroraTarget =
        clickFury >= AURORA.TIER
          ? Math.min((clickFury - AURORA.TIER) / AURORA.RAMP, 1)
          : 0;
      auroraIntensity += (auroraTarget - auroraIntensity) * AURORA.EASE;
      if (auroraIntensity > 0.01) {
        while (auroraWaves.length < AURORA.WAVE_COUNT) {
          auroraWaves.push({
            y: canvas.height * (AURORA.Y_MIN + Math.random() * AURORA.Y_RANGE),
            phase: Math.random() * Math.PI * 2,
            speed: AURORA.SPEED_MIN + Math.random() * AURORA.SPEED_RANGE,
            amp: AURORA.AMP_MIN + Math.random() * AURORA.AMP_RANGE,
            width: AURORA.WIDTH_MIN + Math.random() * AURORA.WIDTH_RANGE,
            hue: pal.auroraHueBase + Math.random() * pal.auroraHueRange,
          });
        }
        const waveY = (w, t, mainScale, harmonicScale) =>
          Math.sin(w.phase + t * AURORA.WAVE_FREQ) * w.amp * mainScale +
          Math.sin(w.phase * AURORA.HARMONIC_PHASE + t * AURORA.HARMONIC_FREQ) *
            w.amp *
            harmonicScale;

        const traceEdge = (w, mainScale, harmonicScale, yBase, reverse) => {
          const steps = Math.ceil(canvas.width / AURORA.STEP);
          for (let i = 1; i <= steps; i++) {
            const x = reverse
              ? Math.max(canvas.width - i * AURORA.STEP, 0)
              : Math.min(i * AURORA.STEP, canvas.width);
            const y =
              yBase + waveY(w, x / canvas.width, mainScale, harmonicScale);
            if (i < steps) {
              const nx = reverse
                ? Math.max(canvas.width - (i + 1) * AURORA.STEP, 0)
                : Math.min((i + 1) * AURORA.STEP, canvas.width);
              const ny =
                yBase + waveY(w, nx / canvas.width, mainScale, harmonicScale);
              ctx.quadraticCurveTo(x, y, (x + nx) * 0.5, (y + ny) * 0.5);
            } else {
              ctx.lineTo(x, y);
            }
          }
        };

        auroraWaves.forEach((w) => {
          w.phase += w.speed;
          if (pal.auroraHueBase < 60 && w.hue > 60)
            w.hue = (w.hue - 120 + 360) % 360;
          if (pal.auroraHueBase >= 60 && w.hue < 60)
            w.hue = pal.auroraHueBase + Math.random() * pal.auroraHueRange;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = auroraIntensity * AURORA.ALPHA;
          const grad = ctx.createLinearGradient(
            0,
            w.y - w.width,
            0,
            w.y + w.width,
          );
          grad.addColorStop(0, "transparent");
          grad.addColorStop(0.3, `hsla(${w.hue}, 80%, 60%, 0.6)`);
          grad.addColorStop(
            0.5,
            `hsla(${w.hue + AURORA.HUE_SHIFT_MID}, 70%, 50%, 0.8)`,
          );
          grad.addColorStop(
            0.7,
            `hsla(${w.hue + AURORA.HUE_SHIFT_EDGE}, 80%, 60%, 0.6)`,
          );
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          const botBase = w.y + w.width * AURORA.BAND_OFFSET;
          ctx.beginPath();
          ctx.moveTo(0, w.y + waveY(w, 0, 1, AURORA.HARMONIC_AMP));
          traceEdge(w, 1, AURORA.HARMONIC_AMP, w.y, false);
          ctx.lineTo(
            canvas.width,
            botBase +
              waveY(w, 1, AURORA.BAND_MAIN_RATIO, AURORA.BAND_HARMONIC_RATIO),
          );
          traceEdge(
            w,
            AURORA.BAND_MAIN_RATIO,
            AURORA.BAND_HARMONIC_RATIO,
            botBase,
            true,
          );
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      }

      // Tier 3: Meteor shower
      meteorPool.forEach((m) => {
        if (!m.active) return;
        m.life++;
        if (m.life > m.maxLife) {
          m.active = false;
          return;
        }
        const p = m.life / m.maxLife;
        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        const fade = p < 0.08 ? p / 0.08 : (1 - p) / 0.92;
        const op = m.opacity * fade;
        const tailX = m.x - Math.cos(m.angle) * m.len * Math.min(1, p * 3);
        const tailY = m.y - Math.sin(m.angle) * m.len * Math.min(1, p * 3);
        drawTrail(
          ctx,
          m.x,
          m.y,
          tailX,
          tailY,
          pal.meteorColors,
          op,
          METEOR.LINE_WIDTH,
        );
      });
    },

    // Handle a click: bump fury, spawn lightning/meteors based on tier.
    click(cx, cy, canvas, sp) {
      clickFury = Math.min(clickFury + FURY.PER_CLICK, FURY.MAX);
      lastClickTime = performance.now();

      // Tier 1: Lightning
      if (clickFury >= LN.TIER && lightningBolts.length < LN.MAX_BOLTS) {
        const startX = cx + (Math.random() - 0.5) * LN.START_SPREAD;
        const startY = Math.random() * canvas.height * LN.START_Y;
        spawnBolt(lightningBolts, startX, startY, cx, cy, 0);
      }

      // Tier 3: Meteor shower burst
      if (clickFury >= METEOR.TIER && sp < SKY_SHARED.FADE_END) {
        const count =
          METEOR.BURST_MIN + Math.floor(Math.random() * METEOR.BURST_RANGE);
        for (let i = 0; i < count; i++) {
          const m = meteorPool.find((m) => !m.active);
          if (!m) break;
          m.x =
            Math.random() * canvas.width * SKY_SHARED.X_SPREAD +
            canvas.width * SKY_SHARED.X_OFFSET;
          m.y = Math.random() * canvas.height * 0.3;
          m.angle =
            Math.PI * SKY_SHARED.ANGLE_MIN + Math.random() * Math.PI * 0.25;
          m.speed = METEOR.SPEED_MIN + Math.random() * METEOR.SPEED_RANGE;
          m.len = METEOR.LEN_MIN + Math.random() * METEOR.LEN_RANGE;
          m.opacity = METEOR.OPACITY_MIN + Math.random() * METEOR.OPACITY_RANGE;
          m.life = 0;
          m.maxLife = METEOR.LIFE_MIN + Math.random() * METEOR.LIFE_RANGE;
          m.active = true;
        }
      }
    },
  };
}
