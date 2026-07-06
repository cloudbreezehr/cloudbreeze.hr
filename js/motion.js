// ── Motion Policy ──
// Single source of truth for the OS-level `prefers-reduced-motion`
// setting.  Feature modules don't read the preference directly;
// instead they consume one of the helpers below at the boundary where
// motion enters the system.
//
// CSS-keyframe animations and CSS transitions are handled globally by
// the @media (prefers-reduced-motion: reduce) rule in css/01-base.css.
// The helpers here cover the gaps the CSS rule can't reach.
//
// Three questions, three answers.  Pick the helper that matches what
// your code is actually asking:
//
//   "Apply motion to this number / spawn / integration step."
//                                          → scaled() / chance() / step()
//   "Does the user want me to not move things?"     → prefersReducedMotion()
//   "How long should this animation last?"          → reducedDuration()
//
// Default: reach for `scaled` / `chance` / `step` first.  These three
// absorb the multiplication so call sites no longer thread a parameter
// or branch on the preference.  A particle that does its motion math
// through them is automatically tier-aware — when a future "lighter
// motion" preference returns e.g. 0.3, every animation dampens
// uniformly without auditing call sites.
//
//   - scaled(value)      Continuous scalar applied to a single value.
//                        Use for per-frame deltas, phase advances,
//                        impulse forces — anything that *represents*
//                        motion.  Reads motionScale() internally.
//
//   - chance(p)          Stochastic gate scaled by motion budget.
//                        Use for spawn rolls and event probabilities
//                        (`Math.random() < p` semantically, but with
//                        motion budget folded in).  Returns false
//                        unconditionally when motion is reduced.
//
//   - step(state, dt, friction)  Standard particle integration over
//                                { x, y, vx, vy }: position += velocity,
//                                followed by friction decay if provided.
//                                Use when a particle's motion fits the
//                                vx/vy + friction shape; particles with
//                                bespoke math (intrinsic forces,
//                                friction-before-position, custom
//                                ordering) wrap motion-bearing values
//                                in scaled() instead.
//
//   - prefersReducedMotion()  Boolean OS preference.  Use this for
//                             "skip entirely" gates — discrete bursts,
//                             flashing/sweeping effects that dampening
//                             can't make safe, layout-cost rAF loops
//                             with nothing useful to do at zero budget.
//
//   - motionScale()      Continuous scalar.  Today returns 0 or 1; the
//                        scalar shape leaves room for intermediate
//                        tiers later.  New code should reach for
//                        scaled / chance / step instead of multiplying
//                        by motionScale() directly — the helpers do
//                        the right thing automatically and don't have
//                        to be threaded through factory signatures.
//
//                        Do NOT use `motionScale() === 0` as a boolean
//                        gate — that conflates "no budget right now"
//                        with "user opted out" and would silently
//                        regress if a future tier returned e.g. 0.3.
//                        Branch on prefersReducedMotion() instead.
//
//   - reducedDuration(ms)  Returns the input ms, or 0 when reduced.
//                          Use for Element.animate() durations and
//                          setTimeout-driven cosmetic delays — the
//                          animation snaps to its end-state instantly.
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

// Continuous scalar.  Today returns 0 or 1; the scalar shape leaves
// room for intermediate tiers later.  Prefer scaled / chance / step
// over multiplying by this directly — the helpers absorb threading
// at the call site.
export function motionScale() {
  return _prefersReducedMotion ? 0 : 1;
}

// Returns ms unchanged, or 0 when reduced.  Use for one-shot animation
// durations (Element.animate, CSS-driven setTimeouts, setInterval
// periods) so the animation completes instantly without bespoke gating.
export function reducedDuration(ms) {
  return _prefersReducedMotion ? 0 : ms;
}

// Multiply a per-frame value by the current motion scale.  Use for
// any value that *represents* motion: position deltas, phase
// advances, velocity-imparting forces, intrinsic gravity-like
// contributions.  Reads motionScale() internally so callers don't
// thread the scalar through factory or update signatures.
export function scaled(value) {
  return value * motionScale();
}

// Roll a probability gate scaled by motion budget.  Equivalent to
// Math.random() < p when motion is allowed; returns false
// unconditionally when motion is reduced.  Use for stochastic spawns
// (shooting stars, jellyfish direction changes, glass-drop spawns,
// star flashes) so spawn rate dampens with the rest of motion.
export function chance(p) {
  return Math.random() < p * motionScale();
}

// Integrate a particle whose motion fits the standard vx/vy + friction
// shape.  Mutates `state.x`, `state.y`, and (if `friction` is provided)
// `state.vx` / `state.vy`.  Friction is applied unconditionally — it's
// damping decay, not motion budget — so coasting particles bleed off
// velocity even when scale is zero.
export function step(state, dt = 1, friction) {
  const s = motionScale();
  state.x += state.vx * dt * s;
  state.y += state.vy * dt * s;
  if (friction !== undefined) {
    state.vx *= friction;
    state.vy *= friction;
  }
}
