import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// CTA-bridge test.  Focus areas:
//   - each conversion selector resolves to its stable cta_id
//   - cta_click carries scroll depth + session elapsed + prior-click count
//   - outbound_link fires with href_type and domain classification
//   - internal nav clicks don't duplicate into outbound_link

describe("analytics/bridges/cta", () => {
  let core;
  let bridge;
  let session;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../js/analytics/core.js");
    session = await import("../../js/analytics/bridges/session.js");
    bridge = await import("../../js/analytics/bridges/cta.js");
    core.start({
      adapter: { name: "capture", send: (batch) => captured.push(...batch) },
    });
    session.sessionCounters.scrollMaxDepth = 0;
    session.sessionCounters.clickTotalCta = 0;
    bridge.initCtaBridge();
  }

  function clickSelector(sel) {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`missing selector ${sel}`);
    el.click();
  }

  function eventsNamed(name) {
    return captured.filter((e) => e.name === name);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));

    document.body.innerHTML = `
      <nav>
        <a class="nav-logo" href="#">Cloudbreeze</a>
        <a class="nav-cta" href="#contact">Get in touch</a>
      </nav>
      <section class="hero">
        <a class="btn-primary" href="#contact">Start a project</a>
        <a class="btn-ghost" href="#services">Explore our services</a>
      </section>
      <section id="contact">
        <a class="contact-link" href="mailto:hello@cloudbreeze.hr">Email</a>
        <a class="contact-link"
           href="https://www.linkedin.com/company/cloudbreeze">LinkedIn</a>
      </section>
      <footer>
        <a class="footer-link" href="mailto:hello@cloudbreeze.hr">Email</a>
        <a class="footer-link"
           href="https://www.linkedin.com/company/cloudbreeze">LinkedIn</a>
        <a href="https://example.com">External partner</a>
      </footer>
    `;
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  describe("cta_click", () => {
    const cases = [
      { sel: ".hero .btn-primary", id: "hero_primary_contact" },
      { sel: ".hero .btn-ghost", id: "hero_ghost_services" },
      { sel: "nav .nav-cta", id: "nav_cta" },
      { sel: "nav .nav-logo", id: "nav_logo" },
      {
        sel: "#contact a.contact-link[href^='mailto:']",
        id: "contact_email",
      },
      {
        sel: "#contact a.contact-link[href*='linkedin']",
        id: "contact_linkedin",
      },
      {
        sel: "footer a.footer-link[href^='mailto:']",
        id: "footer_email",
      },
      {
        sel: "footer a.footer-link[href*='linkedin']",
        id: "footer_linkedin",
      },
    ];

    for (const { sel, id } of cases) {
      it(`resolves ${sel} to cta_id "${id}"`, () => {
        clickSelector(sel);
        core.flush();
        const clicks = eventsNamed("cta_click");
        expect(clicks.length).toBeGreaterThanOrEqual(1);
        expect(clicks[0].props.cta_id).toEqual(id);
      });
    }

    it("records scroll depth, session elapsed, and prior-click count", () => {
      session.sessionCounters.scrollMaxDepth = 55;
      vi.advanceTimersByTime(3_500);
      clickSelector(".hero .btn-primary");
      vi.advanceTimersByTime(1_000);
      clickSelector("nav .nav-cta");
      core.flush();

      const [first, second] = eventsNamed("cta_click");
      expect(first.props.scroll_depth_at_click).toEqual(55);
      expect(first.props.session_elapsed_ms).toBeGreaterThanOrEqual(3_500);
      expect(first.props.clicks_before_this).toEqual(0);
      expect(second.props.clicks_before_this).toEqual(1);
    });

    it("bumps sessionCounters.clickTotalCta", () => {
      clickSelector(".hero .btn-primary");
      clickSelector("nav .nav-cta");
      expect(session.sessionCounters.clickTotalCta).toEqual(2);
    });
  });

  describe("outbound_link", () => {
    it("fires for mailto with the mailbox domain", () => {
      clickSelector("#contact a.contact-link[href^='mailto:']");
      core.flush();
      const out = eventsNamed("outbound_link")[0];
      expect(out.props.href_type).toEqual("mailto");
      expect(out.props.domain).toEqual("cloudbreeze.hr");
    });

    it("fires for linkedin with the linkedin.com domain", () => {
      clickSelector("footer a.footer-link[href*='linkedin']");
      core.flush();
      const out = eventsNamed("outbound_link")[0];
      expect(out.props.href_type).toEqual("linkedin");
      expect(out.props.domain).toEqual("www.linkedin.com");
    });

    it("fires for arbitrary external links not covered by the CTA list", () => {
      clickSelector("footer a[href='https://example.com']");
      core.flush();
      const outs = eventsNamed("outbound_link");
      expect(outs.length).toEqual(1);
      expect(outs[0].props.href_type).toEqual("external");
      expect(outs[0].props.domain).toEqual("example.com");
    });

    it("does not fire for internal hash anchors in nav", () => {
      clickSelector("nav .nav-cta");
      core.flush();
      // cta_click should fire, outbound_link should not.
      expect(eventsNamed("cta_click").length).toEqual(1);
      expect(eventsNamed("outbound_link").length).toEqual(0);
    });
  });
});
