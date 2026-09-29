#!/bin/bash
# Regenerates _tokenizer-table.js from sparql11-grammar.pl (requires SWI-Prolog)
set -e
GRAMMAR_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$GRAMMAR_DIR/util"
swipl -s gen_sparql11.pl -t go
mv _tokenizer-table.js ../_tokenizer-table.js
cd "$GRAMMAR_DIR/../../.."
npx prettier --parser babel --write packages/yasqe/grammar/_tokenizer-table.js
