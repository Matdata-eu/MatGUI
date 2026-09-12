/**
 * Export/Import Configuration Module
 * Handles serialization and deserialization of Matgui configuration to/from RDF Turtle format
 */

import { PersistedJson } from "./PersistentConfig";

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
 * Unescape Turtle string
 */
function unescapeTurtleString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Parse Turtle format back to configuration
 * This is a simplified parser focused on the structure we generate.
 *
 * Note: This parser is designed to handle the specific Turtle format
 * produced by serializeToTurtle(). For production use with arbitrary
 * Turtle input, consider using a robust RDF library like N3.js.
 * The current implementation uses regex patterns that work well for
 * our serialization output but may not handle all valid Turtle syntax.
 */
export function parseFromTurtle(turtle: string): Partial<PersistedJson> {
  const config: Partial<PersistedJson> = {
    endpointHistory: [],
    tabs: [],
    tabConfig: {},
    customEndpointButtons: [],
  };

  try {
    // Extract endpoint history
    const endpointHistoryMatch = turtle.match(/yasgui:endpointHistory\s*\(([\s\S]*?)\)/);
    if (endpointHistoryMatch) {
      const endpoints = endpointHistoryMatch[1].match(/"([^"]*)"/g);
      if (endpoints) {
        config.endpointHistory = endpoints.map((e) => unescapeTurtleString(e.slice(1, -1)));
      }
    }

    // Extract active tab
    const activeTabMatch = turtle.match(/yasgui:activeTab\s+"([^"]*)"/);
    if (activeTabMatch) {
      config.active = unescapeTurtleString(activeTabMatch[1]);
    }

    // Extract prefixes
    const prefixesMatch = turtle.match(/yasgui:prefixesValue\s+"""([\s\S]*?)"""/);
    if (prefixesMatch) {
      config.prefixes = unescapeTurtleString(prefixesMatch[1]);
    }

    // Extract auto capture enabled
    const autoCaptureMatch = turtle.match(/yasgui:autoCaptureEnabled\s+"([^"]*)"/);
    if (autoCaptureMatch) {
      config.autoCaptureEnabled = autoCaptureMatch[1] === "true";
    }

    // Extract theme
    const themeMatch = turtle.match(/yasgui:theme\s+"([^"]*)"/);
    if (themeMatch && (themeMatch[1] === "light" || themeMatch[1] === "dark")) {
      config.theme = themeMatch[1] as "light" | "dark";
    }

    // Extract orientation
    const orientationMatch = turtle.match(/yasgui:orientation\s+"([^"]*)"/);
    if (orientationMatch && (orientationMatch[1] === "vertical" || orientationMatch[1] === "horizontal")) {
      config.orientation = orientationMatch[1] as "vertical" | "horizontal";
    }

    // Extract custom endpoint buttons
    const buttonPattern =
      /yasgui:customEndpointButton\s+\[([\s\S]*?)rdfs:label\s+"([^"]*)"\s*;\s*sd:endpoint\s+"([^"]*)"/g;
    let buttonMatch;
    while ((buttonMatch = buttonPattern.exec(turtle)) !== null) {
      config.customEndpointButtons!.push({
        label: unescapeTurtleString(buttonMatch[2]),
        endpoint: unescapeTurtleString(buttonMatch[3]),
      });
    }

    // Extract tabs - simplified parsing
    const tabPattern =
      /dcterms:identifier\s+"([^"]*)"\s*;\s*rdfs:label\s+"([^"]*)"\s*;[\s\S]*?(?=dcterms:identifier|yasgui:customEndpointButton|\]\.|\]\s*,\s*\[)/g;
    const tabBlocks = turtle.match(/yasgui:tab\s+\[([\s\S]*)\]\s*\./);

    if (tabBlocks) {
      const tabsContent = tabBlocks[1];
      const tabIdMatches = [...tabsContent.matchAll(/dcterms:identifier\s+"([^"]*)"/g)];
      const tabNameMatches = [...tabsContent.matchAll(/rdfs:label\s+"([^"]*)"/g)];
      const queryMatches = [...tabsContent.matchAll(/sp:text\s+"""([\s\S]*?)"""/g)];
      const endpointMatches = [...tabsContent.matchAll(/sd:endpoint\s+"([^"]*)"/g)];
      const methodMatches = [...tabsContent.matchAll(/yasgui:requestMethod\s+"([^"]*)"/g)];

      // Extract tab-level orientation
      const tabOrientationMatches = [...tabsContent.matchAll(/yasgui:orientation\s+"([^"]*)"/g)];

      tabIdMatches.forEach((match, index) => {
        const tabId = unescapeTurtleString(match[1]);
        const tabName = tabNameMatches[index] ? unescapeTurtleString(tabNameMatches[index][1]) : "Query";
        const query = queryMatches[index] ? unescapeTurtleString(queryMatches[index][1]) : "";
        const endpoint = endpointMatches[index] ? unescapeTurtleString(endpointMatches[index][1]) : "";
        const method = methodMatches[index] ? unescapeTurtleString(methodMatches[index][1]) : "POST";
        const orientation = tabOrientationMatches[index]
          ? (unescapeTurtleString(tabOrientationMatches[index][1]) as "vertical" | "horizontal")
          : undefined;

        config.tabs!.push(tabId);
        config.tabConfig![tabId] = {
          id: tabId,
          name: tabName,
          yasqe: {
            value: query,
          },
          requestConfig: {
            queryArgument: undefined,
            endpoint: endpoint,
            method: method as "GET" | "POST",
            acceptHeaderGraph: "text/turtle",
            acceptHeaderSelect: "application/sparql-results+json",
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
            settings: {},
            response: undefined,
          },
          orientation: orientation,
        };
      });
    }
  } catch (error) {
    console.error("Error parsing Turtle configuration:", error);
    throw new Error("Failed to parse configuration. Please check the format.");
  }

  return config;
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
