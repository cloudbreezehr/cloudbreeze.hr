// ── Dev CSS Loader ──
// Lazily injects css/dev.css the first time any dev tool needs it.

let loaded = false;

export function loadDevCss() {
  if (loaded) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "css/dev.css";
  document.head.appendChild(link);
  loaded = true;
}
