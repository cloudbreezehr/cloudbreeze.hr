export function initUpsideDown() {
  let force = 0;
  let isFlipped = false;
  let isTransitioning = false;
  let warningVisible = false;
  let lastForceTime = 0;
  let warningShowTime = 0;
  let lastEdgeWasBottom = true;

  // Tuning — each accepted hit adds a fixed chunk, with a cooldown between hits
  // so a single trackpad swipe (dozens of rapid events) only counts once.
  // Linear drain runs constantly, so you need sustained aggressive scrolling.
  const COOLDOWN = 300;        // ms — long enough that trackpad momentum counts as ~4 hits, not 15
  const FORCE_PER_HIT = 0.05;  // each accepted hit adds 5%
  const WARNING_AT = 0.6;
  const WARNING_MIN_MS = 2000; // warning must be visible 2s before flip

  const FORCE_RETURN_MUL = 2;
  const SHAKE_THRESHOLD = 0.2;
  const SHAKE_INTENSITY = 6;
  const VIGNETTE_THRESHOLD = 0.01;
  const VIGNETTE_MAX_OPACITY = 0.5;
  const VIGNETTE_INNER_STOP = '30%';
  const VIGNETTE_COLOR = [180, 0, 0];
  const WARNING_HIDE_DELAY = 300;
  const WIPE_PHASE_MS = 500;
  const WIPE_SETTLE_MS = 550;
  const DRAIN_BASE = 0.0015;
  const DRAIN_FORCE_SCALE = 0.00075;
  const WARNING_HIDE_BELOW = WARNING_AT - 0.1;
  const EDGE_TOLERANCE = 30;
  const TOUCH_DRAG_THRESHOLD = 60;
  const FPS_BASELINE_MS = 16.667;

  const pageEl = document.querySelector('.page');
  const navEl = document.querySelector('nav');

  // Red vignette overlay
  const overlay = document.createElement('div');
  overlay.className = 'ud-overlay';
  document.body.appendChild(overlay);

  function updateVisuals() {
    // Red vignette intensity
    const intensity = Math.min(1, force / WARNING_AT);
    overlay.style.background = force > VIGNETTE_THRESHOLD
      ? `radial-gradient(ellipse at center, transparent ${VIGNETTE_INNER_STOP}, rgba(${VIGNETTE_COLOR},${intensity * VIGNETTE_MAX_OPACITY}) 100%)`
      : 'none';

    // Screen shake on .page — compose with flip transform
    if (force > SHAKE_THRESHOLD && !isTransitioning) {
      const shake = force * SHAKE_INTENSITY;
      const dx = (Math.random() - 0.5) * shake;
      const dy = (Math.random() - 0.5) * shake;
      const base = isFlipped ? 'scaleY(-1) ' : '';
      pageEl.style.transform = `${base}translate(${dx}px, ${dy}px)`;
    } else if (!isTransitioning) {
      pageEl.style.transform = isFlipped ? 'scaleY(-1)' : '';
    }
  }

  function showWarning() {
    if (warningVisible) return;
    warningVisible = true;
    const el = document.createElement('div');
    el.className = 'ud-warning';
    el.id = 'ud-warning';
    const title = isFlipped ? 'THE RIFT IS REOPENING' : 'THE WALL IS CRACKING';
    const sub = isFlipped
      ? 'You are clawing your way back to the surface.'
      : 'You are approaching the boundary between worlds.';
    const hint = isFlipped
      ? 'Keep scrolling to break free\u2026'
      : 'Keep scrolling to break through\u2026 or stop while you can.';
    el.innerHTML = `
      <div class="ud-warning-content">
        <p class="ud-warning-icon">\u26A0</p>
        <h2 class="ud-warning-title">${title}</h2>
        <p class="ud-warning-sub">${sub}</p>
        <p class="ud-warning-hint">${hint}</p>
      </div>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    warningShowTime = Date.now();
  }

  function hideWarning() {
    warningVisible = false;
    const el = document.getElementById('ud-warning');
    if (!el) return;
    el.classList.remove('visible');
    setTimeout(() => el.remove(), WARNING_HIDE_DELAY);
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
    const wipe = document.createElement('div');
    wipe.className = 'ud-wipe' + (entering ? '' : ' ud-wipe-return');
    wipe.style.transform = wipeFromBottom ? 'translateY(100%)' : 'translateY(-100%)';
    document.body.appendChild(wipe);
    void wipe.offsetHeight;

    // Phase 1: Wipe covers the screen
    wipe.style.transition = `transform ${WIPE_PHASE_MS / 1000}s ease-in`;
    wipe.style.transform = 'translateY(0)';

    // Phase 2: Swap state while fully covered
    setTimeout(() => {
      isFlipped = !isFlipped;
      document.body.classList.toggle('upside-down', isFlipped);
      pageEl.style.transform = isFlipped ? 'scaleY(-1)' : '';
      overlay.style.background = 'none';

      if (isFlipped) {
        document.body.appendChild(navEl);
        window.scrollTo(0, 0);
      } else {
        pageEl.insertBefore(navEl, pageEl.firstChild);
        // Bottom edge → land on top (mirror of where we left), top edge → land on bottom
        window.scrollTo(0, wipeFromBottom ? 0 : document.documentElement.scrollHeight);
      }

      // Phase 3: Wipe continues through, revealing the new world
      requestAnimationFrame(() => {
        wipe.style.transition = `transform ${WIPE_PHASE_MS / 1000}s ease-out`;
        wipe.style.transform = wipeFromBottom ? 'translateY(-100%)' : 'translateY(100%)';

        setTimeout(() => {
          wipe.remove();
          isTransitioning = false;
        }, WIPE_SETTLE_MS);
      });
    }, WIPE_SETTLE_MS);
  }

  // Track overscroll at the bottom of the page.
  // Cooldown ensures a single trackpad swipe (many rapid events) counts as one hit.
  window.addEventListener('wheel', e => {
    if (isTransitioning) return;

    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const atBottom = scrollTop >= maxScroll - EDGE_TOLERANCE && e.deltaY > 0;
    const atTop = scrollTop <= EDGE_TOLERANCE && e.deltaY < 0;
    const atEdge = isFlipped ? (atBottom || atTop) : atBottom;

    if (atEdge) {
      const now = Date.now();
      if (now - lastForceTime < COOLDOWN) return;
      lastForceTime = now;
      lastEdgeWasBottom = atBottom;

      force = Math.min(1, force + (isFlipped ? FORCE_PER_HIT * FORCE_RETURN_MUL : FORCE_PER_HIT));
      updateVisuals();

      if (force >= WARNING_AT && !warningVisible) {
        showWarning();
      }
      if (force >= 1.0 && warningVisible && now - warningShowTime >= WARNING_MIN_MS) {
        triggerFlip();
      }
    }
  }, { passive: true });

  // Touch support — detect overscroll via touch drag at the scroll boundary.
  // Only uses bottom-edge detection to avoid conflicting with pull-to-refresh.
  let touchStartY = 0;
  let touchAccum = 0;

  window.addEventListener('touchstart', e => {
    touchStartY = e.touches[0].clientY;
    touchAccum = 0;
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    if (isTransitioning) return;

    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const atBottom = scrollTop >= maxScroll - EDGE_TOLERANCE;

    if (!atBottom) { touchAccum = 0; return; }

    const touchY = e.touches[0].clientY;
    const delta = touchStartY - touchY; // positive = dragging up = scrolling down
    if (delta <= 0) { touchAccum = 0; return; }

    // Accumulate drag distance, apply force in chunks matching desktop feel
    touchAccum += delta;
    touchStartY = touchY;

    const now = Date.now();
    if (touchAccum > TOUCH_DRAG_THRESHOLD && now - lastForceTime >= COOLDOWN) {
      lastForceTime = now;
      lastEdgeWasBottom = true;
      touchAccum = 0;

      force = Math.min(1, force + (isFlipped ? FORCE_PER_HIT * FORCE_RETURN_MUL : FORCE_PER_HIT));
      updateVisuals();

      if (force >= WARNING_AT && !warningVisible) {
        showWarning();
      }
      if (force >= 1.0 && warningVisible && now - warningShowTime >= WARNING_MIN_MS) {
        triggerFlip();
      }
    }
  }, { passive: true });

  // Dynamic drain — fast at low force (early damage clears quickly),
  // slow at high force (sustained effort is rewarded, warning sticks around).
  // Time-based so drain rate is consistent regardless of browser FPS.
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / FPS_BASELINE_MS; // normalize to 60fps baseline
    lastTick = now;
    if (force > 0 && !isTransitioning) {
      const drain = (DRAIN_BASE - force * DRAIN_FORCE_SCALE) * dt;
      force = Math.max(0, force - drain);
      if (force < WARNING_HIDE_BELOW && warningVisible) hideWarning();
      updateVisuals();
    }
    requestAnimationFrame(tick);
  }
  tick();
}
