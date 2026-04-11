export function initCursor(dotEl, ringEl) {
  if (!dotEl || !ringEl) return;

  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dotEl.style.left = mx + 'px';
    dotEl.style.top = my + 'px';
    if (!dotEl.classList.contains('visible')) {
      rx = mx; ry = my;
      ringEl.style.left = rx + 'px';
      ringEl.style.top = ry + 'px';
      dotEl.classList.add('visible');
      ringEl.classList.add('visible');
    }
  });

  function animRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ringEl.style.left = rx + 'px';
    ringEl.style.top = ry + 'px';
    requestAnimationFrame(animRing);
  }
  animRing();

  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => {
      dotEl.style.width = '6px';
      dotEl.style.height = '6px';
      ringEl.style.width = '52px';
      ringEl.style.height = '52px';
    });
    el.addEventListener('mouseleave', () => {
      dotEl.style.width = '12px';
      dotEl.style.height = '12px';
      ringEl.style.width = '36px';
      ringEl.style.height = '36px';
    });
  });
}
