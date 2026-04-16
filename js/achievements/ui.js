// ── Achievement UI ──
// Nav button, slide-in panel, toast notifications, card rendering.
// All DOM work lives here. No canvas interaction.

import {
  ACHIEVEMENTS,
  SETS,
  getAchievement,
  isModeSet,
  sumPoints,
} from "./registry.js";
import * as storage from "./storage.js";
import { burstFireworks } from "../effects/fireworks.js";

// ── Toast Constants ──
const TOAST_SLIDE_IN_MS = 400;
const TOAST_HOLD_MS = 4000;
const TOAST_SLIDE_OUT_MS = 300;
const TOAST_STAGGER_MS = 200;
const TOAST_MAX_VISIBLE = 3;
const TOAST_GAP_PX = 8;
const TOAST_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const TOAST_RESUME_DELAY_MS = 800;

// ── Panel Constants ──
const PANEL_WIDTH_PX = 360;
const PANEL_SLIDE_MS = 300;

// ── Badge animation ──
const BADGE_PULSE_MS = 600;

// ── Fireworks ──
const FIREWORKS_DELAY_MS = TOAST_SLIDE_IN_MS;

// ── Tooltip Constants ──
const TOOLTIP_OFFSET_Y = 6;

// ── State ──
let navBtn = null;
let badgeEl = null;
let panelEl = null;
let panelOpen = false;
let toastContainer = null;
let toastQueue = [];
let activeToasts = [];
let toastsPaused = false;
let isDevMode = false;
let revealHints = false;
let _escHandler = null;
let _outsideHandler = null;
let tooltipEl = null;

// ── Cloud-check SVG icon ──
const CLOUD_CHECK_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
  <path d="M6 10l2 2 3-3.5"/>
</svg>`;

// ── Locked cloud icon ──
const CLOUD_LOCK_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
</svg>`;

// ── Hidden cloud icon ──
const CLOUD_HIDDEN_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
  <path d="M11.5 12H5C3.3 12 2 10.7 2 9c0-1.5 1-2.7 2.4-3C4.7 4.4 6.2 3 8 3c1.3 0 2.4.6 3.1 1.6.3-.1.6-.1.9-.1 1.7 0 3 1.3 3 3 0 1.5-1.1 2.8-2.5 3"/>
  <text x="8" y="10" text-anchor="middle" font-size="6" fill="currentColor" stroke="none" font-family="monospace">?</text>
