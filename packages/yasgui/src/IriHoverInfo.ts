/**
 * Tooltip content for an IRI hovered in the query editor: its label, description and type, fetched with a small
 * background query against the endpoint of the tab (with its authentication), cached per endpoint and IRI.
 * When the endpoint doesn't describe the IRI, LOV (Linked Open Vocabularies) is tried for vocabulary terms.
 */
import { Parser } from "@matdata/yasr";
import type { IriAtPosition } from "@matdata/yasqe";
import type Tab from "./Tab";
import "./IriHoverInfo.scss";

const SPARQL_JSON = "application/sparql-results+json";
const LOV_ENDPOINT = "https://lov.linkeddata.es/dataset/lov/sparql";
const TIMEOUT_MS = 10000;
const MAX_CACHE_SIZE = 500;
const MAX_COMMENT_LENGTH = 280;

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const LABEL_PROPERTIES = [`${RDFS}label`, `${SKOS}prefLabel`];
const COMMENT_PROPERTIES = [`${RDFS}comment`, `${SKOS}definition`];
const TYPE = `${RDF}type`;
const DOMAIN = `${RDFS}domain`;
const RANGE = `${RDFS}range`;
const PROPERTIES = [...LABEL_PROPERTIES, ...COMMENT_PROPERTIES, TYPE, DOMAIN, RANGE];
// Used to shorten types, domains and ranges in addition to the prefixes of the query
const COMMON_PREFIXES: { [prefix: string]: string } = {
  rdf: RDF,
  rdfs: RDFS,
  owl: "http://www.w3.org/2002/07/owl#",
  skos: SKOS,
  xsd: "http://www.w3.org/2001/XMLSchema#",
  sh: "http://www.w3.org/ns/shacl#",
};

interface Literal {
  value: string;
  lang: string;
}

export interface IriInfo {
  labels: Literal[];
  comments: Literal[];
  types: string[];
  domains: string[];
  ranges: string[];
  /** Where the information came from */
  source: "endpoint" | "lov";
}

// Shared by all tabs: hovering the same IRI on the same endpoint doesn't query it again
const cache = new Map<string, Promise<IriInfo | undefined>>();

/** The query that fetches the label, description and type of an IRI. */
export function buildIriInfoQuery(iri: string, inAnyGraph = false): string {
  const triple = `<${iri}> ?p ?o .`;
  return [
    "SELECT ?p ?o WHERE {",
    `  VALUES ?p { ${PROPERTIES.map((p) => `<${p}>`).join(" ")} }`,
    inAnyGraph ? `  GRAPH ?g { ${triple} }` : `  ${triple}`,
    "} LIMIT 200",
  ].join("\n");
}

/** Group the ?p ?o bindings of the info query; undefined when the IRI isn't described at all. */
export function parseIriInfo(bindings: any[], source: IriInfo["source"]): IriInfo | undefined {
  const info: IriInfo = { labels: [], comments: [], types: [], domains: [], ranges: [], source };
  const addIri = (list: string[], value: string) => {
    if (!list.includes(value)) list.push(value);
  };
  for (const binding of bindings) {
    const p = binding.p?.value;
    const o = binding.o;
    if (!p || !o || typeof o.value !== "string") continue;
    const literal = { value: o.value, lang: (o["xml:lang"] || o.lang || "").toLowerCase() };
    if (LABEL_PROPERTIES.includes(p) && o.type !== "uri") info.labels.push(literal);
    else if (COMMENT_PROPERTIES.includes(p) && o.type !== "uri") info.comments.push(literal);
    else if (o.type === "uri" && p === TYPE) addIri(info.types, o.value);
    else if (o.type === "uri" && p === DOMAIN) addIri(info.domains, o.value);
    else if (o.type === "uri" && p === RANGE) addIri(info.ranges, o.value);
  }
  const empty = !info.labels.length && !info.comments.length && !info.types.length;
  return empty && !info.domains.length && !info.ranges.length ? undefined : info;
}

/** The literal in the most preferred language: the browser languages, then English, then without language tag. */
export function pickLiteral(literals: Literal[], languages: string[]): Literal | undefined {
  if (!literals.length) return undefined;
  const wanted = [...languages.map((l) => l.toLowerCase()), "en", ""];
  for (const lang of wanted) {
    const exact = literals.find((l) => l.lang === lang);
    if (exact) return exact;
    const base = lang.split("-")[0];
    const sameBase = base && literals.find((l) => l.lang.split("-")[0] === base);
    if (sameBase) return sameBase;
  }
  return literals[0];
}

