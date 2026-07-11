// ── Dev-view gate ──
// Single source of truth for whether dev-only views should show. Currently
// keyed to the dev console being open; centralised so that gate can change
// (e.g. to "opened at least once this session") in one place, rather than
// every reader testing the body class itself.

export function isDevActive() {
  return document.body.classList.contains("dev-active");
}
