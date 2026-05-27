// ── Hint Tooltip ──
// Lightweight tooltip overlay for revealing per-achievement hints on
// hover.  A single element is reused across the page —
// showHintTooltip repositions it and swaps the text; hideHintTooltip
// fades it out.  The module owns only the tooltip DOM node; callers
// decide when a tooltip should be shown.

const TOOLTIP_OFFSET_Y = 6;
const TOOLTIP_EDGE_MARGIN_PX = 4;

let tooltipEl = null;

function ensureTooltip() {
  if (tooltipEl) return;
  tooltipEl = document.createElement("div");
  tooltipEl.className = "achievement-tooltip";
  document.body.appendChild(tooltipEl);
}

function positionTooltip(anchor, preferAbove) {
  if (!tooltipEl) return;
  const rect = anchor.getBoundingClientRect();
  tooltipEl.style.left = `${rect.left + rect.width / 2}px`;

  // Place on preferred side, flip if it overflows
  const above = () => {
    tooltipEl.style.top = `${rect.top - TOOLTIP_OFFSET_Y}px`;
    tooltipEl.style.transform = "translateX(-50%) translateY(-100%)";
  };
  const below = () => {
    tooltipEl.style.top = `${rect.bottom + TOOLTIP_OFFSET_Y}px`;
    tooltipEl.style.transform = "translateX(-50%) translateY(0)";
  };

  (preferAbove ? above : below)();
  const tipRect = tooltipEl.getBoundingClientRect();
  const overflows = preferAbove
    ? tipRect.top < 0
    : tipRect.bottom > window.innerHeight;
  if (overflows) (preferAbove ? below : above)();

  // Horizontal clamp.  The transform centers the tooltip on the
  // `left` value via translateX(-50%); shift the anchor inward when
  // the resulting rect would cross either viewport edge.  Skip when
  // width is zero — the tooltip hasn't been laid out yet and the rect
  // has no meaningful coordinates to clamp against.
  const clampedRect = tooltipEl.getBoundingClientRect();
  if (clampedRect.width > 0) {
    let shift = 0;
    if (clampedRect.left < TOOLTIP_EDGE_MARGIN_PX) {
      shift = TOOLTIP_EDGE_MARGIN_PX - clampedRect.left;
    } else if (clampedRect.right > window.innerWidth - TOOLTIP_EDGE_MARGIN_PX) {
      shift = window.innerWidth - TOOLTIP_EDGE_MARGIN_PX - clampedRect.right;
    }
    if (shift !== 0) {
      const currentLeft = parseFloat(tooltipEl.style.left) || 0;
      tooltipEl.style.left = `${currentLeft + shift}px`;
    }
  }
}

export function showHintTooltip(anchor, hint, preferAbove) {
  ensureTooltip();
  tooltipEl.textContent = hint;
  tooltipEl.classList.add("visible");
  positionTooltip(anchor, preferAbove);
}

export function hideHintTooltip() {
  if (tooltipEl) tooltipEl.classList.remove("visible");
}

// Test hook — discard the singleton so each test starts without a
// leftover DOM node attached from a prior run.
export function _resetForTests() {
  if (tooltipEl && tooltipEl.parentNode) {
    tooltipEl.parentNode.removeChild(tooltipEl);
  }
  tooltipEl = null;
}
