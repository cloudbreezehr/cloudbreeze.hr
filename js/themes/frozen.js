import { defineConstants } from "../dev/registry.js";
import { getCanvasCtx } from "../canvas-utils.js";
import { spawnRipple } from "../effects/ripple.js";
import { enableCardEffects } from "../service-cards.js";
import { createSnow } from "../particles/frozen.js";
import { reducedDuration } from "../motion.js";
import { subscribe as subscribeScroll } from "../scroll-bus.js";
import { createTheme } from "./factory.js";
import { hasActiveThemeExcept } from "./registry.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createClickCountTrigger } from "./triggers.js";

// ── Particle counts ──
const COUNTS = defineConstants(
  "themes.frozen.particles",
  {
    SNOW: {
      value: 40,
      min: 0,
      max: 200,
      step: 1,
      description: "Snowflake count",
    },
  },
  { theme: "frozen" },
);

// ── Snow Globe Shake ──
// Rapid scroll-direction reversals fire the `snow-globe` achievement
// and, when frozen is active, burst the snowflakes.  Detection lives
// here because the gesture *is* the snow-globe — the achievement and
// the visual reaction share a name.  The scroll listener registers at
// init (unconditionally) so the achievement is reachable for users who
// have never entered frozen.
const SHAKE = defineConstants(
  "themes.frozen.shake",
  {
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
  },
  { theme: "frozen" },
);

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
export const FF = defineConstants(
  "themes.frozen.force",
  {
    CLICKS_TO_FREEZE: 25,
    CLICKS_TO_THAW: 13,
    CLICK_TIMEOUT_MS: 1500,
    DECAY_RATE: 2,
    FROST_RIM_AT: 0.2,
    FROST_CREEP_AT: 0.32,
    TEMP_DROP_AT: 0.52,
    LOGO_FROST_AT: 0.68,
    WIPE_COVER_MS: 400,
    WIPE_REVEAL_MS: 600,
  },
  { theme: "frozen" },
);

// ── Visual Effects ──
const FV = defineConstants(
  "themes.frozen.visuals",
  {
    BREATH_COUNT_MIN: 3,
    BREATH_COUNT_RANGE: 4,
    BREATH_SIZE_MIN: 4,
    BREATH_SIZE_RANGE: 8,
    BREATH_DIST_MIN: 30,
    BREATH_DIST_RANGE: 60,
    BREATH_DURATION_MIN: 600,
    BREATH_DURATION_RANGE: 400,
    RIM_SPREAD_MIN: 4,
    RIM_SPREAD_RANGE: 12,
    RIM_ALPHA_MIN: 0.3,
    RIM_ALPHA_RANGE: 0.5,
    FROST_SIZE_MIN: 8,
    FROST_SIZE_RANGE: 22,
    TEMP_SAT_DROP: 0.6,
    TEMP_BRI_BOOST: 0.25,
    LOGO_SAT_DROP: 0.8,
    LOGO_BRI_BOOST: 0.4,
    RIPPLE_DURATION_MS: 600,
    RIPPLE_SCALE: 4,
    RIPPLE_START_OPACITY: 0.6,
    TILT_INTENSITY: 3,
    TILT_SCALE: 1.01,
  },
  { theme: "frozen" },
);

