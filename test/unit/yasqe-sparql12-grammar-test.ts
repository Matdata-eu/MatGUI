import * as chai from "chai";
import { describe, it } from "mocha";
import { StringStream } from "@codemirror/language";

import sparqlTokenizer, { State } from "../../packages/yasqe/grammar/tokenizer.js";

const expect = chai.expect;

interface ParseResult {
  /** No syntax error was detected (this is what Yasqe shows as valid/invalid) */
  ok: boolean;
  /** The query may end here */
  complete: boolean;
  /** 1-based line of the first syntax error */
  errorLine?: number;
  errorMsg?: string;
  state: State;
}

/** Runs the Yasqe tokenizer over a query, line by line, the same way the editor does */
function parse(query: string): ParseResult {
  const parser = sparqlTokenizer();
  const state = parser.startState!(2);
  const lines = query.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const stream = new StringStream(lines[i], 4, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      parser.token(stream, state);
      if (stream.pos <= stream.start) stream.pos = stream.start + 1;
    }
    if (!state.OK) return { ok: false, complete: false, errorLine: i + 1, errorMsg: state.errorMsg, state };
  }
  return { ok: state.OK, complete: state.complete, state };
}

/** Returns the [text, style] pairs of all non-whitespace tokens */
function tokenStyles(query: string): Array<[string, string]> {
  const parser = sparqlTokenizer();
  const state = parser.startState!(2);
  const result: Array<[string, string]> = [];
  for (const line of query.split(/\r?\n/)) {
    const stream = new StringStream(line, 4, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const style = parser.token(stream, state) || "";
      if (style !== "ws") result.push([line.slice(stream.start, stream.pos), style]);
    }
  }
  return result;
}

const PREFIXES = `PREFIX : <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
`;

function expectValid(query: string) {
  const result = parse(query);
  expect(
    result.ok,
    `Unexpected syntax error on line ${result.errorLine} (${result.errorMsg || "no message"}) in:\n${query}`,
  ).to.be.true;
  expect(result.complete, `Query is valid so far, but incomplete:\n${query}`).to.be.true;
}

function expectInvalid(query: string, errorLine?: number) {
  const result = parse(query);
  expect(result.ok, `Expected a syntax error in:\n${query}`).to.be.false;
  if (errorLine !== undefined) expect(result.errorLine, "line of the syntax error").to.equal(errorLine);
  return result;
}

interface TestCase {
  name: string;
  query: string;
  errorLine?: number;
}

