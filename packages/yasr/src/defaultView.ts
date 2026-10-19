/**
 * Picking a result view from a query comment, as the Wikidata Query Service does:
 *
 *   #defaultView:Map
 *   SELECT ?item ?geo WHERE { ... }
 *
 * The comment may be on any full comment line of the query. The keyword is
 * case-insensitive and whitespace around the colon is allowed.
 */

const DEFAULT_VIEW_REGEX = /^\s*#\s*defaultView\s*:\s*([A-Za-z][\w-]*)/i;

/**
 * Wikidata Query Service view names that map onto a MatGUI plugin with another name.
 * Keys are lower case.
 */
const VIEW_ALIASES: { [view: string]: string } = {
  map: "Geo",
  linechart: "Chart",
  barchart: "Chart",
  scatterchart: "Chart",
  areachart: "Chart",
  bubblechart: "Chart",
  chart: "Chart",
  graph: "Graph",
  table: "Table",
};

/** The view named by the first `#defaultView:<name>` comment line in `query`, if any. */
export function getDefaultViewFromQuery(query: string | undefined): string | undefined {
  if (!query) return undefined;
  for (const line of query.split(/\r?\n/)) {
    const match = DEFAULT_VIEW_REGEX.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Resolve a view name to one of the available plugin names: an exact (case-insensitive)
 * plugin name first, then a plugin label, then a Wikidata view alias.
 */
export function resolveViewToPlugin(
  view: string,
  plugins: { [name: string]: { label?: string } | undefined },
): string | undefined {
  const wanted = view.toLowerCase();
  const names = Object.keys(plugins).filter((name) => !!plugins[name]);
  const byName = names.find((name) => name.toLowerCase() === wanted);
  if (byName) return byName;
  const byLabel = names.find((name) => plugins[name]?.label?.toLowerCase() === wanted);
  if (byLabel) return byLabel;
  const alias = VIEW_ALIASES[wanted];
  if (alias && names.indexOf(alias) >= 0) return alias;
  return undefined;
}
