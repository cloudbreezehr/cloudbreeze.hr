# Parallel Skies — one continuous sky across windows

Branch-only working notes; delete when the feature lands.

The effect: several browser windows on one machine act as cut-outs over a
single continuous sky — like one wallpaper spanned across several monitors (a
_spanned display_, not split-screen). Move a window and it reveals more of the
same sky; a star near the boundary shows half in each window.

## Verdict on v1 (what's on this branch)

v1 links windows as _peers exchanging events_ (star handoff, impulse
forwarding, edge glow). Field-testing showed that's not the idea's promise:
the promise is **one world, several viewports** — browser windows acting as
cut-outs over a single continuous sky, like one wallpaper spanned across
several monitors.

Known v1 gaps, from testing two windows side by side:

- Each window's cursor and its forces stayed local — a neighbour's cursor
  couldn't reach across to act on your sky.
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
tick N computes identically everywhere. Traffic is then _inputs only_:

- `input` messages: pointer move/down/up/hold in desktop coords, ordered by
  `(tick, windowId)` so every window folds them in identically.
- The `forces` object generalizes to a _list_ of pointers — a remote pointer
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
   link so the world _is_ one sky).

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

> **Revised priority landed.** The phase-2 field test (below) reordered the
> work, and its three items are now done (see "Phase-3 decisions" at the end):
> world-anchor the motes behind a scroll-parallax policy, mirror the well/click
> visuals across the seam, and make the ghost read as one continuous cursor.
> The plumbing (1–2) was already in place; what remains of 3–6 is the
> lower-payoff polish.

1. ✅ Fixed-timestep + shared-epoch refactor for the shared layers (stars,
   shooting stars); windows render desktop-space slices. The sky
   becomes visibly continuous — stars align across the gap.
2. ✅ Input bus: remote pointers as force sources + cursor ghosts. Wells,
   orbits, drags all cross the border.