export function initFrozen() {
  const logoEl = document.querySelector(".nav-logo");
  const cloudSvg = document.querySelector(".cloud-svg");
  const { canvasEl, ctx: canvasCtx } = getCanvasCtx();

  // ── Frost overlay (corner creep) ──
  const frostOverlay = document.createElement("div");
  frostOverlay.className = "frost-overlay";
  document.body.appendChild(frostOverlay);

  // ── 1. Frost breath particles ──
  let lastClickX = 0;
  let lastClickY = 0;

  function spawnBreath(warm) {
    const count =
      FV.BREATH_COUNT_MIN + Math.floor(Math.random() * FV.BREATH_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "frost-breath" + (warm ? " warm" : "");
      const size = FV.BREATH_SIZE_MIN + Math.random() * FV.BREATH_SIZE_RANGE;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = lastClickX + "px";
      el.style.top = lastClickY + "px";
      document.body.appendChild(el);

      const angle = Math.random() * Math.PI * 2;
      const dist = FV.BREATH_DIST_MIN + Math.random() * FV.BREATH_DIST_RANGE;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur =
        FV.BREATH_DURATION_MIN + Math.random() * FV.BREATH_DURATION_RANGE;

      el.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 0.8 },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`,
            opacity: 0,
          },
        ],
        {
          duration: reducedDuration(dur),
          easing: "ease-out",
          fill: "forwards",
        },
      ).onfinish = () => el.remove();
    }
  }

  // ── Card frost interactions ──
  let disableCardFrost = null;

  function cardClick(e) {
    const card = e.currentTarget;
    card.classList.toggle("card-frozen");
    const rect = card.getBoundingClientRect();
    spawnRipple(e.clientX - rect.left, e.clientY - rect.top, {
      className: "frost-ripple",
      parent: card,
      duration: FV.RIPPLE_DURATION_MS,
      maxScale: FV.RIPPLE_SCALE,
      startOpacity: FV.RIPPLE_START_OPACITY,
    });
  }

  // Canvas-side hooks — ambient snow with pointer interaction + the snow
  // globe gesture (rapid scroll-direction reversals burst the flakes).
  const snow = createSnow(canvasEl, canvasCtx, COUNTS.SNOW);
  // Snow globe turbulence — set to 1 on a successful shake, decayed by
  // the snow factory each draw call.
  const snowTurbulence = { value: 0 };
  let lastScrollDir = 0; // -1 = up, 1 = down, 0 = idle
  let reversalTimes = [];
  subscribeScroll(({ deltaY }) => {
    if (Math.abs(deltaY) < SHAKE.MIN_DELTA) return;
    const dir = deltaY > 0 ? 1 : -1;
    if (lastScrollDir !== 0 && dir !== lastScrollDir) {
      const now = performance.now();
      reversalTimes.push(now);
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
  });
  registerCanvasHooks("frozen", {
    drawAmbient({ drawVelocity, motionScale, reducedMotion, forces }) {
      // Suppress the shake under reduced motion.
      if (reducedMotion) snowTurbulence.value = 0;
      snow.draw(forces, drawVelocity, snowTurbulence, motionScale);
    },
  });

  createTheme({
    id: "frozen",
    trigger: createClickCountTrigger({
      element: logoEl,
      activateCount: FF.CLICKS_TO_FREEZE,
      deactivateCount: FF.CLICKS_TO_THAW,
      timeoutMs: FF.CLICK_TIMEOUT_MS,
      decayRate: FF.DECAY_RATE,
      preClick(e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        lastClickX = e.clientX;
        lastClickY = e.clientY;
      },
      onClick(e, { isActive }) {
        // Always spawn breath — the indicator applies regardless of thaw/freeze direction
        spawnBreath(isActive);
        if (isActive)
          window.dispatchEvent(
            new CustomEvent("achievement", {
              detail: { type: "frost-breath" },
            }),
          );
      },
    }),
    indicators: [
      // ── 2. Logo frost rim ──
      {
        threshold: FF.FROST_RIM_AT,
        apply(progress, ctx) {
          if (progress < FF.FROST_RIM_AT) {
            cloudSvg.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - FF.FROST_RIM_AT) / (1 - FF.FROST_RIM_AT),
          );
          const spread = FV.RIM_SPREAD_MIN + t * FV.RIM_SPREAD_RANGE;
          const alpha = FV.RIM_ALPHA_MIN + t * FV.RIM_ALPHA_RANGE;
          // Thaw buildup (active=true) paints warm orange; freeze buildup paints cyan.
          cloudSvg.style.filter = ctx.isActive
            ? `drop-shadow(0 0 ${spread}px rgba(255,160,60,${alpha}))`
            : `drop-shadow(0 0 ${spread}px rgba(0,220,255,${alpha}))`;
        },
        clear() {
          cloudSvg.style.filter = "";
        },
      },
      // ── 3. Screen-edge frost creep ──
      {
        threshold: FF.FROST_CREEP_AT,
        apply(progress) {
          if (progress < FF.FROST_CREEP_AT) {
            frostOverlay.style.opacity = "0";
            return;
          }
          const t = Math.min(
            1,
            (progress - FF.FROST_CREEP_AT) / (1 - FF.FROST_CREEP_AT),
          );
          frostOverlay.style.opacity = String(t);
          const size = FV.FROST_SIZE_MIN + t * FV.FROST_SIZE_RANGE;
          frostOverlay.style.setProperty("--frost-size", size + "%");
        },
        clear() {
          frostOverlay.style.opacity = "0";
        },
      },
      // ── 4. Temperature drop (canvas filter) ──
      {
        threshold: FF.TEMP_DROP_AT,
        apply(progress) {
          // Don't fight other themes' own canvas filters
          if (hasActiveThemeExcept("frozen")) {
            canvasEl.style.filter = "";
            return;
          }
          if (progress < FF.TEMP_DROP_AT) {
            canvasEl.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - FF.TEMP_DROP_AT) / (1 - FF.TEMP_DROP_AT),
          );
          const sat = 1 - t * FV.TEMP_SAT_DROP;
          const bri = 1 + t * FV.TEMP_BRI_BOOST;
          canvasEl.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
        },
        clear() {
          canvasEl.style.filter = "";
        },
      },
      // ── 5. Logo frost-over (desaturate + brighten the whole logo) ──
      // Skipped while thawing — the logo returns to its natural look.
      {
        threshold: FF.LOGO_FROST_AT,
        apply(progress, ctx) {
          if (ctx.isActive) {
            logoEl.style.filter = "";
            return;
          }
          if (progress < FF.LOGO_FROST_AT) {
            logoEl.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - FF.LOGO_FROST_AT) / (1 - FF.LOGO_FROST_AT),
          );
          const sat = 1 - t * FV.LOGO_SAT_DROP;
          const bri = 1 + t * FV.LOGO_BRI_BOOST;
          logoEl.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
        },
        clear() {
          logoEl.style.filter = "";
        },
      },
    ],
    wipe: {
      className: "frost-wipe",
      reverseModifier: "thaw",
      coverMs: FF.WIPE_COVER_MS,
      revealMs: FF.WIPE_REVEAL_MS,
    },
    onActivate() {
      disableCardFrost = enableCardEffects({
        className: "frost-card",
        trackingPrefix: "frost",
        onClick: cardClick,
        tilt: { intensity: FV.TILT_INTENSITY, scale: FV.TILT_SCALE },
      });
    },
    onDeactivate() {
      if (disableCardFrost) disableCardFrost("card-frozen");
    },
  });
}
