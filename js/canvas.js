import { lerpColor, multiLerp, toRgba, resolvePalette } from "./colors.js";
import { bindPointer } from "./pointer.js";
import { createSky } from "./sky.js";
import { createFury } from "./fury.js";
import { createAtmosphere } from "./atmosphere.js";
import { createSnow } from "./particles/frozen.js";
import { createDeepSea } from "./particles/deep-sea.js";
import { createBlocky } from "./particles/blocky.js";
import { createRain } from "./particles/rain.js";
import { createPaper } from "./particles/paper.js";
import { createInteractions, HOLD } from "./interactions.js";
import { defineConstants } from "./dev/registry.js";
import { prefersReducedMotion } from "./motion.js";
import { getThemeIds } from "./themes/registry.js";

// ── Scroll Velocity ──
const SCROLL = defineConstants("canvas.scroll", {
  VEL_GAIN: {
    value: 0.3,
    min: 0,
    max: 2,
    step: 0.01,
    description: "Scroll velocity gain per pixel",
  },
  VEL_DECAY: {
    value: 0.92,
    min: 0.5,
    max: 1,
    step: 0.01,
    description: "Scroll velocity decay per frame",
  },
});

// ── Particle counts ──
const COUNTS = defineConstants("canvas.particles", {
  SNOW: {
    value: 40,
    min: 0,
    max: 200,
    step: 1,
    description: "Snowflake count (frozen theme)",
  },
  BUBBLE: {
    value: 30,
    min: 0,
    max: 100,
    step: 1,
    description: "Bubble pool size (deep-sea theme)",
  },
  JELLY: {
    value: 8,
    min: 0,
    max: 30,
    step: 1,
    description: "Jellyfish count (deep-sea theme)",
  },
  FIREFLY: {
    value: 28,
    min: 0,
    max: 100,
    step: 1,
    description: "Firefly count (blocky theme)",
  },
});

// ── Snow Globe Shake ──
const SHAKE = defineConstants("canvas.shake", {
  REVERSAL_WINDOW: {
    value: 500,
    min: 100,
    max: 2000,
    step: 50,
    description: "ms window for counting scroll reversals",
  },
  REVERSALS_NEEDED: {
    value: 3,
    min: 2,
    max: 10,
    step: 1,
    description: "Rapid reversals needed to trigger shake",
  },
  MIN_DELTA: {
    value: 3,
    min: 1,
    max: 20,
    step: 1,
    description: "Minimum scroll delta to count as directional",
  },
});

// ── Render Options ──
const RENDER = defineConstants("canvas.render", {
  STAR_COUNT: {
    value: 120,
    min: 0,
    max: 500,
    step: 1,
    description: "Number of stars",
  },
  STREAK_COUNT: {
    value: 35,
    min: 0,
    max: 100,
    step: 1,
    description: "Number of rain streaks",
  },
  CLOUD_COUNT: {
    value: 18,
    min: 0,
    max: 60,
    step: 1,
    description: "Number of clouds",
  },
  WISP_COUNT: {
    value: 12,
    min: 0,
    max: 40,
    step: 1,
    description: "Number of breeze wisps",
  },
  GUST_COUNT: {
    value: 24,
    min: 0,
    max: 80,
    step: 1,
    description: "Number of gust lines (pool size)",
  },
  MOTE_COUNT: {
    value: 35,
    min: 0,
    max: 100,
    step: 1,
    description: "Number of scroll motes",
  },
});

let canvas, ctx;

const defaults = {
  sky: true,
  stars: true,
  streaks: true,
  clouds: true,
  wisps: true,
  horizon: true,
  gusts: true,
  motes: true,
  starCount: RENDER.STAR_COUNT,
  streakCount: RENDER.STREAK_COUNT,
  cloudCount: RENDER.CLOUD_COUNT,
  wispCount: RENDER.WISP_COUNT,
  gustCount: RENDER.GUST_COUNT,
  moteCount: RENDER.MOTE_COUNT,
};

