import {
  drawHaloParticle,
  drawTrail,
  rgbaStr,
  scrollFade,
} from "./canvas-utils.js";
import {
  CONSTELLATIONS,
  PLANTED_SCALE,
  PLANTED_JITTER,
} from "./constellations.js";
import { defineConstants } from "./dev/registry.js";
import { scaled, chance, prefersReducedMotion } from "./motion.js";
import { shootingStarBoost } from "./real-sky/boost.js";
import { arrangementRandom } from "./daily/random.js";

// ── Stars ──
const STARS = defineConstants("sky.stars", {
  RADIUS_MIN: {
    value: 0.3,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Minimum star radius in pixels",
  },
  RADIUS_RANGE: {
    value: 1,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Random radius variation added to minimum",
  },
  OPACITY_MIN: {
    value: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum base opacity",
  },
  OPACITY_RANGE: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Random opacity variation",
  },
  TWINKLE_SPEED_MIN: {
    value: 0.008,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Minimum twinkle animation speed",
  },
  TWINKLE_SPEED_RANGE: {
    value: 0.03,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Twinkle speed variation",
  },
  DEPTH_MIN: {
    value: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum parallax depth",
  },
  DEPTH_RANGE: {
    value: 0.9,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Parallax depth variation",
  },
  FLASH_CHANCE: {
    value: 0.0003,
    min: 0,
    max: 0.01,
    step: 0.0001,
    description: "Per-frame chance of a bright flash",
  },
  FLASH_MIN: {
    value: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum flash brightness",
  },
  FLASH_RANGE: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Flash brightness variation",
  },
  FLASH_DECAY: {
    value: 0.92,
    min: 0.5,
    max: 1,
    step: 0.01,
    description: "Flash brightness decay rate per frame",
  },
  FLASH_THRESHOLD: {
    value: 0.01,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Flash cutoff — below this, flash is zeroed",
  },
  TWINKLE_BASE: {
    value: 0.7,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Base brightness before twinkle sine wave",
  },
  TWINKLE_RANGE: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Twinkle sine wave amplitude",
  },
  PARALLAX_SCALE: {
    value: 0.4,
    min: 0,
    max: 2,
    step: 0.01,
    description: "Scroll parallax displacement multiplier",
  },
  FADE_START: {
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where stars begin fading out",
  },
  TIME_STEP: {
    value: 0.008,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Per-frame time increment for glare rotation",
  },
  GLOW_THRESHOLD: {
    value: 0.8,
    min: 0,
    max: 2,
    step: 0.1,
    description: "Minimum radius for radial glow halo",
  },
  GLOW_RADIUS: {
    value: 2.5,
    min: 1,
    max: 10,
    step: 0.1,
    description: "Glow halo radius multiplier",
  },
  GLOW_MID: {
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint stop position",
  },
  GLOW_MID_ALPHA: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint opacity multiplier",
  },
  GLARE_THRESHOLD: {
    value: 1.0,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Minimum radius for cross-flare glare",
  },
  GLARE_CHANCE: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Chance a flashing star gets glare spikes",
  },
  GLARE_SPIKE_LENGTH: {
    value: 14,
    min: 1,
    max: 50,
    step: 1,
    description: "Glare spike length multiplier",
  },
  GLARE_WIDTH: {
    value: 0.6,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Glare line width in pixels",
  },
  GLARE_ROTATION_SPEED: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Glare spike rotation speed",
  },
  HOVER_RADIUS: {
    value: 120,
    min: 30,
    max: 400,
    step: 5,
    description: "Cursor proximity radius for brightness boost",
  },
  HOVER_BOOST: {
    value: 0.6,
    min: 0,
    max: 2,
    step: 0.05,
    description: "Max opacity boost at cursor center",
  },
  TAGGED_HOVER_BOOST_FACTOR: {
    value: 0.8,
    min: 0,
    max: 2,
    step: 0.05,
    description:
      "Extra hover boost applied only to planted constellation stars",
  },
  HINT_PULSE_RATE: {
    value: 5,
    min: 0,
    max: 30,
    step: 0.1,
    description: "Angular rate of the hint-pulse sine wave per t-unit",
  },
  TAGGED_RING_RADIUS_MULT: {
    value: 1.5,
    min: 0.5,
    max: 5,
    step: 0.1,
    description: "Tagged-star marker ring radius as a multiple of star radius",
  },
  TAGGED_RING_OPACITY: {
    value: 0.18,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Tagged-star marker ring opacity at full scroll visibility",
  },
  TAGGED_RING_WIDTH: {
    value: 0.4,
    min: 0.1,
    max: 3,
    step: 0.1,
    description: "Tagged-star marker ring stroke width in pixels",
  },
  // ── Dwell-discovery pulse ──
  // When the cursor lingers near a tagged star without moving, that
  // star briefly brightens.  Discoverability cue for the constellation
  // puzzle — doesn't reveal where to click next, just hints that the
  // star under the cursor is special.
  IDLE_DWELL_MS: {
    value: 1500,
    min: 200,
    max: 5000,
    step: 100,
    description: "Cursor-still time required to fire a dwell pulse (ms)",
  },
  IDLE_MOVE_NOISE: {
    value: 2,
    min: 0,
    max: 20,
    step: 0.5,
    description: "Per-frame pointer movement counted as 'not moving' (px)",
  },
  IDLE_FLASH_STRENGTH: {
    value: 1,
    min: 0,
    max: 2,
    step: 0.05,
    description: "Dwell-pulse initial intensity",
  },
  IDLE_FLASH_DECAY: {
    value: 0.94,
    min: 0.5,
    max: 0.999,
    step: 0.005,
    description: "Per-frame decay of the dwell pulse",
  },
});

