import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initPwa } from "../../js/pwa.js";

describe("pwa", () => {
  afterEach(() => {
    delete navigator.serviceWorker;
  });

  function stubServiceWorker() {
    const register = vi.fn(() => Promise.resolve({}));
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    return register;
  }

  it("registers the service worker when supported", () => {
    const register = stubServiceWorker();
    initPwa();
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("is a safe no-op without service-worker support", () => {
    expect(() => initPwa()).not.toThrow();
  });

  it("swallows registration failures", async () => {
    const register = vi.fn(() => Promise.reject(new Error("nope")));
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
    initPwa();
    // The rejection is caught inside initPwa — flushing microtasks must
    // not surface an unhandled rejection.
    await Promise.resolve();
    expect(register).toHaveBeenCalled();
  });

  it("reports an app install to the achievement stream", () => {
    stubServiceWorker();
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));
    initPwa();
    window.dispatchEvent(new Event("appinstalled"));
    expect(events).toContain("pwa-installed");
  });
});
