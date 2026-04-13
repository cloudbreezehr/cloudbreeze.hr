// ══════════════════════════════════════════════════════════════════════════════
// Terrain — three-layer parallax blocky landscape
//
// Self-contained module for a scrolling pixel-art terrain with front grass/dirt,
// mid hills, and back mountains. Not currently imported by any page script.
//
// API: initTerrain(canvas), drawTerrain(ctx, sp, upsd),
//      handleTerrainClick(cx, cy), collideMotes(motes, sp, upsd),
//      resizeTerrain().
// ══════════════════════════════════════════════════════════════════════════════

// ── Terrain Geometry ──
const HEIGHT_RATIO = 0.25;          // front terrain occupies bottom 25% of canvas
const MID_HEIGHT_RATIO = 0.22;      // mid hills buffer height ratio
const BACK_HEIGHT_RATIO = 0.40;     // back mountains buffer height ratio (tallest — frames the scene)
const BLOCK_SIZE = 6;               // matches pixel scale for crisp alignment
const TREE_CHANCE = 0.06;           // chance per column to have a tree
const TREE_MIN_GAP = 10;            // minimum columns between trees
const ORE_CHANCE = 0.02;            // chance per stone block for ore pixel

// ── Terrain Parallax ──
const BACK_SPEED = 0.20;            // horizontal parallax speed for back mountains
const MID_SPEED = 0.50;             // horizontal parallax speed for mid hills
const FRONT_SPEED = 0.80;           // horizontal parallax speed for front terrain
const SCROLL_RANGE = 0.40;          // scroll-to-pixel multiplier (higher = more horizontal travel)

// ── Terrain Pop Animation ──
const POP_MAX = 10;                 // max simultaneous popping blocks
const POP_DIST = 80;                // click radius for block pops
const POP_DURATION = 20;            // frames for a pop animation
const POP_LIFT_BLOCKS = 3;          // pop lifts this many block-sizes above surface
const POP_CLICK_CHANCE = 0.6;       // per-column chance of popping on click
const POP_SCAN_RADIUS = 2;          // columns to scan on each side of click center

// ── Terrain Visibility ──
const FADE_IN_START = 0.55;         // scroll position where terrain starts to appear
const FADE_IN_END = 0.70;           // scroll position where terrain is fully visible

// ── Terrain Bevel ──
const BEVEL_SIZE = 2;               // pixel width of highlight/shadow edges
const BEVEL_HIGHLIGHT = 40;         // RGB increase for top/left-edge highlight
const BEVEL_SHADOW = 40;            // RGB decrease for right/bottom-edge shadow

// ── Terrain Colors ──
const GRASS     = [90, 140, 60];
const GRASS_ALT = [70, 115, 45];
const DIRT      = [140, 100, 55];
const DIRT_ALT  = [110, 80, 40];
const STONE     = [120, 120, 120];
const STONE_ALT = [90, 90, 90];
const DEEP      = [80, 80, 80];
const ORE       = [200, 160, 60];
const TRUNK     = [90, 60, 30];
const LEAVES    = [60, 130, 40];
const MOUNTAIN  = [50, 55, 80];
const HILLS     = [60, 90, 50];

// ── Terrain Click Zone ──
const TERRAIN_ZONE_THRESHOLD = 0.65; // fraction of canvas height — clicks below this are "ground"
const GROUND_COLORS = [GRASS, DIRT, STONE];

// ── Internal State ──
let heightMap = null;                // array of heights per column
let frontBuffer = null;              // offscreen canvas for front terrain
let midBuffer = null;                // offscreen canvas for mid hills
let backBuffer = null;               // offscreen canvas for back mountains
let trees = [];                      // [{col, trunkH}] tree positions
let pops = [];                       // [{x, y, color, frame}] active block pop animations
let needsRegen = true;
let canvasRef = null;                // reference to the main canvas element

// ── Utilities ──

// Compute visibility alpha for a scroll-position-based fade envelope.
// Returns 0 outside the fade range, ramps linearly in/out, 1 in the middle.
function scrollFade(sp, inStart, inEnd, outStart, outEnd) {
  if (sp < inStart) return 0;
  if (sp < inEnd) return (inEnd === inStart) ? 1 : (sp - inStart) / (inEnd - inStart);
  if (sp < outStart) return 1;
  if (sp < outEnd) return 1 - (sp - outStart) / (outEnd - outStart);
  return 0;
}

// Renders a single terrain block with isometric bevel edges:
// lighter top + left edges (lit faces) + darker right + bottom edges (shadow faces).
function drawBeveledBlock(targetCtx, bx, by, size, color) {
  targetCtx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
  targetCtx.fillRect(bx, by, size, size);
  targetCtx.fillStyle = `rgb(${Math.min(255, color[0] + BEVEL_HIGHLIGHT)},${Math.min(255, color[1] + BEVEL_HIGHLIGHT)},${Math.min(255, color[2] + BEVEL_HIGHLIGHT)})`;
  targetCtx.fillRect(bx, by, size, BEVEL_SIZE);
  targetCtx.fillRect(bx, by, BEVEL_SIZE, size);
  targetCtx.fillStyle = `rgb(${Math.max(0, color[0] - BEVEL_SHADOW)},${Math.max(0, color[1] - BEVEL_SHADOW)},${Math.max(0, color[2] - BEVEL_SHADOW)})`;
  targetCtx.fillRect(bx + size - BEVEL_SIZE, by, BEVEL_SIZE, size);
  targetCtx.fillRect(bx, by + size - BEVEL_SIZE, size, BEVEL_SIZE);
}

