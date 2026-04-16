// ── Dev Console UI ──
// Dockable, searchable panel for live-tweaking registry constants.
// Activated via URL hash #dev or Ctrl+Shift+Period.

import { Z_DEV_CONSOLE } from "../layers.js";
import { showFps, hideFps } from "./fps.js";
import {
  getRegistry,
  getSectionMeta,
  resetValue,
  resetSection,
  resetAll,
  exportConfig,
  importConfig,
  onSectionActivate,
} from "./registry.js";

// ── Layout Constants ──
const PANEL_WIDTH = 340;
const PANEL_MIN_HEIGHT = 200;
const COLLAPSED_SIZE = 36;
// ── Auto-scroll suppression ──
const INTERACTION_QUIET_MS = 400;
// ── Dock Magnet ──
const DOCK_MAGNET_ZONE = 120;
const DOCK_MAGNET_POWER = 2;
const DOCK_COMMIT_DISTANCE = 20;
const DOCK_UNDOCK_DRAG = 28;
const DOCK_UNDOCK_PULL_PX = 6;
const DOCK_ANIM_MS = 260;
const DOCK_ANIM_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const DOCK_GLOW_COLOR = "100, 180, 255";
const DOCK_GLOW_OPACITY = 0.6;
const DOCK_GLOW_SPREAD = 12;
const DOCK_GLOW_WIDTH = 3;
const WALL_GLOW_THICKNESS = 4;
const WALL_GLOW_SPREAD = 18;
// ── Dock Snap Effect ──
const SNAP_FLASH_DURATION_MS = 350;
const SNAP_FLASH_SPREAD = 24;
const SNAP_FLASH_OPACITY = 0.9;
// ── Undock Release Effect ──
const RELEASE_FLASH_DURATION_MS = 450;
const RELEASE_FLASH_START_SPREAD = 8;
const RELEASE_FLASH_END_SPREAD = 36;
const RELEASE_FLASH_OPACITY = 0.6;
const RELEASE_FLASH_END_WIDTH = 10;
const SECTION_LABEL_MAP = {
  "sky.stars": "Stars",
  "sky.shooting": "Shooting Stars",
  "sky.shared": "Sky Shared",
  "fury.click": "Click Fury",
  "fury.lightning": "Lightning",
  "fury.aurora": "Aurora",
  "fury.meteors": "Meteors",
  "atmosphere.streaks": "Streaks",
  "atmosphere.clouds": "Clouds",
  "atmosphere.wisps": "Breeze Wisps",
  "atmosphere.motes": "Scroll Motes",
  "atmosphere.horizon": "Horizon Glow",
  "atmosphere.gusts": "Edge Gusts",
  "atmosphere.moteImpulse": "Mote Impulse",
  "interactions.click": "Click Particles",
  "interactions.orbit": "Orbit Particles",
  "interactions.hold": "Hold & Attract",
  "interactions.well": "Gravity Well",
  "interactions.trail": "Drag Trail",
  "interactions.impulse": "Impulse Decay",
  "canvas.scroll": "Scroll Velocity",
  "canvas.particles": "Particle Counts",
  "canvas.shake": "Snow Globe Shake",
  "canvas.render": "Render Counts",
  "particles.snow": "Snowflakes",
  "particles.snowShake": "Snow Shake",
  "particles.bubbles": "Bubbles",
  "particles.jellyfish": "Jellyfish",
  "particles.blocky": "Pixelation",
  "particles.fireflies": "Fireflies",
  "particles.butterflies": "Butterflies",
  "particles.blockFragments": "Block Fragments",
  "particles.rain": "Raindrops",
  "particles.rainWind": "Wind System",
  "particles.rainSplash": "Splashes",
  "particles.rainGlass": "Glass Drops",
  "particles.rainThunder": "Thunder",
  "modes.upsideForce": "Force & Drain",
  "modes.upsideVisuals": "Visual Effects",
  "modes.rainyForce": "Force & Activation",
  "modes.rainyVisuals": "Visual Effects",
  "modes.frozenForce": "Force & Activation",
  "modes.frozenVisuals": "Visual Effects",
  "modes.deepSeaForce": "Force & Activation",
  "modes.deepSeaVisuals": "Visual Effects",
  "modes.blockyForce": "Force & Activation",
  "modes.blockyVisuals": "Visual Effects",
  cursor: "Cursor",
  "effects.fireworks": "Fireworks",
};

// ── Group categories into top-level sections ──
const GROUP_ORDER = [
  { label: "Canvas", prefix: "canvas." },
  { label: "Sky", prefix: "sky." },
  { label: "Atmosphere", prefix: "atmosphere." },
  { label: "Fury", prefix: "fury." },
  { label: "Interactions", prefix: "interactions." },
  { label: "Cursor", prefix: "cursor" },
  { label: "Effects", prefix: "effects." },
];

