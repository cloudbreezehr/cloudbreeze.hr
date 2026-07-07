import { lerpColor, multiLerp, toRgba, resolvePalette } from "./colors.js";
import { bindPointer } from "./pointer.js";
import { UI_OVERLAY_SELECTOR } from "./selectors.js";
import { createSky } from "./sky.js";
import { createMoon } from "./real-sky/moon.js";
import { createFury } from "./fury.js";
import { createAtmosphere } from "./atmosphere.js";
import { subscribe as subscribeScroll } from "./scroll-bus.js";
import { mirrorYWhenInverted, getViewportHeight } from "./viewport.js";
import { getActiveHooks, dispatchTransitions } from "./themes/canvas-hooks.js";
import { createInteractions, HOLD } from "./interactions.js";
import { createCursorGhosts } from "./sky-link/ghosts.js";
import { remotePointers, setLocalPointerSource } from "./sky-link/seam.js";
import { defineConstants } from "./dev/registry.js";
import { prefersReducedMotion, scaled } from "./motion.js";
import { getThemeIds, getTheme } from "./themes/registry.js";
import { activeCombo, comboPaletteKey } from "./themes/alchemy.js";
import { getQualityTier, PARTICLE_SCALE, observeFps } from "./quality.js";

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
    description: "Scroll velocity decay per 60fps-frame",
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

// Per-frame decays are tuned at 60fps; raising them to the power of
// dt·this normalizes the bleed-off to wall-clock time on any refresh rate.
const DECAY_REF_HZ = 60;

let canvas, ctx;

