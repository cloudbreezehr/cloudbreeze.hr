// ── Photo Mode ──
// Spell PHOTO and the page steps aside: only the sky remains, plus a small
// bar to save the current frame as a PNG keepsake. The export captures the
// canvas exactly as posed — same size, same frame — with the active theme's
// CSS filter baked in where the browser supports canvas filters.

import { playSfx } from "../audio/sfx.js";
import { onKey } from "../keyboard.js";
import { downloadBlob } from "../download.js";

const CANVAS_ID = "bg-canvas";
const FILENAME = "cloudbreeze-sky.png";
// Fallback removal delay — generously past the bar's CSS fade.
const FADE_FALLBACK_MS = 400;

let barEl = null;
let _escHandler = null;
let _unbindSave = null;

function emit(type) {
  window.dispatchEvent(new CustomEvent("achievement", { detail: { type } }));
}

/**
 * Capture the live canvas into a same-size PNG and trigger a download.
 * The canvas element's CSS filter (a theme's tone shift) is re-applied via
 * ctx.filter so the file matches the screen; engines without canvas filter
 * support save the unfiltered sky instead of nothing.
 */
export function saveSkyPhoto() {
  const src = document.getElementById(CANVAS_ID);
  if (!src || typeof src.toBlob !== "function") return false;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d");
  if (!ctx) return false;
  const filter = getComputedStyle(src).filter;
  if (filter && filter !== "none" && "filter" in ctx) ctx.filter = filter;
  ctx.drawImage(src, 0, 0);
  out.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, FILENAME);
  });
  playSfx("snap", { ui: true });
  emit("photo-saved");
  return true;
}

function buildBar() {
  const bar = document.createElement("div");
  bar.className = "photo-mode-bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Photo mode");

  const hint = document.createElement("span");
  hint.className = "photo-mode-hint";
  hint.textContent = "The sky is yours.";

  const save = document.createElement("button");
  save.className = "photo-mode-save";
  save.textContent = "Save wallpaper";
  save.addEventListener("click", () => saveSkyPhoto());

  const done = document.createElement("button");
  done.className = "photo-mode-done";
  done.textContent = "Done";
  done.addEventListener("click", () => exitPhotoMode());

  bar.append(hint, save, done);
  return bar;
}

export function enterPhotoMode() {
  if (barEl) return;
  document.body.classList.add("photo-mode");
  barEl = buildBar();
  document.body.appendChild(barEl);
  void barEl.offsetHeight;
  barEl.classList.add("visible");
  playSfx("panelOpen", { ui: true });
  _escHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      exitPhotoMode();
    }
  };
  document.addEventListener("keydown", _escHandler);
  _unbindSave = onKey("s", () => saveSkyPhoto());
  emit("photo-mode");
}

export function exitPhotoMode() {
  if (!barEl) return;
  const el = barEl;
  barEl = null;
  document.body.classList.remove("photo-mode");
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  if (_unbindSave) {
    _unbindSave();
    _unbindSave = null;
  }
  el.classList.remove("visible");
  playSfx("panelClose", { ui: true });
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), FADE_FALLBACK_MS);
}

export function isPhotoModeOpen() {
  return barEl != null;
}

// Test hook — drop the singleton and its listeners.
export function _resetForTests() {
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  if (_unbindSave) {
    _unbindSave();
    _unbindSave = null;
  }
  if (barEl && barEl.parentNode) barEl.remove();
  barEl = null;
  document.body.classList.remove("photo-mode");
}