</svg>`;

// ── Helpers ──

// ── Timestamp formatting ──
const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const WEEK_MS = 604800000;

let showAbsoluteTime = false;

function formatRelativeTime(ts) {
  const delta = Date.now() - ts;
  if (delta < MINUTE_MS) return "just now";
  if (delta < HOUR_MS) return `${Math.floor(delta / MINUTE_MS)}m ago`;
  if (delta < DAY_MS) return `${Math.floor(delta / HOUR_MS)}h ago`;
  if (delta < WEEK_MS) return `${Math.floor(delta / DAY_MS)}d ago`;
  return formatAbsoluteDate(ts);
}

function formatAbsoluteTime(ts) {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en", { month: "short" });
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function formatAbsoluteDate(ts) {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en", { month: "short" });
  return `${month} ${day}`;
}

function formatTimestamp(ts) {
  return showAbsoluteTime ? formatAbsoluteTime(ts) : formatRelativeTime(ts);
}

function toggleTimestampMode() {
  showAbsoluteTime = !showAbsoluteTime;
  if (!panelEl) return;
  panelEl.querySelectorAll(".achievement-card-time").forEach((el) => {
    const ts = Number(el.dataset.ts);
    if (ts) el.textContent = formatTimestamp(ts);
  });
}

function totalPoints() {
  return sumPoints(storage.getUnlocked());
}

function setCountForSet(setId) {
  const all = ACHIEVEMENTS.filter((a) => a.set === setId);
  const unlocked = all.filter((a) => storage.isUnlocked(a.id));
  return { total: all.length, unlocked: unlocked.length };
}

function hasAnyInSet(setId) {
  return ACHIEVEMENTS.some((a) => a.set === setId && storage.isUnlocked(a.id));
}

// ── Tooltip ──

function ensureTooltip() {
  if (tooltipEl) return;
  tooltipEl = document.createElement("div");
  tooltipEl.className = "achievement-tooltip";
  document.body.appendChild(tooltipEl);
}

function showHintTooltip(anchor, hint, preferAbove) {
  ensureTooltip();
  tooltipEl.textContent = hint;
  tooltipEl.classList.add("visible");
  positionTooltip(anchor, preferAbove);
}

function hideHintTooltip() {
  if (tooltipEl) tooltipEl.classList.remove("visible");
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
}

// ── Nav Button ──

export function createNavButton(onPanelToggle) {
  const actions = document.querySelector(".nav-actions");
  if (!actions) return null;

  navBtn = document.createElement("button");
  navBtn.className = "achievement-btn";
  navBtn.setAttribute("aria-label", "Achievements");
  navBtn.setAttribute("data-tooltip", "Cloudlog");
  navBtn.innerHTML = CLOUD_CHECK_SVG;

  badgeEl = document.createElement("span");
  badgeEl.className = "achievement-badge";
  badgeEl.textContent = "0";
  navBtn.appendChild(badgeEl);

  // Insert before the theme toggle
  const themeToggle = actions.querySelector(".theme-toggle");
  if (themeToggle) {
    actions.insertBefore(navBtn, themeToggle);
  } else {
    actions.insertBefore(navBtn, actions.firstChild);
  }

  navBtn.addEventListener("click", () => {
    onPanelToggle();
  });

  updateBadge();
  return navBtn;
}

export function showNavButton() {
  if (navBtn) navBtn.style.display = "";
}

export function hideNavButton() {
  if (navBtn) navBtn.style.display = "none";
}

export function updateBadge() {
  if (!badgeEl) return;
  const count = storage.getUnlocked().length;
  badgeEl.textContent = String(count);
  if (count > 0) {
    badgeEl.classList.add("visible");
  } else {
    badgeEl.classList.remove("visible");
  }
}

function pulseBadge() {
  if (!badgeEl) return;
  badgeEl.classList.remove("pulse");
  void badgeEl.offsetHeight;
  badgeEl.classList.add("pulse");
}

// ── Panel ──

export function openPanel(onHide) {
  if (panelOpen) return;
  panelOpen = true;
  if (navBtn) navBtn.classList.add("active");

  // Dispatch panel-open event for tracker
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type: "panel-open" } }),
  );

  if (!panelEl) {
    panelEl = buildPanel(onHide);
    document.body.appendChild(panelEl);
  } else {
    refreshPanel();
  }

  // Force reflow then open
  void panelEl.offsetHeight;
  requestAnimationFrame(() => panelEl.classList.add("open"));

  // Close on escape
  _escHandler = (e) => {
    if (e.key === "Escape") closePanel();
  };
  document.addEventListener("keydown", _escHandler);

  // Close on outside click (delayed to avoid catching the opening click)
  const OUTSIDE_CLICK_DELAY_MS = 50;
  setTimeout(() => {
    _outsideHandler = (e) => {
      if (
        panelEl &&
        !panelEl.contains(e.target) &&
        !(navBtn && navBtn.contains(e.target)) &&
        !(toastContainer && toastContainer.contains(e.target))
      ) {
        closePanel();
      }
    };
    document.addEventListener("pointerdown", _outsideHandler);
  }, OUTSIDE_CLICK_DELAY_MS);
}

export function closePanel() {
  if (!panelOpen || !panelEl) return;
  panelOpen = false;
  if (navBtn) navBtn.classList.remove("active");
  panelEl.classList.remove("open");
  hideHintTooltip();

  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  if (_outsideHandler) {
    document.removeEventListener("pointerdown", _outsideHandler);
    _outsideHandler = null;
  }
}

export function isPanelOpen() {
  return panelOpen;
}

function buildPanel(onHide) {
  const panel = document.createElement("div");
  panel.className = "achievement-panel";

  // Header
  const header = document.createElement("div");
  header.className = "achievement-header";

  const titleRow = document.createElement("div");
  titleRow.className = "achievement-title-row";

  const title = document.createElement("h3");
  title.className = "achievement-title";
  title.textContent = "Cloudlog";

  const pointsEl = document.createElement("span");
  pointsEl.className = "achievement-points-total";
  pointsEl.textContent = `${totalPoints()} pts`;

  titleRow.appendChild(title);
  titleRow.appendChild(pointsEl);

  const closeBtn = document.createElement("button");
  closeBtn.className = "achievement-close";
  closeBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M4 12l8-8"/></svg>`;
  closeBtn.addEventListener("click", closePanel);

  header.appendChild(titleRow);
  header.appendChild(closeBtn);

  // Hint toggle — reveals descriptions on hidden achievements + tooltip clues on all locked
  const hintToggle = document.createElement("label");
  hintToggle.className = "achievement-hint-toggle";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = revealHints;
  cb.addEventListener("change", () => {
    revealHints = cb.checked;
    refreshPanel();
  });
  hintToggle.appendChild(cb);
  hintToggle.appendChild(document.createTextNode(" Reveal hints"));
  header.appendChild(hintToggle);

  panel.appendChild(header);

  // Body (scrollable)
  const body = document.createElement("div");
  body.className = "achievement-body";

  renderSections(body);

  // Dismiss tooltip when scrolling the panel
  body.addEventListener("scroll", hideHintTooltip, { passive: true });

  panel.appendChild(body);

  // Footer with hide option
  const footer = document.createElement("div");
  footer.className = "achievement-footer";
  const hideBtn = document.createElement("button");
  hideBtn.className = "achievement-hide-btn";
  hideBtn.textContent = "Hide from navbar";
  hideBtn.addEventListener("click", () => {
    closePanel();
    if (onHide) onHide();
  });
  footer.appendChild(hideBtn);
  panel.appendChild(footer);

  return panel;
}

