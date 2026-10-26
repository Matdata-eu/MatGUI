/**
 * Finds the SPARQL Anything sources of a query: `SERVICE <x-sparql-anything:...> { ... }` blocks, with the options
 * given in the service IRI (`location=...,csv.headers=true`) and as `fx:properties fx:<option> <value>` triples
 * inside the block. Pure text scanning, no network: Yasgui uses the result to probe the source on the endpoint.
 */

export const FX_NAMESPACE = "http://sparql.xyz/facade-x/ns/";
export const XYZ_NAMESPACE = "http://sparql.xyz/facade-x/data/";
const SERVICE_SCHEME = "x-sparql-anything:";
/** Options that name what is triplified; a source without one of these cannot be probed */
const INPUT_OPTIONS = ["location", "content", "command", "query"];

export type SparqlAnythingFormat = "csv" | "json" | "xml" | "other";

/** An option written as a triple in the SERVICE block: `fx:properties fx:<name> <value>` */
export interface SparqlAnythingOptionTriple {
  name: string;
  /** The object as written in the query, e.g. `"people.csv"`, `true` or `?file` */
  raw: string;
  /** The value without quotes, or undefined when the object is a variable */
  value: string | undefined;
}

export interface SparqlAnythingSource {
  /** Identifies the source and its options, e.g. for caching what was fetched for it */
  key: string;
  /** The service IRI without angle brackets */
  serviceIri: string;
  silent: boolean;
  /** Offset of the SERVICE keyword */
  from: number;
  /** Offset after the closing brace (or the end of the query when the block is not closed) */
  to: number;
  /** Offsets of the `{` and `}` of the block */
  openBrace: number;
  closeBrace: number | undefined;
  closed: boolean;
  /** Options of the service IRI and the option triples, the triples taking precedence */
  options: { [name: string]: string };
  optionTriples: SparqlAnythingOptionTriple[];
  /** Options whose value is a variable, so not known before the query runs */
  variableOptions: string[];
  /** Whether the block is closed and names its input (location, content, ...), so it can be probed */
  ready: boolean;
  /** Short name for the source, e.g. the file name of the location */
  label: string;
  format: SparqlAnythingFormat;
  /** Namespace of the properties and types generated from the data (option `namespace`) */
  namespace: string;
}

interface Token {
  type: "iri" | "string" | "word" | "punct";
  text: string;
  from: number;
  to: number;
}

