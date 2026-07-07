// ── Blob Download ──
// Trigger a browser "Save as…" for an in-memory Blob under a chosen filename,
// via a transient anchor. Centralizes two footguns:
//
//   • The object URL is revoked on a later task, not synchronously after the
//     click. Some engines service the download by reading the blob
//     asynchronously, and revoking in the same tick can cancel the save.
//   • The anchor is attached to the document for the click, then removed —
//     a click on a detached anchor is a no-op in some engines.

// Long enough that the browser's async blob read is under way before the URL
// is invalidated; the exact span isn't load-bearing, only that it outlasts
// the read.
const REVOKE_DELAY_MS = 1000;

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