// ── Mode metadata ──
const MODE_COLORS = {
  frozen: "#88d4f7",
  "deep-sea": "#00ffc8",
  blocky: "#ffa040",
  rainy: "#6a9fc0",
  "upside-down": "#e04050",
};
const MODE_LABELS = {
  frozen: "Frozen Mode",
  "deep-sea": "Deep Sea Mode",
  blocky: "Blocky Mode",
  rainy: "Rainy Mode",
  "upside-down": "Upside Down Mode",
};
const MODE_ORDER = ["frozen", "deep-sea", "blocky", "rainy", "upside-down"];

// ── Helper: load dev CSS once ──
let cssLoaded = false;
function loadDevCss() {
  if (cssLoaded) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "css/dev.css";
  document.head.appendChild(link);
  cssLoaded = true;
}

// ── Tooltip singleton ──
let tooltipEl = null;
function showTooltip(target, entry, category, key) {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "dc-tooltip";
    document.body.appendChild(tooltipEl);
  }
  const lines = [];
  if (entry.description) lines.push(entry.description);
  lines.push(
    `<span class="dc-tooltip-key">Range:</span> <span class="dc-tooltip-val">${entry.min} — ${entry.max}</span> (step ${entry.step})`,
  );
  lines.push(
    `<span class="dc-tooltip-key">Default:</span> <span class="dc-tooltip-val">${entry.default}</span>`,
  );
  lines.push(`<span class="dc-tooltip-key">Path:</span> ${category}.${key}`);
  tooltipEl.innerHTML = lines.join("<br>");
  tooltipEl.style.display = "block";
  const rect = target.getBoundingClientRect();
  tooltipEl.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
  tooltipEl.style.top = `${rect.bottom + 6}px`;
}
function hideTooltip() {
  if (tooltipEl) tooltipEl.style.display = "none";
}

// ── Build a single section element ──
function buildSectionEl(category, registry, rowMap) {
  const entries = registry.get(category);
  const meta = getSectionMeta(category);
  const sectionEl = document.createElement("div");
  sectionEl.className = "dc-section collapsed";
  sectionEl.dataset.category = category;
  if (meta && meta.mode) {
    sectionEl.dataset.mode = meta.mode;
    sectionEl.style.setProperty(
      "--mode-color",
      MODE_COLORS[meta.mode] || "#7dbfe8",
    );
  }

  const sectionHeader = document.createElement("div");
  sectionHeader.className = "dc-section-header";
  const sectionLabel = SECTION_LABEL_MAP[category] || category;
  sectionHeader.innerHTML = `<span class="dc-section-chevron">&#9660;</span>${sectionLabel}`;
  const sectionResetBtn = document.createElement("button");
  sectionResetBtn.className = "dc-section-reset";
  sectionResetBtn.textContent = "reset";
  sectionResetBtn.title = "Reset all values in this section";
  sectionResetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resetSection(category);
    for (const [key, entry] of entries) {
      const rm = rowMap.get(`${category}.${key}`);
      if (rm) syncRow(rm, entry);
    }
    propagateModified(sectionEl.closest(".dev-console"));
  });
  sectionHeader.appendChild(sectionResetBtn);
  sectionHeader.addEventListener("click", (e) => {
    if (e.target === sectionResetBtn) return;
    sectionEl.classList.toggle("collapsed");
    sectionEl.dataset.userToggled = "true";
  });
  sectionEl.appendChild(sectionHeader);

  const sectionBody = document.createElement("div");
  sectionBody.className = "dc-section-body";

  for (const [key, entry] of entries) {
    if (entry.type !== "number") continue;
    const row = document.createElement("div");
    row.className = "dc-row";
    row.dataset.searchKey = `${category}.${key} ${entry.label}`.toLowerCase();

    const top = document.createElement("div");
    top.className = "dc-row-top";

    const label = document.createElement("span");
    label.className = "dc-row-label";
    label.textContent = entry.label;
    label.addEventListener("mouseenter", () =>
      showTooltip(label, entry, category, key),
    );
    label.addEventListener("mouseleave", hideTooltip);

    const input = document.createElement("input");
    input.type = "number";
    input.className = "dc-row-value";
    input.min = entry.min;
    input.max = entry.max;
    input.step = entry.step;
    input.value = formatNum(entry.ref[key], entry.step);

    const resetBtn = document.createElement("button");
    resetBtn.className = "dc-row-reset";
    resetBtn.textContent = "\u21BA";
    resetBtn.title = `Reset to ${entry.default}`;
    if (entry.ref[key] !== entry.default) resetBtn.classList.add("visible");
    resetBtn.addEventListener("click", () => {
      resetValue(category, key);
      const rm = rowMap.get(`${category}.${key}`);
      if (rm) syncRow(rm, entry);
      propagateModified(sectionEl.closest(".dev-console"));
    });

    top.appendChild(label);
    top.appendChild(input);
    top.appendChild(resetBtn);

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "dc-row-slider";
    slider.min = entry.min;
    slider.max = entry.max;
    slider.step = entry.step;
    slider.value = entry.ref[key];

    slider.addEventListener("input", () => {
      const v = parseFloat(slider.value);
      entry.ref[key] = v;
      input.value = formatNum(v, entry.step);
      label.className = `dc-row-label${v !== entry.default ? " modified" : ""}`;
      resetBtn.classList.toggle("visible", v !== entry.default);
      propagateModified(sectionEl.closest(".dev-console"));
    });
    input.addEventListener("change", () => {
      let v = parseFloat(input.value);
      if (isNaN(v)) v = entry.default;
      v = Math.max(entry.min, Math.min(entry.max, v));
      entry.ref[key] = v;
      input.value = formatNum(v, entry.step);
      slider.value = v;
      label.className = `dc-row-label${v !== entry.default ? " modified" : ""}`;
      resetBtn.classList.toggle("visible", v !== entry.default);
      propagateModified(sectionEl.closest(".dev-console"));
    });

    row.appendChild(top);
    row.appendChild(slider);
    sectionBody.appendChild(row);
    rowMap.set(`${category}.${key}`, { slider, input, label, resetBtn });
  }
  sectionEl.appendChild(sectionBody);
  return sectionEl;
}

