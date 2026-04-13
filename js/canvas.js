import { lerpColor, multiLerp, toRgba, resolvePalette } from './colors.js';
import { bindPointer } from './pointer.js';

// ── Stars ──
const STAR_RADIUS_MIN = 0.3;
const STAR_RADIUS_RANGE = 1;
const STAR_OPACITY_MIN = 0.1;
const STAR_OPACITY_RANGE = 0.4;
const STAR_TWINKLE_SPEED_MIN = 0.008;
const STAR_TWINKLE_SPEED_RANGE = 0.03;
const STAR_DEPTH_MIN = 0.1;
const STAR_DEPTH_RANGE = 0.9;
const STAR_FLASH_CHANCE = 0.0003;
const STAR_FLASH_MIN = 0.6;
const STAR_FLASH_RANGE = 0.4;
const STAR_FLASH_DECAY = 0.92;
const STAR_FLASH_THRESHOLD = 0.01;
const STAR_TWINKLE_BASE = 0.7;
const STAR_TWINKLE_RANGE = 0.3;
const STAR_PARALLAX_SCALE = 0.4;
const STAR_FADE_START = 0.2;
const STAR_FADE_END = 0.5;
const STAR_TIME_STEP = 0.008;
const STAR_GLOW_THRESHOLD = 0.8;
const STAR_GLOW_RADIUS = 2.5;
const STAR_GLOW_MID = 0.35;
const STAR_GLOW_MID_ALPHA = 0.4;
const STAR_GLARE_THRESHOLD = 1.0;
const STAR_GLARE_CHANCE = 0.15;
const STAR_GLARE_SPIKE_LENGTH = 14;
const STAR_GLARE_WIDTH = 0.6;
const STAR_GLARE_ROTATION_SPEED = 0.15;

// ── Shooting Stars ──
const SHOOTING_POOL_SIZE = 3;
const SHOOTING_SPAWN_CHANCE = 0.003;
const SHOOTING_X_SPREAD = 0.8;
const SHOOTING_X_OFFSET = 0.1;
const SHOOTING_Y_MAX = 0.4;
const SHOOTING_ANGLE_MIN = 0.15;
const SHOOTING_ANGLE_RANGE = 0.2;
const SHOOTING_SPEED_MIN = 6;
const SHOOTING_SPEED_RANGE = 8;
const SHOOTING_LEN_MIN = 40;
const SHOOTING_LEN_RANGE = 60;
const SHOOTING_OPACITY_MIN = 0.3;
const SHOOTING_OPACITY_RANGE = 0.4;
const SHOOTING_LIFE_MIN = 20;
const SHOOTING_LIFE_RANGE = 20;
const SHOOTING_LINE_WIDTH = 1.2;

// ── Streaks ──
const STREAK_LEN_MIN = 40;
const STREAK_LEN_RANGE = 100;
const STREAK_SPEED_MIN = 0.3;
const STREAK_SPEED_RANGE = 0.5;
const STREAK_OPACITY_MIN = 0.02;
const STREAK_OPACITY_RANGE = 0.05;
const STREAK_WIDTH_MIN = 0.5;
const STREAK_WIDTH_RANGE = 1;
const STREAK_ANGLE_MIN = -0.1;
const STREAK_ANGLE_RANGE = 0.2;

// ── Clouds ──
const CLOUD_X_SPREAD = 1.4;
const CLOUD_X_OFFSET = 0.2;
const CLOUD_Y_DEPTH = 3;
const CLOUD_Y_OFFSET = 0.5;
const CLOUD_DRIFT_MAX = 0.12;
const CLOUD_SCALE_MIN = 0.5;
const CLOUD_SCALE_RANGE = 0.8;
const CLOUD_BLOB_COUNT_MIN = 4;
const CLOUD_BLOB_COUNT_RANGE = 3;
const CLOUD_BLOB_SPACING = 30;
const CLOUD_BLOB_JITTER_X = 25;
const CLOUD_BLOB_JITTER_Y = 40;
const CLOUD_BLOB_Y_BIAS = 0.65;
const CLOUD_BLOB_RADIUS_MIN = 30;
const CLOUD_BLOB_RADIUS_RANGE = 40;
const CLOUD_WRAP_MARGIN = 250;
const CLOUD_CULL_MARGIN = 150;
const CLOUD_OPACITY_BASE = 0.08;
const CLOUD_OPACITY_DEPTH = 0.04;
const CLOUD_GRAD_INNER = 0.08;
const CLOUD_GRAD_MID = 0.55;
const CLOUD_GRAD_MID_OPACITY = 0.4;
const CLOUD_Y_PIVOT = 0.38;
const CLOUD_Y_SCALE = 4;
const CLOUD_FADE_IN_START = 0.12;
const CLOUD_FADE_IN_END = 0.22;
const CLOUD_FADE_OUT_START = 0.65;
const CLOUD_FADE_OUT_END = 0.82;
const CLOUD_PUSH_FORCE = 0.8;
const CLOUD_PUSH_RADIUS = 300;
const CLOUD_PULL_FORCE = 0.15;
const CLOUD_PULL_RADIUS = 300;

// ── Breeze Wisps ──
const WISP_LEN_MIN = 100;
const WISP_LEN_RANGE = 200;
const WISP_SPEED_MIN = 0.3;
const WISP_SPEED_RANGE = 0.5;
const WISP_AMP_MIN = 8;
const WISP_AMP_RANGE = 16;
const WISP_OPACITY_MIN = 0.04;
const WISP_OPACITY_RANGE = 0.08;
const WISP_WIDTH_MIN = 0.8;
const WISP_WIDTH_RANGE = 1.5;
const WISP_PHASE_SPEED = 0.01;
const WISP_FALLBACK_COLOR = [180, 215, 245];
const WISP_Y_PIVOT = 0.45;
const WISP_Y_SCALE = 2.5;
const WISP_FADE_IN_START = 0.15;
const WISP_FADE_IN_END = 0.25;
const WISP_FADE_OUT_START = 0.70;
const WISP_FADE_OUT_END = 0.85;

// ── Scroll Motes ──
const MOTE_RADIUS_MIN = 0.8;
const MOTE_RADIUS_RANGE = 1.5;
const MOTE_SCROLL_THRESHOLD = 0.3;
const MOTE_VY_FACTOR = 0.06;
const MOTE_VX_FACTOR = 0.04;
const MOTE_OPACITY_MAX = 0.4;
const MOTE_OPACITY_GAIN = 0.008;
const MOTE_GRAVITY = 0.015;
const MOTE_FRICTION = 0.975;
const MOTE_OPACITY_DECAY = 0.98;
const MOTE_BOUNDS = 30;
const MOTE_DRAW_THRESHOLD = 0.005;
const MOTE_GLOW_RADIUS = 4;
const MOTE_GRAD_MID = 0.3;
const MOTE_GRAD_MID_OPACITY = 0.4;

// ── Horizon ──
const HORIZON_Y_BASE = 0.75;
const HORIZON_Y_SHIFT = 0.25;
const HORIZON_INTENSITY_BASE = 0.12;
const HORIZON_INTENSITY_SCROLL = 0.10;
const HORIZON_INTENSITY_FALLOFF = 0.15;
const HORIZON_RADIUS_BASE = 0.7;
const HORIZON_RADIUS_SCROLL = 0.2;

// ── Gusts ──
const GUST_SCROLL_THRESHOLD = 1.5;
const GUST_SPAWN_MAX = 2;
const GUST_SPAWN_DIVISOR = 4;
const GUST_LEN_MIN = 25;
const GUST_LEN_RANGE = 45;
const GUST_OPACITY_MIN = 0.05;
const GUST_OPACITY_RANGE = 0.08;
const GUST_WIDTH_MIN = 0.4;
const GUST_WIDTH_RANGE = 0.6;
const GUST_LIFE_MIN = 18;
const GUST_LIFE_RANGE = 14;

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
const ATTRACT_RADIUS_BASE = 250;
const ATTRACT_RADIUS_HOLD = 200;
const ATTRACT_FORCE_BASE = 0.12;
const ATTRACT_FORCE_HOLD = 0.4;
const ATTRACT_TANGENT_FACTOR = 0.6;
const BLAST_BASE = 3;
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

// ── Impulse & Scroll ──
const IMPULSE_DECAY = 0.88;
const IMPULSE_REPEL_RADIUS = 200;
const IMPULSE_REPEL_SCALE = 20;
const IMPULSE_MOTE_OPACITY_GAIN = 0.1;
const SCROLL_VEL_GAIN = 0.3;
const SCROLL_VEL_DECAY = 0.92;

// ── Snowflakes (Frozen mode) ──
const SNOW_COUNT = 40;
const SNOW_RADIUS_MIN = 1.5;
const SNOW_RADIUS_RANGE = 3;
const SNOW_FALL_MIN = 0.3;
const SNOW_FALL_RANGE = 0.5;
const SNOW_SWAY_SPEED_MIN = 0.008;
const SNOW_SWAY_SPEED_RANGE = 0.012;
const SNOW_SWAY_AMP_MIN = 0.3;
const SNOW_SWAY_AMP_RANGE = 0.5;
const SNOW_OPACITY_MIN = 0.2;
const SNOW_OPACITY_RANGE = 0.5;
const SNOW_GLOW_RADIUS = 3;
const SNOW_GLOW_OPACITY = 0.25;
const SNOW_FRICTION = 0.96;
const SNOW_REPEL_RADIUS = 150;
const SNOW_REPEL_DAMPEN = 0.8;
const SNOW_ATTRACT_RADIUS = 150;
const SNOW_ATTRACT_STRENGTH = 0.1;
const SNOW_ATTRACT_TANGENT = 0.6;
const SNOW_SCROLL_THRESHOLD = 0.5;
const SNOW_SCROLL_VY = 0.03;
const SNOW_SCROLL_VX = 0.02;

// ── Snow Globe Shake ──
const SHAKE_REVERSAL_WINDOW = 500;  // ms — direction changes within this window count
const SHAKE_REVERSALS_NEEDED = 3;   // rapid reversals to trigger a shake
const SHAKE_MIN_DELTA = 3;          // minimum scroll delta to count as directional
const SHAKE_TURBULENCE = 4;         // velocity burst per snowflake on shake
const SHAKE_DECAY = 0.97;           // turbulence multiplier decays per frame
const SHAKE_OPACITY_BOOST = 0.15;   // temporary opacity increase during turbulence

// ── Sub-mode registry ──
// Body class names for each easter-egg mode. Used for active mode detection
// and palette resolution. Adding a new mode: push its body class here.
const SUBMODES = ['deep-sea', 'frozen', 'blocky', 'upside-down'];

// ── Blocky Pixelation ──
const PIXEL_SCALE = 6;

// ── Terrain (Blocky mode) ──
const TERRAIN_HEIGHT_RATIO = 0.25;       // front terrain occupies bottom 25% of canvas
const TERRAIN_MID_HEIGHT_RATIO = 0.22;   // mid hills buffer height ratio
const TERRAIN_BACK_HEIGHT_RATIO = 0.40;  // back mountains buffer height ratio (tallest — frames the scene)
const TERRAIN_BLOCK_SIZE = 6;            // matches pixel scale for crisp alignment
const TERRAIN_TREE_CHANCE = 0.06;        // chance per column to have a tree
const TERRAIN_TREE_MIN_GAP = 10;         // minimum columns between trees
const TERRAIN_ORE_CHANCE = 0.02;         // chance per stone block for ore pixel
const TERRAIN_BACK_SPEED = 0.20;         // horizontal parallax speed for back mountains
const TERRAIN_MID_SPEED = 0.50;          // horizontal parallax speed for mid hills
const TERRAIN_FRONT_SPEED = 0.80;        // horizontal parallax speed for front terrain
const TERRAIN_SCROLL_RANGE = 0.40;       // scroll-to-pixel multiplier (higher = more horizontal travel)
const TERRAIN_POP_MAX = 10;              // max simultaneous popping blocks
const TERRAIN_POP_DIST = 80;             // click radius for block pops
const TERRAIN_POP_DURATION = 20;         // frames for a pop animation
const TERRAIN_FADE_IN_START = 0.55;      // scroll position where terrain starts to appear
const TERRAIN_FADE_IN_END = 0.70;        // scroll position where terrain is fully visible
const TERRAIN_BEVEL_SIZE = 2;            // pixel width of highlight/shadow edges
const TERRAIN_BEVEL_HIGHLIGHT = 40;      // RGB increase for top/left-edge highlight
const TERRAIN_BEVEL_SHADOW = 40;         // RGB decrease for right/bottom-edge shadow
const TERRAIN_POP_LIFT_BLOCKS = 3;      // pop lifts this many block-sizes above surface

