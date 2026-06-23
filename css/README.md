# Stylesheets

The site's CSS is split into small partials, each loaded by its own
`<link>` in `index.html`. There is **no build step** — the browser fetches
the partials directly (they multiplex over one HTTP/2 connection), which keeps
the strict-CSP, static-deploy story intact.

## The one rule: link order is the cascade

Stylesheets apply in **`<link>` source order**, regardless of download order.
The order of the `<link>` tags in `index.html` therefore *is* the cascade, and
it reproduces the exact top-to-bottom order of the former single `main.css`.

- **Never reorder the `<link>` tags.** Several rules rely on source order to win
  at equal specificity — e.g. `body.light-appearance` overrides must stay after
  the base rules they recolour but before the per-theme blocks; per-feature
  `@media (prefers-reduced-motion)` blocks must stay after the animations they
  clamp.
- **Adding a partial:** create the file under the appropriate directory and add
  its `<link>` at the position matching where its rules belong in the cascade —
  not necessarily next to its directory-siblings. (For example, `themes/vhs.css`
  and `themes/constellation.css` load *after* `cloudlog/*` because that's where
  they sat in the original file; the directory grouping is for navigation, the
  link order is for correctness.)
- **Invariant:** concatenating every partial in `<link>` order yields the former
  `main.css` byte-for-byte. Any reorganisation that changes rendered output is a
  separate, deliberate change — verify it visually per theme, in light and dark.

## Layout

```
css/
  01-base.css … 12-appearance-light.css   the "spine": reset, tokens, cursor,
                                          canvas, layout, nav, hero, content,
                                          footer, animations, responsive,
                                          nav-extras, light-appearance base
  themes/      one file per theme (frozen, deep-sea, blocky, rainy, paper,
               upside-down, vhs, constellation) — a theme's overlays, wipe,
               keyframes and body block together
  cloudlog/    the achievements panel: panel, activity, cards, toasts,
               theme-history-hud
  effects/     standalone DOM effect styling (first-paint)
  overlays/    modal overlays (keyboard-help, cheatsheet)
  99-overrides.css   global late overrides (print, forced-colors,
                     reduced-transparency, light-mode Cloudlog, mobile, …)
  99-perf.css        the live performance fallback (loads last)
  dev/         dev-only tooling CSS, loaded dynamically by JS — NOT in index.html
```

The numeric prefixes on the spine files encode their load order at a glance.
Files under the domain directories take their load position from `index.html`.

## Guardrail

`tests/unit/css-manifest.test.js` asserts that every partial under `css/`
(except `css/dev/`) is referenced by exactly one stylesheet `<link>` in
`index.html`, and that every linked path exists — so a new partial can't be
silently left unlinked, and a deleted one can't leave a dangling link.