// ── Shooting Stars ──
const SHOOTING = defineConstants("sky.shooting", {
  POOL_SIZE: {
    value: 3,
    min: 1,
    max: 20,
    step: 1,
    description: "Max simultaneous shooting stars",
  },
  HIT_RADIUS: {
    value: 36,
    min: 8,
    max: 120,
    step: 2,
    description: "Click hit radius around a shooting star's head (px)",
  },
  SPAWN_CHANCE: {
    value: 0.003,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Per-frame spawn probability",
  },
  Y_MAX: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Max spawn Y as fraction of canvas height",
  },
  ANGLE_RANGE: {
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Arc angle variation in radians/pi",
  },
  SPEED_MIN: {
    value: 6,
    min: 1,
    max: 30,
    step: 0.5,
    description: "Minimum travel speed in px/frame",
  },
  SPEED_RANGE: {
    value: 8,
    min: 0,
    max: 30,
    step: 0.5,
    description: "Speed variation",
  },
  LEN_MIN: {
    value: 40,
    min: 5,
    max: 200,
    step: 1,
    description: "Minimum tail length in pixels",
  },
  LEN_RANGE: {
    value: 60,
    min: 0,
    max: 200,
    step: 1,
    description: "Tail length variation",
  },
  OPACITY_MIN: {
    value: 0.3,
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
    value: 20,
    min: 5,
    max: 100,
    step: 1,
    description: "Minimum lifetime in frames",
  },
  LIFE_RANGE: {
    value: 20,
    min: 0,
    max: 100,
    step: 1,
    description: "Lifetime variation",
  },
  LINE_WIDTH: {
    value: 1.2,
    min: 0.2,
    max: 5,
    step: 0.1,
    description: "Trail stroke width in pixels",
  },
  HEAD_GLOW_RADIUS: {
    value: 5,
    min: 0,
    max: 24,
    step: 0.5,
    description: "Hot-head halo radius at the leading point (px)",
  },
  HEAD_GLOW_ALPHA: {
    value: 0.9,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Hot-head halo opacity relative to the trail opacity",
  },
});

