// ── Sky-Link Seam ──
// The narrow contract between the world-anchored sky renderer and the
// sky-link transport: which peer viewports (world-space rects) are live
// right now. The transport binds its side at init; everything here is safe
// to call unbound, and the unbound default is always "no link" — a solo
// window pays nothing.

let _peerRectsFn = null;

/** Transport side: register the live peer-rects read. Pass null to unbind. */
export function setPeerRectsSource(fn) {
  _peerRectsFn = fn;
}

/** Renderer side: world-space rects of every live peer viewport. Empty
 *  when unlinked — length doubles as the renderer's link probe. */
export function peerWorldRects() {
  return _peerRectsFn ? _peerRectsFn() : [];
}
