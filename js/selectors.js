// CSS selector matching every interactive UI overlay that sits on top
// of the background canvas.  Used by click handlers that need to skip
// canvas effects (fury, click-burst, theme triggers) when the click
// lands inside one of these regions.
export const UI_OVERLAY_SELECTOR =
  "nav, .achievement-panel, .achievement-toast-container, .dev-console";