// ── Build the panel DOM ──
function buildPanel() {
  const registry = getRegistry();
  const panel = document.createElement("div");
  panel.className = "dev-console docked-right";

  // ── Header ──
  const header = document.createElement("div");
  header.className = "dc-header";
  header.innerHTML = `
    <svg class="dc-header-icon" viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 108.5 12 3.5 3.5 0 0012 15.5z"/><path d="M19.43 12.98a7.79 7.79 0 00.07-1 7.79 7.79 0 00-.07-1l2.11-1.65a.5.5 0 00.12-.64l-2-3.46a.5.5 0 00-.61-.22l-2.49 1a7.35 7.35 0 00-1.72-1l-.38-2.65A.49.49 0 0014 2h-4a.49.49 0 00-.49.42l-.38 2.65a7.68 7.68 0 00-1.72 1l-2.49-1a.49.49 0 00-.61.22l-2 3.46a.49.49 0 00.12.64L4.57 11a8.26 8.26 0 00-.07 1 8.26 8.26 0 00.07 1l-2.11 1.65a.5.5 0 00-.12.64l2 3.46a.5.5 0 00.61.22l2.49-1a7.35 7.35 0 001.72 1l.38 2.65A.49.49 0 0010 22h4a.49.49 0 00.49-.42l.38-2.65a7.68 7.68 0 001.72-1l2.49 1a.49.49 0 00.61-.22l2-3.46a.5.5 0 00-.12-.64z" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="dc-header-title">Dev Console</span>
    <div class="dc-header-actions">
      <button class="dc-btn-dock" title="Cycle dock position">&#8689;</button>
      <button class="dc-btn-collapse" title="Collapse">&#8722;</button>
      <button class="dc-btn-close" title="Close">&times;</button>
    </div>
  `;
  panel.appendChild(header);

  // ── Search ──
  const search = document.createElement("div");
  search.className = "dc-search";
  search.innerHTML = `<input type="text" placeholder="Search constants..." spellcheck="false" />`;
  panel.appendChild(search);

  // ── Body ──
  const body = document.createElement("div");
  body.className = "dc-body";

  // Build grouped structure
  const rowMap = new Map(); // category.key -> { slider, input, label, entry }

  // Prefix-based groups — skip mode-tagged sections (they go in the Modes group)
  for (const group of GROUP_ORDER) {
    const matchingSections = [];
    for (const [category] of registry) {
      if (!category.startsWith(group.prefix)) continue;
      const meta = getSectionMeta(category);
      if (meta && meta.mode) continue;
      matchingSections.push(category);
    }
    if (matchingSections.length === 0) continue;

    const groupEl = document.createElement("div");
    groupEl.className = "dc-group collapsed";
    const groupHeader = document.createElement("div");
    groupHeader.className = "dc-group-header";
    groupHeader.innerHTML = `<span class="dc-group-chevron">&#9660;</span>${group.label}`;
    groupHeader.addEventListener("click", () => {
      groupEl.classList.toggle("collapsed");
    });
    groupEl.appendChild(groupHeader);

    const groupBody = document.createElement("div");
    groupBody.className = "dc-group-body";
    for (const cat of matchingSections) {
      groupBody.appendChild(buildSectionEl(cat, registry, rowMap));
    }

    groupEl.appendChild(groupBody);
    body.appendChild(groupEl);
  }

  // Modes group — all mode-tagged sections, organized by mode sub-headers
  const byMode = new Map();
  for (const [category] of registry) {
    const meta = getSectionMeta(category);
    if (!meta || !meta.mode) continue;
    if (!byMode.has(meta.mode)) byMode.set(meta.mode, []);
    byMode.get(meta.mode).push(category);
  }

  if (byMode.size > 0) {
    const modesGroupEl = document.createElement("div");
    modesGroupEl.className = "dc-group collapsed";
    const modesGroupHeader = document.createElement("div");
    modesGroupHeader.className = "dc-group-header";
    modesGroupHeader.innerHTML = `<span class="dc-group-chevron">&#9660;</span>Modes`;
    modesGroupHeader.addEventListener("click", () => {
      modesGroupEl.classList.toggle("collapsed");
    });
    modesGroupEl.appendChild(modesGroupHeader);

    const modesGroupBody = document.createElement("div");
    modesGroupBody.className = "dc-group-body";

    for (const mode of MODE_ORDER) {
      if (!byMode.has(mode)) continue;
      const subHeader = document.createElement("div");
      subHeader.className = "dc-mode-subheader";
      subHeader.dataset.mode = mode;
      subHeader.style.setProperty("--mode-color", MODE_COLORS[mode]);
      subHeader.textContent = MODE_LABELS[mode];
      modesGroupBody.appendChild(subHeader);
      const cats = byMode
        .get(mode)
        .slice()
        .sort((a, b) => {
          const aMode = a.startsWith("modes.") ? 0 : 1;
          const bMode = b.startsWith("modes.") ? 0 : 1;
          return aMode - bMode;
        });
      for (const cat of cats) {
        modesGroupBody.appendChild(buildSectionEl(cat, registry, rowMap));
      }
    }

    modesGroupEl.appendChild(modesGroupBody);
    body.appendChild(modesGroupEl);
  }

  panel.appendChild(body);

  // ── Footer ──
  const footer = document.createElement("div");
  footer.className = "dc-footer";

  const btnResetAll = document.createElement("button");
  btnResetAll.textContent = "Reset All";
  btnResetAll.addEventListener("click", () => {
    resetAll();
    for (const [path, rm] of rowMap) {
      const [cat, key] = splitPath(path);
      const section = registry.get(cat);
      if (section) {
        const entry = section.get(key);
        if (entry) syncRow(rm, entry);
      }
    }
    propagateModified(panel);
  });

  const btnExport = document.createElement("button");
  btnExport.textContent = "Export";
  btnExport.addEventListener("click", () => {
    const json = JSON.stringify(exportConfig(), null, 2);
    navigator.clipboard.writeText(json).then(() => {
      btnExport.textContent = "Copied!";
      setTimeout(() => (btnExport.textContent = "Export"), 1500);
    });
  });

  const btnImport = document.createElement("button");
  btnImport.textContent = "Import";
  btnImport.addEventListener("click", () => {
    const json = prompt("Paste config JSON:");
    if (!json) return;
    try {
      importConfig(JSON.parse(json));
      for (const [path, rm] of rowMap) {
        const [cat, key] = splitPath(path);
        const section = registry.get(cat);
        if (section) {
          const entry = section.get(key);
          if (entry) syncRow(rm, entry);
        }
      }
      propagateModified(panel);
    } catch {
      alert("Invalid JSON");
    }
  });

  footer.appendChild(btnResetAll);
  footer.appendChild(btnExport);
  footer.appendChild(btnImport);
  panel.appendChild(footer);

  // ── Search filtering ──
  const searchInput = search.querySelector("input");
  const savedCollapseStates = new Map();

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    const rows = body.querySelectorAll(".dc-row");
    const sections = body.querySelectorAll(".dc-section");
    const groups = body.querySelectorAll(".dc-group");

    const subHeaders = body.querySelectorAll(".dc-mode-subheader");

    if (!q) {
      rows.forEach((r) => (r.style.display = ""));
      sections.forEach((s) => {
        s.style.display = "";
        if (savedCollapseStates.has(s)) {
          s.classList.toggle("collapsed", savedCollapseStates.get(s));
        }
      });
      groups.forEach((g) => {
        g.style.display = "";
        if (savedCollapseStates.has(g)) {
          g.classList.toggle("collapsed", savedCollapseStates.get(g));
        }
      });
      subHeaders.forEach((h) => (h.style.display = ""));
      savedCollapseStates.clear();
      return;
    }

    // Save collapse states before search auto-expands
    if (savedCollapseStates.size === 0) {
      sections.forEach((s) => {
        savedCollapseStates.set(s, s.classList.contains("collapsed"));
      });
      groups.forEach((g) => {
        savedCollapseStates.set(g, g.classList.contains("collapsed"));
      });
    }

    rows.forEach((r) => {
      r.style.display = r.dataset.searchKey.includes(q) ? "" : "none";
    });
    // Hide empty sections, sub-headers, and groups
    sections.forEach((s) => {
      const visible = s.querySelectorAll(
        '.dc-row:not([style*="display: none"])',
      );
      s.style.display = visible.length > 0 ? "" : "none";
      if (visible.length > 0) s.classList.remove("collapsed");
    });
    subHeaders.forEach((h) => {
      const mode = h.dataset.mode;
      const siblingSections = body.querySelectorAll(
        `.dc-section[data-mode="${mode}"]:not([style*="display: none"])`,
      );
      h.style.display = siblingSections.length > 0 ? "" : "none";
    });
    groups.forEach((g) => {
      const visible = g.querySelectorAll(
        '.dc-section:not([style*="display: none"])',
      );
      g.style.display = visible.length > 0 ? "" : "none";
      if (visible.length > 0) g.classList.remove("collapsed");
    });
  });

  return { panel, searchInput };
}

