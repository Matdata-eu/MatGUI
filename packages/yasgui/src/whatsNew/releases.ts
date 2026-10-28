/**
 * Release notes shown in "What's new" (help menu of the top bar), newest first.
 * Keep the entries short and written for users; developer-only changes stay in the GitHub release notes.
 * Add the next release at the top when it is prepared.
 */
export type ChangeKind = "new" | "improved" | "fixed";

export interface ReleaseChange {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  version: string;
  /** Release date, YYYY-MM-DD */
  date?: string;
  /** One line summary of the release */
  summary?: string;
  changes: ReleaseChange[];
}

const n = (text: string): ReleaseChange => ({ kind: "new", text });
const i = (text: string): ReleaseChange => ({ kind: "improved", text });
const f = (text: string): ReleaseChange => ({ kind: "fixed", text });

export const releases: Release[] = [
  {
    version: "6.12.0",
    summary: "Redesigned settings, and this What's new.",
    changes: [
      n("What's new in the help menu, with a dot on the help button when there is a release you haven't seen"),
      i("Redesigned settings: grouped pages, one row per setting, and changes apply at once"),
      n("General settings page with the theme (Light, Dark or System), request settings and checks before running"),
      i("Request method, Accept headers and custom HTTP headers now apply to every tab"),
      i("AI services: pick a provider, fetch its models and search them, with help when the browser can't reach it"),
      i("SPARQL Anything: Load structure opens the Source view, and Build query has an All checkbox and a compact bar"),
    ],
  },
  {
    version: "6.11.0",
    date: "2026-10-27",
    summary: "Query CSV, JSON and XML files with SPARQL Anything without opening them first.",
    changes: [
      n("SPARQL Anything sources: Load structure on a SERVICE block reads the file through your endpoint"),
      n("Autocompletion suggests the columns, keys and XML elements of a loaded source"),
      n("Source view in the side panel with the structure, a preview and a query builder"),
      n("The xyz:, fx: and fxe: vocabularies and the fx: functions are suggested in autocompletion"),
    ],
  },
  {
    version: "6.10.0",
    date: "2026-10-24",
    summary: "An AI assistant, and the execution plan of your query.",
    changes: [
      n("AI assistant: write a query from a question, explain or fix the query, and explain the results"),
      n("Fix with AI and Copy for AI on query errors, and Why no results? on empty results"),
      n("AI services from any OpenAI-compatible provider in Settings > AI; without one, copy a ready-made prompt"),
      n("Explain view: the execution plan of QLever, GraphDB, Stardog, Blazegraph and Neptune, and the SPARQL algebra"),
      n("railML 3 and RailTopoModel terms in autocompletion"),
      i("The Response view has an icon matching the other views"),
    ],
  },
  {
    version: "6.9.0",
    date: "2026-10-20",
    summary: "The editor now knows your endpoint.",
    changes: [
      n("Autocompletion suggests the classes and properties your endpoint uses, most used first"),
      n("Hover an IRI in the editor to see its label, description, type, domain and range"),
      n("A #defaultView:<view> comment opens the results in that view"),
      i("Linked Open Vocabularies suggestions work again, from a bundled list that includes the ERA ontology"),
      f("Even spacing around the icon bar of the side panel"),
      f("Selected text in the default light editor theme is visible"),
    ],
  },
  {
    version: "6.8.0",
    date: "2026-10-18",
    summary: "A lighter, calmer MatGUI with a search for everything.",
    changes: [
      n("Search with Ctrl+K: saved queries, snippets, commands and settings"),
      n("One card per query, with its title, breadcrumbs and saved status"),
      n("Editor toolbar with Prefixes, Insert, Share, Format, Save, Download and full screen"),
      n("Describe panel can be resized, floated as a window or maximized"),
      i("Side panel keeps an icon bar on the left; Ctrl+B shows or hides it"),
      i("New look: pill tabs, the Geist font and quieter colours, in light and dark"),
      f("Full screen results stay below the top bar"),
    ],
  },
  {
    version: "6.7.0",
    date: "2026-10-17",
    summary: "A new look in the MatData style.",
    changes: [
      n("Top bar with the tabs, help, theme and settings"),
      n("Query bar with an endpoint picker and Run next to it; Run turns into Stop while a query runs"),
      n("One side panel with the saved queries and the endpoint overview"),
      n("Shared describe panel for all viewers, with back and forward"),
      i("Code snippets in one Insert menu with search"),
      i("All viewers put their controls in the same toolbar under the results"),
    ],
  },
  {
    version: "6.6.0",
    date: "2026-10-07",
    changes: [
      n("Describe in the table: Ctrl+click an IRI in the result to hop to it"),
      n("Back and forward (Alt+← / Alt+→) through describe hops in the table and the map"),
    ],
  },
  {
    version: "6.5.0",
    date: "2026-10-06",
    changes: [
      n("Workspaces can be read-only"),
      f("Map labels and hover colour no longer stick on geometry collections"),
    ],
  },
  {
    version: "6.4.1",
    date: "2026-10-06",
    changes: [f("A font was missing from the package")],
  },
  {
    version: "6.4.0",
    date: "2026-10-06",
    changes: [
      n("Map: Ctrl+click to describe a feature, hover highlighting and labels"),
      n("Map: no-basemap option, keyless background maps and the OpenRailwayMap overlay"),
      f("Map popups keep long IRIs and geometries inside the popup"),
      f("Table: the right-click IRI menu works on shortened IRIs"),
    ],
  },
  {
    version: "6.3.0",
    date: "2026-09-30",
    changes: [
      n("Endpoint overview (F8): service description, statistics, classes, properties, graphs and more"),
      n("SPARQL 1.2 syntax in the editor: triple terms, reifiers, annotations and the new functions"),
      i("Formatting with @matdata/sparql-formatter, which supports SPARQL 1.2 and keeps comments"),
    ],
  },
  {
    version: "6.2.0",
    date: "2026-09-29",
    changes: [f("Several small fixes in the table and graph viewers")],
  },
  {
    version: "6.1.0",
    date: "2026-09-13",
    changes: [
      n("Table: fixed number of decimal places for decimal and floating point values"),
      n("Table: Ctrl+click or right-click an IRI to describe it"),
      f("Map: empty geometries, mixed coordinate systems and zooming after a reload"),
    ],
  },
  {
    version: "6.0.0",
    date: "2026-09-12",
    summary: "Yasgui is now MatGUI, with a new editor.",
    changes: [
      n("Rebrand to MatGUI; nothing changes for your saved queries and settings"),
      n("New query editor built on CodeMirror 6"),
      n("Ctrl+click an IRI to see its triples as subject, Ctrl+Shift+click as object"),
      f("The results no longer collapse to zero height and scroll for large results"),
      f("The layout mode is kept after a reload and across tabs"),
    ],
  },
  {
    version: "5.20.0",
    date: "2026-05-21",
    changes: [
      n("New map viewer with more features"),
      f("Prefix completion no longer depends on prefix.cc being reachable"),
    ],
  },
  {
    version: "5.19.0",
    date: "2026-05-13",
    changes: [
      n("Map widget to draw a WKT point, line or polygon"),
      f("The map in the WKT widget has a height again (5.19.1)"),
    ],
  },
  {
    version: "5.18.0",
    date: "2026-05-11",
    changes: [
      n("Switch between tabs in most recently used order with a shortcut"),
      n("Version history of managed queries"),
      n("Copy URI in the saved query browser"),
      i("Endpoints in the settings are sorted alphabetically"),
      f("Persisted prefixes are no longer duplicated"),
      f("Ctrl+click describe works in update mode"),
    ],
  },
  {
    version: "5.17.0",
    date: "2026-02-28",
    changes: [
      n("Graph: double-click a resource to expand the graph"),
      f("Background queries no longer overwrite the results"),
    ],
  },
  {
    version: "5.16.0",
    date: "2026-02-28",
    changes: [
      n("Move a managed query to another folder"),
      n("Save a query as a local .rq file"),
      n("Share a query as a PowerShell here-string"),
      i("Better on mobile; Copy tab is now Duplicate tab"),
      f("Tabs can be dragged in Vivaldi"),
    ],
  },
  {
    version: "5.15.0",
    date: "2026-02-07",
    changes: [
      i("Editor buttons moved to the bottom of the editor and work better on small screens"),
      n("Pick an existing workspace IRI when creating a SPARQL workspace"),
      f("Windows no longer close when you release the mouse outside them"),
      f("Relative endpoint URLs and quick describe of prefixed IRIs"),
    ],
  },
  {
    version: "5.14.0",
    date: "2026-01-12",
    changes: [f("Custom headers can be added to the request again")],
  },
  {
    version: "5.13.0",
    date: "2026-01-12",
    changes: [
      n("Rainbow brackets and a GitHub dark editor theme in dark mode"),
      i("Clear feedback when a workspace is not configured correctly"),
      i("Git workspaces save queries as .rq files"),
    ],
  },
  {
    version: "5.12.0",
    date: "2026-01-06",
    changes: [i("Better dark theme"), n("Choose the editor theme for light and dark mode")],
  },
  {
    version: "5.11.0",
    date: "2026-01-01",
    summary: "Save your queries to a SPARQL endpoint or a Git repository.",
    changes: [n("Workspaces and managed queries"), i("New icons and buttons")],
  },
  {
    version: "5.10.0",
    date: "2025-12-21",
    changes: [
      n("Share as PowerShell or wget, and shorten the share link"),
      n("A warning when a shared command contains credentials"),
      f("The table switches between short and full IRIs again (5.10.1)"),
    ],
  },
  {
    version: "5.9.0",
    date: "2025-12-19",
    changes: [
      n("Turn off endpoint buttons configured by the site"),
      i("Endpoint buttons that don't fit go into a dropdown"),
      f("Renaming tabs: arrow keys, selecting text and Delete behave as expected"),
      f("Tab context menu size and editor border in dark mode"),
    ],
  },
  {
    version: "5.8.0",
    date: "2025-12-18",
    changes: [
      n("Resizer between the editor and results in side-by-side layout"),
      i("Table and graph fill the available space"),
      f("Long queries scroll in side-by-side layout"),
    ],
  },
  {
    version: "5.7.0",
    date: "2025-12-16",
    changes: [
      i("New table viewer built on Tabulator"),
      n("OAuth 2.0, bearer token and API key authentication"),
      n("Clear the stored data"),
      i("Clearer messages for CORS errors"),
      f("Commenting with the keyboard works with the formatter"),
    ],
  },
  {
    version: "5.5.0",
    date: "2025-12-11",
    changes: [n("HTTP basic authentication per endpoint"), i("Settings with a navigation on the left")],
  },
  {
    version: "5.4.0",
    date: "2025-12-11",
    changes: [
      n("Code snippets in the editor"),
      n("Keyboard shortcuts and About in the settings"),
      i("Table: IRI and datatype toggles, copy as Markdown"),
      f("The layout mode applies to all tabs"),
    ],
  },
  {
    version: "5.3.0",
    date: "2025-12-10",
    changes: [
      n("Export and import your configuration"),
      n("Query formatter, optionally formatting before each run"),
      n("Undeclared variables in CONSTRUCT templates are highlighted"),
      n("User and developer guide"),
    ],
  },
  {
    version: "5.2.0",
    date: "2025-12-08",
    changes: [
      n("Side-by-side layout of the editor and results"),
      n("Quick switch buttons for endpoints"),
      f("Dark mode for the tab list and the control bar"),
      f("ASK results"),
    ],
  },
  {
    version: "5.1.0",
    date: "2025-12-07",
    changes: [n("Dark mode with a theme toggle"), n("A hint about quick describe when the cursor is on an IRI")],
  },
  {
    version: "5.0.0",
    date: "2025-12-06",
    changes: [
      n("Graph viewer for RDF results"),
      n("Map viewer for geographical data"),
      n("Ctrl+click an IRI to describe it"),
      n("Prefixes are added and remembered automatically"),
      n("Full screen editor and results"),
      i("Turtle is the default Accept header for CONSTRUCT and DESCRIBE"),
    ],
  },
];

/** Compare two versions like "6.10.0"; negative when a is older than b */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  const pb = b.split(/[.-]/).map((part) => parseInt(part, 10) || 0);
  for (let k = 0; k < Math.max(pa.length, pb.length); k++) {
    const diff = (pa[k] || 0) - (pb[k] || 0);
    if (diff) return diff;
  }
  return 0;
}