async function runQuery(run: (signal: AbortSignal) => Promise<any>): Promise<any[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await run(controller.signal);
    const parser = new Parser(response, 0);
    if (parser.hasError()) throw new Error(parser.getError()?.text || "Query failed");
    return parser.getBindings() || [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFromLov(iri: string): Promise<IriInfo | undefined> {
  const url = `${LOV_ENDPOINT}?query=${encodeURIComponent(buildIriInfoQuery(iri, true))}`;
  const bindings = await runQuery(async (signal) => {
    const response = await fetch(url, { headers: { Accept: SPARQL_JSON }, signal });
    if (!response.ok) throw new Error(response.statusText);
    return { content: await response.text(), status: response.status, headers: response.headers };
  });
  return parseIriInfo(bindings, "lov");
}

async function fetchIriInfo(tab: Tab, iri: string, lovFallback: boolean): Promise<IriInfo | undefined> {
  const bindings = await runQuery((signal) =>
    tab.runBackgroundQuery(buildIriInfoQuery(iri), { accept: SPARQL_JSON, signal }),
  );
  const info = parseIriInfo(bindings, "endpoint");
  if (info || !lovFallback) return info;
  // LOV is a nice-to-have: a failure there just means there is nothing to show
  return fetchFromLov(iri).catch(() => undefined);
}

/** Cached lookup of the info of an IRI on the endpoint of the tab. A failed lookup is retried on the next hover. */
export function getIriInfo(tab: Tab, iri: string, lovFallback = true): Promise<IriInfo | undefined> {
  const key = `${tab.getEndpoint()}\n${iri}`;
  let info = cache.get(key);
  if (!info) {
    info = fetchIriInfo(tab, iri, lovFallback);
    info.catch(() => cache.delete(key));
    if (cache.size >= MAX_CACHE_SIZE) cache.delete(cache.keys().next().value as string);
    cache.set(key, info);
  }
  return info;
}

export function clearIriInfoCache() {
  cache.clear();
}

function languages(): string[] {
  return typeof navigator !== "undefined" ? [...(navigator.languages || []), navigator.language].filter(Boolean) : [];
}

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Shorten an IRI with the prefixes of the query, e.g. `rdfs:Class` */
function compact(iri: string, prefixes: { [prefix: string]: string }): string {
  let best: string | undefined;
  for (const prefix in prefixes) {
    const namespace = prefixes[prefix];
    if (!namespace || !iri.startsWith(namespace)) continue;
    const local = iri.slice(namespace.length);
    if (!/^[^\s/#?:]*$/.test(local)) continue;
    const candidate = `${prefix}:${local}`;
    if (!best || candidate.length < best.length) best = candidate;
  }
  return best || `<${iri}>`;
}

function renderInfo(container: HTMLElement, info: IriInfo | undefined, tab: Tab) {
  container.querySelector(".yasgui-iriHover__status")?.remove();
  const details = el("div", "yasgui-iriHover__details");
  if (!info) {
    details.appendChild(el("div", "yasgui-iriHover__status", "No label, description or type found on this endpoint."));
    container.insertBefore(details, container.lastChild);
    return;
  }
  const langs = languages();
  const label = pickLiteral(info.labels, langs);
  if (label) {
    const labelEl = el("div", "yasgui-iriHover__label", label.value);
    if (label.lang) labelEl.appendChild(el("span", "yasgui-iriHover__lang", label.lang));
    container.insertBefore(labelEl, container.firstChild);
  }
  const comment = pickLiteral(info.comments, langs);
  if (comment) details.appendChild(el("div", "yasgui-iriHover__comment", truncate(comment.value, MAX_COMMENT_LENGTH)));
  const prefixes = { ...COMMON_PREFIXES, ...(tab.getYasqe()?.getPrefixesFromQuery() || {}) };
  const rows: [string, string[]][] = [
    ["Type", info.types],
    ["Domain", info.domains],
    ["Range", info.ranges],
  ];
  for (const [name, values] of rows) {
    if (!values.length) continue;
    const row = el("div", "yasgui-iriHover__row");
    row.appendChild(el("span", "yasgui-iriHover__key", name));
    const shown = values.slice(0, 5).map((value) => compact(value, prefixes));
    if (values.length > 5) shown.push(`+${values.length - 5} more`);
    row.appendChild(el("span", "yasgui-iriHover__value", shown.join(", ")));
    details.appendChild(row);
  }
  if (info.source === "lov") details.appendChild(el("div", "yasgui-iriHover__source", "Description from LOV"));
  container.insertBefore(details, container.lastChild);
}

/** The tooltip for an IRI hovered in the editor of the tab. */
export function createIriHover(tab: Tab, iri: IriAtPosition, lovFallback = true): HTMLElement | undefined {
  if (!iri.expanded) return undefined;
  const container = el("div", "yasgui-iriHover");
  if (iri.text !== `<${iri.iri}>`) container.appendChild(el("div", "yasgui-iriHover__iri", iri.iri));
  container.appendChild(el("div", "yasgui-iriHover__status", "Loading…"));
  container.appendChild(
    el("div", "yasgui-iriHover__hint", "Ctrl+click: triples with this IRI as subject. Ctrl+Shift+click: as object."),
  );
  getIriInfo(tab, iri.iri, lovFallback).then(
    (info) => {
      renderInfo(container, info, tab);
    },
    () => {
      const status = container.querySelector(".yasgui-iriHover__status");
      if (status) status.textContent = "Couldn't load information from this endpoint.";
    },
  );
  return container;
}
