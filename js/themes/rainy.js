import { Z_THEME_FLASH } from "../layers.js";
import { defineConstants } from "../dev/registry.js";
import { getCanvasCtx } from "../canvas-utils.js";
import { spawnRipple } from "../effects/ripple.js";
import { enableCardEffects } from "../service-cards.js";
import { createRain } from "../particles/rain.js";
import { reducedDuration } from "../motion.js";
import { createTheme } from "./factory.js";
import { hasActiveThemeExcept } from "./registry.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createClickCountTrigger } from "./triggers.js";

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const RF = defineConstants(
  "themes.rainy.force",
  {
    CLICKS_TO_RAIN: 15,
    CLICKS_TO_CLEAR: 8,
    CLICK_TIMEOUT_MS: 1500,
    DECAY_RATE: 2,
    CLOUD_DARKEN_AT: 0.15,
    WIND_PICKUP_AT: 0.3,
    FIRST_DROPS_AT: 0.5,
    RUMBLE_AT: 0.7,
    DOWNPOUR_AT: 0.9,
    WIPE_COVER_MS: 400,
    WIPE_REVEAL_MS: 600,
  },
  { theme: "rainy" },
);

// ── Visual Effects ──
const RV = defineConstants(
  "themes.rainy.visuals",
  {
    TAG_GLOW_SPREAD_MIN: 2,
    TAG_GLOW_SPREAD_RANGE: 10,
    TAG_GLOW_ALPHA_MIN: 0.2,
    TAG_GLOW_ALPHA_RANGE: 0.5,
    DARKEN_SAT_RANGE: 0.4,
    DARKEN_BRI_RANGE: 0.25,
    SWAY_MAX_DEG: 2,
    LOGO_GLOW_SPREAD_MIN: 3,
    LOGO_GLOW_SPREAD_RANGE: 12,
    LOGO_GLOW_ALPHA_MIN: 0.2,
    LOGO_GLOW_ALPHA_RANGE: 0.5,
    RUMBLE_PX: 3,
    RUMBLE_DURATION_MS: 200,
    FLASH_OPACITY: 0.08,
    FLASH_DURATION_MS: 80,
    SPLASH_PARTICLE_COUNT_MIN: 3,
    SPLASH_PARTICLE_COUNT_RANGE: 3,
    SPLASH_DIST_MIN: 20,
    SPLASH_DIST_RANGE: 40,
    SPLASH_SIZE_MIN: 3,
    SPLASH_SIZE_RANGE: 6,
    SPLASH_DURATION_MIN: 500,
    SPLASH_DURATION_RANGE: 300,
    RIPPLE_DURATION_MS: 700,
    RIPPLE_SCALE: 4,
    RIPPLE_START_OPACITY: 0.5,
    FLASH_Z_INDEX: Z_THEME_FLASH,
    RUMBLE_FRAME_MS: 16,
  },
  { theme: "rainy" },
);