const validQueries: TestCase[] = [
  {
    name: "VERSION declaration (double quotes)",
    query: `VERSION "1.2"
${PREFIXES}SELECT * WHERE { ?s ?p ?o }`,
  },
  {
    name: "VERSION declaration (single quotes) mixed with BASE and PREFIX",
    query: `BASE <http://example.org/base/>
PREFIX : <http://example.org/>
VERSION '1.2'
ASK { ?s :p ?o }`,
  },
  {
    name: "VERSION declaration in an update",
    query: `VERSION "1.2"
${PREFIXES}INSERT DATA { :s :p :o }`,
  },
  {
    name: "triple term as object",
    query: `${PREFIXES}SELECT ?person ?authority {
  ?person :familyName "Smith" .
  _:anno rdf:reifies <<( ?person :jobTitle "Designer" )>> .
  _:anno :accordingTo ?authority .
}`,
  },
  {
    name: "nested triple terms with all kinds of terms",
    query: `${PREFIXES}SELECT * WHERE {
  ?r :p <<( :a :b <<( _:c ?d "e"@en )>> )>> .
  ?r :q <<( [] a 1.5e3 )>> , <<( "s" :p true )>> , <<( ?s ?p -2 )>> .
}`,
  },
  {
    name: "triple term in subject position",
    query: `${PREFIXES}SELECT * WHERE { <<( :a :b :c )>> :p ?o }`,
  },
  {
    name: "reified triple as subject",
    query: `${PREFIXES}SELECT ?person ?authority {
  ?person :familyName "Smith" .
  << ?person :jobTitle "Designer" >> :accordingTo ?authority .
}`,
  },
  {
    name: "reified triple with reifiers of every kind",
    query: `${PREFIXES}SELECT * WHERE {
  << :a :b :c ~ ?r >> :p ?o1 .
  << :a :b :c ~ :r >> :p ?o2 .
  << :a :b :c ~ _:r >> :p ?o3 .
  << :a :b :c ~ [] >> :p ?o4 .
  << :a :b :c ~ >> :p ?o5 .
}`,
  },
  {
    name: "reified triple as object, and on its own",
    query: `${PREFIXES}SELECT * WHERE {
  ?who :says << :a :b :c >> .
  << :x :y :z ~ :stmt >> .
}`,
  },
  {
    name: "nested reified triples, triple terms and literal subjects",
    query: `${PREFIXES}SELECT * WHERE {
  << << :a :b :c >> :d <<( :e :f :g )>> >> :h ?i .
  << "x" a :C >> :p 1 .
}`,
  },
  {
    name: "reified triple followed by a property path",
    query: `${PREFIXES}SELECT * WHERE { << :a :b :c >> :p/:q* ?o }`,
  },
  {
    name: "reified triple spread over multiple lines",
    query: `${PREFIXES}SELECT * WHERE {
  <<
    ?s :p ?o
    ~ ?r
  >> :q ?z .
}`,
  },
  {
    name: "annotation block",
    query: `${PREFIXES}SELECT ?person ?authority {
  ?person :name "Alice" {| :statedBy ?authority ; :recorded "2021-07-07"^^xsd:date |} .
}`,
  },
  {
    name: "reifier and annotation block",
    query: `${PREFIXES}SELECT * WHERE { :a :b :c ~ :r {| :p :o |} . }`,
  },
  {
    name: "multiple reifiers and annotations in object and predicate lists",
    query: `${PREFIXES}SELECT * WHERE {
  :a :b :c ~ :r1 {| :p 1 |} ~ :r2 {| :q 2 |} , :d {| :s 3 |} ;
     :e :f ~ ?r3 .
}`,
  },
  {
    name: "annotations after a variable predicate and after 'a'",
    query: `${PREFIXES}SELECT * WHERE {
  ?s ?p ?o {| :source ?g |} .
  ?s a :C ~ ?r .
}`,
  },
  {
    name: "property paths inside an annotation block",
    query: `${PREFIXES}SELECT * WHERE { ?s :p ?o {| :source/:name ?n ; ^:q ?z |} }`,
  },
  {
    name: "annotation after a simple predicate that follows a property path",
    query: `${PREFIXES}SELECT * WHERE {
  ?s :p/:q ?x ; :r ?y {| :source ?z |} .
  ?s :p* ?x , ?w . ?x :r ?y ~ ?r .
}`,
  },
  {
    name: "annotation in a blank node that is the object of a property path",
    query: `${PREFIXES}SELECT * WHERE { ?s :p/:q [ :r ?y {| :source ?z |} ] . }`,
  },
  {
    name: "reifier inside a reified triple that is the object of a property path",
    query: `${PREFIXES}SELECT * WHERE { ?s :p/:q << :a :b :c ~ :r >> . }`,
  },
  {
    name: "annotations and reified triples in a CONSTRUCT template",
    query: `${PREFIXES}CONSTRUCT {
  ?s :p ?o {| :source ?g |} .
  << ?s :p ?o >> :certainty 0.9 .
}
WHERE { GRAPH ?g { ?s :p ?o } }`,
  },
  {
    name: "annotation in the short CONSTRUCT WHERE form",
    query: `${PREFIXES}CONSTRUCT WHERE { ?s :p ?o {| :q ?z |} }`,
  },
  {
    name: "triple term functions",
    query: `${PREFIXES}SELECT * WHERE {
  ?s :p ?o .
  BIND(TRIPLE(?s, :p, ?o) AS ?t)
  FILTER(isTRIPLE(?t) && SUBJECT(?t) = ?s && PREDICATE(?t) = :p && sameTerm(OBJECT(?t), ?o))
}`,
  },
  {
    name: "triple terms in expressions",
    query: `${PREFIXES}SELECT * WHERE {
  ?s :p ?o .
  BIND(<<( ?s :p "x" )>> AS ?t)
  FILTER(?t != <<( :a a <<( ?s :d 1 )>> )>>)
}`,
  },
  {
    name: "triple terms in VALUES",
    query: `${PREFIXES}SELECT * WHERE {
  VALUES ?t { <<( :a :b :c )>> <<( :a a :C )>> <<( :a :b <<( :c :d "x"@en--ltr )>> )>> UNDEF }
  VALUES (?x ?y) { (:a <<( :a :b 1 )>>) (UNDEF <<( :a :b true )>>) }
}
VALUES ?z { <<( :a :b "c"^^xsd:string )>> }`,
  },
  {
    name: "language tags with base direction and the related functions",
    query: `${PREFIXES}SELECT * WHERE {
  ?s :label ?l .
  FILTER(?l = "hello"@en--ltr || ?l = "مرحبا"@ar--rtl || ?l = "hi"@en-US)
  FILTER(LANGDIR(?l) = "ltr" && hasLANG(?l) && hasLANGDIR(?l))
  BIND(STRLANGDIR("abc", "en", "ltr") AS ?d)
}`,
  },
  {
    name: "language tag with base direction in a triple",
    query: `${PREFIXES}SELECT * WHERE { ?s :label "hello"@en-GB--ltr . }`,
  },
  {
    name: "'!' applied to a unary expression",
    query: `${PREFIXES}SELECT * WHERE { ?s ?p ?o FILTER(!!BOUND(?o)) FILTER(!-?o) }`,
  },
  {
    name: "aggregates are built-in calls (e.g. directly in ORDER BY)",
    query: `${PREFIXES}SELECT ?s (COUNT(?o) AS ?c) WHERE { ?s :p ?o }
GROUP BY ?s
ORDER BY DESC(COUNT(?o)) COUNT(?o)`,
  },
  {
    name: "INSERT DATA with triple terms, reifiers and annotations",
    query: `${PREFIXES}INSERT DATA {
  :alice :name "Alice" ~ :r1 {| :source :hr |} .
  :r2 rdf:reifies <<( :bob :age 42 )>> .
  << :carol :age 30 ~ :r3 >> :source :census .
  GRAPH :g { :dave :name "Dave"@en--ltr {| :source :hr |} }
}`,
  },
  {
    name: "DELETE DATA with triple terms and reifier IRIs",
    query: `${PREFIXES}DELETE DATA { :r2 rdf:reifies <<( :bob :age 42 )>> . :a :b :c ~ :r {| :p :o |} }`,
  },
  {
    name: "DELETE/INSERT WHERE with reified triples",
    query: `${PREFIXES}DELETE { << ?s :age ?old ~ ?r >> :source ?src }
INSERT { << ?s :age ?new ~ ?r >> :source ?src }
WHERE {
  << ?s :age ?old ~ ?r >> :source ?src .
  BIND(?old + 1 AS ?new)
}`,
  },
  {
    name: "DELETE WHERE with a reifier and annotation",
    query: `${PREFIXES}DELETE WHERE { ?s :p ?o ~ ?r {| :q ?z |} }`,
  },
  {
    name: "SPARQL 1.2 syntax inside GRAPH, OPTIONAL, SERVICE and subqueries",
    query: `${PREFIXES}SELECT * WHERE {
  GRAPH ?g { ?s :p ?o {| :source ?src |} }
  OPTIONAL { << ?s :p ?o >> :certainty ?c }
  SERVICE <http://example.org/sparql> { ?x rdf:reifies <<( ?s :p ?o )>> }
  { SELECT ?t WHERE { ?r rdf:reifies ?t FILTER(isTRIPLE(?t)) } }
}`,
  },
  {
    name: "blank node property list followed by a property path (was rejected before)",
    query: `${PREFIXES}SELECT * WHERE { [ :p ?o ] :a/:b ?c }`,
  },
];

