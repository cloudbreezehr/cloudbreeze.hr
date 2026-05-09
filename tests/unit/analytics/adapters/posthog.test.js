import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// PostHog-adapter test.  Focus areas:
//   - payload shape: event name, distinct_id from visitor_id, timestamp
//     from ts, properties merged with $process_person_profile:false and
//     $ip:null
//   - request: POST to EU batch endpoint, keepalive:true, credentials:omit
//   - missing / placeholder API key is a no-op (no fetch call)
//   - fetch failure never bubbles (analytics must not break the page)
//   - empty batch is a no-op

import { createPostHogAdapter } from "../../../../js/analytics/adapters/posthog.js";

describe("analytics/adapters/posthog", () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeEvent({ name, props } = {}) {
    return {
      name: name || "session_start",
      props: {
        visitor_id: "v-123",
        ts: "2026-05-08T12:00:00.000Z",
        viewport_w: 1280,
        ...(props || {}),
      },
    };
  }

  describe("payload shape", () => {
    it("POSTs an envelope per event with distinct_id from visitor_id", () => {
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      adapter.send([makeEvent()]);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toEqual("https://eu.i.posthog.com/batch/");
      const body = JSON.parse(opts.body);
      expect(body.api_key).toEqual("phc_abc");
      expect(body.batch.length).toEqual(1);
      expect(body.batch[0].event).toEqual("session_start");
      expect(body.batch[0].distinct_id).toEqual("v-123");
      expect(body.batch[0].timestamp).toEqual("2026-05-08T12:00:00.000Z");
    });

    it("merges base props into event properties", () => {
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      adapter.send([
        makeEvent({ props: { viewport_w: 1920, active_mode: "frozen" } }),
      ]);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      const p = body.batch[0].properties;
      expect(p.viewport_w).toEqual(1920);
      expect(p.active_mode).toEqual("frozen");
      expect(p.visitor_id).toEqual("v-123");
    });

    it("sets $process_person_profile:false and $ip:null on every event", () => {
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      adapter.send([makeEvent(), makeEvent({ name: "scroll_depth" })]);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      for (const e of body.batch) {
        expect(e.properties.$process_person_profile).toBe(false);
        expect(e.properties.$ip).toBe(null);
      }
    });

    it("uses 'anon' as distinct_id when visitor_id is missing", () => {
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      adapter.send([{ name: "x", props: { ts: "t" } }]);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.batch[0].distinct_id).toEqual("anon");
    });
  });

  describe("request options", () => {
    it("uses keepalive:true and credentials:omit", () => {
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      adapter.send([makeEvent()]);
      const opts = fetchSpy.mock.calls[0][1];
      expect(opts.method).toEqual("POST");
      expect(opts.keepalive).toBe(true);
      expect(opts.credentials).toEqual("omit");
      expect(opts.headers["Content-Type"]).toEqual("application/json");
    });

    it("batches multiple events into one POST", () => {
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      adapter.send([
        makeEvent(),
        makeEvent({ name: "scroll_depth" }),
        makeEvent({ name: "cta_click" }),
      ]);
      expect(fetchSpy).toHaveBeenCalledOnce();
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.batch.length).toEqual(3);
    });
  });

  describe("error handling", () => {
    it("is a no-op when apiKey is missing", () => {
      const adapter = createPostHogAdapter();
      adapter.send([makeEvent()]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("is a no-op when apiKey is a placeholder", () => {
      const adapter = createPostHogAdapter({
        apiKey: "REPLACE_WITH_POSTHOG_PROJECT_API_KEY",
      });
      adapter.send([makeEvent()]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("is a no-op when given an empty batch", () => {
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      adapter.send([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("does not throw when fetch rejects", async () => {
      fetchSpy.mockRejectedValue(new Error("network down"));
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      expect(() => adapter.send([makeEvent()])).not.toThrow();
      // Allow the microtask queue to drain the rejected promise's catch.
      await Promise.resolve();
    });

    it("does not throw when fetch throws synchronously", () => {
      global.fetch = () => {
        throw new Error("payload too large");
      };
      const adapter = createPostHogAdapter({ apiKey: "phc_abc" });
      expect(() => adapter.send([makeEvent()])).not.toThrow();
    });
  });

  describe("init warning", () => {
    it("warns when started without an API key", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const adapter = createPostHogAdapter();
      adapter.init();
      expect(warn).toHaveBeenCalled();
    });

    it("does not warn when a real-looking key is passed", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const adapter = createPostHogAdapter({ apiKey: "phc_real" });
      adapter.init();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