// ── Helpers ──

function formatNum(v, step) {
  if (step >= 1) return String(Math.round(v));
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return v.toFixed(Math.min(decimals, 4));
}

function syncRow(rm, entry) {
  const v = entry.ref[entry.key];
  rm.slider.value = v;
  rm.input.value = formatNum(v, entry.step);
  rm.label.className = `dc-row-label${v !== entry.default ? " modified" : ""}`;
  rm.resetBtn.classList.toggle("visible", v !== entry.default);
}

function splitPath(path) {
  const lastDot = path.lastIndexOf(".");
  return [path.slice(0, lastDot), path.slice(lastDot + 1)];
}

/**
 * Scan modified labels and propagate has-modified + count badges
 * up to section headers, mode sub-headers, and group headers.
 */
function propagateModified(panel) {
  if (!panel) return;

  // Section headers
  panel.querySelectorAll(".dc-section").forEach((s) => {
    const count = s.querySelectorAll(".dc-row-label.modified").length;
    const header = s.querySelector(".dc-section-header");
    header.classList.toggle("has-modified", count > 0);
    let badge = header.querySelector(".dc-modified-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "dc-modified-badge";
        header.insertBefore(badge, header.querySelector(".dc-section-reset"));
      }
      badge.textContent = `(${count})`;
    } else if (badge) {
      badge.remove();
    }
  });

  // Mode sub-headers
  panel.querySelectorAll(".dc-mode-subheader").forEach((h) => {
    const mode = h.dataset.mode;
    let total = 0;
    panel.querySelectorAll(`.dc-section[data-mode="${mode}"]`).forEach((s) => {
      total += s.querySelectorAll(".dc-row-label.modified").length;
    });
    h.classList.toggle("has-modified", total > 0);
    let badge = h.querySelector(".dc-modified-badge");
    if (total > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "dc-modified-badge";
        h.appendChild(badge);
      }
      badge.textContent = `(${total})`;
    } else if (badge) {
      badge.remove();
    }
  });

  // Group headers
  panel.querySelectorAll(".dc-group").forEach((g) => {
    const count = g.querySelectorAll(".dc-row-label.modified").length;
    const header = g.querySelector(".dc-group-header");
    header.classList.toggle("has-modified", count > 0);
    let badge = header.querySelector(".dc-modified-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "dc-modified-badge";
        header.appendChild(badge);
      }
      badge.textContent = `(${count})`;
    } else if (badge) {
      badge.remove();
    }
  });
}

