// ── Konami Trigger ──
// Listens for the classic up-up-down-down-left-right-left-right-B-A
// sequence; on match, shows a brief Enter-to-confirm prompt; on Enter
// inside the window, turns every registered theme on at once — or clears
// them all if they're already on.  Wrong key or timeout resets the
// sequence so a mistype doesn't leave the prompt dangling.

import { getThemeIds, toggleTheme } from "./registry.js";

const SEQUENCE = Object.freeze([
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
]);

const CONFIRM_TIMEOUT_MS = 4000;
const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function initKonami() {
  let pos = 0;
  let awaitingConfirm = false;
  let confirmTimer = null;
  let promptEl = null;

  function clearPrompt() {
    if (confirmTimer) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
    if (promptEl) {
      promptEl.remove();
      promptEl = null;
    }
    awaitingConfirm = false;
  }

  function reset() {
    pos = 0;
    clearPrompt();
  }

  function showConfirmPrompt() {
    promptEl = document.createElement("div");
    promptEl.className = "konami-confirm-prompt";
    promptEl.textContent = "Press Enter to engage chaos mode";
    document.body.appendChild(promptEl);
    awaitingConfirm = true;
    confirmTimer = setTimeout(reset, CONFIRM_TIMEOUT_MS);
  }

  function engageChaos() {
    reset();
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "konami-cheat" } }),
    );
    // Toggle-all: turn every theme on, or — when they're all already on —
    // clear them. The clear path is silent (a bulk cheat, like lights-out),
    // so it doesn't hand out the per-theme exit achievements reserved for the
    // real exit gestures.
    const ids = getThemeIds();
    const allActive = ids.every((id) => document.body.classList.contains(id));
    for (const id of ids) {
      if (allActive) toggleTheme(id, { silent: true });
      else if (!document.body.classList.contains(id)) toggleTheme(id);
    }
  }

  function onKeydown(e) {
    const tag = document.activeElement?.tagName;
    if (tag && INPUT_TAGS.has(tag)) return;
    if (document.activeElement?.isContentEditable) return;

    if (awaitingConfirm) {
      if (e.key === "Enter") {
        e.preventDefault();
        engageChaos();
      } else if (e.key !== "Shift" && e.key !== "Control" && e.key !== "Alt") {
        reset();
      }
      return;
    }

    const expected = SEQUENCE[pos];
    const actual = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (actual === expected) {
      pos++;
      if (pos === SEQUENCE.length) showConfirmPrompt();
    } else {
      // Soft reset — if the wrong key happens to start the sequence,
      // count it as the new first key so users don't have to lift and
      // restart after one stray press.
      pos = actual === SEQUENCE[0] ? 1 : 0;
    }
  }

  window.addEventListener("keydown", onKeydown);

  return {
    stop() {
      window.removeEventListener("keydown", onKeydown);
      reset();
    },
  };
}

// Test hooks — exports for sequence introspection.
export const _KONAMI_SEQUENCE = SEQUENCE;
export const _KONAMI_CONFIRM_TIMEOUT_MS = CONFIRM_TIMEOUT_MS;
