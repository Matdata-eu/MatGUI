/**
 * Discovery of the SPARQL Service Description (SD) and VoID description of an endpoint.
 *
 * - SD: https://www.w3.org/TR/sparql11-service-description/ is returned by the endpoint
 *   itself when it is dereferenced without a query.
 * - VoID: https://www.w3.org/TR/void/ is commonly published at /.well-known/void
 *
 * Both are optional. Failures (CORS, 404, HTML responses, unsupported formats) are expected
 * and are reported as "unavailable".
 */
import * as N3 from "n3";

const SD = "http://www.w3.org/ns/sparql-service-description#";
const VOID = "http://rdfs.org/ns/void#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const DCTERMS = "http://purl.org/dc/terms/";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

/** Maximum number of list items kept per metadata field */
const MAX_ITEMS = 200;

/**
 * Maximum number of bytes read from a service description or VoID document.
 * Some endpoints publish very large descriptions (e.g. Wikidata: ~19 MB with all partitions);
 * only the first part is read and parsed.
 */
export const MAX_METADATA_BYTES = 5_000_000;

export const RDF_ACCEPT = "text/turtle, application/n-triples;q=0.9, application/n-quads;q=0.8, text/n3;q=0.7";

export type MetadataStatus = "ok" | "unavailable";

export interface ServiceDescription {
  languages: string[];
  features: string[];
  extensionFunctions: string[];
  extensionAggregates: string[];
  resultFormats: string[];
  inputFormats: string[];
  entailmentRegimes: string[];
  namedGraphs: string[];
}

export interface VoidPartition {
  iri: string;
  entities?: number;
  triples?: number;
}

export interface VoidDataset {
  iri: string;
  /** The dataset is a blank node: its identifier is not meaningful */
  blank?: boolean;
  title?: string;
  triples?: number;
  entities?: number;
  classes?: number;
  properties?: number;
  distinctSubjects?: number;
  distinctObjects?: number;
  sparqlEndpoints: string[];
  vocabularies: string[];
  classPartitions: VoidPartition[];
  propertyPartitions: VoidPartition[];
  linksets: Array<{ iri: string; target?: string; triples?: number }>;
}

export interface EndpointMetadata {
  fetchedAt: number;
  sdStatus: MetadataStatus;
  voidStatus: MetadataStatus;
  sd?: ServiceDescription;
  datasets: VoidDataset[];
  /** Human readable reason why a source is unavailable */
  sdError?: string;
  voidError?: string;
  /** The description was larger than MAX_METADATA_BYTES and only partially read */
  truncated?: boolean;
}

export interface FetchInit {
  headers?: { [key: string]: string };
  withCredentials?: boolean;
  signal?: AbortSignal;
}

/**
 * Cut a truncated Turtle/N-Triples document after its last complete statement.
 */
export function cutAtLastStatement(content: string): string {
  const match = /[\s\S]*\s\.[ \t]*(\r?\n|$)/.exec(content);
  return match ? match[0] : "";
}

export function parseRdf(content: string, contentType: string | null, baseIRI: string): N3.Quad[] {
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  if (type.includes("html") || type.includes("json") || type.includes("xml")) {
    throw new Error(`Unsupported content type ${type}`);
  }
  let format: string | undefined;
  if (type === "application/n-triples") format = "N-Triples";
  else if (type === "application/n-quads") format = "N-Quads";
  else if (type === "text/n3") format = "N3";
  else if (type === "application/trig") format = "TriG";
  else format = "Turtle";
  const parser = new N3.Parser({ baseIRI, format });
  return parser.parse(content);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).slice(0, MAX_ITEMS);
}

class QuadIndex {
  private bySubject = new Map<string, N3.Quad[]>();
  public blankNodes = new Set<string>();
  constructor(public quads: N3.Quad[]) {
    for (const quad of quads) {
      const key = quad.subject.value;
      if (quad.subject.termType === "BlankNode") this.blankNodes.add(key);
      if (!this.bySubject.has(key)) this.bySubject.set(key, []);
      this.bySubject.get(key)!.push(quad);
    }
  }
  objects(subject: string, predicate: string): N3.Term[] {
    return (this.bySubject.get(subject) || []).filter((q) => q.predicate.value === predicate).map((q) => q.object);
  }
  values(subject: string, predicate: string): string[] {
    return this.objects(subject, predicate).map((o) => o.value);
  }
  number(subject: string, predicate: string): number | undefined {
    const value = this.values(subject, predicate)[0];
    if (value === undefined) return undefined;
    const num = Number(value);
    return isFinite(num) ? num : undefined;
  }
  subjectsOfType(type: string): string[] {
    return unique(
      this.quads.filter((q) => q.predicate.value === RDF_TYPE && q.object.value === type).map((q) => q.subject.value),
    );
  }
  subjectsWith(predicate: string): string[] {
    return unique(this.quads.filter((q) => q.predicate.value === predicate).map((q) => q.subject.value));
  }
}

