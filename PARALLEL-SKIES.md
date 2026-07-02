# Parallel Skies — split-screen rework plan

Branch-only working notes; delete when the feature lands.

## Verdict on v1 (what's on this branch)

v1 links windows as *peers exchanging events* (star handoff, impulse
forwarding, edge glow). Field-testing showed that's not the idea's promise:
the promise is **one world, several viewports** — browser windows acting as
cut-outs over a single continuous sky, like split-screen.

Known v1 gaps, from testing two windows side by side:

- Cursor exists in both windows; hover gets stuck at the edge it left.
- Gravity well, orbit, lightning, aurora, incantations don't cross — only a
  weakened click impulse does, so a click reads as ~5% of itself next door.
- Toasts, nav, dev console, scroll are all per-window.
- (fixed on this branch) touch devices could "link" two tabs and glow.

## Target architecture: one simulation, N viewports

**World space = desktop coordinates.** Every window already knows its
viewport rect on the desktop (`sky-link/peers.js`). The shared sky simulates
once over the union of viewports; each window draws the slice intersecting
its own rect (translate by `-selfRect`).

**Deterministic lockstep, not state streaming.** All windows run the same
simulation from the same seed (the daily arrangement stream already gives
identical star fields), stepped on a **fixed timestep** anchored to a shared
epoch broadcast at link time. Same engine, same machine, same float ops —
tick N computes identically everywhere. Traffic is then *inputs only*:

- `input` messages: pointer move/down/up/hold in desktop coords, ordered by
  `(tick, windowId)` so every window folds them in identically.
- The `forces` object generalizes to a *list* of pointers — a remote pointer
  is a first-class force source (fixes the well/orbit/cursor-edge issues in
  one stroke), drawn as a soft cursor ghost.

**Mirror one-shot effects at their dispatch seams, not per effect.** The
maintenance-burden answer: there are only three seams, and new features that
use them inherit multi-window behavior for free —

1. the speller's cast action (incantations → broadcast `{word, desktop
   origin}`, every window casts locally with a translated origin),
2. `fury.click` / canvas click path (bursts and bolts at full strength,
   drawn by every window whose rect the effect touches),
3. `toggleTheme` (theme state syncs across windows — body classes follow the
   link so the world *is* one sky).

**Chrome stays per-window; add a "viewport mode".** A DOM nav can't straddle
OS windows. Instead: when linked, a secondary window can drop its chrome
(reuse the photo-mode CSS approach) and become a pure sky viewport — 90% of
the split-screen feel for 10% of the complexity. Toasts route to the focused
window only (leader decides). The elongated-nav illusion
(`translateX(-(selfRect.x - unionRect.x))` on fixed chrome) is a stretch
goal, as is the dev console gliding across the border.

**Leadership.** Mostly leaderless (input ordering is deterministic), but one
window — oldest id — owns tie-breaks: shared epoch, toast routing, spawn
rolls for shared particles (or derive spawns from the seeded stream so even
that needs no leader).

## Phases

1. ✅ Fixed-timestep + shared-epoch refactor for the shared layers (stars,
   shooting stars); windows render desktop-space slices. The sky
   becomes visibly continuous — stars align across the gap.
2. Input bus: remote pointers as force sources + cursor ghosts. Wells,
   orbits, drags all cross the border. Motes join the shared layers here —
   they're pointer/scroll-driven, so world-anchoring them is meaningless
   until inputs are shared.
3. Effect mirroring at the three seams (casts, fury/clicks, theme toggles).
4. Viewport mode for secondary windows (chrome fades; pure sky).
5. Toast routing, leader hardening (pagehide, TTL churn), scroll-parallax
   policy while linked (freeze shared-layer parallax or follow the leader).
   Depth dust joins the world here — it's only visible mid-scroll, so its
   alignment is moot until the scroll policy exists.
6. Stretch: dev-console border crossing, elongated-nav illusion.

Keep from v1: peers.js geometry (all of it), the seam module pattern
(handoff.js generalizes into the input bus), achievements, capability
gating, hidden-window quieting, tests.

## Phase-1 decisions (as built)

- **Epoch = the wall clock itself.** `js/world/clock.js` derives the tick
  from Unix-epoch milliseconds, so every window on the machine agrees by
  construction — no epoch broadcast, no leader, no re-sync on join/resume.
  The plan's "epoch broadcast at link time" turned out to be unnecessary.
- **Dual projection regime, not world-always.** Solo windows keep the old
  fold-the-tile-onto-the-viewport modulo: the constellation puzzle needs
  every planted star reachable at any window size (device-reachability
  rule), and world slicing would thin the field on small windows. Linked
  windows render desktop-anchored world slices; link/unlink crossfades
  between layouts (`sky.world.LINK_BLEND_MS`).
- **Shooting stars are world events while linked.** A seeded per-tile,
  per-tick roll (`js/world/schedule.js`, seeded from the daily key)
  schedules every arc; flights are pure functions of their spawn slot, so
  windows never message about them and a window opening mid-flight finds
  the arc already in the air. The v1 star handoff (handoff.js, `star`
  messages, life extension) is deleted. `star-courier` now fires when a
  window witnesses an arc's head visit both its own slice and a peer's.
- **The seam narrowed to peer rects.** `js/sky-link/seam.js` exposes live
  peer world-rects to the renderer (empty = solo); phase 2 extends this
  same seam into the input bus.
- **Same-seed handshake.** Rect announcements carry the sky seed; windows
  on different days (or #sky= time travelers) never link.
- **Meteor-shower boost quantized** to a shared 5-minute wall-clock grid so
  it can feed the schedule deterministically.
- **New achievement:** `fixed-stars` — move a linked window ~400px and
  watch the sky hold still.

Known phase-1 gaps, owned by later phases: parallax aligns across the gap
only at equal scroll progress (phase 5 policy); upside-down's CSS flip
mirrors a linked slice (accepted quirk); per-window dev-console retunes of
schedule inputs (spawn chance, speeds, lifetimes) split the schedule
between windows — dev-only, and the clock and tile size are deliberately
not tunable for exactly this reason.
