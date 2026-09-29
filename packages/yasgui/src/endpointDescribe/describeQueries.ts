/**
 * Catalogue of "describe endpoint" queries.
 *
 * Every query is bounded (LIMIT) so that exploring a very large endpoint never
 * results in an unbounded request. Queries flagged as `expensive` require a full
 * scan on most triple stores and are marked as such in the UI.
 */

export type DescribeCategoryId = "overview" | "schema" | "instances" | "labels" | "links" | "timegeo";

export interface DescribeCategory {
  id: DescribeCategoryId | string;
  label: string;
  icon: string;
}

export interface DescribeBinding {
  [variable: string]: { type: string; value: string; "xml:lang"?: string; datatype?: string };
}

export interface DescribeTable {
  vars: string[];
  bindings: DescribeBinding[];
}

export interface DescribeQueryContext {
  /** Maximum number of rows to fetch */
  limit: number;
  /** Offset, used when loading more rows of a paginated query */
  offset: number;
  /** Results of other describe queries for the same endpoint (used by dependent queries) */
  getResult: (queryId: string) => DescribeTable | undefined;
}

export interface DescribeQuery {
  id: string;
  category: DescribeCategoryId | string;
  label: string;
  description?: string;
  /** SPARQL SELECT query, or a function that builds it from the context */
  query: string | ((ctx: DescribeQueryContext) => string);
  /** Number of rows fetched per page */
  pageSize?: number;
  /** Whether more rows can be loaded with LIMIT/OFFSET */
  paginated?: boolean;
  /** Query that must have results before this one can be built */
  dependsOn?: string;
  /** Hint shown in the UI: this query may be slow on large endpoints */
  expensive?: boolean;
  /** Transform the raw results (e.g. to compute aggregates client-side) */
  postProcess?: (table: DescribeTable) => DescribeTable;
}

export const DEFAULT_PAGE_SIZE = 25;

export const defaultCategories: DescribeCategory[] = [
  { id: "overview", label: "Endpoint & dataset overview", icon: "fa-database" },
  { id: "schema", label: "Vocabulary & schema", icon: "fa-sitemap" },
  { id: "instances", label: "Instances", icon: "fa-cubes" },
  { id: "labels", label: "Labels, languages & literals", icon: "fa-language" },
  { id: "links", label: "Interlinking & external links", icon: "fa-link" },
  { id: "timegeo", label: "Time & geo", icon: "fa-earth-europe" },
];

export const COMMON_PREFIXES: { [prefix: string]: string } = {
  dcat: "http://www.w3.org/ns/dcat#",
  prov: "http://www.w3.org/ns/prov#",
  sosa: "http://www.w3.org/ns/sosa/",
  org: "http://www.w3.org/ns/org#",
  void: "http://rdfs.org/ns/void#",
  sd: "http://www.w3.org/ns/sparql-service-description#",
  vcard: "http://www.w3.org/2006/vcard/ns#",
  adms: "http://www.w3.org/ns/adms#",
  locn: "http://www.w3.org/ns/locn#",
  dbo: "http://dbpedia.org/ontology/",
  dbr: "http://dbpedia.org/resource/",
  dbp: "http://dbpedia.org/property/",
  wd: "http://www.wikidata.org/entity/",
  wdt: "http://www.wikidata.org/prop/direct/",
  p: "http://www.wikidata.org/prop/",
  ps: "http://www.wikidata.org/prop/statement/",
  pq: "http://www.wikidata.org/prop/qualifier/",
  wikibase: "http://wikiba.se/ontology#",
  era: "http://data.europa.eu/949/",
  euvoc: "http://publications.europa.eu/ontology/euvoc#",
};

const PREFIXES = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  skos: "http://www.w3.org/2004/02/skos/core#",
  sh: "http://www.w3.org/ns/shacl#",
  shex: "http://www.w3.org/ns/shex#",
  dcterms: "http://purl.org/dc/terms/",
  dc: "http://purl.org/dc/elements/1.1/",
  schema: "http://schema.org/",
  foaf: "http://xmlns.com/foaf/0.1/",
  geo: "http://www.opengis.net/ont/geosparql#",
  wgs84: "http://www.w3.org/2003/01/geo/wgs84_pos#",
  georss: "http://www.georss.org/georss/",
};

