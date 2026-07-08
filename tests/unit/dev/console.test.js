import { describe, it, expect, vi } from "vitest";
import {
  wireCollapsibleHeader,
  syncCollapsedAria,
} from "../../../js/dev/console.js";

// A collapsible container mirrors how the console builds sections/groups: the
// header is the first child, optionally holding a nested control, followed by
// a body element.
function makeCollapsible({ collapsed = false, withButton = false } = {}) {
  const el = document.createElement("div");
  if (collapsed) el.classList.add("collapsed");
  const header = document.createElement("div");
  if (withButton) header.appendChild(document.createElement("button"));
  el.appendChild(header);
  el.appendChild(document.createElement("div"));
  return { el, header };
}

describe("syncCollapsedAria", () => {
  it("announces an expanded container as aria-expanded=true", () => {
    const { el, header } = makeCollapsible({ collapsed: false });
    syncCollapsedAria(el);
    expect(header.getAttribute("aria-expanded")).toBe("true");
  });

  it("announces a collapsed container as aria-expanded=false", () => {
    const { el, header } = makeCollapsible({ collapsed: true });
    syncCollapsedAria(el);
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("wireCollapsibleHeader", () => {
  it("makes a childless header a focusable button announcing its state", () => {
    const { el, header } = makeCollapsible({ collapsed: true });
    wireCollapsibleHeader(el, header);
    expect(header.getAttribute("tabindex")).toBe("0");
    expect(header.getAttribute("role")).toBe("button");
    expect(header.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps a header with a nested control out of role=button", () => {
    // Promoting it would nest one interactive control inside another.
    const { el, header } = makeCollapsible({ withButton: true });
    wireCollapsibleHeader(el, header);
    expect(header.getAttribute("tabindex")).toBe("0");
    expect(header.hasAttribute("role")).toBe(false);
  });

  it("toggles via Enter and Space by synthesizing a click", () => {
    const { el, header } = makeCollapsible();
    const onClick = vi.fn();
    header.addEventListener("click", onClick);
    wireCollapsibleHeader(el, header);

    header.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    header.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("prevents the default page scroll on Space", () => {
    const { el, header } = makeCollapsible();
    wireCollapsibleHeader(el, header);
    const ev = new KeyboardEvent("keydown", { key: " ", cancelable: true });
    header.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("ignores keys other than Enter and Space", () => {
    const { el, header } = makeCollapsible();
    const onClick = vi.fn();
    header.addEventListener("click", onClick);
    wireCollapsibleHeader(el, header);
    header.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ignores keys bubbling up from a nested control", () => {
    // Enter/Space on the reset button must not also toggle the section.
    const { el, header } = makeCollapsible({ withButton: true });
    const onClick = vi.fn();
    header.addEventListener("click", onClick);
    wireCollapsibleHeader(el, header);
    header
      .querySelector("button")
      .dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    expect(onClick).not.toHaveBeenCalled();
  });
});
