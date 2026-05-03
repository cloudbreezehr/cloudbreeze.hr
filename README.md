# cloudbreeze.hr
Website for [Cloudbreeze d.o.o.](https://cloudbreeze.hr) — a cloud engineering consultancy based in Croatia, EU.

The site started as a marketing page, but grew into something more: a playground for visual effects, easter-egg modes, achievements, and a live dev console. Consider it both the company's front door and a signal of the kind of work we like — considered, interactive, and built without shortcuts.

## What's in here
- **Interactive sky canvas** — stars, clouds, wisps, and horizon glow that evolve as you scroll. Particles respond to clicks, drags, and hover.
- **Hidden sub-modes** — triggered by secret interactions. Each transforms the visual language: palette, cursor, transitions, post-processing.
- **Achievement system** — a "Cloudlog" that tracks exploration, mastery, mode-specific, and meta challenges. Event-based, so every interaction can become an achievement.
- **Dev console** — a dockable, live-editable panel for the tunable constants behind every effect. Open with `#dev` in the URL or `Ctrl+Shift+Period`.
- **Accessibility** — respects `prefers-reduced-motion`, hides decorative canvas from screen readers, keyboard-focusable controls.

## Stack
Pure HTML, CSS, and vanilla JavaScript. No frameworks, no build step, no dependencies — just open `index.html` in a browser.

External resources loaded at runtime:

- [Google Fonts](https://fonts.google.com) — Syne + DM Mono

## Running locally
```bash
# Option 1 — just open it
open index.html

# Option 2 — serve it (avoids any browser file:// quirks)
npx serve .
# or
python3 -m http.server 8080
```

## Architecture
See [CLAUDE.md](./CLAUDE.md) for a deep dive into the canvas module structure, palette system, easter-egg pattern, and achievement integration.

## License
© 2025 Cloudbreeze d.o.o. All rights reserved.
