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
import { peerWorldRects } from "./sky-link/seam.js";
import { isWorldAnchored, createAnchorBlend } from "./world/anchor.js";
import { worldTickTime, tickToMs } from "./world/clock.js";
import { WORLD_W, WORLD_H, floorMod, worldOrigin } from "./world/space.js";
import { tickRoll, tickStream } from "./world/schedule.js";

// The world/solo regime probe lives in world/anchor.js now; re-export it here
// so consumers that hit-test or mirror star positions keep one import.
export { isWorldAnchored };
import { shootingStarBoost } from "./real-sky/boost.js";
import { arrangementRandom, skySeedKey } from "./daily/random.js";
import { hashString } from "./daily/seed.js";

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
    description: "Per-tick time increment for glare rotation",
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
    description:
      "Spawn probability — per frame solo, per sky tile per tick linked",
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

// ── World Arcs ──
// While linked, shooting stars are world events: a seeded roll per sky
// tile per world tick decides every spawn, and an arc's whole flight is a
// pure function of its spawn slot. Every window replays the same schedule
// from the same daily seed, so an arc crossing the gap between windows is
// the same arc on both sides — no handoff, no messaging, no leader. A
// window opening mid-flight recomputes the recent schedule and finds the
// arc already in the air.

// The daily seed, hashed once for the schedule.
let _worldSeedHash = null;
function worldSeedHash() {
  if (_worldSeedHash === null) _worldSeedHash = hashString(skySeedKey());
  return _worldSeedHash;
}

function arcMaxLifeTicks() {
  return SHOOTING.LIFE_MIN + SHOOTING.LIFE_RANGE;
}

// Materialize the arc spawned at slot (i, j, spawnTick), or null when the
// schedule rolls no spawn there.
function arcAt(seedHash, i, j, spawnTick) {
  const boost = shootingStarBoost(tickToMs(spawnTick));
  if (tickRoll(seedHash, i, j, spawnTick) >= SHOOTING.SPAWN_CHANCE * boost) {
    return null;
  }
  const r = tickStream(seedHash, i, j, spawnTick);
  return {
    key: `${i}:${j}:${spawnTick}`,
    spawnTick,
    x:
      i * WORLD_W + (r() * SKY_SHARED.X_SPREAD + SKY_SHARED.X_OFFSET) * WORLD_W,
    y: j * WORLD_H + r() * SHOOTING.Y_MAX * WORLD_H,
    angle:
      Math.PI * SKY_SHARED.ANGLE_MIN + r() * Math.PI * SHOOTING.ANGLE_RANGE,
    speed: SHOOTING.SPEED_MIN + r() * SHOOTING.SPEED_RANGE,
    len: SHOOTING.LEN_MIN + r() * SHOOTING.LEN_RANGE,
    opacity: SHOOTING.OPACITY_MIN + r() * SHOOTING.OPACITY_RANGE,
    maxLife: SHOOTING.LIFE_MIN + r() * SHOOTING.LIFE_RANGE,
  };
}

/**
 * Every scheduled arc alive at `tickTime` whose flight currently touches
 * `rect` (world coordinates), oldest spawn first. Pure: two windows asking
 * about overlapping rects at the same instant get the same arcs at the
 * same world positions. Each arc carries its head position (`headX`,
 * `headY`) and fractional `life` in ticks.
 */
export function activeWorldArcs(tickTime, rect, seedHash = worldSeedHash()) {
  const maxLife = arcMaxLifeTicks();
  // Farthest a flight can reach from its spawn tile, tail included — tiles
  // beyond this can't produce an arc visible in `rect`.
  const reach =
    (SHOOTING.SPEED_MIN + SHOOTING.SPEED_RANGE) * maxLife +
    (SHOOTING.LEN_MIN + SHOOTING.LEN_RANGE);
  const tick = Math.floor(tickTime);
  const i0 = Math.floor((rect.x - reach) / WORLD_W);
  const i1 = Math.floor((rect.x + rect.w + reach) / WORLD_W);
  const j0 = Math.floor((rect.y - reach) / WORLD_H);
  const j1 = Math.floor((rect.y + rect.h + reach) / WORLD_H);
  const arcs = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      for (let s = tick - maxLife; s <= tick; s++) {
        const arc = arcAt(seedHash, i, j, s);
        if (!arc) continue;
        const life = tickTime - arc.spawnTick;
        if (life > arc.maxLife) continue;
        const headX = arc.x + Math.cos(arc.angle) * arc.speed * life;
        const headY = arc.y + Math.sin(arc.angle) * arc.speed * life;
        // The tail trails the head by at most `len` — a head within that
        // slack of the rect is the loosest flight that can still touch it.
        if (
          headX < rect.x - arc.len ||
          headX > rect.x + rect.w + arc.len ||
          headY < rect.y - arc.len ||
          headY > rect.y + rect.h + arc.len
        ) {
          continue;
        }
        arc.life = life;
        arc.headX = headX;
        arc.headY = headY;
        arcs.push(arc);
      }
    }
  }
  arcs.sort((a, b) => a.spawnTick - b.spawnTick || a.x - b.x);
  return arcs;
}

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
    description: "Phase advance per tick for the aurora wave",
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

