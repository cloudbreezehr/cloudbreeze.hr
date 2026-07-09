# Project Context

Cloudbreeze.hr is a single-page marketing site for a cloud consultancy. The visual identity is built around an interactive sky canvas (`#bg-canvas`) that evolves as the user scrolls — from near-space (stars, shooting stars) through atmosphere (clouds, wisps) to ground level (horizon glow). The site has hidden easter-egg themes that transform the visual experience.

## Architecture

**Module structure**: Background visuals render on a single full-viewport canvas (`#bg-canvas`); canvas modules follow the factory pattern — `createXxx(canvas, ctx, ...)` returns an object with `draw()` and optional `click()`, `clickBurst()`, etc., and particle classes within them follow `constructor` → `reset(init)` → `update()` → `draw()`. The wider tree, by role:

```
js/
  canvas.js, canvas-utils.js     Render loop, scroll + pointer dispatch, shared draw helpers, the `forces` object
  sky.js, atmosphere.js, fury.js Scroll-driven background layers (stars; clouds/wisps/horizon; click fury)
  interactions.js, pointer.js, cursor.js  Pointer forces (repel/attract/well) and cursor effects
  motion.js                      Reduced-motion policy: `scaled()`, `chance()`, `prefersReducedMotion()`
  quality.js                     FPS-adaptive quality tier
  colors.js                      `resolvePalette()` — per-appearance, per-theme (and per-combo) color overrides
  layers.js                      z-index registry exposed as CSS custom properties
  narration.js                   Screen-reader flavor prose for theme changes, combos, spells
  particles/                     Per-theme canvas particle classes (one file per theme)
  themes/                        Easter-egg themes: registry, factory, trigger strategies, one module per theme
                                 + alchemy.js — curated stacked-pair hybrid combos
  effects/                       Standalone self-cleaning DOM effects (ripples, fireworks, HUD, hints, sparkles)
                                 + photo-mode.js (sky portrait export), speedrun.js (backup → reset →
                                 timed run from zero → restore; clock, set splits, personal best)
  achievements/                  Cloudlog: tracker, registry, storage, progress, UI
                                 + passport.js — portable progress codes for cross-device transfer
  analytics/                     Event taxonomy, consent, adapters + bridges
  audio/                         Opt-in Web Audio: engine, procedural SFX voices, per-theme bus tint, event bridges
  daily/                         Sky-of-the-day: date-seeded arrangement stream, word of the day, #sky= links
  world/                         The shared world behind the multi-window sky: fixed-timestep clock,
                                 desktop-anchored sky-tile geometry, seeded per-tile event schedule,
                                 the world/solo regime + link crossfade, and the deterministic
                                 world-anchored mote field
  sky-link/                      Multi-window link: peer transport + registry, desktop-space peer
                                 geometry, facing-edge glows, the renderer-facing seam, remote-pointer
                                 input bus + cursor ghosts, mirrored one-shot effects (clicks / well
                                 blasts) across viewports
  real-sky/                      The actual sky: solar/lunar math, day-phase tint, meteor-shower calendar,
                                 live Open-Meteo weather for the footer badge
  terminal/                      Hidden Quake-style console (spell SHELL / backquote): command catalogue
                                 mapped onto themes, spells, kubectl theatre, the passport, and the daily sky
  dev/                           Dev console + tunable-constant registry
```

**Shared state**: The `forces` object — pointer and interaction state (click impulse, drag, hold/well strength, hover, last-move time, and `remotePointers` for linked windows; see its definition in `canvas.js`) — is owned by `canvas.js` and passed by reference to modules that need interaction. Frame-varying values (`sp`, `scrollVelocity`, `pal`, `isDark`) are explicit parameters to each module's `draw()`.

**Palette system** (`js/colors.js`): Two-layer color control:
1. CSS filter on `#bg-canvas` handles global tone shifts per theme
2. `resolvePalette(appearance, theme)` returns a flat color object — callers read `pal.colorName` with zero branching

