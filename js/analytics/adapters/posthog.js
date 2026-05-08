// ── PostHog Adapter ──
// Cookieless, anonymous POSTs to PostHog's EU batch endpoint.  No SDK —
// we hand-roll the minimal payload shape so the site doesn't load an extra
// 40 KB of script for a capability we already have.
//
// Privacy posture:
//   - distinct_id is our own visitor_id (opaque UUIDv4, no identifier
//     reuse across sites, never leaves localStorage except as an event
//     property).  PostHog sees it as a pseudonym.
//   - $process_person_profile is false on every event, so PostHog does
//     not build a person profile or stitch identity across events.
//   - $ip is set to null as an explicit signal; the project is
//     additionally configured to anonymize IPs server-side.
//
// Transport:
//   - fetch with keepalive:true so the pagehide-triggered flush actually
//     leaves the browser.  Modern replacement for sendBeacon that
//     preserves response access (we don't read it, but it's consistent
//     with other adapters).
//   - POSTs to https://eu.i.posthog.com/batch/ which accepts an array
//     of event envelopes.  No Authorization header — the api_key goes
//     in the body, which is how PostHog's ingest endpoint is
//     authenticated for write-only traffic.

const BATCH_ENDPOINT = "https://eu.i.posthog.com/batch/";

export function createPostHogAdapter({ apiKey } = {}) {
  return {
    name: "posthog",
    init() {
      if (!apiKey || apiKey.startsWith("REPLACE_")) {
        console.warn(
          "[analytics] PostHog adapter started without an API key — " +
            "events will not be sent.",
        );
      }
    },
    send(events) {
      if (!events || !events.length) return;
      if (!apiKey || apiKey.startsWith("REPLACE_")) return;

      const batch = events.map(({ name, props }) => ({
        event: name,
        distinct_id: props.visitor_id || "anon",
        timestamp: props.ts,
        properties: {
          ...props,
          // Tell PostHog not to build a person profile or otherwise
          // treat these events as identity-linked.  We want pseudonymous
          // event counts, nothing more.
          $process_person_profile: false,
          // Belt-and-suspenders alongside the project's anonymize-IPs
          // setting.  Tells PostHog not to infer an IP geohash.
          $ip: null,
        },
      }));

      const body = JSON.stringify({
        api_key: apiKey,
        batch,
      });

      try {
        fetch(BATCH_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
          // No credentials — we don't want cookies sent cross-origin.
          credentials: "omit",
          // Fire and forget.  Swallow any rejection so a network error
          // can't crash the page.
        }).catch(() => {});
      } catch {
        // Synchronous throws (e.g. a payload > 64 KB with keepalive)
        // are also non-fatal for the page.
      }
    },
    flush() {},
  };
}