// Terrain colors (used directly by terrain renderer)
const TERRAIN_GRASS     = [90, 140, 60];
const TERRAIN_GRASS_ALT = [70, 115, 45];
const TERRAIN_DIRT      = [140, 100, 55];
const TERRAIN_DIRT_ALT  = [110, 80, 40];
const TERRAIN_STONE     = [120, 120, 120];
const TERRAIN_STONE_ALT = [90, 90, 90];
const TERRAIN_DEEP      = [80, 80, 80];
const TERRAIN_ORE       = [200, 160, 60];
const TERRAIN_TRUNK     = [90, 60, 30];
const TERRAIN_LEAVES    = [60, 130, 40];
const TERRAIN_MOUNTAIN  = [50, 55, 80];
const TERRAIN_HILLS     = [60, 90, 50];

// ── Fireflies (Blocky mode) ──
const FIREFLY_COUNT = 28;
const FIREFLY_RADIUS = 2;               // drawn at pixel-scale after pixelation
const FIREFLY_PULSE_MIN = 0.3;
const FIREFLY_PULSE_SPEED_MIN = 0.01;
const FIREFLY_PULSE_SPEED_RANGE = 0.02;
const FIREFLY_DRIFT = 0.3;              // random walk velocity per frame
const FIREFLY_FRICTION = 0.96;
const FIREFLY_OPACITY_MIN = 0.4;
const FIREFLY_OPACITY_RANGE = 0.4;
const FIREFLY_REPEL_RADIUS = 120;
const FIREFLY_REPEL_DAMPEN = 1.2;
const FIREFLY_ATTRACT_RADIUS = 180;
const FIREFLY_ATTRACT_STRENGTH = 0.15;
const FIREFLY_SCROLL_VX = 0.02;
const FIREFLY_SCROLL_THRESHOLD = 0.5;
const FIREFLY_COLOR = [255, 240, 100];
const FIREFLY_TRAIL_ALPHA = 0.3;

// ── Butterflies (Blocky light mode) ──
const BUTTERFLY_COLORS = [
  [255, 80, 80],    // red
  [80, 120, 255],   // blue
  [255, 220, 60],   // yellow
  [180, 80, 255],   // purple
];
const BUTTERFLY_FLAP_SPEED = 0.08;

// ── Block Fragments (Blocky click effect) ──
const BLOCK_FRAG_COUNT_MIN = 8;
const BLOCK_FRAG_COUNT_RANGE = 5;
const BLOCK_FRAG_SIZE = 3;              // pixel block size at display scale
const BLOCK_FRAG_SPEED_MIN = 2;
const BLOCK_FRAG_SPEED_RANGE = 4;
const BLOCK_FRAG_GRAVITY = 0.12;
const BLOCK_FRAG_LIFE = 48;             // ~800ms at 60fps
const BLOCK_FRAG_TUMBLE_INTERVAL = 9;   // frames between 90° rotations
const BLOCK_FRAG_MAX = 80;              // pool cap for block fragments

// ── Bubbles (Deep Sea mode) ──
const BUBBLE_COUNT = 30;
const BUBBLE_AMBIENT_RATE = 2.5;     // bubbles per second from bottom
const BUBBLE_RADIUS_MIN = 2;
const BUBBLE_RADIUS_RANGE = 12;
const BUBBLE_RISE_MIN = 0.4;
const BUBBLE_RISE_RANGE = 0.8;
const BUBBLE_WOBBLE_SPEED_MIN = 0.015;
const BUBBLE_WOBBLE_SPEED_RANGE = 0.02;
const BUBBLE_WOBBLE_AMP_MIN = 0.4;
const BUBBLE_WOBBLE_AMP_RANGE = 0.8;
const BUBBLE_OPACITY_MIN = 0.3;
const BUBBLE_OPACITY_RANGE = 0.4;
const BUBBLE_GROWTH_RATE = 0.001;    // radius growth per frame
const BUBBLE_FRICTION = 0.96;
const BUBBLE_REPEL_RADIUS = 150;
const BUBBLE_REPEL_DAMPEN = 0.8;
const BUBBLE_ATTRACT_RADIUS = 150;
const BUBBLE_ATTRACT_STRENGTH = 0.1;
const BUBBLE_ATTRACT_TANGENT = 0.6;
const BUBBLE_SCROLL_THRESHOLD = 0.5;
const BUBBLE_SCROLL_VX = 0.03;
const BUBBLE_CLICK_BURST_MIN = 8;
const BUBBLE_CLICK_BURST_RANGE = 8;
const BUBBLE_DRAG_RATE = 0.3;       // bubbles per trail segment
const BUBBLE_SPECULAR_THRESHOLD = 5; // radius threshold for full specular arc
const BUBBLE_LARGE_THRESHOLD = 9;    // radius threshold for secondary highlight
const BUBBLE_POP_FRAMES = 8;         // frames for pop animation

// ── Jellyfish (Deep Sea mode) ──
const JELLY_COUNT = 8;
const JELLY_BELL_MIN = 8;
const JELLY_BELL_RANGE = 27;        // 8-35px bell radius
const JELLY_TENTACLE_SMALL = 3;
const JELLY_TENTACLE_MED = 4;
const JELLY_TENTACLE_LARGE = 5;
const JELLY_TENTACLE_MED_THRESHOLD = 15;
const JELLY_TENTACLE_LARGE_THRESHOLD = 25;
const JELLY_PULSE_SPEED_MIN = 0.008;
const JELLY_PULSE_SPEED_RANGE = 0.008;
const JELLY_PULSE_STRENGTH = 0.6;   // upward impulse per pulse
const JELLY_DRIFT_VX = 0.15;
const JELLY_DRIFT_VY = 0.05;        // slow downward drift between pulses
const JELLY_DIRECTION_CHANGE = 0.002;// chance per frame to change horizontal direction
const JELLY_GLOW_PULSE_SPEED = 0.02;
const JELLY_GLOW_ALPHA_MIN = 0.06;
const JELLY_GLOW_ALPHA_RANGE = 0.08;
const JELLY_FRICTION = 0.985;
const JELLY_REPEL_RADIUS = 180;
const JELLY_REPEL_DAMPEN = 0.3;     // high friction so they don't rocket away
const JELLY_ATTRACT_RADIUS = 200;
const JELLY_ATTRACT_STRENGTH = 0.04;// weak — they drift lazily
const JELLY_TENTACLE_SEGMENTS = 4;
const JELLY_TENTACLE_SEG_LEN_RATIO = 0.8; // tentacle length relative to bell
const JELLY_TENTACLE_WAVE_AMP = 0.3;
const JELLY_TENTACLE_WAVE_SPEED = 0.03;
const JELLY_COLORS = [
  [0, 255, 180],   // teal
  [0, 200, 255],   // cyan
  [100, 255, 200], // green
  [180, 150, 255], // soft purple
  [0, 230, 200],   // cyan-green
];

let canvas, ctx;

// Tapered gradient trail shared by shooting stars and meteors.
// colors is a 3-element array: [tail, mid, head] RGB strings.
function drawTrail(headX, headY, tailX, tailY, colors, opacity, lineWidth) {
  const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
  grad.addColorStop(0, `rgba(${colors[0]},0)`);
  grad.addColorStop(0.7, `rgba(${colors[1]},${opacity * 0.3})`);
  grad.addColorStop(1, `rgba(${colors[2]},${opacity})`);
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();
  ctx.restore();
}

function getStreakParams(sp) {
  if (sp < 0.2) return { opMul: 1.0, speedMul: 1.0 };
  if (sp < 0.5) return { opMul: 1.3, speedMul: 1.2 };
  if (sp < 0.75) return { opMul: 0.8, speedMul: 1.5 };
  return { opMul: 0.3, speedMul: 0.5 };
}

// Trapezoidal scroll-visibility fade: 0 → fade in → 1 → fade out → 0.
// For fade-out-only (e.g. stars), pass inStart = inEnd = 0.
function scrollFade(sp, inStart, inEnd, outStart, outEnd) {
  if (sp < inStart) return 0;
  if (sp < inEnd) return (inEnd === inStart) ? 1 : (sp - inStart) / (inEnd - inStart);
  if (sp < outStart) return 1;
  if (sp < outEnd) return 1 - (sp - outStart) / (outEnd - outStart);
  return 0;
}