// ── World Anchoring ──
// The star arrangement is laid out in one sky tile (WORLD_W × WORLD_H).
// Solo, the tile is folded onto the viewport with a plain modulo — every
// star is always somewhere on screen whatever the window size, which the
// constellation puzzle depends on. Linked, the tile repeats across the
// desktop plane and each window draws its own world slice, so positions
// agree across every linked window and the sky reads as one surface. The
// link/unlink crossfade timing lives in world/anchor.js, shared with the
// other world-anchored layers.
export const WORLD_ANCHOR = defineConstants("sky.world", {
  SCRUB_TRAVEL_PX: {
    value: 400,
    min: 50,
    max: 2000,
    step: 25,
    description:
      "Cumulative window travel while linked that earns the fixed-stars discovery",
  },
  PARALLAX_WHILE_LINKED: {
    value: 0,
    min: 0,
    max: 1,
    step: 0.05,
    description:
      "Fraction of local scroll that still drives world-layer parallax while linked (0 = frozen so windows at different scroll offsets stay aligned; 1 = full per-window parallax)",
  },
});

// Off-viewport margin still considered on-slice, so halos and glare spikes
// don't pop at the edge of a world slice.
const WORLD_DRAW_MARGIN = 32;

function soloShift(depth, sp, canvasH) {
  return depth * sp * canvasH * STARS.PARALLAX_SCALE;
}

// Linked parallax is frozen to a shared fraction of local scroll
// (PARALLAX_WHILE_LINKED) so windows at different scroll offsets still sample
// the same slice and align across the seam — the spanned sky is anchored to the
// desktop, not to any one window's scroll. The solo regime uses soloShift, so
// this factor never touches solo behaviour.
function worldShift(depth, sp) {
  return (
    depth *
    sp *
    WORLD_ANCHOR.PARALLAX_WHILE_LINKED *
    WORLD_H *
    STARS.PARALLAX_SCALE
  );
}

// Single on-screen position of a star in the solo regime.
function soloInstance(star, sp, canvas) {
  return {
    x: star.x % canvas.width,
    y: floorMod(
      star.y - soloShift(star.depth, sp, canvas.height),
      canvas.height,
    ),
  };
}

// Every on-screen position of a star in the linked regime — the sky tile
// repeats across the desktop, so a viewport larger than the tile sees a
// star more than once, and a smaller one may not see it at all.
function worldInstances(star, sp, canvas, origin) {
  const m = WORLD_DRAW_MARGIN;
  const worldY = star.y - worldShift(star.depth, sp);
  const startX = floorMod(star.x - origin.x + m, WORLD_W) - m;
  const startY = floorMod(worldY - origin.y + m, WORLD_H) - m;
  const out = [];
  for (let x = startX; x < canvas.width + m; x += WORLD_W) {
    for (let y = startY; y < canvas.height + m; y += WORLD_H) {
      out.push({ x, y });
    }
  }
  return out;
}

/** Parallax displacement the star renderer applies at `depth` for scroll
 *  `sp`. Anchored, it's measured in sky-tile units so every window shifts
 *  identically; solo it scales with the local canvas height, as it always
 *  has. Consumers that mirror star positions must use this, never their
 *  own copy of the formula. */
export function starsParallaxShift(depth, sp, canvasH) {
  return isWorldAnchored()
    ? worldShift(depth, sp)
    : soloShift(depth, sp, canvasH);
}