// ── Dock + Drag logic ──

function setupDocking(panel) {
  let isDragging = false;
  let dragOffX = 0;
  let dragOffY = 0;
  let dockState = "docked-right"; // docked-right | docked-left | floating
  let floatX = 100;
  let floatY = 0;
  let dockAnimating = false;
  let dragStartX = 0;
  let magnetSuppressedSide = null;

  const header = panel.querySelector(".dc-header");
  const btnDock = panel.querySelector(".dc-btn-dock");
  const btnCollapse = panel.querySelector(".dc-btn-collapse");

  function applyDock() {
    panel.classList.remove("docked-right", "docked-left", "floating");
    panel.classList.add(dockState);
    if (dockState === "floating") {
      panel.style.left = `${floatX}px`;
      panel.style.top = `${floatY}px`;
      panel.style.right = "";
      panel.style.bottom = "";
    } else {
      panel.style.top = `${floatY}px`;
      panel.style.left = "";
      panel.style.right = "";
      panel.style.bottom = "";
    }
  }

  // Wall glow: fixed bar on the target viewport edge
  const wallGlow = document.createElement("div");
  wallGlow.className = "dc-wall-glow";
  document.body.appendChild(wallGlow);

  function clearMagnet() {
    panel.style.setProperty("--dock-pull", 0);
    delete panel.dataset.dockTarget;
    wallGlow.style.opacity = "0";
    wallGlow.dataset.side = "";
  }

  function updateWallGlow(side, progress, top, height) {
    wallGlow.dataset.side = side;
    wallGlow.style.left = side === "left" ? "0" : "auto";
    wallGlow.style.right = side === "right" ? "0" : "auto";
    wallGlow.style.opacity = String(progress);
    wallGlow.style.top = `${top}px`;
    wallGlow.style.height = `${height}px`;
  }

  function edgePos(side) {
    return side === "left" ? "left:0;right:auto;" : "right:0;left:auto;";
  }

  function flashSnapEdge(side, top, height) {
    const flash = document.createElement("div");
    flash.style.cssText =
      `position:fixed;top:${top}px;height:${height}px;` +
      `width:${WALL_GLOW_THICKNESS}px;z-index:${Z_DEV_CONSOLE};pointer-events:none;` +
      edgePos(side) +
      `background:rgba(${DOCK_GLOW_COLOR},${SNAP_FLASH_OPACITY});` +
      `box-shadow:0 0 ${SNAP_FLASH_SPREAD}px ${SNAP_FLASH_SPREAD}px rgba(${DOCK_GLOW_COLOR},0.5);`;
    document.body.appendChild(flash);
    const anim = flash.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: SNAP_FLASH_DURATION_MS,
      easing: "ease-out",
    });
    anim.onfinish = () => flash.remove();
    window.dispatchEvent(
      new CustomEvent("dock-snap", { detail: { side, top, height } }),
    );
  }

  function flashReleaseEdge(side, top, height) {
    const flash = document.createElement("div");
    flash.style.cssText =
      `position:fixed;top:${top}px;height:${height}px;` +
      `width:${WALL_GLOW_THICKNESS}px;z-index:${Z_DEV_CONSOLE};pointer-events:none;` +
      edgePos(side) +
      `background:rgba(${DOCK_GLOW_COLOR},${RELEASE_FLASH_OPACITY});` +
      `box-shadow:0 0 ${RELEASE_FLASH_START_SPREAD}px rgba(${DOCK_GLOW_COLOR},0.4);`;
    document.body.appendChild(flash);
    const anim = flash.animate(
      [
        {
          opacity: 1,
          width: `${WALL_GLOW_THICKNESS}px`,
          boxShadow: `0 0 ${RELEASE_FLASH_START_SPREAD}px rgba(${DOCK_GLOW_COLOR},0.4)`,
        },
        {
          opacity: 0,
          width: `${RELEASE_FLASH_END_WIDTH}px`,
          boxShadow: `0 0 ${RELEASE_FLASH_END_SPREAD}px rgba(${DOCK_GLOW_COLOR},0)`,
        },
      ],
      {
        duration: RELEASE_FLASH_DURATION_MS,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    );
    anim.onfinish = () => flash.remove();
    window.dispatchEvent(
      new CustomEvent("dock-release", { detail: { side, top, height } }),
    );
  }

  function animateToState(newState, opts = {}) {
    const fromRect = panel.getBoundingClientRect();
    const wasFloating = dockState === "floating";

    dockState = newState;
    if (newState === "floating") {
      floatX = opts.floatX ?? floatX;
      floatY = opts.floatY ?? floatY;
    } else {
      floatY = fromRect.top;
    }
    panel.style.transform = "";
    applyDock();

    if (opts.skipAnimation) {
      clearMagnet();
      return;
    }

    const toRect = panel.getBoundingClientRect();
    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;
    const sx = fromRect.width / toRect.width;
    const sy = fromRect.height / toRect.height;

    const noMovement =
      Math.abs(dx) < 1 &&
      Math.abs(dy) < 1 &&
      Math.abs(sx - 1) < 0.01 &&
      Math.abs(sy - 1) < 0.01;
    if (noMovement) {
      clearMagnet();
      return;
    }

    const fromRadius = wasFloating ? "8px" : "0px";
    const toRadius = newState === "floating" ? "8px" : "0px";

    dockAnimating = true;
    panel.style.transformOrigin = "top left";
    const anim = panel.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          borderRadius: fromRadius,
        },
        {
          transform: "none",
          borderRadius: toRadius,
        },
      ],
      { duration: DOCK_ANIM_MS, easing: DOCK_ANIM_EASING },
    );
    const cleanup = () => {
      panel.style.transformOrigin = "";
      dockAnimating = false;
      clearMagnet();
    };
    anim.onfinish = cleanup;
    anim.oncancel = cleanup;
  }

  // Cycle dock: right -> left -> float -> right
  btnDock.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dockAnimating) return;
    if (dockState === "docked-right") animateToState("docked-left");
    else if (dockState === "docked-left")
      animateToState("floating", { floatX: 60, floatY: 60 });
    else animateToState("docked-right");
  });

  btnCollapse.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("collapsed");
    const collapsed = panel.classList.contains("collapsed");
    btnCollapse.innerHTML = collapsed ? "&#43;" : "&#8722;";
  });

  // Docked collapsed: click anywhere on header to expand
  header.addEventListener("click", (e) => {
    if (
      panel.classList.contains("collapsed") &&
      dockState !== "floating" &&
      !e.target.closest("button")
    ) {
      panel.classList.remove("collapsed");
      btnCollapse.innerHTML = "&#8722;";
    }
  });

  // Drag to reposition / dock / undock
  header.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || dockAnimating) return;
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    dragStartX = e.clientX;
    header.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  header.addEventListener("pointermove", (e) => {
    if (!isDragging || dockAnimating) return;
    const nx = e.clientX - dragOffX;
    const ny = e.clientY - dragOffY;

    // ── Undock: drag away from the docked edge ──
    const isDocked =
      dockState === "docked-left" || dockState === "docked-right";
    const dockedLeft = dockState === "docked-left";
    const dragDelta = isDocked
      ? (e.clientX - dragStartX) * (dockedLeft ? 1 : -1)
      : -1;

    if (isDocked && dragDelta > 0) {
      if (dragDelta > DOCK_UNDOCK_DRAG) {
        const r = panel.getBoundingClientRect();
        const side = dockedLeft ? "left" : "right";
        flashReleaseEdge(side, r.top, r.height);
        dragOffX = e.clientX - r.left;
        dragOffY = e.clientY - r.top;
        magnetSuppressedSide = side;
        animateToState("floating", {
          floatX: Math.max(0, r.left),
          floatY: Math.max(0, r.top),
          skipAnimation: true,
        });
      } else {
        // Elastic pull hint: nudge panel in drag direction before committing
        const pull = (dragDelta / DOCK_UNDOCK_DRAG) * DOCK_UNDOCK_PULL_PX;
        panel.style.transform = `translateX(${(dockedLeft ? 1 : -1) * pull}px)`;
      }
      return;
    }
    if (dockState !== "floating") {
      panel.style.transform = "";
      return;
    }

    // ── Magnet zone: pull + glow as panel approaches an edge ──
    const leftDist = nx;
    const rightDist = window.innerWidth - (nx + panel.offsetWidth);
    const nearLeft = leftDist < rightDist;
    const edgeDist = nearLeft ? leftDist : rightDist;
    let magnetNx = nx;

    // After undocking, suppress magnet for the undocked edge until the panel
    // has moved beyond the magnet zone from that edge.
    if (magnetSuppressedSide) {
      const suppressedDist =
        magnetSuppressedSide === "left" ? leftDist : rightDist;
      if (suppressedDist >= DOCK_MAGNET_ZONE) magnetSuppressedSide = null;
    }
    const nearSide = nearLeft ? "left" : "right";
    const magnetBlocked = magnetSuppressedSide === nearSide;

    if (!magnetBlocked && edgeDist < DOCK_MAGNET_ZONE && edgeDist >= 0) {
      const progress = Math.pow(
        1 - edgeDist / DOCK_MAGNET_ZONE,
        DOCK_MAGNET_POWER,
      );

      // Visual feedback: edge glow on panel and ghost preview on wall
      const side = nearLeft ? "left" : "right";
      panel.style.setProperty("--dock-pull", progress);
      panel.dataset.dockTarget = side;
      const panelRect = panel.getBoundingClientRect();
      updateWallGlow(side, progress, panelRect.top, panelRect.height);

      // Position bias: accelerate toward the edge
      const bias = progress * edgeDist;
      magnetNx = nearLeft ? nx - bias : nx + bias;

      // Commit to dock when close enough
      if (edgeDist < DOCK_COMMIT_DISTANCE) {
        const panelR = panel.getBoundingClientRect();
        flashSnapEdge(side, panelR.top, panelR.height);
        dragStartX = e.clientX;
        animateToState(nearLeft ? "docked-left" : "docked-right");
        return;
      }
    } else {
      clearMagnet();
    }

    floatX = Math.max(
      0,
      Math.min(magnetNx, window.innerWidth - panel.offsetWidth),
    );
    floatY = Math.max(0, Math.min(ny, window.innerHeight - COLLAPSED_SIZE));
    panel.style.left = `${floatX}px`;
    panel.style.top = `${floatY}px`;
    panel.style.right = "";
    panel.style.bottom = "";
  });

  header.addEventListener("pointerup", () => {
    isDragging = false;
    magnetSuppressedSide = null;
    panel.style.transform = "";
    clearMagnet();
  });

  applyDock();
}

