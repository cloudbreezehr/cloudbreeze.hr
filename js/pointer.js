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
 *        Called on pointermove *and* touchmove while tracking is active.
 * @param {function(): void} handlers.onUp
 *        Called once when the pointer is released (pointerup or touchend).
 */
export function bindPointer(target, { onDown, onMove, onUp }) {
  let active = false;

  target.addEventListener('pointerdown', e => {
    if (onDown(e.clientX, e.clientY, e) === false) return;
    active = true;
  });

  target.addEventListener('pointermove', e => {
    if (!active) return;
    onMove(e.clientX, e.clientY);
  });

  function release() {
    if (!active) return;
    active = false;
    onUp();
  }

  target.addEventListener('pointerup', release);

  // No pointercancel handler — touch events take over instead.
  // After the browser captures the pointer for scrolling, pointer events stop
  // but touch events keep firing.
  target.addEventListener('touchmove', e => {
    if (!active || !e.touches.length) return;
    onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  target.addEventListener('touchend', release);
}
