import { describe, it, expect } from "vitest";

describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("exposes a happy-dom window", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
  });
});
