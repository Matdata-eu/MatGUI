/**
 * Class and property suggestions from a bundled list of Linked Open Vocabularies (LOV) terms,
 * generated from the LOV dump by fetchLovData.js. No requests are made at runtime.
 */
import type { AutocompletionToken, EndpointTerm } from "./";
import lovTermsJson from "../lov-terms.json";

/**
 * The bundled LOV terms: namespaces, most used first, as [namespace, prefix, classes, properties, functions?],
 * where classes, properties and functions are space separated local names. Functions are only listed for the
 * always included vocabularies that define them, such as SPARQL Anything (fx:entity...).
 */
export interface LovTerms {
  source?: string;
  generated?: string;
  namespaces: Array<[string, string, string, string] | [string, string, string, string, string]>;
}

export const bundledLovTerms = lovTermsJson as LovTerms;

const LOV_SUGGESTIONS_LIMIT = 50;

interface IndexedTerm extends EndpointTerm {
  local: string;
  lowerIri: string;
  lowerPrefixed?: string;
}
export type LovTermType = "class" | "property" | "function";
type Index = { [type in LovTermType]: IndexedTerm[] };

const indexes = new WeakMap<LovTerms, Index>();

function getIndex(terms: LovTerms): Index {
  let index = indexes.get(terms);
  if (index) return index;
  index = { class: [], property: [], function: [] };
  for (const [namespace, prefix, classes, properties, functions] of terms.namespaces || []) {
    const add = (list: IndexedTerm[], locals: string) => {
      if (!locals) return;
      for (const local of locals.split(" ")) {
        const iri = namespace + local;
        list.push({
          iri,
          local: local.toLowerCase(),
          prefix: prefix || undefined,
          namespace,
          lowerIri: iri.toLowerCase(),
          lowerPrefixed: prefix ? `${prefix}:${local}`.toLowerCase() : undefined,
        });
      }
    };
    add(index.class, classes);
    add(index.property, properties);
    if (functions) add(index.function, functions);
  }
  indexes.set(terms, index);
  return index;
}

/**
 * The LOV terms matching what the user typed: the full IRI or prefixed name it starts with, or, for a plain word,
 * local names starting with it first and then local names containing it. Terms of the most used vocabularies come first.
 */
export function searchLov(
  terms: LovTerms,
  type: LovTermType,
  token: AutocompletionToken,
  limit = LOV_SUGGESTIONS_LIMIT,
): EndpointTerm[] {
  const typed = (token.string || "").trim().toLowerCase();
  if (!typed) return [];
  const iriString = (token.autocompletionString || "").trim().toLowerCase().replace(/^</, "");
  const plainWord = typed.indexOf(":") < 0 && typed.indexOf("<") < 0;
  const starts: EndpointTerm[] = [];
  const contains: EndpointTerm[] = [];
  for (const term of getIndex(terms)[type]) {
    if (plainWord) {
      const at = term.local.indexOf(typed);
      if (at === 0) starts.push(term);
      else if (at > 0 && contains.length < limit) contains.push(term);
    } else if (
      (iriString && term.lowerIri.indexOf(iriString) === 0) ||
      (term.lowerPrefixed && term.lowerPrefixed.indexOf(typed) === 0)
    ) {
      starts.push(term);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit).map(({ iri, prefix, namespace }) => ({ iri, prefix, namespace }));
}
