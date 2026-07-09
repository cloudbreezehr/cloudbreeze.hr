// ── Pointer events with automatic mobile touch fallback ──
//
// On mobile, browsers fire pointercancel when they capture the pointer for
// native gestures (scrolling, pull-to-refresh).  After that, pointermove and
// pointerup stop firing — but touch events keep working.  This helper binds
// both event sets so callers get seamless down/move/up callbacks on every
// platform without duplicating the fallback boilerplate.

/**
 * Bind pointer-down / move / up with automatic touch-event fallback.
 *
 * @param {EventTarget} target   Element to listen on (typically `document`).
 * @param {Object}      handlers
 * @param {function(number, number, PointerEvent): (false|void)} handlers.onDown
 *        Called on pointerdown with (clientX, clientY, event).
 *        Return `false` to ignore the event (tracking won't start).
 * @param {function(number, number): void} handlers.onMove
 *        Called on pointermove — or on touchmove once the browser has
 *        cancelled pointer events for the gesture.
 * @param {function(): void} handlers.onUp
 *        Called once when the gesture ends, whatever ends it (pointerup,
 *        touchend, touchcancel, or a non-touch pointercancel).
 */
export function bindPointer(target, { onDown, onMove, onUp }) {
  let active = false;
  // True once the browser has cancelled pointer events for the current
  // gesture — from then on the touch events below are the only live stream.
  // While pointer events are alive, touchmove is ignored: touch browsers
  // fire both streams concurrently, and forwarding both would drive onMove
  // twice per finger movement.
  let touchFallback = false;

  target.addEventListener("pointerdown", (e) => {
    if (onDown(e.clientX, e.clientY, e) === false) return;
    active = true;
    touchFallback = false;
  });

  target.addEventListener("pointermove", (e) => {
    if (!active) return;
    onMove(e.clientX, e.clientY);
  });

  function release() {
    if (!active) return;
    active = false;
    onUp();
  }

  target.addEventListener("pointerup", release);

  // A touch pointercancel means the browser captured the gesture (scrolling,
  // pull-to-refresh): pointer events stop but touch events keep firing, so
  // tracking hands off to the touch listeners below. A non-touch pointercancel
  // has no fallback stream — release, or the gesture stays active forever.
  target.addEventListener("pointercancel", (e) => {
    if (!active) return;
    if (e.pointerType === "touch") touchFallback = true;
    else release();
  });

  target.addEventListener(
    "touchmove",
    (e) => {
      if (!active || !touchFallback || !e.touches.length) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true },
  );

  target.addEventListener("touchend", release);
  // An interrupted touch (system gesture, incoming call, app switch) ends in
  // touchcancel instead of touchend — same release, or the gesture never ends.
  target.addEventListener("touchcancel", release);
}
