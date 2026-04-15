const RING_EASING = 0.12;
const RING_EASING_SNAP = 1;
const DOT_SIZE_DEFAULT = 12;
const DOT_SIZE_HOVER = 6;
const DOT_SIZE_PRESS = 16;
const DOT_SIZE_HOVER_PRESS = 10;
const RING_SIZE_DEFAULT = 36;
const RING_SIZE_HOVER = 52;
const RING_SIZE_PRESS = 20;
const RING_SIZE_HOVER_PRESS = 32;
const NATIVE_CURSOR_SELECTOR = ".dev-console";

export function initCursor(dotEl, ringEl) {
  if (!dotEl || !ringEl) return;

  let mx = 0,
    my = 0,
    rx = 0,
    ry = 0;
  let hovering = false;
  let pressing = false;
  let overNativeCursor = false;

  function setPos(el, x, y) {
    el.style.translate = `calc(${x}px - 50%) calc(${y}px - 50%)`;
  }

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
    setPos(dotEl, mx, my);
    if (!dotEl.classList.contains("visible")) {
      rx = mx;
      ry = my;
      setPos(ringEl, rx, ry);
      dotEl.classList.add("visible");
      ringEl.classList.add("visible");
    }
  });

  function animRing() {
    const ease = overNativeCursor ? RING_EASING_SNAP : RING_EASING;
    rx += (mx - rx) * ease;
    ry += (my - ry) * ease;
    setPos(ringEl, rx, ry);
    requestAnimationFrame(animRing);
  }
  animRing();

  function applySizes() {
    const dotSize = pressing
      ? hovering
        ? DOT_SIZE_HOVER_PRESS
        : DOT_SIZE_PRESS
      : hovering
        ? DOT_SIZE_HOVER
        : DOT_SIZE_DEFAULT;
    const ringSize = pressing
      ? hovering
        ? RING_SIZE_HOVER_PRESS
        : RING_SIZE_PRESS
      : hovering
        ? RING_SIZE_HOVER
        : RING_SIZE_DEFAULT;
    dotEl.style.width = `${dotSize}px`;
    dotEl.style.height = `${dotSize}px`;
    ringEl.style.width = `${ringSize}px`;
    ringEl.style.height = `${ringSize}px`;
  }

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest("a, button")) {
      hovering = true;
      applySizes();
    }
    if (e.target.closest(NATIVE_CURSOR_SELECTOR)) {
      overNativeCursor = true;
      dotEl.style.opacity = "0";
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest("a, button")) {
      hovering = false;
      applySizes();
    }
    if (
      e.target.closest(NATIVE_CURSOR_SELECTOR) &&
      !e.relatedTarget?.closest(NATIVE_CURSOR_SELECTOR)
    ) {
      overNativeCursor = false;
      dotEl.style.opacity = "";
    }
  });

  document.addEventListener("mousedown", () => {
    pressing = true;
    dotEl.classList.add("pressing");
    ringEl.classList.add("pressing");
    applySizes();
  });

  document.addEventListener("mouseup", () => {
    pressing = false;
    dotEl.classList.remove("pressing");
    ringEl.classList.remove("pressing");
    applySizes();
  });
}
