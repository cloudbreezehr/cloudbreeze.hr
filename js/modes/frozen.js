import { playWipe } from "../effects/wipe.js";
import { spawnRipple } from "../effects/ripple.js";

export function initFrozen() {
  const CLICKS_TO_FREEZE = 25;
  const CLICKS_TO_THAW = 13;
  const CLICK_TIMEOUT_MS = 1500;
  const DECAY_RATE = 2; // clicks/sec after timeout

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

  // ── Indicator thresholds (as fraction of 1.0) ──
  const FROST_RIM_AT = 0.2;
  const FROST_CREEP_AT = 0.32;
  const TEMP_DROP_AT = 0.52;
  const LOGO_FROST_AT = 0.68;

  // ── 1. Frost breath particles ──
  let lastClickX = 0,
    lastClickY = 0;

  function spawnBreath(warm) {
    const cx = lastClickX;
    const cy = lastClickY;

    const count = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "frost-breath" + (warm ? " warm" : "");
      const size = 4 + Math.random() * 8;
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = cx + "px";
      el.style.top = cy + "px";
      document.body.appendChild(el);

      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur = 600 + Math.random() * 400;

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
    if (progress < FROST_RIM_AT) {
      cloudSvg.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - FROST_RIM_AT) / (1 - FROST_RIM_AT));
    const spread = 4 + t * 12;
    const alpha = 0.3 + t * 0.5;
    if (warm) {
      cloudSvg.style.filter = `drop-shadow(0 0 ${spread}px rgba(255,160,60,${alpha}))`;
    } else {
      cloudSvg.style.filter = `drop-shadow(0 0 ${spread}px rgba(0,220,255,${alpha}))`;
    }
  }

  // ── 3. Screen-edge frost creep ──
  function updateFrostCreep(progress) {
    if (progress < FROST_CREEP_AT) {
      frostOverlay.style.opacity = "0";
      return;
    }
    const t = Math.min(1, (progress - FROST_CREEP_AT) / (1 - FROST_CREEP_AT));
    frostOverlay.style.opacity = String(t);
    const size = 8 + t * 22; // % of viewport
    frostOverlay.style.setProperty("--frost-size", size + "%");
  }

  // ── 4. Temperature drop (canvas filter) ──
  function updateTempDrop(progress) {
    // Skip when upside-down is active to avoid conflicting with its CSS filter
    if (document.body.classList.contains("upside-down")) {
      canvasEl.style.filter = "";
      return;
    }
    if (progress < TEMP_DROP_AT) {
      canvasEl.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - TEMP_DROP_AT) / (1 - TEMP_DROP_AT));
    const sat = 1 - t * 0.6; // 1 → 0.4
    const bri = 1 + t * 0.25; // 1 → 1.25
    canvasEl.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
  }

  // ── 5. Logo frost-over (desaturate + brighten the whole logo) ──
  function updateLogoFrost(progress) {
    if (progress < LOGO_FROST_AT) {
      logoEl.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - LOGO_FROST_AT) / (1 - LOGO_FROST_AT));
    const sat = 1 - t * 0.8; // 1 → 0.2
    const bri = 1 + t * 0.4; // 1 → 1.4
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
  function enableCardFrost() {
    document.querySelectorAll(".service-card").forEach((card) => {
      card.classList.add("frost-card");

      card.addEventListener("mousemove", cardMouseMove);
      card.addEventListener("mouseleave", cardMouseLeave);
      card.addEventListener("click", cardClick);
    });
  }

  function disableCardFrost() {
    document.querySelectorAll(".service-card").forEach((card) => {
      card.classList.remove("frost-card", "card-frozen");
      card.style.removeProperty("--frost-x");
      card.style.removeProperty("--frost-y");
      card.removeEventListener("mousemove", cardMouseMove);
      card.removeEventListener("mouseleave", cardMouseLeave);
      card.removeEventListener("click", cardClick);
    });
  }

  function cardMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      "--frost-x",
      ((e.clientX - rect.left) / rect.width) * 100 + "%",
    );
    e.currentTarget.style.setProperty(
      "--frost-y",
      ((e.clientY - rect.top) / rect.height) * 100 + "%",
    );
  }

  function cardMouseLeave(e) {
    e.currentTarget.style.removeProperty("--frost-x");
    e.currentTarget.style.removeProperty("--frost-y");
  }

  function cardClick(e) {
    const card = e.currentTarget;
    card.classList.toggle("card-frozen");

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spawnRipple(x, y, {
      className: "frost-ripple",
      parent: card,
      duration: 600,
      maxScale: 4,
      startOpacity: 0.6,
    });
  }

  // ── Wipe timing ──
  const WIPE_COVER_MS = 400;
  const WIPE_REVEAL_MS = 600;

  // ── Freeze transition ──
  function triggerFreeze() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "frost-wipe",
      coverMs: WIPE_COVER_MS,
      revealMs: WIPE_REVEAL_MS,
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
      coverMs: WIPE_COVER_MS,
      revealMs: WIPE_REVEAL_MS,
      onMidpoint() {
        isFrozen = false;
        document.body.classList.remove("frozen");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "frozen" },
          }),
        );
        clearIndicators();
        disableCardFrost();
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Click handler ──
  logoEl.addEventListener("click", (e) => {
    e.preventDefault();
    if (isTransitioning) return;

    lastClickX = e.clientX;
    lastClickY = e.clientY;

    const now = Date.now();
    lastClickTime = now;
    const target = isFrozen ? CLICKS_TO_THAW : CLICKS_TO_FREEZE;
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
    const dt = (now - lastTick) / 1000; // seconds
    lastTick = now;

    if (force > 0 && !isTransitioning) {
      const timeSinceClick = Date.now() - lastClickTime;
      if (timeSinceClick > CLICK_TIMEOUT_MS) {
        const target = isFrozen ? CLICKS_TO_THAW : CLICKS_TO_FREEZE;
        const decay = (DECAY_RATE / target) * dt;
        force = Math.max(0, force - decay);
        updateVisuals(isFrozen);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}
