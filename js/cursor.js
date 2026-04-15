import { defineConstants } from "./dev/registry.js";

const C = defineConstants("cursor", {
  RING_EASING: 0.12,
  RING_EASING_SNAP: 1,
  DOT_SIZE_DEFAULT: 12,
  DOT_SIZE_HOVER: 6,
  DOT_SIZE_PRESS: 16,
  DOT_SIZE_HOVER_PRESS: 10,
  RING_SIZE_DEFAULT: 36,
  RING_SIZE_HOVER: 52,
  RING_SIZE_PRESS: 20,
  RING_SIZE_HOVER_PRESS: 32,
});

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
    const ease = overNativeCursor ? C.RING_EASING_SNAP : C.RING_EASING;
    rx += (mx - rx) * ease;
    ry += (my - ry) * ease;
    setPos(ringEl, rx, ry);
    requestAnimationFrame(animRing);
  }
  animRing();

  function applySizes() {
    const dotSize = pressing
      ? hovering
        ? C.DOT_SIZE_HOVER_PRESS
        : C.DOT_SIZE_PRESS
      : hovering
        ? C.DOT_SIZE_HOVER
        : C.DOT_SIZE_DEFAULT;
    const ringSize = pressing
      ? hovering
        ? C.RING_SIZE_HOVER_PRESS
        : C.RING_SIZE_PRESS
      : hovering
        ? C.RING_SIZE_HOVER
        : C.RING_SIZE_DEFAULT;
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
