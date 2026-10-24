/**
 * Check queries: small read-only queries the model may run on the endpoint (the `run_sparql` tool) to verify
 * class and property names before it answers. Only SELECT and ASK queries are allowed, with a small LIMIT.
 */

export const CHECK_QUERY_LIMIT = 20;
const MAX_VALUE_LENGTH = 200;

/** The query with comments, IRIs and string literals blanked out, so keywords inside them are not matched */
function stripLiterals(query: string): string {
  return (
    query
      .replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, '""')
      .replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, '""')
      .replace(/<[^<>\s"{}|^`\\]*>/g, "<>")
      .replace(/#[^\n]*/g, "")
      // Variables and prefixed names, so e.g. ?copy or ex:Create is not taken for an update keyword
      .replace(/[?$][\w\u00b7-\uffff]+/g, "?v")
      .replace(/[A-Za-z][\w.-]*:[\w.%-]*|:[\w.%-]+/g, "p:n")
  );
}

const UPDATE_KEYWORDS = /\b(INSERT|DELETE|LOAD|CLEAR|DROP|CREATE|ADD|MOVE|COPY|WITH)\b/i;

export type CheckQueryResult = { ok: true; query: string } | { ok: false; reason: string };

/**
 * Validates a check query and makes sure it returns at most [[CHECK_QUERY_LIMIT]] rows: a missing LIMIT is
 * added and a larger one is lowered.
 */
export function prepareCheckQuery(query: string, limit = CHECK_QUERY_LIMIT): CheckQueryResult {
  const trimmed = (query || "").trim();
  if (!trimmed) return { ok: false, reason: "The query is empty." };
  const bare = stripLiterals(trimmed);
  if (UPDATE_KEYWORDS.test(bare)) return { ok: false, reason: "Only read-only SELECT and ASK queries are allowed." };
  const form = bare.match(/\b(SELECT|ASK|CONSTRUCT|DESCRIBE)\b/i)?.[1]?.toUpperCase();
  if (form !== "SELECT" && form !== "ASK") {
    return { ok: false, reason: "Only SELECT and ASK queries are allowed as check queries." };
  }
  if (form === "ASK") return { ok: true, query: trimmed };
  // The LIMIT of the outer query is at the end, possibly followed by OFFSET
  const tail = bare.match(/\bLIMIT\s+(\d+)(\s+OFFSET\s+\d+)?\s*$/i);
  if (!tail) return { ok: true, query: `${trimmed}\nLIMIT ${limit}` };
  if (Number(tail[1]) <= limit) return { ok: true, query: trimmed };
  // Lower the last LIMIT of the query
  const index = trimmed.search(new RegExp(`\\bLIMIT\\s+${tail[1]}(?![\\s\\S]*\\bLIMIT\\s+\\d)`, "i"));
  if (index < 0) return { ok: true, query: `${trimmed}\nLIMIT ${limit}` };
  return {
    ok: true,
    query: trimmed.slice(0, index) + trimmed.slice(index).replace(/LIMIT\s+\d+/i, `LIMIT ${limit}`),
  };
}

export interface TermValue {
  type: string;
  value: string;
  "xml:lang"?: string;
  datatype?: string;
}

/** One RDF term in a compact, Turtle-like notation */
export function formatTerm(term: TermValue | undefined, maxLength = MAX_VALUE_LENGTH): string {
  if (!term) return "";
  let value = term.value ?? "";
  if (value.length > maxLength) value = value.slice(0, maxLength) + "…";
  if (term.type === "uri") return `<${value}>`;
  if (term.type === "bnode") return `_:${value}`;
  const quoted = JSON.stringify(value);
  if (term["xml:lang"]) return `${quoted}@${term["xml:lang"]}`;
  if (term.datatype && !/#string$/.test(term.datatype)) return `${quoted}^^<${term.datatype}>`;
  return quoted;
}

/**
 * Result rows as a tab separated table, at most `maxRows` rows. Used both for check query results and for
 * "Explain results".
 */
export function formatBindings(
  vars: string[],
  bindings: Array<{ [variable: string]: TermValue }>,
  maxRows: number,
  maxValueLength = MAX_VALUE_LENGTH,
): string {
  if (!vars.length) return "(no variables)";
  const lines = [vars.map((v) => `?${v}`).join("\t")];
  for (const binding of bindings.slice(0, maxRows)) {
    lines.push(vars.map((v) => formatTerm(binding[v], maxValueLength)).join("\t"));
  }
  const more = bindings.length > maxRows ? `\n(${bindings.length - maxRows} more rows not shown)` : "";
  if (!bindings.length) return lines[0] + "\n(no rows)";
  return lines.join("\n") + more;
}