// SPARQL 1.1 queries (and tokens that are close to the new SPARQL 1.2 tokens) must keep working
const sparql11Queries: TestCase[] = [
  {
    name: "basic query with FILTER, OPTIONAL, ORDER BY and LIMIT",
    query: `${PREFIXES}SELECT DISTINCT ?s (STR(?o) AS ?str) WHERE {
  ?s a :C ; :p ?o .
  OPTIONAL { ?s :q ?q }
  FILTER(?o > 3 && ?o < 10 || !BOUND(?q))
} ORDER BY DESC(?o) LIMIT 10 OFFSET 5`,
  },
  {
    name: "comparisons and brackets without whitespace",
    query: `${PREFIXES}SELECT * WHERE {?s ?p ?o FILTER(?o>3) FILTER((?o)>(?s)) FILTER(?o>=1||?o<=0) FILTER(?o<?s)}`,
  },
  {
    name: "comparison with a full IRI, separated by a space",
    query: `${PREFIXES}SELECT * WHERE { ?s ?p ?o FILTER(?o < <http://example.org/a>) FILTER(<http://example.org/a>>?o) }`,
  },
  {
    name: "property paths",
    query: `${PREFIXES}SELECT * WHERE {
  ?s :p|:q ?a .
  ?s ^:p/:q+ ?b .
  ?s !(rdf:type|^rdf:type) ?c .
  ?s (:p/:q)* ?d .
  ?s :p? ?e . { ?x ?y ?z }
}`,
  },
  {
    name: "aggregates with GROUP BY and HAVING",
    query: `${PREFIXES}SELECT ?s (COUNT(DISTINCT ?o) AS ?c) (GROUP_CONCAT(?o ; SEPARATOR=",") AS ?all)
WHERE { ?s :p ?o }
GROUP BY ?s
HAVING (COUNT(?o) > 1)`,
  },
  {
    name: "language tags",
    query: `${PREFIXES}SELECT * WHERE { ?s :label "chat"@fr, "cat"@en-GB . FILTER(LANG(?l) = "en" && LANGMATCHES(LANG(?l), "EN")) }`,
  },
  {
    name: "update request",
    query: `${PREFIXES}DELETE { ?s :p ?o } INSERT { ?s :q ?o } WHERE { ?s :p ?o } ;
INSERT DATA { :a :b [ :c "d" ] } ;
CLEAR SILENT GRAPH :g`,
  },
];

