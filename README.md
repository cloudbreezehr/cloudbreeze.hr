# cloudbreeze.hr
Website for [Cloudbreeze d.o.o.](https://cloudbreeze.hr) — a cloud engineering consultancy based in Croatia, EU.

The site started as a marketing page, but grew into something more: a playground for visual effects, easter-egg themes, achievements, and a live dev console. Consider it both the company's front door and a signal of the kind of work we like — considered, interactive, and built without shortcuts.

## What's in here
- **Interactive sky canvas** — stars, clouds, wisps, and horizon glow that evolve as you scroll. Particles respond to clicks, drags, and hover.
- **Hidden themes** — triggered by secret interactions. Each transforms the visual language: palette, cursor, transitions, post-processing. Stack the right pair and they fuse into a hybrid.
- **The real sky** — the canvas agrees with the sky outside: the actual moon phase at night, dawn and dusk tints on your local clock, more shooting stars during real meteor showers, and the live weather over Pula in the footer.
- **The sky of the day** — the star arrangement is seeded from the date, the same for every visitor, gone at midnight. `#sky=<date>` links revisit a past day.
- **A hidden terminal** — a Quake-style console with `kubectl` for themes, spells on tap, `sudo rm -rf /`, and a passport command that carries your progress to another device.
- **Photo mode & speedrun clock** — clear the page for a savable sky portrait, or race the Cloudlog to 100% against a timer with per-set splits.
- **Achievement system** — a "Cloudlog" that tracks exploration, mastery, theme-specific, and meta challenges. Event-based, so every interaction can become an achievement.
- **Dev console** — a dockable, live-editable panel for the tunable constants behind every effect. Open with `#dev` in the URL or `Ctrl+Shift+Period`.
- **Accessibility** — respects `prefers-reduced-motion`, narrates theme changes and spells to screen readers, keyboard-focusable controls.
- **Installable** — a service worker makes the whole site work offline and installable as an app.

## Stack
Pure HTML, CSS, and vanilla JavaScript. No frameworks, no build step, no dependencies — just open `index.html` in a browser.

External resources loaded at runtime:

- [Google Fonts](https://fonts.google.com) — Syne + DM Mono
- [Open-Meteo](https://open-meteo.com) — keyless current-weather call for the footer badge (the site degrades gracefully without it)

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