function refreshPanel() {
  if (!panelEl) return;
  // Update points
  const pointsEl = panelEl.querySelector(".achievement-points-total");
  if (pointsEl) pointsEl.textContent = `${totalPoints()} pts`;

  // Re-render sections
  const body = panelEl.querySelector(".achievement-body");
  if (body) {
    body.innerHTML = "";
    renderSections(body);
  }
}

function renderSections(container) {
  const currentMode = document.body.dataset.activeTheme || null;

  for (const set of SETS) {
    // Mode sets: only show if user has at least one unlocked
    if (isModeSet(set.id) && !hasAnyInSet(set.id)) continue;

    const section = document.createElement("div");
    section.className = "achievement-set";

    if (set.color) section.style.setProperty("--set-color", set.color);
    const isDimmed = isModeSet(set.id) && currentMode !== set.id;
    if (isDimmed) section.classList.add("dimmed");

    // Section header
    const sHeader = document.createElement("div");
    sHeader.className = "achievement-set-header";
    if (set.color) {
      sHeader.style.borderLeftColor = set.color;
    }

    const sName = document.createElement("span");
    sName.className = "achievement-set-name";
    sName.textContent = set.label;

    const { total, unlocked } = setCountForSet(set.id);
    const sCount = document.createElement("span");
    sCount.className = "achievement-set-count";
    sCount.textContent = `${unlocked} / ${total}`;

    sHeader.appendChild(sName);
    sHeader.appendChild(sCount);

    // Progress bar
    const progWrap = document.createElement("div");
    progWrap.className = "achievement-progress";
    const progBar = document.createElement("div");
    progBar.className = "achievement-progress-bar";
    const pct = total > 0 ? (unlocked / total) * 100 : 0;
    progBar.style.width = `${pct}%`;
    if (set.color) progBar.style.background = set.color;
    progWrap.appendChild(progBar);
    sHeader.appendChild(progWrap);

    section.appendChild(sHeader);

    // Achievement cards
    const setAchievements = ACHIEVEMENTS.filter((a) => a.set === set.id);
    for (const ach of setAchievements) {
      const isUnlocked = storage.isUnlocked(ach.id);
      const card = document.createElement("div");
      card.className = "achievement-card";
      card.dataset.id = ach.id;

      if (isUnlocked) {
        card.classList.add("unlocked");
      } else if (ach.hidden) {
        card.classList.add("hidden-ach");
      } else {
        card.classList.add("locked");
      }

      // Icon
      const icon = document.createElement("div");
      icon.className = "achievement-icon";
      if (isUnlocked) {
        icon.innerHTML = CLOUD_CHECK_SVG;
        if (set.color) icon.style.color = set.color;
      } else if (ach.hidden && !revealHints) {
        icon.innerHTML = CLOUD_HIDDEN_SVG;
      } else {
        icon.innerHTML = CLOUD_LOCK_SVG;
      }

      // Text
      const text = document.createElement("div");
      text.className = "achievement-text";

      const cardTitle = document.createElement("div");
      cardTitle.className = "achievement-card-title";

      const cardPts = document.createElement("span");
      cardPts.className = "achievement-card-pts";
      cardPts.textContent = `${ach.points}`;

      const cardDesc = document.createElement("div");
      cardDesc.className = "achievement-card-desc";

      if (isUnlocked) {
        cardTitle.textContent = ach.title;
        cardDesc.textContent = ach.description;
      } else if (ach.hidden) {
        cardTitle.textContent = revealHints ? ach.title : "???";
        cardDesc.textContent = revealHints
          ? ach.description
          : "Hidden achievement";
      } else {
        // Locked but visible
        cardTitle.textContent = ach.title;
        cardDesc.textContent = ach.description;
      }

      text.appendChild(cardTitle);
      text.appendChild(cardDesc);

      // Timestamp for unlocked achievements
      if (isUnlocked) {
        const ts = storage.getUnlockTime(ach.id);
        if (ts) {
          const timeEl = document.createElement("div");
          timeEl.className = "achievement-card-time";
          timeEl.dataset.ts = String(ts);
          timeEl.textContent = formatTimestamp(ts);
          timeEl.addEventListener("click", toggleTimestampMode);
          text.appendChild(timeEl);
        }
      }

      card.appendChild(icon);
      card.appendChild(text);
      card.appendChild(cardPts);

      // Click pop on unlocked cards
      if (isUnlocked) {
        card.addEventListener("click", onCardClick);
      }

      // Hint tooltip on hover — unlocked always, locked/hidden when reveal is on
      const showHint = ach.hint && (isUnlocked || revealHints);
      if (showHint) {
        card.addEventListener("mouseenter", () =>
          showHintTooltip(card, ach.hint),
        );
        card.addEventListener("mouseleave", hideHintTooltip);
      }

      section.appendChild(card);
    }

    container.appendChild(section);
  }
}