// ── Generation ──

function generate(w, h) {
  const bs = BLOCK_SIZE;
  // Extra columns to cover the maximum horizontal parallax shift so terrain fills edge-to-edge
  const maxParallaxPx = Math.ceil(w * Math.max(FRONT_SPEED, MID_SPEED, BACK_SPEED) * SCROLL_RANGE);
  const extraCols = Math.ceil(maxParallaxPx / bs);
  const cols = Math.ceil(w / bs) + extraCols;
  const maxH = Math.floor(h * HEIGHT_RATIO / bs);

  // Height map from layered sine waves
  heightMap = new Array(cols);
  for (let i = 0; i < cols; i++) {
    const x = i / cols;
    heightMap[i] = Math.floor(
      maxH * 0.5
      + Math.sin(x * Math.PI * 2.5) * maxH * 0.15
      + Math.sin(x * Math.PI * 5.7 + 1.3) * maxH * 0.1
      + Math.sin(x * Math.PI * 11.3 + 2.7) * maxH * 0.05
    );
    heightMap[i] = Math.max(3, Math.min(maxH, heightMap[i]));
  }

  // Place trees
  trees = [];
  let lastTree = -TREE_MIN_GAP;
  for (let i = 0; i < cols; i++) {
    if (i - lastTree >= TREE_MIN_GAP && Math.random() < TREE_CHANCE) {
      trees.push({ col: i, trunkH: 3 + Math.floor(Math.random() * 2) });
      lastTree = i;
    }
  }

  // Render front terrain to buffer
  frontBuffer = document.createElement('canvas');
  frontBuffer.width = cols * bs;
  frontBuffer.height = h * HEIGHT_RATIO + bs * 10;
  const tctx = frontBuffer.getContext('2d');
  const bufH = frontBuffer.height;

  for (let i = 0; i < cols; i++) {
    const colH = heightMap[i];
    for (let row = 0; row < colH; row++) {
      const bx = i * bs;
      const by = bufH - (row + 1) * bs;
      let color;
      if (row >= colH - 1) {
        color = (i + row) % 3 === 0 ? GRASS_ALT : GRASS;
      } else if (row >= colH - 4) {
        color = (i + row) % 4 === 0 ? DIRT_ALT : DIRT;
      } else if (row > 1) {
        if (Math.random() < ORE_CHANCE) {
          color = ORE;
        } else {
          color = (i + row) % 3 === 0 ? STONE_ALT : STONE;
        }
      } else {
        color = DEEP;
      }
      drawBeveledBlock(tctx, bx, by, bs, color);
    }
  }

  // Render trees
  trees.forEach(tree => {
    const bx = tree.col * bs;
    const groundY = bufH - heightMap[tree.col] * bs;
    // Trunk
    for (let r = 0; r < tree.trunkH; r++) {
      drawBeveledBlock(tctx, bx, groundY - (r + 1) * bs, bs, TRUNK);
    }
    // Canopy — 3-wide dome
    const canopyY = groundY - (tree.trunkH + 1) * bs;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy <= 1; dy++) {
        drawBeveledBlock(tctx, bx + dx * bs, canopyY - dy * bs, bs, LEAVES);
      }
    }
    // Top cap
    drawBeveledBlock(tctx, bx, canopyY - 2 * bs, bs, LEAVES);
  });

  // Render mid hills to buffer (individual blocks with bevels)
  midBuffer = document.createElement('canvas');
  midBuffer.width = cols * bs;
  midBuffer.height = Math.floor(h * MID_HEIGHT_RATIO);
  const mctx = midBuffer.getContext('2d');
  const mH = midBuffer.height;
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
      drawBeveledBlock(mctx, i * bs, mH - (row + 1) * bs, bs, HILLS);
    }
  }

  // Render back mountains to buffer (individual blocks with bevels)
  backBuffer = document.createElement('canvas');
  backBuffer.width = cols * bs;
  backBuffer.height = Math.floor(h * BACK_HEIGHT_RATIO);
  const bctx = backBuffer.getContext('2d');
  const bH = backBuffer.height;
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
      drawBeveledBlock(bctx, i * bs, bH - (row + 1) * bs, bs, MOUNTAIN);
    }
  }

  needsRegen = false;
}

// ── Public API ──

/** Store a reference to the main canvas. Call once during setup. */
export function initTerrain(canvas) {
  canvasRef = canvas;
}

/** Mark terrain for regeneration (call on resize). */
export function resizeTerrain() {
  needsRegen = true;
}

