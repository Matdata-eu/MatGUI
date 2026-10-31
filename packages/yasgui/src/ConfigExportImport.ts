/**
 * Export/Import Configuration Module
 * Handles serialization and deserialization of Matgui configuration to/from RDF Turtle format
 */

import * as N3 from "n3";
import type { PersistedJson } from "./PersistentConfig";

// Matgui Configuration Ontology
export const YASGUI_NS = "https://yasgui.matdata.eu/ontology#";
export const RDF_NS = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS_NS = "http://www.w3.org/2000/01/rdf-schema#";
export const XSD_NS = "http://www.w3.org/2001/XMLSchema#";
export const DCTERMS_NS = "http://purl.org/dc/terms/";
export const SD_NS = "http://www.w3.org/ns/sparql-service-description#";
export const SP_NS = "http://spinrdf.org/sp#";
export const HTTP_NS = "http://www.w3.org/2011/http#";
export const SCHEMA_NS = "https://schema.org/";

/**
 * Serialize configuration to Turtle format
 */
export function serializeToTurtle(config: PersistedJson): string {
  const lines: string[] = [];

  // Prefixes
  lines.push(`@prefix yasgui: <${YASGUI_NS}> .`);
  lines.push(`@prefix rdf: <${RDF_NS}> .`);
  lines.push(`@prefix rdfs: <${RDFS_NS}> .`);
  lines.push(`@prefix xsd: <${XSD_NS}> .`);
  lines.push(`@prefix dcterms: <${DCTERMS_NS}> .`);
  lines.push(`@prefix sd: <${SD_NS}> .`);
  lines.push(`@prefix sp: <${SP_NS}> .`);
  lines.push(`@prefix http: <${HTTP_NS}> .`);
  lines.push(`@prefix schema: <${SCHEMA_NS}> .`);
  lines.push("");

  // Main configuration node
  const now = new Date().toISOString();
  lines.push(`[] a yasgui:Configuration ;`);
  lines.push(`  dcterms:created "${now}"^^xsd:dateTime ;`);

  // Theme
  if (config.theme) {
    lines.push(`  yasgui:theme "${config.theme}" ;`);
  }

  // Orientation
  if (config.orientation) {
    lines.push(`  yasgui:orientation "${config.orientation}" ;`);
  }

  // Endpoint history
  if (config.endpointHistory && config.endpointHistory.length > 0) {
    lines.push(`  yasgui:endpointHistory (`);
    config.endpointHistory.forEach((endpoint) => {
      lines.push(`    "${escapeTurtleString(endpoint)}"`);
    });
    lines.push(`  ) ;`);
  }

  // Active tab
  if (config.active) {
    lines.push(`  yasgui:activeTab "${escapeTurtleString(config.active)}" ;`);
  }

  // Prefixes
  if (config.prefixes) {
    lines.push(`  yasgui:prefixesValue """${escapeTurtleString(config.prefixes)}""" ;`);
  }

  // Auto capture enabled
  if (config.autoCaptureEnabled !== undefined) {
    lines.push(`  yasgui:autoCaptureEnabled "${config.autoCaptureEnabled}"^^xsd:boolean ;`);
  }

  // Custom endpoint buttons
  if (config.customEndpointButtons && config.customEndpointButtons.length > 0) {
    lines.push(`  yasgui:customEndpointButton [`);
    config.customEndpointButtons.forEach((button, index) => {
      const isLast = index === config.customEndpointButtons!.length - 1;
      lines.push(`    rdfs:label "${escapeTurtleString(button.label)}" ;`);
      lines.push(`    sd:endpoint "${escapeTurtleString(button.endpoint)}"${isLast ? "" : " ;"}`);
      if (!isLast) {
        lines.push(`  ] , [`);
      }
    });
    lines.push(`  ] ;`);
  }

  // Tabs
  if (config.tabs && config.tabs.length > 0) {
    lines.push(`  yasgui:tab [`);
    config.tabs.forEach((tabId, tabIndex) => {
      const tabConfig = config.tabConfig[tabId];
      const isLastTab = tabIndex === config.tabs.length - 1;

      lines.push(`    dcterms:identifier "${escapeTurtleString(tabId)}" ;`);
      lines.push(`    rdfs:label "${escapeTurtleString(tabConfig.name)}" ;`);

      // Orientation (if different from default)
      if (tabConfig.orientation) {
        lines.push(`    yasgui:orientation "${escapeTurtleString(tabConfig.orientation)}" ;`);
      }

      // Query
      if (tabConfig.yasqe?.value) {
        lines.push(`    sp:text """${escapeTurtleString(tabConfig.yasqe.value)}""" ;`);
      }

      // Editor height
      if (tabConfig.yasqe?.editorHeight) {
        lines.push(`    schema:height "${escapeTurtleString(tabConfig.yasqe.editorHeight)}" ;`);
      }

      // Request config
      if (tabConfig.requestConfig) {
        const reqConfig = tabConfig.requestConfig;
        if (reqConfig.endpoint && typeof reqConfig.endpoint === "string") {
          lines.push(`    sd:endpoint "${escapeTurtleString(reqConfig.endpoint)}" ;`);
        }
        if (reqConfig.method && typeof reqConfig.method === "string") {
          lines.push(`    yasgui:requestMethod "${escapeTurtleString(reqConfig.method)}" ;`);
        }
        if (reqConfig.acceptHeaderSelect && typeof reqConfig.acceptHeaderSelect === "string") {
          lines.push(`    yasgui:acceptHeaderSelect [`);
          lines.push(`      http:headerName "Accept" ;`);
          lines.push(`      http:headerValue "${escapeTurtleString(reqConfig.acceptHeaderSelect)}"`);
          lines.push(`    ] ;`);
        }
        if (reqConfig.acceptHeaderGraph && typeof reqConfig.acceptHeaderGraph === "string") {
          lines.push(`    yasgui:acceptHeaderGraph [`);
          lines.push(`      http:headerName "Accept" ;`);
          lines.push(`      http:headerValue "${escapeTurtleString(reqConfig.acceptHeaderGraph)}"`);
          lines.push(`    ] ;`);
        }
      }

      // YASR settings
      if (tabConfig.yasr?.settings) {
        const yasrSettings = tabConfig.yasr.settings;
        if (yasrSettings.selectedPlugin) {
          lines.push(`    yasgui:selectedPlugin "${escapeTurtleString(yasrSettings.selectedPlugin)}" ;`);
        }
      }

      // Remove trailing semicolon from last property
      const lastLine = lines[lines.length - 1];
      if (lastLine.endsWith(" ;")) {
        lines[lines.length - 1] = lastLine.slice(0, -2);
      }

      if (!isLastTab) {
        lines.push(`  ] , [`);
      }
    });
    lines.push(`  ] .`);
  } else {
    // Remove trailing semicolon if no tabs
    const lastLine = lines[lines.length - 1];
    if (lastLine.endsWith(" ;")) {
      lines[lines.length - 1] = lastLine.slice(0, -2) + " .";
    }
  }

  return lines.join("\n");
}

