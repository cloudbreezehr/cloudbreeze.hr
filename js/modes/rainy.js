import { defineConstants } from "../dev/registry.js";
import { playWipe } from "../effects/wipe.js";
import { spawnRipple } from "../effects/ripple.js";
import { enableCardEffects } from "../service-cards.js";

// ── Force & Activation ──
const RF = defineConstants(
  "modes.rainyForce",
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
  { mode: "rainy" },
);

// ── Visual Effects ──
const RV = defineConstants(
  "modes.rainyVisuals",
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
    FLASH_Z_INDEX: 100,
    RUMBLE_FRAME_MS: 16,
  },
  { mode: "rainy" },
);

export function initRainy() {
  let force = 0;
  let isRainy = false;
  let isTransitioning = false;
  let lastClickTime = 0;
  let rumbleTriggered = false;
  let downpourTriggered = false;

  const heroTagEl = document.querySelector(".hero-tag");
  const canvasEl = document.getElementById("bg-canvas");
  const cloudSvg = document.querySelector(".cloud-svg");
  if (!heroTagEl) return;

  const originalTagText = heroTagEl.textContent;
  const activeTagText = "Clear Skies";

  // ── Storm vignette overlay (progressive indicator) ──
  const stormOverlay = document.createElement("div");
  stormOverlay.className = "storm-overlay";
  document.body.appendChild(stormOverlay);

  // ── 1. Cloud darkening (canvas filter) ──
  function updateCloudDarken(progress) {
    if (document.body.classList.contains("upside-down")) {
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
  }

  // ── 2. Hero-tag glow ──
  function updateTagGlow(progress) {
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
  }

  // ── 3. Wind vignette creep ──
  function updateWindVignette(progress) {
    if (progress < RF.WIND_PICKUP_AT) {
      stormOverlay.style.opacity = "0";
      return;
    }
    const t = Math.min(
      1,
      (progress - RF.WIND_PICKUP_AT) / (1 - RF.WIND_PICKUP_AT),
    );
    stormOverlay.style.opacity = String(t * 0.8);
  }

  // ── 4. Hero-tag sway ──
  function updateTagSway(progress) {
    if (progress < RF.WIND_PICKUP_AT) {
      heroTagEl.style.animation = "";
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
  }

  // ── 5. Cloud logo glow ──
  function updateLogoGlow(progress) {
    if (progress < RF.FIRST_DROPS_AT) {
      cloudSvg.style.filter = "";
      return;
    }
    const t = Math.min(
      1,
      (progress - RF.FIRST_DROPS_AT) / (1 - RF.FIRST_DROPS_AT),
    );
    const spread = RV.LOGO_GLOW_SPREAD_MIN + t * RV.LOGO_GLOW_SPREAD_RANGE;
    const alpha = RV.LOGO_GLOW_ALPHA_MIN + t * RV.LOGO_GLOW_ALPHA_RANGE;
    cloudSvg.style.filter = `drop-shadow(0 0 ${spread}px rgba(120,140,170,${alpha.toFixed(2)}))`;
  }

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
        { duration: dur, easing: "ease-out", fill: "forwards" },
      ).onfinish = () => el.remove();
    }
  }

  // ── Rumble flash effect at 70% threshold ──
  function triggerRumbleFlash() {
    const flash = document.createElement("div");
    flash.style.cssText =
      "position:fixed;inset:0;background:rgba(220,235,255," +
      RV.FLASH_OPACITY +
      ");pointer-events:none;z-index:" +
      RV.FLASH_Z_INDEX;
    document.body.appendChild(flash);
    flash.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: RV.FLASH_DURATION_MS,
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

  // ── Update all visual indicators ──
  function updateVisuals(clearing) {
    updateCloudDarken(force);
    updateTagGlow(force);
    updateWindVignette(force);
    updateTagSway(force);
    updateLogoGlow(force);

    // Rumble at 70% (once per buildup)
    if (!clearing && force >= RF.RUMBLE_AT && !rumbleTriggered) {
      rumbleTriggered = true;
      triggerRumbleFlash();
    }
    if (force < RF.RUMBLE_AT) rumbleTriggered = false;

    // Second rumble at 90%
    if (!clearing && force >= RF.DOWNPOUR_AT && !downpourTriggered) {
      downpourTriggered = true;
      triggerRumbleFlash();
    }
    if (force < RF.DOWNPOUR_AT) downpourTriggered = false;
  }

  // ── Clear all indicators ──
  function clearIndicators() {
    force = 0;
    heroTagEl.style.textShadow = "";
    heroTagEl.style.animation = "";
    heroTagEl.style.removeProperty("--sway-deg");
    stormOverlay.style.opacity = "0";
    canvasEl.style.filter = "";
    cloudSvg.style.filter = "";
    rumbleTriggered = false;
    downpourTriggered = false;
  }

  // ── Card rain interactions ──
  let disableCardRain = null;

  function cardClick(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spawnRipple(x, y, {
      className: "rain-ripple",
      parent: card,
      duration: RV.RIPPLE_DURATION_MS,
      maxScale: RV.RIPPLE_SCALE,
      startOpacity: RV.RIPPLE_START_OPACITY,
    });
  }

  function enableCardRain() {
    disableCardRain = enableCardEffects({
      className: "rain-card",
      trackingPrefix: "rain",
      onClick: cardClick,
    });
  }

  // ── Rain transition (storm front wipe) ──
  function triggerRain() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "storm-wipe",
      coverMs: RF.WIPE_COVER_MS,
      revealMs: RF.WIPE_REVEAL_MS,
      onMidpoint() {
        isRainy = true;
        document.body.classList.add("rainy");
        document.body.dataset.lastSubmode = "rainy";
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-activate", mode: "rainy" },
          }),
        );
        clearIndicators();
        enableCardRain();
        heroTagEl.textContent = activeTagText;
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Clear transition (storm lifting wipe) ──
  function triggerClear() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "storm-wipe clearing",
      coverMs: RF.WIPE_COVER_MS,
      revealMs: RF.WIPE_REVEAL_MS,
      onMidpoint() {
        isRainy = false;
        document.body.classList.remove("rainy");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "rainy" },
          }),
        );
        clearIndicators();
        if (disableCardRain) disableCardRain();
        heroTagEl.textContent = originalTagText;
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Click handler ──
  heroTagEl.addEventListener("click", (e) => {
    if (isTransitioning) return;

    const now = Date.now();
    lastClickTime = now;
    const target = isRainy ? RF.CLICKS_TO_CLEAR : RF.CLICKS_TO_RAIN;
    const clearing = isRainy;

    force = Math.min(1, force + 1 / target);

    spawnSplash(e.clientX, e.clientY, clearing);
    updateVisuals(clearing);

    if (force >= 1.0) {
      if (isRainy) {
        triggerClear();
      } else {
        triggerRain();
      }
    }
  });

  // ── Decay loop ──
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    if (force > 0 && !isTransitioning) {
      const timeSinceClick = Date.now() - lastClickTime;
      if (timeSinceClick > RF.CLICK_TIMEOUT_MS) {
        const target = isRainy ? RF.CLICKS_TO_CLEAR : RF.CLICKS_TO_RAIN;
        const decay = (RF.DECAY_RATE / target) * dt;
        force = Math.max(0, force - decay);
        updateVisuals(isRainy);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}
