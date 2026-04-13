const RING_EASING = 0.12;
const DOT_SIZE_DEFAULT = 12;
const DOT_SIZE_HOVER = 6;
const RING_SIZE_DEFAULT = 36;
const RING_SIZE_HOVER = 52;

export function initCursor(dotEl, ringEl) {
  if (!dotEl || !ringEl) return;

  let mx = 0, my = 0, rx = 0, ry = 0;

  function setPos(el, x, y) {
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    setPos(dotEl, mx, my);
    if (!dotEl.classList.contains('visible')) {
      rx = mx; ry = my;
      setPos(ringEl, rx, ry);
      dotEl.classList.add('visible');
      ringEl.classList.add('visible');
    }
  });

  function animRing() {
    rx += (mx - rx) * RING_EASING;
    ry += (my - ry) * RING_EASING;
    setPos(ringEl, rx, ry);
    requestAnimationFrame(animRing);
  }
  animRing();

  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => {
      dotEl.style.width = `${DOT_SIZE_HOVER}px`;
      dotEl.style.height = `${DOT_SIZE_HOVER}px`;
      ringEl.style.width = `${RING_SIZE_HOVER}px`;
      ringEl.style.height = `${RING_SIZE_HOVER}px`;
    });
    el.addEventListener('mouseleave', () => {
      dotEl.style.width = `${DOT_SIZE_DEFAULT}px`;
      dotEl.style.height = `${DOT_SIZE_DEFAULT}px`;
      ringEl.style.width = `${RING_SIZE_DEFAULT}px`;
      ringEl.style.height = `${RING_SIZE_DEFAULT}px`;
    });
  });
}