A new theme's look is additive: a `body[data-active-theme="…"]` block in its own `css/themes/<id>.css` partial (linked in `index.html` — see `css/README.md`), holding canvas `filter` + element styles, plus, for canvas colors, a per-theme override in `colors.js` that `resolvePalette()` returns. The render loop auto-detects any registered theme, so there's zero per-theme branching in rendering code.

**Theme priority**: Several easter-egg themes can be active at once — each toggles a `body.{id}` class. The render loop resolves a single winner (last-triggered wins via `body.dataset.lastTheme`, else the declaration order in `js/themes/registry.js`) and writes it to `body.dataset.activeTheme`. CSS theme rules (`body[data-active-theme="…"]`) and the canvas palette both key off that resolved winner, so only one theme paints at a time.

**Pointer interactions**: Unified system using pointer events with touch fallback. `js/pointer.js` provides `bindPointer()` for event binding. `js/interactions.js` handles the actual particle effects (click burst, orbit, trail, gravity well) and exports pure force helpers (`applyRepulsion`, `applyAttraction`, `applyWellForce`) used by particle modules.
- `clickImpulse` {x, y, strength} — repels nearby particles on click
- `isDragging` / `dragPos` — attracts nearby particles with tangential orbit, scales with hold duration
- `scrollVelocity` — pushes scroll-reactive particles
- `pointercancel` → touch event fallback (`touchmove`/`touchend`) for mobile scroll
- `remotePointers` — pointers of linked windows (empty solo). The attract/well/hover-drift helpers already loop over these, so a neighbour's drag or cursor acts on this window's particles through the same math; a new particle type gets cross-window forces for free just by using the helpers.

**Any new canvas particle type should interact with these existing forces.** Import and use `applyRepulsion`, `applyAttraction`, `applyWellForce` from `interactions.js`. See `particles/frozen.js` (Snowflake) or `atmosphere.js` (ScrollMote) for reference.

**Any new canvas particle's per-frame motion math goes through `scaled()` / `chance()` from `js/motion.js`.** Never read `motionScale()` directly and never accept a `motionScale` parameter — the helpers absorb the policy at the call site. Position deltas, phase advances, impulse forces use `scaled(value)`; stochastic spawn rolls use `chance(p)` instead of `Math.random() < p * motionScale()`. Friction-style velocity decay (`this.vx *= FRICTION`) is *not* motion and stays unwrapped — it's damping that should bleed off coasting velocity even when the budget is zero. For "skip entirely" gates (one-shot bursts, flashing effects, rAF-loop suspension) use `prefersReducedMotion()` from the same module. The unit test for the particle should include a reduced-motion case asserting position is invariant across an `update()` call. See `particles/frozen.js` (Snowflake) for the standard pattern; `particles/deep-sea.js` (Jellyfish) for custom integration that wraps bespoke math in `scaled()`.

