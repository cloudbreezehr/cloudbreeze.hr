// ── Reduced Motion ──
// Reads the OS-level `prefers-reduced-motion` setting and keeps it in sync.
// CSS handles static UI animations directly; this helper is for canvas code
// that needs to dampen scroll-reactive, flashing, or sweeping effects.

const query = window.matchMedia("(prefers-reduced-motion: reduce)");

let _prefersReducedMotion = query.matches;
query.addEventListener("change", (e) => {
  _prefersReducedMotion = e.matches;
});

export function prefersReducedMotion() {
  return _prefersReducedMotion;
}