export function extractServiceDescription(quads: N3.Quad[]): ServiceDescription | undefined {
  const index = new QuadIndex(quads);
  const services = unique([...index.subjectsOfType(SD + "Service"), ...index.subjectsWith(SD + "endpoint")]);
  if (services.length === 0) return undefined;
  const collect = (predicate: string) => unique(services.flatMap((s) => index.values(s, SD + predicate)));

  // Named graphs are reachable via sd:defaultDataset / sd:availableGraphs -> sd:namedGraph -> sd:name
  const datasets = unique([
    ...services.flatMap((s) => index.values(s, SD + "defaultDataset")),
    ...services.flatMap((s) => index.values(s, SD + "availableGraphs")),
  ]);
  const namedGraphs = unique(
    datasets
      .flatMap((d) => index.values(d, SD + "namedGraph"))
      .flatMap((ng) => {
        const names = index.values(ng, SD + "name");
        return names.length ? names : [ng];
      }),
  );

  return {
    languages: collect("supportedLanguage"),
    features: collect("feature"),
    extensionFunctions: collect("extensionFunction"),
    extensionAggregates: collect("extensionAggregate"),
    resultFormats: collect("resultFormat"),
    inputFormats: collect("inputFormat"),
    entailmentRegimes: collect("defaultEntailmentRegime"),
    namedGraphs,
  };
}

function extractPartitions(index: QuadIndex, dataset: string, predicate: string, key: string): VoidPartition[] {
  const seen = new Set<string>();
  const partitions: VoidPartition[] = [];
  for (const partition of index.values(dataset, VOID + predicate)) {
    const iri = index.values(partition, VOID + key)[0];
    // The same partition may be described in both the service description and the VoID document
    if (!iri || seen.has(iri)) continue;
    seen.add(iri);
    partitions.push({
      iri,
      entities: index.number(partition, VOID + "entities"),
      triples: index.number(partition, VOID + "triples"),
    });
  }
  return partitions.sort((a, b) => (b.entities ?? b.triples ?? 0) - (a.entities ?? a.triples ?? 0)).slice(0, MAX_ITEMS);
}

export function extractVoidDatasets(quads: N3.Quad[]): VoidDataset[] {
  const index = new QuadIndex(quads);
  // Partitions are also typed void:Dataset; exclude those to only keep top-level datasets
  const partitions = new Set(
    quads
      .filter((q) => q.predicate.value === VOID + "classPartition" || q.predicate.value === VOID + "propertyPartition")
      .map((q) => q.object.value),
  );
  const candidates = unique([
    ...index.subjectsOfType(VOID + "Dataset"),
    ...index.subjectsWith(VOID + "triples"),
    ...index.subjectsWith(VOID + "sparqlEndpoint"),
  ]).filter((iri) => !partitions.has(iri) && index.values(iri, RDF_TYPE).indexOf(VOID + "Linkset") < 0);
  const linksets = index.subjectsWith(VOID + "subjectsTarget");

  const datasets: VoidDataset[] = candidates.map((iri) => ({
    iri,
    blank: index.blankNodes.has(iri) || undefined,
    title: index.values(iri, DCTERMS + "title")[0] || index.values(iri, RDFS_LABEL)[0],
    triples: index.number(iri, VOID + "triples"),
    entities: index.number(iri, VOID + "entities"),
    classes: index.number(iri, VOID + "classes"),
    properties: index.number(iri, VOID + "properties"),
    distinctSubjects: index.number(iri, VOID + "distinctSubjects"),
    distinctObjects: index.number(iri, VOID + "distinctObjects"),
    sparqlEndpoints: index.values(iri, VOID + "sparqlEndpoint"),
    vocabularies: unique(index.values(iri, VOID + "vocabulary")),
    classPartitions: extractPartitions(index, iri, "classPartition", "class"),
    propertyPartitions: extractPartitions(index, iri, "propertyPartition", "property"),
    linksets: linksets
      .filter((ls) => index.values(ls, VOID + "subjectsTarget").indexOf(iri) >= 0)
      .map((ls) => ({
        iri: ls,
        target: index.values(ls, VOID + "objectsTarget")[0],
        triples: index.number(ls, VOID + "triples"),
      })),
  }));
  // Only keep datasets that tell something about the data
  return datasets.filter(
    (d) =>
      d.title ||
      d.triples !== undefined ||
      d.entities !== undefined ||
      d.classes !== undefined ||
      d.properties !== undefined ||
      d.distinctSubjects !== undefined ||
      d.distinctObjects !== undefined ||
      d.vocabularies.length ||
      d.classPartitions.length ||
      d.propertyPartitions.length ||
      d.linksets.length,
  );
}

