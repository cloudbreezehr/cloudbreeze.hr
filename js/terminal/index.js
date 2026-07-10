// ── Terminal Overlay ──
// A Quake-style console that drops from the top of the page. Spelling SHELL
// reveals it (the touch route); the backquote key toggles it for keyboard
// users. The command behaviour lives in commands.js — this module owns the
// overlay chrome: scrollback, prompt, history recall, focus containment,
// and the deps that wire commands into the rest of the site.

import { createCommands, executeLine } from "./commands.js";
import { getThemes, toggleTheme } from "../themes/registry.js";
import { INCANTATIONS } from "../effects/incantations.js";
import { openCheatsheet } from "../effects/cheatsheet.js";
import {
  getReachableAchievements,
  sumPoints,
} from "../achievements/registry.js";
import * as storage from "../achievements/storage.js";
import { exportPassport, importPassport } from "../achievements/passport.js";
import { getQualityTier } from "../quality.js";
import { skySeedKey, isTimeTraveling } from "../daily/random.js";
import { dayKey } from "../daily/seed.js";
import { wordOfTheDay } from "../daily/word.js";
import { trapFocus } from "../achievements/focus-trap.js";
import { playSfx } from "../audio/sfx.js";
import { onKey } from "../keyboard.js";
import { buildUrl, getParam } from "../url-params.js";

// Fallback removal delay — generously past the overlay's CSS slide so the
// node is still removed if transitionend never fires.
const FADE_FALLBACK_MS = 400;
// Scrollback cap; oldest lines fall off the top.
const SCROLLBACK_MAX_LINES = 400;
// Where a terminal-cast spell originates: horizontally centred, below the
// dropped console so the effect isn't hidden behind it.
const CAST_X_FRACTION = 0.5;
const CAST_Y_FRACTION = 0.65;

const PROMPT = "visitor@cloudbreeze:~$";
const BANNER = ["CloudbreezeOS 5.0 — the sky shell", "Type 'help' to start."];

let overlayEl = null;
let scrollbackEl = null;
let inputEl = null;
let _escHandler = null;
let _releaseFocusTrap = null;
let _unbindToggle = null;
let _commands = null;

// Command history persists across open/close within the session; the
// recall index resets whenever a new line is submitted or typed.
const history = [];
let historyIndex = -1;
let bannerShown = false;

function emit(type, data = {}) {
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type, ...data } }),
  );
}

// Mirrors the speller's cast action so a spell released from the terminal is
// indistinguishable from a spelled one: same effect, same weapon-slot flash,
// same collectible credit.
function castWord(word) {
  const inc = INCANTATIONS.find((i) => i.word === word);
  if (!inc) return false;
  inc.cast(
    {
      x: window.innerWidth * CAST_X_FRACTION,
      y: window.innerHeight * CAST_Y_FRACTION,
    },
    0,
  );
  window.dispatchEvent(
    new CustomEvent("weapon-select", {
      detail: { icon: inc.icon, label: inc.word },
    }),
  );
  emit("incantation", { word: inc.word, maxed: false });
  return true;
}

function buildDeps() {
  const activeIds = () =>
    getThemes()
      .filter((t) => document.body.classList.contains(t.id))
      .map((t) => t.id);
  return {
    themes: {
      list: () =>
        getThemes().map((t) => ({
          id: t.id,
          label: t.label,
          active: document.body.classList.contains(t.id),
        })),
      activate: (id) => toggleTheme(id),
      // Programmatic exits don't award the organic exit gesture's reward.
      deactivate: (id) => toggleTheme(id, { silent: true }),
      clearAll: () => {
        const removed = activeIds();
        for (const id of removed) toggleTheme(id, { silent: true });
        return removed;
      },
    },
    spellWords: () => INCANTATIONS.map((i) => ({ word: i.word, hint: i.hint })),
    castWord,
    stats: () => {
      const unlockedList = storage.getUnlocked();
      return {
        points: sumPoints(unlockedList),
        unlocked: unlockedList.length,
        total: getReachableAchievements().length,
      };
    },
    qualityTier: getQualityTier,
    // Hand off, don't stack: only one modal owns the foreground at a time, so
    // the terminal closes before the cheatsheet takes over — and reopens once
    // the cheatsheet closes, so the visitor lands back in the shell.
    openCheatsheet: () => {
      closeTerminal();
      openCheatsheet(openTerminal);
    },
    daily: () => ({
      seedKey: skySeedKey(),
      todayKey: dayKey(),
      traveling: isTimeTraveling(),
      // Traveling has two causes with different exits: a #sky link in the
      // URL, or a page left open across local midnight (the seed is fixed
      // at load). Only the first has a link to drop.
      viaLink: getParam("sky") != null,
      word: wordOfTheDay(),
      link: buildUrl({ sky: skySeedKey() }),
    }),
    passport: { issue: exportPassport, stamp: importPassport },
    copy: (text) => {
      navigator.clipboard?.writeText(text).catch(() => {});
    },
    emit,
  };
}

