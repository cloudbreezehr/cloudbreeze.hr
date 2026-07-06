import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  getParam,
  hasFlag,
  getList,
  buildUrl,
  onUrlChange,
} from "../../js/url-params.js";

// Reads are stateless — they parse location.hash / location.search on each
// call — so tests just set the URL and query by name.  The catalog wires:
//   sky/dev              → hash        theme/finale/achievement → query
//   cloudlog-activity, cloudlog-achievements → hash (bare-token flags)

describe("url-params", () => {
  beforeEach(() => {
    location.hash = "";
    location.search = "";
  });

  afterEach(() => {
    location.hash = "";
    location.search = "";
  });

  describe("getParam — value from hash", () => {
    it("decodes a key=value fragment", () => {
      location.hash = "#sky=2025-12-24";
      expect(getParam("sky")).toBe("2025-12-24");
    });

    it("percent-decodes the value", () => {
      location.hash = "#sky=" + encodeURIComponent("a b/c");
      expect(getParam("sky")).toBe("a b/c");
    });

    it("finds the key among &-separated fragment segments", () => {
      location.hash = "#other=1&sky=2025-01-01";
      expect(getParam("sky")).toBe("2025-01-01");
    });

    it("returns null when absent", () => {
      location.hash = "#nothing";
      expect(getParam("sky")).toBeNull();
    });

    it("returns null for a bare key with no value", () => {
      location.hash = "#sky";
      expect(getParam("sky")).toBeNull();
    });

    it("survives a malformed escape without throwing", () => {
      location.hash = "#sky=%E0%A4%A";
      expect(() => getParam("sky")).not.toThrow();
    });
  });

  describe("getParam — sky resolves from either query or hash", () => {
    it("reads sky from the query string", () => {
      location.search = "?sky=2025-06-01";
      expect(getParam("sky")).toBe("2025-06-01");
    });

    it("reads sky from the hash fragment", () => {
      location.hash = "#sky=2025-06-02";
      expect(getParam("sky")).toBe("2025-06-02");
    });

    it("prefers the query over the hash when both carry sky", () => {
      location.search = "?sky=from-query";
      location.hash = "#sky=from-hash";
      expect(getParam("sky")).toBe("from-query");
    });

    it("falls back to the hash when the query is empty", () => {
      location.search = "?sky=";
      location.hash = "#sky=from-hash";
      expect(getParam("sky")).toBe("from-hash");
    });
  });

  describe("getParam — value from query", () => {
    it("reads and decodes a query param", () => {
      location.search = "?achievement=first%20light";
      expect(getParam("achievement")).toBe("first light");
    });

    it("returns null when absent", () => {
      location.search = "?other=1";
      expect(getParam("achievement")).toBeNull();
    });

    it("returns null for a present-but-empty value", () => {
      location.search = "?achievement=";
      expect(getParam("achievement")).toBeNull();
    });
  });

  describe("hasFlag", () => {
    it("is true for a bare hash token", () => {
      location.hash = "#dev";
      expect(hasFlag("dev")).toBe(true);
    });

    it("is false when the fragment is something else", () => {
      location.hash = "#sky=2025-01-01";
      expect(hasFlag("dev")).toBe(false);
    });

    it("distinguishes similar tokens", () => {
      location.hash = "#devil";
      expect(hasFlag("dev")).toBe(false);
    });

    it("is true for a valueless query flag", () => {
      location.search = "?finale";
      expect(hasFlag("finale")).toBe(true);
    });

    it("routes cloudlog deep-links by their own token", () => {
      location.hash = "#cloudlog-activity";
      expect(hasFlag("cloudlog-activity")).toBe(true);
      expect(hasFlag("cloudlog-achievements")).toBe(false);
    });
  });

  describe("getList", () => {
    it("splits a comma-separated value", () => {
      location.search = "?theme=frozen,blocky";
      expect(getList("theme")).toEqual(["frozen", "blocky"]);
    });

    it("gathers repeated keys", () => {
      location.search = "?theme=frozen&theme=blocky";
      expect(getList("theme")).toEqual(["frozen", "blocky"]);
    });

    it("reads a mix of repeated keys and comma lists", () => {
      location.search = "?theme=frozen,blocky&theme=vhs";
      expect(getList("theme")).toEqual(["frozen", "blocky", "vhs"]);
    });

    it("trims whitespace and drops empty entries", () => {
      location.search = "?theme=frozen, ,blocky,";
      expect(getList("theme")).toEqual(["frozen", "blocky"]);
    });

    it("de-dupes while preserving first-seen order", () => {
      location.search = "?theme=frozen,blocky,frozen";
      expect(getList("theme")).toEqual(["frozen", "blocky"]);
    });

    it("is empty when absent", () => {
      location.search = "?other=1";
      expect(getList("theme")).toEqual([]);
    });
  });

  describe("kind guard", () => {
    it("rejects reading a list through getParam", () => {
      expect(() => getParam("theme")).toThrow(/list/);
    });

    it("rejects reading a value through getList", () => {
      expect(() => getList("sky")).toThrow(/value/);
    });

    it("rejects an unknown parameter", () => {
      expect(() => hasFlag("nope")).toThrow(/unknown/);
    });
  });

  describe("buildUrl", () => {
    it("emits a hash-target param into the fragment", () => {
      const url = buildUrl(
        { sky: "2025-12-24" },
        { base: "https://cloudbreeze.hr/" },
      );
      expect(url).toBe("https://cloudbreeze.hr/#sky=2025-12-24");
    });

    it("percent-encodes the value", () => {
      const url = buildUrl({ sky: "a b" }, { base: "https://x/" });
      expect(url).toBe("https://x/#sky=a%20b");
    });

    it("emits a query-target param into the query string", () => {
      const url = buildUrl({ theme: "frozen" }, { base: "https://x/" });
      expect(url).toBe("https://x/?theme=frozen");
    });

    it("defaults the base to origin + pathname", () => {
      const url = buildUrl({ sky: "2025-01-01" });
      expect(url).toBe(location.origin + location.pathname + "#sky=2025-01-01");
    });
  });

  describe("onUrlChange", () => {
    it("fires subscribers on hashchange and stops after unsubscribe", () => {
      let count = 0;
      const off = onUrlChange(() => count++);
      window.dispatchEvent(new Event("hashchange"));
      expect(count).toBe(1);
      off();
      window.dispatchEvent(new Event("hashchange"));
      expect(count).toBe(1);
    });
  });
});
