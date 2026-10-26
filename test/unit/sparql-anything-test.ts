import * as chai from "chai";
import { describe, it } from "mocha";

import {
  findSparqlAnythingSources,
  parseServiceIriOptions,
  sparqlAnythingSourceAt,
} from "../../packages/yasqe/src/sparqlAnything.js";
import { previewQuery, SLOT, structureQuery } from "../../packages/yasgui/src/sparqlAnything/probeQueries.js";
import {
  buildStructure,
  rowsFromBindings,
  StructureNode,
  StructureRow,
  termsFromRows,
  walk,
} from "../../packages/yasgui/src/sparqlAnything/structure.js";
import { buildPatterns, buildQuery, writeIri } from "../../packages/yasgui/src/sparqlAnything/queryBuilder.js";

const expect = chai.expect;
const FX = "http://sparql.xyz/facade-x/ns/";
const XYZ = "http://sparql.xyz/facade-x/data/";

function row(partial: Partial<StructureRow> & { step: string }): StructureRow {
  return { kind: "literal", n: 1, subjects: 1, ...partial };
}

function find(tree: StructureNode[], predicate: (node: StructureNode) => boolean): StructureNode {
  let found: StructureNode | undefined;
  walk(tree, (node) => {
    if (!found && predicate(node)) found = node;
  });
  if (!found) throw new Error("node not found");
  return found;
}

const CSV_QUERY = `PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:location=https://example.org/data/people.csv,csv.headers=true> {
    ?row xyz:name ?name .
  }
}`;

// What the structure query returns for a CSV with the columns name and email
const CSV_ROWS: StructureRow[] = [
  row({ type: FX + "root", step: SLOT, kind: "node", n: 3, subjects: 1 }),
  row({ ptype: FX + "root", pstep: SLOT, step: XYZ + "name", n: 3, subjects: 3, example: "Laura" }),
  row({ ptype: FX + "root", pstep: SLOT, step: XYZ + "email", n: 2, subjects: 2, example: "laura@example.org" }),
];

// {"books": [{"title": "Dune", "author": {"name": "Frank Herbert"}}]}
const JSON_ROWS: StructureRow[] = [
  row({ type: FX + "root", step: XYZ + "books", kind: "node" }),
  row({ ptype: FX + "root", pstep: XYZ + "books", step: SLOT, kind: "node", n: 2 }),
  row({ gstep: XYZ + "books", pstep: SLOT, step: XYZ + "title", n: 2, subjects: 2, example: "Dune" }),
  row({ gstep: XYZ + "books", pstep: SLOT, step: XYZ + "author", kind: "node", n: 2, subjects: 2 }),
  row({ gstep: SLOT, pstep: XYZ + "author", step: XYZ + "name", n: 2, subjects: 2, example: "Frank Herbert" }),
];

// <library><book id="1"><title>Dune</title></book></library>
const XML_ROWS: StructureRow[] = [
  row({ type: FX + "root", step: SLOT, kind: "node" }),
  row({ ptype: FX + "root", pstep: SLOT, type: XYZ + "library", step: SLOT, kind: "node", n: 2 }),
  row({ gstep: SLOT, ptype: XYZ + "library", pstep: SLOT, type: XYZ + "book", step: XYZ + "id", n: 2, subjects: 2 }),
  row({
    gstep: SLOT,
    ptype: XYZ + "library",
    pstep: SLOT,
    type: XYZ + "book",
    step: SLOT,
    kind: "node",
    n: 2,
    subjects: 2,
  }),
  row({
    gstep: SLOT,
    ptype: XYZ + "book",
    pstep: SLOT,
    type: XYZ + "title",
    step: SLOT,
    n: 2,
    subjects: 2,
    example: "Dune",
  }),
];

