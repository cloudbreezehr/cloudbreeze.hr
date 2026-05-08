// ── Console Adapter ──
// Default adapter for development and initial production rollout.  Logs
// events to the console so the team can verify the taxonomy before a
// vendor contract is signed.  Zero network I/O, zero storage, zero PII
// leakage risk.
//
// Swap for a real vendor by passing `adapter: vendorAdapter` to
// initAnalytics().  The vendor adapter implements the same contract:
//   { name, init?, send(events), flush? }

const STYLE_HEAD = "color:#88d4f7;font-weight:600";
const STYLE_NAME = "color:#ffa040;font-weight:600";
const STYLE_DIM = "color:#888";

export const consoleAdapter = {
  name: "console",
  init() {
    if (typeof console !== "undefined" && console.info) {
      console.info("%c[analytics]", STYLE_HEAD, "console adapter active");
    }
  },
  send(events) {
    if (!events || !events.length) return;
    for (const e of events) {
      console.groupCollapsed(
        "%c[analytics]%c %s %c(%d props)",
        STYLE_HEAD,
        STYLE_NAME,
        e.name,
        STYLE_DIM,
        Object.keys(e.props).length,
      );
      console.log(e.props);
      console.groupEnd();
    }
  },
  flush() {},
};
