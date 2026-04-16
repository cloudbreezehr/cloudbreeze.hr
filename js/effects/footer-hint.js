// ── Footer Hover Hint ──
// Adds a subtle pulsing glow along the footer's top edge after
// the pointer has lingered over it, hinting that the area is
// interactive (deep-sea trigger zone).

import { defineConstants } from "../dev/registry.js";

const HINT = defineConstants("footer.hint", {
  LINGER_MS: {
    value: 1000,
    min: 200,
    max: 5000,
    step: 100,
    description: "Hover time before glow appears",
  },
});

const HINTING_CLASS = "footer-hinting";

export function initFooterHint() {
  const footerEl = document.querySelector("footer");
  if (!footerEl) return;

  let lingerTimer = null;

  footerEl.addEventListener(
    "pointerenter",
    () => {
      // No hint needed once deep-sea has been discovered
      if (document.body.classList.contains("deep-sea")) return;
      lingerTimer = setTimeout(() => {
        footerEl.classList.add(HINTING_CLASS);
      }, HINT.LINGER_MS);
    },
    { passive: true },
  );

  footerEl.addEventListener(
    "pointerleave",
    () => {
      clearTimeout(lingerTimer);
      footerEl.classList.remove(HINTING_CLASS);
    },
    { passive: true },
  );
}
