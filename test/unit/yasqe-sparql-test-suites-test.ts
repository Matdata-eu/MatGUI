/**
 * Runs the queries of the W3C SPARQL test suites and of Traqula's curated tests through the Yasqe tokenizer.
 * The queries are stored in test/sparql-test-suites/*.json; run test/sparql-test-suites/update.mjs to update them.
 */
import fs from "fs";
import path from "path";
import * as chai from "chai";
import { describe, it } from "mocha";

import { parse } from "./sparql-parse-utils.js";

const expect = chai.expect;

interface SuiteTest {
  id: string;
  name?: string;
  expect: "valid" | "invalid";
  kind?: "syntax" | "evaluation";
  query: string;
}

function loadSuite(fileName: string): SuiteTest[] {
  const file = path.join(process.cwd(), "test", "sparql-test-suites", fileName);
  return JSON.parse(fs.readFileSync(file, "utf8")).tests;
}

// Yasqe only checks the grammar (plus a few side conditions). These rules of the specification are not checked.
const NOT_CHECKED = {
  bnodeScope: "not checked: a blank node label may not be used in more than one basic graph pattern or operation",
  grouping: "not checked: variables used with GROUP BY and aggregates must be grouped",
  variableScope: "not checked: a variable assigned by AS may not already be in scope",
  valuesArity: "not checked: every row of VALUES must have as many values as there are variables",
};
const MULTILINE =
  "`[ ]` or `( )` split over multiple lines is not recognized as ANON or NIL, because the editor tokenizes each line separately";

/** Tests where Yasqe knowingly disagrees with the expected outcome */
const knownDivergences: { [suite: string]: { [id: string]: string } } = {
  "w3c.json": {
    "sparql10/syntax-sparql2/syntax-bnode-02.rq": MULTILINE,
    "sparql10/syntax-sparql2/syntax-function-03.rq": MULTILINE,
    "sparql10/syntax-sparql2/syntax-lists-03.rq": MULTILINE,
    "sparql10/syntax-sparql3/syn-blabel-cross-graph-bad.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql3/syn-blabel-cross-optional-bad.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql3/syn-blabel-cross-union-bad.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-34.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-35.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-36.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-37.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-38.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-GRAPH-breaks-BGP.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-OPT-breaks-BGP.rq": NOT_CHECKED.bnodeScope,
    "sparql10/syntax-sparql4/syn-bad-UNION-breaks-BGP.rq": NOT_CHECKED.bnodeScope,
    "sparql11/syntax-update-1/syntax-update-54.ru": NOT_CHECKED.bnodeScope,
    "sparql11/aggregates/agg08.rq": NOT_CHECKED.grouping,
    "sparql11/aggregates/agg09.rq": NOT_CHECKED.grouping,
    "sparql11/aggregates/agg10.rq": NOT_CHECKED.grouping,
    "sparql11/aggregates/agg11.rq": NOT_CHECKED.grouping,
    "sparql11/aggregates/agg12.rq": NOT_CHECKED.grouping,
    "sparql11/grouping/group06.rq": NOT_CHECKED.grouping,
    "sparql11/grouping/group07.rq": NOT_CHECKED.grouping,
    "sparql11/syntax-query/syn-bad-01.rq": NOT_CHECKED.grouping,
    "sparql11/syntax-query/syn-bad-02.rq": NOT_CHECKED.grouping,
    "sparql11/syntax-query/syn-bad-03.rq": NOT_CHECKED.variableScope,
    "sparql11/syntax-query/syntax-BINDscope6.rq": NOT_CHECKED.variableScope,
    "sparql11/syntax-query/syntax-BINDscope7.rq": NOT_CHECKED.variableScope,
    "sparql11/syntax-query/syntax-BINDscope8.rq": NOT_CHECKED.variableScope,
    "sparql11/syntax-query/syntax-SELECTscope2.rq": NOT_CHECKED.variableScope,
    "sparql11/syntax-query/syn-bad-values-too-few.rq": NOT_CHECKED.valuesArity,
    "sparql11/syntax-query/syn-bad-values-too-many.rq": NOT_CHECKED.valuesArity,
  },
  "traqula.json": {
    "sparql-1-1-invalid/bnode-reuse-subquery-union": NOT_CHECKED.bnodeScope,
    "sparql-1-1-invalid/count-with-ungrouped-expression-variable": NOT_CHECKED.grouping,
    "sparql-1-1-invalid/select-star-with-group-by": NOT_CHECKED.grouping,
    "sparql-1-1-invalid/ungrouped-variable-in-expression-projection": NOT_CHECKED.grouping,
  },
};

/** Traqula runs its tests with a predefined `ex:` prefix, which Yasqe requires to be declared */
function withTraqulaContext(query: string) {
  if (/(^|[\s(){}\[\],;^/|])ex:/.test(query) && !/PREFIX\s+ex:/i.test(query)) {
    return "PREFIX ex: <http://example.org/>\n" + query;
  }
  return query;
}

function describeSuite(title: string, fileName: string, prepare: (query: string) => string = (q) => q) {
  describe(title, () => {
    const tests = loadSuite(fileName);
    const known = knownDivergences[fileName];

    it("contains the tests listed as known divergences", () => {
      const ids = new Set(tests.map((t) => t.id));
      expect(Object.keys(known).filter((id) => !ids.has(id))).to.deep.equal([]);
    });

    for (const test of tests) {
      const label = `${test.expect === "valid" ? "accepts" : "rejects"} ${test.id}${test.kind === "evaluation" ? " (evaluation test)" : ""}`;
      it(known[test.id] ? `${label} [known divergence: ${known[test.id]}]` : label, () => {
        const query = prepare(test.query);
        const result = parse(query);
        const valid = result.ok && result.complete;
        const details = result.ok
          ? `the query is ${result.complete ? "complete" : "incomplete"}`
          : `syntax error on line ${result.errorLine}${result.errorMsg ? ": " + result.errorMsg : ""}`;
        if (known[test.id]) {
          expect(valid, `${test.id} is now handled correctly: remove it from the known divergences`).to.equal(
            test.expect !== "valid",
          );
        } else {
          expect(valid, `${test.id} (${details}):\n${query}`).to.equal(test.expect === "valid");
        }
      });
    }
  });
}

describe("Yasqe SPARQL test suites", () => {
  describeSuite("W3C SPARQL 1.0, 1.1 and 1.2 test suites", "w3c.json");
  describeSuite("Traqula curated SPARQL 1.1 and 1.2 tests", "traqula.json", withTraqulaContext);
});
