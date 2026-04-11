export function initUpsideDown() {
  let force = 0;
  let isFlipped = false;
  let isTransitioning = false;
  let warningVisible = false;
  let lastForceTime = 0;
  let warningShowTime = 0;

  // Tuning — each accepted hit adds a fixed chunk, with a cooldown between hits
  // so a single trackpad swipe (dozens of rapid events) only counts once.
  // Linear drain runs constantly, so you need sustained aggressive scrolling.
  const COOLDOWN = 300;        // ms — long enough that trackpad momentum counts as ~4 hits, not 15
  const FORCE_PER_HIT = 0.05;  // each accepted hit adds 5%
  const WARNING_AT = 0.6;
  const WARNING_MIN_MS = 2000; // warning must be visible 2s before flip

  const pageEl = document.querySelector('.page');
  const navEl = document.querySelector('nav');

  // Red vignette overlay
  const overlay = document.createElement('div');
  overlay.className = 'ud-overlay';
  document.body.appendChild(overlay);

  function updateVisuals() {
    // Red vignette intensity
    const intensity = Math.min(1, force / WARNING_AT);
    overlay.style.background = force > 0.01
      ? `radial-gradient(ellipse at center, transparent 30%, rgba(180,0,0,${intensity * 0.5}) 100%)`
      : 'none';

    // Screen shake on .page — compose with flip transform
    if (force > 0.2 && !isTransitioning) {
      const shake = force * 6;
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
    setTimeout(() => el.remove(), 300);
  }

  function triggerFlip() {
    if (isTransitioning) return;
    isTransitioning = true;
    hideWarning();
    force = 0;

    const entering = !isFlipped;

    // Flash — red entering, blue returning
    const flash = document.createElement('div');
    flash.className = entering ? 'ud-flash' : 'ud-flash ud-flash-return';
    document.body.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add('active'));

    // Phase 1: Collapse page through the portal
    pageEl.style.transform = isFlipped ? 'scaleY(-1)' : 'scaleY(1)';
    void pageEl.offsetHeight;
    pageEl.style.transition = 'transform 0.4s ease-in';
    pageEl.style.transform = 'scaleY(0)';

    // Phase 2: At midpoint, switch state while page is invisible
    setTimeout(() => {
      pageEl.style.transition = 'none';
      isFlipped = !isFlipped;
      document.body.classList.toggle('upside-down', isFlipped);
      overlay.style.background = 'none';

      // Move nav out of / back into .page
      if (isFlipped) {
        document.body.appendChild(navEl);
        window.scrollTo(0, 0);
      } else {
        pageEl.insertBefore(navEl, pageEl.firstChild);
        window.scrollTo(0, document.documentElement.scrollHeight);
      }

      // Phase 3: Expand from portal into the new world
      pageEl.style.transform = 'scaleY(0)';
      void pageEl.offsetHeight;
      pageEl.style.transition = 'transform 0.4s ease-out';
      pageEl.style.transform = isFlipped ? 'scaleY(-1)' : 'scaleY(1)';

      setTimeout(() => {
        pageEl.style.transition = '';
        pageEl.style.transform = isFlipped ? 'scaleY(-1)' : '';
        flash.remove();
        isTransitioning = false;
      }, 450);
    }, 450);
  }

  // Track overscroll at the bottom of the page.
  // Cooldown ensures a single trackpad swipe (many rapid events) counts as one hit.
  window.addEventListener('wheel', e => {
    if (isTransitioning) return;

    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const atEdge = isFlipped
      ? scrollTop <= 30 && e.deltaY < 0              // upside-down: overscroll upward at top
      : scrollTop >= maxScroll - 30 && e.deltaY > 0;  // normal: overscroll downward at bottom

    if (atEdge) {
      const now = Date.now();
      if (now - lastForceTime < COOLDOWN) return;
      lastForceTime = now;

      force = Math.min(1, force + (isFlipped ? FORCE_PER_HIT * 2 : FORCE_PER_HIT));
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
    const dt = (now - lastTick) / 16.667; // normalize to 60fps baseline
    lastTick = now;
    if (force > 0 && !isTransitioning) {
      const drain = (0.0015 - force * 0.00075) * dt;
      force = Math.max(0, force - drain);
      if (force < WARNING_AT - 0.1 && warningVisible) hideWarning();
      updateVisuals();
    }
    requestAnimationFrame(tick);
  }
  tick();
}
