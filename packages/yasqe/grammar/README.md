# Yet Another SPARQL Query Editor (YASQE) grammar

The grammar covers SPARQL 1.1 and SPARQL 1.2 (queries and updates).

## Prerequisites

- SWI Prolog (`swipl` on the `PATH`)

## How to make modifications to grammar:

- Change the Extended Backus-Naur Form (EBNF) grammar in file
  `sparql-grammar.pl`.  Do not change file `_tokenizer-table.js`.
- Run `./build.sh`. It regenerates `_tokenizer-table.js` and formats it with prettier.
  Check its output for `LL(1) clash` messages: the grammar must stay LL(1).
- Finally, rebuild YASQE from the YASQE home directory by running `npm run build` (or `npm run dev` to test it locally).
- The grammar is tested by `test/unit/yasqe-sparql12-grammar-test.ts` and by
  `test/unit/yasqe-sparql-test-suites-test.ts` (`npm run unit-test`). The latter runs the queries of the
  W3C SPARQL test suites and of Traqula's curated tests, stored in `test/sparql-test-suites/`.
  Update them with `node test/sparql-test-suites/update.mjs`.