/**
 * Escape special characters in Turtle strings
 */
function escapeTurtleString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Parse Turtle back to configuration, with a real Turtle parser: the export of any version, or a file edited by
 * hand, is read by its triples rather than by the layout of the text.
 */
export function parseFromTurtle(turtle: string): Partial<PersistedJson> {
  const config: Partial<PersistedJson> = {
    endpointHistory: [],
    tabs: [],
    tabConfig: {},
    customEndpointButtons: [],
  };

  let quads: N3.Quad[];
  try {
    quads = new N3.Parser().parse(turtle);
  } catch (error) {
    console.error("Error parsing Turtle configuration:", error);
    throw new Error(
      `Failed to parse configuration. Please check the format${error instanceof Error ? ` (${error.message})` : ""}.`,
    );
  }

  const bySubject = new Map<string, N3.Quad[]>();
  for (const quad of quads) {
    const key = termKey(quad.subject);
    const list = bySubject.get(key);
    if (list) list.push(quad);
    else bySubject.set(key, [quad]);
  }
  const objects = (subject: N3.Term, predicate: string): N3.Term[] =>
    (bySubject.get(termKey(subject)) || []).filter((q) => q.predicate.value === predicate).map((q) => q.object);
  const literal = (subject: N3.Term, predicate: string): string | undefined => {
    const object = objects(subject, predicate)[0];
    return object && object.termType === "Literal" ? object.value : undefined;
  };
  const list = (head: N3.Term | undefined): N3.Term[] => {
    const items: N3.Term[] = [];
    const seen = new Set<string>();
    let node = head;
    while (node && node.value !== RDF_NS + "nil" && !seen.has(termKey(node))) {
      seen.add(termKey(node));
      const first = objects(node, RDF_NS + "first")[0];
      if (first) items.push(first);
      node = objects(node, RDF_NS + "rest")[0];
    }
    return items;
  };

  const root = quads.find(
    (q) => q.predicate.value === RDF_NS + "type" && q.object.value === YASGUI_NS + "Configuration",
  )?.subject;
  if (!root) {
    throw new Error("Failed to parse configuration: no yasgui:Configuration found.");
  }

  config.endpointHistory = list(objects(root, YASGUI_NS + "endpointHistory")[0])
    .filter((term) => term.termType === "Literal")
    .map((term) => term.value);

  const active = literal(root, YASGUI_NS + "activeTab");
  if (active !== undefined) config.active = active;

  const prefixes = literal(root, YASGUI_NS + "prefixesValue");
  if (prefixes !== undefined) config.prefixes = prefixes;

  const autoCapture = literal(root, YASGUI_NS + "autoCaptureEnabled");
  if (autoCapture !== undefined) config.autoCaptureEnabled = autoCapture === "true";

  const theme = literal(root, YASGUI_NS + "theme");
  if (theme === "light" || theme === "dark") config.theme = theme;

  const orientation = literal(root, YASGUI_NS + "orientation");
  if (orientation === "vertical" || orientation === "horizontal") config.orientation = orientation;

  for (const button of objects(root, YASGUI_NS + "customEndpointButton")) {
    const label = literal(button, RDFS_NS + "label");
    const endpoint = literal(button, SD_NS + "endpoint");
    if (label !== undefined && endpoint !== undefined) config.customEndpointButtons!.push({ label, endpoint });
  }

  // Tabs are blank nodes without an order of their own: keep the order in which they appear in the file
  objects(root, YASGUI_NS + "tab").forEach((tab, index) => {
    const tabId = literal(tab, DCTERMS_NS + "identifier") || `imported-${index + 1}`;
    if (config.tabConfig![tabId]) return;
    const tabOrientation = literal(tab, YASGUI_NS + "orientation");
    const acceptHeader = (predicate: string) => {
      const header = objects(tab, predicate)[0];
      return header ? literal(header, HTTP_NS + "headerValue") : undefined;
    };
    const method = literal(tab, YASGUI_NS + "requestMethod");
    const editorHeight = literal(tab, SCHEMA_NS + "height");
    const selectedPlugin = literal(tab, YASGUI_NS + "selectedPlugin");

    config.tabs!.push(tabId);
    config.tabConfig![tabId] = {
      id: tabId,
      name: literal(tab, RDFS_NS + "label") || "Query",
      yasqe: {
        value: literal(tab, SP_NS + "text") || "",
        ...(editorHeight ? { editorHeight } : {}),
      },
      requestConfig: {
        queryArgument: undefined,
        endpoint: literal(tab, SD_NS + "endpoint") || "",
        method: method === "GET" ? "GET" : "POST",
        acceptHeaderGraph: acceptHeader(YASGUI_NS + "acceptHeaderGraph") || "text/turtle",
        acceptHeaderSelect: acceptHeader(YASGUI_NS + "acceptHeaderSelect") || "application/sparql-results+json",
        acceptHeaderUpdate: "application/sparql-results+json",
        namedGraphs: [],
        defaultGraphs: [],
        args: [],
        headers: {},
        withCredentials: false,
        adjustQueryBeforeRequest: false,
        basicAuth: undefined,
        bearerAuth: undefined,
        apiKeyAuth: undefined,
        oauth2Auth: undefined,
      },
      yasr: {
        settings: selectedPlugin ? { selectedPlugin } : {},
        response: undefined,
      },
      orientation: tabOrientation === "vertical" || tabOrientation === "horizontal" ? tabOrientation : undefined,
    };
  });

  return config;
}

function termKey(term: N3.Term): string {
  return `${term.termType}:${term.value}`;
}

/**
 * Download configuration as a file
 */
export function downloadConfigAsFile(config: PersistedJson, filename: string = "matgui-config.ttl") {
  const turtle = serializeToTurtle(config);
  const blob = new Blob([turtle], { type: "text/turtle;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copy configuration to clipboard
 */
export async function copyConfigToClipboard(config: PersistedJson): Promise<void> {
  const turtle = serializeToTurtle(config);
  try {
    await navigator.clipboard.writeText(turtle);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = turtle;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Read configuration from file
 */
export function readConfigFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Read configuration from clipboard
 */
export async function readConfigFromClipboard(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    throw new Error("Failed to read from clipboard. Please paste the content manually.");
  }
}