// ── Mode-aware state updates ──

let _prevActiveModes = null;

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

const SCROLL_INTO_VIEW_DELAY_MS = 80;

function updateModeStates(panel) {
  const activeModes = new Set();
  for (const mode of MODE_ORDER) {
    if (document.body.classList.contains(mode)) activeModes.add(mode);
  }

  const isFirstCall = _prevActiveModes === null;
  const modeChanged = isFirstCall || !setsEqual(activeModes, _prevActiveModes);

  // Detect newly activated modes (skip first call — that's initial state, not a user action)
  const newlyActivated = new Set();
  if (!isFirstCall && modeChanged) {
    for (const mode of activeModes) {
      if (!_prevActiveModes.has(mode)) newlyActivated.add(mode);
    }
  }

  const modeEls = panel.querySelectorAll("[data-mode]");
  modeEls.forEach((el) => {
    const mode = el.dataset.mode;
    const isActive = activeModes.has(mode);
    el.classList.toggle("mode-active", isActive);
    el.classList.toggle("mode-inactive", !isActive);

    // Auto-collapse/expand sections on mode change
    if (modeChanged && el.classList.contains("dc-section")) {
      if (isActive) {
        el.classList.remove("collapsed");
        delete el.dataset.userToggled;
      } else if (!el.dataset.userToggled) {
        el.classList.add("collapsed");
      }
    }
  });

  // Auto-scroll to newly activated mode's sub-header
  if (newlyActivated.size > 0) {
    // Pick the last one in MODE_ORDER if multiple activated simultaneously
    let scrollTarget = null;
    for (const mode of MODE_ORDER) {
      if (!newlyActivated.has(mode)) continue;
      const subHeader = panel.querySelector(
        `.dc-mode-subheader[data-mode="${mode}"]`,
      );
      if (subHeader) scrollTarget = subHeader;
    }

    if (scrollTarget && !isAutoScrollSuppressed()) {
      // Expand parent group if collapsed
      const parentGroup = scrollTarget.closest(".dc-group");
      if (parentGroup && parentGroup.classList.contains("collapsed")) {
        parentGroup.classList.remove("collapsed");
      }

      // Delay scroll so DOM expansion settles before measuring positions
      setTimeout(() => {
        if (isAutoScrollSuppressed()) return;
        const body = panel.querySelector(".dc-body");
        if (!body) return;
        const bodyRect = body.getBoundingClientRect();
        const targetRect = scrollTarget.getBoundingClientRect();
        const offset = targetRect.top - bodyRect.top + body.scrollTop;
        body.scrollTo({ top: offset, behavior: "smooth" });
      }, SCROLL_INTO_VIEW_DELAY_MS);
    }
  }

  _prevActiveModes = activeModes;
}