/**
 * Draw the three-layer terrain with parallax and pop animations.
 *
 * @param {CanvasRenderingContext2D} ctx  — main canvas context
 * @param {number} sp        — scroll progress 0..1
 * @param {boolean} upsd     — true when upside-down mode is active
 */
export function drawTerrain(ctx, sp, upsd) {
  if (!canvasRef) return;
  const w = canvasRef.width;
  const h = canvasRef.height;

  if (needsRegen) generate(w, h);

  // When upside-down, the canvas is CSS-flipped so terrain (drawn at bottom)
  // appears at the visual top. Invert scroll so it's visible near sp=0.
  const terrainSp = upsd ? 1 - sp : sp;
  const vis = scrollFade(terrainSp, FADE_IN_START, FADE_IN_END, 2, 2);
  if (vis > 0 && backBuffer && midBuffer && frontBuffer) {
    ctx.save();
    ctx.globalAlpha = vis;

    // Back mountains (slowest horizontal parallax)
    const backShift = terrainSp * w * BACK_SPEED * SCROLL_RANGE;
    ctx.drawImage(backBuffer, -backShift, h - backBuffer.height);

    // Mid hills (moderate horizontal parallax)
    const midShift = terrainSp * w * MID_SPEED * SCROLL_RANGE;
    ctx.drawImage(midBuffer, -midShift, h - midBuffer.height);

    // Front terrain (fastest horizontal parallax)
    const frontShift = terrainSp * w * FRONT_SPEED * SCROLL_RANGE;
    ctx.drawImage(frontBuffer, -frontShift, h - frontBuffer.height);

    ctx.restore();

    // Block pop animations
    for (let i = pops.length - 1; i >= 0; i--) {
      const pop = pops[i];
      pop.frame++;
      if (pop.frame > POP_DURATION) {
        pops.splice(i, 1);
        continue;
      }
      const t = pop.frame / POP_DURATION;
      const lift = Math.sin(t * Math.PI) * POP_LIFT_BLOCKS * BLOCK_SIZE;
      ctx.globalAlpha = vis * (1 - t * 0.5);
      drawBeveledBlock(ctx, pop.x, pop.y - lift, BLOCK_SIZE, pop.color);
      ctx.globalAlpha = 1;
    }
  }
}

/**
 * Push motes above the terrain surface so they bounce off the ground.
 *
 * @param {Array} motes      — array of mote objects with {x, y, vy}
 * @param {number} sp        — scroll progress 0..1
 * @param {boolean} upsd     — true when upside-down mode is active
 */
export function collideMotes(motes, sp, upsd) {
  if (!canvasRef || !heightMap) return;
  const h = canvasRef.height;
  const terrainSp = upsd ? 1 - sp : sp;
  const vis = scrollFade(terrainSp, FADE_IN_START, FADE_IN_END, 2, 2);
  if (vis <= 0) return;

  const bs = BLOCK_SIZE;
  const bufH = frontBuffer ? frontBuffer.height : h * HEIGHT_RATIO;
  const terrainTop = h - bufH;
  const shift = terrainSp * canvasRef.width * FRONT_SPEED * SCROLL_RANGE;
  motes.forEach(m => {
    const col = Math.floor((m.x + shift) / bs);
    if (col >= 0 && col < heightMap.length) {
      const surfaceY = h - heightMap[col] * bs;
      if (m.y > surfaceY * vis + terrainTop * (1 - vis)) {
        m.y = surfaceY;
        m.vy = -Math.abs(m.vy) * 0.3;
      }
    }
  });
}

/**
 * Handle a click in blocky mode — returns ground colors if the click is in the
 * terrain zone, and triggers block pop animations.
 *
 * @param {number} cx   — click x in canvas coordinates
 * @param {number} cy   — click y in canvas coordinates
 * @returns {{ inTerrainZone: boolean, groundColors: number[][] }}
 */
export function handleTerrainClick(cx, cy) {
  if (!canvasRef) return { inTerrainZone: false, groundColors: GROUND_COLORS };
  const h = canvasRef.height;
  const inTerrainZone = cy > h * TERRAIN_ZONE_THRESHOLD;

  // Trigger terrain block pops if near terrain
  if (inTerrainZone && heightMap) {
    const bs = BLOCK_SIZE;
    const centerCol = Math.floor(cx / bs);
    for (let dc = -POP_SCAN_RADIUS; dc <= POP_SCAN_RADIUS; dc++) {
      const col = centerCol + dc;
      if (col >= 0 && col < heightMap.length && pops.length < POP_MAX) {
        const dist = Math.abs(dc) * bs;
        if (dist < POP_DIST && Math.random() < POP_CLICK_CHANCE) {
          const surfaceRow = heightMap[col] - 1;
          pops.push({
            x: col * bs,
            y: h - (surfaceRow + 1) * bs,
            color: GRASS,
            frame: 0,
          });
        }
      }
    }
  }

  return { inTerrainZone, groundColors: GROUND_COLORS };
}
