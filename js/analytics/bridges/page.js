// ── Page Bridge ──
// Scroll depth thresholds + section view / dwell via IntersectionObserver +
// nav link clicks.  Scroll is already emitted frequently on the achievement
// topic; we sample it down to 4 bucket events per session (25/50/75/100).

import { track } from "../core.js";
import { sessionCounters } from "./session.js";

const SCROLL_THRESHOLDS = [25, 50, 75, 100];
const SECTION_VIEW_RATIO = 0.5;
const SECTION_IDS = ["services", "about", "contact"];
// back_to_top latches once the user has reached near-bottom and fires
// a single event when they scroll back near-top.  Hysteresis keeps
// the two boundaries from racing.
const BACK_TO_TOP_BOTTOM = 95;
const BACK_TO_TOP_TOP = 5;

function asPercent(progress) {
  return Math.min(100, Math.max(0, Math.floor(progress * 100)));
}

export function initPageBridge() {
  const startedAt = Date.now();
  const firedThresholds = new Set();
  let reachedBottom = false;
  let backToTopFired = false;

  window.addEventListener("achievement", (e) => {
    const d = e.detail;
    if (!d) return;
    if (d.type === "keyboard-shortcut") {
      track("keyboard_shortcut_used", {
        key: d.key || null,
        ctrl: !!d.ctrl,
        shift: !!d.shift,
        alt: !!d.alt,
      });
      return;
    }
    if (d.type !== "scroll") return;
    const pct = asPercent(d.progress);
    if (pct > sessionCounters.scrollMaxDepth) {
      sessionCounters.scrollMaxDepth = pct;
    }
    for (const t of SCROLL_THRESHOLDS) {
      if (pct >= t && !firedThresholds.has(t)) {
        firedThresholds.add(t);
        track("scroll_depth", {
          percent: t,
          time_from_start_ms: Date.now() - startedAt,
        });
      }
    }
    if (pct >= BACK_TO_TOP_BOTTOM) reachedBottom = true;
    if (reachedBottom && !backToTopFired && pct <= BACK_TO_TOP_TOP) {
      backToTopFired = true;
      track("back_to_top", {
        time_from_start_ms: Date.now() - startedAt,
      });
    }
  });

  // Section view / dwell.  One entry per section, track first-view time
  // and accumulate dwell between enter and exit.
  const sectionState = new Map();
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    sectionState.set(id, {
      el,
      viewed: false,
      enteredAt: 0,
      dwellMs: 0,
      viewCount: 0,
      maxScroll: 0,
    });
  }

  if (sectionState.size > 0 && typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          const state = sectionState.get(id);
          if (!state) continue;
          if (entry.isIntersecting) {
            state.enteredAt = Date.now();
            state.viewCount++;
            if (!state.viewed) {
              state.viewed = true;
              track("section_view", {
                section_id: id,
                time_to_view_ms: Date.now() - startedAt,
                view_count: state.viewCount,
              });
            }
          } else if (state.enteredAt > 0) {
            const dwell = Date.now() - state.enteredAt;
            state.dwellMs += dwell;
            state.enteredAt = 0;
            track("section_dwell", {
              section_id: id,
              dwell_ms: dwell,
              max_scroll_in_section: state.maxScroll,
            });
          }
        }
      },
      { threshold: SECTION_VIEW_RATIO },
    );
    for (const { el } of sectionState.values()) observer.observe(el);
  }

  // Nav clicks — internal anchors only.  External are covered by the CTA
  // bridge so each click lands in exactly one bucket.
  document.addEventListener("click", (e) => {
    const a =
      e.target && e.target.closest && e.target.closest("nav a[href^='#']");
    if (!a) return;
    const target = a.getAttribute("href").slice(1) || null;
    track("nav_click", {
      target_id: target,
      from_section: currentSection(),
    });
  });

  // Keyboard-usage flag for session_end.  Cheap one-shot.
  window.addEventListener(
    "keydown",
    () => {
      sessionCounters.keyboardUsed = true;
    },
    { once: true },
  );
}

function currentSection() {
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight / 2 && rect.bottom > 0) return id;
  }
  return "hero";
}