describe("SPARQL Anything", () => {
  describe("finding sources", () => {
    it("reads the options of the service IRI", () => {
      expect(parseServiceIriOptions("x-sparql-anything:location=a.csv,csv.headers=true")).to.deep.equal({
        location: "a.csv",
        "csv.headers": "true",
      });
      expect(parseServiceIriOptions("x-sparql-anything:data/a.json")).to.deep.equal({ location: "data/a.json" });
      expect(parseServiceIriOptions("x-sparql-anything:location=a.csv,csv.delimiter=%09")).to.deep.equal({
        location: "a.csv",
        "csv.delimiter": "\t",
      });
      expect(parseServiceIriOptions("x-sparql-anything:content=a\\,b,media-type=text/csv")).to.deep.equal({
        content: "a,b",
        "media-type": "text/csv",
      });
    });

    it("finds a closed block with its location, label and format", () => {
      const [source] = findSparqlAnythingSources(CSV_QUERY);
      expect(source.ready).to.equal(true);
      expect(source.closed).to.equal(true);
      expect(source.label).to.equal("people.csv");
      expect(source.format).to.equal("csv");
      expect(source.namespace).to.equal(XYZ);
      expect(CSV_QUERY.substring(source.openBrace, source.openBrace + 1)).to.equal("{");
      expect(CSV_QUERY.substring(source.closeBrace!, source.to)).to.equal("}");
    });

    it("reads options written as fx:properties triples, which override the IRI", () => {
      const query = `PREFIX fx: <http://sparql.xyz/facade-x/ns/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:csv.headers=false> {
    fx:properties fx:location "https://example.org/books.json" ;
                  fx:csv.headers true ;
                  fx:json.path "$.books[*]"^^<http://www.w3.org/2001/XMLSchema#string> .
    ?s ?p ?o
  }
}`;
      const [source] = findSparqlAnythingSources(query);
      expect(source.options).to.deep.equal({
        location: "https://example.org/books.json",
        "csv.headers": "true",
        "json.path": "$.books[*]",
      });
      expect(source.optionTriples.map((t) => t.raw)).to.deep.equal([
        '"https://example.org/books.json"',
        "true",
        '"$.books[*]"^^<http://www.w3.org/2001/XMLSchema#string>',
      ]);
      expect(source.format).to.equal("json");
      expect(source.ready).to.equal(true);
    });

    it("is not ready while the block is open or the location is a variable", () => {
      expect(findSparqlAnythingSources("SELECT * { SERVICE <x-sparql-anything:a.csv> { ?s ?p ?o")[0].ready).to.equal(
        false,
      );
      const [source] = findSparqlAnythingSources(
        "PREFIX fx: <http://sparql.xyz/facade-x/ns/> SELECT * { SERVICE <x-sparql-anything:> { fx:properties fx:location ?file . } }",
      );
      expect(source.ready).to.equal(false);
      expect(source.variableOptions).to.deep.equal(["location"]);
    });

    it("ignores braces in strings and comments and other services", () => {
      const query = `SELECT * WHERE {
  SERVICE <https://dbpedia.org/sparql> { ?a ?b ?c }
  SERVICE SILENT <x-sparql-anything:location=b.xml> {
    ?s ?p "}" # } not the end
    FILTER(?x < 3 && ?y > 2)
  }
  SERVICE <x-sparql-anything:c.json> { ?s ?p ?o }
}`;
      const sources = findSparqlAnythingSources(query);
      expect(sources.map((s) => s.label)).to.deep.equal(["b.xml", "c.json"]);
      expect(sources[0].silent).to.equal(true);
      expect(sources[0].format).to.equal("xml");
      expect(query.substring(sources[0].closeBrace!).startsWith("}\n  SERVICE <x-sparql")).to.equal(true);
      const inside = query.indexOf("FILTER");
      expect(sparqlAnythingSourceAt(sources, inside)?.label).to.equal("b.xml");
      expect(sparqlAnythingSourceAt(sources, 5)).to.equal(undefined);
    });

    it("gives the same source the same key, and other options another", () => {
      const a = findSparqlAnythingSources(CSV_QUERY)[0];
      const b = findSparqlAnythingSources(CSV_QUERY.replace("?row xyz:name ?name .", "?r ?p ?o"))[0];
      const c = findSparqlAnythingSources(CSV_QUERY.replace("csv.headers=true", "csv.headers=false"))[0];
      expect(a.key).to.equal(b.key);
      expect(a.key).to.not.equal(c.key);
    });

    it("returns nothing for queries without SPARQL Anything", () => {
      expect(findSparqlAnythingSources("SELECT * WHERE { SERVICE <https://x.org/sparql> { ?s ?p ?o } }")).to.deep.equal(
        [],
      );
    });
  });

  describe("probe queries", () => {
    it("sends the user's SERVICE IRI and option triples unchanged", () => {
      const query = `PREFIX fx: <http://sparql.xyz/facade-x/ns/>
SELECT * { SERVICE <x-sparql-anything:> { fx:properties fx:location "a.csv" ; fx:csv.headers true . } }`;
      const [source] = findSparqlAnythingSources(query);
      const probe = structureQuery(source, { fx: FX });
      expect(probe).to.contain("SERVICE <x-sparql-anything:> {");
      expect(probe).to.contain(`<${FX}properties> <${FX}location> "a.csv" ;`);
      expect(probe).to.contain(`<${FX}csv.headers> true .`);
      expect(probe).to.contain("GROUP BY ?gstep ?ptype ?pstep ?type ?step ?kind");
      expect(probe).to.match(/^PREFIX fx: /);
      const preview = previewQuery(source, {});
      expect(preview).to.contain("CONSTRUCT { ?s ?p ?o }");
      expect(preview).to.contain(`PREFIX xyz: <${XYZ}>`);
      expect(preview).to.match(/LIMIT 100$/);
    });
  });

  describe("structure", () => {
    it("reads the bindings of the structure query", () => {
      const rows = rowsFromBindings([
        {
          ptype: { type: "uri", value: FX + "root" },
          pstep: { type: "uri", value: SLOT },
          step: { type: "uri", value: XYZ + "name" },
          kind: { type: "literal", value: "literal" },
          n: { type: "literal", value: "3" },
          subjects: { type: "literal", value: "3" },
          example: { type: "literal", value: "Laura" },
        },
      ]);
      expect(rows).to.deep.equal([
        {
          gstep: undefined,
          ptype: FX + "root",
          pstep: SLOT,
          type: undefined,
          step: XYZ + "name",
          kind: "literal",
          n: 3,
          subjects: 3,
          example: "Laura",
        },
      ]);
    });

    it("builds the tree of a CSV: root, rows, columns", () => {
      const [root] = buildStructure(CSV_ROWS);
      expect(root.type).to.equal(FX + "root");
      expect(root.children).to.have.length(1);
      const rows = root.children[0];
      expect(rows.step).to.equal(SLOT);
      expect(rows.count).to.equal(3);
      expect(rows.children.map((c) => [c.step, c.count, c.example])).to.deep.equal([
        [XYZ + "name", 3, "Laura"],
        [XYZ + "email", 2, "laura@example.org"],
      ]);
    });

    it("builds the tree of nested JSON", () => {
      const tree = buildStructure(JSON_ROWS);
      const name = find(tree, (n) => n.step === XYZ + "name");
      const path: string[] = [];
      for (let n: StructureNode | undefined = name; n; n = n.parent) path.unshift(n.step || "root");
      expect(path).to.deep.equal(["root", XYZ + "books", SLOT, XYZ + "author", XYZ + "name"]);
    });

    it("builds the tree of XML elements", () => {
      const tree = buildStructure(XML_ROWS);
      const title = find(tree, (n) => n.type === XYZ + "title");
      expect(title.parent?.type).to.equal(XYZ + "book");
      expect(title.children.map((c) => [c.step, c.kind])).to.deep.equal([[SLOT, "literal"]]);
      expect(find(tree, (n) => n.step === XYZ + "id").parent?.type).to.equal(XYZ + "book");
    });

    it("lists properties and classes for autocompletion", () => {
      expect(termsFromRows(CSV_ROWS)).to.deep.equal({
        properties: [
          { iri: XYZ + "name", count: 3 },
          { iri: XYZ + "email", count: 2 },
        ],
        classes: [],
      });
      // Most used first
      expect(termsFromRows(XML_ROWS).classes.map((c) => c.iri)).to.deep.equal([
        XYZ + "book",
        XYZ + "title",
        XYZ + "library",
      ]);
    });
  });

  describe("query builder", () => {
    const prefixes = { fx: FX, xyz: XYZ };

    it("writes prefixed names when possible", () => {
      expect(writeIri(XYZ + "email", prefixes)).to.equal("xyz:email");
      expect(writeIri(XYZ + "first name", prefixes)).to.equal(`<${XYZ}first%20name>`);
    });

    it("writes rows of a CSV with fx:anySlot", () => {
      const [source] = findSparqlAnythingSources(CSV_QUERY);
      const tree = buildStructure(CSV_ROWS);
      const name = find(tree, (n) => n.step === XYZ + "name");
      const email = find(tree, (n) => n.step === XYZ + "email");
      const built = buildPatterns(
        [
          { node: email, optional: false },
          { node: name, optional: true },
        ],
        source,
        prefixes,
      );
      expect(built.variables).to.deep.equal(["?email", "?name"]);
      expect(built.lines).to.deep.equal([
        "?root a fx:root .",
        "?root fx:anySlot ?row .",
        "?row xyz:email ?email .",
        "OPTIONAL {",
        "  ?row xyz:name ?name .",
        "}",
      ]);
    });

    it("writes nested JSON paths, optional parts in OPTIONAL", () => {
      const [source] = findSparqlAnythingSources("SELECT * { SERVICE <x-sparql-anything:books.json> { } }");
      const tree = buildStructure(JSON_ROWS);
      const title = find(tree, (n) => n.step === XYZ + "title");
      const name = find(tree, (n) => n.step === XYZ + "name");
      const query = buildQuery(
        [
          { node: title, optional: false },
          { node: name, optional: true },
        ],
        source,
        {},
      );
      expect(query).to.equal(`PREFIX fx: <${FX}>
PREFIX xyz: <${XYZ}>
SELECT ?title ?name WHERE {
  SERVICE <x-sparql-anything:books.json> {
    ?root a fx:root .
    ?root xyz:books ?books .
    ?books fx:anySlot ?book .
    ?book xyz:title ?title .
    OPTIONAL {
      ?book xyz:author ?author .
      ?author xyz:name ?name .
    }
  }
}`);
    });

    it("writes XML elements with their type and text", () => {
      const [source] = findSparqlAnythingSources("SELECT * { SERVICE <x-sparql-anything:library.xml> { } }");
      const tree = buildStructure(XML_ROWS);
      const id = find(tree, (n) => n.step === XYZ + "id");
      const text = find(tree, (n) => n.kind === "literal" && n.parent?.type === XYZ + "title");
      const built = buildPatterns(
        [
          { node: id, optional: false },
          { node: text, optional: false },
        ],
        source,
        prefixes,
      );
      expect(built.lines).to.deep.equal([
        "?root a fx:root .",
        "?root fx:anySlot ?library .",
        "?library a xyz:library .",
        "?library fx:anySlot ?book .",
        "?book a xyz:book .",
        "?book xyz:id ?id .",
        "?book fx:anySlot ?title .",
        "?title a xyz:title .",
        "?title fx:anySlot ?title_value .",
        "FILTER(isLiteral(?title_value))",
      ]);
    });

    it("keeps the option triples and a custom namespace prefix", () => {
      const query = `PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX my: <http://example.org/my/>
SELECT * { SERVICE <x-sparql-anything:> { fx:properties fx:location "a.csv" ; fx:namespace "http://example.org/my/" . } }`;
      const [source] = findSparqlAnythingSources(query);
      expect(source.namespace).to.equal("http://example.org/my/");
      const rows = CSV_ROWS.map((r) => ({ ...r, step: r.step.replace(XYZ, "http://example.org/my/") }));
      const tree = buildStructure(rows);
      const name = find(tree, (n) => n.step === "http://example.org/my/name");
      const result = buildQuery([{ node: name, optional: false }], source, {
        fx: FX,
        my: "http://example.org/my/",
      });
      expect(result).to.contain('fx:properties fx:location "a.csv" ;');
      expect(result).to.contain('fx:namespace "http://example.org/my/" .');
      expect(result).to.contain("?row my:name ?name .");
      expect(result).to.not.contain("PREFIX xyz");
    });
  });
});