3. ◐ Effect mirroring at the dispatch seams. ✅ **clicks/wells** (aura/orbit/
   blast + bursts, via the `effect` seam) and ✅ **speller casts** (a spell
   blooms across every window, via the `cast` seam). _Deferred:_ fury
   bolts/aurora/meteors (entangled with the per-window fury accumulator +
   achievements — and a click's force+burst already crosses) and `toggleTheme`
   (independent per-window themes have their own charm — revisit as an opt-in).
4. Viewport mode for secondary windows (chrome fades; pure sky).
5. ◐ ✅ **scroll-parallax policy** (frozen while linked, tunable) + ✅
   **world-anchored motes** (deterministic dust, present at any scroll depth,
   force-responsive). _Remaining:_ toast routing, leader hardening (pagehide,
   TTL churn). Depth dust can join the world next — same regime as the motes.
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

## Phase-2 decisions (as built)

- **Remote pointers are force sources, not events.** Each linked window
  streams its pointer state (position + `isDragging`/`holdStrength`/
  `wellStrength`) over the channel; the receiver folds every peer pointer
  into `forces.remotePointers`, and the three force helpers
  (`applyAttraction`, `applyWellForce`, `applyHoverDrift` in
  `js/interactions.js`) loop over it applying the _identical_ math they use
  for the local pointer. One choke point, so every particle module on the
  site — motes, snow, jellyfish, dust — inherits cross-window wells, orbits,
  and drift for free. This is what fixes the v1 "click reads as ~5% of
  itself next door" and the stuck-hover-at-the-edge complaints in one
  stroke: the neighbour's cursor simply _is_ a force here.
- **The seam grew two channels.** `js/sky-link/seam.js` now also carries
  remote-pointer states (transport → renderer) and the local pointer state
  (renderer → transport). Same pattern as the phase-1 peer-rects channel:
  bound by whichever side owns the data, no-op when unbound.
- **Cursor ghosts** (`js/sky-link/ghosts.js`) draw a soft halo where each
  neighbour's cursor sits, brightening/widening with their hold charge,
  easing in/out so nothing pops. `pal.cursorGhost` is a new palette key
  (no render-time branching). They ride the same canvas as the particles
  they push.
- **One liveness boundary for force and ghost.** A pointer present in the
  remote-pointer list is live — that same list drives both its force and
  its ghost, so they appear and vanish together. A pointer gets its own
  (tighter) TTL than the rect link (`skyLink.POINTER_TTL_MS` <
  `skyLink.TTL_MS`), so a lost cursor stops acting promptly while the link
  itself (glow, world anchoring) persists on the rect TTL.
- **Coordinate handling.** Pointers travel in desktop space (transport
  applies `toDesktop`/`toLocal`); the renderer reports true viewport Y
  (un-mirrored) and re-mirrors incoming Y via `canvasY`, so a flipped
  (upside-down) window still folds neighbours in at the right spot.
- **New achievement:** `ghost-hand` — drag your cursor from one linked
  window into another; the receiving window witnesses the drag entering its
  viewport bounds.

## Phase-2 field test — findings, and the revised priority

Tested two windows side by side. Expected: (1) cursor toward the seam in A →
ghost + mote drift in B; (2) hold-drag a well near the seam in A → B's
particles pulled in, ghost widens, release blasts across; (3) drag across the
border → `ghost-hand` in B; (4) solo unchanged.

**Finding: the forces already cross correctly — the payoff is just
invisible.** Traced end to end, a remote well _is_ applied to the neighbour's
particles:

- local `forces.wellStrength` ramps in `interactions.js` `updateHold`, →
- reported by `setLocalPointerSource` (`canvas.js`), →
- streamed in `sky-link/index.js` `announcePointer`, →
- received → `pointers.upsert` → `seam.remotePointers()` (keeps
  `wellStrength`), →
- `canvas.js` copies it into `forces.remotePointers` (spread — keeps every
  field), →
- `interactions.js` `applyWellForce` loops `remotePointers` and pulls each
  mote.

Two things make item 2 look dead, sharing one root cause — **only the stars
are in the shared world so far:**

1. The **only** particles that answer to the well are the **motes**
   (`atmosphere.js`), and motes are **scroll-reactive** — sparse/absent near
   the top, where the field is all **stars, which ignore pointer forces
   entirely**. Testing at the hero (the natural first test) = nothing to pull.
   And motes aren't world-anchored yet (the phase-5 deferral), so even where
   present they don't align across the seam.
2. The well's **visible payload** — aura glow, orbit swarm, release blast — is
   gated on the _local_ drag (`interactions.js` `draw` + `releaseDrag`), so
   the receiving window renders none of it. Even when the force bites, B shows
   only a faint drift toward an invisible point.

Item 1 is dampened the same way; item 3 (`ghost-hand`) and item 4 (solo) are
fine.

**On the cursor.** The OS hands the real pointer and its mouse events to only
one window at a time — whichever the mouse is physically over — so a window
can't track or draw the _system_ cursor once the mouse is over its neighbour.
That's the reason for the ghost: it's the neighbour's cursor redrawn from the
streamed pointer state. The custom cursor already leaves one window and appears
in the next as the mouse crosses, so the leaving/entering side of the seam
feels right; what's left is the ghost — it reads as a separate blob rather than
the same cursor continuing.

Done right they compose into _one_ cursor gliding across the seam: the mouse
leaves A, and the ghost in B hands off to B's own cursor as it enters. So don't
drop the ghost — style it to read as the same cursor continuing.

**Revised priority — now built (see "Phase-3 decisions" below):**

1. ✅ **World-anchor the motes** — pulled a slice of phase 5 forward. The
   lively, force-responsive layer is now continuous across the seam _and_
   present at any scroll depth, not just the inert stars. Needed the scroll
   policy decided first (froze shared-layer parallax while linked).
2. ✅ **Mirror effects at the seam (phase 3)** — the well's aura/orbit/blast
   and click bursts now draw in _every_ window whose rect the effect touches.
   This is what makes it read as "it works."
3. ✅ **Style the ghost as one continuous cursor** — the ghost is now the
   site's cursor shape (core dot + ring + glow) continuing across the seam,
   handing off to the entering window's own cursor, not a separate blob.

Rationale: phases 1–2 built the plumbing (continuous stars + cross-window
forces); the _felt_ payoff lived in 3 + a slice of 5. Sequencing, not
architecture, is what made the field test underwhelm.

## Phase-3 decisions (as built)

- **Scroll-parallax freeze, not follow-the-leader.** While linked, world-layer
  parallax is frozen to a tunable fraction of local scroll
  (`sky.world.PARALLAX_WHILE_LINKED`, default 0), so windows at different scroll
  offsets still sample the same slice and align across the seam — the spanned
  sky is anchored to the desktop, not to any one window's scroll. No leader, no
  scroll broadcast. Applied inside the single world-projection path in `sky.js`,
  so the moon and click hit-tests freeze in lockstep for free. Turning the
  factor toward 1 restores per-window parallax without a rewrite.
- **The regime + crossfade moved to `js/world/anchor.js`.** `isWorldAnchored()`
  and the link/unlink crossfade (`createAnchorBlend`, `LINK_BLEND_MS`) are now
  shared by both world-anchored layers (stars and motes); `sky.js` re-exports
  `isWorldAnchored` for its existing consumers.
- **World-anchored motes are a deterministic field, not state streaming**
  (`js/world/motes.js`). Every window seeds the same homes from the daily key,
  drives a shared ambient drift off the world clock, and springs each mote
  toward that target. Pointer forces (local + every peer, folded in by the same
  helpers as everything else) perturb the field; the spring heals it back to the
  shared target, so the dust only diverges transiently right under an
  actively-moving cursor. Solo keeps the old scroll-reactive motes verbatim;
  `atmosphere.js` crossfades between the two regimes on link/unlink.
- **Well visuals ride the pointer stream; one-shots ride one broadcast.** The
  well aura + orbit swarm render for every charging peer straight off the
  already-streamed pointer state (per-peer orbit pools in `interactions.js`);
  clicks and well-release blasts mirror through a single `sky-effect` →
  `effect` → `sky-link-effect` seam (`canvas.js` ↔ `sky-link/index.js`), landing
  in each window as both a force and its visible burst. This replaces the old
  click-only `impulse` path (`IMPULSE_*` → `EFFECT_*`).
- **Spell casts mirror too.** An incantation dispatches `sky-cast`; the transport
  broadcasts a `cast` (word + desktop origin + charge), and every window re-casts
  the word locally at the translated origin. No reach limit — screen-wide spells
  (SNOW, CONFETTI, flashes) fill every pane. The remote re-cast calls `cast()`
  directly, so it neither re-broadcasts nor re-fires the caster's achievements.
- **The ghost is the cursor continuing.** `js/sky-link/ghosts.js` draws a core
  dot + ring + glow in `pal.cursorGhost`, swelling with the stronger of the
  peer's hold or well charge. It eases position (smoothing the send cadence into
  the render's) so it glides, not steps. And when a peer's ghost is inside this
  viewport — the real mouse is over us but owned by the peer that captured the
  drag, so our own custom cursor is frozen/stale — `canvas.js` sets
  `body.peer-pointer-inside` and CSS hides the local cursor, leaving the ghost as
  the single cursor gliding across the seam.
- **New achievement:** `distant-well` — a linked window's gravity well blooms in
  yours (dispatched from the interactions draw seam when a remote aura renders
  above a threshold).

Remaining seams for a later pass — deliberately, not for lack of a path:
- **Fury mirroring** (bolts/aurora/meteors): fury is a per-window _accumulator_
  (clicks build tiers that unlock lightning → meteors), so mirroring a bolt
  faithfully means mirroring that state and would inflate the peer's fury
  achievements; meteors are already world-shared via the schedule; a click
  already crosses as force + burst. Low marginal payoff, real entanglement.
- **`toggleTheme` sync**: independent per-window themes read as their own charm;
  if wanted, do it as an explicit opt-in toggle rather than always-on.
- **Viewport / chrome-drop mode** (phase 4): a secondary window sheds its chrome
  to become a pure sky pane — a focused UI pass of its own.
- **Toast routing + leader hardening** (phase 5): low visible payoff.
