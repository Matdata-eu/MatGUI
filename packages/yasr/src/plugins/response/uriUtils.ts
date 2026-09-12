/**
 * Standalone helpers for the Response plugin's "Ctrl+Click a URI to DESCRIBE" feature.
 *
 * These functions are intentionally free of any DOM or CodeMirror dependencies so
 * that they can be unit-tested in isolation.
 */

// Matches angle-bracket IRIs as they appear in Turtle / N-Triples / TriG, e.g. `<http://example.org/foo>`
const ANGLE_IRI_RE = /<([^<>\s"{}|\\^`]+)>/g;
// Matches bare or quoted URIs as they appear in JSON / XML / CSV responses, e.g. `"http://example.org/foo"`
const BARE_URI_RE = /(?:https?|urn|ftp|mailto):[^\s<>"'`{}|\\^[\]]+/g;

/**
 * Remove trailing punctuation that is commonly adjacent to a URI in a serialized
 * response (e.g. the `.` terminating a Turtle statement) but is not part of the URI.
 */
function sanitizeUri(uri: string): string {
  return uri.replace(/[.,;)\]]+$/, "").trim();
}

/**
 * Find the URI located at the given character offset within a serialized SPARQL response.
 *
 * Angle-bracket IRIs (Turtle/N-Triples style) take precedence over bare URIs so that a
 * click inside `<http://…>` returns the full IRI rather than the embedded `http://…` run.
 *
 * @param text   The full response text as shown in the response view.
 * @param offset The character offset (0-based) of the click within `text`.
 * @returns The URI at that offset, or `undefined` when the offset is not on a URI.
 */
export function extractUriAtOffset(text: string, offset: number): string | undefined {
  if (!text || offset < 0 || offset >= text.length) return undefined;

  let match: RegExpExecArray | null;

  ANGLE_IRI_RE.lastIndex = 0;
  while ((match = ANGLE_IRI_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const uri = sanitizeUri(match[1]);
      return uri.length > 0 ? uri : undefined;
    }
  }

  BARE_URI_RE.lastIndex = 0;
  while ((match = BARE_URI_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const uri = sanitizeUri(match[0]);
      return uri.length > 0 ? uri : undefined;
    }
  }

  return undefined;
}

/**
 * Build a `CONSTRUCT` query for the given URI.
 *
 * @param uri The URI to describe.
 * @returns A SPARQL `CONSTRUCT` query string with the uri as the subject.
 */
export function buildDescribeQuery(uri: string): string {
  return `CONSTRUCT { <${uri}> ?p ?o } WHERE { <${uri}> ?p ?o }`;
}
