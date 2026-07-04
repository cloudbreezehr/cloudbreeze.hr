// ── Sky-Link Seam ──
// The narrow contract between the sky renderer and the sky-link transport.
// Three channels, each bound by the side that owns the data: the transport
// publishes live peer viewport rects and remote pointer states; the
// renderer publishes its own pointer state for the transport to broadcast.
// Everything here is safe to call unbound, and the unbound default is
// always "no link" — a solo window pays nothing.

let _peerRectsFn = null;
let _remotePointersFn = null;
let _localPointerFn = null;

/** Transport side: register the live peer-rects read. Pass null to unbind. */
export function setPeerRectsSource(fn) {
  _peerRectsFn = fn;
}

/** Renderer side: world-space rects of every live peer viewport. Empty
 *  when unlinked — length doubles as the renderer's link probe. */
export function peerWorldRects() {
  return _peerRectsFn ? _peerRectsFn() : [];
}

/** Transport side: register the live remote-pointers read. Pass null to
 *  unbind. */
export function setRemotePointersSource(fn) {
  _remotePointersFn = fn;
}

/** Renderer side: every linked window's pointer in this window's local
 *  coordinates, with interaction flags —
 *  { id, x, y, active, isDragging, holdStrength, wellStrength, seenAt }.
 *  Empty when unlinked. */
export function remotePointers() {
  return _remotePointersFn ? _remotePointersFn() : [];
}

/** Renderer side: register the local-pointer read the transport samples —
 *  () => { x, y, active, isDragging, holdStrength, wellStrength } in local
 *  viewport coordinates. Pass null to unbind. */
export function setLocalPointerSource(fn) {
  _localPointerFn = fn;
}

/** Transport side: the local pointer's current state, or null when the
 *  renderer isn't up (nothing to broadcast). */
export function localPointerState() {
  return _localPointerFn ? _localPointerFn() : null;
}