// ── Aurora ──
const AURORA = defineConstants("sky.aurora", {
  IDLE_MS: {
    value: 180000,
    min: 30000,
    max: 600000,
    step: 10000,
    description: "Cursor idle duration before the aurora fades in (ms)",
  },
  FADE_MS: {
    value: 20000,
    min: 1000,
    max: 60000,
    step: 1000,
    description: "Fade-in and fade-out duration for the aurora ribbon (ms)",
  },
  BAND_HEIGHT: {
    value: 0.18,
    min: 0.02,
    max: 0.5,
    step: 0.01,
    description: "Aurora band height as a fraction of canvas height",
  },
  WAVE_SPEED: {
    value: 0.012,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Phase advance per frame for the aurora wave",
  },
  WAVE_AMP: {
    value: 0.03,
    min: 0,
    max: 0.15,
    step: 0.005,
    description: "Vertical wave amplitude as fraction of canvas height",
  },
  PEAK_OPACITY: {
    value: 0.18,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Maximum opacity of the aurora at full idle",
  },
  RIBBON_STEPS: {
    value: 40,
    min: 8,
    max: 120,
    step: 4,
    description: "Path tessellation steps for the aurora ribbon edge",
  },
  HUE_OSCILLATION_RATE: {
    value: 0.3,
    min: 0,
    max: 2,
    step: 0.05,
    description:
      "Rate at which the aurora hue oscillates across the palette range",
  },
  WAVE_SPATIAL_FREQ: {
    value: 4,
    min: 1,
    max: 16,
    step: 1,
    description: "Number of full wave cycles across the ribbon width",
  },
  MIN_VISIBLE_ALPHA: {
    value: 0.002,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Alpha below which the aurora is skipped (no draw cost)",
  },
  SATURATION: {
    value: 80,
    min: 0,
    max: 100,
    step: 1,
    description: "Aurora HSL saturation (%)",
  },
  LIGHTNESS_TOP: {
    value: 75,
    min: 0,
    max: 100,
    step: 1,
    description: "Aurora HSL lightness at the top gradient stop (%)",
  },
  LIGHTNESS_BASE: {
    value: 65,
    min: 0,
    max: 100,
    step: 1,
    description: "Aurora HSL lightness at the mid/bottom gradient stops (%)",
  },
  TOP_ALPHA_FACTOR: {
    value: 0.6,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Top gradient stop alpha as a fraction of the base alpha",
  },
});

// ── Comet Streak ──
const COMET = defineConstants("sky.comet", {
  VEL_THRESHOLD: {
    value: 3,
    min: 0.5,
    max: 20,
    step: 0.5,
    description: "Minimum |scrollVelocity| before comet trails appear on stars",
  },
  MAX_TRAIL_LEN: {
    value: 40,
    min: 4,
    max: 200,
    step: 2,
    description: "Maximum trail length in pixels at peak scroll velocity",
  },
  VEL_FULL: {
    value: 18,
    min: 2,
    max: 60,
    step: 1,
    description: "ScrollVelocity at which trails reach MAX_TRAIL_LEN",
  },
  OPACITY_SCALE: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Trail opacity relative to the star's own opacity",
  },
  TRAIL_WIDTH_FACTOR: {
    value: 1.5,
    min: 0.5,
    max: 5,
    step: 0.1,
    description: "Trail stroke width as a multiple of the star's radius",
  },
});

// Spawn parameters shared by stars and any element that should obey the
// same sky rules (fade window, position spread, launch angle).
export const SKY_SHARED = defineConstants("sky.shared", {
  FADE_END: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where stars fully disappear",
  },
  X_SPREAD: {
    value: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Horizontal spawn spread as fraction of canvas",
  },
  X_OFFSET: {
    value: 0.1,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Horizontal spawn offset from left edge",
  },
  ANGLE_MIN: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum shooting angle in radians/pi",
  },
});

// ── Factory ──

// Anchor positions in raw 1920x1080 space, one per quadrant. Constellations
// are planted relative to these; stars of a single constellation share an
// anchor and a parallax depth so they shift together on scroll and keep
// their visual shape.
const CONSTELLATION_ANCHORS = [
  { x: 480, y: 240 },
  { x: 1480, y: 320 },
  { x: 380, y: 780 },
  { x: 1520, y: 700 },
];

// The arrangement (positions, sizes, depths) draws from the seeded daily
// stream so every visitor shares one sky per day; per-frame randomness
// (flashes, spawns) stays on Math.random.
function jitter() {
  return (arrangementRandom() - 0.5) * 2 * PLANTED_JITTER;
}

function makeStar(x, y, sharedDepth) {
  const r = STARS.RADIUS_MIN + arrangementRandom() * STARS.RADIUS_RANGE;
  return {
    x,
    y,
    r,
    opacity: STARS.OPACITY_MIN + arrangementRandom() * STARS.OPACITY_RANGE,
    twinkle: arrangementRandom() * Math.PI * 2,
    twinkleSpeed:
      STARS.TWINKLE_SPEED_MIN + arrangementRandom() * STARS.TWINKLE_SPEED_RANGE,
    flash: 0,
    depth:
      sharedDepth ?? STARS.DEPTH_MIN + arrangementRandom() * STARS.DEPTH_RANGE,
    glarePhase: arrangementRandom() * Math.PI,
    constellationId: null,
    constellationIndex: -1,
    hintPulse: 0,
    idleFlash: 0,
  };
}