/**
 * Read a response body, stopping after maxBytes
 */
export async function readLimited(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body && typeof response.body.getReader === "function" ? response.body.getReader() : undefined;
  if (!reader) {
    const text = await response.text();
    return text.length > maxBytes ? { text: text.substring(0, maxBytes), truncated: true } : { text, truncated: false };
  }
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
    if (bytes >= maxBytes) {
      void reader.cancel().catch(() => undefined);
      return { text, truncated: true };
    }
  }
  return { text: text + decoder.decode(), truncated: false };
}

async function fetchRdf(url: string, init: FetchInit): Promise<{ quads: N3.Quad[]; truncated: boolean }> {
  const response = await fetch(url, {
    method: "GET",
    headers: { ...(init.headers || {}), Accept: RDF_ACCEPT },
    credentials: init.withCredentials ? "include" : "same-origin",
    mode: "cors",
    signal: init.signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  const { text, truncated } = await readLimited(response, MAX_METADATA_BYTES);
  const content = truncated ? cutAtLastStatement(text) : text;
  if (!content.trim()) throw new Error(truncated ? "Description too large" : "Empty response");
  return { quads: parseRdf(content, response.headers.get("Content-Type"), response.url || url), truncated };
}

export function getWellKnownVoidUrl(endpoint: string): string | undefined {
  try {
    return new URL("/.well-known/void", endpoint).toString();
  } catch {
    return undefined;
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TypeError") return "Not reachable (network or CORS error)";
    return e.message;
  }
  return String(e);
}

/**
 * Fetch the service description and VoID description of an endpoint.
 * Never throws (except when aborted): unavailable sources are flagged in the result.
 */
export async function fetchEndpointMetadata(endpoint: string, init: FetchInit = {}): Promise<EndpointMetadata> {
  const metadata: EndpointMetadata = {
    fetchedAt: Date.now(),
    sdStatus: "unavailable",
    voidStatus: "unavailable",
    datasets: [],
  };
  const isAbort = (e: unknown) => e instanceof Error && e.name === "AbortError";

  const voidUrl = getWellKnownVoidUrl(endpoint);
  const [sdResult, voidResult] = await Promise.allSettled([
    fetchRdf(endpoint, init),
    voidUrl ? fetchRdf(voidUrl, init) : Promise.reject(new Error("Invalid endpoint URL")),
  ]);
  if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  let sdQuads: N3.Quad[] = [];
  if (sdResult.status === "fulfilled") {
    sdQuads = sdResult.value.quads;
    if (sdResult.value.truncated) metadata.truncated = true;
    metadata.sd = extractServiceDescription(sdQuads);
    if (metadata.sd) metadata.sdStatus = "ok";
    else metadata.sdError = "No service description found in the response";
  } else if (!isAbort(sdResult.reason)) {
    metadata.sdError = errorMessage(sdResult.reason);
  }

  let voidQuads: N3.Quad[] = [];
  if (voidResult.status === "fulfilled") {
    voidQuads = voidResult.value.quads;
    if (voidResult.value.truncated) metadata.truncated = true;
  } else if (!isAbort(voidResult.reason)) {
    metadata.voidError = errorMessage(voidResult.reason);
  }
  // A service description may embed VoID statistics as well
  metadata.datasets = extractVoidDatasets([...sdQuads, ...voidQuads]);
  if (metadata.datasets.length > 0) {
    metadata.voidStatus = "ok";
    delete metadata.voidError;
  } else if (!metadata.voidError) {
    metadata.voidError = "No VoID dataset description found";
  }
  return metadata;
}
