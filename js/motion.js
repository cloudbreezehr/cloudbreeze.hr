// ── Motion Policy ──
// Single source of truth for the OS-level `prefers-reduced-motion`
// setting.  Feature modules don't read the preference directly;
// instead they consume one of the helpers below at the boundary where
// motion enters the system.
//
// CSS-keyframe animations and CSS transitions are handled globally by
// the @media (prefers-reduced-motion: reduce) rule in main.css.  The
// helpers here cover the gaps the CSS rule can't reach:
//
// Two questions, two answers.  Pick the one that matches what your
// code is actually asking:
//
//   "How much motion budget do I have this frame?"  → motionScale()
//   "Does the user want me to not move things?"     → prefersReducedMotion()
//
//   - motionScale()      Continuous scalar for per-frame math.  Today
//                        returns 0 or 1, but the scalar shape leaves
//                        room for future intermediate tiers ("lighter
//                        motion") to slot in without changing call
//                        sites.  Multiply per-frame deltas, spawn
//                        probabilities, and impulse strengths by it
//                        so dampening composes downstream without
//                        explicit branching.
//
//                        Do NOT use `motionScale() === 0` as a boolean
//                        gate — that conflates "no budget right now"
//                        with "user opted out" and would silently
//                        regress if a future tier returned e.g. 0.3.
//                        Branch on prefersReducedMotion() instead.
//
//   - prefersReducedMotion()  Boolean OS preference.  Use this to
//                             gate effects that must be skipped
//                             entirely rather than dampened — fireworks,
//                             discrete bursts, layout-cost rAF loops
//                             that have nothing useful to do at zero
//                             budget.  Also recorded by analytics.
//
//   - reducedDuration()  Returns the input ms, or 0 when reduced.
//                        Use for Element.animate() durations and
//                        setTimeout-driven cosmetic delays — the
//                        animation snaps to its end-state instantly.
//
// All helpers read fresh on each call; do not cache the result.  The
// matchMedia listener picks up OS-level toggles mid-session.

const query = window.matchMedia("(prefers-reduced-motion: reduce)");

let _prefersReducedMotion = query.matches;
query.addEventListener("change", (e) => {
  _prefersReducedMotion = e.matches;
});

export function prefersReducedMotion() {
  return _prefersReducedMotion;
}

// 1 normally, 0 when reduced motion is requested.  Multiply per-frame
// deltas, spawn probabilities, and impulse strengths by this scalar.
export function motionScale() {
  return _prefersReducedMotion ? 0 : 1;
}

// Returns ms unchanged, or 0 when reduced.  Use for one-shot animation
// durations (Element.animate, CSS-driven setTimeouts, setInterval
// periods) so the animation completes instantly without bespoke gating.
export function reducedDuration(ms) {
  return _prefersReducedMotion ? 0 : ms;
}
