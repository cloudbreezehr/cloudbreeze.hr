// ── Web Storage shim for the test environment ──
// Node ≥25 defines global `localStorage`/`sessionStorage` accessors that
// yield undefined unless the process gets a --localstorage-file, and
// happy-dom defers to those existing globals instead of installing its own
// Storage. Tests need a plain, isolated, in-memory Storage per environment;
// install one wherever the global is absent or inert. No-op on runtimes
// where a real Storage already works.

function createMemoryStorage() {
  const items = new Map();
  return {
    getItem(key) {
      return items.has(String(key)) ? items.get(String(key)) : null;
    },
    setItem(key, value) {
      items.set(String(key), String(value));
    },
    removeItem(key) {
      items.delete(String(key));
    },
    clear() {
      items.clear();
    },
    key(index) {
      return [...items.keys()][index] ?? null;
    },
    get length() {
      return items.size;
    },
  };
}

for (const name of ["localStorage", "sessionStorage"]) {
  if (!globalThis[name]) {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, name, {
      value: storage,
      configurable: true,
    });
    if (typeof window !== "undefined" && !window[name]) {
      Object.defineProperty(window, name, {
        value: storage,
        configurable: true,
      });
    }
  }
}
