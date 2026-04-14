// ── Dev Console Registry ──
// Central registry for all tweakable constants. Each module registers its
// constants via defineConstants(), which returns a mutable object the render
// loop reads from. The dev console iterates the registry to build UI controls.

const _sections = new Map(); // category -> Map<key, { ref, default, min, max, step, label, description }>
const _sectionMeta = new Map(); // category -> { mode?: string }

// ── Smart defaults ──
// When metadata omits min/max/step, infer sensible defaults from the value.

function inferMeta(key, value) {
  const isInt = Number.isInteger(value);
  const abs = Math.abs(value);
  let min, max, step;

  if (abs === 0) {
    min = -10;
    max = 10;
    step = isInt ? 1 : 0.01;
  } else if (abs <= 1) {
    min = isInt ? -1 : -1;
    max = isInt ? 10 : 2;
    step = isInt ? 1 : 0.001;
  } else if (abs <= 10) {
    min = isInt ? 0 : 0;
    max = isInt ? Math.ceil(abs * 5) : abs * 5;
    step = isInt ? 1 : 0.01;
  } else if (abs <= 100) {
    min = isInt ? 0 : 0;
    max = isInt ? Math.ceil(abs * 3) : abs * 3;
    step = isInt ? 1 : 0.1;
  } else {
    min = 0;
    max = Math.ceil(abs * 3);
    step = isInt ? 1 : 1;
  }

  // Never let min exceed default or max go below default
  if (value < min) min = isInt ? Math.floor(value * 2) : value * 2;
  if (value > max) max = isInt ? Math.ceil(value * 2) : value * 2;

  return { min, max, step };
}

function formatLabel(key) {
  // RADIUS_MIN -> Radius Min
  return key
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// ── Public API ──

/**
 * Register a group of constants under a dotted category path.
 * Returns a mutable plain object — the render loop reads properties directly.
 *
 * Usage:
 *   const STARS = defineConstants('sky.stars', {
 *     RADIUS_MIN: { value: 0.3, min: 0, max: 5, step: 0.1, label: 'Radius Min', description: '...' },
 *     RADIUS_RANGE: 0.7,  // shorthand — metadata inferred
 *   });
 *   // Read in render loop: STARS.RADIUS_MIN
 *
 * The dev console mutates the returned object to change values live.
 *
 * Optional third argument: section-level options.
 *   { mode: "frozen" }  — tags this section as belonging to that sub-mode.
 *   The dev console uses this to dim/highlight sections based on active modes.
 */
export function defineConstants(category, defs, sectionOpts) {
  const obj = {};
  const entries = new Map();

  for (const [key, raw] of Object.entries(defs)) {
    const hasMeta = raw !== null && typeof raw === "object" && "value" in raw;
    const value = hasMeta ? raw.value : raw;
    obj[key] = value;

    const inferred = typeof value === "number" ? inferMeta(key, value) : {};
    entries.set(key, {
      ref: obj,
      key,
      default: value,
      type: typeof value,
      min: hasMeta && raw.min !== undefined ? raw.min : (inferred.min ?? 0),
      max: hasMeta && raw.max !== undefined ? raw.max : (inferred.max ?? 100),
      step: hasMeta && raw.step !== undefined ? raw.step : (inferred.step ?? 1),
      label: (hasMeta && raw.label) || formatLabel(key),
      description: (hasMeta && raw.description) || "",
    });
  }

  _sections.set(category, entries);
  if (sectionOpts) _sectionMeta.set(category, sectionOpts);
  return obj;
}

/**
 * Get the full registry: Map<category, Map<key, metadata>>.
 */
export function getRegistry() {
  return _sections;
}

/**
 * Get section-level metadata (e.g. mode tag).
 */
export function getSectionMeta(category) {
  return _sectionMeta.get(category) || null;
}

/**
 * Reset a single value to its default.
 */
export function resetValue(category, key) {
  const section = _sections.get(category);
  if (!section) return;
  const entry = section.get(key);
  if (!entry) return;
  entry.ref[key] = entry.default;
}

/**
 * Reset all values in a section to defaults.
 */
export function resetSection(category) {
  const section = _sections.get(category);
  if (!section) return;
  for (const [key, entry] of section) {
    entry.ref[key] = entry.default;
  }
}

/**
 * Reset every registered value to its default.
 */
export function resetAll() {
  for (const [, section] of _sections) {
    for (const [key, entry] of section) {
      entry.ref[key] = entry.default;
    }
  }
}

/**
 * Export current config as a JSON-serializable object.
 * Only includes values that differ from defaults.
 */
export function exportConfig() {
  const config = {};
  for (const [category, section] of _sections) {
    for (const [key, entry] of section) {
      const current = entry.ref[key];
      if (current !== entry.default) {
        if (!config[category]) config[category] = {};
        config[category][key] = current;
      }
    }
  }
  return config;
}

/**
 * Import a config object, applying overrides to matching entries.
 */
export function importConfig(config) {
  for (const [category, values] of Object.entries(config)) {
    const section = _sections.get(category);
    if (!section) continue;
    for (const [key, value] of Object.entries(values)) {
      const entry = section.get(key);
      if (entry && typeof value === typeof entry.default) {
        entry.ref[key] = value;
      }
    }
  }
}
