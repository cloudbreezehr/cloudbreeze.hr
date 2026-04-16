import { defineConstants } from "../dev/registry.js";
import { enableCardEffects } from "../service-cards.js";

// ── Force & Activation ──
const UD_FORCE = defineConstants(
  "modes.upsideForce",
  {
    COOLDOWN: {
      value: 300,
      min: 50,
      max: 1000,
      step: 10,
      description: "Milliseconds between accepted overscroll hits",
    },
    FORCE_PER_HIT: {
      value: 0.05,
      min: 0.01,
      max: 0.2,
      step: 0.005,
      description: "Force added per accepted hit (0–1 scale)",
    },
    FORCE_RETURN_MUL: {
      value: 2,
      min: 1,
      max: 5,
      step: 0.5,
      description: "Force multiplier when deactivating",
    },
    WARNING_AT: {
      value: 0.6,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Force threshold to show warning overlay",
    },
    WARNING_MIN_MS: {
      value: 2000,
      min: 500,
      max: 5000,
      step: 100,
      description: "Minimum time warning must display before flip",
    },
    WARNING_HIDE_OFFSET: {
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.05,
      description: "Force drop below warning threshold to hide it",
    },
    DRAIN_BASE: {
      value: 0.0015,
      min: 0,
      max: 0.01,
      step: 0.0001,
      description: "Base force drain per frame at 60fps",
    },
    DRAIN_FORCE_SCALE: {
      value: 0.00075,
      min: 0,
      max: 0.005,
      step: 0.0001,
      description: "Drain reduction at high force",
    },
    EDGE_TOLERANCE: {
      value: 30,
      min: 5,
      max: 100,
      step: 5,
      description: "Pixels from scroll boundary to count as edge",
    },
    TOUCH_DRAG_THRESHOLD: {
      value: 60,
      min: 20,
      max: 200,
      step: 10,
      description: "Touch drag distance to register a hit",
    },
  },
  { mode: "upside-down" },
);

// ── Visual Effects ──
const UD_VFX = defineConstants(
  "modes.upsideVisuals",
  {
    SHAKE_THRESHOLD: {
      value: 0.2,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Force level where screen shake begins",
    },
    SHAKE_INTENSITY: {
      value: 6,
      min: 0,
      max: 20,
      step: 1,
      description: "Maximum screen shake in pixels",
    },
    VIGNETTE_THRESHOLD: {
      value: 0.01,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Force level where red vignette appears",
    },
    VIGNETTE_MAX_OPACITY: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Maximum vignette opacity at warning threshold",
    },
    WARNING_HIDE_DELAY: {
      value: 300,
      min: 0,
      max: 1000,
      step: 50,
      description: "Warning fade-out duration in milliseconds",
    },
    WIPE_PHASE_MS: {
      value: 500,
      min: 100,
      max: 2000,
      step: 50,
      description: "Duration of wipe animation phase",
    },
    WIPE_SETTLE_MS: {
      value: 550,
      min: 100,
      max: 2000,
      step: 50,
      description: "Settle time before state changes",
    },
    FPS_BASELINE_MS: {
      value: 16.667,
      min: 8,
      max: 33,
      step: 0.001,
      description: "Frame normalization baseline (16.667 = 60fps)",
    },
  },
  { mode: "upside-down" },
);

// ── Non-numeric constants ──
const VIGNETTE_INNER_STOP = "30%";
const VIGNETTE_COLOR = [180, 0, 0];