function setupModeObserver(panel) {
  updateModeStates(panel);
  propagateModified(panel);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes" && m.attributeName === "class") {
        updateModeStates(panel);
        break;
      }
    }
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

// ── Auto-scroll suppression while the user interacts with the panel ──
// Pointer activity inside the dev console sets a debounce timer.  While
// active, both mode-change and section-activation auto-scrolls are skipped
// so slider adjustments and drags don't yank the scroll position away.

let _scrollSuppressedUntil = 0;

function suppressAutoScroll() {
  _scrollSuppressedUntil = performance.now() + INTERACTION_QUIET_MS;
}

function isAutoScrollSuppressed() {
  return performance.now() < _scrollSuppressedUntil;
}

// ── Section activation auto-scroll ──
// When an interactive feature activates (e.g. lightning tier reached),
// scroll to its config section once per session so the user can tweak it.

const _seenActiveSections = new Set();

function setupSectionActivateListener(panel) {
  onSectionActivate((category) => {
    if (_seenActiveSections.has(category)) return;
    if (panel.style.display === "none") return;
    if (isAutoScrollSuppressed()) return;
    _seenActiveSections.add(category);

    const sectionEl = panel.querySelector(
      `.dc-section[data-category="${category}"]`,
    );
    if (!sectionEl) return;

    sectionEl.classList.remove("collapsed");

    const parentGroup = sectionEl.closest(".dc-group");
    if (parentGroup && parentGroup.classList.contains("collapsed")) {
      parentGroup.classList.remove("collapsed");
    }

    setTimeout(() => {
      const body = panel.querySelector(".dc-body");
      if (!body) return;
      const bodyRect = body.getBoundingClientRect();
      const targetRect = sectionEl.getBoundingClientRect();
      const offset = targetRect.top - bodyRect.top + body.scrollTop;
      body.scrollTo({ top: offset, behavior: "smooth" });
    }, SCROLL_INTO_VIEW_DELAY_MS);
  });
}

