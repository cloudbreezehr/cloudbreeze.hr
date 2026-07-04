// ── Device Input Capabilities ──
// Best-effort detection of what the current device can do, used to scope
// achievement completion so every device can reach 100%.
//
// A touch-only device (no hover-capable pointer) is assumed to also lack a
// physical keyboard — the two travel together on phones and tablets, and there
// is no reliable keyboard-presence media query. A device with a real hover
// pointer (mouse/trackpad) is treated as having a keyboard too. Evaluated live
// (matchMedia is cheap) so attaching a mouse mid-session is reflected on the
// next read.

const TOUCH_ONLY_QUERY = "(hover: none)";

function isTouchOnly() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(TOUCH_ONLY_QUERY).matches
  );
}

// Capabilities an achievement may require to be reachable. Both currently
// resolve to "this isn't a touch-only device" — kept as named capabilities so
// each achievement documents *why* it's gated, and so detection can be refined
// per-capability later (e.g. sniffing a connected keyboard) without touching
// the registry.
const CAPABILITY_AVAILABLE = {
  keyboard: () => !isTouchOnly(),
  hover: () => !isTouchOnly(),
  // Side-by-side windows need a desktop-style window manager; touch-only
  // devices run browsers full-screen (or in OS splits that report no
  // usable screen coordinates), so they can't exercise multi-window play.
  multiwindow: () => !isTouchOnly(),
};

// True when the current device can exercise the named capability. Unknown
// capabilities are treated as available so a typo fails open, not silently
// hiding an achievement everywhere.
export function hasCapability(capability) {
  const probe = CAPABILITY_AVAILABLE[capability];
  return probe ? probe() : true;
}
