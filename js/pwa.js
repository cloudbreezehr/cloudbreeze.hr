// ── PWA Bootstrap ──
// Registers the service worker (offline + installability) and reports an
// actual install to the achievement stream. Everything degrades silently:
// no service-worker support means the site simply stays a website.

const SW_URL = "/sw.js";

export function initPwa() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(SW_URL).catch((err) => {
    console.warn("[pwa] service worker registration failed:", err);
  });
  window.addEventListener("appinstalled", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "pwa-installed" } }),
    );
  });
}