const IRI_REF = /<[^<>"{}|^`\\\u0000- ]*>/y;
const WORD = /[^\s{}()[\];,<>"'#=!|&*/+^]+/y;

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const length = query.length;
  while (i < length) {
    const ch = query[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === "#") {
      const end = query.indexOf("\n", i);
      i = end < 0 ? length : end + 1;
    } else if (ch === '"' || ch === "'") {
      const long = query.startsWith(ch.repeat(3), i);
      const quote = long ? ch.repeat(3) : ch;
      let j = i + quote.length;
      while (j < length && !query.startsWith(quote, j)) {
        if (query[j] === "\\") j++;
        else if (!long && query[j] === "\n") break;
        j++;
      }
      const end = Math.min(length, j + quote.length);
      tokens.push({ type: "string", text: query.substring(i, end), from: i, to: end });
      i = end;
    } else if (ch === "<") {
      IRI_REF.lastIndex = i;
      const match = IRI_REF.exec(query);
      const end = match ? i + match[0].length : i + 1;
      tokens.push({ type: match ? "iri" : "punct", text: query.substring(i, end), from: i, to: end });
      i = end;
    } else {
      WORD.lastIndex = i;
      const match = WORD.exec(query);
      if (match && match[0].length) {
        let text = match[0];
        // A trailing dot ends a triple (`?s ?p ?o.`), it is not part of a name
        while (text.length > 1 && text.endsWith(".") && !/^[+-]?\d*\.?\d+$/.test(text)) text = text.slice(0, -1);
        tokens.push({ type: "word", text, from: i, to: i + text.length });
        i += text.length;
      } else {
        tokens.push({ type: "punct", text: ch, from: i, to: i + 1 });
        i++;
      }
    }
  }
  return tokens;
}

function declaredPrefixes(tokens: Token[]): { [prefix: string]: string } {
  const prefixes: { [prefix: string]: string } = {};
  for (let i = 0; i + 2 < tokens.length; i++) {
    if (tokens[i].type !== "word" || tokens[i].text.toUpperCase() !== "PREFIX") continue;
    const name = tokens[i + 1];
    const iri = tokens[i + 2];
    if (name.type === "word" && name.text.endsWith(":") && iri.type === "iri") {
      prefixes[name.text.slice(0, -1)] = iri.text.slice(1, -1);
    }
  }
  return prefixes;
}

/** The full IRI of an IRI or prefixed name token, if it is one */
function expand(token: Token | undefined, prefixes: { [prefix: string]: string }): string | undefined {
  if (!token) return undefined;
  if (token.type === "iri") return token.text.slice(1, -1);
  if (token.type !== "word" || token.text[0] === "?" || token.text[0] === "$") return undefined;
  const colon = token.text.indexOf(":");
  if (colon < 0) return undefined;
  const namespace = prefixes[token.text.substring(0, colon)];
  return namespace === undefined ? undefined : namespace + token.text.substring(colon + 1);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The options in a service IRI: `x-sparql-anything:location=data.csv,csv.headers=true`. A value without a name is
 * the location (`x-sparql-anything:data.csv`). Commas in values are escaped as `\,`.
 */
export function parseServiceIriOptions(serviceIri: string): { [name: string]: string } {
  const options: { [name: string]: string } = {};
  if (!serviceIri.startsWith(SERVICE_SCHEME)) return options;
  const body = serviceIri.substring(SERVICE_SCHEME.length);
  if (!body) return options;
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === ",") {
      current += ",";
      i++;
    } else if (body[i] === ",") {
      parts.push(current);
      current = "";
    } else {
      current += body[i];
    }
  }
  parts.push(current);
  for (const part of parts) {
    if (!part) continue;
    const equals = part.indexOf("=");
    if (equals < 0) {
      if (options.location === undefined) options.location = safeDecode(part);
      continue;
    }
    options[part.substring(0, equals).trim()] = safeDecode(part.substring(equals + 1));
  }
  return options;
}

/** The value of an option object: the text of a literal, an IRI, a number or boolean; undefined for a variable */
function objectValue(token: Token): string | undefined {
  if (token.type === "string") {
    const quote = token.text.startsWith('"""') || token.text.startsWith("'''") ? 3 : 1;
    return token.text
      .substring(quote, token.text.length - quote)
      .replace(/\\(.)/g, (_match, c: string) => ({ n: "\n", t: "\t", r: "\r" })[c] ?? c);
  }
  if (token.type === "iri") return token.text.slice(1, -1);
  if (token.text[0] === "?" || token.text[0] === "$") return undefined;
  return token.text;
}

/**
 * Reads the `fx:properties fx:<option> <value> ; ...` triples of a SERVICE block.
 */
function readOptionTriples(
  query: string,
  body: Token[],
  prefixes: { [prefix: string]: string },
): SparqlAnythingOptionTriple[] {
  const triples: SparqlAnythingOptionTriple[] = [];
  for (let i = 0; i < body.length; i++) {
    if (expand(body[i], prefixes) !== FX_NAMESPACE + "properties") continue;
    let j = i + 1;
    while (j + 1 < body.length) {
      const predicate = expand(body[j], prefixes);
      if (!predicate || !predicate.startsWith(FX_NAMESPACE)) break;
      const object = body[j + 1];
      if (object.type === "punct") break;
      let end = j + 2;
      // Language tag or datatype of a literal
      if (object.type === "string" && body[end] && body[end].from === object.to) {
        if (body[end].text.startsWith("@")) end++;
        else if (body[end].text.startsWith("^^")) end++;
        else if (body[end].text === "^" && body[end + 1]?.text === "^") end += 3;
      }
      triples.push({
        name: predicate.substring(FX_NAMESPACE.length),
        raw: query.substring(object.from, body[end - 1].to),
        value: objectValue(object),
      });
      j = end;
      if (body[j]?.text !== ";") break;
      while (body[j]?.text === ";") j++;
    }
    i = j;
  }
  return triples;
}