function onCardClick(e) {
  const card = e.currentTarget;
  card.classList.remove("clicked");
  void card.offsetHeight;
  card.classList.add("clicked");
  card.addEventListener(
    "animationend",
    () => card.classList.remove("clicked"),
    {
      once: true,
    },
  );
}

// Refresh a single card in-place when it unlocks while panel is open
export function refreshCard(achievementId) {
  if (!panelEl || !panelOpen) return;
  const card = panelEl.querySelector(
    `.achievement-card[data-id="${achievementId}"]`,
  );
  if (!card) {
    // Achievement might be in an invisible set — do full refresh
    refreshPanel();
    return;
  }
  const ach = getAchievement(achievementId);
  if (!ach) return;

  const set = SETS.find((s) => s.id === ach.set);

  card.classList.remove("locked", "hidden-ach");
  card.classList.add("unlocked");

  // Update icon
  const icon = card.querySelector(".achievement-icon");
  if (icon) {
    icon.innerHTML = CLOUD_CHECK_SVG;
    if (set && set.color) icon.style.color = set.color;
  }

  // Update text
  const title = card.querySelector(".achievement-card-title");
  if (title) title.textContent = ach.title;
  const desc = card.querySelector(".achievement-card-desc");
  if (desc) desc.textContent = ach.description;

  // Add timestamp
  const textEl = card.querySelector(".achievement-text");
  if (textEl && !card.querySelector(".achievement-card-time")) {
    const ts = storage.getUnlockTime(achievementId);
    if (ts) {
      const timeEl = document.createElement("div");
      timeEl.className = "achievement-card-time";
      timeEl.dataset.ts = String(ts);
      timeEl.textContent = formatTimestamp(ts);
      timeEl.addEventListener("click", toggleTimestampMode);
      textEl.appendChild(timeEl);
    }
  }

  // Click pop for newly unlocked card
  card.addEventListener("click", onCardClick);

  // Shine animation
  card.classList.add("shine");
  const SHINE_DURATION_MS = 800;
  setTimeout(() => card.classList.remove("shine"), SHINE_DURATION_MS);

  // Update section counts
  refreshPanel();
}

// ── Toast Notifications ──

function ensureToastContainer() {
  if (toastContainer) return;
  toastContainer = document.createElement("div");
  toastContainer.className = "achievement-toast-container";
  document.body.appendChild(toastContainer);

  toastContainer.addEventListener("mouseenter", pauseToasts);
  toastContainer.addEventListener("mouseleave", () => {
    resumeToasts();
    hideHintTooltip();
  });
  toastContainer.addEventListener("mouseover", (e) => {
    const toast = e.target.closest(".achievement-toast");
    if (toast && toast.dataset.hint)
      showHintTooltip(toast, toast.dataset.hint, true);
  });
}

function pauseToasts() {
  toastsPaused = true;
  for (const ref of activeToasts) {
    if (ref.timer) {
      clearTimeout(ref.timer);
      ref.timer = null;
      ref.remaining = Math.max(0, ref.dismissAt - Date.now());
    }
  }
}

