export function initUpsideDown() {
  let force = 0;
  let isFlipped = false;
  let isTransitioning = false;
  let warningVisible = false;

  const pageEl = document.querySelector('.page');

  // Red vignette overlay
  const overlay = document.createElement('div');
  overlay.className = 'ud-overlay';
  document.body.appendChild(overlay);

  function updateVisuals() {
    // Red vignette intensity
    const intensity = Math.min(1, force / 0.7);
    overlay.style.background = force > 0.01
      ? `radial-gradient(ellipse at center, transparent 30%, rgba(180,0,0,${intensity * 0.5}) 100%)`
      : 'none';

    // Screen shake on .page — compose with flip transform
    if (force > 0.15 && !isTransitioning) {
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

    // Flash — red entering, blue returning
    const flash = document.createElement('div');
    flash.className = isFlipped ? 'ud-flash ud-flash-return' : 'ud-flash';
    document.body.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add('active'));

    setTimeout(() => {
      isFlipped = !isFlipped;
      document.body.classList.toggle('upside-down', isFlipped);
      pageEl.style.transform = isFlipped ? 'scaleY(-1)' : '';
      overlay.style.background = 'none';

      // Entering: start at top (footer visible — you fell through the floor)
      // Exiting: land at bottom (where you started)
      if (isFlipped) {
        window.scrollTo(0, 0);
      } else {
        window.scrollTo(0, document.documentElement.scrollHeight);
      }

      setTimeout(() => {
        flash.remove();
        isTransitioning = false;
      }, 500);
    }, 350);
  }

  // Track overscroll at the bottom of the page
  window.addEventListener('wheel', e => {
    if (isTransitioning) return;

    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const atBottom = scrollTop >= maxScroll - 5 && e.deltaY > 0;

    if (atBottom) {
      force += Math.min(Math.abs(e.deltaY), 150) * 0.0025;
      force = Math.min(1, force);
      updateVisuals();

      if (force > 0.7 && !warningVisible) {
        showWarning();
      }
      if (force >= 1.0) {
        triggerFlip();
      }
    }
  }, { passive: true });

  // Force decays over time — casual scrolling never accumulates enough
  function tick() {
    if (force > 0 && !isTransitioning) {
      force *= 0.97;
      if (force < 0.01) force = 0;
      if (force < 0.6 && warningVisible) hideWarning();
      updateVisuals();
    }
    requestAnimationFrame(tick);
  }
  tick();
}
