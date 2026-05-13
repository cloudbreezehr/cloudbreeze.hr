// ── Scroll + Highlight ──
// Smoothly scroll an element into the centre of its scroll container and
// flash the `shine` highlight class on it.  The highlight is deferred
// until the scroll genuinely settles so the animation is always visible
// regardless of how far the element had to travel — without this, a long
// smooth scroll burns the animation off-screen before the user can see it.

const HIGHLIGHT_CLASS = "shine";

// Number of consecutive frames `scrollTop` must hold steady for us to
// declare the smooth scroll finished.  Two frames covers the off-by-one
// where a paused-on-target scroller produces an identical reading
// because the next tick simply hasn't applied the increment yet.
const SETTLED_FRAMES = 2;

// How long to wait at the start of polling for the smooth scroll to
// actually begin moving the scroller.  Smooth scrolls don't necessarily
// commit a position change on the very first rAF after the call, so
// polling without this grace period can mistake "not started yet" for
// "finished".  If no movement is seen in this window, the scroller
// genuinely isn't going to move (already centred, blocked, or the
// browser ignored the request) and we treat it as settled.
const SCROLL_START_GRACE_MS = 100;

// Hard cap on how long we'll wait for the scroll to settle once it has
// started moving.  Bounds the wait when a scroll is interrupted or
// programmatically overridden so the highlight is never stranded.
const SCROLL_SETTLE_TIMEOUT_MS = 2000;

// Beat between the scroll settling (or being unnecessary) and the
// highlight starting.  Without this the animation reads as part of the
// scroll itself and feels rushed; the small delay turns it into a
// distinct "here it is" cue.
export const POST_SETTLE_DELAY_MS = 150;

export function scrollAndHighlight(el) {
  if (!el) return;

  const scroller = findScrollableAncestor(el);
  el.scrollIntoView({ behavior: "smooth", block: "center" });

  if (!scroller) {
    setTimeout(() => applyHighlight(el), POST_SETTLE_DELAY_MS);
    return;
  }

  waitForScrollSettle(scroller, () => {
    setTimeout(() => applyHighlight(el), POST_SETTLE_DELAY_MS);
  });
}

// Poll scrollTop on every animation frame.  Settle detection has two
// phases: first wait for movement to start (smooth scroll commits its
// first delta), then wait for SETTLED_FRAMES consecutive identical
// readings.  The grace window before movement bounds the "already
// centred / blocked" case; the timeout after movement bounds the
// "interrupted mid-scroll" case.
function waitForScrollSettle(scroller, done) {
  const start = performance.now();
  const startTop = scroller.scrollTop;
  let lastTop = startTop;
  let stableFrames = 0;
  let movementSeen = false;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    done();
  };

  const tick = () => {
    if (finished) return;
    const top = scroller.scrollTop;
    const elapsed = performance.now() - start;

    if (top !== lastTop) {
      movementSeen = true;
      stableFrames = 0;
      lastTop = top;
    } else if (movementSeen) {
      stableFrames++;
      if (stableFrames >= SETTLED_FRAMES) {
        finish();
        return;
      }
    } else if (elapsed >= SCROLL_START_GRACE_MS) {
      // Smooth scroll never moved — already centred, or browser
      // ignored the request.  Either way, nothing left to wait for.
      finish();
      return;
    }

    if (movementSeen && elapsed >= SCROLL_SETTLE_TIMEOUT_MS) {
      finish();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function applyHighlight(el) {
  el.classList.remove(HIGHLIGHT_CLASS);
  // Force a reflow so the browser commits the class removal before the
  // re-add — otherwise the animation doesn't restart on consecutive calls.
  void el.offsetHeight;
  el.classList.add(HIGHLIGHT_CLASS);
  el.addEventListener(
    "animationend",
    () => el.classList.remove(HIGHLIGHT_CLASS),
    { once: true },
  );
}

function findScrollableAncestor(el) {
  let p = el.parentElement;
  while (p) {
    const overflowY = getComputedStyle(p).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return p;
    p = p.parentElement;
  }
  return null;
}