function resumeToasts() {
  toastsPaused = false;
  for (const ref of activeToasts) {
    if (ref.remaining != null) {
      const delay = Math.max(ref.remaining, TOAST_RESUME_DELAY_MS);
      ref.dismissAt = Date.now() + delay;
      ref.timer = setTimeout(() => dismissToast(ref), delay);
      ref.remaining = null;
    }
  }
}

export function showToast(achievement) {
  ensureToastContainer();

  if (activeToasts.length >= TOAST_MAX_VISIBLE) {
    toastQueue.push(achievement);
    return;
  }

  const set = SETS.find((s) => s.id === achievement.set);
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  if (set && set.color) {
    toast.style.setProperty("--toast-accent", set.color);
  }

  toast.innerHTML = `
    <div class="achievement-toast-icon">${CLOUD_CHECK_SVG}</div>
    <div class="achievement-toast-body">
      <div class="achievement-toast-title">${achievement.title}</div>
      <div class="achievement-toast-desc">${achievement.description}</div>
    </div>
    <div class="achievement-toast-pts">${achievement.points}</div>
  `;

  if (achievement.hint) toast.dataset.hint = achievement.hint;

  toast.addEventListener("click", () => {
    toast.classList.remove("clicked");
    void toast.offsetHeight;
    toast.classList.add("clicked");
    toast.addEventListener(
      "animationend",
      () => toast.classList.remove("clicked"),
      {
        once: true,
      },
    );
  });

  toastContainer.appendChild(toast);

  // Slide in
  void toast.offsetHeight;
  toast.classList.add("enter");

  // Fireworks burst around the toast after slide-in completes
  const accentColor = (set && set.color) || null;
  setTimeout(() => {
    if (!toast.parentNode) return;
    const rect = toast.getBoundingClientRect();
    burstFireworks(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      color: accentColor,
    });
  }, FIREWORKS_DELAY_MS);

  const toastRef = { el: toast, dismissAt: Date.now() + TOAST_HOLD_MS };
  activeToasts.push(toastRef);

  // Auto dismiss (skip timer if queue is paused — resumeToasts will start it)
  if (!toastsPaused) {
    toastRef.timer = setTimeout(() => dismissToast(toastRef), TOAST_HOLD_MS);
  } else {
    toastRef.remaining = TOAST_HOLD_MS;
  }
}

function dismissToast(toastRef) {
  if (!toastRef.el) return;
  toastRef.el.classList.remove("enter");
  toastRef.el.classList.add("exit");

  setTimeout(() => {
    if (toastRef.el && toastRef.el.parentNode) {
      toastRef.el.remove();
    }
    const idx = activeToasts.indexOf(toastRef);
    if (idx !== -1) activeToasts.splice(idx, 1);

    // Process queue
    if (toastQueue.length > 0 && activeToasts.length < TOAST_MAX_VISIBLE) {
      const next = toastQueue.shift();
      setTimeout(() => showToast(next), TOAST_STAGGER_MS);
    }
  }, TOAST_SLIDE_OUT_MS);
}

// ── Activation Toast ──

export function showActivationToast(message) {
  const toast = document.createElement("div");
  toast.className = "achievement-activation-toast";
  toast.innerHTML = `
    <div class="achievement-activation-icon">${CLOUD_CHECK_SVG}</div>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  void toast.offsetHeight;
  toast.classList.add("visible");

  const ACTIVATION_TOAST_MS = 3000;
  setTimeout(() => {
    toast.classList.remove("visible");
    const ACTIVATION_FADE_MS = 400;
    setTimeout(() => toast.remove(), ACTIVATION_FADE_MS);
  }, ACTIVATION_TOAST_MS);
}

// ── Activation Pulse Ring ──

export function showActivationPulse(x, y) {
  const ring = document.createElement("div");
  ring.className = "achievement-pulse-ring";
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  document.body.appendChild(ring);

  const PULSE_RING_MS = 800;
  setTimeout(() => ring.remove(), PULSE_RING_MS);
}

// ── Dev mode setter ──

export function setDevMode(enabled) {
  isDevMode = enabled;
}

// ── Lifecycle ──

export function onAchievementUnlocked(achievement) {
  showToast(achievement);
  updateBadge();
  pulseBadge();
  refreshCard(achievement.id);
}

export function destroy() {
  if (navBtn && navBtn.parentNode) navBtn.remove();
  if (panelEl && panelEl.parentNode) panelEl.remove();
  if (toastContainer && toastContainer.parentNode) toastContainer.remove();
  if (tooltipEl && tooltipEl.parentNode) tooltipEl.remove();
  navBtn = null;
  panelEl = null;
  toastContainer = null;
  tooltipEl = null;
  panelOpen = false;
}
