export function initDeepSea() {
  // ── Trigger tuning ──
  const HOLD_TO_DIVE_MS = 10000;
  const HOLD_TO_SURFACE_MS = 5000;
  const DECAY_RATE = 0.15;          // force/sec after release

  // ── Indicator thresholds (fraction of 1.0) ──
  const WATER_CREEP_AT = 0.20;
  const COLOR_SHIFT_AT = 0.40;
  const VIGNETTE_AT = 0.60;

  // ── Ripple ring tuning ──
  const RIPPLE_INTERVAL_MS = 400;
  const RIPPLE_COUNT = 3;
  const RIPPLE_DURATION = 1200;
  const RIPPLE_MAX_SCALE = 3;

  let force = 0;
  let isSubmerged = false;
  let isTransitioning = false;
  let isHolding = false;
  let holdStartTime = 0;
  let rippleTimer = null;
  let holdX = 0;
  let holdY = 0;

  const canvasEl = document.getElementById('bg-canvas');
  const cloudSvg = document.querySelector('.cloud-svg');
  const logoEl = document.querySelector('.nav-logo');
  const footerEl = document.querySelector('footer');

  // ── Water creep overlay ──
  const waterOverlay = document.createElement('div');
  waterOverlay.className = 'deep-sea-overlay';
  document.body.appendChild(waterOverlay);

  // ── Pressure vignette overlay ──
  const vignetteOverlay = document.createElement('div');
  vignetteOverlay.className = 'deep-sea-vignette';
  document.body.appendChild(vignetteOverlay);

  // ── Helper: is pointer inside the footer strip? ──
  function inFooter(e) {
    if (!footerEl) return false;
    const rect = footerEl.getBoundingClientRect();
    return e.clientX >= rect.left && e.clientX <= rect.right &&
           e.clientY >= rect.top && e.clientY <= rect.bottom;
  }

  // ── 1. Ripple rings from cursor ──
  function spawnRipple(x, y) {
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const ring = document.createElement('div');
      ring.className = 'deep-sea-ripple';
      ring.style.left = x + 'px';
      ring.style.top = y + 'px';

      document.body.appendChild(ring);

      const delay = i * 150;
      ring.animate([
        { transform: 'translate(-50%,-50%) scale(0)', opacity: 0.6 },
        { transform: `translate(-50%,-50%) scale(${RIPPLE_MAX_SCALE})`, opacity: 0 }
      ], {
        duration: RIPPLE_DURATION,
        delay,
        easing: 'ease-out',
        fill: 'forwards'
      }).onfinish = () => ring.remove();
    }
  }

  function startRipples(x, y) {
    holdX = x;
    holdY = y;
    spawnRipple(x, y);
    rippleTimer = setInterval(() => spawnRipple(holdX, holdY), RIPPLE_INTERVAL_MS);
  }

  function stopRipples() {
    if (rippleTimer) {
      clearInterval(rippleTimer);
      rippleTimer = null;
    }
  }

  // ── 2. Screen-edge water creep ──
  function updateWaterCreep(progress) {
    if (progress < WATER_CREEP_AT) {
      waterOverlay.style.opacity = '0';
      return;
    }
    const t = Math.min(1, (progress - WATER_CREEP_AT) / (1 - WATER_CREEP_AT));
    waterOverlay.style.opacity = String(t);
    const size = 8 + t * 25;
    waterOverlay.style.setProperty('--water-size', size + '%');
  }

  // ── 3. Color temperature shift (canvas filter) ──
  function updateColorShift(progress) {
    if (document.body.classList.contains('upside-down') || document.body.classList.contains('frozen')) {
      canvasEl.style.filter = '';
      return;
    }
    if (progress < COLOR_SHIFT_AT) {
      canvasEl.style.filter = '';
      return;
    }
    const t = Math.min(1, (progress - COLOR_SHIFT_AT) / (1 - COLOR_SHIFT_AT));
    const hue = 360 - t * 50; // rotate toward teal: 360→310deg
    const sat = 1 + t * 0.4;
    const bri = 1 - t * 0.65;
    canvasEl.style.filter = `hue-rotate(${hue.toFixed(0)}deg) saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
  }

  // ── 4. Pressure vignette ──
  function updateVignette(progress) {
    if (progress < VIGNETTE_AT) {
      vignetteOverlay.style.opacity = '0';
      return;
    }
    const t = Math.min(1, (progress - VIGNETTE_AT) / (1 - VIGNETTE_AT));
    vignetteOverlay.style.opacity = String(t * 0.7);
  }

  // ── 5. Light extinction (further brightness drop) ──
  // Handled within updateColorShift — the brightness drops to 0.35 at force=1.0

  // ── Update all indicators ──
  function updateVisuals() {
    updateWaterCreep(force);
    updateColorShift(force);
    updateVignette(force);
  }

  // ── Clear all indicators ──
  function clearIndicators() {
    force = 0;
    waterOverlay.style.opacity = '0';
    vignetteOverlay.style.opacity = '0';
    canvasEl.style.filter = '';
  }

  // ── Card caustic interactions ──
  function enableCardCaustics() {
    document.querySelectorAll('.service-card').forEach(card => {
      card.classList.add('caustic-card');
      card.addEventListener('mousemove', cardMouseMove);
      card.addEventListener('mouseleave', cardMouseLeave);
    });
  }

  function disableCardCaustics() {
    document.querySelectorAll('.service-card').forEach(card => {
      card.classList.remove('caustic-card');
      card.style.removeProperty('--caustic-x');
      card.style.removeProperty('--caustic-y');
      card.removeEventListener('mousemove', cardMouseMove);
      card.removeEventListener('mouseleave', cardMouseLeave);
    });
  }

  function cardMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--caustic-x', ((e.clientX - rect.left) / rect.width * 100) + '%');
    e.currentTarget.style.setProperty('--caustic-y', ((e.clientY - rect.top) / rect.height * 100) + '%');
  }

  function cardMouseLeave(e) {
    e.currentTarget.style.removeProperty('--caustic-x');
    e.currentTarget.style.removeProperty('--caustic-y');
  }

  // ── Dive transition ──
  function triggerDive() {
    if (isTransitioning) return;
    isTransitioning = true;

    const wipe = document.createElement('div');
    wipe.className = 'deep-sea-wipe';
    document.body.appendChild(wipe);
    void wipe.offsetHeight;

    wipe.style.opacity = '1';

    setTimeout(() => {
      isSubmerged = true;
      document.body.classList.add('deep-sea');
      document.body.dataset.lastSubmode = 'deep-sea';
      clearIndicators();
      enableCardCaustics();

      requestAnimationFrame(() => {
        wipe.style.opacity = '0';
        setTimeout(() => {
          wipe.remove();
          isTransitioning = false;
        }, 600);
      });
    }, 400);
  }

  // ── Resurface transition ──
  function triggerResurface() {
    if (isTransitioning) return;
    isTransitioning = true;

    const wipe = document.createElement('div');
    wipe.className = 'deep-sea-wipe resurface';
    document.body.appendChild(wipe);
    void wipe.offsetHeight;

    wipe.style.opacity = '1';

    setTimeout(() => {
      isSubmerged = false;
      document.body.classList.remove('deep-sea');
      clearIndicators();
      disableCardCaustics();

      requestAnimationFrame(() => {
        wipe.style.opacity = '0';
        setTimeout(() => {
          wipe.remove();
          isTransitioning = false;
        }, 600);
      });
    }, 400);
  }

  // ── Hold detection via pointer events ──
  function onPointerDown(e) {
    if (isTransitioning || !inFooter(e)) return;

    isHolding = true;
    holdStartTime = performance.now();
    holdX = e.clientX;
    holdY = e.clientY;
    startRipples(e.clientX, e.clientY);
    updateHold();
  }

  function onPointerMove(e) {
    if (!isHolding) return;
    holdX = e.clientX;
    holdY = e.clientY;
  }

  function onPointerUp() {
    if (!isHolding) return;
    isHolding = false;
    stopRipples();
  }

  function updateHold() {
    if (!isHolding || isTransitioning) return;

    const elapsed = performance.now() - holdStartTime;
    const target = isSubmerged ? HOLD_TO_SURFACE_MS : HOLD_TO_DIVE_MS;
    force = Math.min(1, elapsed / target);

    updateVisuals();

    if (force >= 1.0) {
      isHolding = false;
      stopRipples();
      if (isSubmerged) {
        triggerResurface();
      } else {
        triggerDive();
      }
      return;
    }

    requestAnimationFrame(updateHold);
  }

  // ── Decay loop — force drains when not holding ──
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    if (!isHolding && force > 0 && !isTransitioning) {
      force = Math.max(0, force - DECAY_RATE * dt);
      updateVisuals();
    }
    requestAnimationFrame(tick);
  }
  tick();

  // ── Bind events ──
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);

  // Touch fallback — after the browser takes over a touch for scrolling it fires
  // pointercancel and stops sending pointermove/pointerup.  Touch events still
  // fire though, so we use touchmove to keep tracking the finger and touchend
  // to release.  On desktop these never fire so there's no impact.
  document.addEventListener('touchmove', e => {
    if (!isHolding || !e.touches.length) return;
    holdX = e.touches[0].clientX;
    holdY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (isHolding) onPointerUp();
  });
}
