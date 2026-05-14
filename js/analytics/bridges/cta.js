// ── CTA Bridge ──
// Maps the specific conversion-relevant anchors to stable cta_ids so we
// can answer "how many people clicked Start a project vs Explore services"
// without guessing from href patterns.  Every cta_click also records the
// scroll depth and session elapsed ms so we can tell whether users convert
// early or deep in the journey.

import { track } from "../core.js";
import { sessionCounters } from "./session.js";

// Selector → cta_id.  More-specific selectors come first.
const CTA_SELECTORS = [
  { sel: ".hero .btn-primary", id: "hero_primary_contact" },
  { sel: ".hero .btn-ghost", id: "hero_ghost_services" },
  { sel: "nav .nav-cta", id: "nav_cta" },
  { sel: "nav .nav-logo", id: "nav_logo" },
  { sel: "#contact a.contact-link[href^='mailto:']", id: "contact_email" },
  { sel: "#contact a.contact-link[href*='linkedin']", id: "contact_linkedin" },
  { sel: "footer a.footer-link[href^='mailto:']", id: "footer_email" },
  { sel: "footer a.footer-link[href*='linkedin']", id: "footer_linkedin" },
];

function matchCta(el) {
  for (const { sel, id } of CTA_SELECTORS) {
    const hit = el.closest && el.closest(sel);
    if (hit) return { id, el: hit };
  }
  return null;
}

function hrefType(href) {
  if (!href) return "unknown";
  if (href.startsWith("mailto:")) return "mailto";
  if (href.includes("linkedin.com")) return "linkedin";
  if (href.startsWith("#") || href.startsWith("/")) return "internal";
  try {
    const u = new URL(href);
    return u.hostname === location.hostname ? "internal" : "external";
  } catch {
    return "unknown";
  }
}

export function initCtaBridge() {
  const startedAt = Date.now();
  let priorClicks = 0;

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!target || !target.closest) return;

    const cta = matchCta(target);
    if (cta) {
      sessionCounters.clickTotalCta++;
      // since_last_theme_activation_ms is null when the visitor converted
      // without ever activating a theme — the "passive" cohort.  A real
      // number puts the click inside an "in-play" session and lets us
      // see whether discovery helps or hurts the conversion rate.
      const lastTheme = sessionCounters.lastThemeActivationTs;
      track("cta_click", {
        cta_id: cta.id,
        scroll_depth_at_click: sessionCounters.scrollMaxDepth,
        session_elapsed_ms: Date.now() - startedAt,
        clicks_before_this: priorClicks,
        since_last_theme_activation_ms:
          lastTheme != null ? Date.now() - lastTheme : null,
      });
      priorClicks++;
    }

    // Outbound link tracking — catches anything routed off-site even if
    // it isn't in the CTA list (e.g. future partner links).
    const a = target.closest("a[href]");
    if (a) {
      const href = a.getAttribute("href") || "";
      const type = hrefType(href);
      if (type === "mailto" || type === "linkedin" || type === "external") {
        let domain = null;
        try {
          if (href.startsWith("mailto:")) {
            domain = href.split("@")[1] || null;
          } else {
            domain = new URL(href, location.href).hostname || null;
          }
        } catch {
          // ignore
        }
        track("outbound_link", { href_type: type, domain });
      }
    }
  });
}
