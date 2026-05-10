// ── Focus Trap ──
// Keeps keyboard focus inside a container while it's open.  Used by
// the Cloudlog panel so Tab / Shift+Tab cycle through its controls
// instead of escaping behind the panel into page content the user
// can't see.
//
// Contract:
//   - `trapFocus(container, { initialFocus })` starts trapping and
//     returns a cleanup function.  Cleanup restores focus to whatever
//     had focus when the trap started.
//   - Trap is list-based, not range-based: we recompute focusable
//     descendants on each Tab so newly-added controls (e.g. tab
//     switches that re-render the body) are always in the cycle.
//   - If the container contains no focusable elements, Tab is
//     swallowed (no escape, but also no focus movement).

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function focusableDescendants(container) {
  const nodes = container.querySelectorAll(FOCUSABLE_SELECTOR);
  // Filter out elements that are hidden via display:none / visibility:
  // hidden — those cannot receive focus and shouldn't be in the cycle.
  // offsetParent is null for display:none descendants; matches the
  // pragmatic "is this actually visible" check other trap libraries use.
  return Array.from(nodes).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function trapFocus(container, { initialFocus } = {}) {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  function onKeydown(e) {
    if (e.key !== "Tab") return;
    const focusables = focusableDescendants(container);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  container.addEventListener("keydown", onKeydown);

  // Move focus into the container on start.  Prefer the caller's
  // requested initialFocus; fall back to the first focusable child.
  if (initialFocus && container.contains(initialFocus)) {
    initialFocus.focus();
  } else {
    const focusables = focusableDescendants(container);
    if (focusables.length > 0) focusables[0].focus();
  }

  return function release() {
    container.removeEventListener("keydown", onKeydown);
    // Restore focus to whatever had it before — but only if nothing
    // else has taken focus in the meantime (defensive: a programmatic
    // focus elsewhere during cleanup would otherwise be stomped).
    if (
      previouslyFocused &&
      document.contains(previouslyFocused) &&
      (document.activeElement === null ||
        document.activeElement === document.body ||
        container.contains(document.activeElement))
    ) {
      previouslyFocused.focus();
    }
  };
}