// ── Public: init dev console ──

let panelInstance = null;

export function openDevConsole() {
  showFps();
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type: "dev-console-open" } }),
  );
  if (panelInstance) {
    panelInstance.panel.style.display = "";
    panelInstance.panel.classList.remove("collapsed");
    panelInstance.panel.querySelector(".dc-btn-collapse").innerHTML = "&#8722;";
    return;
  }
  loadDevCss();
  const { panel, searchInput } = buildPanel();
  document.body.appendChild(panel);
  setupDocking(panel);
  setupModeObserver(panel);
  setupSectionActivateListener(panel);
  panelInstance = { panel, searchInput };

  // Suppress auto-scroll while the user interacts with the panel
  panel.addEventListener("pointerdown", suppressAutoScroll);
  panel.addEventListener("pointermove", suppressAutoScroll);
  panel.addEventListener("input", suppressAutoScroll);

  // Close button
  panel.querySelector(".dc-btn-close").addEventListener("click", () => {
    closeDevConsole();
  });

  // Focus search on open
  setTimeout(() => searchInput.focus(), 100);
}

export function closeDevConsole() {
  hideFps();
  if (panelInstance) {
    panelInstance.panel.style.display = "none";
  }
}

export function toggleDevConsole() {
  if (panelInstance && panelInstance.panel.style.display !== "none") {
    closeDevConsole();
  } else {
    openDevConsole();
  }
}