/** Screen-space positions of a star this frame under the current regime —
 *  the single source of truth for anything that hit-tests or draws at star
 *  positions. May be empty in the linked regime (star off this window's
 *  world slice). `origin` is injectable for callers that already read it
 *  this frame. */
export function starScreenInstances(star, sp, canvas, origin) {
  return isWorldAnchored()
    ? worldInstances(star, sp, canvas, origin || worldOrigin())
    : [soloInstance(star, sp, canvas)];
}

// ── Factory ──

// Anchor positions in sky-tile space, one per quadrant. Constellations
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
      makeStar(arrangementRandom() * WORLD_W, arrangementRandom() * WORLD_H),
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

  // Fixed-timestep anchor: phase advances scale by elapsed world ticks, so
  // animation runs at the same world speed on every display refresh rate.
  let lastTickTime = worldTickTime();

  // Link/unlink crossfade tracker for the star layout — shared crossfade
  // timing with the other world-anchored layers.
  const anchorBlend = createAnchorBlend();

  // Window travel accumulated while linked, for the fixed-stars discovery.
  let scrubOrigin = null;
  let scrubTravel = 0;
  let scrubFired = false;

  // Arc heads drawn this frame, in canvas coordinates — the click
  // hit-test's view of what the user can currently see.
  const drawnArcs = [];

  // Border-crossing witness state, keyed by world-arc slot: an arc whose
  // head has visited both this window's slice and a linked peer's counts
  // as a crossing. Every window detects it from world truth alone and
  // fires its own achievement event — no messaging.
  const arcCrossings = new Map();

  return {
    draw(ctx, canvas, sp, pal, forces, scrollVelocity = 0) {
      // Elapsed world ticks since the last frame — clamped at zero because
      // the wall clock can step backwards under NTP adjustment.
      const tickTime = worldTickTime();
      const dTicks = Math.max(0, tickTime - lastTickTime);
      lastTickTime = tickTime;
      // Nothing is visible (or clickable) until this frame draws it.
      drawnArcs.length = 0;
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
          _auroraPhase += scaled(AURORA.WAVE_SPEED * dTicks);
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

      t += scaled(STARS.TIME_STEP * dTicks);
      // Hoisted halo opts shared across every glow-tier star this frame.
      const haloOpts = {
        midStop: STARS.GLOW_MID,
        midAlpha: STARS.GLOW_MID_ALPHA,
      };

      // Regime crossfade — on link/unlink the two star layouts dissolve
      // into each other instead of snapping, so the merge reads as the
      // skies joining rather than a glitch. Instant under reduced motion.
      const { anchored, blend } = anchorBlend();
      const origin = anchored || blend < 1 ? worldOrigin() : null;

      // The payoff of desktop anchoring is discoverable: move the window
      // and the sky holds still.  Enough cumulative travel while linked
      // earns the discovery, once per page load.
      if (anchored) {
        if (scrubOrigin) {
          scrubTravel +=
            Math.abs(origin.x - scrubOrigin.x) +
            Math.abs(origin.y - scrubOrigin.y);
          if (!scrubFired && scrubTravel >= WORLD_ANCHOR.SCRUB_TRAVEL_PX) {
            scrubFired = true;
            window.dispatchEvent(
              new CustomEvent("achievement", { detail: { type: "sky-scrub" } }),
            );
          }
        }
        scrubOrigin = { x: origin.x, y: origin.y };
      } else {
        scrubOrigin = null;
      }

      // Comet-streak inputs are star-independent — computed once.
      const absVel = Math.abs(scrollVelocity);
      let trailLen = 0;
      let trailDir = 0;
      if (!prefersReducedMotion() && absVel > COMET.VEL_THRESHOLD) {
        const frac = Math.min(
          1,
          (absVel - COMET.VEL_THRESHOLD) /
            (COMET.VEL_FULL - COMET.VEL_THRESHOLD),
        );
        trailLen = scaled(COMET.MAX_TRAIL_LEN * frac);
        trailDir = scrollVelocity > 0 ? -1 : 1;
      }

      // Draw one on-screen instance of a star.  Everything position-bound
      // lives here — hover boost, dwell candidacy, halo/dot, comet trail,
      // marker ring, glare — so both layout regimes and the crossfade
      // share a single code path.  `layerAlpha` is the regime's crossfade
      // weight.
      const drawStarInstance = (s, sx, py, layerAlpha, base, hint) => {
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
        const op =
          Math.min(
            1,
            base +
              s.flash +
              hoverBoost +
              hint +
              s.idleFlash * STARS.HOVER_BOOST,
          ) *
          starVis *
          layerAlpha;
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
        if (trailLen > 0.5) {
          drawTrail(
            ctx,
            sx,
            py,
            sx,
            py + trailDir * trailLen,
            [sc, sc, sc],
            op * COMET.OPACITY_SCALE,
            s.r * COMET.TRAIL_WIDTH_FACTOR,
          );
        }
        // Planted-star discovery marker: a faint, always-on outline ring.
        // Subtle enough not to spoil the puzzle at a glance, distinct
        // enough that a curious user catches the difference when they
        // sweep the cursor across the sky.
        if (s.constellationId) {
          ctx.save();
          ctx.globalAlpha = STARS.TAGGED_RING_OPACITY * starVis * layerAlpha;
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
          ctx.globalAlpha = s.flash * starVis * layerAlpha;
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
      };

      // Draw every instance of a star under one regime at the given
      // crossfade weight.
      const drawStarRegime = (s, worldAnchored, layerAlpha, base, hint) => {
        if (worldAnchored) {
          for (const p of worldInstances(s, sp, canvas, origin)) {
            drawStarInstance(s, p.x, p.y, layerAlpha, base, hint);
          }
        } else {
          drawStarInstance(
            s,
            s.x % canvas.width,
            floorMod(
              s.y - soloShift(s.depth, sp, canvas.height),
              canvas.height,
            ),
            layerAlpha,
            base,
            hint,
          );
        }
      };

      stars.forEach((s) => {
        s.twinkle += scaled(s.twinkleSpeed * dTicks);
        // Random bright flash — rare, brief spike.  Spawn probability
        // dampens with motion budget so no flash fires under reduced motion.
        if (s.flash > 0) {
          s.flash *= Math.pow(STARS.FLASH_DECAY, dTicks);
          if (s.flash < STARS.FLASH_THRESHOLD) s.flash = 0;
        } else if (chance(STARS.FLASH_CHANCE * dTicks)) {
          s.flash = STARS.FLASH_MIN + Math.random() * STARS.FLASH_RANGE;
          s.glare =
            s.r >= STARS.GLARE_THRESHOLD && Math.random() < STARS.GLARE_CHANCE;
        }
        const base =
          s.opacity *
          (STARS.TWINKLE_BASE + STARS.TWINKLE_RANGE * Math.sin(s.twinkle));
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
          s.idleFlash *= Math.pow(STARS.IDLE_FLASH_DECAY, dTicks);
          if (s.idleFlash < 0.01) s.idleFlash = 0;
        }
        drawStarRegime(s, anchored, blend, base, hint);
        if (blend < 1) drawStarRegime(s, !anchored, 1 - blend, base, hint);
      });

      // Awarded to the closest tagged star inside the hover radius for
      // this dwell.  Captured during the per-star loop above; firing it
      // after the loop keeps the per-star math simple.
      if (dwellNearestStar) {
        dwellNearestStar.idleFlash = STARS.IDLE_FLASH_STRENGTH;
      }

      // Draw one arc trail and record its head for the click hit-test.
      const drawArcTrail = (hx, hy, angle, len, opacity, p) => {
        // Fade in quickly, fade out slowly
        const fade = p < 0.1 ? p / 0.1 : (1 - p) / 0.9;
        const op = opacity * fade * starVis;
        const tailX = hx - Math.cos(angle) * len * Math.min(1, p * 3);
        const tailY = hy - Math.sin(angle) * len * Math.min(1, p * 3);
        drawTrail(
          ctx,
          hx,
          hy,
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
        drawnArcs.push({ x: hx, y: hy });
      };

      // Shooting stars — rare fast arcs across the sky.  Solo, this window
      // rolls its own in local coordinates, exactly as ever: spawn rate
      // dampens with motion budget, so under reduced motion no new arcs
      // appear (in-flight ones still complete and fade out cleanly).
      // During a real meteor shower the sky actually falls more often.
      if (!anchored && chance(SHOOTING.SPAWN_CHANCE * shootingStarBoost())) {
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
        ss.life += dTicks;
        if (ss.life > ss.maxLife) {
          ss.active = false;
          return;
        }
        // Position advances by elapsed ticks, intentionally not motion-
        // scaled — once an arc is in flight it must complete instead of
        // freezing mid-trail if the user toggles reduced motion
        // mid-flight.  Spawn is gated by chance() above; this branch only
        // runs for already-spawned arcs.
        ss.x += Math.cos(ss.angle) * ss.speed * dTicks;
        ss.y += Math.sin(ss.angle) * ss.speed * dTicks;
        // Fully off-screen (tail included) the arc is invisible for the
        // rest of its life — free the slot.
        if (
          ss.x < -ss.len ||
          ss.x > canvas.width + ss.len ||
          ss.y < -ss.len ||
          ss.y > canvas.height + ss.len
        ) {
          ss.active = false;
          return;
        }
        drawArcTrail(
          ss.x,
          ss.y,
          ss.angle,
          ss.len,
          ss.opacity,
          ss.life / ss.maxLife,
        );
      });

      // Linked, arcs come from the shared world schedule instead: every
      // window shows the same flights at the same desktop positions, so a
      // flight crosses the gap between windows as one continuous arc.
      // Local leftovers above still finish after a link forms; the
      // schedule owns every new spawn.  Skipped entirely under reduced
      // motion — the world truth continues, this window just doesn't show
      // it (mid-flight arcs vanish if the preference flips mid-flight).
      if (anchored && !prefersReducedMotion()) {
        const selfRect = {
          x: origin.x,
          y: origin.y,
          w: canvas.width,
          h: canvas.height,
        };
        const worldArcs = activeWorldArcs(tickTime, selfRect);
        const drawCount = Math.min(worldArcs.length, SHOOTING.POOL_SIZE);
        for (let k = 0; k < drawCount; k++) {
          const arc = worldArcs[k];
          drawArcTrail(
            arc.headX - origin.x,
            arc.headY - origin.y,
            arc.angle,
            arc.len,
            arc.opacity,
            arc.life / arc.maxLife,
          );
        }

        // Border-crossing witness — mark which slices each live arc's
        // head has visited, and celebrate the first arc seen on both
        // sides.  Runs only while this window can actually witness it
        // (visible star layer, motion allowed).
        const peers = peerWorldRects();
        const noteVisit = (arc, rect, field) => {
          if (
            arc.headX < rect.x ||
            arc.headX > rect.x + rect.w ||
            arc.headY < rect.y ||
            arc.headY > rect.y + rect.h
          ) {
            return;
          }
          let entry = arcCrossings.get(arc.key);
          if (!entry) {
            entry = {
              spawnTick: arc.spawnTick,
              mine: false,
              peer: false,
              fired: false,
            };
            arcCrossings.set(arc.key, entry);
          }
          entry[field] = true;
          if (!entry.fired && entry.mine && entry.peer) {
            entry.fired = true;
            window.dispatchEvent(
              new CustomEvent("achievement", {
                detail: { type: "sky-link-handoff" },
              }),
            );
          }
        };
        for (const arc of worldArcs) noteVisit(arc, selfRect, "mine");
        for (const peerRect of peers) {
          for (const arc of activeWorldArcs(tickTime, peerRect)) {
            noteVisit(arc, peerRect, "peer");
          }
        }
        for (const [key, entry] of arcCrossings) {
          if (tickTime - entry.spawnTick > arcMaxLifeTicks() + 1) {
            arcCrossings.delete(key);
          }
        }
      } else if (arcCrossings.size > 0) {
        arcCrossings.clear();
      }
    },

    // Hit-test a click (canvas-pixel coords) against the head of any
    // shooting star drawn this frame.  Generous radius since the arcs
    // move fast.  Returns true on a hit so the caller can reward the
    // catch.
    clickShootingStar(cx, cy) {
      for (const arc of drawnArcs) {
        const dx = arc.x - cx;
        const dy = arc.y - cy;
        if (dx * dx + dy * dy <= SHOOTING.HIT_RADIUS * SHOOTING.HIT_RADIUS) {
          return true;
        }
      }
      return false;
    },
  };
}