export function initUpsideDown() {
  let force = 0;
  let isFlipped = false;
  let isTransitioning = false;
  let warningVisible = false;
  let lastForceTime = 0;
  let warningShowTime = 0;
  let lastEdgeWasBottom = true;
  let disableCardUpside = null;

  const pageEl = document.querySelector(".page");
  const navEl = document.querySelector("nav");

  // Red vignette overlay
  const overlay = document.createElement("div");
  overlay.className = "ud-overlay";
  document.body.appendChild(overlay);

  function updateVisuals() {
    // Red vignette intensity
    const intensity = Math.min(1, force / UD_FORCE.WARNING_AT);
    overlay.style.background =
      force > UD_VFX.VIGNETTE_THRESHOLD
        ? `radial-gradient(ellipse at center, transparent ${VIGNETTE_INNER_STOP}, rgba(${VIGNETTE_COLOR},${intensity * UD_VFX.VIGNETTE_MAX_OPACITY}) 100%)`
        : "none";

    // Screen shake on .page
    if (force > UD_VFX.SHAKE_THRESHOLD && !isTransitioning) {
      const shake = force * UD_VFX.SHAKE_INTENSITY;
      const dx = (Math.random() - 0.5) * shake;
      const dy = (Math.random() - 0.5) * shake;
      pageEl.style.translate = `${dx}px ${dy}px`;
    } else if (!isTransitioning) {
      pageEl.style.translate = "";
    }
  }

  function showWarning() {
    if (warningVisible) return;
    warningVisible = true;
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "upside-down-warning" },
      }),
    );
    const el = document.createElement("div");
    el.className = "ud-warning";
    el.id = "ud-warning";
    const title = isFlipped ? "THE RIFT IS REOPENING" : "THE WALL IS CRACKING";
    const sub = isFlipped
      ? "You are clawing your way back to the surface."
      : "You are approaching the boundary between worlds.";
    const hint = isFlipped
      ? "Keep scrolling to break free\u2026"
      : "Keep scrolling to break through\u2026 or stop while you can.";
    el.innerHTML = `
      <div class="ud-warning-content">
        <p class="ud-warning-icon">\u26A0</p>
        <h2 class="ud-warning-title">${title}</h2>
        <p class="ud-warning-sub">${sub}</p>
        <p class="ud-warning-hint">${hint}</p>
      </div>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    warningShowTime = Date.now();
  }

  function hideWarning() {
    warningVisible = false;
    const el = document.getElementById("ud-warning");
    if (!el) return;
    el.classList.remove("visible");
    setTimeout(() => el.remove(), UD_VFX.WARNING_HIDE_DELAY);
  }

  function triggerFlip() {
    if (isTransitioning) return;
    isTransitioning = true;
    hideWarning();
    force = 0;

    const entering = !isFlipped;
    // Wipe direction: from bottom if triggered at bottom edge, from top if at top edge
    const wipeFromBottom = lastEdgeWasBottom;

    // Dark wipe — sweeps across the screen in the direction of travel
    const wipe = document.createElement("div");
    wipe.className = "ud-wipe" + (entering ? "" : " ud-wipe-return");
    wipe.style.transform = wipeFromBottom
      ? "translateY(100%)"
      : "translateY(-100%)";
    document.body.appendChild(wipe);
    void wipe.offsetHeight;

    // Phase 1: Wipe covers the screen
    wipe.style.transition = `transform ${UD_VFX.WIPE_PHASE_MS / 1000}s ease-in`;
    wipe.style.transform = "translateY(0)";

    // Phase 2: Swap state while fully covered
    setTimeout(() => {
      isFlipped = !isFlipped;
      document.body.classList.toggle("upside-down", isFlipped);
      if (isFlipped) document.body.dataset.lastSubmode = "upside-down";
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: {
            type: isFlipped ? "mode-activate" : "mode-deactivate",
            mode: "upside-down",
          },
        }),
      );
      pageEl.style.translate = "";
      overlay.style.background = "none";

      if (isFlipped) {
        disableCardUpside = enableCardEffects({
          className: "upside-card",
          tilt: { intensity: 8, scale: 1.02, invertY: true },
        });
        document.body.appendChild(navEl);
        window.scrollTo(0, 0);
      } else {
        if (disableCardUpside) disableCardUpside();
        pageEl.insertBefore(navEl, pageEl.firstChild);
        // Bottom edge → land on top (mirror of where we left), top edge → land on bottom
        window.scrollTo(
          0,
          wipeFromBottom ? 0 : document.documentElement.scrollHeight,
        );
      }

      // Phase 3: Wipe continues through, revealing the new world
      requestAnimationFrame(() => {
        wipe.style.transition = `transform ${UD_VFX.WIPE_PHASE_MS / 1000}s ease-out`;
        wipe.style.transform = wipeFromBottom
          ? "translateY(-100%)"
          : "translateY(100%)";

        setTimeout(() => {
          wipe.remove();
          isTransitioning = false;
        }, UD_VFX.WIPE_SETTLE_MS);
      });
    }, UD_VFX.WIPE_SETTLE_MS);
  }

  // Track overscroll at the bottom of the page.
  // Cooldown ensures a single trackpad swipe (many rapid events) counts as one hit.
  window.addEventListener(
    "wheel",
    (e) => {
      if (isTransitioning) return;

      const scrollTop = window.scrollY;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const atBottom =
        scrollTop >= maxScroll - UD_FORCE.EDGE_TOLERANCE && e.deltaY > 0;
      const atTop = scrollTop <= UD_FORCE.EDGE_TOLERANCE && e.deltaY < 0;
      const atEdge = isFlipped ? atBottom || atTop : atBottom;

      if (atEdge) {
        const now = Date.now();
        if (now - lastForceTime < UD_FORCE.COOLDOWN) return;
        lastForceTime = now;
        lastEdgeWasBottom = atBottom;

        force = Math.min(
          1,
          force +
            (isFlipped
              ? UD_FORCE.FORCE_PER_HIT * UD_FORCE.FORCE_RETURN_MUL
              : UD_FORCE.FORCE_PER_HIT),
        );
        updateVisuals();

        if (force >= UD_FORCE.WARNING_AT && !warningVisible) {
          showWarning();
        }
        if (
          force >= 1.0 &&
          warningVisible &&
          now - warningShowTime >= UD_FORCE.WARNING_MIN_MS
        ) {
          triggerFlip();
        }
      }
    },
    { passive: true },
  );

  // Touch support — detect overscroll via touch drag at the scroll boundary.
  // Only uses bottom-edge detection to avoid conflicting with pull-to-refresh.
  let touchStartY = 0;
  let touchAccum = 0;

  window.addEventListener(
    "touchstart",
    (e) => {
      touchStartY = e.touches[0].clientY;
      touchAccum = 0;
    },
    { passive: true },
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (isTransitioning) return;

      const scrollTop = window.scrollY;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const atBottom = scrollTop >= maxScroll - UD_FORCE.EDGE_TOLERANCE;

      if (!atBottom) {
        touchAccum = 0;
        return;
      }

      const touchY = e.touches[0].clientY;
      const delta = touchStartY - touchY; // positive = dragging up = scrolling down
      if (delta <= 0) {
        touchAccum = 0;
        return;
      }

      // Accumulate drag distance, apply force in chunks matching desktop feel
      touchAccum += delta;
      touchStartY = touchY;

      const now = Date.now();
      if (
        touchAccum > UD_FORCE.TOUCH_DRAG_THRESHOLD &&
        now - lastForceTime >= UD_FORCE.COOLDOWN
      ) {
        lastForceTime = now;
        lastEdgeWasBottom = true;
        touchAccum = 0;

        force = Math.min(
          1,
          force +
            (isFlipped
              ? UD_FORCE.FORCE_PER_HIT * UD_FORCE.FORCE_RETURN_MUL
              : UD_FORCE.FORCE_PER_HIT),
        );
        updateVisuals();

        if (force >= UD_FORCE.WARNING_AT && !warningVisible) {
          showWarning();
        }
        if (
          force >= 1.0 &&
          warningVisible &&
          now - warningShowTime >= UD_FORCE.WARNING_MIN_MS
        ) {
          triggerFlip();
        }
      }
    },
    { passive: true },
  );

  // Dynamic drain — fast at low force (early damage clears quickly),
  // slow at high force (sustained effort is rewarded, warning sticks around).
  // Time-based so drain rate is consistent regardless of browser FPS.
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / UD_VFX.FPS_BASELINE_MS; // normalize to 60fps baseline
    lastTick = now;
    if (force > 0 && !isTransitioning) {
      const drain =
        (UD_FORCE.DRAIN_BASE - force * UD_FORCE.DRAIN_FORCE_SCALE) * dt;
      force = Math.max(0, force - drain);
      if (
        force < UD_FORCE.WARNING_AT - UD_FORCE.WARNING_HIDE_OFFSET &&
        warningVisible
      )
        hideWarning();
      updateVisuals();
    }
    requestAnimationFrame(tick);
  }
  tick();
}
