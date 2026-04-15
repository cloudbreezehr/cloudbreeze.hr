import { playWipe } from "../effects/wipe.js";

export function initRainy() {
  const CLICKS_TO_RAIN = 15;
  const CLICKS_TO_CLEAR = 8;
  const CLICK_TIMEOUT_MS = 1500;
  const DECAY_RATE = 2; // clicks/sec after timeout

  // ── Indicator thresholds (as fraction of 1.0) ──
  const CLOUD_DARKEN_AT = 0.15;
  const WIND_PICKUP_AT = 0.3;
  const FIRST_DROPS_AT = 0.5;
  const RUMBLE_AT = 0.7;
  const DOWNPOUR_AT = 0.9;

  // ── Wipe timing ──
  const WIPE_COVER_MS = 400;
  const WIPE_REVEAL_MS = 600;

  // ── Indicator styling ──
  const TAG_GLOW_SPREAD_MIN = 2;
  const TAG_GLOW_SPREAD_RANGE = 10;
  const TAG_GLOW_ALPHA_MIN = 0.2;
  const TAG_GLOW_ALPHA_RANGE = 0.5;
  const DARKEN_SAT_RANGE = 0.4;
  const DARKEN_BRI_RANGE = 0.25;
  const SWAY_MAX_DEG = 2;
  const LOGO_GLOW_SPREAD_MIN = 3;
  const LOGO_GLOW_SPREAD_RANGE = 12;
  const LOGO_GLOW_ALPHA_MIN = 0.2;
  const LOGO_GLOW_ALPHA_RANGE = 0.5;
  const RUMBLE_PX = 3;
  const RUMBLE_DURATION_MS = 200;
  const FLASH_OPACITY = 0.08;
  const FLASH_DURATION_MS = 80;
  const SPLASH_PARTICLE_COUNT_MIN = 3;
  const SPLASH_PARTICLE_COUNT_RANGE = 3;
  const SPLASH_DIST_MIN = 20;
  const SPLASH_DIST_RANGE = 40;
  const SPLASH_SIZE_MIN = 3;
  const SPLASH_SIZE_RANGE = 6;
  const SPLASH_DURATION_MIN = 500;
  const SPLASH_DURATION_RANGE = 300;

  // ── Card ripple ──
  const RIPPLE_DURATION_MS = 700;
  const RIPPLE_SCALE = 4;
  const RIPPLE_START_OPACITY = 0.5;

  // ── Rumble frame timing ──
  const RUMBLE_FRAME_MS = 16;

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
    if (progress < CLOUD_DARKEN_AT) {
      canvasEl.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - CLOUD_DARKEN_AT) / (1 - CLOUD_DARKEN_AT));
    const sat = 1 - t * DARKEN_SAT_RANGE;
    const bri = 1 - t * DARKEN_BRI_RANGE;
    canvasEl.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
  }

  // ── 2. Hero-tag glow ──
  function updateTagGlow(progress) {
    if (progress < CLOUD_DARKEN_AT) {
      heroTagEl.style.textShadow = "";
      return;
    }
    const t = Math.min(1, (progress - CLOUD_DARKEN_AT) / (1 - CLOUD_DARKEN_AT));
    const spread = TAG_GLOW_SPREAD_MIN + t * TAG_GLOW_SPREAD_RANGE;
    const alpha = TAG_GLOW_ALPHA_MIN + t * TAG_GLOW_ALPHA_RANGE;
    heroTagEl.style.textShadow = `0 0 ${spread}px rgba(160,180,210,${alpha.toFixed(2)})`;
  }

  // ── 3. Wind vignette creep ──
  function updateWindVignette(progress) {
    if (progress < WIND_PICKUP_AT) {
      stormOverlay.style.opacity = "0";
      return;
    }
    const t = Math.min(1, (progress - WIND_PICKUP_AT) / (1 - WIND_PICKUP_AT));
    stormOverlay.style.opacity = String(t * 0.8);
  }

  // ── 4. Hero-tag sway ──
  function updateTagSway(progress) {
    if (progress < WIND_PICKUP_AT) {
      heroTagEl.style.animation = "";
      return;
    }
    heroTagEl.style.animation = "rain-sway 2s ease-in-out infinite";
    const t = Math.min(1, (progress - WIND_PICKUP_AT) / (1 - WIND_PICKUP_AT));
    heroTagEl.style.setProperty(
      "--sway-deg",
      (t * SWAY_MAX_DEG).toFixed(1) + "deg",
    );
  }

  // ── 5. Cloud logo glow ──
  function updateLogoGlow(progress) {
    if (progress < FIRST_DROPS_AT) {
      cloudSvg.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - FIRST_DROPS_AT) / (1 - FIRST_DROPS_AT));
    const spread = LOGO_GLOW_SPREAD_MIN + t * LOGO_GLOW_SPREAD_RANGE;
    const alpha = LOGO_GLOW_ALPHA_MIN + t * LOGO_GLOW_ALPHA_RANGE;
    cloudSvg.style.filter = `drop-shadow(0 0 ${spread}px rgba(120,140,170,${alpha.toFixed(2)}))`;
  }

  // ── Spawn rain splash particles from click ──
  function spawnSplash(cx, cy, clearing) {
    const count =
      SPLASH_PARTICLE_COUNT_MIN +
      Math.floor(Math.random() * SPLASH_PARTICLE_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "rain-splash" + (clearing ? " clearing" : "");
      const size = SPLASH_SIZE_MIN + Math.random() * SPLASH_SIZE_RANGE;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = cx + "px";
      el.style.top = cy + "px";
      document.body.appendChild(el);

      const angle = Math.random() * Math.PI * 2;
      const dist = SPLASH_DIST_MIN + Math.random() * SPLASH_DIST_RANGE;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur = SPLASH_DURATION_MIN + Math.random() * SPLASH_DURATION_RANGE;

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
      FLASH_OPACITY +
      ");pointer-events:none;z-index:9998";
    document.body.appendChild(flash);
    flash.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FLASH_DURATION_MS,
      fill: "forwards",
    }).onfinish = () => flash.remove();

    const pageEl = document.querySelector(".page");
    if (pageEl) {
      const origTransform = pageEl.style.transform;
      let frames = 0;
      const shake = () => {
        frames++;
        if (frames > RUMBLE_DURATION_MS / RUMBLE_FRAME_MS) {
          pageEl.style.transform = origTransform;
          return;
        }
        const dx = (Math.random() - 0.5) * RUMBLE_PX;
        const dy = (Math.random() - 0.5) * RUMBLE_PX;
        pageEl.style.transform = `translate(${dx}px, ${dy}px)`;
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
    if (!clearing && force >= RUMBLE_AT && !rumbleTriggered) {
      rumbleTriggered = true;
      triggerRumbleFlash();
    }
    if (force < RUMBLE_AT) rumbleTriggered = false;

    // Second rumble at 90%
    if (!clearing && force >= DOWNPOUR_AT && !downpourTriggered) {
      downpourTriggered = true;
      triggerRumbleFlash();
    }
    if (force < DOWNPOUR_AT) downpourTriggered = false;
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
  function enableCardRain() {
    document.querySelectorAll(".service-card").forEach((card) => {
      card.classList.add("rain-card");
      card.addEventListener("mousemove", cardMouseMove);
      card.addEventListener("mouseleave", cardMouseLeave);
      card.addEventListener("click", cardClick);
    });
  }

  function disableCardRain() {
    document.querySelectorAll(".service-card").forEach((card) => {
      card.classList.remove("rain-card");
      card.style.removeProperty("--rain-x");
      card.style.removeProperty("--rain-y");
      card.removeEventListener("mousemove", cardMouseMove);
      card.removeEventListener("mouseleave", cardMouseLeave);
      card.removeEventListener("click", cardClick);
    });
  }

  function cardMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      "--rain-x",
      ((e.clientX - rect.left) / rect.width) * 100 + "%",
    );
    e.currentTarget.style.setProperty(
      "--rain-y",
      ((e.clientY - rect.top) / rect.height) * 100 + "%",
    );
  }

  function cardMouseLeave(e) {
    e.currentTarget.style.removeProperty("--rain-x");
    e.currentTarget.style.removeProperty("--rain-y");
  }

  function cardClick(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement("div");
    ripple.className = "rain-ripple";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    card.appendChild(ripple);

    ripple.animate(
      [
        {
          transform: "translate(-50%,-50%) scale(0)",
          opacity: RIPPLE_START_OPACITY,
        },
        {
          transform: `translate(-50%,-50%) scale(${RIPPLE_SCALE})`,
          opacity: 0,
        },
      ],
      { duration: RIPPLE_DURATION_MS, easing: "ease-out", fill: "forwards" },
    ).onfinish = () => ripple.remove();
  }

  // ── Rain transition (storm front wipe) ──
  function triggerRain() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "storm-wipe",
      coverMs: WIPE_COVER_MS,
      revealMs: WIPE_REVEAL_MS,
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
      coverMs: WIPE_COVER_MS,
      revealMs: WIPE_REVEAL_MS,
      onMidpoint() {
        isRainy = false;
        document.body.classList.remove("rainy");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "rainy" },
          }),
        );
        clearIndicators();
        disableCardRain();
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
    const target = isRainy ? CLICKS_TO_CLEAR : CLICKS_TO_RAIN;
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
      if (timeSinceClick > CLICK_TIMEOUT_MS) {
        const target = isRainy ? CLICKS_TO_CLEAR : CLICKS_TO_RAIN;
        const decay = (DECAY_RATE / target) * dt;
        force = Math.max(0, force - decay);
        updateVisuals(isRainy);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}