export function initCanvas(canvasEl, appearance, options) {
  canvas = canvasEl;
  ctx = canvas.getContext("2d");
  const opts = Object.assign({}, defaults, options);

  let isDark = appearance.isDark();
  let scrollProgress = 0;
  let scrollVelocity = 0;
  let lastScrollTop = window.scrollY || 0;

  // Snow globe shake detection — track scroll direction reversals
  let lastScrollDir = 0; // -1 = up, 1 = down, 0 = idle
  let reversalTimes = []; // timestamps of recent direction changes
  const snowTurbulence = { value: 0 }; // current turbulence intensity, decays per frame

  // Stable viewport height that ignores the mobile browser toolbar.
  // CSS `lvh` resolves to the large viewport (toolbar hidden).
  // Using it prevents particles from teleporting when the toolbar
  // collapses/expands on scroll.
  const lvhProbe = document.createElement("div");
  lvhProbe.style.cssText =
    "position:fixed;height:100lvh;pointer-events:none;visibility:hidden";
  document.body.appendChild(lvhProbe);
  function stableHeight() {
    return lvhProbe.offsetHeight || window.innerHeight;
  }

  appearance.onChange((dark) => {
    isDark = dark;
  });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = stableHeight();
  }

  function updateScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - stableHeight();
    scrollProgress =
      docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: {
          type: "scroll",
          progress: scrollProgress,
          velocity: scrollVelocity,
        },
      }),
    );
    const delta = scrollTop - lastScrollTop;
    scrollVelocity += delta * SCROLL.VEL_GAIN;
    lastScrollTop = scrollTop;

    // Detect direction reversals for snow globe shake
    if (Math.abs(delta) >= SHAKE.MIN_DELTA) {
      const dir = delta > 0 ? 1 : -1;
      if (lastScrollDir !== 0 && dir !== lastScrollDir) {
        const now = performance.now();
        reversalTimes.push(now);
        // Prune old reversals outside the window
        reversalTimes = reversalTimes.filter(
          (t) => now - t < SHAKE.REVERSAL_WINDOW,
        );
        if (reversalTimes.length >= SHAKE.REVERSALS_NEEDED) {
          snowTurbulence.value = 1;
          reversalTimes.length = 0;
          window.dispatchEvent(
            new CustomEvent("achievement", { detail: { type: "snow-globe" } }),
          );
        }
      }
      lastScrollDir = dir;
    }
  }

  resize();
  updateScroll();

  const atmosphere = createAtmosphere(canvas, ctx, opts);
  const snow = createSnow(canvas, ctx, COUNTS.SNOW);
  const deepSea = createDeepSea(canvas, ctx, COUNTS.BUBBLE, COUNTS.JELLY);
  const blocky = createBlocky(canvas, ctx, COUNTS.FIREFLY);
  const rain = createRain(canvas, ctx);
  const paper = createPaper(canvas, ctx);

  window.addEventListener("resize", () => {
    resize();
    blocky.resizePixelCanvas();
  });
  window.addEventListener("scroll", updateScroll, { passive: true });

  // Interaction forces — click repels, drag attracts, hold charges, hover attracts gently
  const forces = {
    clickImpulse: { x: 0, y: 0, strength: 0 },
    isDragging: false,
    dragPos: { x: 0, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
    hover: { x: 0, y: 0, active: false },
  };
  const interactions = createInteractions();

  const sky = opts.stars ? createSky(opts.starCount) : null;
  const fury = createFury();
  let currentPal = resolvePalette(isDark ? "dark" : "light", null);

  // In upside-down theme the page is flipped via scaleY(-1), so canvas Y must mirror
  const isUpside = () => document.body.classList.contains("upside-down");
  const canvasY = (y) => (isUpside() ? canvas.height - y : y);

  // Snapshot every theme's activation flag in one pass.  Callers reuse the
  // result across a frame or an event handler rather than querying classList
  // six times — one object rather than six DOM reads, and far easier to read.
  function readThemes() {
    const cl = document.body.classList;
    return {
      frozen: cl.contains("frozen"),
      deepSea: cl.contains("deep-sea"),
      blocky: cl.contains("blocky"),
      rainy: cl.contains("rainy"),
      paper: cl.contains("paper"),
      upsideDown: cl.contains("upside-down"),
    };
  }

  let lastFrameTime = performance.now();
  let wasRainy = false;
  let wasPaper = false;

  // ── Sky gradient cache ──
  // Rebuilding the gradient every frame is the most expensive per-frame op.
  // Cache and invalidate only when inputs meaningfully change: palette color
  // arrays, canvas height, or scroll progress (quantized to 512 buckets — the
  // visual difference between adjacent buckets is imperceptible).
  const SKY_GRADIENT_BUCKETS = 512;
  let cachedSkyGradient = null;
  let cachedSkyTop = null;
  let cachedSkyBot = null;
  let cachedSkyHeight = 0;
  let cachedSkyBucket = -1;
  function render() {
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000; // seconds since last frame
    lastFrameTime = now;
    const sp = scrollProgress;
    const themes = readThemes();
    const {
      frozen: isFrozen,
      deepSea: isDeepSea,
      blocky: isBlocky,
      rainy: isRainy,
      paper: isPaper,
    } = themes;
    // Last-triggered-wins for palette + CSS — iterate registry, no hardcoded priority
    const activeThemes = getThemeIds().filter((m) =>
      document.body.classList.contains(m),
    );
    const lastTheme = document.body.dataset.lastTheme;
    const theme =
      lastTheme && activeThemes.includes(lastTheme)
        ? lastTheme
        : activeThemes[0] || null;
    // Sync active theme to body for CSS visual rules
    const prevTheme = document.body.dataset.activeTheme || null;
    if (theme !== prevTheme) {
      if (theme) document.body.dataset.activeTheme = theme;
      else delete document.body.dataset.activeTheme;
    }
    const appearance = isDark ? "dark" : "light";
    const pal = resolvePalette(appearance, theme);
    currentPal = pal;
    // Themes stack: body classes can coexist, but only one wins the shared
    // palette (sky, fury, atmosphere, interactions).  Theme-specific
    // renderers must read *their own* theme's palette, otherwise a stacked
    // theme would either pick up the winner's colors or — for keys that
    // exist only in its own override block (e.g. bubbleRim, glassBody) —
    // dereference `undefined` and crash the render loop.
    const palFor = (id) => resolvePalette(appearance, id);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scroll-interpolated sky gradient — rebuilt only when inputs change.
    // Paper theme suppresses the sky entirely; its background comes from CSS.
    if (opts.sky && !isPaper) {
      const bucket = Math.round(sp * SKY_GRADIENT_BUCKETS);
      if (
        cachedSkyGradient === null ||
        cachedSkyTop !== pal.skyTop ||
        cachedSkyBot !== pal.skyBot ||
        cachedSkyHeight !== canvas.height ||
        cachedSkyBucket !== bucket
      ) {
        const skyTop = multiLerp(pal.skyTop, sp);
        const skyBot = multiLerp(pal.skyBot, sp);
        const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
        bg.addColorStop(0, toRgba(skyTop));
        bg.addColorStop(0.5, toRgba(lerpColor(skyTop, skyBot, 0.5)));
        bg.addColorStop(1, toRgba(skyBot));
        cachedSkyGradient = bg;
        cachedSkyTop = pal.skyTop;
        cachedSkyBot = pal.skyBot;
        cachedSkyHeight = canvas.height;
        cachedSkyBucket = bucket;
      }
      ctx.fillStyle = cachedSkyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Stars and shooting stars — suppressed in paper theme
    if (sky && !isPaper) sky.draw(ctx, canvas, sp, pal, forces);

    const reducedMotion = prefersReducedMotion();

    // Click fury — lightning, aurora, meteors.  Skipped under reduced-motion:
    // flashing/sweeping effects are the riskiest for vestibular sensitivity.
    if (!reducedMotion) fury.draw(ctx, canvas, pal, sp, dt, now);

    // Atmosphere — streaks, clouds, wisps, horizon, gusts, motes.
    // Under reduced-motion, pass zero velocity so scroll doesn't push particles.
    // Paper theme suppresses the ambient particle system entirely.
    scrollVelocity *= SCROLL.VEL_DECAY;
    const drawVelocity = reducedMotion ? 0 : scrollVelocity;
    interactions.updateHold(forces, performance.now());
    if (!isPaper) atmosphere.draw(sp, drawVelocity, pal, forces, isBlocky);
    // Snowflakes — frozen theme ambient snow with pointer interaction + snow globe.
    // Under reduced-motion, suppress snow-globe turbulence so reversals don't shake.
    if (isFrozen) {
      const turbulence = reducedMotion ? { value: 0 } : snowTurbulence;
      snow.draw(forces, drawVelocity, turbulence);
    }

    // Bubbles + Jellyfish — deep-sea theme
    if (isDeepSea) {
      deepSea.draw(forces, scrollVelocity, dt, palFor("deep-sea"));
    }

    // Rain + thunder + glass drops — rainy theme
    if (isRainy) {
      rain.draw(forces, scrollVelocity, dt, palFor("rainy"));
    }
    if (wasRainy && !isRainy) rain.cleanup();
    wasRainy = isRainy;

    // Paper theme — hand-drawn sketch elements
    if (isPaper) {
      paper.draw(palFor("paper"));
    }
    if (wasPaper && !isPaper) paper.cleanup();
    wasPaper = isPaper;

    interactions.decayImpulse(forces);
    interactions.draw(ctx, pal, forces);

    // ── Blocky theme: pixelation post-process + fireflies ──
    if (isBlocky) {
      blocky.draw(forces, scrollVelocity, isDark);
    }

    requestAnimationFrame(render);
  }

  // UI overlays that should not trigger canvas fury or click-burst effects
  const UI_OVERLAY =
    "nav, .achievement-panel, .achievement-toast-container, .dev-console";

  document.addEventListener("click", (e) => {
    // Skip all canvas effects for clicks on UI controls
    if (e.target.closest(UI_OVERLAY)) return;

    const cx = e.clientX;
    const cy = canvasY(e.clientY);
    const themes = readThemes();
    forces.clickImpulse.x = cx;
    forces.clickImpulse.y = cy;
    forces.clickImpulse.strength = HOLD.BLAST_BASE;
    // Forward the nearest service card so achievement handlers can
    // evaluate hit-test without duplicating it.
    const card = e.target.closest(".service-card") || null;
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "click", x: e.clientX, y: e.clientY, card },
      }),
    );

    fury.click(cx, cy, canvas, scrollProgress);

    // Deep-sea click burst — bubbles erupt from click point in an upward cone
    if (themes.deepSea) deepSea.clickBurst(cx, cy);
    // Blocky click burst — block fragments instead of smooth particles
    if (themes.blocky) blocky.clickBurst(cx, cy);
    // Rainy click burst — splash droplets radiate from click
    if (themes.rainy) rain.clickBurst(cx, cy);
    // Paper click — ink splat replaces the normal burst
    if (themes.paper) paper.clickBurst(cx, cy);

    // Normal click burst particles — blocky uses block fragments instead;
    // paper uses ink splats.
    if (!themes.blocky && !themes.paper) {
      interactions.click(cx, cy, currentPal);
    }
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "click-burst" } }),
    );
  });

  // Pointer events — drag/trail/release delegated to interactions module
  bindPointer(document, {
    onDown(x, y, e) {
      if (e.target.closest(UI_OVERLAY)) return false;
      const cx = x,
        cy = canvasY(y);
      const themes = readThemes();
      interactions.startDrag(forces, cx, cy);
      // Paper theme — start an SVG ink stroke that tracks the pointer
      if (themes.paper) paper.startStroke(x, y);
    },
    onMove(x, y) {
      const cx = x,
        cy = canvasY(y);
      const trailAdded = interactions.addTrail(forces, cx, cy);
      if (trailAdded)
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "drag", x: cx, y: cy },
          }),
        );
      const themes = readThemes();
      // Drag spawns small bubbles in deep-sea theme
      if (trailAdded && themes.deepSea) deepSea.dragBubble(cx, cy);
      // Paper theme — extend the active ink stroke with the new point
      if (themes.paper) paper.extendStroke(x, y);
    },
    onUp() {
      const themes = readThemes();
      // Rainy well burst — massive splash on gravity well release
      if (forces.wellStrength > 0 && themes.rainy) {
        rain.wellBurst(forces.dragPos.x, forces.dragPos.y);
      }
      // Paper theme — finalize the stroke and fire the doodler event
      if (themes.paper) {
        const hadContent = paper.endStroke();
        if (hadContent) {
          window.dispatchEvent(
            new CustomEvent("achievement", {
              detail: { type: "paper-stroke" },
            }),
          );
        }
      }
      interactions.releaseDrag(forces, currentPal);
    },
  });

  // Hover tracking — passive cursor position for proximity effects
  canvas.addEventListener(
    "mousemove",
    (e) => {
      forces.hover.x = e.clientX;
      forces.hover.y = canvasY(e.clientY);
      forces.hover.active = true;
    },
    { passive: true },
  );
  canvas.addEventListener(
    "mouseleave",
    () => {
      forces.hover.active = false;
    },
    { passive: true },
  );

  // Visualize dock-snap / dock-release events with an edge burst at the
  // reported side (each event has exactly one publisher in the codebase).
  function handleDockEvent(e, type) {
    const { side, top, height } = e.detail;
    const edgeX = side === "left" ? 0 : canvas.width;
    const y1 = canvasY(top);
    const y2 = canvasY(top + height);
    const burstTop = Math.min(y1, y2);
    const burstHeight = Math.abs(y2 - y1);
    interactions.edgeBurst(edgeX, burstTop, burstHeight, type, currentPal);
    interactions.edgeImpulse(forces, edgeX, burstTop, burstHeight, type);
  }
  window.addEventListener("dock-snap", (e) => handleDockEvent(e, "snap"));
  window.addEventListener("dock-release", (e) => handleDockEvent(e, "release"));

  render();
}