function print(lines, className) {
  // A command's own side effect (e.g. man handing off to the cheatsheet) can
  // close the terminal before its result is printed — nowhere left to print to.
  if (!scrollbackEl) return;
  for (const text of lines) {
    const line = document.createElement("div");
    line.className = className ? `terminal-line ${className}` : "terminal-line";
    line.textContent = text;
    scrollbackEl.appendChild(line);
  }
  while (scrollbackEl.children.length > SCROLLBACK_MAX_LINES) {
    scrollbackEl.firstChild.remove();
  }
  scrollbackEl.scrollTop = scrollbackEl.scrollHeight;
}

function submit() {
  const line = inputEl.value;
  inputEl.value = "";
  historyIndex = -1;
  if (line.trim()) {
    history.push(line.trim());
    emit("terminal-command", { command: line.trim().split(/\s+/)[0] });
  }
  print([`${PROMPT} ${line}`], "terminal-echo");
  const result = executeLine(line, _commands, { history });
  if (result.clear) scrollbackEl.textContent = "";
  if (result.lines.length) print(result.lines);
  if (result.close) closeTerminal();
}

function recallHistory(step) {
  if (history.length === 0) return;
  if (historyIndex === -1 && step < 0) historyIndex = history.length;
  historyIndex = Math.min(Math.max(historyIndex + step, 0), history.length);
  inputEl.value = historyIndex === history.length ? "" : history[historyIndex];
}

function buildOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "terminal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Terminal");

  scrollbackEl = document.createElement("div");
  scrollbackEl.className = "terminal-scrollback";
  // Polite live region: command output reads out without stealing focus.
  scrollbackEl.setAttribute("aria-live", "polite");
  overlay.appendChild(scrollbackEl);

  const form = document.createElement("form");
  form.className = "terminal-input-line";
  const prompt = document.createElement("span");
  prompt.className = "terminal-prompt";
  prompt.textContent = PROMPT;
  prompt.setAttribute("aria-hidden", "true");
  inputEl = document.createElement("input");
  inputEl.className = "terminal-input";
  inputEl.type = "text";
  inputEl.autocomplete = "off";
  inputEl.autocapitalize = "off";
  inputEl.spellcheck = false;
  inputEl.setAttribute("aria-label", "Terminal command");
  form.append(prompt, inputEl);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submit();
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      recallHistory(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      recallHistory(1);
    }
  });
  overlay.appendChild(form);

  // A click anywhere in the console refocuses the prompt.
  overlay.addEventListener("pointerdown", () => {
    requestAnimationFrame(() => inputEl.focus());
  });
  return overlay;
}

export function openTerminal() {
  if (overlayEl) return;
  if (!_commands) _commands = createCommands(buildDeps());
  overlayEl = buildOverlay();
  document.body.appendChild(overlayEl);
  void overlayEl.offsetHeight;
  overlayEl.classList.add("visible");
  playSfx("panelOpen", { ui: true });
  if (!bannerShown) {
    bannerShown = true;
    print(BANNER, "terminal-banner");
  }
  _releaseFocusTrap = trapFocus(overlayEl, { initialFocus: inputEl });
  _escHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeTerminal();
    }
  };
  document.addEventListener("keydown", _escHandler);
  emit("terminal-open");
}

export function closeTerminal() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  scrollbackEl = null;
  inputEl = null;
  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  el.classList.remove("visible");
  playSfx("panelClose", { ui: true });
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  setTimeout(() => el.remove(), FADE_FALLBACK_MS);
}

export function toggleTerminal() {
  if (overlayEl) closeTerminal();
  else openTerminal();
}

export function isTerminalOpen() {
  return overlayEl != null;
}

export function initTerminal() {
  _unbindToggle = onKey("`", toggleTerminal);
}

// Test hook — drop the singleton, session state, and toggle listener.
export function _resetForTests() {
  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  if (_unbindToggle) {
    _unbindToggle();
    _unbindToggle = null;
  }
  if (overlayEl && overlayEl.parentNode) overlayEl.remove();
  overlayEl = null;
  scrollbackEl = null;
  inputEl = null;
  _commands = null;
  history.length = 0;
  historyIndex = -1;
  bannerShown = false;
}
