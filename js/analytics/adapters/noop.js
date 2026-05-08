// ── Noop Adapter ──
// Active when consent is denied.  Swallows every batch silently so the
// core queue drains without side effects.

export const noopAdapter = {
  name: "noop",
  init() {},
  send() {},
  flush() {},
};