// The live `forces` object, exposed for read-only pollers of drag speed /
// well strength. Null until initCanvas runs.
let _forces = null;
export function getForces() {
  return _forces;
}

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

  // Scale every particle-count knob by the hardware tier in one pass.
  // Caller-supplied counts (via `options`) flow through the same map
  // so explicit overrides also get tier-adjusted.
  const scale = PARTICLE_SCALE[getQualityTier()];
  for (const key of [
    "starCount",
    "streakCount",
    "cloudCount",
    "wispCount",
    "gustCount",
    "moteCount",
  ]) {
    opts[key] = Math.max(1, Math.round(opts[key] * scale));
  }

  let isDark = appearance.isDark();
  let scrollProgress = 0;
  let scrollVelocity = 0;

  appearance.onChange((dark) => {
    isDark = dark;
  });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = getViewportHeight();
  }

  function updateScroll(snapshot) {
    const scrollY =
      snapshot?.scrollY ?? window.scrollY ?? document.documentElement.scrollTop;
    const deltaY = snapshot?.deltaY ?? 0;
    const docHeight =
      document.documentElement.scrollHeight - getViewportHeight();
    scrollProgress =
      docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0;
    // Fold this delta into the velocity before dispatching, so the event
    // carries the velocity this scroll produced rather than the prior frame's
    // already-decayed value — a flick from rest must not report zero.
    scrollVelocity += deltaY * SCROLL.VEL_GAIN;
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: {
          type: "scroll",
          progress: scrollProgress,
          velocity: scrollVelocity,
        },
      }),
    );
  }

  resize();
  updateScroll();

  const atmosphere = createAtmosphere(canvas, ctx, opts);

  window.addEventListener("resize", resize);
  subscribeScroll(updateScroll);

  // Interaction forces — click repels, drag attracts, hold charges, hover attracts gently
  const forces = {
    clickImpulse: { x: 0, y: 0, strength: 0 },
    isDragging: false,
    dragPos: { x: 0, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
    hover: { x: 0, y: 0, active: false },
    lastMoveTime: performance.now(),
    // Pointers of linked windows, folded into every force helper. Refreshed
    // once per frame from the seam; empty solo, so solo pays nothing.
    remotePointers: [],
  };
  _forces = forces;
  const interactions = createInteractions();
  const cursorGhosts = createCursorGhosts();

  // Publish this window's pointer for linked peers to fold in as a force
  // source: the drag point while dragging, else the hover point when the
  // cursor is present. Reports true viewport coordinates (Y un-mirrored, so
  // a flipped window still agrees on where the cursor is); the transport
  // shifts them to desktop space.
  setLocalPointerSource(() => {
    const dragging = forces.isDragging;
    const y = dragging ? forces.dragPos.y : forces.hover.y;
    return {
      x: dragging ? forces.dragPos.x : forces.hover.x,
      y: mirrorYWhenInverted(y, canvas.height),
      active: dragging || forces.hover.active,
      isDragging: dragging,
      holdStrength: forces.holdStrength,
      wellStrength: forces.wellStrength,
    };
  });

  const sky = opts.stars ? createSky(opts.starCount) : null;
  const moon = createMoon();
  const fury = createFury();
  let currentPal = resolvePalette(isDark ? "dark" : "light", null);

  const canvasY = (y) => mirrorYWhenInverted(y, canvas.height);

  let lastFrameTime = performance.now();
  // Nonzero while peer cursors are still fading out; keeps their update running
  // for a few frames after the last remote pointer vanishes.
  let ghostsVisible = 0;

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

  // ── Real-moon reveal fade ──
  // Eases the moon in/out when the visitor toggles the real sky, so it doesn't
  // pop against the subsystem's other fades (the day-phase tint, the scroll
  // fade). Snaps under reduced motion — it's a one-shot transition, not motion.
  const MOON_REVEAL_FADE_SECONDS = 0.6;
  let moonReveal = 0;

  function drawFrame() {
    const now = performance.now();
    const dt = (now - lastFrameTime) / 1000; // seconds since last frame
    lastFrameTime = now;
    const sp = scrollProgress;
    // Refresh linked peers' pointers once per frame into the shared forces
    // object. The seam hands them over in true viewport coordinates;
    // `canvasY` re-mirrors Y into this window's canvas space so a flipped
    // window still folds them in correctly.
    const remotes = remotePointers();
    if (remotes.length || forces.remotePointers.length) {
      forces.remotePointers = remotes.map((rp) => ({
        ...rp,
        y: canvasY(rp.y),
      }));
    }
    // A linked peer's pointer physically inside this viewport means the real
    // mouse is over this window but owned by the peer (it captured the drag),
    // so this window's own custom cursor is frozen at a stale spot — hide it and
    // let the peer cursor stand in as the one cursor. CSS keys off the body
    // class. Tested against the raw seam pointers (true viewport Y), the same
    // space the peer cursors use — so "hide the local cursor" and "a peer cursor
    // is shown" stay in lockstep, including under upside-down.
    const peerPointerInside = remotes.some(
      (rp) =>
        rp.x >= 0 && rp.x <= canvas.width && rp.y >= 0 && rp.y <= canvas.height,
    );
    document.body.classList.toggle("peer-pointer-inside", peerPointerInside);
    // Atmosphere skips horizon glow when blocky is active — that's a
    // coupling the suppress system can't model (blocky post-processes
    // atmosphere instead of replacing it).
    const isBlocky = document.body.classList.contains("blocky");
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
      // A dark-only winner suppresses the default light surfaces (see
      // css/12-appearance-light.css) so it keeps its dark identity in light mode.
      document.body.classList.toggle(
        "theme-dark-only",
        !!(theme && getTheme(theme)?.darkOnly),
      );
    }
    // A curated stacked pair takes over the shared look from the single
    // winner (the winner still drives theme-specific renderers and CSS).
    const combo = activeCombo(activeThemes);
    const prevCombo = document.body.dataset.activeCombo || null;
    const comboId = combo ? combo.id : null;
    if (comboId !== prevCombo) {
      if (comboId) {
        document.body.dataset.activeCombo = comboId;
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "theme-combo", combo: comboId },
          }),
        );
      } else {
        delete document.body.dataset.activeCombo;
      }
    }
    const pal = resolvePalette(
      isDark ? "dark" : "light",
      comboId ? comboPaletteKey(comboId) : theme,
    );
    currentPal = pal;
    // Themes stack: body classes can coexist, but only one wins the shared
    // palette (sky, fury, atmosphere, interactions).  Theme-specific
    // renderers must read *their own* theme's palette via `palFor` — a
    // stacked theme would otherwise pick up the winner's colors, or, for
    // keys that exist only in its own override block (e.g. bubbleRim,
    // glassBody), dereference `undefined` and crash the render loop.

    const activeHooks = syncActiveHooks();
    const suppress = (key) => activeHooks.some(({ hooks }) => hooks[key]);
    const suppressSky = suppress("suppressSky");
    const suppressAtmosphere = suppress("suppressAtmosphere");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scroll-interpolated sky gradient — rebuilt only when inputs change.
    // Themes that paint their own background (e.g. paper, whose backdrop
    // comes from CSS) raise `suppressSky` to skip this layer.
    if (opts.sky && !suppressSky) {
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

    // Boolean OS preference, threaded through the frame so effects can
    // gate "skip entirely" effects without reading the preference
    // directly.
    const reducedMotion = prefersReducedMotion();

    // The moon hangs only once the visitor reveals the real sky (the systems
    // badge); ease toward that target so it fades rather than pops.
    const moonTarget = document.body.classList.contains("sky-revealed") ? 1 : 0;
    if (reducedMotion) {
      moonReveal = moonTarget;
    } else if (moonReveal !== moonTarget) {
      const step = dt / MOON_REVEAL_FADE_SECONDS;
      moonReveal =
        moonTarget > moonReveal
          ? Math.min(moonTarget, moonReveal + step)
          : Math.max(moonTarget, moonReveal - step);
    }

    if (sky && !suppressSky) {
      sky.draw(ctx, canvas, sp, pal, forces, scrollVelocity);
      // Shares the stars' layer and their scroll fade; the renderer itself
      // keeps it to the actual night.
      if (moonReveal > 0) moon.draw(ctx, canvas, sp, pal, moonReveal);
    }

    // Click fury — lightning, aurora, meteors.
    if (!reducedMotion) fury.draw(ctx, canvas, pal, dt, now);

    // Atmosphere — streaks, clouds, wisps, horizon, gusts, motes.
    // Decay on wall-clock time so gusts (which ride this velocity) don't fade
    // faster on a high-refresh display than they do at 60fps.
    scrollVelocity *= Math.pow(SCROLL.VEL_DECAY, dt * DECAY_REF_HZ);
    const drawVelocity = scaled(scrollVelocity);
    interactions.updateHold(forces, now);
    if (!suppressAtmosphere) {
      atmosphere.draw(sp, drawVelocity, pal, forces, isBlocky, !!theme);
    }

    // Theme-owned ambient particles. Each registered theme decides what
    // it needs from the frame state — palette, dt, velocity — and the
    // loop here doesn't know the difference between paper's flick spawns
    // and snow's globe shake.
    const frame = {
      sp,
      dt,
      scrollVelocity,
      drawVelocity,
      reducedMotion,
      pal,
      palFor,
      isDark,
      forces,
      ctx,
      canvas,
    };
    for (const { hooks } of activeHooks) hooks.drawAmbient?.(frame);

    interactions.decayImpulse(forces);
    interactions.draw(ctx, pal, forces);
    // Each linked window's cursor, redrawn on the cursor layer as the same
    // custom cursor continuing across the seam. Fed the raw seam pointers (true
    // viewport coords — the cursor layer isn't flipped, unlike the canvas). Keep
    // updating while cursors are still fading out after the pointer went quiet.
    if (remotes.length || ghostsVisible) {
      ghostsVisible = cursorGhosts.update(remotes, canvas);
    }

    for (const { hooks } of activeHooks) hooks.drawForeground?.(frame);
    for (const { hooks } of activeHooks) hooks.drawPost?.(frame);
  }

  // Backgrounded tabs throttle rAF, but they still tick — skipping the
  // expensive drawFrame work entirely saves CPU/battery for visitors
  // who left the tab open.  The rAF chain stays unbroken so resume is
  // automatic when the user returns.
  let renderPaused = document.hidden;
  document.addEventListener("visibilitychange", () => {
    renderPaused = document.hidden;
    // On resume, anchor the next dt to "now" — otherwise the first frame
    // computes dt against a pre-pause timestamp and any dt-driven spawn
    // accumulator bursts to flush the apparent backlog.
    if (!renderPaused) lastFrameTime = performance.now();
  });

  // Drive the render loop.  Invariant: the next frame is always
  // scheduled, even if drawFrame throws — otherwise a single bad frame
  // (e.g. a palette-key dereference on a stacked theme) would kill the
  // loop and freeze the canvas with no recovery short of a reload.
  function render() {
    try {
      if (!renderPaused) drawFrame();
    } catch (err) {
      console.error("[canvas] render frame failed:", err);
    } finally {
      requestAnimationFrame(render);
    }
  }

  // Live FPS guard — sustained low frame rate flips a body class that
  // CSS uses to shed the most expensive always-on decorative cost
  // (grain overlay, backdrop blurs).  Reverts with hysteresis when
  // frames recover, so one bad stretch doesn't lock the page down.
  observeFps((factor) => {
    document.body.classList.toggle("perf-reduced", factor < 1);
  });

  const UI_OVERLAY = UI_OVERLAY_SELECTOR;

  // Per-theme palette resolver matching the current appearance.  Reads
  // `isDark` on each call so changes from `appearance.onChange` apply
  // immediately without re-binding consumers.
  function palFor(id) {
    return resolvePalette(isDark ? "dark" : "light", id);
  }

  // Read the active hooks set and fire any pending lifecycle transitions.
  // Pairing the two means onActivate is observed before pointer hooks
  // fire for the same theme, even when a body class flips between
  // render frames.
  function syncActiveHooks() {
    const active = getActiveHooks();
    dispatchTransitions(active);
    return active;
  }

  document.addEventListener("click", (e) => {
    // Skip all canvas effects for clicks on UI controls
    if (e.target.closest(UI_OVERLAY)) return;

    const cx = e.clientX;
    const cy = canvasY(e.clientY);
    const activeHooks = syncActiveHooks();
    forces.clickImpulse.x = cx;
    forces.clickImpulse.y = cy;
    forces.clickImpulse.strength = HOLD.BLAST_BASE;
    // Mirror the click into linked windows in true viewport coords (the
    // transport shifts to desktop space). No-op when solo.
    window.dispatchEvent(
      new CustomEvent("sky-effect", {
        detail: {
          x: e.clientX,
          y: e.clientY,
          strength: HOLD.BLAST_BASE,
          well: 0,
        },
      }),
    );
    // Forward the nearest service card so achievement handlers can
    // evaluate hit-test without duplicating it.
    const card = e.target.closest(".service-card") || null;
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "click", x: e.clientX, y: e.clientY, card },
      }),
    );

    fury.click(cx, cy, canvas, scrollProgress);

    // Catching a shooting star mid-flight is its own little reward.
    if (sky && sky.clickShootingStar && sky.clickShootingStar(cx, cy)) {
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "shooting-star-clicked" },
        }),
      );
    }

    const ptr = {
      x: e.clientX,
      y: e.clientY,
      cx,
      cy,
      forces,
      palFor,
      reducedMotion: prefersReducedMotion(),
    };
    for (const { hooks } of activeHooks) hooks.onClick?.(ptr);

    // Default click burst particles — themes that paint their own click
    // visual (blocky's block fragments, paper's ink splat) raise
    // suppressDefaultClickBurst to skip this layer.
    const suppressDefault = activeHooks.some(
      ({ hooks }) => hooks.suppressDefaultClickBurst,
    );
    if (!suppressDefault) {
      interactions.click(cx, cy, currentPal);
    }
    // suppressDefault rides along so the generic click tap stays silent when a
    // theme drew (and sounds) its own click visual — the count still lands for
    // achievements/analytics, only the default burst's voice is gated.
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "click-burst", suppressDefault, x: e.clientX },
      }),
    );
  });

  // Pointer events — drag/trail/release delegated to interactions module
  bindPointer(document, {
    onDown(x, y, e) {
      if (e.target.closest(UI_OVERLAY)) return false;
      const cx = x,
        cy = canvasY(y);
      interactions.startDrag(forces, cx, cy);
      const ptr = {
        x,
        y,
        cx,
        cy,
        forces,
        palFor,
        reducedMotion: prefersReducedMotion(),
      };
      for (const { hooks } of syncActiveHooks()) hooks.onDragStart?.(ptr);
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
      const ptr = {
        x,
        y,
        cx,
        cy,
        trailAdded,
        forces,
        palFor,
        reducedMotion: prefersReducedMotion(),
      };
      for (const { hooks } of syncActiveHooks()) hooks.onDragMove?.(ptr);
    },
    onUp() {
      const ptr = { forces, palFor };
      for (const { hooks } of syncActiveHooks()) hooks.onDragEnd?.(ptr);
      const eff = interactions.releaseDrag(forces, currentPal);
      // Mirror the release blast (well or plain) into linked windows, in true
      // viewport coords (un-mirror the canvas-space drag point first).
      if (eff) {
        window.dispatchEvent(
          new CustomEvent("sky-effect", {
            detail: {
              x: eff.x,
              y: mirrorYWhenInverted(eff.y, canvas.height),
              strength: eff.strength,
              well: eff.well,
            },
          }),
        );
      }
    },
  });

  // Hover tracking — passive cursor position for proximity effects.
  // Listens on window because the canvas element has `pointer-events:
  // none` and therefore never receives mouse events directly.  mouseout
  // with a falsy relatedTarget means the cursor left the viewport.
  window.addEventListener(
    "mousemove",
    (e) => {
      forces.hover.x = e.clientX;
      forces.hover.y = canvasY(e.clientY);
      forces.hover.active = true;
      forces.lastMoveTime = performance.now();
    },
    { passive: true },
  );
  window.addEventListener(
    "mouseout",
    (e) => {
      if (!e.relatedTarget) forces.hover.active = false;
    },
    { passive: true },
  );

  // Any user activity resets the idle clock, not just mouse movement.
  // Covers scroll, keyboard, and touch so the aurora doesn't fade in
  // during active non-mouse interaction.
  const resetIdle = () => {
    forces.lastMoveTime = performance.now();
  };
  window.addEventListener("pointerdown", resetIdle, { passive: true });
  window.addEventListener("keydown", resetIdle, { passive: true });
  window.addEventListener("scroll", resetIdle, { passive: true });
  window.addEventListener("touchstart", resetIdle, { passive: true });

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

  // A click or gravity-well release in a linked window lands here too, as both
  // a force and its visible burst (each event has exactly one publisher in the
  // codebase). No achievement or fury — the effect's origin was the other
  // window; this side just answers to it. The burst self-gates under reduced
  // motion, so only the push crosses then.
  window.addEventListener("sky-link-effect", (e) => {
    const { x, y, strength, well } = e.detail;
    const cy = canvasY(y);
    forces.clickImpulse.x = x;
    forces.clickImpulse.y = cy;
    forces.clickImpulse.strength = strength;
    interactions.burst(x, cy, currentPal, { strength, well });
  });

  render();
}
