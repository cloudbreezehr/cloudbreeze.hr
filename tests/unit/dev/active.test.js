import { describe, it, expect, afterEach } from "vitest";
import { isDevActive } from "../../../js/dev/active.js";

describe("dev/active", () => {
  afterEach(() => {
    document.body.className = "";
  });

  it("is false by default", () => {
    expect(isDevActive()).toBe(false);
  });

  it("reflects the dev-active body class", () => {
    document.body.classList.add("dev-active");
    expect(isDevActive()).toBe(true);
    document.body.classList.remove("dev-active");
    expect(isDevActive()).toBe(false);
  });
});
