// ── Achievement Registry ──
// All achievement definitions as pure data. No logic, no conditions —
// detection lives elsewhere where event state is available.
//
// An entry may declare `requires: "keyboard" | "hover"` when it can only be
// earned with that input capability (a keyboard shortcut, a hover-resting
// cursor). Such achievements are filtered out of completion totals on devices
// that lack the capability, so a touch-only device can still reach 100%.

import { getTheme } from "../themes/registry.js";
import { hasCapability } from "../device.js";

// Inline SVG icons for the non-theme sets.  Theme sets reuse their theme's
// icon so there's one source of truth per theme.  All icons use a 16×16
// viewBox and currentColor so they inherit the set's accent tint.
const EXPLORATION_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="5.5"/>' +
  '<path d="M11 5l-2 4-4 2 2-4z" fill="currentColor" stroke="none"/>' +
  "</svg>";
const MASTERY_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
  '<path d="M8 1.5l1.8 4 4.2.4-3.2 2.8 1 4.3L8 10.8 4.2 13l1-4.3L2 5.9l4.2-.4z"/>' +
  "</svg>";
const META_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 14V3"/>' +
  '<path d="M3 3h8l-1.5 2.5L11 8H3" fill="currentColor"/>' +
  "</svg>";
// Crescent moon and a star — the real sky's own calendar.
const ALMANAC_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
  '<path d="M13.6 9A5.5 5.5 0 1 1 7 2.4 4.3 4.3 0 0 0 13.6 9z"/>' +
  '<circle cx="12" cy="3.6" r="1"/>' +
  "</svg>";
// A click spark — a dot throwing off rays.
const INTERACTION_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="1.6" fill="currentColor" stroke="none"/>' +
  '<path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/>' +
  "</svg>";
// A magic sparkle — a four-point star with a small companion.
const INCANTATIONS_ICON =
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
  '<path d="M8 1l1.3 4.7L14 7l-4.7 1.3L8 13l-1.3-4.7L2 7l4.7-1.3z"/>' +
  '<circle cx="12.8" cy="12" r="1"/>' +
  "</svg>";
// A terminal window with a >_ prompt.
const TERMINAL_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="2" y="3" width="12" height="10" rx="1.5"/>' +
  '<path d="M4.8 6.5l2 2-2 2M8.5 10.5h3"/>' +
  "</svg>";
// Two overlapping windows — one sky across panes.
const LINKED_SKIES_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="2" y="4.5" width="8" height="7" rx="1"/>' +
  '<rect x="6" y="4.5" width="8" height="7" rx="1"/>' +
  "</svg>";
// A bound logbook — spine and a couple of ruled entries.
const CLOUDLOG_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="2.5" width="10" height="11" rx="1"/>' +
  '<path d="M6 2.5v11"/>' +
  '<path d="M8 6h3M8 8.5h3"/>' +
  "</svg>";
// A half-filled circle — the light/dark contrast of the appearance toggle.
const APPEARANCE_ICON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="5.5"/>' +
  '<path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none"/>' +
  "</svg>";

// ── Point Tiers ──
const TRIVIAL = 1;
const COMMON = 5;
const UNCOMMON = 10;
const RARE = 25;
const EPIC = 50;
const LEGENDARY = 100;

export const POINT_TIERS = { TRIVIAL, COMMON, UNCOMMON, RARE, EPIC, LEGENDARY };

// ── Achievement Sets ──
// Theme sets pull their icon from the theme registry so there's one source of
// truth per theme.  Non-theme sets declare their icon inline above.  Theme
// descriptors are static data in themes/registry.js, so `getTheme(id)` is
// safe to call at module load time — no init order dependency.
export const SETS = [
  { id: "cloudlog", label: "Cloudlog", color: null, icon: CLOUDLOG_ICON },
  {
    id: "interaction",
    label: "Interaction",
    color: null,
    icon: INTERACTION_ICON,
  },
  {
    id: "exploration",
    label: "Exploration",
    color: null,
    icon: EXPLORATION_ICON,
  },
  { id: "appearance", label: "Appearance", color: null, icon: APPEARANCE_ICON },
  { id: "mastery", label: "Mastery", color: null, icon: MASTERY_ICON },
  { id: "almanac", label: "Almanac", color: null, icon: ALMANAC_ICON },
  {
    id: "incantations",
    label: "Incantations",
    color: null,
    icon: INCANTATIONS_ICON,
  },
  { id: "terminal", label: "Terminal", color: null, icon: TERMINAL_ICON },
  {
    id: "linked-skies",
    label: "Linked Skies",
    color: null,
    icon: LINKED_SKIES_ICON,
  },
  {
    id: "deep-sea",
    label: "Deep Sea",
    color: "#00ffc8",
    icon: getTheme("deep-sea")?.icon,
  },
  {
    id: "frozen",
    label: "Frozen",
    color: "#88d4f7",
    icon: getTheme("frozen")?.icon,
  },
  {
    id: "blocky",
    label: "Blocky",
    color: "#ffa040",
    icon: getTheme("blocky")?.icon,
  },
  {
    id: "rainy",
    label: "Rainy",
    color: "#6a9fc0",
    icon: getTheme("rainy")?.icon,
  },
  {
    id: "paper",
    label: "Paper",
    color: "#a89580",
    icon: getTheme("paper")?.icon,
  },
  {
    id: "vhs",
    label: "VHS",
    color: "#b4f0b4",
    icon: getTheme("vhs")?.icon,
  },
  {
    id: "upside-down",
    label: "Upside Down",
    color: "#e04050",
    icon: getTheme("upside-down")?.icon,
  },
  {
    id: "constellation",
    label: "Constellation",
    color: "#c0c8ff",
    icon: getTheme("constellation")?.icon,
  },
  {
    id: "matrix",
    label: "Matrix",
    color: "#33d96a",
    icon: getTheme("matrix")?.icon,
  },
  {
    id: "wanted",
    label: "Wanted",
    color: "#ff6a00",
    icon: getTheme("wanted")?.icon,
  },
  { id: "meta", label: "Milestones", color: null, icon: META_ICON },
];