function plantConstellations(stars, capacity) {
  // Shuffle anchor → constellation assignment so a constellation isn't tied
  // to a fixed quadrant forever — seeded, so it hides in the same quadrant
  // for every visitor on a given day.
  const anchorOrder = CONSTELLATION_ANCHORS.slice().sort(
    () => arrangementRandom() - 0.5,
  );
  const planted = [];
  for (let i = 0; i < CONSTELLATIONS.length; i++) {
    const c = CONSTELLATIONS[i];
    const anchor = anchorOrder[i % anchorOrder.length];
    if (planted.length + c.points.length > capacity) break;
    const sharedDepth =
      STARS.DEPTH_MIN + arrangementRandom() * STARS.DEPTH_RANGE;
    for (let k = 0; k < c.points.length; k++) {
      const [dx, dy] = c.points[k];
      const x = anchor.x + dx * PLANTED_SCALE + jitter();
      const y = anchor.y + dy * PLANTED_SCALE + jitter();
      const star = makeStar(x, y, sharedDepth);
      star.constellationId = c.id;
      star.constellationIndex = k;
      planted.push(star);
    }
  }
  for (const s of planted) stars.push(s);
}

// Module-level accessor — themes that need to hit-test or highlight
// individual stars (e.g. constellation) read from here instead of having
// the canvas orchestrator thread `sky` through every theme init.  Holds
// the most recently created sky's stars, or null before `createSky` runs.
let _latestStars = null;

export function getSkyStars() {
  return _latestStars;
}

/** Live parallax-scale read for consumers that need to mirror sky.js's
 *  star screen-position math (constellation chain hit-tests, chain line
 *  rendering).  Reads the tunable constant fresh each call so dev-console
 *  retunes propagate to all consumers in the same frame. */
export function getStarsParallaxScale() {
  return STARS.PARALLAX_SCALE;
}

/** Live scroll-fade read using the same window the star renderer uses.
 *  Returns 1 above FADE_START, ramps to 0 at FADE_END.  Overlays that
 *  anchor to star positions read this so they fade in lockstep — without
 *  it they outlive the stars and end up floating over unrelated sections
 *  of the page after a scroll. */
export function getStarsFadeOpacity(sp) {
  return scrollFade(sp, 0, 0, STARS.FADE_START, SKY_SHARED.FADE_END);
}