export function initRainy() {
  const heroTagEl = document.querySelector(".hero-tag");
  const { canvasEl, ctx: canvasCtx } = getCanvasCtx();
  const cloudSvg = document.querySelector(".cloud-svg");
  if (!heroTagEl) return;

  const originalTagText = heroTagEl.textContent;
  const activeTagText = "Clear Skies";

  // ── Storm vignette overlay (progressive indicator) ──
  const stormOverlay = document.createElement("div");
  stormOverlay.className = "storm-overlay";
  document.body.appendChild(stormOverlay);

  // Rumble flash is latching — once fired at a threshold, it won't refire
  // until force drops below that threshold.
  let rumbleTriggered = false;
  let downpourTriggered = false;

  // ── Spawn rain splash particles from click ──
  function spawnSplash(cx, cy, clearing) {
    const count =
      RV.SPLASH_PARTICLE_COUNT_MIN +
      Math.floor(Math.random() * RV.SPLASH_PARTICLE_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "rain-splash" + (clearing ? " clearing" : "");
      const size = RV.SPLASH_SIZE_MIN + Math.random() * RV.SPLASH_SIZE_RANGE;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = cx + "px";
      el.style.top = cy + "px";
      document.body.appendChild(el);

      const angle = Math.random() * Math.PI * 2;
      const dist = RV.SPLASH_DIST_MIN + Math.random() * RV.SPLASH_DIST_RANGE;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur =
        RV.SPLASH_DURATION_MIN + Math.random() * RV.SPLASH_DURATION_RANGE;

      el.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 0.7 },
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

  // ── Rumble flash effect at 70% / 90% thresholds ──
  function triggerRumbleFlash() {
    const flash = document.createElement("div");
    flash.style.cssText =
      "position:fixed;inset:0;background:rgba(220,235,255," +
      RV.FLASH_OPACITY +
      ");pointer-events:none;z-index:" +
      RV.FLASH_Z_INDEX;
    document.body.appendChild(flash);
    flash.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: reducedDuration(RV.FLASH_DURATION_MS),
      fill: "forwards",
    }).onfinish = () => flash.remove();

    const pageEl = document.querySelector(".page");
    if (pageEl) {
      let frames = 0;
      const shake = () => {
        frames++;
        if (frames > RV.RUMBLE_DURATION_MS / RV.RUMBLE_FRAME_MS) {
          pageEl.style.translate = "";
          return;
        }
        const dx = (Math.random() - 0.5) * RV.RUMBLE_PX;
        const dy = (Math.random() - 0.5) * RV.RUMBLE_PX;
        pageEl.style.translate = `${dx}px ${dy}px`;
        requestAnimationFrame(shake);
      };
      shake();
    }
  }

  // ── Card rain interactions ──
  let disableCardRain = null;

  function cardClick(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    spawnRipple(e.clientX - rect.left, e.clientY - rect.top, {
      className: "rain-ripple",
      parent: card,
      duration: RV.RIPPLE_DURATION_MS,
      maxScale: RV.RIPPLE_SCALE,
      startOpacity: RV.RIPPLE_START_OPACITY,
    });
  }

  // Canvas-side hooks — rain streaks + glass droplets render layer,
  // splash bursts on click, well burst on drag-release.
  const rain = createRain(canvasEl, canvasCtx);
  registerCanvasHooks("rainy", {
    drawAmbient({ scrollVelocity, dt, palFor, forces }) {
      rain.draw(forces, scrollVelocity, dt, palFor("rainy"));
    },
    onClick({ cx, cy, reducedMotion }) {
      if (reducedMotion) return;
      rain.clickBurst(cx, cy);
    },
    onDragEnd({ forces }) {
      // Massive splash on gravity-well release: only if the well had
      // accumulated meaningful charge before the user let go.
      if (forces.wellStrength > 0) {
        rain.wellBurst(forces.dragPos.x, forces.dragPos.y);
      }
    },
    onDeactivate() {
      rain.cleanup();
    },
  });

  createTheme({
    id: "rainy",
    trigger: createClickCountTrigger({
      element: heroTagEl,
      activateCount: RF.CLICKS_TO_RAIN,
      deactivateCount: RF.CLICKS_TO_CLEAR,
      timeoutMs: RF.CLICK_TIMEOUT_MS,
      decayRate: RF.DECAY_RATE,
      onClick(e, { isActive }) {
        spawnSplash(e.clientX, e.clientY, isActive);
      },
    }),
    indicators: [
      // ── 1. Cloud darkening (canvas filter) ──
      {
        threshold: RF.CLOUD_DARKEN_AT,
        apply(progress) {
          // Don't fight other themes' own canvas filters
          if (hasActiveThemeExcept("rainy")) {
            canvasEl.style.filter = "";
            return;
          }
          if (progress < RF.CLOUD_DARKEN_AT) {
            canvasEl.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - RF.CLOUD_DARKEN_AT) / (1 - RF.CLOUD_DARKEN_AT),
          );
          const sat = 1 - t * RV.DARKEN_SAT_RANGE;
          const bri = 1 - t * RV.DARKEN_BRI_RANGE;
          canvasEl.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
        },
        clear() {
          canvasEl.style.filter = "";
        },
      },
      // ── 2. Hero-tag glow ──
      {
        threshold: RF.CLOUD_DARKEN_AT,
        apply(progress) {
          if (progress < RF.CLOUD_DARKEN_AT) {
            heroTagEl.style.textShadow = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - RF.CLOUD_DARKEN_AT) / (1 - RF.CLOUD_DARKEN_AT),
          );
          const spread = RV.TAG_GLOW_SPREAD_MIN + t * RV.TAG_GLOW_SPREAD_RANGE;
          const alpha = RV.TAG_GLOW_ALPHA_MIN + t * RV.TAG_GLOW_ALPHA_RANGE;
          heroTagEl.style.textShadow = `0 0 ${spread}px rgba(160,180,210,${alpha.toFixed(2)})`;
        },
        clear() {
          heroTagEl.style.textShadow = "";
        },
      },
      // ── 3. Wind vignette creep ──
      {
        threshold: RF.WIND_PICKUP_AT,
        apply(progress) {
          if (progress < RF.WIND_PICKUP_AT) {
            stormOverlay.style.opacity = "0";
            return;
          }
          const t = Math.min(
            1,
            (progress - RF.WIND_PICKUP_AT) / (1 - RF.WIND_PICKUP_AT),
          );
          stormOverlay.style.opacity = String(t * 0.8);
        },
        clear() {
          stormOverlay.style.opacity = "0";
        },
      },
      // ── 4. Hero-tag sway ──
      {
        threshold: RF.WIND_PICKUP_AT,
        apply(progress) {
          if (progress < RF.WIND_PICKUP_AT) {
            heroTagEl.style.animation = "";
            heroTagEl.style.removeProperty("--sway-deg");
            return;
          }
          heroTagEl.style.animation = "rain-sway 2s ease-in-out infinite";
          const t = Math.min(
            1,
            (progress - RF.WIND_PICKUP_AT) / (1 - RF.WIND_PICKUP_AT),
          );
          heroTagEl.style.setProperty(
            "--sway-deg",
            (t * RV.SWAY_MAX_DEG).toFixed(1) + "deg",
          );
        },
        clear() {
          heroTagEl.style.animation = "";
          heroTagEl.style.removeProperty("--sway-deg");
        },
      },
      // ── 5. Cloud logo glow ──
      {
        threshold: RF.FIRST_DROPS_AT,
        apply(progress) {
          if (progress < RF.FIRST_DROPS_AT) {
            if (cloudSvg) cloudSvg.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - RF.FIRST_DROPS_AT) / (1 - RF.FIRST_DROPS_AT),
          );
          const spread =
            RV.LOGO_GLOW_SPREAD_MIN + t * RV.LOGO_GLOW_SPREAD_RANGE;
          const alpha = RV.LOGO_GLOW_ALPHA_MIN + t * RV.LOGO_GLOW_ALPHA_RANGE;
          if (cloudSvg)
            cloudSvg.style.filter = `drop-shadow(0 0 ${spread}px rgba(120,140,170,${alpha.toFixed(2)}))`;
        },
        clear() {
          if (cloudSvg) cloudSvg.style.filter = "";
        },
      },
      // ── 6. Rumble flash (70%) ──
      // Latching — fires once per buildup crossing, skipped while clearing.
      {
        threshold: RF.RUMBLE_AT,
        apply(progress, ctx) {
          if (ctx.isActive) return;
          if (progress >= RF.RUMBLE_AT && !rumbleTriggered) {
            rumbleTriggered = true;
            triggerRumbleFlash();
          }
          if (progress < RF.RUMBLE_AT) rumbleTriggered = false;
        },
        clear() {
          rumbleTriggered = false;
        },
      },
      // ── 7. Downpour flash (90%) ──
      // Second latching rumble, same rules as the 70% one.
      {
        threshold: RF.DOWNPOUR_AT,
        apply(progress, ctx) {
          if (ctx.isActive) return;
          if (progress >= RF.DOWNPOUR_AT && !downpourTriggered) {
            downpourTriggered = true;
            triggerRumbleFlash();
          }
          if (progress < RF.DOWNPOUR_AT) downpourTriggered = false;
        },
        clear() {
          downpourTriggered = false;
        },
      },
    ],
    wipe: {
      className: "storm-wipe",
      reverseModifier: "clearing",
      coverMs: RF.WIPE_COVER_MS,
      revealMs: RF.WIPE_REVEAL_MS,
    },
    onActivate() {
      disableCardRain = enableCardEffects({
        className: "rain-card",
        trackingPrefix: "rain",
        onClick: cardClick,
      });
      heroTagEl.textContent = activeTagText;
    },
    onDeactivate() {
      if (disableCardRain) disableCardRain();
      heroTagEl.textContent = originalTagText;
    },
  });
}