// ── Achievement Definitions ──

export const ACHIEVEMENTS = [
  // ── Cloudlog ──
  {
    id: "cloudlog-activated",
    title: "Cloudlog Activated",
    description: "You found the hidden logbook.",
    hint: "Triple-click anywhere on the page",
    set: "cloudlog",
    points: UNCOMMON,
    hidden: false,
  },
  {
    id: "cloud-reader",
    title: "Cloud Reader",
    description: "The first page turns.",
    hint: "Open the Cloudlog panel",
    set: "cloudlog",
    points: COMMON,
    hidden: false,
  },
  {
    id: "tab-tourist",
    title: "Tab Tourist",
    description: "Both halves of the logbook, browsed.",
    hint: "Switch between the Achievements and Activity tabs",
    set: "cloudlog",
    points: UNCOMMON,
    hidden: true,
    progressKey: "panel-tabs-visited",
  },
  {
    id: "time-warp",
    title: "Time Warp",
    description: "Time stands still when you look closely.",
    hint: "Click a relative timestamp to see absolute time",
    set: "cloudlog",
    points: COMMON,
    hidden: true,
  },
  {
    id: "shortcut-master",
    title: "Shortcut Master",
    description: "You found the quick way in.",
    hint: "Open the Cloudlog with a keyboard shortcut",
    set: "cloudlog",
    points: COMMON,
    hidden: true,
    requires: "keyboard",
  },
  // ── Incantations ──
  {
    id: "wordsmith",
    title: "Wordsmith",
    description: "You spelled it out.",
    hint: "Toggle a theme by entering the letters of its name",
    set: "incantations",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "abracadabra",
    title: "Abracadabra",
    description: "Some words are spells.",
    hint: "Spell a magic word that isn't a theme",
    set: "incantations",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "grimoire",
    title: "Grimoire",
    description: "The whole spellbook, committed to memory.",
    hint: "Cast every incantation",
    set: "incantations",
    points: RARE,
    hidden: true,
    progressKey: "incantations-cast",
  },
  {
    id: "overkill",
    title: "Overkill",
    description: "Why stop at boom?",
    hint: "Charge an incantation all the way to its limit",
    set: "incantations",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "clean-slate",
    title: "Clean Slate",
    description: "Wiped away in a flurry.",
    hint: "Scribble to clear every active theme at once",
    set: "incantations",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Interaction ──
  {
    id: "first-light",
    title: "First Light",
    description: "A ripple in the stillness.",
    hint: "Click anywhere on the canvas",
    set: "interaction",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "spark",
    title: "Spark",
    description: "Something stirs where you touched.",
    hint: "Click to create a particle burst",
    set: "interaction",
    points: COMMON,
    hidden: true,
  },
  {
    id: "trail-blazer",
    title: "Trail Blazer",
    description: "You leave a mark wherever you go.",
    hint: "Click and drag across the canvas",
    set: "interaction",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "the-long-drag",
    title: "The Long Drag",
    description: "A trail across the sky.",
    hint: "Drag across 40% of the screen in one motion",
    set: "interaction",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "magnetic-letters",
    title: "Magnetic Letters",
    description: "The logo leans toward you.",
    hint: "Move your cursor near the Cloudbreeze wordmark",
    set: "interaction",
    points: COMMON,
    hidden: true,
  },
  // ── Interaction: Scroll ──
  {
    id: "stargazer",
    title: "Stargazer",
    description: "The sky responds to your gaze.",
    hint: "Scroll past 25% of the page",
    set: "interaction",
    points: COMMON,
    hidden: false,
  },
  {
    id: "down-to-earth",
    title: "Down to Earth",
    description: "You've seen it all — from stars to horizon.",
    hint: "Scroll to the bottom of the page",
    set: "interaction",
    points: COMMON,
    hidden: false,
  },
  {
    id: "zenith",
    title: "Zenith",
    description: "The journey there and back again.",
    hint: "Scroll to the bottom, then back to the top",
    set: "interaction",
    points: COMMON,
    hidden: false,
  },
  {
    id: "scroll-surge",
    title: "Scroll Surge",
    description: "The page blurs past.",
    hint: "Scroll fast enough to blur the particles",
    set: "interaction",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Appearance ──
  {
    id: "daybreak",
    title: "Daybreak",
    description: "Light breaks through.",
    hint: "Switch to light appearance",
    set: "appearance",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "nightfall",
    title: "Nightfall",
    description: "The sky darkens at your command.",
    hint: "Switch to dark appearance",
    set: "appearance",
    points: TRIVIAL,
    hidden: false,
  },
  {
    id: "dusk-and-dawn",
    title: "Dusk and Dawn",
    description: "You've seen both sides of the sky.",
    hint: "Toggle the appearance at least 3 times",
    set: "appearance",
    points: UNCOMMON,
    hidden: false,
    progressKey: "appearance-toggles-3",
  },
  {
    id: "full-spectrum",
    title: "Full Spectrum",
    description: "Every shade of sky, sampled.",
    hint: "Use dark, light, and auto appearances",
    set: "appearance",
    points: UNCOMMON,
    hidden: false,
    progressKey: "appearances-used",
  },
  {
    id: "cartographers-almanac",
    title: "Cartographer's Almanac",
    description: "The same logbook, every shade of sky.",
    hint: "Open the Cloudlog panel under each appearance",
    set: "appearance",
    points: UNCOMMON,
    hidden: true,
    progressKey: "almanac-appearances",
  },
  // ── Exploration: Social ──
  {
    id: "landfall",
    title: "Landfall",
    description: "A message sent into the cloud.",
    hint: "Click the email contact link",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  {
    id: "connected",
    title: "Connected",
    description: "You found us out there.",
    hint: "Click the LinkedIn link",
    set: "exploration",
    points: COMMON,
    hidden: false,
  },
  // ── Exploration: Time ──
  {
    id: "moonlit",
    title: "Moonlit",
    description: "The sky is different at night.",
    hint: "Visit the site between midnight and 5 AM",
    set: "almanac",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Exploration: Dev ──
  {
    id: "reverse-engineer",
    title: "Reverse Engineer",
    description: "Behind the curtain.",
    hint: "Open the developer console",
    set: "exploration",
    points: RARE,
    hidden: true,
  },

  // ── Mastery: Hold / Gravity Progression ──
  {
    id: "gathering-storm",
    title: "Gathering Storm",
    description: "The particles sense your presence.",
    hint: "Hold click until particles begin to gather",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "orbit-lock",
    title: "Orbit Lock",
    description: "They circle endlessly.",
    hint: "Hold click until particles lock into orbit",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "eye-of-the-storm",
    title: "Eye of the Storm",
    description: "Everything orbits around you now.",
    hint: "Hold click until a full orbit forms",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "event-horizon",
    title: "Event Horizon",
    description: "A well opened in the fabric of the sky.",
    hint: "Hold click long enough to open a gravity well",
    set: "mastery",
    points: EPIC,
    hidden: true,
  },
  {
    id: "singularity",
    title: "Singularity",
    description: "The well consumed everything in its reach.",
    hint: "Fill the gravity well to maximum strength",
    set: "mastery",
    points: LEGENDARY,
    hidden: true,
  },
  {
    id: "void-caller",
    title: "Void Caller",
    description: "The well opens again.",
    hint: "Open the gravity well 3 times in one session",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  // ── Mastery: Fury ──
  {
    id: "fury-unleashed",
    title: "Fury Unleashed",
    description: "Lightning answered your call.",
    hint: "Trigger a lightning strike",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "northern-lights",
    title: "Northern Lights",
    description: "The aurora ripples above.",
    hint: "Trigger the aurora effect",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "chain-lightning",
    title: "Chain Lightning",
    description: "The sky won't stop flashing.",
    hint: "Trigger lightning 5 times in one session",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "aftershock",
    title: "Aftershock",
    description: "The click echoes.",
    hint: "Click within 2 seconds of a lightning strike",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Mastery: Shake ──
  {
    id: "snow-globe",
    title: "Snow Globe",
    description: "You shook the sky.",
    hint: "Rapidly reverse scroll direction",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  // ── Mastery: Click Skill ──
  {
    id: "rapid-fire",
    title: "Rapid Fire",
    description: "A flurry of sparks.",
    hint: "Click 10 times within 3 seconds",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "cartographer",
    title: "Cartographer",
    description: "Every corner explored.",
    hint: "Click in all four quadrants of the screen",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
    progressKey: "quadrants-clicked",
  },
  {
    id: "pixel-perfect",
    title: "Pixel Perfect",
    description: "Bullseye.",
    hint: "Click the exact center of the viewport",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  // ── Mastery: Time / Dedication ──
  {
    id: "idle-hands",
    title: "Idle Hands",
    description: "The cursor stirs on its own.",
    hint: "Leave the cursor idle long enough to see it animate",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
    requires: "hover",
  },
  {
    id: "idle-watcher",
    title: "Idle Watcher",
    description: "Every idle animation, witnessed.",
    hint: "See all cursor idle animations",
    set: "mastery",
    points: RARE,
    hidden: true,
    progressKey: "idle-animations",
    requires: "hover",
  },
  {
    id: "night-owl",
    title: "Night Owl",
    description: "Still here? The sky notices.",
    hint: "Stay on the page for 10 minutes",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "the-long-watch",
    title: "The Long Watch",
    description: "Five minutes under one sky, unbroken.",
    hint: "Stay in a single theme for 5 minutes without switching",
    set: "mastery",
    points: EPIC,
    hidden: true,
  },
  {
    id: "persistent-explorer",
    title: "Persistent Explorer",
    description: "You keep coming back.",
    hint: "Visit the site on 3 different days",
    set: "almanac",
    points: RARE,
    hidden: true,
    progressKey: "days-3",
  },
  {
    id: "elemental",
    title: "Elemental",
    description: "Every sky, sampled.",
    hint: "Activate every theme at least once",
    set: "mastery",
    points: LEGENDARY,
    hidden: true,
    progressKey: "themes-activated",
  },

  // ── Deep Sea ──
  {
    id: "the-depths",
    title: "The Depths",
    description: "You sank beneath the surface.",
    hint: "Activate deep-sea theme",
    set: "deep-sea",
    points: EPIC,
    hidden: true,
  },
  {
    id: "bioluminescent",
    title: "Bioluminescent",
    description: "Life glows in the darkness below.",
    hint: "Click anywhere in deep-sea theme",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "jellyfish-drift",
    title: "Jellyfish Drift",
    description: "They pulse with ancient rhythm.",
    hint: "Watch 5 jellyfish complete their pulse",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
    progressKey: "jellyfish-pulses",
  },
  {
    id: "pressure-drop",
    title: "Pressure Drop",
    description: "The ocean floor trembles.",
    hint: "Open a gravity well in deep-sea theme",
    set: "deep-sea",
    points: RARE,
    hidden: true,
  },
  {
    id: "deep-orbit",
    title: "Deep Orbit",
    description: "They spiral in the current.",
    hint: "Lock particles into orbit in deep-sea theme",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "storm-surge",
    title: "Storm Surge",
    description: "Thunder in the deep.",
    hint: "Trigger lightning in deep-sea theme",
    set: "deep-sea",
    points: RARE,
    hidden: true,
  },
  {
    id: "permafrost",
    title: "Permafrost",
    description: "The ocean freezes.",
    hint: "Shake the sky in deep-sea theme",
    set: "deep-sea",
    points: RARE,
    hidden: true,
  },
  {
    id: "resurface",
    title: "Resurface",
    description: "You clawed your way back to the light.",
    hint: "Long-press the footer again to surface",
    set: "deep-sea",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "abyssal-explorer",
    title: "Abyssal Explorer",
    description: "The deep sea holds no more secrets.",
    hint: "Unlock all other deep-sea achievements",
    set: "deep-sea",
    points: LEGENDARY,
    hidden: true,
    progressKey: "deep-sea-set",
  },

  // ── Frozen ──
  {
    id: "first-frost",
    title: "First Frost",
    description: "The air turned cold.",
    hint: "Activate frozen theme",
    set: "frozen",
    points: EPIC,
    hidden: true,
  },
  {
    id: "frost-breath",
    title: "Frost Breath",
    description: "Your breath crystallizes in the chill.",
    hint: "Exhale frost in frozen theme",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "snowdrift",
    title: "Snowdrift",
    description: "The flakes obey the wind.",
    hint: "Drag through the snow in frozen theme",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "blizzard",
    title: "Blizzard",
    description: "A whiteout engulfs the sky.",
    hint: "Shake the sky in frozen theme",
    set: "frozen",
    points: RARE,
    hidden: true,
  },
  {
    id: "frozen-lightning",
    title: "Frozen Lightning",
    description: "Ice and fire.",
    hint: "Trigger lightning in frozen theme",
    set: "frozen",
    points: RARE,
    hidden: true,
  },
  {
    id: "thaw",
    title: "Thaw",
    description: "The ice recedes.",
    hint: "Click the logo again to thaw the ice",
    set: "frozen",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "glacial-mastery",
    title: "Glacial Mastery",
    description: "The frozen sky bends to your will.",
    hint: "Unlock all other frozen achievements",
    set: "frozen",
    points: LEGENDARY,
    hidden: true,
    progressKey: "frozen-set",
  },

  // ── Blocky ──
  {
    id: "resolution-drop",
    title: "Resolution Drop",
    description: "Reality pixelated.",
    hint: "Activate blocky theme",
    set: "blocky",
    points: EPIC,
    hidden: true,
  },
  {
    id: "pixel-burst",
    title: "Pixel Burst",
    description: "Blocks scatter like fragments of a broken screen.",
    hint: "Click anywhere in blocky theme",
    set: "blocky",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "8-bit-storm",
    title: "8-Bit Storm",
    description: "A retro tempest brews.",
    hint: "Trigger lightning in blocky theme",
    set: "blocky",
    points: RARE,
    hidden: true,
  },
  {
    id: "defrag",
    title: "Defrag",
    description: "Resolution restored.",
    hint: "Click the appearance toggle again",
    set: "blocky",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "voxel-master",
    title: "Voxel Master",
    description: "Every block accounted for.",
    hint: "Unlock all other blocky achievements",
    set: "blocky",
    points: LEGENDARY,
    hidden: true,
    progressKey: "blocky-set",
  },

  // ── Rainy ──
  {
    id: "first-drop",
    title: "First Drop",
    description: "The clouds opened.",
    hint: "Activate rainy theme",
    set: "rainy",
    points: EPIC,
    hidden: true,
  },
  {
    id: "puddle-jump",
    title: "Puddle Jump",
    description: "Splashes follow your steps.",
    hint: "Click anywhere in rainy theme",
    set: "rainy",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "thunder-roll",
    title: "Thunder Roll",
    description: "The sky rumbles and flashes.",
    hint: "Trigger lightning in rainy theme",
    set: "rainy",
    points: RARE,
    hidden: true,
  },
  {
    id: "monsoon",
    title: "Monsoon",
    description: "The rain has weight now.",
    hint: "Open a gravity well in rainy theme",
    set: "rainy",
    points: RARE,
    hidden: true,
  },
  {
    id: "rainbow",
    title: "Rainbow",
    description: "The storm breaks.",
    hint: "Click the hero tag again to clear the rain",
    set: "rainy",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "storm-chaser",
    title: "Storm Chaser",
    description: "You danced through every drop.",
    hint: "Unlock all other rainy achievements",
    set: "rainy",
    points: LEGENDARY,
    hidden: true,
    progressKey: "rainy-set",
  },

  // ── Paper ──
  {
    id: "first-sketch",
    title: "First Sketch",
    description: "The page is yours to draw on.",
    hint: "Activate paper theme",
    set: "paper",
    points: EPIC,
    hidden: true,
  },
  {
    id: "doodler",
    title: "Doodler",
    description: "Ten strokes across the page.",
    hint: "Draw 10 strokes in paper theme",
    set: "paper",
    points: UNCOMMON,
    hidden: true,
    progressKey: "paper-strokes",
  },
  {
    id: "ink-splatter",
    title: "Ink Splatter",
    description: "The nib jumps, ink bleeds across the page.",
    hint: "Trigger lightning in paper theme",
    set: "paper",
    points: RARE,
    hidden: true,
  },
  {
    id: "margin-notes",
    title: "Margin Notes",
    description: "A scribble in the notebook's margin.",
    hint: "Click a service card in paper theme",
    set: "paper",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "blank-page",
    title: "Blank Page",
    description: "The marks fade, the paper clears.",
    hint: "Type ERASE to clear the page",
    set: "paper",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "sketchbook-full",
    title: "Sketchbook Full",
    description: "Every page has ink on it.",
    hint: "Unlock all other paper achievements",
    set: "paper",
    points: LEGENDARY,
    hidden: true,
    progressKey: "paper-set",
  },

  // ── VHS ──
  {
    id: "tracking-lost",
    title: "Tracking Lost",
    description: "Please adjust the tracking on your VCR.",
    hint: "Activate VHS theme",
    set: "vhs",
    points: EPIC,
    hidden: true,
  },
  {
    id: "phosphor-burn",
    title: "Phosphor Burn",
    description: "The image stays after the source has gone.",
    hint: "Hold the cursor still in one spot for 5 seconds in VHS theme",
    set: "vhs",
    points: UNCOMMON,
    hidden: true,
    requires: "hover",
  },
  {
    id: "channel-surfer",
    title: "Channel Surfer",
    description: "Glitch through the static.",
    hint: "Trigger 5 click glitches in one session in VHS theme",
    set: "vhs",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "bad-tracking",
    title: "Bad Tracking",
    description: "The tape is being eaten by the player.",
    hint: "Open a gravity well in VHS theme",
    set: "vhs",
    points: RARE,
    hidden: true,
  },
  {
    id: "tape-eject",
    title: "Tape Eject",
    description: "The cassette pops free.",
    hint: "Press Escape a few times to eject the tape",
    set: "vhs",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "analog-mastery",
    title: "Analog Mastery",
    description: "Every distortion catalogued.",
    hint: "Unlock all other VHS achievements",
    set: "vhs",
    points: LEGENDARY,
    hidden: true,
    progressKey: "vhs-set",
  },

  // ── Upside Down ──
  {
    id: "the-flip",
    title: "The Flip",
    description: "The world inverted.",
    hint: "Activate upside-down theme",
    set: "upside-down",
    points: EPIC,
    hidden: true,
  },
  {
    id: "disoriented",
    title: "Disoriented",
    description: "Everything is wrong and you like it.",
    hint: "Scroll to the bottom while upside-down",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "rift-walker",
    title: "Rift Walker",
    description: "You move through the inverted world with purpose.",
    hint: "Click anywhere in upside-down theme",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "boundary-break",
    title: "Boundary Break",
    description: "The wall between worlds is thin here.",
    hint: "Reach the tipping point for upside-down theme",
    set: "upside-down",
    points: RARE,
    hidden: true,
  },
  {
    id: "vertigo",
    title: "Vertigo",
    description: "Rapid fire, wrong side up.",
    hint: "Rapid-fire click 10 times while upside-down",
    set: "upside-down",
    points: RARE,
    hidden: true,
  },
  {
    id: "glitch",
    title: "Glitch",
    description: "Reality errors in the rift.",
    hint: "Trigger lightning in upside-down theme",
    set: "upside-down",
    points: RARE,
    hidden: true,
  },
  {
    id: "restoration",
    title: "Restoration",
    description: "The world rights itself.",
    hint: "Overscroll again to flip back upright",
    set: "upside-down",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "world-turner",
    title: "World Turner",
    description: "Both sides of reality explored.",
    hint: "Unlock all other upside-down achievements",
    set: "upside-down",
    points: LEGENDARY,
    hidden: true,
    progressKey: "upside-down-set",
  },

  // ── Constellation ──
  {
    id: "lone-star",
    title: "Lone Star",
    description: "One bright dot, lit by a click.",
    hint: "Click a star in the sky",
    set: "constellation",
    points: TRIVIAL,
    hidden: true,
  },
  {
    id: "belt-of-orion",
    title: "The Hunter's Belt",
    description: "Three stars clasped together.",
    hint: "Trace Orion's Belt by clicking the right stars",
    set: "constellation",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "the-queens-chair",
    title: "The Queen's Chair",
    description: "Cassiopeia traced in the dark.",
    hint: "Trace Cassiopeia by clicking the right stars",
    set: "constellation",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "the-great-bear",
    title: "The Great Bear",
    description: "Ursa Major drawn in light.",
    hint: "Trace Ursa Major by clicking the right stars",
    set: "constellation",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "the-lyre",
    title: "The Lyre",
    description: "Strings of starlight, plucked.",
    hint: "Trace Lyra by clicking the right stars",
    set: "constellation",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "night-sky-mapped",
    title: "Night Sky Mapped",
    description: "The cosmos shifts into focus.",
    hint: "Activate constellation theme",
    set: "constellation",
    points: EPIC,
    hidden: true,
  },
  {
    id: "celestial-cartographer",
    title: "Celestial Cartographer",
    description: "All four asterisms, traced in one night.",
    hint: "Trace every constellation in one session",
    set: "constellation",
    points: RARE,
    hidden: true,
  },
  {
    id: "dark-skies",
    title: "Dark Skies",
    description: "Every constellation honored.",
    hint: "Unlock all other constellation achievements",
    set: "constellation",
    points: LEGENDARY,
    hidden: true,
    progressKey: "constellation-set",
  },

  // ── Matrix ──
  {
    id: "enter-the-matrix",
    title: "Enter the Matrix",
    description: "You took the red pill.",
    hint: "Activate matrix theme",
    set: "matrix",
    points: EPIC,
    hidden: true,
  },
  {
    id: "back-to-reality",
    title: "Back to Reality",
    description: "The blue pill. The story ends.",
    hint: "Type BLUEPILL to return",
    set: "matrix",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "follow-the-white-rabbit",
    title: "Follow the White Rabbit",
    description: "A message, hidden in the code.",
    hint: "Spot a word resolve in the matrix rain",
    set: "matrix",
    points: RARE,
    hidden: true,
  },
  {
    id: "the-one",
    title: "The One",
    description: "You bent the code to your will.",
    hint: "Unlock all other matrix achievements",
    set: "matrix",
    points: LEGENDARY,
    hidden: true,
    progressKey: "matrix-set",
  },

  // ── Wanted ──
  {
    id: "most-wanted",
    title: "Most Wanted",
    description: "Five stars. The whole city's looking for you.",
    hint: "Activate wanted theme",
    set: "wanted",
    points: EPIC,
    hidden: true,
  },
  {
    id: "high-roller",
    title: "High Roller",
    description: "Crime pays, apparently.",
    hint: "Bank a big score in wanted theme",
    set: "wanted",
    points: RARE,
    hidden: true,
  },
  {
    id: "cheat-the-system",
    title: "Cheat the System",
    description: "Why play fair?",
    hint: "Enter a cheat code in wanted theme",
    set: "wanted",
    points: UNCOMMON,
    hidden: true,
    requires: "keyboard",
  },
  {
    id: "cheat-sheet",
    title: "Cheat Sheet",
    description: "Every code, memorized.",
    hint: "Enter every wanted cheat code",
    set: "wanted",
    points: RARE,
    hidden: true,
    requires: "keyboard",
    progressKey: "wanted-cheats-entered",
  },
  {
    id: "lay-low",
    title: "Lay Low",
    description: "Heat's off. For now.",
    hint: "Type TURNDOWNTHEHEAT to cool off",
    set: "wanted",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "kingpin",
    title: "Kingpin",
    description: "You ran the whole town.",
    hint: "Unlock all other wanted achievements",
    set: "wanted",
    points: LEGENDARY,
    hidden: true,
    progressKey: "wanted-set",
  },

  // ── Meta / Milestones ──
  {
    id: "curious-mind",
    title: "Curious Mind",
    description: "Five discoveries and counting.",
    hint: "Unlock 5 achievements",
    set: "meta",
    points: UNCOMMON,
    hidden: false,
    progressKey: "unlocks-5",
  },
  {
    id: "dedicated",
    title: "Dedicated",
    description: "You're not stopping, are you?",
    hint: "Unlock 15 achievements",
    set: "meta",
    points: RARE,
    hidden: true,
    progressKey: "unlocks-15",
  },
  {
    id: "completionist",
    title: "Completionist",
    description: "The sky holds no more secrets.",
    hint: "Unlock every non-milestone achievement",
    set: "meta",
    points: LEGENDARY,
    hidden: true,
    progressKey: "non-meta-all",
  },
  {
    id: "historian",
    title: "Historian",
    description: "Your path becomes visible.",
    hint: "Discover your first hidden theme",
    set: "meta",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "theme-hopper",
    title: "Theme Hopper",
    description: "A different sky every time.",
    hint: "Activate 3 different themes in one session",
    set: "meta",
    points: EPIC,
    hidden: true,
  },
  {
    id: "storm-forecaster",
    title: "Storm Forecaster",
    description: "Lightning answers in every weather.",
    hint: "Trigger lightning under 3 different themes in one session",
    set: "meta",
    points: RARE,
    hidden: true,
  },
  {
    id: "hundred-club",
    title: "Hundred Club",
    description: "Triple digits.",
    hint: "Reach 100 total points",
    set: "meta",
    points: UNCOMMON,
    hidden: true,
    progressKey: "points-100",
  },
  {
    id: "five-hundred",
    title: "Five Hundred",
    description: "Halfway to mastery.",
    hint: "Reach 500 total points",
    set: "meta",
    points: RARE,
    hidden: true,
    progressKey: "points-500",
  },
  {
    id: "thousand-club",
    title: "Thousand Club",
    description: "Four digits.",
    hint: "Reach 1,000 total points",
    set: "meta",
    points: EPIC,
    hidden: true,
    progressKey: "points-1000",
  },
  {
    id: "tenacious",
    title: "Tenacious",
    description: "Seven days, still drawn to the sky.",
    hint: "Visit the site on 7 different days",
    set: "almanac",
    points: EPIC,
    hidden: true,
    progressKey: "days-7",
  },
  {
    id: "halfway-there",
    title: "Halfway There",
    description: "Half the sky explored.",
    hint: "Unlock half of all non-milestone achievements",
    set: "meta",
    points: RARE,
    hidden: true,
    progressKey: "non-meta-half",
  },
  // Milestones on purpose: any-percent requires every non-milestone
  // unlock, so placing these outside the meta set would deadlock the
  // completionist check against itself.
  {
    id: "on-the-clock",
    title: "On the Clock",
    description: "The run is live.",
    hint: "Spell SPEEDRUN and start a run from zero",
    set: "meta",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "any-percent",
    title: "Any%",
    description: "Every secret, against the clock.",
    hint: "Rediscover every secret before the clock stops",
    set: "meta",
    points: EPIC,
    hidden: true,
  },
  {
    id: "cheat-code",
    title: "Cheat Code",
    description: "Up, up, down, down...",
    hint: "Try a classic.",
    set: "mastery",
    points: EPIC,
    hidden: true,
    requires: "keyboard",
  },
  {
    id: "regular",
    title: "Regular",
    description: "Seven days running.",
    hint: "Visit on seven consecutive days",
    set: "almanac",
    points: RARE,
    hidden: true,
  },
  {
    id: "persistent",
    title: "Persistent",
    description: "A thousand clicks deep.",
    hint: "Click 1,000 times",
    set: "mastery",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "devoted",
    title: "Devoted",
    description: "Ten thousand clicks. Truly.",
    hint: "Click 10,000 times",
    set: "mastery",
    points: EPIC,
    hidden: true,
  },
  {
    id: "wish-granted",
    title: "Wish Granted",
    description: "Caught a falling star.",
    hint: "Click a shooting star as it crosses the sky",
    set: "exploration",
    points: RARE,
    hidden: true,
  },
  {
    id: "open-secrets",
    title: "Open Secrets",
    description: "Found the panel that lists every secret.",
    hint: "Spell out a word for the curious",
    set: "incantations",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "sound-on",
    title: "Sound On",
    description: "Gave the sky a voice.",
    hint: "Turn on the sound",
    set: "exploration",
    points: COMMON,
    hidden: true,
  },
  {
    id: "perfect-pitch",
    title: "Perfect Pitch",
    description: "Heard every world's voice.",
    hint: "Enter every theme with the sound on",
    set: "exploration",
    points: RARE,
    hidden: true,
    progressKey: "themes-heard",
  },
  // ── Mastery: Alchemy ──
  {
    id: "alchemist",
    title: "Alchemist",
    description: "Two skies fused into something new.",
    hint: "Stack the right pair of themes at once",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "grand-alchemist",
    title: "Grand Alchemist",
    description: "Every hybrid sky, transmuted.",
    hint: "Discover every theme combination",
    set: "mastery",
    points: EPIC,
    hidden: true,
    progressKey: "combos-discovered",
  },
  // ── Terminal: Passport ──
  {
    id: "passport-issued",
    title: "Passport Issued",
    description: "Progress, packed for travel.",
    hint: "Ask the terminal for a passport",
    set: "terminal",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "passport-stamped",
    title: "Passport Stamped",
    description: "The same sky, a different machine.",
    hint: "Import a passport from another device",
    set: "terminal",
    points: RARE,
    hidden: true,
  },
  // ── Exploration: Daily Sky ──
  {
    id: "in-season",
    title: "In Season",
    description: "Today's word, spoken today.",
    hint: "Cast the word of the day — the terminal knows it",
    set: "terminal",
    points: RARE,
    hidden: true,
  },
  {
    id: "time-traveler",
    title: "Time Traveler",
    description: "You stood under a sky that already set.",
    hint: "Open a shared sky link from another day",
    set: "exploration",
    points: RARE,
    hidden: true,
  },
  // ── Exploration: Photo Mode ──
  {
    id: "sky-photographer",
    title: "Sky Photographer",
    description: "The page stepped aside for the sky.",
    hint: "Spell PHOTO",
    set: "exploration",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "wallpaper-material",
    title: "Wallpaper Material",
    description: "This sky hangs on a screen somewhere now.",
    hint: "Save a sky portrait from photo mode",
    set: "exploration",
    points: RARE,
    hidden: true,
  },
  // ── Exploration: Real Sky ──
  {
    id: "moonstruck",
    title: "Moonstruck",
    description: "You came on a full-moon night.",
    hint: "Visit during a full moon",
    set: "almanac",
    points: RARE,
    hidden: true,
  },
  {
    id: "star-shower",
    title: "Star Shower",
    description: "You came while the sky was falling.",
    hint: "Visit near a real meteor shower's peak night",
    set: "almanac",
    points: RARE,
    hidden: true,
  },
  {
    id: "sun-stands-still",
    title: "Sun Stands Still",
    description: "The longest light, or the deepest dark.",
    hint: "Visit on a solstice",
    set: "almanac",
    points: RARE,
    hidden: true,
  },
  {
    id: "equal-night",
    title: "Equal Night",
    description: "Day and night in perfect balance.",
    hint: "Visit on an equinox",
    set: "almanac",
    points: RARE,
    hidden: true,
  },
  {
    id: "rain-check",
    title: "Rain Check",
    description: "It was really raining over me.",
    hint: "Check on the systems while rain falls on your location",
    set: "almanac",
    points: RARE,
    hidden: true,
  },
  // ── Terminal ──
  {
    id: "shell-access",
    title: "Shell Access",
    description: "The sky has a command line.",
    hint: "Spell SHELL — or find the key that drops consoles",
    set: "terminal",
    points: EPIC,
    hidden: true,
  },
  {
    id: "not-in-sudoers",
    title: "Not in Sudoers",
    description: "This incident will be reported.",
    hint: "Ask the terminal for more power",
    set: "terminal",
    points: UNCOMMON,
    hidden: true,
  },
  {
    id: "scorched-earth",
    title: "Scorched Earth",
    description: "Force-removed every sky at once.",
    hint: "The most famous command you should never run",
    set: "terminal",
    points: RARE,
    hidden: true,
  },
  {
    id: "cloud-native",
    title: "Cloud Native",
    description: "kubectl speaks; the sky listens.",
    hint: "Orchestrate the themes from the terminal",
    set: "terminal",
    points: UNCOMMON,
    hidden: true,
  },
  // ── Linked Skies ──
  {
    id: "parallel-skies",
    title: "Parallel Skies",
    description: "Two windows, one heaven.",
    hint: "Open the site in a second window, side by side",
    set: "linked-skies",
    points: EPIC,
    hidden: true,
    requires: "multiwindow",
  },
  {
    id: "star-courier",
    title: "Star Courier",
    description: "It left your sky and landed in another.",
    hint: "Watch a shooting star cross between linked windows",
    set: "linked-skies",
    points: RARE,
    hidden: true,
    requires: "multiwindow",
  },
  {
    id: "triptych",
    title: "Triptych",
    description: "Three panes of the same sky.",
    hint: "Link three windows at once",
    set: "linked-skies",
    points: RARE,
    hidden: true,
    requires: "multiwindow",
  },
  {
    id: "fixed-stars",
    title: "Fixed Stars",
    description: "You moved the window; the sky stayed.",
    hint: "While linked, drag a window around and watch the stars hold still",
    set: "linked-skies",
    points: RARE,
    hidden: true,
    requires: "multiwindow",
  },
  {
    id: "ghost-hand",
    title: "Ghost Hand",
    description: "A cursor from the next window reached into yours.",
    hint: "While linked, drag your cursor from one window into another",
    set: "linked-skies",
    points: RARE,
    hidden: true,
    requires: "multiwindow",
  },
  {
    id: "distant-well",
    title: "Distant Gravity",
    description: "A gravity well from the next window bloomed in yours.",
    hint: "While linked, charge a gravity well near the seam and watch the next window",
    set: "linked-skies",
    points: RARE,
    hidden: true,
    requires: "multiwindow",
  },
  {
    id: "triple-stack",
    title: "Triple Stack",
    description: "Three worlds at once.",
    hint: "Have three themes active simultaneously",
    set: "mastery",
    points: RARE,
    hidden: true,
  },
  {
    id: "kitchen-sink",
    title: "Kitchen Sink",
    description: "Every world, all at once.",
    hint: "Have every theme active simultaneously",
    set: "mastery",
    points: LEGENDARY,
    hidden: true,
  },
];

// ── Lookup helpers ──

const _byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id) {
  return _byId.get(id) || null;
}

/**
 * Whether an achievement can be earned on the current device — true unless it
 * requires an input capability this device lacks (a keyboard, a hover cursor).
 * Completion math and the panel listing both filter through this so a
 * touch-only device isn't blocked from 100% by keyboard/hover-only entries.
 */
export function isReachable(achievement) {
  return !achievement.requires || hasCapability(achievement.requires);
}

/**
 * All achievements earnable on the current device.
 */
export function getReachableAchievements() {
  return ACHIEVEMENTS.filter(isReachable);
}

/**
 * Sum point values for a list of unlocked entries [{id, ts}, ...].
 */
export function sumPoints(unlockedList) {
  let pts = 0;
  for (const u of unlockedList) {
    const a = _byId.get(u.id);
    if (a) pts += a.points;
  }
  return pts;
}

// Theme set IDs for "unlock all in set" meta-achievements
export const THEME_SETS = [
  "deep-sea",
  "frozen",
  "blocky",
  "rainy",
  "paper",
  "vhs",
  "upside-down",
  "constellation",
  "matrix",
  "wanted",
];

// Map from theme set id to its "unlock all" achievement id
export const SET_MASTERY_MAP = {
  "deep-sea": "abyssal-explorer",
  frozen: "glacial-mastery",
  blocky: "voxel-master",
  rainy: "storm-chaser",
  paper: "sketchbook-full",
  vhs: "analog-mastery",
  "upside-down": "world-turner",
  constellation: "dark-skies",
  matrix: "the-one",
  wanted: "kingpin",
};

/**
 * Get all non-mastery achievements for a theme set.
 * Used to check if all prerequisite achievements are unlocked.
 */
export function getSetPrereqs(setId) {
  const masteryId = SET_MASTERY_MAP[setId];
  return ACHIEVEMENTS.filter(
    (a) => a.set === setId && a.id !== masteryId && isReachable(a),
  ).map((a) => a.id);
}

/**
 * Get all non-meta achievement IDs (for completionist check). Excludes entries
 * unreachable on this device so set-mastery and completionist stay earnable.
 */
export function getAllNonMeta() {
  return ACHIEVEMENTS.filter((a) => a.set !== "meta" && isReachable(a)).map(
    (a) => a.id,
  );
}

/**
 * Check if a set is a theme set (has theme-specific achievements).
 */
export function isThemeSet(setId) {
  return THEME_SETS.includes(setId);
}

/**
 * Return all achievements that track progressive (cumulative) progress.
 */
export function getProgressiveAchievements() {
  return ACHIEVEMENTS.filter((a) => a.progressKey);
}
