import { defineConstants } from "../dev/registry.js";
import { playWipe } from "../effects/wipe.js";
import { spawnRipple } from "../effects/ripple.js";
import { enableCardEffects } from "../service-cards.js";

// ── Force & Activation ──
const FF = defineConstants(
  "modes.frozenForce",
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
  { mode: "frozen" },
);

// ── Visual Effects ──
const FV = defineConstants(
  "modes.frozenVisuals",
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
  },
  { mode: "frozen" },
);

export function initFrozen() {
  let force = 0;
  let isFrozen = false;
  let isTransitioning = false;
  let lastClickTime = 0;

  const logoEl = document.querySelector(".nav-logo");
  const cloudSvg = document.querySelector(".cloud-svg");
  const canvasEl = document.getElementById("bg-canvas");

  // ── Frost overlay (corner creep) ──
  const frostOverlay = document.createElement("div");
  frostOverlay.className = "frost-overlay";
  document.body.appendChild(frostOverlay);

  // ── 1. Frost breath particles ──
  let lastClickX = 0,
    lastClickY = 0;

  function spawnBreath(warm) {
    const cx = lastClickX;
    const cy = lastClickY;

    const count =
      FV.BREATH_COUNT_MIN + Math.floor(Math.random() * FV.BREATH_COUNT_RANGE);
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "frost-breath" + (warm ? " warm" : "");
      const size = FV.BREATH_SIZE_MIN + Math.random() * FV.BREATH_SIZE_RANGE;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = cx + "px";
      el.style.top = cy + "px";
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
        { duration: dur, easing: "ease-out", fill: "forwards" },
      ).onfinish = () => el.remove();
    }
  }

  // ── 2. Logo frost rim ──
  function updateLogoRim(progress, warm) {
    if (progress < FF.FROST_RIM_AT) {
      cloudSvg.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - FF.FROST_RIM_AT) / (1 - FF.FROST_RIM_AT));
    const spread = FV.RIM_SPREAD_MIN + t * FV.RIM_SPREAD_RANGE;
    const alpha = FV.RIM_ALPHA_MIN + t * FV.RIM_ALPHA_RANGE;
    if (warm) {
      cloudSvg.style.filter = `drop-shadow(0 0 ${spread}px rgba(255,160,60,${alpha}))`;
    } else {
      cloudSvg.style.filter = `drop-shadow(0 0 ${spread}px rgba(0,220,255,${alpha}))`;
    }
  }

  // ── 3. Screen-edge frost creep ──
  function updateFrostCreep(progress) {
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
  }

  // ── 4. Temperature drop (canvas filter) ──
  function updateTempDrop(progress) {
    if (document.body.classList.contains("upside-down")) {
      canvasEl.style.filter = "";
      return;
    }
    if (progress < FF.TEMP_DROP_AT) {
      canvasEl.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - FF.TEMP_DROP_AT) / (1 - FF.TEMP_DROP_AT));
    const sat = 1 - t * FV.TEMP_SAT_DROP;
    const bri = 1 + t * FV.TEMP_BRI_BOOST;
    canvasEl.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
  }

  // ── 5. Logo frost-over (desaturate + brighten the whole logo) ──
  function updateLogoFrost(progress) {
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
  }

  // ── Update all visual indicators ──
  function updateVisuals(warm) {
    updateLogoRim(force, warm);
    updateFrostCreep(force);
    updateTempDrop(force);
    if (!warm) updateLogoFrost(force);
  }

  // ── Clear all indicators ──
  function clearIndicators() {
    force = 0;
    cloudSvg.style.filter = "";
    frostOverlay.style.opacity = "0";
    canvasEl.style.filter = "";
    logoEl.style.filter = "";
  }

  // ── Card frost interactions ──
  let disableCardFrost = null;

  function cardClick(e) {
    const card = e.currentTarget;
    card.classList.toggle("card-frozen");

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spawnRipple(x, y, {
      className: "frost-ripple",
      parent: card,
      duration: FV.RIPPLE_DURATION_MS,
      maxScale: FV.RIPPLE_SCALE,
      startOpacity: FV.RIPPLE_START_OPACITY,
    });
  }

  function enableCardFrost() {
    disableCardFrost = enableCardEffects({
      className: "frost-card",
      trackingPrefix: "frost",
      onClick: cardClick,
    });
  }

  // ── Freeze transition ──
  function triggerFreeze() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "frost-wipe",
      coverMs: FF.WIPE_COVER_MS,
      revealMs: FF.WIPE_REVEAL_MS,
      onMidpoint() {
        isFrozen = true;
        document.body.classList.add("frozen");
        document.body.dataset.lastSubmode = "frozen";
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-activate", mode: "frozen" },
          }),
        );
        clearIndicators();
        enableCardFrost();
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Thaw transition ──
  function triggerThaw() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "frost-wipe thaw",
      coverMs: FF.WIPE_COVER_MS,
      revealMs: FF.WIPE_REVEAL_MS,
      onMidpoint() {
        isFrozen = false;
        document.body.classList.remove("frozen");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "frozen" },
          }),
        );
        clearIndicators();
        if (disableCardFrost) disableCardFrost("card-frozen");
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Click handler ──
  logoEl.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (isTransitioning) return;

    lastClickX = e.clientX;
    lastClickY = e.clientY;

    const now = Date.now();
    lastClickTime = now;
    const target = isFrozen ? FF.CLICKS_TO_THAW : FF.CLICKS_TO_FREEZE;
    const warm = isFrozen;

    force = Math.min(1, force + 1 / target);

    // Always spawn breath
    spawnBreath(warm);
    if (isFrozen)
      window.dispatchEvent(
        new CustomEvent("achievement", { detail: { type: "frost-breath" } }),
      );

    updateVisuals(warm);

    if (force >= 1.0) {
      if (isFrozen) {
        triggerThaw();
      } else {
        triggerFreeze();
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
      if (timeSinceClick > FF.CLICK_TIMEOUT_MS) {
        const target = isFrozen ? FF.CLICKS_TO_THAW : FF.CLICKS_TO_FREEZE;
        const decay = (FF.DECAY_RATE / target) * dt;
        force = Math.max(0, force - decay);
        updateVisuals(isFrozen);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}