const invalidQueries: TestCase[] = [
  {
    name: "VERSION with an IRI",
    query: `VERSION <http://example.org/1.2>
SELECT * WHERE { ?s ?p ?o }`,
    errorLine: 1,
  },
  {
    name: "VERSION after the query",
    query: `SELECT * WHERE { ?s ?p ?o }
VERSION "1.2"`,
    errorLine: 2,
  },
  {
    name: "triple term closed with >>",
    query: `${PREFIXES}SELECT * WHERE { ?r :p <<( :a :b :c >> . }`,
    errorLine: 4,
  },
  {
    name: "reified triple closed with )>>",
    query: `${PREFIXES}SELECT * WHERE { ?r :p << :a :b :c )>> . }`,
    errorLine: 4,
  },
  {
    name: "property path in a reified triple",
    query: `${PREFIXES}SELECT * WHERE { << :a :b/:c :d >> :p ?o }`,
    errorLine: 4,
  },
  {
    name: "property path in a triple term",
    query: `${PREFIXES}SELECT * WHERE { ?r :p <<( :a :b* :c )>> }`,
    errorLine: 4,
  },
  {
    name: "collection in a reified triple",
    query: `${PREFIXES}SELECT * WHERE { << (1 2) :p :o >> :q ?z }`,
    errorLine: 4,
  },
  {
    name: "blank node property list in a triple term",
    query: `${PREFIXES}SELECT * WHERE { ?r :p <<( [ :q 1 ] :p :o )>> }`,
    errorLine: 4,
  },
  {
    name: "reifier in a triple term",
    query: `${PREFIXES}SELECT * WHERE { ?r :p <<( :a :b :c ~ :r )>> }`,
    errorLine: 4,
  },
  {
    name: "reified triple in a triple term",
    query: `${PREFIXES}SELECT * WHERE { ?r :p <<( << :a :b :c >> :p :o )>> }`,
    errorLine: 4,
  },
  {
    name: "collection in a triple term",
    query: `${PREFIXES}SELECT * WHERE { ?r :p <<( ?s ?p ( ) )>> }`,
    errorLine: 4,
  },
  {
    name: "reified triple as predicate",
    query: `${PREFIXES}SELECT * WHERE { :x << :a :b :c >> :y }`,
    errorLine: 4,
  },
  {
    name: "literal as reifier",
    query: `${PREFIXES}SELECT * WHERE { :a :b :c ~ "r" . }`,
    errorLine: 4,
  },
  {
    name: "empty annotation block",
    query: `${PREFIXES}SELECT * WHERE { :a :b :c {| |} . }`,
    errorLine: 4,
  },
  {
    name: "unclosed annotation block",
    query: `${PREFIXES}SELECT * WHERE { :a :b :c {| :p :o } }`,
    errorLine: 4,
  },
  {
    name: "reifier in a collection",
    query: `${PREFIXES}SELECT * WHERE { ?s :p ( :a ~ :r ) }`,
    errorLine: 4,
  },
  {
    name: "annotation after a property path",
    query: `${PREFIXES}SELECT * WHERE {
  ?s :p/:q ?o {| :source ?g |} .
}`,
    errorLine: 5,
  },
  {
    name: "reifier after a property path with a modifier",
    query: `${PREFIXES}SELECT * WHERE { ?s :p* ?o ~ ?r }`,
    errorLine: 4,
  },
  {
    name: "reifier after an inverse path",
    query: `${PREFIXES}SELECT * WHERE { ?s ^:p ?o ~ ?r }`,
    errorLine: 4,
  },
  {
    name: "reifier after a parenthesized path",
    query: `${PREFIXES}SELECT * WHERE { ?s (:p) ?o ~ ?r }`,
    errorLine: 4,
  },
  {
    name: "annotation after a later object of a property path",
    query: `${PREFIXES}SELECT * WHERE { ?s :p|:q ?a , ?b {| :source ?g |} }`,
    errorLine: 4,
  },
  {
    name: "annotation after a property path, after an earlier annotated object",
    query: `${PREFIXES}SELECT * WHERE { ?s :p ?o {| :src ?g |} ; :p/:q ?x ~ ?r }`,
    errorLine: 4,
  },
  {
    name: "reifier after a property path inside an annotation block",
    query: `${PREFIXES}SELECT * WHERE { ?s :p ?o {| :src/:x ?g ~ ?r |} }`,
    errorLine: 4,
  },
  {
    name: "variable in a triple term in VALUES",
    query: `${PREFIXES}SELECT * WHERE { VALUES ?t { <<( ?s :p :o )>> } }`,
    errorLine: 4,
  },
  {
    name: "blank node in a triple term in VALUES",
    query: `${PREFIXES}SELECT * WHERE { VALUES ?t { <<( _:b :p :o )>> } }`,
    errorLine: 4,
  },
  {
    name: "literal subject in a triple term in VALUES",
    query: `${PREFIXES}SELECT * WHERE { VALUES ?t { <<( "s" :p :o )>> } }`,
    errorLine: 4,
  },
  {
    name: "reified triple in VALUES",
    query: `${PREFIXES}SELECT * WHERE { VALUES ?t { << :s :p :o >> } }`,
    errorLine: 4,
  },
  {
    name: "blank node in a triple term expression",
    query: `${PREFIXES}SELECT * WHERE { BIND(<<( _:b :p :o )>> AS ?t) }`,
    errorLine: 4,
  },
  {
    name: "literal subject in a triple term expression",
    query: `${PREFIXES}SELECT * WHERE { BIND(<<( "s" :p :o )>> AS ?t) }`,
    errorLine: 4,
  },
  {
    name: "variable as reifier in INSERT DATA",
    query: `${PREFIXES}INSERT DATA { :a :b :c ~ ?r }`,
    errorLine: 4,
  },
  {
    name: "variable in a reified triple in INSERT DATA",
    query: `${PREFIXES}INSERT DATA { << :a :b ?c >> :p :o }`,
    errorLine: 4,
  },
  {
    name: "blank node reifier in DELETE DATA",
    query: `${PREFIXES}DELETE DATA { :a :b :c ~ _:r }`,
    errorLine: 4,
  },
  {
    name: "blank node in a reified triple in DELETE WHERE",
    query: `${PREFIXES}DELETE WHERE { << _:a :b :c >> :p ?o }`,
    errorLine: 4,
  },
  {
    name: "blank node in a triple term in a DELETE clause",
    query: `${PREFIXES}DELETE { ?r rdf:reifies <<( [] :b :c )>> } WHERE { ?r :p ?o }`,
    errorLine: 4,
  },
  {
    name: "TRIPLE with two arguments",
    query: `${PREFIXES}SELECT * WHERE { BIND(TRIPLE(?s, ?p) AS ?t) }`,
    errorLine: 4,
  },
  {
    name: "LANGDIR with two arguments",
    query: `${PREFIXES}SELECT * WHERE { BIND(LANGDIR(?s, ?p) AS ?t) }`,
    errorLine: 4,
  },
  {
    name: "language tag with an empty base direction",
    query: `${PREFIXES}SELECT * WHERE { ?s :label "hello"@en-- . }`,
    errorLine: 4,
  },
  {
    // Known incompatibility with SPARQL 1.1: the longest match '<<' is a single token in SPARQL 1.2
    name: "'<' directly followed by a full IRI",
    query: `${PREFIXES}SELECT * WHERE { ?s ?p ?o FILTER(?o<<http://example.org/a>) }`,
    errorLine: 4,
  },
];

