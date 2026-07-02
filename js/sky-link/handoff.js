// ── Sky-Link Handoff Seam ──
// The narrow contract between the canvas sky and the sky-link transport:
// the sky offers up particles that fly off-screen, and spawns particles
// that arrive from other windows. Both sides bind their half at init, so
// importing this module has no effect until a link actually exists —
// a solo window pays nothing.
//
// Invariant: every function here is safe to call unbound; the unbound
// default is always "no link" (offer refused, spawn dropped, inactive).

let _offerFn = null;
let _spawnFn = null;
let _activeProbe = null;

/** Transport side: handle an off-screen exit. Returns true when a peer
 *  window accepted the particle. */
export function setOfferHandler(fn) {
  _offerFn = fn;
}

/** Sky side: offer an exiting particle to the link. `exit` carries local
 *  viewport coords plus the kinematics a receiver needs to continue the
 *  flight: { x, y, angle, speed, len, opacity, life, maxLife }. */
export function offerHandoff(exit) {
  return _offerFn ? _offerFn(exit) : false;
}

/** Sky side: register the spawner that materializes an arriving particle. */
export function setSpawner(fn) {
  _spawnFn = fn;
}

/** Transport side: hand an arriving particle (local viewport coords) to the
 *  sky. Dropped silently when no sky has registered — the particle simply
 *  doesn't continue here. */
export function spawnHandoff(star) {
  if (_spawnFn) _spawnFn(star);
}

/** Transport side: register the live "is any peer window linked?" probe. */
export function setLinkProbe(fn) {
  _activeProbe = fn;
}

/** Sky side: whether at least one peer window is currently linked. */
export function isLinkActive() {
  return _activeProbe ? _activeProbe() : false;
}