**Easter eggs** (`js/themes/`): Themes triggered by hidden user actions. `registry.js` is the theme catalog; `triggers.js` holds the pluggable input-detection strategies; `factory.js` wraps a strategy into the shared lifecycle — accumulate `force` 0→1 via user input, show progressive visual indicators at thresholds, trigger a wipe transition at 1.0, toggle the `body.{id}` class. Deactivation uses the same system with a lower threshold, and its wipe timing must reuse the activation constants (don't hardcode).

**Achievement system** (`js/achievements/`): The Cloudlog tracks achievements across exploration, mastery, theme-specific, and meta sets. Integration is event-based: source modules dispatch `CustomEvent("achievement", { detail: { type, ...data } })` on `window`, and `tracker.js` is the sole module that evaluates conditions and triggers unlocks. Never duplicate detection logic — if a source module already knows something happened, dispatch an event from there and let the tracker listen. See `js/achievements/registry.js` for definitions and point tiers.

**Device reachability**: Every device must be able to reach 100% completion. An achievement earnable only with a capability some devices lack declares `requires: <capability>` in the registry — `"keyboard"`, `"hover"`, `"multiwindow"`, `"motion"`, … (`js/device.js` holds the live set) — e.g. the `L` shortcut, the cursor-idle animations. `js/device.js` resolves capabilities — a touch-only device (`(hover: none)`) is assumed to lack the desktop-style ones, while `"motion"` runs the other way (phones have the sensor, desktops don't) — and completion math filters through `isReachable()` (`getReachableAchievements`, `getAllNonMeta`, `getSetPrereqs`), so unreachable entries are hidden from the panel and dropped from set-mastery/completionist totals. When adding a capability-gated achievement, tag it; if it's reachable by tapping its letters on the page (the spell path), it isn't gated.

**Every new feature or interaction MUST include achievement integration.** When adding a new theme, particle effect, interaction, or user-facing feature:
1. Dispatch appropriate `CustomEvent("achievement", ...)` events from the source module at meaningful moments
2. Add corresponding achievement definitions to `js/achievements/registry.js`
3. Add handlers in `js/achievements/tracker.js` that listen for those events
4. Never track state in the tracker that the source module already tracks — reuse via events

**Audio system** (`js/audio/`): Opt-in, off by default (no autoplay; reduced-motion-safe). `engine.js` owns the AudioContext and master gain → limiter; `sfx.js` is a catalogue of procedural voices (oscillators + filtered noise, no asset files); voices play through a per-theme tint filter (`bus.js` + `theme-sounds.js`) so the active theme re-colours every effect for free, while UI cues (toggle/unlock chimes) bypass the tint via `playSfx(name, { ui: true })`. **Sound is tied to the EFFECT, never the trigger** — a spell is heard via its fireworks/ripple, identical however it was cast. Two integration paths: a standalone self-contained effect in `js/effects/*` calls `playSfx()` directly, placed *after* its `prefersReducedMotion()` guard so the sound only fires when the visual renders; a canvas-internal effect that already dispatches an achievement event is sounded by mapping that event to a voice in an audio bridge (`bridges/*`, most built from `eventVoiceBridge({ eventType: voiceName })`). Reduced motion therefore gates sound *by consequence, not by rule* — the policy is "sound accompanies whatever still happens": one-shot visual effects are skipped under RM so they fall silent, while clicks/theme-changes/unlocks still occur so they still sound. Intentional; don't add RM checks to the bridges (or lift `playSfx` above the primitives' RM guard) without revisiting it. **Passive/continuous background animations stay silent** (drifting clouds, a jellyfish's pulse) — sounding them would be ambient noise, which this site deliberately omits. When adding an effect, give it a voice via whichever path fits; per-voice synthesis params are a readable data catalogue, with the SFX/master levels exposed as dev-console knobs.

## Code Standards

- **No magic numbers**: Every numeric literal that controls appearance or behavior must be a named constant — no exceptions. This applies to all files equally: canvas.js, easter-egg trigger modules (blocky.js, frozen.js, etc.), and anywhere else. Opacity values, thresholds, multipliers, durations, probabilities, pixel sizes — all of it. Group constants by feature with section comments (`// ── Feature Name ──`) at the top of the file or function scope.
- **No appearance/theme branching in rendering**: Colors come from the palette. Don't write `isDark ? X : Y` in draw code — add colors to the palette overrides instead.
- **Self-cleaning DOM effects**: Use Web Animations API with `onfinish = () => el.remove()` for transient particles (frost breath, ripples). Never accumulate orphaned DOM nodes.
- **Performance**: Canvas particles use object pools or fixed arrays, not unbounded allocation. Any dynamically-spawned particle array (click effects, fragments, pops) must have a cap constant and a guard at the push site. Gradient calls are the most expensive canvas operation — skip them for small/invisible particles. Batch `moveTo`/`lineTo` calls into a single `beginPath`/`stroke` when possible.
- **Never animate/transition an inherited custom property on a shared ancestor**: A CSS `transition` or `animation` on an *inherited* custom property — a plain one, or an `@property` with `inherits: true` — declared on `:root`/`html`/`body` (or any ancestor of much of the DOM) forces the browser to recompute that property for *every element that inherits it, on every frame of the animation*. That's O(whole document) per frame, so the frame rate craters in proportion to DOM size (a large list open = a stutter on every hover/idle tick). Declare and write such properties on the smallest subtree that consumes them — a dedicated wrapper around the only readers — and have JS write to that narrow element, not `documentElement`/`body`. A plain one-off write to a root-level inherited property is far cheaper (invalidation is scoped to the actual `var()` consumers), but still prefer the narrow scope so a later `transition:` can't silently reintroduce the cliff. A pseudo-element consumer (e.g. `body::after`) is the one case that forces the property onto its originating element — acceptable only because it can't be transitioned into the trap without you noticing.
- **CSS theme rules**: Each theme lives in its own `css/themes/<id>.css` partial, linked in `index.html` in cascade order (see `css/README.md`). Within the file, follow the established element order — cursor, cloud-svg filter, hero gradient, buttons, cards, nav CTA, contact, footer, `::after` opacity.
- **Touch compatibility**: Any pointer interaction must handle `pointercancel` gracefully. Touch events (`touchmove`/`touchend`) serve as fallback when the browser captures the pointer for native gestures.
- **Upside-down awareness**: The upside-down theme flips the canvas and page via CSS `scaleY(-1)`. Any feature that anchors to a specific viewport edge or uses scroll-position thresholds must invert its scroll logic when `body.upside-down` is active (`1 - sp` instead of `sp`). The CSS flip handles the visual inversion automatically — only scroll-dependent visibility/positioning needs manual handling.
- **Verify derived values**: When a value is computed from another, never compare it back to its own source in a condition — the result is always true/false. Simplify or remove the dead branch.
- **No inter-diff comments**: Comments must describe the code as it is now, not how it got here. Don't write "extracted from X", "moved from Y", "duplicated here", "was previously in Z". A reader who has never seen the git history should find every comment meaningful.
- **Peer items get peer prose**: When a comment or code block enumerates parallel items — payload fields, switch cases, sibling merge loops — treat them uniformly. Don't attach a justifying clause to one item ("…and seen marks (s) — without these, restored unlocks would re-badge as new") while its siblings carry none: the asymmetry falsely flags that item as special, and the odd one out is invariably the one just added — meaning the sentence is a diff justification aimed at the reviewer, not a description aimed at the reader. Same for code shape: when the sibling loops above yours are uncommented, the new one doesn't get an explainer either. The why-this-was-added story belongs in the commit message in short form. Test: would the prose look the same if every item had been written on the same day, by one author? If your addition carries a defense its peers lack, delete the defense.
- **No consumer names in module docs**: A module's own comments, headers, and docstrings must not enumerate its callers. Don't write "used by X and Y", "(the Cloudlog panel, mobile nav)", "consumed by foo.js". The list goes stale the moment a consumer is added, removed, or renamed — and modules shouldn't know or care who imports them. Describe *what the module does* and *what its contract is*; callers are an `rg` away when someone actually needs them.
- **No incidental subsystem references**: Don't justify code with the names of other modules or subsystems unless that cross-module relationship *is* the durable contract. Don't write "size is dynamic so the dev console can tune it", "this fires events that the analytics bridge listens for", "exported so tests can derive timings". The example subsystem may be renamed, removed, or replaced; the rule shouldn't move when it does. Same hazard as naming consumers — the durable thing is *what* the code does and *why* (the constraint, the invariant), not *which other module incidentally cares*. Acceptable exception: when the cross-module relationship is genuinely the contract, like an event-emitter module whose only purpose is feeding a specific pipeline, or a custom event with exactly one publisher in the codebase — then the relationship is the rule, not an example of it. **Test for "incidental":** mentally swap the named consumer with "X". If the comment still teaches the reader something useful ("X listens for these events"), the name was incidental and should be removed. If the comment becomes meaningless ("X dispatches these events" — to who? from where?), the name was the contract — keep it, because removing it leaves the reader with nothing.
- **Lead with the invariant, not the anecdote**: When a comment explains *why* a line of code exists, lead with the durable rule (the invariant, the contract, the constraint that will still be true next year) and relegate any specific scenario to a brief parenthetical — or omit it entirely. Don't write "panel was closed via Back, then reopened via the nav button, leaving a stale handle, so…"; write "invariant: `_overlayHandle` is always null or the currently-tracked overlay" and trust the reader. Narrative scenarios age oddly — the UI flow they describe gets renamed, rewired, or deleted while the invariant remains true, and the comment is left recounting a workflow nobody can find anymore. Same hazard as naming consumers: the durable thing is the rule; the example is the expendable part.
- **Comment at the abstraction a caller uses, not the mechanism behind it**: When code consumes a named helper, flag, or interface that hides a condition (`tallyVisible()`, `isReturnVisit()`, `prefersReducedMotion()`), comments at the call site describe it in the helper's *own terms* — what it means — never the concrete thing currently feeding it. A caller queries the boolean and must not care what feeds it, so it must not narrate that either: write "skip the scan when the tally isn't shown", not "skip it in dev mode"; "on a return visit", not "when `cb_visited` is set". The mechanism is free to change (a dev-console gate becomes a 100%-completion gate; an IP check becomes a GPS check) without turning those comments into lies. Only the abstraction's *own definition* names its current implementation — and even there, frame it as current ("gated to the dev console *while the feature bakes*"), not permanent. Test: if you swapped what's behind the abstraction, would the caller's comment still read true? If not, it commented at the wrong level. Same failure mode as naming consumers — the durable thing is the contract, not today's wiring.
- **Preserve comments when rewriting files**: Reaching for `Write` to replace an existing file — instead of `Edit` on the specific regions — tends to silently drop the surrounding section headers, explainer comments, and subsystem banners that aren't visible in your mental model of the new code. Before finalizing a `Write` that overwrites an existing file, diff the old and new contents (or read the prior version from git) and confirm every comment in the original either survives, gets replaced by a more useful one, or is intentionally removed with a reason. Prefer `Edit` for surgical changes; the preservation is automatic.
- **Don't restate values or units near constants**: Comments next to a constant must not embed the value, the unit, or any phrase that goes stale when the constant is tuned. Don't write "// 30-minute window", "// 3-hour throttle", "// 600ms settle delay", "// past the 30-minute throttle" — every one of those becomes a lie the moment someone changes the number. The constant's name and value carry the *what*; the comment only adds value if it explains the *why* (the trade-off, the constraint, the reason this knob exists). If a comment passes the test "would this still be correct if the value doubled?", keep it; otherwise rewrite or delete. Same rule applies to test code: a comment that says "advance 10 minutes — still within the throttle" rots when the throttle moves; "still within the throttle window" doesn't, and the symbolic timer math (`THROTTLE_MS / 3`) carries the rest.
- **Comment footprint matches code footprint**: A module that touches a concern at one line gets one comment about that concern, at that line — not a header paragraph, not a per-function "X-aware" qualifier, not docstring sentences explaining how X interacts with each export. If the code's participation in X is "call one helper at one boundary," the prose's participation should match. Example: a module that adds an overlay element with a CSS class to opt into a global flip rule doesn't need its file header to discuss flipping, doesn't need each public function's docstring to mention the flipped case, and doesn't need internal comments to explain how the flip affects unrelated code paths. The class name and the helper name carry the meaning at the one site that uses them. Test: if a reader deletes every comment that mentions concern X and the code still teaches them what they need to know to edit it, those comments were noise. The reader who needs to understand X follows the import or grep; they don't need every function in the file to remind them X exists.

## Current Themes

Order below matches the declaration order in `js/themes/registry.js`. Exact thresholds (click counts, hold durations) are named constants in each theme's module / `js/themes/triggers.js` — kept out of this table so it doesn't rot when they're tuned.

| Theme | Trigger | Body class | Key files |
|-------|---------|------------|-----------|
| Frozen | Repeated logo clicks | `body.frozen` | `js/themes/frozen.js`, `js/particles/frozen.js` |
| Deep-sea | Long-press the footer | `body.deep-sea` | `js/themes/deep-sea.js`, `js/particles/deep-sea.js` |
| Blocky | Repeated appearance-toggle clicks | `body.blocky` | `js/themes/blocky.js`, `js/particles/blocky.js` |
| Rainy | Repeated hero-tag clicks | `body.rainy` | `js/themes/rainy.js`, `js/particles/rain.js` |
| Paper | Type SKETCH / DRAW | `body.paper` | `js/themes/paper.js`, `js/particles/paper.js` |
| VHS | Rapid Escape presses | `body.vhs` | `js/themes/vhs.js`, `js/particles/vhs.js` |
| Upside-down | Repeated bottom overscroll | `body.upside-down` | `js/themes/upside-down.js`, `js/particles/upside-down.js` |
| Constellation | Trace a star pattern (click tagged stars) | `body.constellation` | `js/themes/constellation.js`, `js/particles/constellation.js` |
| Matrix | Type REDPILL (BLUEPILL exits) | `body.matrix` | `js/themes/matrix.js`, `js/particles/matrix.js` |
| Wanted | Type a GTA:SA cheat (HESOYAM / BRINGITON) | `body.wanted` | `js/themes/wanted.js`, `js/particles/wanted.js` |

Every theme can *also* be toggled by entering the letters of its name — tapping them on the page (touch) or typing them (keyboard). This is a cross-cutting path in `js/themes/spell-trigger.js` that reads names from the registry (no per-theme code), giving touch users a route to themes whose primary trigger needs a keyboard, and to their achievements. Like `lights-out.js` and `konami.js`, it lives outside the per-theme factory and calls `toggleTheme`. The same speller also fires *incantations* — secret words in `js/effects/incantations.js` that trigger a one-shot effect instead of a theme — through one shared matcher (themes toggle, words cast).

## Focus Areas

- **New themes/easter eggs**: The palette + theme architecture is designed for this. Each new theme is additive — override object, CSS section, body class, trigger module.
- **Progressive indicators**: Easter eggs should have visible buildup before triggering (the frozen theme has 5 stages from subtle to dramatic). Users should feel something is happening before the payoff.
- **Interactivity**: Background elements should respond to user input. Clicks repel, drags attract with orbit, scroll pushes. This makes the canvas feel alive rather than decorative.
- **Performance**: The site must feel smooth on mobile. Canvas operations are the bottleneck — minimize gradient creation, use pools over allocation, skip invisible particles early.
- **Code hygiene**: Constants extracted, patterns reused, no dead code, no speculative abstractions. Each file should be readable top-to-bottom.

# Conventions

## Commit Messages

- Always use a single-line commit message in imperative
- No prefixes: no task IDs, no repo names, no conventional commit prefixes (fix:, refactor:, etc.)
- Just describe what was done, e.g. "Add retry logic for failed API calls"

## Formatting

Run prettier on staged files before every commit, so the commit doesn't drag in formatter drift from unrelated files that someone forgot to format earlier. Workflow:

1. Stage the files you want to commit (`git add <files>`).
2. Format only those staged files:
   ```
   git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(js|css|html)$' | xargs -r npx prettier --write
   ```
3. Re-stage any changes prettier made (`git add <same files>`).
4. Commit.

Never run `npx prettier --write "**/*.{js,css,html}"` as part of a normal commit — that reformats the whole tree and can silently pick up drift outside your change. Whole-tree formatting belongs in its own dedicated commit (e.g., "Run formatter over all files").

## Testing

### Manual verification

- Do NOT start a dev server yourself (no `http-server`, `npx serve`, `python -m http.server`, etc.)
- When you need to verify something in the browser, ask the user to test it and describe what to check

### Automated tests

- Vitest + happy-dom. Run with `npm test` (watch mode: `npm run test:watch`).
- Unit tests live under `tests/unit/` and mirror the `js/` source tree: `js/achievements/storage.js` → `tests/unit/achievements/storage.test.js`, `js/analytics/bridges/appearance.js` → `tests/unit/analytics/bridges/appearance.test.js`. One test file per source module. Mirror existing files for structure — they are the pattern library.
- Integration tests (cross-module behavior, end-to-end flows) live under `tests/integration/` in a flat layout.
- Test the contract, not the implementation. Prefer `toEqual` over `toBe` unless reference identity is part of what the function promises — a test that breaks when a function starts returning a shallow copy of the same value is coupled to the wrong thing.
- Deterministic time only. Use `vi.useFakeTimers()` and `vi.setSystemTime()` — no real-time waits, no flakiness.
- Modules with module-level state (storage, motion, appearance) need `vi.resetModules()` + re-import in `beforeEach` so state doesn't leak between tests. See `tests/unit/achievements/storage.test.js` for the pattern.
- Prefer dispatching real events over calling the registered handler directly — tests the wiring, not just the logic.
- Don't over-mock. Stub narrow DOM APIs (`IntersectionObserver`, `matchMedia`) at the edges; leave everything else real.
- Pure helpers, data registries, and state-machine modules are highest-ROI targets. Transient visual effects are lowest — don't chase coverage for its own sake.
- Keep the suite fast. If a single test approaches ~100ms of wall time, check whether real time could be replaced with fake timers. Baseline to defend: ~1s for the whole unit-test suite.
- **Derive test timings from exported source constants, not magic numbers.** Tunable knobs (throttle windows, settle delays, dead zones) belong to the source module — export them and have tests `import { THROTTLE_MS } from "..."` then derive symbolically: `THROTTLE_MS / 3` for "well within", `THROTTLE_MS + SLACK_MS` for "past". This means tuning the source automatically retunes the tests, and "is this still within the throttle?" stays true regardless of the value. The same rule applies to other magic literals in test code: name them. A constant called `WITHIN_THROTTLE_MS` documents intent in a way `10 * 60 * 1000` never can. Use a small `SLACK_MS` for the "+ epsilon" pattern when you need to land just past a boundary. Re-declaring source constants verbatim in tests is the wrong fix — it loses the "tune source, tests follow" property and replaces it with a typo-detector that's not worth the maintenance cost for tuning knobs. (For values whose *exact* number is part of the contract — e.g. fixed by an external API spec — re-declaration is fine, but those are rare.)

## GitHub

- Always use the `gh` CLI for GitHub operations (PRs, issues, repos, etc.)
- Do NOT use the GitHub MCP server tools — the token is not approved

## Post-batch self-review

After a batch of commits that together add a new module or ~200+ lines of changed code, before moving on, review the diffs critically as if reviewing a PR you didn't write. Read each file fresh — duplication across files, magic numbers, fragile couplings (init order, shared mutable state), missed conventions from this file. Flag what's worth fixing. If anything is, add fixup commits targeting the relevant originals (`git commit --fixup=<sha>`) and autosquash (`git rebase -i --autosquash <base>`), so the final history shows clean commits, not "add feature" + "fix feature I just wrote".

Skip this for small, self-contained commits where mid-flight review already covered the ground — no ritual needed.
