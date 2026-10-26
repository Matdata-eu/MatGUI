# SPARQL Anything test environment

A [SPARQL Anything](https://sparql-anything.cc) server with a few sample files, to try the SPARQL Anything support
of MatGUI: the chip on `SERVICE <x-sparql-anything:...>` blocks, autocompletion of columns, keys and elements, and
the **Source** view of the side panel (structure, preview, query builder).

```bash
cd dev/sparql-anything
docker compose up -d
```

- Endpoint: `http://localhost:3000/sparql.anything` (it also has its own Yasgui at `http://localhost:3000/sparql`).
- The files in `data/` are mounted in the server at `/data/...` and served over HTTP at `http://files/...` inside the
  compose network only. Neither is reachable from the browser, as with files that only the endpoint can read.

Use it with MatGUI in one of these ways:

- `npm run dev` in the repository root and open `http://localhost:4000/yasgui.html`, then switch the endpoint to
  `http://localhost:3000/sparql.anything`.
- `docker compose --profile matgui up -d --build` builds MatGUI from this checkout and serves it on
  `http://localhost:8080`, with the SPARQL Anything endpoint as the default.

Stop with `docker compose down`.

`./check-structure.sh` sends the structure query of the Source view for each sample file with curl and prints the
rows, which is handy to see what MatGUI gets back without a browser.

## Example queries

Paste a query, wait for the chip after the opening brace of the SERVICE block, and click **Load structure**. Then
type `xyz:` inside the block to see the columns, or click **Inspect** to open the Source view.

CSV with a header row:

```sparql
PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:location=/data/people.csv,csv.headers=true> {
    ?root a fx:root ; fx:anySlot ?row .
    ?row xyz:name ?name .
  }
}
```

The same file over HTTP, with the options written as triples:

```sparql
PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:> {
    fx:properties fx:location "http://files/people.csv" ;
                  fx:csv.headers true .
    ?row xyz:email ?email .
  }
}
```

Tab separated values:

```sparql
SELECT * WHERE {
  SERVICE <x-sparql-anything:location=/data/stations.tsv,csv.headers=true,csv.format=TDF> {
    ?s ?p ?o
  }
}
```

Nested JSON (objects, arrays, arrays of strings):

```sparql
PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:location=http://files/books.json> {
    ?s ?p ?o
  }
}
```

XML (elements become types, attributes properties, text in slots):

```sparql
PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:location=/data/library.xml> {
    ?book a xyz:book .
  }
}
```

A location that is a variable can't be inspected before the query runs; the chip says so:

```sparql
PREFIX fx: <http://sparql.xyz/facade-x/ns/>
SELECT * WHERE {
  VALUES ?file { "/data/people.csv" }
  SERVICE <x-sparql-anything:> {
    fx:properties fx:location ?file .
    ?s ?p ?o
  }
}
```