class Cloud {
  constructor(i, total) {
    this.x = Math.random() * canvas.width * CLOUD_X_SPREAD - canvas.width * CLOUD_X_OFFSET;
    this.baseY = (i / total) * canvas.height * CLOUD_Y_DEPTH - canvas.height * CLOUD_Y_OFFSET;
    this.speedX = (Math.random() - 0.5) * CLOUD_DRIFT_MAX;
    this.scale = CLOUD_SCALE_MIN + Math.random() * CLOUD_SCALE_RANGE;
    const count = CLOUD_BLOB_COUNT_MIN + Math.floor(Math.random() * CLOUD_BLOB_COUNT_RANGE);
    this.blobs = [];
    for (let j = 0; j < count; j++) {
      this.blobs.push({
        ox: (j - count / 2) * CLOUD_BLOB_SPACING * this.scale + (Math.random() - 0.5) * CLOUD_BLOB_JITTER_X * this.scale,
        oy: (Math.random() - CLOUD_BLOB_Y_BIAS) * CLOUD_BLOB_JITTER_Y * this.scale,
        r: (CLOUD_BLOB_RADIUS_MIN + Math.random() * CLOUD_BLOB_RADIUS_RANGE) * this.scale,
      });
    }
  }
  update() {
    this.x += this.speedX;
    const m = CLOUD_WRAP_MARGIN * this.scale;
    if (this.x < -m) this.x += canvas.width + m * 2;
    if (this.x > canvas.width + m) this.x -= canvas.width + m * 2;
  }
  draw(yOffset, vis, pal) {
    if (vis <= 0) return;
    const y = this.baseY + yOffset;
    if (y < -CLOUD_CULL_MARGIN || y > canvas.height + CLOUD_CULL_MARGIN) return;
    const cw = pal.cloudWhite;
    const cm = pal.cloudMid;
    this.blobs.forEach(b => {
      const bx = this.x + b.ox;
      const by = y + b.oy;
      const op = (CLOUD_OPACITY_BASE + CLOUD_OPACITY_DEPTH * this.scale) * vis;
      const grad = ctx.createRadialGradient(bx, by, b.r * CLOUD_GRAD_INNER, bx, by, b.r);
      grad.addColorStop(0, `rgba(${cw[0]},${cw[1]},${cw[2]},${op})`);
      grad.addColorStop(CLOUD_GRAD_MID, `rgba(${cm[0]},${cm[1]},${cm[2]},${op * CLOUD_GRAD_MID_OPACITY})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

class Streak {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : -10;
    this.len = STREAK_LEN_MIN + Math.random() * STREAK_LEN_RANGE;
    this.speed = STREAK_SPEED_MIN + Math.random() * STREAK_SPEED_RANGE;
    this.opacity = STREAK_OPACITY_MIN + Math.random() * STREAK_OPACITY_RANGE;
    this.width = STREAK_WIDTH_MIN + Math.random() * STREAK_WIDTH_RANGE;
    this.angle = STREAK_ANGLE_MIN + Math.random() * STREAK_ANGLE_RANGE;
  }
  update(sp) {
    this.y += this.speed * sp.speedMul;
    this.x += this.angle;
    if (this.y > canvas.height + this.len) this.reset(false);
  }
  draw(sp, pal) {
    ctx.save();
    ctx.globalAlpha = this.opacity * sp.opMul;
    ctx.strokeStyle = `rgba(${pal.streakColor},1)`;
    ctx.lineWidth = this.width;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.len);
    ctx.lineTo(this.x + this.angle * this.len, this.y);
    ctx.stroke();
    ctx.restore();
  }
}

class BreezeWisp {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = init ? Math.random() * canvas.width : -300;
    this.y = Math.random() * canvas.height;
    this.len = WISP_LEN_MIN + Math.random() * WISP_LEN_RANGE;
    this.speed = WISP_SPEED_MIN + Math.random() * WISP_SPEED_RANGE;
    this.waveAmp = WISP_AMP_MIN + Math.random() * WISP_AMP_RANGE;
    this.opacity = WISP_OPACITY_MIN + Math.random() * WISP_OPACITY_RANGE;
    this.width = WISP_WIDTH_MIN + Math.random() * WISP_WIDTH_RANGE;
    this.phase = Math.random() * Math.PI * 2;
  }
  update() {
    this.x += this.speed;
    this.phase += WISP_PHASE_SPEED;
    if (this.x > canvas.width + this.len) this.reset(false);
  }
  draw(vis, pal, yOffset) {
    if (vis <= 0) return;
    const wc = pal ? pal.wispColor : WISP_FALLBACK_COLOR;
    const dy = this.y + (yOffset || 0);
    if (dy < -50 || dy > canvas.height + 50) return;
    ctx.save();
    ctx.globalAlpha = this.opacity * vis;
    ctx.strokeStyle = `rgba(${wc[0]},${wc[1]},${wc[2]},1)`;
    ctx.lineWidth = this.width;
    ctx.beginPath();
    const sx = this.x - this.len;
    const sy = dy + Math.sin(this.phase) * this.waveAmp;
    const cy = dy + Math.sin(this.phase + 1) * this.waveAmp;
    const ey = dy + Math.sin(this.phase + 2) * this.waveAmp;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(this.x - this.len * 0.5, cy, this.x, ey);
    ctx.stroke();
    ctx.restore();
  }
}

class ScrollMote {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = 0;
    this.vy = 0;
    this.r = MOTE_RADIUS_MIN + Math.random() * MOTE_RADIUS_RANGE;
    this.opacity = 0;
  }
  update(sv) {
    const absSv = Math.abs(sv);
    if (absSv > MOTE_SCROLL_THRESHOLD) {
      this.vy -= sv * MOTE_VY_FACTOR;
      this.vx += (Math.random() - 0.5) * absSv * MOTE_VX_FACTOR;
      this.opacity = Math.min(MOTE_OPACITY_MAX, this.opacity + absSv * MOTE_OPACITY_GAIN);
    }
    this.vy += MOTE_GRAVITY;
    this.vx *= MOTE_FRICTION;
    this.vy *= MOTE_FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    this.opacity *= MOTE_OPACITY_DECAY;
    if (this.y < -MOTE_BOUNDS || this.y > canvas.height + MOTE_BOUNDS ||
        this.x < -MOTE_BOUNDS || this.x > canvas.width + MOTE_BOUNDS) {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = 0;
      this.vy = 0;
    }
  }
  draw(pal) {
    if (this.opacity < MOTE_DRAW_THRESHOLD) return;
    const c = pal.moteColor;
    const g = pal.moteGlow;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * MOTE_GLOW_RADIUS);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${this.opacity})`);
    grad.addColorStop(MOTE_GRAD_MID, `rgba(${g[0]},${g[1]},${g[2]},${this.opacity * MOTE_GRAD_MID_OPACITY})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * MOTE_GLOW_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}

const SNOW_CRYSTAL_THRESHOLD = 3;  // flakes with r >= this get crystalline arms
const SNOW_BRANCH_RATIO = 0.35;    // branch length relative to arm
const SNOW_BRANCH_ANGLE = Math.PI / 4;

class Snowflake {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : -10;
    this.r = SNOW_RADIUS_MIN + Math.random() * SNOW_RADIUS_RANGE;
    this.fallSpeed = SNOW_FALL_MIN + Math.random() * SNOW_FALL_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed = SNOW_SWAY_SPEED_MIN + Math.random() * SNOW_SWAY_SPEED_RANGE;
    this.swayAmp = SNOW_SWAY_AMP_MIN + Math.random() * SNOW_SWAY_AMP_RANGE;
    this.opacity = SNOW_OPACITY_MIN + Math.random() * SNOW_OPACITY_RANGE;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.01;
  }
  update() {
    this.sway += this.swaySpeed;
    this.rotation += this.rotSpeed;
    this.x += Math.sin(this.sway) * this.swayAmp + this.vx;
    this.y += this.fallSpeed + this.vy;
    this.vx *= SNOW_FRICTION;
    this.vy *= SNOW_FRICTION;
    if (this.y > canvas.height + 10) this.reset(false);
    if (this.x < -20) this.x += canvas.width + 40;
    if (this.x > canvas.width + 20) this.x -= canvas.width + 40;
  }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    if (this.r >= SNOW_CRYSTAL_THRESHOLD) {
      // Crystalline snowflake — 6 arms with branches, slow rotation
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.strokeStyle = 'rgba(220,240,255,1)';
      ctx.lineWidth = 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const arm = this.r;
      const branch = arm * SNOW_BRANCH_RATIO;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const ax = Math.cos(a) * arm;
        const ay = Math.sin(a) * arm;
        ctx.moveTo(0, 0);
        ctx.lineTo(ax, ay);
        // Two branches at 2/3 along the arm
        const mx = Math.cos(a) * arm * 0.6;
        const my = Math.sin(a) * arm * 0.6;
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a + SNOW_BRANCH_ANGLE) * branch, my + Math.sin(a + SNOW_BRANCH_ANGLE) * branch);
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a - SNOW_BRANCH_ANGLE) * branch, my + Math.sin(a - SNOW_BRANCH_ANGLE) * branch);
      }
      ctx.stroke();
      // Subtle glow for larger crystalline flakes
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * SNOW_GLOW_RADIUS);
      grad.addColorStop(0, `rgba(200,230,255,${SNOW_GLOW_OPACITY})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.r * SNOW_GLOW_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Small flakes — simple glowing dots
      ctx.fillStyle = 'rgba(220,240,255,1)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Bubble {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : canvas.height + 10;
    this.baseR = BUBBLE_RADIUS_MIN + Math.random() * BUBBLE_RADIUS_RANGE;
    this.r = this.baseR;
    this.riseSpeed = BUBBLE_RISE_MIN + (this.baseR / (BUBBLE_RADIUS_MIN + BUBBLE_RADIUS_RANGE)) * BUBBLE_RISE_RANGE;
    this.vx = 0;
    this.vy = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = BUBBLE_WOBBLE_SPEED_MIN + Math.random() * BUBBLE_WOBBLE_SPEED_RANGE;
    this.wobbleAmp = BUBBLE_WOBBLE_AMP_MIN + Math.random() * BUBBLE_WOBBLE_AMP_RANGE;
    this.opacity = BUBBLE_OPACITY_MIN + Math.random() * BUBBLE_OPACITY_RANGE;
    this.popping = false;
    this.popFrame = 0;
    this.active = init;
  }
  update() {
    if (this.popping) {
      this.popFrame++;
      if (this.popFrame > BUBBLE_POP_FRAMES) { this.reset(false); this.active = false; return; }
      this.r = this.baseR * (1 + this.popFrame / BUBBLE_POP_FRAMES * 0.5);
      this.opacity = (BUBBLE_OPACITY_MIN + BUBBLE_OPACITY_RANGE) * (1 - this.popFrame / BUBBLE_POP_FRAMES);
      return;
    }
    this.wobble += this.wobbleSpeed;
    this.r += BUBBLE_GROWTH_RATE;
    this.x += Math.sin(this.wobble) * this.wobbleAmp + this.vx;
    this.y += -this.riseSpeed + this.vy;
    this.vx *= BUBBLE_FRICTION;
    this.vy *= BUBBLE_FRICTION;
    // Pop at top
    if (this.y < -this.r) {
      this.popping = true;
      this.popFrame = 0;
      this.y = this.r;
      return;
    }
    // Wrap horizontal
    if (this.x < -20) this.x += canvas.width + 40;
    if (this.x > canvas.width + 20) this.x -= canvas.width + 40;
  }
  draw() {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;

    // Thin ring outline
    ctx.strokeStyle = 'rgba(180,255,230,0.5)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.stroke();

    // Very faint fill
    ctx.fillStyle = 'rgba(0,255,200,0.04)';
    ctx.fill();

    // Specular highlight — small arc near top-left
    if (this.r >= BUBBLE_SPECULAR_THRESHOLD) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(this.x - this.r * 0.25, this.y - this.r * 0.25,
              this.r * 0.6, -Math.PI * 0.7, -Math.PI * 0.3);
      ctx.stroke();
    } else {
      // Small bubbles — just a dot highlight
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Large bubbles get a secondary smaller highlight
    if (this.r >= BUBBLE_LARGE_THRESHOLD) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(this.x + this.r * 0.15, this.y + this.r * 0.2,
              this.r * 0.25, Math.PI * 0.2, Math.PI * 0.6);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Jellyfish {
  constructor() { this.reset(true); }
  reset(init) {
    this.bellR = JELLY_BELL_MIN + Math.random() * JELLY_BELL_RANGE;
    this.x = Math.random() * canvas.width;
    this.y = init ? Math.random() * canvas.height : canvas.height + this.bellR * 2;
    this.vx = (Math.random() - 0.5) * JELLY_DRIFT_VX;
    this.vy = 0;
    this.pulse = Math.random() * Math.PI * 2;
    this.pulseSpeed = JELLY_PULSE_SPEED_MIN + Math.random() * JELLY_PULSE_SPEED_RANGE;
    this.glowPhase = Math.random() * Math.PI * 2;
    this.color = JELLY_COLORS[Math.floor(Math.random() * JELLY_COLORS.length)];
    // Tentacle count based on size
    if (this.bellR >= JELLY_TENTACLE_LARGE_THRESHOLD) {
      this.tentacles = JELLY_TENTACLE_LARGE;
    } else if (this.bellR >= JELLY_TENTACLE_MED_THRESHOLD) {
      this.tentacles = JELLY_TENTACLE_MED;
    } else {
      this.tentacles = JELLY_TENTACLE_SMALL;
    }
    this.tentaclePhases = Array.from({length: this.tentacles}, () => Math.random() * Math.PI * 2);
  }
  update() {
    this.pulse += this.pulseSpeed;
    this.glowPhase += JELLY_GLOW_PULSE_SPEED;

    // Pulsing swim — sharp upward kick on pulse peak, slow drift down otherwise
    const pulseVal = Math.sin(this.pulse);
    if (pulseVal > 0.95) {
      this.vy -= JELLY_PULSE_STRENGTH;
    }
    this.vy += JELLY_DRIFT_VY; // gentle downward drift

    // Occasional direction change
    if (Math.random() < JELLY_DIRECTION_CHANGE) {
      this.vx = (Math.random() - 0.5) * JELLY_DRIFT_VX * 2;
    }

    this.vx *= JELLY_FRICTION;
    this.vy *= JELLY_FRICTION;
    this.x += this.vx;
    this.y += this.vy;

    // Wrap around edges
    if (this.y < -this.bellR * 3) this.y = canvas.height + this.bellR * 2;
    if (this.y > canvas.height + this.bellR * 3) this.y = -this.bellR * 2;
    if (this.x < -this.bellR * 3) this.x += canvas.width + this.bellR * 6;
    if (this.x > canvas.width + this.bellR * 3) this.x -= canvas.width + this.bellR * 6;

    // Animate tentacle phases
    for (let i = 0; i < this.tentacles; i++) {
      this.tentaclePhases[i] += JELLY_TENTACLE_WAVE_SPEED + i * 0.005;
    }
  }
  draw() {
    const c = this.color;
    const glowAlpha = JELLY_GLOW_ALPHA_MIN + Math.sin(this.glowPhase) * 0.5 * JELLY_GLOW_ALPHA_RANGE + JELLY_GLOW_ALPHA_RANGE * 0.5;

    ctx.save();

    // Bioluminescent glow — radial gradient around the bell
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.bellR * 2.5);
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.bellR * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Bell dome — parabolic arc using quadraticCurveTo
    const bellW = this.bellR;
    const bellH = this.bellR * 0.8;
    // Faint fill
    const bellGrad = ctx.createRadialGradient(this.x, this.y - bellH * 0.3, 0, this.x, this.y, this.bellR);
    bellGrad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${glowAlpha * 1.5})`);
    bellGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.moveTo(this.x - bellW, this.y);
    ctx.quadraticCurveTo(this.x - bellW, this.y - bellH * 2, this.x, this.y - bellH * 1.5);
    ctx.quadraticCurveTo(this.x + bellW, this.y - bellH * 2, this.x + bellW, this.y);
    ctx.closePath();
    ctx.fill();

    // Bell stroke
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.3 + glowAlpha})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(this.x - bellW, this.y);
    ctx.quadraticCurveTo(this.x - bellW, this.y - bellH * 2, this.x, this.y - bellH * 1.5);
    ctx.quadraticCurveTo(this.x + bellW, this.y - bellH * 2, this.x + bellW, this.y);
    ctx.stroke();

    // Tentacles — wavy lines from bottom of bell
    const tentLen = this.bellR * JELLY_TENTACLE_SEG_LEN_RATIO;
    const spacing = (bellW * 2) / (this.tentacles + 1);
    // Velocity-based trailing — offset tentacle anchors by opposite of velocity
    const trailX = -this.vx * 8;
    const trailY = -this.vy * 4;

    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.15 + glowAlpha * 0.5})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < this.tentacles; i++) {
      const baseX = this.x - bellW + spacing * (i + 1);
      ctx.beginPath();
      ctx.moveTo(baseX, this.y);
      let tx = baseX + trailX * 0.5;
      let ty = this.y;
      for (let s = 1; s <= JELLY_TENTACLE_SEGMENTS; s++) {
        const t = s / JELLY_TENTACLE_SEGMENTS;
        const wave = Math.sin(this.tentaclePhases[i] + s * 1.2) * JELLY_TENTACLE_WAVE_AMP * this.bellR;
        tx = baseX + wave + trailX * t;
        ty = this.y + tentLen * t + trailY * t;
        const cpx = baseX + Math.sin(this.tentaclePhases[i] + (s - 0.5) * 1.2) * JELLY_TENTACLE_WAVE_AMP * this.bellR + trailX * (t - 0.5 / JELLY_TENTACLE_SEGMENTS);
        const cpy = this.y + tentLen * (t - 0.5 / JELLY_TENTACLE_SEGMENTS) + trailY * (t - 0.5 / JELLY_TENTACLE_SEGMENTS);
        ctx.quadraticCurveTo(cpx, cpy, tx, ty);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Firefly {
  constructor() { this.reset(true); }
  reset(init) {
    this.x = Math.random() * (canvas ? canvas.width : 1920);
    this.y = init
      ? (canvas ? canvas.height : 1080) * (0.5 + Math.random() * 0.5)
      : (canvas ? canvas.height : 1080) * (0.6 + Math.random() * 0.4);
    this.vx = 0;
    this.vy = 0;
    this.phase = Math.random() * Math.PI * 2;
    this.pulseSpeed = FIREFLY_PULSE_SPEED_MIN + Math.random() * FIREFLY_PULSE_SPEED_RANGE;
    this.opacity = FIREFLY_OPACITY_MIN + Math.random() * FIREFLY_OPACITY_RANGE;
    this.colorVariant = Math.random();  // 0-1: determines rare color variants
    this.prevX = this.x;
    this.prevY = this.y;
    // Butterfly state (light mode)
    this.flapPhase = Math.random() * Math.PI * 2;
    this.butterflyColor = BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)];
  }
  update() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.phase += this.pulseSpeed;
    this.flapPhase += BUTTERFLY_FLAP_SPEED;
    // Random walk
    this.vx += (Math.random() - 0.5) * FIREFLY_DRIFT;
    this.vy += (Math.random() - 0.5) * FIREFLY_DRIFT;
    // Slight downward bias near terrain
    if (this.y > (canvas ? canvas.height * 0.7 : 700)) {
      this.vy -= 0.02;
    }
    this.vx *= FIREFLY_FRICTION;
    this.vy *= FIREFLY_FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    // Wrap
    if (this.x < -20) this.x += canvas.width + 40;
    if (this.x > canvas.width + 20) this.x -= canvas.width + 40;
    if (this.y < canvas.height * 0.3) this.y = canvas.height * 0.3 + 10;
    if (this.y > canvas.height + 10) this.reset(false);
  }
  drawFirefly(targetCtx) {
    const pulse = FIREFLY_PULSE_MIN + (1 - FIREFLY_PULSE_MIN) * (0.5 + 0.5 * Math.sin(this.phase));
    const op = this.opacity * pulse;
    // Pick color: mostly warm yellow, rare green or orange
    let c = FIREFLY_COLOR;
    if (this.colorVariant > 0.92) c = [100, 255, 80];      // green
    else if (this.colorVariant > 0.85) c = [255, 180, 50];  // orange

    // Bright pixel core
    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    targetCtx.fillRect(
      Math.round(this.x) - 1,
      Math.round(this.y) - 1,
      FIREFLY_RADIUS, FIREFLY_RADIUS
    );

    // Trail — dim pixel at previous position
    const trailOp = op * FIREFLY_TRAIL_ALPHA;
    if (trailOp > 0.02) {
      targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${trailOp.toFixed(3)})`;
      targetCtx.fillRect(
        Math.round(this.prevX) - 1,
        Math.round(this.prevY) - 1,
        FIREFLY_RADIUS, FIREFLY_RADIUS
      );
    }
  }
  drawButterfly(targetCtx) {
    const c = this.butterflyColor;
    const op = this.opacity * 0.8;
    const flap = Math.sin(this.flapPhase);
    const px = Math.round(this.x);
    const py = Math.round(this.y);
    const s = 2; // wing pixel size

    targetCtx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${op.toFixed(3)})`;
    // Body
    targetCtx.fillRect(px, py, s, s);
    // Wings — spread depends on flap phase
    const wingSpread = Math.abs(flap);
    if (wingSpread > 0.3) {
      targetCtx.fillRect(px - s * 2, py - s, s * 2, s * 2); // left wing
      targetCtx.fillRect(px + s, py - s, s * 2, s * 2);     // right wing
    } else {
      targetCtx.fillRect(px - s, py, s, s);                  // folded left
      targetCtx.fillRect(px + s, py, s, s);                  // folded right
    }
  }
}

// ── Terrain generation ──
let terrainHeightMap = null;     // array of heights per column
let terrainBuffer = null;        // offscreen canvas for front terrain
let terrainMidBuffer = null;     // offscreen canvas for mid hills
let terrainBackBuffer = null;    // offscreen canvas for back mountains
let terrainTrees = [];           // [{col, height}] tree positions
let terrainPops = [];            // [{col, frame}] active block pop animations
let terrainNeedsRegen = true;

// Renders a single terrain block with isometric bevel edges:
// lighter top + left edges (lit faces) + darker right + bottom edges (shadow faces).
function drawBeveledBlock(targetCtx, bx, by, size, color) {
  targetCtx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  targetCtx.fillRect(bx, by, size, size);
  targetCtx.fillStyle = `rgb(${Math.min(255, color[0] + TERRAIN_BEVEL_HIGHLIGHT)},${Math.min(255, color[1] + TERRAIN_BEVEL_HIGHLIGHT)},${Math.min(255, color[2] + TERRAIN_BEVEL_HIGHLIGHT)})`;
  targetCtx.fillRect(bx, by, size, TERRAIN_BEVEL_SIZE);
  targetCtx.fillRect(bx, by, TERRAIN_BEVEL_SIZE, size);
  targetCtx.fillStyle = `rgb(${Math.max(0, color[0] - TERRAIN_BEVEL_SHADOW)},${Math.max(0, color[1] - TERRAIN_BEVEL_SHADOW)},${Math.max(0, color[2] - TERRAIN_BEVEL_SHADOW)})`;
  targetCtx.fillRect(bx + size - TERRAIN_BEVEL_SIZE, by, TERRAIN_BEVEL_SIZE, size);
  targetCtx.fillRect(bx, by + size - TERRAIN_BEVEL_SIZE, size, TERRAIN_BEVEL_SIZE);
}

function generateTerrain(w, h) {
  const bs = TERRAIN_BLOCK_SIZE;
  // Extra columns to cover the maximum horizontal parallax shift so terrain fills edge-to-edge
  const maxParallaxPx = Math.ceil(w * Math.max(TERRAIN_FRONT_SPEED, TERRAIN_MID_SPEED, TERRAIN_BACK_SPEED) * TERRAIN_SCROLL_RANGE);
  const extraCols = Math.ceil(maxParallaxPx / bs);
  const cols = Math.ceil(w / bs) + extraCols;
  const maxH = Math.floor(h * TERRAIN_HEIGHT_RATIO / bs);

  // Height map from layered sine waves
  terrainHeightMap = new Array(cols);
  for (let i = 0; i < cols; i++) {
    const x = i / cols;
    terrainHeightMap[i] = Math.floor(
      maxH * 0.5
      + Math.sin(x * Math.PI * 2.5) * maxH * 0.15
      + Math.sin(x * Math.PI * 5.7 + 1.3) * maxH * 0.1
      + Math.sin(x * Math.PI * 11.3 + 2.7) * maxH * 0.05
    );
    terrainHeightMap[i] = Math.max(3, Math.min(maxH, terrainHeightMap[i]));
  }

  // Place trees
  terrainTrees = [];
  let lastTree = -TERRAIN_TREE_MIN_GAP;
  for (let i = 0; i < cols; i++) {
    if (i - lastTree >= TERRAIN_TREE_MIN_GAP && Math.random() < TERRAIN_TREE_CHANCE) {
      terrainTrees.push({ col: i, trunkH: 3 + Math.floor(Math.random() * 2) });
      lastTree = i;
    }
  }

  // Render front terrain to buffer
  terrainBuffer = document.createElement('canvas');
  terrainBuffer.width = cols * bs;
  terrainBuffer.height = h * TERRAIN_HEIGHT_RATIO + bs * 10;
  const tctx = terrainBuffer.getContext('2d');
  const bufH = terrainBuffer.height;

  for (let i = 0; i < cols; i++) {
    const colH = terrainHeightMap[i];
    for (let row = 0; row < colH; row++) {
      const bx = i * bs;
      const by = bufH - (row + 1) * bs;
      let color;
      if (row >= colH - 1) {
        color = (i + row) % 3 === 0 ? TERRAIN_GRASS_ALT : TERRAIN_GRASS;
      } else if (row >= colH - 4) {
        color = (i + row) % 4 === 0 ? TERRAIN_DIRT_ALT : TERRAIN_DIRT;
      } else if (row > 1) {
        if (Math.random() < TERRAIN_ORE_CHANCE) {
          color = TERRAIN_ORE;
        } else {
          color = (i + row) % 3 === 0 ? TERRAIN_STONE_ALT : TERRAIN_STONE;
        }
      } else {
        color = TERRAIN_DEEP;
      }
      drawBeveledBlock(tctx, bx, by, bs, color);
    }
  }

  // Render trees
  terrainTrees.forEach(tree => {
    const bx = tree.col * bs;
    const groundY = bufH - terrainHeightMap[tree.col] * bs;
    // Trunk
    for (let r = 0; r < tree.trunkH; r++) {
      drawBeveledBlock(tctx, bx, groundY - (r + 1) * bs, bs, TERRAIN_TRUNK);
    }
    // Canopy — 3-wide dome
    const canopyY = groundY - (tree.trunkH + 1) * bs;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        drawBeveledBlock(tctx, bx + dx * bs, canopyY - dy * bs, bs, TERRAIN_LEAVES);
      }
    }
    // Top cap
    drawBeveledBlock(tctx, bx, canopyY - 2 * bs, bs, TERRAIN_LEAVES);
  });

  // Render mid hills to buffer (individual blocks with bevels)
  terrainMidBuffer = document.createElement('canvas');
  terrainMidBuffer.width = cols * bs;
  terrainMidBuffer.height = Math.floor(h * TERRAIN_MID_HEIGHT_RATIO);
  const mctx = terrainMidBuffer.getContext('2d');
  const mH = terrainMidBuffer.height;
  const midCols = cols;
  for (let i = 0; i < midCols; i++) {
    const x = i / midCols;
    const height = Math.floor(
      mH * 0.4
      + Math.sin(x * Math.PI * 3.1 + 0.8) * mH * 0.25
      + Math.sin(x * Math.PI * 7.2 + 2.1) * mH * 0.1
    );
    const numRows = Math.ceil(height / bs);
    for (let row = 0; row < numRows; row++) {
      drawBeveledBlock(mctx, i * bs, mH - (row + 1) * bs, bs, TERRAIN_HILLS);
    }
  }

  // Render back mountains to buffer (individual blocks with bevels)
  terrainBackBuffer = document.createElement('canvas');
  terrainBackBuffer.width = cols * bs;
  terrainBackBuffer.height = Math.floor(h * TERRAIN_BACK_HEIGHT_RATIO);
  const bctx = terrainBackBuffer.getContext('2d');
  const bH = terrainBackBuffer.height;
  const backCols = cols;
  for (let i = 0; i < backCols; i++) {
    const x = i / backCols;
    const height = Math.floor(
      bH * 0.35
      + Math.sin(x * Math.PI * 2.3 + 0.5) * bH * 0.3
      + Math.sin(x * Math.PI * 4.8 + 1.7) * bH * 0.15
    );
    const numRows = Math.ceil(height / bs);
    for (let row = 0; row < numRows; row++) {
      drawBeveledBlock(bctx, i * bs, bH - (row + 1) * bs, bs, TERRAIN_MOUNTAIN);
    }
  }

  terrainNeedsRegen = false;
}

const defaults = {
  sky: true,       stars: true,     streaks: true,
  clouds: true,    wisps: true,     horizon: true,
  gusts: true,     motes: true,
  starCount: 120,  streakCount: 35, cloudCount: 18,
  wispCount: 12,   gustCount: 24,   moteCount: 35,
};

export function initCanvas(canvasEl, theme, options) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  const opts = Object.assign({}, defaults, options);

  let isDarkMode = theme.isDark();
  let scrollProgress = 0;
  let scrollVelocity = 0;
  let lastScrollTop = window.scrollY || 0;

  // Snow globe shake detection — track scroll direction reversals
  let lastScrollDir = 0;       // -1 = up, 1 = down, 0 = idle
  let reversalTimes = [];      // timestamps of recent direction changes
  let snowTurbulence = 0;      // current turbulence intensity, decays per frame

  // Stable viewport height that ignores the mobile browser toolbar.
  // CSS `lvh` resolves to the large viewport (toolbar hidden).
  // Using it prevents particles from teleporting when the toolbar
  // collapses/expands on scroll.
  const lvhProbe = document.createElement('div');
  lvhProbe.style.cssText = 'position:fixed;height:100lvh;pointer-events:none;visibility:hidden';
  document.body.appendChild(lvhProbe);
  function stableHeight() {
    return lvhProbe.offsetHeight || window.innerHeight;
  }

  theme.onChange(dark => { isDarkMode = dark; });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = stableHeight();
    resizePixelCanvas();
    terrainNeedsRegen = true;
  }

  function updateScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - stableHeight();
    scrollProgress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    const delta = scrollTop - lastScrollTop;
    scrollVelocity += delta * SCROLL_VEL_GAIN;
    lastScrollTop = scrollTop;

    // Detect direction reversals for snow globe shake
    if (Math.abs(delta) >= SHAKE_MIN_DELTA) {
      const dir = delta > 0 ? 1 : -1;
      if (lastScrollDir !== 0 && dir !== lastScrollDir) {
        const now = performance.now();
        reversalTimes.push(now);
        // Prune old reversals outside the window
        reversalTimes = reversalTimes.filter(t => now - t < SHAKE_REVERSAL_WINDOW);
        if (reversalTimes.length >= SHAKE_REVERSALS_NEEDED) {
          snowTurbulence = 1;
          reversalTimes.length = 0;
        }
      }
      lastScrollDir = dir;
    }
  }

  // Offscreen canvas for blocky pixelation post-process
  let pixelCanvas = null;
  let pixelCtx = null;

  function initPixelCanvas() {
    pixelCanvas = document.createElement('canvas');
    pixelCtx = pixelCanvas.getContext('2d');
  }
  function resizePixelCanvas() {
    if (!pixelCanvas) initPixelCanvas();
    pixelCanvas.width = Math.ceil(canvas.width / PIXEL_SCALE);
    pixelCanvas.height = Math.ceil(canvas.height / PIXEL_SCALE);
  }

  resize();
  updateScroll();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateScroll, { passive: true });

  const clouds = opts.clouds ? Array.from({length: opts.cloudCount}, (_, i) => new Cloud(i, opts.cloudCount)) : [];
  const streaks = opts.streaks ? Array.from({length: opts.streakCount}, () => new Streak()) : [];
  const wisps = opts.wisps ? Array.from({length: opts.wispCount}, () => new BreezeWisp()) : [];
  const motes = opts.motes ? Array.from({length: opts.moteCount}, () => new ScrollMote()) : [];
  const snowflakes = Array.from({length: SNOW_COUNT}, () => new Snowflake());
  const bubbles = Array.from({length: BUBBLE_COUNT}, () => new Bubble());
  const jellyfish = Array.from({length: JELLY_COUNT}, () => new Jellyfish());
  const fireflies = Array.from({length: FIREFLY_COUNT}, () => new Firefly());
  let bubbleSpawnAccum = 0; // accumulates fractional bubble spawns
  const blockFragments = [];  // active block fragment particles

  const gusts = opts.gusts ? Array.from({length: opts.gustCount}, () => ({
    active: false, x: 0, y: 0, len: 0, angle: 0,
    opacity: 0, life: 0, maxLife: 0, width: 0
  })) : [];

  const stars = opts.stars ? Array.from({length: opts.starCount}, () => {
    const r = STAR_RADIUS_MIN + Math.random() * STAR_RADIUS_RANGE;
    return {
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      r,
      opacity: STAR_OPACITY_MIN + Math.random() * STAR_OPACITY_RANGE,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: STAR_TWINKLE_SPEED_MIN + Math.random() * STAR_TWINKLE_SPEED_RANGE,
      flash: 0,
      depth: STAR_DEPTH_MIN + Math.random() * STAR_DEPTH_RANGE,
      glarePhase: Math.random() * Math.PI,
    };
  }) : [];

  // Shooting stars — small reusable pool
  const shootingStars = opts.stars ? Array.from({length: SHOOTING_POOL_SIZE}, () => ({
    active: false, x: 0, y: 0, angle: 0, speed: 0,
    len: 0, life: 0, maxLife: 0, opacity: 0,
  })) : [];

  let t = 0;
  let lastFrameTime = performance.now();
  function render() {
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000; // seconds since last frame
    lastFrameTime = now;
    const sp = scrollProgress;
    const frozen = document.body.classList.contains('frozen');
    const deepSea = document.body.classList.contains('deep-sea');
    const upsd = document.body.classList.contains('upside-down');
    const blocky = document.body.classList.contains('blocky');
    // Last-triggered-wins for palette + CSS — iterate registry, no hardcoded priority
    const activeModes = SUBMODES.filter(m => document.body.classList.contains(m));
    const lastSub = document.body.dataset.lastSubmode;
    const submode = (lastSub && activeModes.includes(lastSub)) ? lastSub : (activeModes[0] || null);
    // Sync active theme to body for CSS visual rules
    const prevTheme = document.body.dataset.activeTheme || null;
    if (submode !== prevTheme) {
      if (submode) document.body.dataset.activeTheme = submode;
      else delete document.body.dataset.activeTheme;
    }
    const pal = resolvePalette(isDarkMode ? 'dark' : 'light', submode);
    currentPal = pal;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scroll-interpolated sky gradient
    if (opts.sky) {
      const skyTop = multiLerp(pal.skyTop, sp);
      const skyBot = multiLerp(pal.skyBot, sp);
      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, toRgba(skyTop));
      bg.addColorStop(0.5, toRgba(lerpColor(skyTop, skyBot, 0.5)));
      bg.addColorStop(1, toRgba(skyBot));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Stars — fade out between 20-50% scroll
    if (opts.stars) {
      const starVis = scrollFade(sp, 0, 0, STAR_FADE_START, STAR_FADE_END);
      if (starVis > 0) {
        t += STAR_TIME_STEP;
        stars.forEach(s => {
          s.twinkle += s.twinkleSpeed;
          // Random bright flash — rare, brief spike
          if (s.flash > 0) {
            s.flash *= STAR_FLASH_DECAY;
            if (s.flash < STAR_FLASH_THRESHOLD) s.flash = 0;
          } else if (Math.random() < STAR_FLASH_CHANCE) {
            s.flash = STAR_FLASH_MIN + Math.random() * STAR_FLASH_RANGE;
            s.glare = s.r >= STAR_GLARE_THRESHOLD && Math.random() < STAR_GLARE_CHANCE;
          }
          const base = s.opacity * (STAR_TWINKLE_BASE + STAR_TWINKLE_RANGE * Math.sin(s.twinkle));
          const op = Math.min(1, base + s.flash) * starVis;
          // Parallax — closer stars (higher depth) shift more on scroll
          const shift = s.depth * sp * canvas.height * STAR_PARALLAX_SCALE;
          const py = ((s.y - shift) % canvas.height + canvas.height) % canvas.height;
          const sx = s.x % canvas.width;
          const sc = pal.starColor;
          // Larger stars get a soft radial glow halo
          if (s.r >= STAR_GLOW_THRESHOLD) {
            const gr = s.r * STAR_GLOW_RADIUS;
            const grad = ctx.createRadialGradient(sx, py, 0, sx, py, gr);
            grad.addColorStop(0, `rgba(${sc},${op})`);
            grad.addColorStop(STAR_GLOW_MID, `rgba(${sc},${op * STAR_GLOW_MID_ALPHA})`);
            grad.addColorStop(1, `rgba(${sc},0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, py, gr, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = `rgba(${sc},${op})`;
            ctx.beginPath();
            ctx.arc(sx, py, s.r, 0, Math.PI * 2);
            ctx.fill();
          }
          // Cross-flare glare on rare bright flashing stars
          if (s.glare && s.flash > STAR_FLASH_THRESHOLD) {
            const glareLen = s.r * STAR_GLARE_SPIKE_LENGTH * s.flash;
            const angle = t * STAR_GLARE_ROTATION_SPEED + s.glarePhase;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = s.flash * starVis;
            ctx.lineWidth = STAR_GLARE_WIDTH;
            ctx.lineCap = 'round';
            for (let i = 0; i < 2; i++) {
              const a = angle + i * Math.PI * 0.5;
              const dx = Math.cos(a) * glareLen;
              const dy = Math.sin(a) * glareLen;
              const grad = ctx.createLinearGradient(sx - dx, py - dy, sx + dx, py + dy);
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
      }
    }

    // Shooting stars — rare fast arcs across the sky
    if (opts.stars) {
      const starVis2 = scrollFade(sp, 0, 0, STAR_FADE_START, STAR_FADE_END);
      if (starVis2 > 0 && Math.random() < SHOOTING_SPAWN_CHANCE) {
        const ss = shootingStars.find(s => !s.active);
        if (ss) {
          ss.x = Math.random() * canvas.width * SHOOTING_X_SPREAD + canvas.width * SHOOTING_X_OFFSET;
          ss.y = Math.random() * canvas.height * SHOOTING_Y_MAX;
          ss.angle = Math.PI * SHOOTING_ANGLE_MIN + Math.random() * Math.PI * SHOOTING_ANGLE_RANGE;
          ss.speed = SHOOTING_SPEED_MIN + Math.random() * SHOOTING_SPEED_RANGE;
          ss.len = SHOOTING_LEN_MIN + Math.random() * SHOOTING_LEN_RANGE;
          ss.opacity = SHOOTING_OPACITY_MIN + Math.random() * SHOOTING_OPACITY_RANGE;
          ss.life = 0;
          ss.maxLife = SHOOTING_LIFE_MIN + Math.random() * SHOOTING_LIFE_RANGE;
          ss.active = true;
        }
      }
      shootingStars.forEach(ss => {
        if (!ss.active) return;
        ss.life++;
        if (ss.life > ss.maxLife) { ss.active = false; return; }
        const p = ss.life / ss.maxLife;
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        // Fade in quickly, fade out slowly
        const fade = p < 0.1 ? p / 0.1 : (1 - p) / 0.9;
        const op = ss.opacity * fade * starVis2;
        const tailX = ss.x - Math.cos(ss.angle) * ss.len * Math.min(1, p * 3);
        const tailY = ss.y - Math.sin(ss.angle) * ss.len * Math.min(1, p * 3);
        drawTrail(ss.x, ss.y, tailX, tailY, pal.shootingColors, op, SHOOTING_LINE_WIDTH);
      });
    }

    // Click fury — no decay while actively clicking, then ramps up fast once idle
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

      // Exponential fade with flicker re-strikes
      const t = bolt.life / bolt.maxLife;
      let fade = Math.pow(1 - t, 2.5);
      const isFlicker = bolt.flickerFrames.indexOf(bolt.life) !== -1;
      if (isFlicker) fade = Math.max(fade, LIGHTNING_FLICKER_ALPHA);

      const col = pal.lightningColor;
      const sc = pal.lightningShadow;
      const branchScale = bolt.depth === 0 ? 1 : 0.45;
      // Per-frame micro-jitter seed for alive feel
      const jitterSeed = bolt.life * 7.13;

      // Helper: trace the polyline path with optional micro-jitter
      const tracePath = (jitter) => {
        const pts = bolt.points;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let p = 1; p < pts.length; p++) {
          const jx = jitter ? Math.sin(jitterSeed + p * 3.7) * LIGHTNING_MICRO_JITTER : 0;
          const jy = jitter ? Math.cos(jitterSeed + p * 2.3) * LIGHTNING_MICRO_JITTER : 0;
          // Smooth: use midpoints as control points for quadratic curves
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

      // Layer 1: Wide bloom (replaces expensive shadowBlur)
      ctx.globalAlpha = fade * LIGHTNING_BLOOM_ALPHA * branchScale * LIGHTNING_OPACITY;
      ctx.strokeStyle = `rgb(${sc[0]},${sc[1]},${sc[2]})`;
      ctx.lineWidth = LIGHTNING_BLOOM_WIDTH * branchScale;
      tracePath(false);
      ctx.stroke();

      // Layer 2: Outer glow
      ctx.globalAlpha = fade * LIGHTNING_OUTER_ALPHA * branchScale * LIGHTNING_OPACITY;
      ctx.lineWidth = LIGHTNING_OUTER_WIDTH * branchScale;
      tracePath(false);
      ctx.stroke();

      // Layer 3: Medium inner glow
      ctx.globalAlpha = fade * LIGHTNING_MID_ALPHA * branchScale * LIGHTNING_OPACITY;
      ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.lineWidth = LIGHTNING_MID_WIDTH * branchScale;
      tracePath(true);
      ctx.stroke();

      // Layer 4: Bright hot core
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
      // Seed waves if needed
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
      // Wave Y offset for a given position ratio t (0–1 across viewport width)
      const waveY = (w, t, mainScale, harmonicScale) =>
        Math.sin(w.phase + t * AURORA_WAVE_FREQ) * w.amp * mainScale
        + Math.sin(w.phase * AURORA_HARMONIC_PHASE + t * AURORA_HARMONIC_FREQ) * w.amp * harmonicScale;

      // Trace one edge of the aurora band as a smooth quadratic curve.
      // When reverse=true, traces right-to-left for closing the bottom edge.
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
        // Shift existing wave hues to match current mode
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
        // Smooth closed path: top edge forward, bottom edge backward
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

    // Tier 3: Meteor shower — rendered alongside normal shooting stars
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
      drawTrail(m.x, m.y, tailX, tailY, pal.meteorColors, op, METEOR_LINE_WIDTH);
    });

    // Streaks — evolve with scroll
    if (opts.streaks) {
      const streakP = getStreakParams(sp);
      streaks.forEach(s => { s.update(streakP); s.draw(streakP, pal); });
    }

    // Cloud layer — clouds live at a fixed altitude, viewport scrolls past them
    if (opts.clouds) {
      const cloudYOffset = -(sp - CLOUD_Y_PIVOT) * canvas.height * CLOUD_Y_SCALE;
      const cloudVis = scrollFade(sp, CLOUD_FADE_IN_START, CLOUD_FADE_IN_END, CLOUD_FADE_OUT_START, CLOUD_FADE_OUT_END);
      clouds.forEach(c => {
        c.update();
        // Click gently pushes nearby clouds sideways
        if (clickImpulse.strength > 0.1) {
          const cy = c.baseY + cloudYOffset;
          const dx = c.x - clickImpulse.x;
          const dy = cy - clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CLOUD_PUSH_RADIUS && dist > 1) {
            c.x += (dx / dist) * clickImpulse.strength * CLOUD_PUSH_FORCE;
          }
        }
        // Drag gently pulls nearby clouds
        if (isDragging) {
          const cy = c.baseY + cloudYOffset;
          const dx = dragPos.x - c.x;
          const dy = dragPos.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CLOUD_PULL_RADIUS && dist > 1) {
            c.x += (dx / dist) * CLOUD_PULL_FORCE;
          }
        }
        c.draw(cloudYOffset, cloudVis, pal);
      });
    }

    // Breeze wisps — horizontal wind, also scroll with atmosphere
    if (opts.wisps) {
      const wispYOffset = -(sp - WISP_Y_PIVOT) * canvas.height * WISP_Y_SCALE;
      const wispVis = scrollFade(sp, WISP_FADE_IN_START, WISP_FADE_IN_END, WISP_FADE_OUT_START, WISP_FADE_OUT_END);
      wisps.forEach(w => { w.update(); w.draw(wispVis, pal, wispYOffset); });
    }

    // Horizon glow — shifts with descent (skipped in blocky mode, terrain replaces it)
    if (opts.horizon && !blocky) {
      const glowY = canvas.height * (HORIZON_Y_BASE - sp * HORIZON_Y_SHIFT);
      const glowIntensity = HORIZON_INTENSITY_BASE + sp * HORIZON_INTENSITY_SCROLL - Math.max(0, sp - HORIZON_Y_BASE) * HORIZON_INTENSITY_FALLOFF;
      const hc = pal.horizonColor;
      const hg = ctx.createRadialGradient(canvas.width/2, glowY, 0, canvas.width/2, glowY, canvas.width * (HORIZON_RADIUS_BASE + sp * HORIZON_RADIUS_SCROLL));
      hg.addColorStop(0, `rgba(${hc[0]},${hc[1]},${hc[2]},${glowIntensity.toFixed(3)})`);
      hg.addColorStop(1, 'transparent');
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Edge breeze — wind lines from screen edges during scroll
    scrollVelocity *= SCROLL_VEL_DECAY;
    if (opts.gusts) {
      const absSv = Math.abs(scrollVelocity);
      if (absSv > GUST_SCROLL_THRESHOLD) {
        const spawnCount = Math.min(GUST_SPAWN_MAX, Math.floor(absSv / GUST_SPAWN_DIVISOR));
        for (let i = 0; i < spawnCount; i++) {
          const g = gusts.find(g => !g.active);
          if (!g) break;
          const side = Math.random();
          if (side < 0.35) { g.x = Math.random() * 50; g.y = Math.random() * canvas.height; }
          else if (side < 0.7) { g.x = canvas.width - Math.random() * 50; g.y = Math.random() * canvas.height; }
          else if (side < 0.85) { g.x = Math.random() * canvas.width; g.y = Math.random() * 30; }
          else { g.x = Math.random() * canvas.width; g.y = canvas.height - Math.random() * 30; }
          const dir = scrollVelocity > 0 ? -Math.PI / 2 : Math.PI / 2;
          g.angle = dir + (Math.random() - 0.5) * 0.7;
          g.len = GUST_LEN_MIN + Math.random() * GUST_LEN_RANGE;
          g.opacity = GUST_OPACITY_MIN + Math.random() * GUST_OPACITY_RANGE;
          g.width = GUST_WIDTH_MIN + Math.random() * GUST_WIDTH_RANGE;
          g.life = 0;
          g.maxLife = GUST_LIFE_MIN + Math.random() * GUST_LIFE_RANGE;
          g.active = true;
        }
      }
      const gc = pal.gustColor;
      gusts.forEach(g => {
        if (!g.active) return;
        g.life++;
        if (g.life > g.maxLife) { g.active = false; return; }
        const p = g.life / g.maxLife;
        const op = g.opacity * (p < 0.2 ? p / 0.2 : (1 - p) / 0.8);
        const progress = 0.4 + p * 0.6;
        ctx.save();
        ctx.globalAlpha = op;
        ctx.strokeStyle = `rgba(${gc},1)`;
        ctx.lineWidth = g.width;
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x + Math.cos(g.angle) * g.len * progress,
                   g.y + Math.sin(g.angle) * g.len * progress);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Scroll-reactive particles — blown by scroll, settle with gravity
    // Also react to click (repel) and drag (attract, scaled by hold duration)
    if (isDragging) {
      const heldMs = performance.now() - holdStart;
      holdStrength = Math.min(heldMs / HOLD_RAMP_MS, 1);
      const prevWell = wellStrength;
      wellStrength = heldMs > WELL_ACTIVATE_MS
        ? Math.min((heldMs - WELL_ACTIVATE_MS) / WELL_RAMP_MS, 1)
        : 0;
      if (wellStrength > 0 && prevWell === 0) {
        cursorDot?.classList.add('gravity-well');
        cursorRing?.classList.add('gravity-well');
      }
      if (wellStrength > 0) {
        cursorDot?.style.setProperty('--well-strength', wellStrength.toFixed(3));
        cursorRing?.style.setProperty('--well-strength', wellStrength.toFixed(3));
      }
    }
    const attractRadius = ATTRACT_RADIUS_BASE + holdStrength * ATTRACT_RADIUS_HOLD;
    const attractForce = ATTRACT_FORCE_BASE + holdStrength * ATTRACT_FORCE_HOLD;

    if (opts.motes) {
      motes.forEach(m => {
        m.update(scrollVelocity);
        if (clickImpulse.strength > 0.05) {
          const dx = m.x - clickImpulse.x;
          const dy = m.y - clickImpulse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const repelR = IMPULSE_REPEL_RADIUS + clickImpulse.strength * IMPULSE_REPEL_SCALE;
          if (dist < repelR && dist > 1) {
            const f = clickImpulse.strength * (1 - dist / repelR);
            m.vx += (dx / dist) * f;
            m.vy += (dy / dist) * f;
            m.opacity = Math.min(0.5, m.opacity + f * IMPULSE_MOTE_OPACITY_GAIN);
          }
        }
        if (isDragging) {
          const dx = dragPos.x - m.x;
          const dy = dragPos.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < attractRadius && dist > 5) {
            const f = attractForce * (1 - dist / attractRadius);
            const nx = dx / dist;
            const ny = dy / dist;
            // Radial pull + tangential orbit (orbit grows with hold strength)
            m.vx += nx * f + (-ny) * f * holdStrength * ATTRACT_TANGENT_FACTOR;
            m.vy += ny * f + nx * f * holdStrength * ATTRACT_TANGENT_FACTOR;
            m.opacity = Math.min(0.5, m.opacity + 0.005 + holdStrength * 0.01);
          }
        }
        applyWellForce(m);
        m.draw(pal);
      });
    }
    // Snowflakes — frozen mode ambient snow with pointer interaction + snow globe
    if (frozen) {
      // Snow globe turbulence — burst then decay
      if (snowTurbulence > 0.01) {
        snowflakes.forEach(s => {
          s.vx += (Math.random() - 0.5) * SHAKE_TURBULENCE * snowTurbulence;
          s.vy += (Math.random() - 0.5) * SHAKE_TURBULENCE * snowTurbulence;
          s.opacity = Math.min(1, s.opacity + SHAKE_OPACITY_BOOST * snowTurbulence);
        });
        snowTurbulence *= SHAKE_DECAY;
      }
      snowflakes.forEach(s => {
        s.update();
        applyRepulsion(s, SNOW_REPEL_RADIUS, SNOW_REPEL_DAMPEN);
        applyAttraction(s, SNOW_ATTRACT_RADIUS, SNOW_ATTRACT_STRENGTH, SNOW_ATTRACT_TANGENT);
        applyWellForce(s);
        // Scroll pushes snowflakes
        if (Math.abs(scrollVelocity) > SNOW_SCROLL_THRESHOLD) {
          s.vy -= scrollVelocity * SNOW_SCROLL_VY;
          s.vx += (Math.random() - 0.5) * Math.abs(scrollVelocity) * SNOW_SCROLL_VX;
        }
        s.draw();
      });
    }

    // Bubbles + Jellyfish — deep-sea mode
    if (deepSea) {
      // Ambient bubble spawning
      bubbleSpawnAccum += BUBBLE_AMBIENT_RATE * dt;
      while (bubbleSpawnAccum >= 1) {
        bubbleSpawnAccum--;
        const b = bubbles.find(b => !b.active);
        if (b) { b.reset(false); b.active = true; }
      }

      bubbles.forEach(b => {
        if (!b.active) return;
        b.update();
        applyRepulsion(b, BUBBLE_REPEL_RADIUS, BUBBLE_REPEL_DAMPEN);
        applyAttraction(b, BUBBLE_ATTRACT_RADIUS, BUBBLE_ATTRACT_STRENGTH, BUBBLE_ATTRACT_TANGENT);
        applyWellForce(b);
        // Scroll pushes laterally
        if (Math.abs(scrollVelocity) > BUBBLE_SCROLL_THRESHOLD) {
          b.vx += scrollVelocity * BUBBLE_SCROLL_VX;
        }
        b.draw();
      });

      jellyfish.forEach(j => {
        j.update();
        applyRepulsion(j, JELLY_REPEL_RADIUS, JELLY_REPEL_DAMPEN);
        applyAttraction(j, JELLY_ATTRACT_RADIUS, JELLY_ATTRACT_STRENGTH, 0);
        applyWellForce(j);
        j.draw();
      });
    }

    clickImpulse.strength *= IMPULSE_DECAY;

    // Click burst particles
    clickParticles.forEach((p, i) => {
      p.life++;
      if (p.life > p.maxLife) { clickParticles.splice(i, 1); return; }
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= CLICK_FRICTION;
      p.vy *= CLICK_FRICTION;
      p.vy += CLICK_GRAVITY;
      // Breeze curve
      p.x += Math.sin(p.life * CLICK_BREEZE_FREQ + p.phase) * CLICK_BREEZE_AMP;
      const fade = 1 - p.life / p.maxLife;
      const op = p.opacity * fade;
      if (op < CLICK_DRAW_THRESHOLD) return;
      const c = p.color;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * CLICK_GLOW_RADIUS);
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${op})`);
      grad.addColorStop(0.4, `rgba(${c[0]},${c[1]},${c[2]},${op * 0.4})`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * CLICK_GLOW_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    // Hold-to-charge orbit particles — spawn, orbit, and glow around cursor
    if (isDragging && holdStrength > 0.1) {
      // Spawn new orbit particles (boosted during gravity well)
      const spawnMul = wellStrength > 0 ? 1 + wellStrength * WELL_ORBIT_SPAWN_BOOST : 1;
      const maxOrbit = ORBIT_MAX + (wellStrength > 0 ? Math.floor(wellStrength * WELL_ORBIT_MAX_BOOST) : 0);
      const spawnChance = holdStrength * ORBIT_SPAWN_FACTOR * spawnMul;
      if (Math.random() < spawnChance && orbitParticles.length < maxOrbit) {
        const angle = Math.random() * Math.PI * 2;
        const dist = ORBIT_DIST_MIN + Math.random() * (ORBIT_DIST_RANGE + holdStrength * ORBIT_DIST_HOLD);
        orbitParticles.push({
          x: dragPos.x + Math.cos(angle) * dist,
          y: dragPos.y + Math.sin(angle) * dist,
          vx: 0, vy: 0,
          r: ORBIT_RADIUS_MIN + Math.random() * ORBIT_RADIUS_RANGE,
          opacity: 0,
          targetOpacity: ORBIT_OPACITY_MIN + holdStrength * ORBIT_OPACITY_HOLD,
        });
      }
    }
    // Update and draw orbit particles
    const oc = pal.orbitColor;
    for (let i = orbitParticles.length - 1; i >= 0; i--) {
      const p = orbitParticles[i];
      const dx = dragPos.x - p.x;
      const dy = dragPos.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      // Pull inward + orbit tangent
      const pull = ORBIT_PULL_BASE + holdStrength * ORBIT_PULL_HOLD;
      const orbit = ORBIT_TANGENT_BASE + holdStrength * ORBIT_TANGENT_HOLD;
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
    if (wellStrength > 0 && isDragging) {
      const auraR = WELL_AURA_RADIUS * (1 + wellStrength);
      const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 1000 * WELL_AURA_PULSE_SPEED);
      const auraOp = WELL_AURA_OPACITY * wellStrength * pulse;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const auraGrad = ctx.createRadialGradient(dragPos.x, dragPos.y, 0, dragPos.x, dragPos.y, auraR);
      auraGrad.addColorStop(0, `rgba(${oc[0]},${oc[1]},${oc[2]},${auraOp})`);
      auraGrad.addColorStop(0.5, `rgba(${oc[0]},${oc[1]},${oc[2]},${auraOp * 0.3})`);
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(dragPos.x, dragPos.y, auraR, 0, Math.PI * 2);
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

    // ── Blocky mode: pixelation post-process + terrain + fireflies ──
    if (blocky) {
      // Regenerate terrain on first frame or resize
      if (terrainNeedsRegen) generateTerrain(canvas.width, canvas.height);

      // Pixelation post-process: downsample then scale back up
      const pw = pixelCanvas.width;
      const ph = pixelCanvas.height;
      pixelCtx.clearRect(0, 0, pw, ph);
      pixelCtx.drawImage(canvas, 0, 0, pw, ph);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pixelCanvas, 0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;

      // Terrain — rendered crisp on top of pixelated sky
      // When upside-down, the canvas is CSS-flipped so terrain (drawn at bottom)
      // appears at the visual top. Invert scroll so it's visible near sp=0.
      const terrainSp = upsd ? 1 - sp : sp;
      const terrainVis = scrollFade(terrainSp, TERRAIN_FADE_IN_START, TERRAIN_FADE_IN_END, 2, 2);
      if (terrainVis > 0 && terrainBackBuffer && terrainMidBuffer && terrainBuffer) {
        ctx.save();
        ctx.globalAlpha = terrainVis;

        // Back mountains (slowest horizontal parallax)
        const backShift = terrainSp * canvas.width * TERRAIN_BACK_SPEED * TERRAIN_SCROLL_RANGE;
        ctx.drawImage(terrainBackBuffer, -backShift, canvas.height - terrainBackBuffer.height);

        // Mid hills (moderate horizontal parallax)
        const midShift = terrainSp * canvas.width * TERRAIN_MID_SPEED * TERRAIN_SCROLL_RANGE;
        ctx.drawImage(terrainMidBuffer, -midShift, canvas.height - terrainMidBuffer.height);

        // Front terrain (fastest horizontal parallax)
        const frontShift = terrainSp * canvas.width * TERRAIN_FRONT_SPEED * TERRAIN_SCROLL_RANGE;
        ctx.drawImage(terrainBuffer, -frontShift, canvas.height - terrainBuffer.height);

        ctx.restore();

        // Block pop animations
        for (let i = terrainPops.length - 1; i >= 0; i--) {
          const pop = terrainPops[i];
          pop.frame++;
          if (pop.frame > TERRAIN_POP_DURATION) {
            terrainPops.splice(i, 1);
            continue;
          }
          const t = pop.frame / TERRAIN_POP_DURATION;
          const lift = Math.sin(t * Math.PI) * TERRAIN_POP_LIFT_BLOCKS * TERRAIN_BLOCK_SIZE;
          ctx.globalAlpha = terrainVis * (1 - t * 0.5);
          drawBeveledBlock(ctx, pop.x, pop.y - lift, TERRAIN_BLOCK_SIZE, pop.color);
          ctx.globalAlpha = 1;
        }
      }

      // Terrain collision for motes — push particles above terrain surface
      if (terrainHeightMap && terrainVis > 0) {
        const bs = TERRAIN_BLOCK_SIZE;
        const bufH = terrainBuffer ? terrainBuffer.height : canvas.height * TERRAIN_HEIGHT_RATIO;
        const terrainTop = canvas.height - bufH;
        const shift = terrainSp * canvas.width * TERRAIN_FRONT_SPEED * TERRAIN_SCROLL_RANGE;
        motes.forEach(m => {
          const col = Math.floor((m.x + shift) / bs);
          if (col >= 0 && col < terrainHeightMap.length) {
            const surfaceY = canvas.height - terrainHeightMap[col] * bs;
            if (m.y > surfaceY * terrainVis + terrainTop * (1 - terrainVis)) {
              m.y = surfaceY;
              m.vy = -Math.abs(m.vy) * 0.3;
            }
          }
        });
      }

      // Block fragments — update and draw
      for (let i = blockFragments.length - 1; i >= 0; i--) {
        const f = blockFragments[i];
        f.life++;
        if (f.life > BLOCK_FRAG_LIFE) { blockFragments.splice(i, 1); continue; }
        f.x += f.vx;
        f.y += f.vy;
        f.vy += BLOCK_FRAG_GRAVITY;
        // Hard 90° tumble
        if (f.life % BLOCK_FRAG_TUMBLE_INTERVAL === 0) f.rot = (f.rot + 1) % 4;
        const c = f.color;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot * Math.PI / 2);
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fillRect(-BLOCK_FRAG_SIZE / 2, -BLOCK_FRAG_SIZE / 2, BLOCK_FRAG_SIZE, BLOCK_FRAG_SIZE);
        ctx.restore();
      }

      // Fireflies / Butterflies — rendered crisp post-pixelation
      fireflies.forEach(f => {
        f.update();
        applyRepulsion(f, FIREFLY_REPEL_RADIUS, FIREFLY_REPEL_DAMPEN);
        applyAttraction(f, FIREFLY_ATTRACT_RADIUS, FIREFLY_ATTRACT_STRENGTH, 0.3);
        applyWellForce(f);
        if (Math.abs(scrollVelocity) > FIREFLY_SCROLL_THRESHOLD) {
          f.vx += scrollVelocity * FIREFLY_SCROLL_VX;
        }
        if (isDarkMode) {
          f.drawFirefly(ctx);
        } else {
          f.drawButterfly(ctx);
        }
      });
    }

    requestAnimationFrame(render);
  }

  // Interaction forces — click repels, drag attracts, hold charges
  const clickImpulse = { x: 0, y: 0, strength: 0 };
  const dragPos = { x: 0, y: 0 };
  const orbitParticles = [];
  let holdStart = 0;
  let holdStrength = 0;
  let wellStrength = 0;
  const cursorDot = document.getElementById('cursor');
  const cursorRing = document.getElementById('cursor-ring');

  // Shared pointer-interaction helpers (snow, bubbles, jellyfish)
  function applyRepulsion(p, radius, damping) {
    if (clickImpulse.strength > 0.05) {
      const dx = p.x - clickImpulse.x;
      const dy = p.y - clickImpulse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist > 1) {
        const f = clickImpulse.strength * (1 - dist / radius) * damping;
        p.vx += (dx / dist) * f;
        p.vy += (dy / dist) * f;
      }
    }
  }

  function applyAttraction(p, radius, force, tangentFactor) {
    if (isDragging) {
      const dx = dragPos.x - p.x;
      const dy = dragPos.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && dist > 5) {
        const f = force * (1 - dist / radius);
        const nx = dx / dist;
        const ny = dy / dist;
        p.vx += nx * f + (-ny) * f * holdStrength * tangentFactor;
        p.vy += ny * f + nx * f * holdStrength * tangentFactor;
      }
    }
  }

  function applyWellForce(p) {
    if (wellStrength <= 0) return;
    const dx = dragPos.x - p.x;
    const dy = dragPos.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = wellStrength * WELL_FORCE_MAX / (1 + dist * WELL_DISTANCE_DECAY);
    const nx = dx / dist;
    const ny = dy / dist;
    p.vx += nx * f + (-ny) * f * WELL_TANGENT;
    p.vy += ny * f + nx * f * WELL_TANGENT;
  }

  // Click burst — scatter luminous motes from click point
  const clickParticles = [];
  const isUpside = () => document.body.classList.contains('upside-down');
  const isFrozen = () => document.body.classList.contains('frozen');
  let currentPal = resolvePalette(isDarkMode ? 'dark' : 'light', null);

  // Click fury — rapid clicking triggers escalating sky effects
  let clickFury = 0;
  let lastClickTime = 0;
  const lightningBolts = [];        // Tier 1: active bolt segments
  const auroraWaves = [];           // Tier 2: flowing ribbon control points
  let auroraIntensity = 0;          // fades in/out smoothly
  const meteorPool = Array.from({length: METEOR_POOL_SIZE}, () => ({
    active: false, x: 0, y: 0, angle: 0, speed: 0,
    len: 0, life: 0, maxLife: 0, opacity: 0,
  }));

  // Generate a branching lightning bolt from (x1,y1) to (x2,y2)
  function spawnLightning(x1, y1, x2, y2, depth) {
    const isBranch = depth > 0;
    const stepsMin = isBranch ? LIGHTNING_BRANCH_STEPS_MIN : LIGHTNING_STEPS_MIN;
    const stepsRange = isBranch ? LIGHTNING_BRANCH_STEPS_RANGE : LIGHTNING_STEPS_RANGE;
    const jitterX = isBranch ? LIGHTNING_BRANCH_JITTER_X : LIGHTNING_JITTER_X;
    const jitterY = isBranch ? LIGHTNING_BRANCH_JITTER_Y : LIGHTNING_JITTER_Y;
    const steps = stepsMin + Math.floor(Math.random() * stepsRange);
    // Build polyline as array of points
    const points = [{x: x1, y: y1}];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Jitter peaks in the middle of the bolt and tapers at endpoints
      const envelope = Math.sin(t * Math.PI);
      const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitterX * envelope;
      const ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitterY * envelope;
      points.push({x: nx, y: ny});
      // Random branch (main bolt and first-level branches only)
      if (depth < 2 && Math.random() < LIGHTNING_BRANCH_CHANCE) {
        const bAngle = Math.atan2(ny - points[points.length - 2].y, nx - points[points.length - 2].x)
                      + (Math.random() - 0.5) * LIGHTNING_BRANCH_ANGLE;
        const bLen = LIGHTNING_BRANCH_LEN_MIN + Math.random() * LIGHTNING_BRANCH_LEN_RANGE;
        spawnLightning(nx, ny, nx + Math.cos(bAngle) * bLen, ny + Math.sin(bAngle) * bLen, depth + 1);
      }
    }
    // Pre-compute flicker frames (frames where the bolt re-strikes at higher brightness)
    const maxLife = LIGHTNING_LIFE_MIN + Math.random() * LIGHTNING_LIFE_RANGE;
    const flickerCount = LIGHTNING_FLICKER_COUNT_MIN + Math.floor(Math.random() * LIGHTNING_FLICKER_COUNT_RANGE);
    const flickerFrames = [];
    for (let f = 0; f < flickerCount; f++) {
      flickerFrames.push(2 + Math.floor(Math.random() * (maxLife * 0.6)));
    }
    lightningBolts.push({ points, depth, life: 0, maxLife, flickerFrames });
  }

  // In upside-down mode the page is flipped via scaleY(-1), so canvas Y must mirror
  const canvasY = y => isUpside() ? canvas.height - y : y;

  document.addEventListener('click', e => {
    const cx = e.clientX;
    const cy = canvasY(e.clientY);
    clickImpulse.x = cx;
    clickImpulse.y = cy;
    clickImpulse.strength = BLAST_BASE;
    clickFury = Math.min(clickFury + FURY_PER_CLICK, FURY_MAX);
    lastClickTime = performance.now();

    // Tier 1: Lightning
    if (clickFury >= FURY_TIER1 && lightningBolts.length < LIGHTNING_MAX_BOLTS) {
      const startX = cx + (Math.random() - 0.5) * LIGHTNING_START_SPREAD;
      const startY = Math.random() * canvas.height * LIGHTNING_START_Y;
      spawnLightning(startX, startY, cx, cy, 0);
    }

    // Tier 3: Meteor shower burst
    if (clickFury >= FURY_TIER3 && scrollProgress < STAR_FADE_END) {
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

    // Deep-sea click burst — bubbles erupt from click point in an upward cone
    if (document.body.classList.contains('deep-sea')) {
      const burstCount = BUBBLE_CLICK_BURST_MIN + Math.floor(Math.random() * BUBBLE_CLICK_BURST_RANGE);
      for (let i = 0; i < burstCount; i++) {
        const b = bubbles.find(b => !b.active);
        if (!b) break;
        b.reset(false);
        b.x = cx;
        b.y = cy;
        b.active = true;
        // Spread in upward cone
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
        const speed = 1 + Math.random() * 2.5;
        b.vx = Math.cos(angle) * speed;
        b.vy = Math.sin(angle) * speed;
      }
    }

    // Blocky click burst — block fragments instead of smooth particles
    if (document.body.classList.contains('blocky')) {
      const fragCount = BLOCK_FRAG_COUNT_MIN + Math.floor(Math.random() * BLOCK_FRAG_COUNT_RANGE);
      // Pick colors based on click zone
      const inTerrainZone = cy > canvas.height * 0.65;
      const skyColors = [[80, 120, 200], [100, 140, 220], [60, 100, 180]];
      const groundColors = [TERRAIN_GRASS, TERRAIN_DIRT, TERRAIN_STONE];
      const colorSet = inTerrainZone ? groundColors : skyColors;
      for (let i = 0; i < fragCount && blockFragments.length < BLOCK_FRAG_MAX; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = BLOCK_FRAG_SPEED_MIN + Math.random() * BLOCK_FRAG_SPEED_RANGE;
        blockFragments.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          color: colorSet[Math.floor(Math.random() * colorSet.length)],
          life: 0, rot: 0,
        });
      }
      // Also trigger terrain block pops if near terrain
      if (inTerrainZone && terrainHeightMap) {
        const bs = TERRAIN_BLOCK_SIZE;
        const centerCol = Math.floor(cx / bs);
        for (let dc = -2; dc <= 2; dc++) {
          const col = centerCol + dc;
          if (col >= 0 && col < terrainHeightMap.length && terrainPops.length < TERRAIN_POP_MAX) {
            const dist = Math.abs(dc) * bs;
            if (dist < TERRAIN_POP_DIST && Math.random() < 0.6) {
              const surfaceRow = terrainHeightMap[col] - 1;
              terrainPops.push({
                x: col * bs,
                y: canvas.height - (surfaceRow + 1) * bs,
                color: TERRAIN_GRASS,
                frame: 0,
              });
            }
          }
        }
      }
    }

    // Normal click burst particles (skipped in blocky — block fragments replace them)
    const count = document.body.classList.contains('blocky')
      ? 0
      : CLICK_COUNT_MIN + Math.floor(Math.random() * CLICK_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = CLICK_SPEED_MIN + Math.random() * CLICK_SPEED_RANGE;
      clickParticles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: CLICK_RADIUS_MIN + Math.random() * CLICK_RADIUS_RANGE,
        opacity: CLICK_OPACITY_MIN + Math.random() * CLICK_OPACITY_RANGE,
        life: 0,
        maxLife: CLICK_LIFE_MIN + Math.random() * CLICK_LIFE_RANGE,
        phase: Math.random() * Math.PI * 2,
        color: currentPal.clickColor,
      });
    }
  });

  // Drag trail — flowing wispy segments along the drag path
  const trailSegments = [];
  let isDragging = false;
  let lastTrail = { x: 0, y: 0 };
  let trailDist = 0;

  // Pointer events with touch fallback (handled by bindPointer)
  function releaseDrag() {
    if (!isDragging) return;
    const heldSec = (performance.now() - holdStart) / 1000;
    const normalBlast = Math.min(BLAST_BASE + heldSec * BLAST_PER_SEC, BLAST_MAX);
    const wellBlast = wellStrength > 0
      ? WELL_BLAST_MIN + wellStrength * (WELL_BLAST_MAX - WELL_BLAST_MIN)
      : 0;
    const blast = Math.max(normalBlast, wellBlast);

    // Repel all nearby motes
    clickImpulse.x = dragPos.x;
    clickImpulse.y = dragPos.y;
    clickImpulse.strength = blast;

    // Convert orbit particles into burst particles
    orbitParticles.forEach(p => {
      const dx = p.x - dragPos.x;
      const dy = p.y - dragPos.y;
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
        color: currentPal.clickColor,
      });
    });
    orbitParticles.length = 0;

    // Extra burst particles proportional to hold time
    const extraCount = Math.min(Math.floor(heldSec * EXTRA_BURST_PER_SEC), EXTRA_BURST_MAX);
    for (let i = 0; i < extraCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = blast * (0.3 + Math.random() * 0.7);
      clickParticles.push({
        x: dragPos.x, y: dragPos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: CLICK_RADIUS_MIN + Math.random() * 2.5,
        opacity: CLICK_OPACITY_MIN + Math.random() * CLICK_OPACITY_RANGE,
        life: 0,
        maxLife: EXTRA_BURST_LIFE_MIN + Math.random() * EXTRA_BURST_LIFE_RANGE,
        phase: Math.random() * Math.PI * 2,
        color: currentPal.clickColor,
      });
    }

    // Gravity well burst — massive particle explosion on release
    if (wellStrength > 0) {
      const wellBurst = Math.floor(wellStrength * WELL_BURST_MAX);
      for (let i = 0; i < wellBurst; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = blast * (0.5 + Math.random() * 0.8);
        clickParticles.push({
          x: dragPos.x, y: dragPos.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: CLICK_RADIUS_MIN + Math.random() * 3,
          opacity: 0.4 + Math.random() * 0.4,
          life: 0,
          maxLife: WELL_BURST_LIFE_MIN + Math.random() * WELL_BURST_LIFE_RANGE,
          phase: Math.random() * Math.PI * 2,
          color: currentPal.clickColor,
        });
      }
      cursorDot?.classList.remove('gravity-well');
      cursorRing?.classList.remove('gravity-well');
      cursorDot?.style.removeProperty('--well-strength');
      cursorRing?.style.removeProperty('--well-strength');
    }

    isDragging = false;
    holdStrength = 0;
    wellStrength = 0;
  }

  function handleMove(x, y) {
    const cx = x, cy = canvasY(y);
    dragPos.x = cx;
    dragPos.y = cy;
    const dx = cx - lastTrail.x;
    const dy = cy - lastTrail.y;
    trailDist += Math.sqrt(dx * dx + dy * dy);
    if (trailDist > TRAIL_SPACING) {
      trailSegments.push({
        x: cx,
        y: cy,
        prev: { x: lastTrail.x, y: lastTrail.y },
        width: TRAIL_WIDTH_MIN + Math.random() * TRAIL_WIDTH_RANGE,
        opacity: TRAIL_OPACITY_MIN + Math.random() * TRAIL_OPACITY_RANGE,
        life: 0,
        maxLife: TRAIL_LIFE_MIN + Math.random() * TRAIL_LIFE_RANGE,
        phase: Math.random() * Math.PI * 2,
      });
      // Drag spawns small bubbles in deep-sea mode
      if (document.body.classList.contains('deep-sea') && Math.random() < BUBBLE_DRAG_RATE) {
        const b = bubbles.find(b => !b.active);
        if (b) {
          b.reset(false);
          b.x = cx + (Math.random() - 0.5) * 10;
          b.y = cy + (Math.random() - 0.5) * 10;
          b.baseR = BUBBLE_RADIUS_MIN + Math.random() * 4; // small drag bubbles
          b.r = b.baseR;
          b.active = true;
        }
      }
      lastTrail = { x: cx, y: cy };
      trailDist = 0;
    }
  }

  bindPointer(document, {
    onDown(x, y) {
      isDragging = true;
      holdStart = performance.now();
      const cx = x, cy = canvasY(y);
      dragPos.x = cx;
      dragPos.y = cy;
      lastTrail = { x: cx, y: cy };
      trailDist = 0;
    },
    onMove: handleMove,
    onUp: releaseDrag,
  });

  render();
}
