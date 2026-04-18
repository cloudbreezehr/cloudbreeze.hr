// ── Dev CSS Loader ──
// Lazily injects a stylesheet the first time it's needed, keyed by href
// so each file loads exactly once regardless of how many callers request it.

const loaded = new Set();

export function loadCssOnce(href) {
  if (loaded.has(href)) return;
  loaded.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
