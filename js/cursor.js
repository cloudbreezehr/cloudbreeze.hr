import { defineConstants } from "./dev/registry.js";

const C = defineConstants("cursor", {
  RING_EASING: {
    value: 0.12,
    min: 0.01,
    max: 1,
    step: 0.01,
    description: "Ring follow easing (lower = laggier trail)",
  },
  RING_EASING_SNAP: {
    value: 1,
    min: 0.01,
    max: 1,
    step: 0.01,
    description: "Ring easing when snapping straight to the pointer",
  },
  RING_SETTLE_EPSILON_PX: {
    value: 0.5,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Remaining ring distance below which the follow loop rests",
  },
  DOT_SIZE_DEFAULT: {
    value: 12,
    min: 2,
    max: 40,
    step: 1,
    description: "Cursor dot diameter at rest (px)",
  },
  DOT_SIZE_HOVER: {
    value: 6,
    min: 2,
    max: 40,
    step: 1,
    description: "Cursor dot diameter over a clickable (px)",
  },
  DOT_SIZE_PRESS: {
    value: 16,
    min: 2,
    max: 40,
    step: 1,
    description: "Cursor dot diameter while pressing (px)",
  },
  DOT_SIZE_HOVER_PRESS: {
    value: 10,
    min: 2,
    max: 40,
    step: 1,
    description: "Cursor dot diameter pressing over a clickable (px)",
  },
  RING_SIZE_DEFAULT: {
    value: 36,
    min: 8,
    max: 100,
    step: 1,
    description: "Cursor ring diameter at rest (px)",
  },
  RING_SIZE_HOVER: {
    value: 52,
    min: 8,
    max: 100,
    step: 1,
    description: "Cursor ring diameter over a clickable (px)",
  },
  RING_SIZE_PRESS: {
    value: 20,
    min: 8,
    max: 100,
    step: 1,
    description: "Cursor ring diameter while pressing (px)",
  },
  RING_SIZE_HOVER_PRESS: {
    value: 32,
    min: 8,
    max: 100,
    step: 1,
    description: "Cursor ring diameter pressing over a clickable (px)",
  },
});

const NATIVE_CURSOR_SELECTOR = ".dev-console";
// Anything the user can click — native button/anchor semantics plus
// `role="button"` so non-button clickable elements join the set without
// a per-element opt-in here.
const CLICKABLE_SELECTOR = 'a, button, [role="button"]';

export function initCursor(dotEl, ringEl) {
  if (!dotEl || !ringEl) return;

  let mx = 0,
    my = 0,
    rx = 0,
    ry = 0;
  let hovering = false;
  let pressing = false;
  let overNativeCursor = false;

  // The dot and ring inherit their size vars from this wrapper. Writing them
  // here (not :root) confines the transition's per-frame recompute of these
  // inherited registered properties to the cursor subtree.
  const sizeHost = dotEl.parentElement || document.documentElement;

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
      document.body.classList.add("has-custom-cursor");
    }
    armRing();
  });

  // Hide the custom cursor when the pointer leaves the window, so it exits
  // with the pointer instead of freezing at the last edge it touched. The
  // next mousemove on re-entry re-shows it and snaps the ring to the entry
  // point (the block above).
  function hideCursor() {
    dotEl.classList.remove("visible");
    ringEl.classList.remove("visible");
  }

  // The ring chases the pointer only while there's distance left to close.
  // Below the settle epsilon it snaps and the loop suspends — a resting
  // pointer costs no frames, and a touch-only device (which never fires
  // mousemove) never starts the loop at all.
  let ringRafId = null;
  function animRing() {
    ringRafId = null;
    const ease = overNativeCursor ? C.RING_EASING_SNAP : C.RING_EASING;
    rx += (mx - rx) * ease;
    ry += (my - ry) * ease;
    if (
      Math.abs(mx - rx) < C.RING_SETTLE_EPSILON_PX &&
      Math.abs(my - ry) < C.RING_SETTLE_EPSILON_PX
    ) {
      rx = mx;
      ry = my;
      setPos(ringEl, rx, ry);
      return;
    }
    setPos(ringEl, rx, ry);
    ringRafId = requestAnimationFrame(animRing);
  }
  function armRing() {
    if (ringRafId == null) ringRafId = requestAnimationFrame(animRing);
  }

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
    // Publish via custom properties so idle animations that depend on
    // ring/dot geometry (pendulum, metronome, yo-yo) stay in sync as
    // sizes transition.
    sizeHost.style.setProperty("--cursor-dot-size", `${dotSize}px`);
    sizeHost.style.setProperty("--cursor-ring-size", `${ringSize}px`);
  }

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(CLICKABLE_SELECTOR)) {
      hovering = true;
      applySizes();
    }
    if (e.target.closest(NATIVE_CURSOR_SELECTOR)) {
      overNativeCursor = true;
      dotEl.style.opacity = "0";
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(CLICKABLE_SELECTOR)) {
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
    // A null relatedTarget means the pointer left the document entirely.
    if (!e.relatedTarget) hideCursor();
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

  // After a click, the element under the cursor may have been removed or
  // swapped (a button dismissing a list row, a modal closing, etc.).
  // mouseout doesn't fire for vanished elements, so the hover-expanded state
  // gets stuck on a cursor sitting over empty space.  Re-check on the next
  // frame whether we're still over a focusable control.  Registered in the
  // capture phase so inner-handler stopPropagation can't suppress it.
  document.addEventListener(
    "click",
    () => {
      requestAnimationFrame(() => {
        const el = document.elementFromPoint(mx, my);
        const nowHovering = !!el?.closest(CLICKABLE_SELECTOR);
        if (nowHovering !== hovering) {
          hovering = nowHovering;
          applySizes();
        }
      });
    },
    true,
  );
}
