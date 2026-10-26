#!/bin/sh
# Sends the structure query of the MatGUI Source view for each sample file to the local SPARQL Anything server
# and prints the result as CSV. Run after `docker compose up -d`.
ENDPOINT="${ENDPOINT:-http://localhost:3000/sparql.anything}"

structure_query() {
  cat <<QUERY | sed "s|__OPTIONS__|$1|"
SELECT ?gstep ?ptype ?pstep ?type ?step ?kind (COUNT(*) AS ?n) (COUNT(DISTINCT ?s) AS ?subjects) (SAMPLE(?o) AS ?example)
WHERE {
  SERVICE <x-sparql-anything:__OPTIONS__> {
    ?s ?p ?o .
    OPTIONAL { ?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?t }
    OPTIONAL { ?parent ?pp ?s . OPTIONAL { ?parent <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?pt } OPTIONAL { ?grand ?gp ?parent } }
  }
  FILTER(?p != <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>)
  BIND(IF(STRSTARTS(STR(?p), "http://www.w3.org/1999/02/22-rdf-syntax-ns#_") || ?p = <http://www.w3.org/2000/01/rdf-schema#member>, <urn:matgui:sparql-anything:slot>, ?p) AS ?step)
  BIND(IF(STRSTARTS(STR(?pp), "http://www.w3.org/1999/02/22-rdf-syntax-ns#_") || ?pp = <http://www.w3.org/2000/01/rdf-schema#member>, <urn:matgui:sparql-anything:slot>, ?pp) AS ?pstep)
  BIND(IF(STRSTARTS(STR(?gp), "http://www.w3.org/1999/02/22-rdf-syntax-ns#_") || ?gp = <http://www.w3.org/2000/01/rdf-schema#member>, <urn:matgui:sparql-anything:slot>, ?gp) AS ?gstep)
  BIND(?t AS ?type)
  BIND(?pt AS ?ptype)
  BIND(IF(isLiteral(?o), "literal", "node") AS ?kind)
}
GROUP BY ?gstep ?ptype ?pstep ?type ?step ?kind
LIMIT 5000
QUERY
}

for options in \
  "location=/data/people.csv,csv.headers=true" \
  "location=http://files/people.csv,csv.headers=true" \
  "location=/data/stations.tsv,csv.headers=true,csv.format=TDF" \
  "location=http://files/books.json" \
  "location=/data/library.xml"; do
  echo "== $options"
  curl -sS -X POST "$ENDPOINT" -H "Accept: text/csv" --data-urlencode "query=$(structure_query "$options")"
  echo
done

echo "== preview (first 10 triples of books.json)"
curl -sS -X POST "$ENDPOINT" -H "Accept: text/turtle" --data-urlencode "query=PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
CONSTRUCT { ?s ?p ?o } WHERE { SERVICE <x-sparql-anything:location=http://files/books.json> { ?s ?p ?o } } LIMIT 10"