function fileName(location: string): string {
  const path = location.split(/[?#]/)[0].replace(/[/\\]+$/, "");
  const name = path.substring(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  return safeDecode(name) || location;
}

function detectFormat(options: { [name: string]: string }): SparqlAnythingFormat {
  const hint = [options["media-type"], options.triplifier].filter(Boolean).join(" ").toLowerCase();
  if (/csv|tab-separated/.test(hint)) return "csv";
  if (/json/.test(hint)) return "json";
  if (/xml|html/.test(hint)) return "xml";
  const name = options.location ? fileName(options.location).toLowerCase() : "";
  const extension = name.includes(".") ? name.substring(name.lastIndexOf(".") + 1) : "";
  if (["csv", "tsv", "tab"].includes(extension)) return "csv";
  if (["json", "jsonld", "geojson"].includes(extension)) return "json";
  if (["xml", "html", "htm", "xhtml", "rdf", "kml", "gml"].includes(extension)) return "xml";
  return "other";
}

function sourceLabel(options: { [name: string]: string }): string {
  if (options.location) return fileName(options.location);
  if (options.content !== undefined) return "inline content";
  if (options.command) return "command output";
  if (options.query) return fileName(options.query);
  return "SPARQL Anything source";
}

/**
 * The SPARQL Anything SERVICE blocks of a query, in document order.
 */
export function findSparqlAnythingSources(query: string): SparqlAnythingSource[] {
  if (query.indexOf(SERVICE_SCHEME) < 0) return [];
  const tokens = tokenize(query);
  const prefixes = declaredPrefixes(tokens);
  const sources: SparqlAnythingSource[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "word" || tokens[i].text.toUpperCase() !== "SERVICE") continue;
    let j = i + 1;
    const silent = tokens[j]?.type === "word" && tokens[j].text.toUpperCase() === "SILENT";
    if (silent) j++;
    const iriToken = tokens[j];
    const serviceIri = expand(iriToken, prefixes);
    if (!serviceIri || !serviceIri.startsWith(SERVICE_SCHEME)) continue;
    const open = tokens[j + 1];
    if (!open || open.text !== "{") continue;
    let depth = 0;
    let close: number | undefined;
    for (let k = j + 1; k < tokens.length; k++) {
      if (tokens[k].text === "{") depth++;
      else if (tokens[k].text === "}" && --depth === 0) {
        close = k;
        break;
      }
    }
    const body = tokens.slice(j + 2, close ?? tokens.length);
    const optionTriples = readOptionTriples(query, body, prefixes);
    const options = parseServiceIriOptions(serviceIri);
    const variableOptions: string[] = [];
    for (const triple of optionTriples) {
      if (triple.value === undefined) {
        variableOptions.push(triple.name);
        delete options[triple.name];
      } else {
        options[triple.name] = triple.value;
      }
    }
    const closed = close !== undefined;
    const hasInput = INPUT_OPTIONS.some((name) => options[name] !== undefined);
    const key = [serviceIri, ...optionTriples.map((t) => `${t.name}=${t.raw}`).sort()].join("\n");
    sources.push({
      key,
      serviceIri,
      silent,
      from: tokens[i].from,
      to: close !== undefined ? tokens[close].to : query.length,
      openBrace: open.from,
      closeBrace: close !== undefined ? tokens[close].from : undefined,
      closed,
      options,
      optionTriples,
      variableOptions,
      ready: closed && hasInput,
      label: sourceLabel(options),
      format: detectFormat(options),
      namespace: options.namespace || XYZ_NAMESPACE,
    });
    // Nested SERVICE blocks are not valid SPARQL Anything usage; continue after this block
    if (close !== undefined) i = close;
  }
  return sources;
}

/**
 * The source whose block holds the offset, if any.
 */
export function sparqlAnythingSourceAt(
  sources: SparqlAnythingSource[],
  offset: number,
): SparqlAnythingSource | undefined {
  return sources.find((source) => offset > source.openBrace && offset <= (source.closeBrace ?? Infinity));
}