describe("Yasqe SPARQL 1.2 grammar", () => {
  describe("accepts valid SPARQL 1.2 queries", () => {
    validQueries.forEach(({ name, query }) => it(name, () => expectValid(query)));
  });

  describe("keeps accepting SPARQL 1.1 queries", () => {
    sparql11Queries.forEach(({ name, query }) => it(name, () => expectValid(query)));
  });

  describe("rejects invalid SPARQL 1.2 queries", () => {
    invalidQueries.forEach(({ name, query, errorLine }) => it(name, () => expectInvalid(query, errorLine)));
  });

  it("explains why an annotation after a property path is invalid", () => {
    const result = expectInvalid(`${PREFIXES}SELECT * WHERE { ?s :p/:q ?o ~ ?r }`, 4);
    expect(result.errorMsg).to.contain("only allowed after a triple whose predicate is an IRI, 'a' or a variable");
  });

  it("reports an incomplete reified triple as incomplete, not as an error", () => {
    const result = parse(`${PREFIXES}SELECT * WHERE { << :a :b :c`);
    expect(result.ok).to.be.true;
    expect(result.complete).to.be.false;
  });

  it("suggests reifiers and annotations after an object", () => {
    const result = parse(`${PREFIXES}SELECT * WHERE { ?s :p ?o `);
    expect(result.state.possibleNext).to.include.members(["~", "{|"]);
  });

  it("tokenizes the new SPARQL 1.2 tokens", () => {
    const styles = tokenStyles(
      `VERSION "1.2" SELECT * { << :a :b "x"@en--ltr ~ :r >> :p <<( :a :b :c )>> {| :q 1 |} FILTER(hasLANGDIR(?x)) }`,
    );
    const styleOf = (text: string) => styles.find(([t]) => t === text)?.[1];
    expect(styleOf("VERSION")).to.equal("keyword");
    expect(styleOf("hasLANGDIR")).to.equal("keyword");
    expect(styleOf("@en--ltr")).to.equal("meta");
    for (const punct of ["<<", ">>", "<<(", ")>>", "{|", "|}", "~"]) {
      expect(
        styles.map(([t]) => t),
        `token ${punct}`,
      ).to.include(punct);
    }
  });
});
