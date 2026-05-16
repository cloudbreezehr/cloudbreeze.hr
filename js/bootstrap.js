// ── Page Bootstrap ──
// Wires every module up in a specific order.  External module so the
// page can ship with a strict script-src 'self' CSP — inline scripts
// would force 'unsafe-inline' and undo most of the policy's value.
//
// Order matters in a few places and is called out where it does.
// Otherwise the initializers are independent and could run in any
// order.

import { initAppearance } from "./appearance.js";
import { injectLayerVars } from "./layers.js";
import { initNav } from "./nav.js";
import { initCanvas } from "./canvas.js";
import { subscribe as subscribeScroll } from "./scroll-bus.js";
import { initCursor } from "./cursor.js";
import { initReveal } from "./reveal.js";
import { initTilt } from "./service-cards.js";
import { initButtonRipple } from "./effects/button-ripple.js";
import { initNavSparkle } from "./effects/nav-sparkle.js";
import { initLogoBreathing } from "./effects/logo-breathing.js";
import { initLogoParallax } from "./effects/logo-parallax.js";
import { initThemeHistoryHud } from "./effects/theme-history-hud.js";
import { initCursorIdle } from "./effects/cursor-idle.js";
import { initFooterHint } from "./effects/footer-hint.js";
import { initFirstPaintMote } from "./effects/first-paint-mote.js";
import { initUpsideDown } from "./themes/upside-down.js";
import { initFrozen } from "./themes/frozen.js";
import { initDeepSea } from "./themes/deep-sea.js";
import { initBlocky } from "./themes/blocky.js";
import { initRainy } from "./themes/rainy.js";
import { initPaper } from "./themes/paper.js";
import { initVhs } from "./themes/vhs.js";
import { toggleDevConsole, openDevConsole } from "./dev/console.js";
import { toggleFps } from "./dev/fps.js";
import { onKey } from "./keyboard.js";
import { initAchievements } from "./achievements/index.js";
import { initAnalytics } from "./analytics/index.js";
import { createPostHogAdapter } from "./analytics/adapters/posthog.js";

// ── Hero parallax tunables ──
const PARALLAX_LAYERS = [
  { selector: ".hero-tag", rate: 0.12 },
  { selector: ".hero-title .line-1", rate: 0.06 },
  { selector: ".hero-title .line-2", rate: 0.1 },
  { selector: ".hero-sub", rate: 0.14 },
  { selector: ".hero-actions", rate: 0.18 },
];
const SCROLL_HINT_FADE_AT = 60;
const PROD_HOSTNAME = "cloudbreeze.hr";
const POSTHOG_API_KEY = "phc_DkjMmwyEb9HyRG6kwmabdvkhmjZm2tid95gBK7sJkw3i";

// CSS layer variables — must run before any DOM-creating init below,
// because every later module that appends an overlay reads
// `var(--z-...)` from its CSS rules.
//
// First-paint window: this module is deferred (ES modules are
// evaluated after document parse).  The stylesheet has already been
// applied to the document by the time this runs, so any
// `z-index: var(--z-foo)` rule on an element present in the initial
// HTML (#bg-canvas, .page, nav, body::after grain) resolves to `auto`
// for one paint frame before injection lands.  In practice the
// initial set of fixed/positioned elements stack correctly under
// `auto` (document order matches the intended order); fixed overlays
// that *would* depend on these values (toasts, panels, theme wipes)
// don't exist in the DOM yet.  If injection is ever skipped or
// throws, every var() falls through to `auto` — a louder failure
// than the prior hard-coded values, which is intentional.
injectLayerVars();

// Analytics first — bridges attach listeners before other modules
// start dispatching events, so session_start, early scroll_depth, and
// the initial theme-buildup all land in the stream.  Wrapped so a
// broken adapter or context lookup can never break page load.
//
// Strict production gate: only cloudbreeze.hr sends to PostHog.  Any
// other hostname (localhost, IP, preview subdomain) falls through to
// the default console adapter so stats aren't polluted.
try {
  const isProd = location.hostname === PROD_HOSTNAME;
  initAnalytics(
    isProd
      ? { adapter: createPostHogAdapter({ apiKey: POSTHOG_API_KEY }) }
      : undefined,
  );
} catch (err) {
  console.warn("[analytics] init failed:", err);
}

const appearance = initAppearance(document.querySelector(".appearance-toggle"));
initNav(document.querySelector("nav"), appearance);
initCanvas(document.getElementById("bg-canvas"), appearance);
initCursor(
  document.getElementById("cursor"),
  document.getElementById("cursor-ring"),
);
initReveal();
initTilt();
initButtonRipple();
initNavSparkle();
initLogoBreathing();
initLogoParallax();
initCursorIdle(
  document.getElementById("cursor"),
  document.getElementById("cursor-ring"),
);
initFooterHint();
initFirstPaintMote();
initUpsideDown();
initFrozen();
initDeepSea();
initBlocky(document.querySelector(".appearance-toggle"));
initRainy();
initPaper();
initVhs();
initThemeHistoryHud();
initAchievements();

// Subtle parallax on hero elements — each layer drifts at a different
// rate.  Uses the CSS `translate` property (not `transform`) so it
// composes with fadeUp animation.
const parallaxEls = PARALLAX_LAYERS.map(({ selector, rate }) => ({
  el: document.querySelector(selector),
  rate,
}));
subscribeScroll(({ scrollY }) => {
  const isFlipped = document.body.classList.contains("upside-down");
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const y = isFlipped ? maxScroll - scrollY : scrollY;
  if (y > window.innerHeight) return;
  for (const p of parallaxEls) {
    if (p.el) p.el.style.translate = `0 ${y * p.rate}px`;
  }
});

// Fade out scroll hint once the user starts scrolling
const scrollHint = document.querySelector(".scroll-hint");
if (scrollHint) {
  const unsub = subscribeScroll(({ scrollY }) => {
    if (scrollY > SCROLL_HINT_FADE_AT) {
      scrollHint.style.animation = "none";
      scrollHint.style.opacity = "1";
      void scrollHint.offsetHeight;
      scrollHint.style.transition = "opacity 0.6s";
      scrollHint.style.opacity = "0";
      unsub();
    }
  });
}

// Dev console — triggered via URL hash #dev or Ctrl+Shift+.
if (window.location.hash === "#dev") openDevConsole();
window.addEventListener("hashchange", () => {
  if (window.location.hash === "#dev") openDevConsole();
});
onKey(".", toggleDevConsole, {
  ctrl: true,
  shift: true,
  allowInInput: true,
});
onKey("F", toggleFps, { ctrl: true, shift: true, allowInInput: true });