Object.assign(COMMON_PREFIXES, PREFIXES);

function prefixes(...names: Array<keyof typeof PREFIXES>): string {
  return names.map((name) => `PREFIX ${name}: <${PREFIXES[name]}>`).join("\n") + "\n";
}

function page(ctx: DescribeQueryContext): string {
  return `LIMIT ${ctx.limit}` + (ctx.offset > 0 ? ` OFFSET ${ctx.offset}` : "");
}

function iriTerm(value: string): string {
  return `<${value.replace(/[<>"{}|^`\\\s]/g, "")}>`;
}

const NUMBER = "-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?";
const COORDINATE_TUPLE = new RegExp(`${NUMBER}(?:\\s+${NUMBER})+`, "g");

/**
 * Computes a bounding box and centroid from a sample of WKT literals.
 * Only the first two numbers of every coordinate tuple are used (x/y), Z and M values are ignored.
 */
export function wktExtent(table: DescribeTable): DescribeTable {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    sumX = 0,
    sumY = 0,
    points = 0,
    geometries = 0;
  const crsSet = new Set<string>();
  for (const binding of table.bindings) {
    const wkt = binding.wkt?.value;
    if (!wkt) continue;
    const crsMatch = wkt.trim().match(/^<([^>]+)>/);
    crsSet.add(crsMatch ? crsMatch[1] : "http://www.opengis.net/def/crs/OGC/1.3/CRS84");
    const body = crsMatch ? wkt.trim().substring(crsMatch[0].length) : wkt;
    const tuples = body.match(COORDINATE_TUPLE);
    if (!tuples) continue;
    geometries++;
    for (const tuple of tuples) {
      const [x, y] = tuple.trim().split(/\s+/).map(Number);
      if (!isFinite(x) || !isFinite(y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      sumX += x;
      sumY += y;
      points++;
    }
  }
  const literal = (value: number | string) => ({ type: "literal", value: String(value) });
  if (points === 0) return { vars: ["sampledGeometries"], bindings: [{ sampledGeometries: literal(0) }] };
  return {
    vars: ["minX", "minY", "maxX", "maxY", "centroidX", "centroidY", "sampledGeometries", "crs"],
    bindings: [
      {
        minX: literal(minX),
        minY: literal(minY),
        maxX: literal(maxX),
        maxY: literal(maxY),
        centroidX: literal(+(sumX / points).toFixed(6)),
        centroidY: literal(+(sumY / points).toFixed(6)),
        sampledGeometries: literal(geometries),
        crs: literal(Array.from(crsSet).join(", ")),
      },
    ],
  };
}

export const defaultDescribeQueries: DescribeQuery[] = [
  /**
   * 1) Endpoint & dataset overview
   */
  {
    id: "named-graphs",
    category: "overview",
    label: "Named graphs",
    description: "Lists the named graphs, page by page, to see how the data is partitioned.",
    paginated: true,
    query: (ctx) => `SELECT DISTINCT ?graph WHERE {\n  GRAPH ?graph { ?s ?p ?o }\n}\n${page(ctx)}`,
  },
  {
    id: "graph-sizes",
    category: "overview",
    label: "Triples per named graph",
    description: "Number of triples in each named graph, largest first.",
    paginated: true,
    expensive: true,
    query: (ctx) =>
      `SELECT ?graph (COUNT(*) AS ?triples) WHERE {\n  GRAPH ?graph { ?s ?p ?o }\n}\nGROUP BY ?graph\nORDER BY DESC(?triples)\n${page(
        ctx,
      )}`,
  },
  {
    id: "triple-count",
    category: "overview",
    label: "Total number of triples",
    description: "Number of triples in the default graph (which is the union of all graphs on many triple stores).",
    expensive: true,
    query: `SELECT (COUNT(*) AS ?triples) WHERE {\n  ?s ?p ?o\n}`,
  },
  {
    id: "namespaces",
    category: "overview",
    label: "Most used namespaces",
    description: "Namespaces of the predicates, ranked by the number of triples using them.",
    expensive: true,
    query: (ctx) =>
      `SELECT ?namespace (COUNT(*) AS ?triples) WHERE {\n  ?s ?p ?o .\n  BIND(REPLACE(STR(?p), "[^#/]*$", "") AS ?namespace)\n}\nGROUP BY ?namespace\nORDER BY DESC(?triples)\n${page(
        ctx,
      )}`,
    paginated: true,
  },

  /**
   * 2) Vocabulary & schema discovery
   */
  {
    id: "classes",
    category: "schema",
    label: "Classes",
    description: "All classes with the number of instances, most used first.",
    paginated: true,
    query: (ctx) =>
      `SELECT ?class (COUNT(?instance) AS ?instances) WHERE {\n  ?instance a ?class\n}\nGROUP BY ?class\nORDER BY DESC(?instances)\n${page(
        ctx,
      )}`,
  },
  {
    id: "properties",
    category: "schema",
    label: "Properties",
    description: "All properties with their usage count, to learn the shape of the data.",
    paginated: true,
    expensive: true,
    query: (ctx) =>
      `SELECT ?property (COUNT(*) AS ?uses) WHERE {\n  ?s ?property ?o\n}\nGROUP BY ?property\nORDER BY DESC(?uses)\n${page(
        ctx,
      )}`,
  },
  {
    id: "skos-schemes",
    category: "schema",
    label: "SKOS concept schemes",
    description: "SKOS concept schemes and the number of concepts in each.",
    paginated: true,
    query: (ctx) =>
      `${prefixes(
        "skos",
      )}SELECT ?scheme (SAMPLE(?schemeLabel) AS ?label) (COUNT(DISTINCT ?concept) AS ?concepts) WHERE {\n  ?scheme a skos:ConceptScheme .\n  OPTIONAL { ?concept skos:inScheme ?scheme }\n  OPTIONAL { ?scheme skos:prefLabel ?schemeLabel }\n}\nGROUP BY ?scheme\nORDER BY DESC(?concepts)\n${page(
        ctx,
      )}`,
  },
  {
    id: "shapes",
    category: "schema",
    label: "SHACL / ShEx shapes",
    description: "Shapes and constraints published in the endpoint, with their target class when available.",
    paginated: true,
    query: (ctx) =>
      `${prefixes(
        "sh",
        "shex",
      )}SELECT ?shape ?type ?targetClass WHERE {\n  VALUES ?type { sh:NodeShape sh:PropertyShape shex:Schema shex:ShapeDecl shex:Shape }\n  ?shape a ?type .\n  OPTIONAL { ?shape sh:targetClass ?targetClass }\n}\n${page(
        ctx,
      )}`,
  },

  /**
   * 3) Instance-level exploration
   */
  {
    id: "class-samples",
    category: "instances",
    label: "Sample instances per class",
    description: "A few instances of each of the 10 most used classes (runs the Classes query first).",
    dependsOn: "classes",
    query: (ctx) => {
      const classes = (ctx.getResult("classes")?.bindings || [])
        .map((b) => b.class)
        .filter((term) => term && term.type === "uri")
        .slice(0, 10);
      if (classes.length === 0) {
        return `SELECT ?class ?instance WHERE {\n  ?instance a ?class\n}\nLIMIT ${ctx.limit}`;
      }
      const perClass = Math.max(1, Math.floor(50 / classes.length));
      const unions = classes
        .map(
          (term) =>
            `  {\n    SELECT ?class ?instance WHERE {\n      ?instance a ${iriTerm(term.value)} .\n      BIND(${iriTerm(
              term.value,
            )} AS ?class)\n    }\n    LIMIT ${perClass}\n  }`,
        )
        .join("\n  UNION\n");
      return `SELECT ?class ?instance WHERE {\n${unions}\n}`;
    },
  },
  {
    id: "hubs",
    category: "instances",
    label: "Most connected nodes",
    description: "Resources with the highest number of incoming and outgoing statements (hubs).",
    expensive: true,
    query: (ctx) =>
      `SELECT ?node (COUNT(*) AS ?degree) WHERE {\n  { ?node ?p ?o }\n  UNION\n  { ?s ?p ?node . FILTER(isIRI(?node)) }\n}\nGROUP BY ?node\nORDER BY DESC(?degree)\n${page(
        ctx,
      )}`,
  },

  /**
   * 4) Labels, languages & literals
   */
  {
    id: "label-languages",
    category: "labels",
    label: "Labels per language",
    description: "Number of labels and titles per language, to see the localization coverage.",
    expensive: true,
    query: `${prefixes(
      "rdfs",
      "skos",
      "dcterms",
      "dc",
      "schema",
      "foaf",
    )}SELECT ?property ?language (COUNT(*) AS ?labels) WHERE {\n  VALUES ?property { rdfs:label skos:prefLabel skos:altLabel dcterms:title dc:title schema:name foaf:name }\n  ?s ?property ?label .\n  BIND(LANG(?label) AS ?language)\n}\nGROUP BY ?property ?language\nORDER BY DESC(?labels)\nLIMIT 100`,
  },
  {
    id: "language-tagged-properties",
    category: "labels",
    label: "Properties with language-tagged literals",
    description: "Properties that carry language-tagged literals and their language distribution.",
    paginated: true,
    expensive: true,
    query: (ctx) =>
      `SELECT ?property ?language (COUNT(*) AS ?literals) WHERE {\n  ?s ?property ?o .\n  FILTER(isLiteral(?o) && LANG(?o) != "")\n  BIND(LANG(?o) AS ?language)\n}\nGROUP BY ?property ?language\nORDER BY DESC(?literals)\n${page(
        ctx,
      )}`,
  },

  /**
   * 5) Interlinking & external links
   */
  {
    id: "linked-hosts",
    category: "links",
    label: "Referenced hosts",
    description: "Hosts of the IRIs used as objects (excluding rdf:type), e.g. Wikidata, GeoNames or DBpedia.",
    paginated: true,
    expensive: true,
    query: (ctx) =>
      `${prefixes(
        "rdf",
      )}SELECT ?host (COUNT(*) AS ?links) WHERE {\n  ?s ?p ?o .\n  FILTER(isIRI(?o) && ?p != rdf:type)\n  BIND(REPLACE(STR(?o), "^([a-zA-Z][a-zA-Z0-9+.-]*://[^/?#]+).*$", "$1") AS ?host)\n}\nGROUP BY ?host\nORDER BY DESC(?links)\n${page(
        ctx,
      )}`,
  },
  {
    id: "link-properties",
    category: "links",
    label: "Linking properties",
    description: "Usage of common interlinking properties (owl:sameAs, SKOS mapping properties, rdfs:seeAlso, …).",
    query: `${prefixes(
      "owl",
      "skos",
      "rdfs",
      "schema",
    )}SELECT ?property (COUNT(*) AS ?links) (SAMPLE(?target) AS ?exampleTarget) WHERE {\n  VALUES ?property { owl:sameAs skos:exactMatch skos:closeMatch skos:relatedMatch skos:broadMatch skos:narrowMatch rdfs:seeAlso schema:sameAs }\n  ?entity ?property ?target .\n}\nGROUP BY ?property\nORDER BY DESC(?links)\nLIMIT 50`,
  },
  {
    id: "linked-entities",
    category: "links",
    label: "Entities with outbound links",
    description: "Entities that link to other resources with an interlinking property.",
    paginated: true,
    query: (ctx) =>
      `${prefixes(
        "owl",
        "skos",
        "rdfs",
        "schema",
      )}SELECT ?entity ?property ?target WHERE {\n  VALUES ?property { owl:sameAs skos:exactMatch skos:closeMatch rdfs:seeAlso schema:sameAs }\n  ?entity ?property ?target .\n  FILTER(isIRI(?target))\n}\n${page(
        ctx,
      )}`,
  },

  /**
   * 6) Time & geo dimensions
   */
  {
    id: "temporal-properties",
    category: "timegeo",
    label: "Temporal properties",
    description: "Properties with date or time values, with their earliest and latest value.",
    expensive: true,
    query: `${prefixes(
      "xsd",
    )}SELECT ?property ?datatype (COUNT(*) AS ?values) (MIN(?o) AS ?earliest) (MAX(?o) AS ?latest) WHERE {\n  ?s ?property ?o .\n  FILTER(isLiteral(?o))\n  BIND(DATATYPE(?o) AS ?datatype)\n  FILTER(?datatype IN (xsd:date, xsd:dateTime, xsd:dateTimeStamp, xsd:gYear, xsd:gYearMonth, xsd:time))\n}\nGROUP BY ?property ?datatype\nORDER BY DESC(?values)\nLIMIT 50`,
  },
  {
    id: "geo-properties",
    category: "timegeo",
    label: "Geospatial properties",
    description: "Usage of GeoSPARQL, W3C WGS84 and schema.org geo properties.",
    query: `${prefixes(
      "geo",
      "wgs84",
      "schema",
      "georss",
    )}SELECT ?property ?datatype (COUNT(*) AS ?values) (SAMPLE(?o) AS ?example) WHERE {\n  VALUES ?property { geo:hasGeometry geo:hasDefaultGeometry geo:asWKT geo:asGML geo:asGeoJSON wgs84:lat wgs84:long wgs84:lat_long schema:geo schema:latitude schema:longitude georss:point }\n  ?s ?property ?o .\n  BIND(DATATYPE(?o) AS ?datatype)\n}\nGROUP BY ?property ?datatype\nORDER BY DESC(?values)\nLIMIT 50`,
  },
  {
    id: "wkt-crs",
    category: "timegeo",
    label: "Coordinate reference systems",
    description: "CRS used in GeoSPARQL WKT literals (literals without an explicit CRS use CRS84).",
    expensive: true,
    query: `${prefixes(
      "geo",
    )}SELECT ?crs (COUNT(*) AS ?geometries) WHERE {\n  ?geometry geo:asWKT ?wkt .\n  BIND(IF(STRSTARTS(STR(?wkt), "<"), STRBEFORE(STRAFTER(STR(?wkt), "<"), ">"), "http://www.opengis.net/def/crs/OGC/1.3/CRS84") AS ?crs)\n}\nGROUP BY ?crs\nORDER BY DESC(?geometries)\nLIMIT 50`,
  },
  {
    id: "latlong-extent",
    category: "timegeo",
    label: "Bounding box (lat/long)",
    description: "Bounding box and centroid of all resources with WGS84 or schema.org latitude/longitude.",
    expensive: true,
    query: `${prefixes(
      "xsd",
      "wgs84",
      "schema",
    )}SELECT (MIN(?lat) AS ?minLat) (MIN(?long) AS ?minLong) (MAX(?lat) AS ?maxLat) (MAX(?long) AS ?maxLong) (AVG(?lat) AS ?centroidLat) (AVG(?long) AS ?centroidLong) (COUNT(*) AS ?points) WHERE {\n  { ?s wgs84:lat ?latValue ; wgs84:long ?longValue }\n  UNION\n  { ?s schema:latitude ?latValue ; schema:longitude ?longValue }\n  BIND(xsd:decimal(?latValue) AS ?lat)\n  BIND(xsd:decimal(?longValue) AS ?long)\n}`,
  },
  {
    id: "wkt-extent",
    category: "timegeo",
    label: "Bounding box (WKT sample)",
    description: "Bounding box and centroid computed in the browser from a sample of 1000 GeoSPARQL WKT geometries.",
    query: `${prefixes("geo")}SELECT ?wkt WHERE {\n  ?geometry geo:asWKT ?wkt\n}\nLIMIT 1000`,
    postProcess: wktExtent,
  },
];

export function buildQuery(query: DescribeQuery, ctx: DescribeQueryContext): string {
  return typeof query.query === "function" ? query.query(ctx) : query.query;
}