export function createSky(starCount) {
  const stars = [];
  plantConstellations(stars, starCount);
  while (stars.length < starCount) {
    stars.push(
      makeStar(arrangementRandom() * 1920, arrangementRandom() * 1080),
    );
  }
  _latestStars = stars;

  const shootingStars = Array.from({ length: SHOOTING.POOL_SIZE }, () => ({
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

  let t = 0;
  let dwellLastX = NaN;
  let dwellLastY = NaN;
  let dwellStartMs = -1;
  let dwellPulseFired = false;
  let _auroraPhase = 0;

  return {
    draw(ctx, canvas, sp, pal, forces, scrollVelocity = 0) {
      const starVis = scrollFade(
        sp,
        0,
        0,
        STARS.FADE_START,
        SKY_SHARED.FADE_END,
      );
      if (starVis <= 0) return;

      // ── Idle aurora ──
      if (!prefersReducedMotion() && forces) {
        const idleMs = performance.now() - forces.lastMoveTime;
        const fadeIn = Math.max(
          0,
          Math.min(1, (idleMs - AURORA.IDLE_MS) / AURORA.FADE_MS),
        );
        const auroraAlpha = fadeIn * AURORA.PEAK_OPACITY * starVis;
        if (auroraAlpha > AURORA.MIN_VISIBLE_ALPHA) {
          _auroraPhase += scaled(AURORA.WAVE_SPEED);
          const bandH = canvas.height * AURORA.BAND_HEIGHT;
          const waveH = canvas.height * AURORA.WAVE_AMP;
          const steps = AURORA.RIBBON_STEPS;
          const stepW = canvas.width / steps;
          const hue =
            pal.auroraHueBase +
            (Math.sin(_auroraPhase * AURORA.HUE_OSCILLATION_RATE) * 0.5 + 0.5) *
              pal.auroraHueRange;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.beginPath();
          ctx.moveTo(0, 0);
          for (let i = 0; i <= steps; i++) {
            const x = i * stepW;
            const bottomY =
              bandH +
              Math.sin(
                _auroraPhase +
                  (x / canvas.width) * Math.PI * 2 * AURORA.WAVE_SPATIAL_FREQ,
              ) *
                waveH;
            ctx.lineTo(x, bottomY);
          }
          ctx.lineTo(canvas.width, 0);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, 0, 0, bandH + waveH);
          const sat = AURORA.SATURATION;
          const topAlpha = (auroraAlpha * AURORA.TOP_ALPHA_FACTOR).toFixed(4);
          grad.addColorStop(
            0,
            `hsla(${hue},${sat}%,${AURORA.LIGHTNESS_TOP}%,${topAlpha})`,
          );
          grad.addColorStop(
            0.5,
            `hsla(${hue},${sat}%,${AURORA.LIGHTNESS_BASE}%,${auroraAlpha.toFixed(4)})`,
          );
          grad.addColorStop(
            1,
            `hsla(${hue},${sat}%,${AURORA.LIGHTNESS_BASE}%,0)`,
          );
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();
        }
      }

      // ── Dwell-pulse detector ──
      // Wall-clock timing (not `t`) so the threshold is honest under
      // reduced motion's frozen frame budget — and one shot per dwell
      // (latch flips at first cross, releases on the next real move).
      let dwellTriggeredThisFrame = false;
      if (!prefersReducedMotion() && forces && forces.hover.active) {
        const hx = forces.hover.x;
        const hy = forces.hover.y;
        const moved =
          Math.abs(hx - dwellLastX) > STARS.IDLE_MOVE_NOISE ||
          Math.abs(hy - dwellLastY) > STARS.IDLE_MOVE_NOISE ||
          Number.isNaN(dwellLastX);
        const now = Date.now();
        if (moved) {
          dwellStartMs = now;
          dwellPulseFired = false;
        } else if (
          !dwellPulseFired &&
          now - dwellStartMs >= STARS.IDLE_DWELL_MS
        ) {
          dwellTriggeredThisFrame = true;
          dwellPulseFired = true;
        }
        dwellLastX = hx;
        dwellLastY = hy;
      } else {
        dwellStartMs = -1;
        dwellPulseFired = false;
        dwellLastX = NaN;
        dwellLastY = NaN;
      }
      let dwellNearestStar = null;
      let dwellNearestDistSq = Infinity;

      t += scaled(STARS.TIME_STEP);
      // Hoisted halo opts shared across every glow-tier star this frame.
      const haloOpts = {
        midStop: STARS.GLOW_MID,
        midAlpha: STARS.GLOW_MID_ALPHA,
      };
      stars.forEach((s) => {
        s.twinkle += scaled(s.twinkleSpeed);
        // Random bright flash — rare, brief spike.  Spawn probability
        // dampens with motion budget so no flash fires under reduced motion.
        if (s.flash > 0) {
          s.flash *= STARS.FLASH_DECAY;
          if (s.flash < STARS.FLASH_THRESHOLD) s.flash = 0;
        } else if (chance(STARS.FLASH_CHANCE)) {
          s.flash = STARS.FLASH_MIN + Math.random() * STARS.FLASH_RANGE;
          s.glare =
            s.r >= STARS.GLARE_THRESHOLD && Math.random() < STARS.GLARE_CHANCE;
        }
        // Parallax — closer stars (higher depth) shift more on scroll
        const shift = s.depth * sp * canvas.height * STARS.PARALLAX_SCALE;
        const py =
          (((s.y - shift) % canvas.height) + canvas.height) % canvas.height;
        const sx = s.x % canvas.width;
        const base =
          s.opacity *
          (STARS.TWINKLE_BASE + STARS.TWINKLE_RANGE * Math.sin(s.twinkle));
        // Hover proximity — stars near the cursor glow brighter.
        // Planted constellation stars get a small extra boost so they
        // become noticeably brighter under the cursor without standing
        // out at rest.
        let hoverBoost = 0;
        if (forces && forces.hover.active) {
          const hdx = sx - forces.hover.x;
          const hdy = py - forces.hover.y;
          const distSq = hdx * hdx + hdy * hdy;
          const hDist = Math.sqrt(distSq);
          if (hDist < STARS.HOVER_RADIUS) {
            const taggedFactor = s.constellationId
              ? 1 + STARS.TAGGED_HOVER_BOOST_FACTOR
              : 1;
            hoverBoost =
              STARS.HOVER_BOOST *
              taggedFactor *
              (1 - hDist / STARS.HOVER_RADIUS);
          }
          if (
            dwellTriggeredThisFrame &&
            s.constellationId &&
            hDist < STARS.HOVER_RADIUS &&
            distSq < dwellNearestDistSq
          ) {
            dwellNearestStar = s;
            dwellNearestDistSq = distSq;
          }
        }
        // `hintPulse` 0..1 is set externally to highlight stars the
        // user should click next.  Wave uses the shared `t` clock so
        // every hinted star breathes in sync but with an index-phased
        // offset, and freezes under reduced motion because `t` does.
        let hint = 0;
        if (s.hintPulse > 0) {
          const wave =
            0.5 +
            0.5 * Math.sin(t * STARS.HINT_PULSE_RATE + s.constellationIndex);
          hint = s.hintPulse * wave * STARS.HOVER_BOOST;
        }
        // Brief one-shot flash awarded when the cursor dwells near a
        // tagged star — decays per frame; latch above prevents respawn
        // until the cursor moves and returns.
        if (s.idleFlash > 0) {
          s.idleFlash *= STARS.IDLE_FLASH_DECAY;
          if (s.idleFlash < 0.01) s.idleFlash = 0;
        }
        const op =
          Math.min(
            1,
            base +
              s.flash +
              hoverBoost +
              hint +
              s.idleFlash * STARS.HOVER_BOOST,
          ) * starVis;
        const sc = pal.starColor;
        // Larger stars get a soft radial glow halo
        if (s.r >= STARS.GLOW_THRESHOLD) {
          drawHaloParticle(
            ctx,
            sx,
            py,
            s.r * STARS.GLOW_RADIUS,
            op,
            sc,
            haloOpts,
          );
        } else {
          ctx.fillStyle = rgbaStr(sc, op);
          ctx.beginPath();
          ctx.arc(sx, py, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Comet streak: extend each star in the direction opposite to scroll.
        // Trail length scales with scroll velocity; collapses under reduced motion.
        const absVel = Math.abs(scrollVelocity);
        if (!prefersReducedMotion() && absVel > COMET.VEL_THRESHOLD) {
          const frac = Math.min(
            1,
            (absVel - COMET.VEL_THRESHOLD) /
              (COMET.VEL_FULL - COMET.VEL_THRESHOLD),
          );
          const trailLen = scaled(COMET.MAX_TRAIL_LEN * frac);
          if (trailLen > 0.5) {
            const dir = scrollVelocity > 0 ? -1 : 1;
            drawTrail(
              ctx,
              sx,
              py,
              sx,
              py + dir * trailLen,
              [sc, sc, sc],
              op * COMET.OPACITY_SCALE,
              s.r * COMET.TRAIL_WIDTH_FACTOR,
            );
          }
        }
        // Planted-star discovery marker: a faint, always-on outline ring.
        // Subtle enough not to spoil the puzzle at a glance, distinct
        // enough that a curious user catches the difference when they
        // sweep the cursor across the sky.
        if (s.constellationId) {
          ctx.save();
          ctx.globalAlpha = STARS.TAGGED_RING_OPACITY * starVis;
          ctx.strokeStyle = rgbaStr(sc, 1);
          ctx.lineWidth = STARS.TAGGED_RING_WIDTH;
          ctx.beginPath();
          ctx.arc(sx, py, s.r * STARS.TAGGED_RING_RADIUS_MULT, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // Cross-flare glare on rare bright flashing stars
        if (s.glare && s.flash > STARS.FLASH_THRESHOLD) {
          const glareLen = s.r * STARS.GLARE_SPIKE_LENGTH * s.flash;
          const angle = t * STARS.GLARE_ROTATION_SPEED + s.glarePhase;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = s.flash * starVis;
          ctx.lineWidth = STARS.GLARE_WIDTH;
          ctx.lineCap = "round";
          for (let i = 0; i < 2; i++) {
            const a = angle + i * Math.PI * 0.5;
            const dx = Math.cos(a) * glareLen;
            const dy = Math.sin(a) * glareLen;
            const grad = ctx.createLinearGradient(
              sx - dx,
              py - dy,
              sx + dx,
              py + dy,
            );
            grad.addColorStop(0, `rgba(${sc},0)`);
            grad.addColorStop(0.5, `rgba(${sc},1)`);
            grad.addColorStop(1, `rgba(${sc},0)`);
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(sx - dx, py - dy);
            ctx.lineTo(sx + dx, py + dy);
            ctx.stroke();
          }
          ctx.restore();
        }
      });

      // Awarded to the closest tagged star inside the hover radius for
      // this dwell.  Captured during the per-star loop above; firing it
      // after the loop keeps the per-star math simple.
      if (dwellNearestStar) {
        dwellNearestStar.idleFlash = STARS.IDLE_FLASH_STRENGTH;
      }

      // Shooting stars — rare fast arcs across the sky.  Spawn rate
      // dampens with motion budget, so under reduced motion no new arcs
      // appear (in-flight ones still complete and fade out cleanly).
      // During a real meteor shower the sky actually falls more often.
      if (chance(SHOOTING.SPAWN_CHANCE * shootingStarBoost())) {
        const ss = shootingStars.find((s) => !s.active);
        if (ss) {
          ss.x =
            Math.random() * canvas.width * SKY_SHARED.X_SPREAD +
            canvas.width * SKY_SHARED.X_OFFSET;
          ss.y = Math.random() * canvas.height * SHOOTING.Y_MAX;
          ss.angle =
            Math.PI * SKY_SHARED.ANGLE_MIN +
            Math.random() * Math.PI * SHOOTING.ANGLE_RANGE;
          ss.speed = SHOOTING.SPEED_MIN + Math.random() * SHOOTING.SPEED_RANGE;
          ss.len = SHOOTING.LEN_MIN + Math.random() * SHOOTING.LEN_RANGE;
          ss.opacity =
            SHOOTING.OPACITY_MIN + Math.random() * SHOOTING.OPACITY_RANGE;
          ss.life = 0;
          ss.maxLife = SHOOTING.LIFE_MIN + Math.random() * SHOOTING.LIFE_RANGE;
          ss.active = true;
        }
      }
      shootingStars.forEach((ss) => {
        if (!ss.active) return;
        ss.life++;
        if (ss.life > ss.maxLife) {
          ss.active = false;
          return;
        }
        const p = ss.life / ss.maxLife;
        // Position is intentionally unscaled — once an arc is in flight
        // it must complete instead of freezing mid-trail if the user
        // toggles reduced motion mid-flight.  Spawn is gated by chance()
        // above; this branch only runs for already-spawned arcs.
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        // Fade in quickly, fade out slowly
        const fade = p < 0.1 ? p / 0.1 : (1 - p) / 0.9;
        const op = ss.opacity * fade * starVis;
        const tailX = ss.x - Math.cos(ss.angle) * ss.len * Math.min(1, p * 3);
        const tailY = ss.y - Math.sin(ss.angle) * ss.len * Math.min(1, p * 3);
        drawTrail(
          ctx,
          ss.x,
          ss.y,
          tailX,
          tailY,
          pal.shootingColors,
          op,
          SHOOTING.LINE_WIDTH,
          {
            radius: SHOOTING.HEAD_GLOW_RADIUS,
            alpha: SHOOTING.HEAD_GLOW_ALPHA,
          },
        );
      });
    },

    // Hit-test a click (canvas-pixel coords) against the head of any
    // in-flight shooting star.  Generous radius since the arcs move
    // fast.  Returns true on a hit so the caller can reward the catch.
    clickShootingStar(cx, cy) {
      for (const ss of shootingStars) {
        if (!ss.active) continue;
        const dx = ss.x - cx;
        const dy = ss.y - cy;
        if (dx * dx + dy * dy <= SHOOTING.HIT_RADIUS * SHOOTING.HIT_RADIUS) {
          return true;
        }
      }
      return false;
    },
  };
}
