import * as chai from "chai";
import { describe, it } from "mocha";

import {
  extractUriAtOffset,
  buildSubjectOfQuery,
  buildObjectOfQuery,
  stripDuplicatePrefixDeclarations,
} from "../../packages/yasr/src/plugins/response/uriUtils.js";

const expect = chai.expect;

describe("Response plugin URI utilities", () => {
  describe("extractUriAtOffset", () => {
    it("extracts an angle-bracket IRI from a Turtle response", () => {
      const text = "<http://example.org/subject> a <http://example.org/Type> .";
      // Offset inside the first IRI
      expect(extractUriAtOffset(text, 10)).to.equal("http://example.org/subject");
      // Offset inside the second IRI
      expect(extractUriAtOffset(text, 40)).to.equal("http://example.org/Type");
    });

    it("returns the full IRI when clicking inside the embedded scheme of an angle-bracket IRI", () => {
      const text = "<http://example.org/foo>";
      // Offset on the "http" part still yields the whole angle-bracket IRI
      expect(extractUriAtOffset(text, 3)).to.equal("http://example.org/foo");
    });

    it("extracts a quoted URI from a JSON response", () => {
      const text = '{ "value": "http://example.org/resource" }';
      const offset = text.indexOf("resource");
      expect(extractUriAtOffset(text, offset)).to.equal("http://example.org/resource");
    });

    it("strips trailing punctuation adjacent to a bare URI", () => {
      const text = "see http://example.org/foo, and more";
      const offset = text.indexOf("foo");
      expect(extractUriAtOffset(text, offset)).to.equal("http://example.org/foo");
    });

    it("supports urn URIs", () => {
      const text = "value urn:isbn:0451450523 end";
      const offset = text.indexOf("isbn");
      expect(extractUriAtOffset(text, offset)).to.equal("urn:isbn:0451450523");
    });

    it("returns undefined when the offset is not on a URI", () => {
      const text = "<http://example.org/subject> a foaf:Person .";
      const offset = text.indexOf("foaf:Person");
      expect(extractUriAtOffset(text, offset)).to.equal(undefined);
    });

    it("returns undefined for empty text or out-of-range offsets", () => {
      expect(extractUriAtOffset("", 0)).to.equal(undefined);
      expect(extractUriAtOffset("<http://example.org/foo>", -1)).to.equal(undefined);
      expect(extractUriAtOffset("<http://example.org/foo>", 999)).to.equal(undefined);
    });
  });

  describe("buildSubjectOfQuery", () => {
    it("wraps the URI in a CONSTRUCT query retrieving triples where the URI is subject", () => {
      expect(buildSubjectOfQuery("http://example.org/foo")).to.equal(
        "CONSTRUCT { <http://example.org/foo> ?p ?o } WHERE { <http://example.org/foo> ?p ?o }",
      );
    });
  });

  describe("buildObjectOfQuery", () => {
    it("wraps the URI in a CONSTRUCT query retrieving triples where the URI is object", () => {
      expect(buildObjectOfQuery("http://example.org/foo")).to.equal(
        "CONSTRUCT { ?s ?p <http://example.org/foo> } WHERE { ?s ?p <http://example.org/foo> } LIMIT 1000",
      );
    });
  });

  describe("stripDuplicatePrefixDeclarations", () => {
    it("removes appended prefixes that already exist in the current view", () => {
      const existing = "@prefix ex: <http://example.org/> .\n<http://a> <http://b> <http://c> .";
      const appended =
        "@prefix ex: <http://example.org/> .\n@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n<http://x> a foaf:Person .";
      expect(stripDuplicatePrefixDeclarations(appended, existing)).to.equal(
        "@prefix foaf: <http://xmlns.com/foaf/0.1/> .\n<http://x> a foaf:Person .",
      );
    });

    it("deduplicates duplicate prefix labels within the appended block", () => {
      const appended =
        "PREFIX ex: <http://example.org/>\nPREFIX EX: <http://example.org/other/>\n<http://x> <http://p> <http://y> .";
      expect(stripDuplicatePrefixDeclarations(appended)).to.equal(
        "PREFIX ex: <http://example.org/>\n<http://x> <http://p> <http://y> .",
      );
    });

    it("keeps non-prefix lines unchanged", () => {
      const appended = "# Triples where <http://example.org/foo> is subject\n<http://s> <http://p> <http://o> .";
      expect(stripDuplicatePrefixDeclarations(appended)).to.equal(appended);
    });
  });
});
