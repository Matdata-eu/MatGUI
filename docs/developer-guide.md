# MatGUI Developer Guide

This comprehensive guide covers everything developers need to know to integrate, customize, and extend MatGUI (formerly *Yasgui*).

> **Backwards compatibility:** MatGUI keeps the `@matdata/yasgui`, `@matdata/yasqe` and `@matdata/yasr` package names, the `Yasgui`/`Yasqe`/`Yasr` global variables and class names, the `yasgui`/`yasqe`/`yasr` CSS classes and the existing localStorage keys unchanged. Existing integrations continue to work without code changes.

> The Yasgui project has been renamed Matgui. But this is a brand rename only. The technical name still remains Yasgui for backwards compatibility. Whenever you read 'matdata' in this document, you can likely read 'yasgui' as well. Since this is a technical document for developers and since the package names are kept the same, this document still largely talks about yasgui due to the reference to the still-kept package name.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Architecture Overview](#architecture-overview)
  - [Package Structure](#package-structure)
  - [Architecture Diagram](#architecture-diagram)
  - [Package Details](#package-details)
    - [@matdata/yasgui-utils](#matdatayasgui-utils)
    - [@matdata/yasqe (SPARQL Query Editor)](#matdatayasqe-sparql-query-editor)
    - [@matdata/yasr (SPARQL Results Viewer)](#matdatayasr-sparql-results-viewer)
    - [@matdata/yasgui (Main Package)](#matdatayasgui-main-package)
- [Installation](#installation)
  - [npm](#npm)
  - [Yarn](#yarn)
  - [CDN](#cdn)
  - [Source](#source)
- [Usage Examples](#usage-examples)
  - [Plain HTML](#plain-html)
  - [Node.js / ES Modules](#nodejs--es-modules)
  - [CommonJS](#commonjs)
  - [React](#react)
  - [Vue](#vue)
  - [Angular](#angular)
  - [Using YASQE and YASR Separately](#using-yasqe-and-yasr-separately)
- [Configuration](#configuration)
  - [Matgui Configuration](#matgui-configuration)
    - [Example Configuration](#example-configuration)
  - [YASQE Configuration](#yasqe-configuration)
    - [YASQE Example](#yasqe-example)
    - [Code Snippets](#code-snippets)
    - [Share Configuration](#share-configuration)
  - [YASR Configuration](#yasr-configuration)
    - [YASR Example](#yasr-example)
    - [Disabling Response Cache](#disabling-response-cache)
  - [Request Configuration](#request-configuration)
    - [Request Configuration Example](#request-configuration-example)
  - [Authentication](#authentication)
    - [Authentication Types](#authentication-types)
    - [Basic Authentication](#basic-authentication)
    - [Bearer Token Authentication](#bearer-token-authentication)
    - [API Key Authentication](#api-key-authentication)
    - [Managing Endpoint Configurations](#managing-endpoint-configurations)
    - [OAuth 2.0 Provider Examples](#oauth-20-provider-examples)
    - [Dynamic Authentication](#dynamic-authentication)
    - [Disabling Authentication](#disabling-authentication)
    - [TypeScript Support](#typescript-support)
    - [Authentication Priority](#authentication-priority)
    - [Examples](#examples)
    - [Security Best Practices](#security-best-practices)
  - [Endpoint Buttons Configuration](#endpoint-buttons-configuration)
  - [Theme Configuration](#theme-configuration)
- [API Reference](#api-reference)
  - [Yasgui Class](#yasgui-class)
    - [Constructor](#constructor)
    - [Methods](#methods)
      - [`getTab(tabId?: string): Tab | undefined`](#gettabtabid-string-tab--undefined)
      - [`addTab(select?: boolean, config?: PartialTabConfig): Tab`](#addtabselect-boolean-config-partialtabconfig-tab)
      - [`selectTabId(tabId: string): void`](#selecttabidtabid-string-void)
      - [`closeTab(tab: Tab): void`](#closetabtab-tab-void)
      - [`getTabs(): { [tabId: string]: Tab }`](#gettabs--tabid-string-tab-)
      - [`setTheme(theme: 'light' | 'dark'): void`](#setthemetheme-light--dark-void)
      - [`getTheme(): 'light' | 'dark'`](#gettheme-light--dark)
      - [`toggleTheme(): 'light' | 'dark'`](#toggletheme-light--dark)
  - [Tab Class](#tab-class)
    - [Methods](#methods-1)
      - [`getName(): string`](#getname-string)
      - [`setName(name: string): void`](#setnamename-string-void)
      - [`getId(): string`](#getid-string)
      - [`getYasqe(): Yasqe`](#getyasqe-yasqe)
      - [`getYasr(): Yasr`](#getyasr-yasr)
      - [`query(): Promise<void>`](#query-promisevoid)
      - [`setQuery(query: string): void`](#setqueryquery-string-void)
      - [`getQuery(): string`](#getquery-string)
  - [Yasqe Class](#yasqe-class)
    - [Methods](#methods-2)
      - [`getValue(): string`](#getvalue-string)
      - [`setValue(value: string): void`](#setvaluevalue-string-void)
      - [`query(): Promise<any>`](#query-promiseany)
      - [`abortQuery(): void`](#abortquery-void)
      - [`format(): void`](#format-void)
      - [`getPrefixes(): Prefixes`](#getprefixes-prefixes)
      - [`addPrefixes(prefixes: Prefixes): void`](#addprefixesprefixes-prefixes-void)
      - [`removePrefixes(): void`](#removeprefixes-void)
  - [Yasr Class](#yasr-class)
    - [Methods](#methods-3)
      - [`setResponse(response: any, duration?: number): void`](#setresponseresponse-any-duration-number-void)
      - [`draw(): void`](#draw-void)
      - [`selectPlugin(pluginName: string): void`](#selectpluginpluginname-string-void)
      - [`getPlugins(): { [name: string]: Plugin }`](#getplugins--name-string-plugin-)
      - [`executeQuery(query: string, options?: PluginQueryOptions): Promise<any>`](#executequeryquery-string-options-pluginqueryoptions-promiseany)
      - [`download(filename?: string): void`](#downloadfilename-string-void)
- [Events](#events)
  - [YASGUI Events](#yasgui-events)
  - [YASQE Events](#yasqe-events)
  - [YASR Events](#yasr-events)
  - [Event Example: Query Tracking](#event-example-query-tracking)
  - [Event Example: Custom Query Logging](#event-example-custom-query-logging)
- [Plugin Development](#plugin-development)
  - [Plugin Interface](#plugin-interface)
  - [Step-by-Step Plugin Development Guide](#step-by-step-plugin-development-guide)
    - [Step 1: Create Plugin Class](#step-1-create-plugin-class)
    - [Step 2: Register Plugin](#step-2-register-plugin)
    - [Step 3: Configure Plugin](#step-3-configure-plugin)
    - [Step 4: Add Styling](#step-4-add-styling)
  - [Plugin Example: Chart Plugin](#plugin-example-chart-plugin)
  - [Plugin Best Practices](#plugin-best-practices)
  - [Theme Support for Plugins](#theme-support-for-plugins)
    - [Implementation Steps](#implementation-steps)
  - [Distributing Your Plugin](#distributing-your-plugin)
- [Using the Graph Plugin](#using-the-graph-plugin)
  - [Installation](#installation-1)
  - [Key Features](#key-features)
  - [Configuration Options](#configuration-options)
  - [Color Scheme](#color-scheme)
  - [Node Icons and Images](#node-icons-and-images)
  - [Predicate Icons](#predicate-icons)
  - [API Reference](#api-reference-1)
  - [Theme Integration](#theme-integration)
  - [Performance Considerations](#performance-considerations)
  - [Browser Requirements](#browser-requirements)
  - [Example Queries](#example-queries)
  - [Troubleshooting](#troubleshooting)
  - [Repository](#repository)
- [Using the Geo Plugin](#using-the-geo-plugin)
  - [Installation](#installation-2)
  - [Registering the Plugin](#registering-the-plugin)
  - [Quick Configuration](#quick-configuration)
  - [Key Features](#key-features-1)
  - [Options Reference](#options-reference)
  - [Convention-Based Per-Feature Bindings](#convention-based-per-feature-bindings)
  - [Supported Geometry Types](#supported-geometry-types)
  - [CRS and Coordinate Transformations](#crs-and-coordinate-transformations)
  - [Drawing Spatial Filters](#drawing-spatial-filters)
  - [Export Capabilities](#export-capabilities)
  - [Temporal Filtering](#temporal-filtering)
  - [Clustering and Heatmap](#clustering-and-heatmap)
  - [Permalink Support](#permalink-support)
  - [TypeScript Support](#typescript-support-1)
  - [Example Queries](#example-queries-1)
  - [Troubleshooting](#troubleshooting-1)
  - [Repository](#repository-1)
- [Contributing](#contributing)
  - [Getting Started](#getting-started)
  - [Project Structure](#project-structure)
  - [Development Workflow](#development-workflow)
    - [Making Changes](#making-changes)
    - [Building](#building)
    - [Pull Requests](#pull-requests)
  - [Code Guidelines](#code-guidelines)
    - [TypeScript](#typescript)
    - [CSS](#css)
    - [Documentation](#documentation)
  - [Reporting Issues](#reporting-issues)
  - [Feature Requests](#feature-requests)
  - [Release Process](#release-process)
  - [Community](#community)
  - [Code of Conduct](#code-of-conduct)
- [Additional Resources](#additional-resources)


---

## Architecture Overview

YASGUI is built as a monorepo with four main packages, each serving a specific purpose in the SPARQL querying workflow.

### Package Structure

```
@matdata/yasgui (root)
├── @matdata/yasgui-utils     - Shared utilities
├── @matdata/yasqe            - SPARQL Query Editor
├── @matdata/yasr             - SPARQL Results Viewer
└── @matdata/yasgui           - Main integration package
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                          YASGUI                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Tab Management Layer                 │  │
│  │  - Multiple query tabs                            │  │
│  │  - Tab persistence                                │  │
│  │  - Theme management                               │  │
│  │  - Settings & configuration                       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌────────────────────┐         ┌────────────────────┐  │
│  │      YASQE         │         │       YASR         │  │
│  │  (Query Editor)    │         │  (Results Viewer)  │  │
│  │                    │         │                    │  │
│  │  ┌──────────────┐  │         │  ┌──────────────┐  │  │
│  │  │ CodeMirror   │  │         │  │  Plugins     │  │  │
│  │  │ - Syntax     │  │         │  │  - Table     │  │  │
│  │  │ - Validation │  │         │  │  - Graph     │  │  │
│  │  │ - Autocomplete│ │         │  │  - Geo       │  │  │
│  │  └──────────────┘  │         │  │  - Boolean   │  │  │
│  │                    │         │  │  - Response  │  │  │
│  │  ┌──────────────┐  │         │  │  - Error     │  │  │
│  │  │ SPARQL       │  │         │  └──────────────┘  │  │
│  │  │ Execution    │  ├───────▶│                    │  │
│  │  └──────────────┘  │         │  ┌──────────────┐  │  │
│  │                    │         │  │ Parser       │  │  │
│  │  ┌──────────────┐  │         │  │ - JSON       │  │  │
│  │  │ Prefixes     │  │         │  │ - XML        │  │  │
│  │  │ Management   │  │         │  │ - CSV        │  │  │
│  │  └──────────────┘  │         │  │ - Turtle     │  │  │
│  └────────────────────┘         │  └──────────────┘  │  │
│                                 └────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                              │
                              │ Uses
                              ▼
                    ┌──────────────────┐
                    │  YASGUI-UTILS    │
                    │  - DOM helpers   │
                    │  - Storage       │
                    │  - Utilities     │
                    └──────────────────┘
```

### Package Details

#### @matdata/yasgui-utils

**Purpose**: Shared utility functions and helpers used across all packages.

**Key Features:**
- DOM manipulation utilities
- Local storage abstraction
- Common helper functions
- DOMPurify integration for XSS protection

**Exports:**
- `Storage`: localStorage abstraction with namespacing
- `addClass`, `removeClass`, `hasClass`: DOM class utilities

#### @matdata/yasqe (SPARQL Query Editor)

**Purpose**: Rich SPARQL query editor built on CodeMirror 6.

**Key Features:**
- SPARQL syntax highlighting
- Auto-completion (keywords, prefixes, properties, classes)
- Query validation with error highlighting
- Prefix management and auto-completion
- Query execution
- Query formatting (sparql-formatter integration)
- Persistent storage
- Keyboard shortcuts

**Core Components:**
- CodeMirror 6 `EditorView` wrapped by a CodeMirror 5-compatible facade (`packages/yasqe/src/editor/`)
- SPARQL tokenizer/grammar exposed as a `StreamLanguage` (`packages/yasqe/grammar/tokenizer.ts`)
- Autocomplete system (extensible, bridged to `@codemirror/autocomplete`)
- HTTP request handler
- Prefix utilities

**Editor architecture (CodeMirror 6):**

`Yasqe` no longer extends the CodeMirror class. It owns a CodeMirror 6 `EditorView` and exposes the familiar
CodeMirror 5-style API (`getValue`, `setValue`, `getCursor`, `setCursor`, `getTokenAt`, `getDoc`, `markText`,
`on('change'|'cursorActivity'|...)`, `addKeyMap`, etc.) through the `EditorFacade`/`DocFacade` classes. The
`editor/` folder contains the CM6 building blocks:

- `facade.ts` / `doc.ts` – CM5-compatible editor and document API on top of `EditorView`/`EditorState`
- `language.ts` / `tokenizerRunner.ts` – `StreamLanguage` for the SPARQL grammar emitting `cm-<style>` classes, plus `getTokenAt` emulation
- `autocompletion.ts` – bridges Yasqe completers (`HintFn`) to `@codemirror/autocomplete`, rendering into a `.CodeMirror-hints` list
- `gutters.ts` – line-number gutter and error/warning marker gutter
- `folding.ts` – brace and PREFIX-block folding via a `foldService`
- `keymap.ts` – converts CM5 key names (`Ctrl-Enter`, `Shift-Ctrl-K`, ...) to CM6 keymaps

Themes are applied as `CodeMirror cm-s-<theme>` classes on the editor root, so existing `.cm-s-*` stylesheets and
`.CodeMirror`-based selectors keep working. Token classes follow the CM5 naming (`cm-keyword`, `cm-variable-3`, ...).

#### @matdata/yasr (SPARQL Results Viewer)

**Purpose**: Flexible results visualization with plugin system.

**Key Features:**
- Plugin-based architecture
- Multiple built-in visualization plugins
- Result parsing (JSON, XML, CSV, Turtle)
- Export functionality
- Persistent plugin selection
- Theme support

**Core Components:**
- Plugin manager
- Result parsers
- Plugin API
- Header controls
- Download manager

#### @matdata/yasgui (Main Package)

**Purpose**: Integrates YASQE and YASR into a complete SPARQL IDE.

**Key Features:**
- Tab management (multiple queries)
- Endpoint management and quick-switch buttons
- Theme system (light/dark)
- Layout orientation (vertical/horizontal)
- Settings modal
- Tab persistence
- Event system
- URL-based query sharing

**Core Components:**
- Tab manager
- Theme manager
- Persistent configuration
- Settings modal
- Endpoint selector
- Tab context menu

---

## Installation

### npm

Install the main package (includes all components):

```bash
npm install @matdata/yasgui
```

Install individual packages:

```bash
npm install @matdata/yasqe    # Query editor only
npm install @matdata/yasr     # Results viewer only
npm install @matdata/yasgui-utils  # Utilities only
```

### Yarn

```bash
yarn add @matdata/yasgui
```

### CDN

Include YASGUI directly from a CDN (replace `VERSION` with the desired version):

```html
<!-- CSS -->
<link rel="stylesheet" href="https://unpkg.com/@matdata/yasgui@VERSION/build/yasgui.min.css" />

<!-- JavaScript -->
<script src="https://unpkg.com/@matdata/yasgui@VERSION/build/yasgui.min.js"></script>
```

**Latest version:**
```html
<link rel="stylesheet" href="https://unpkg.com/@matdata/yasgui/build/yasgui.min.css" />
<script src="https://unpkg.com/@matdata/yasgui/build/yasgui.min.js"></script>
```

### Source

Clone and build from source:

```bash
git clone https://github.com/Matdata-eu/Matgui.git
cd Yasgui
npm install
npm run build
```

Build output is in the `build/` directory.

---

## Usage Examples

### Plain HTML

Basic integration in a static HTML page:

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/@matdata/yasgui/build/yasgui.min.css" />
</head>
<body>
  <div id="yasgui"></div>
  
  <script src="https://unpkg.com/@matdata/yasgui/build/yasgui.min.js"></script>
  <script>
    const yasgui = new Yasgui(document.getElementById("yasgui"), {
      requestConfig: {
        endpoint: "https://dbpedia.org/sparql"
      }
    });
  </script>
</body>
</html>
```

> **Important:** If you want Matgui to fill the entire page, you **must** set `height: 100%` on all parent elements, including `html` and `body`:
>
> ```css
> html, body {
>   height: 100%;
>   margin: 0;
>   padding: 0;
> }
> 
> #yasgui {
>   height: 100%;
> }
> ```
>
> Using `height: 100%` ensures proper scaling when users zoom in/out in the browser. Avoid using viewport units like `100vh` on the container as they don't scale correctly with browser zoom. 

### Node.js / ES Modules

Using Matgui in a Node.js application or with module bundlers:

```javascript
import Yasgui from '@matdata/yasgui';
import '@matdata/yasgui/build/yasgui.min.css';

const yasgui = new Yasgui(document.getElementById('yasgui'), {
  requestConfig: {
    endpoint: 'https://query.wikidata.org/sparql'
  },
  theme: 'dark',
  orientation: 'horizontal'
});
```

### CommonJS

```javascript
const Yasgui = require('@matdata/yasgui');
require('@matdata/yasgui/build/yasgui.min.css');

const yasgui = new Yasgui(document.getElementById('yasgui'));
```

### React

Integration with React:

```jsx
import React, { useEffect, useRef } from 'react';
import Yasgui from '@matdata/yasgui';
import '@matdata/yasgui/build/yasgui.min.css';

function YasguiComponent() {
  const containerRef = useRef(null);
  const yasguiRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && !yasguiRef.current) {
      yasguiRef.current = new Yasgui(containerRef.current, {
        requestConfig: {
          endpoint: 'https://dbpedia.org/sparql'
        }
      });

      // Listen to events
      yasguiRef.current.on('query', (instance, tab) => {
        console.log('Query executed on tab:', tab.getName());
      });
    }

    // Cleanup
    return () => {
      // Yasgui doesn't require explicit cleanup
      // but you can add custom cleanup logic here
    };
  }, []);

  return <div ref={containerRef} style={{ height: '100vh' }} />;
}

export default YasguiComponent;
```

### Vue

Integration with Vue 3:

```vue
<template>
  <div ref="yasguiContainer" class="yasgui-container"></div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import Yasgui from '@matdata/yasgui';
import '@matdata/yasgui/build/yasgui.min.css';

export default {
  name: 'YasguiComponent',
  setup() {
    const yasguiContainer = ref(null);
    let yasgui = null;

    onMounted(() => {
      yasgui = new Yasgui(yasguiContainer.value, {
        requestConfig: {
          endpoint: 'https://dbpedia.org/sparql'
        },
        theme: 'dark'
      });

      yasgui.on('queryResponse', (instance, tab) => {
        console.log('Query completed:', tab.getName());
      });
    });

    onUnmounted(() => {
      // Cleanup if needed
      yasgui = null;
    });

    return {
      yasguiContainer
    };
  }
};
</script>

<style scoped>
.yasgui-container {
  height: 100vh;
  width: 100%;
}
</style>
```

### Angular

Integration with Angular:

```typescript
// yasgui.component.ts
import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import Yasgui from '@matdata/yasgui';
import '@matdata/yasgui/build/yasgui.min.css';

@Component({
  selector: 'app-yasgui',
  template: '<div #yasguiContainer style="height: 100vh"></div>',
  styleUrls: ['./yasgui.component.css']
})
export class YasguiComponent implements OnInit {
  @ViewChild('yasguiContainer', { static: true }) 
  yasguiContainer!: ElementRef;
  
  private yasgui: any;

  ngOnInit(): void {
    this.yasgui = new Yasgui(this.yasguiContainer.nativeElement, {
      requestConfig: {
        endpoint: 'https://dbpedia.org/sparql'
      }
    });

    this.yasgui.on('query', (instance: any, tab: any) => {
      console.log('Query executed:', tab.getName());
    });
  }

  ngOnDestroy(): void {
    // Cleanup
    this.yasgui = null;
  }
}
```

### Using YASQE and YASR Separately

You can use the query editor and results viewer independently:

```javascript
import Yasqe from '@matdata/yasqe';
import Yasr from '@matdata/yasr';
import '@matdata/yasqe/build/yasqe.min.css';
import '@matdata/yasr/build/yasr.min.css';

// Create query editor
const yasqe = new Yasqe(document.getElementById('yasqe'), {
  value: 'SELECT * WHERE { ?s ?p ?o } LIMIT 10',
  requestConfig: {
    endpoint: 'https://dbpedia.org/sparql'
  }
});

// Create results viewer
const yasr = new Yasr(document.getElementById('yasr'), {
  prefixes: yasqe.getPrefixes()
});

// Connect them
yasqe.on('queryResponse', (yasqe, response, duration) => {
  yasr.setResponse(response, duration);
});

// Execute query
yasqe.query();
```

---

## Configuration

YASGUI offers extensive configuration options to customize behavior and appearance.

### Matgui Configuration

Complete configuration object with all available options:

```typescript
interface Config {
  // Auto-focus editor on load or tab switch
  autofocus: boolean;  // default: true

  // Custom endpoint info renderer
  endpointInfo?: (tab?: Tab) => Element;

  // Copy endpoint to new tabs
  copyEndpointOnNewTab: boolean;  // default: true

  // Default tab name
  tabName: string;  // default: "Query"

  // Endpoint catalogue configuration
  endpointCatalogueOptions: EndpointSelectConfig;

  // Quick-switch endpoint buttons
  endpointButtons?: EndpointButton[];

  // Populate config from URL parameters
  populateFromUrl: boolean | ((config: TabJson) => TabJson);  // default: true

  // Auto-create first tab on init
  autoAddOnInit: boolean;  // default: true

  // Persistence ID for localStorage
  persistenceId: string | ((yasgui: Yasgui) => string) | null;

  // Persistence labels
  persistenceLabelConfig: string;  // default: "config"
  persistenceLabelResponse: string;  // default: "response"

  // Persistence expiry (seconds)
  persistencyExpire: number;  // default: 2592000 (30 days)

  // YASQE configuration
  yasqe: Partial<YasqeConfig>;

  // YASR configuration
  yasr: YasrConfig;

  // Request configuration
  requestConfig: RequestConfig;

  // Context menu container element
  contextMenuContainer?: HTMLElement;

  // Theme: 'light' or 'dark'
  theme?: 'light' | 'dark';

  // Show theme toggle button
  showThemeToggle?: boolean;  // default: true

  // Layout orientation: 'vertical' or 'horizontal'
  orientation?: 'vertical' | 'horizontal';  // default: 'vertical'
}
```

#### Example Configuration

```javascript
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  // Basic settings
  autofocus: true,
  tabName: 'My Query',
  theme: 'dark',
  orientation: 'horizontal',
  
  // Endpoint configuration
  requestConfig: {
    endpoint: 'https://dbpedia.org/sparql',
    method: 'POST'
  },
  
  // Quick-switch buttons
  endpointButtons: [
    { endpoint: 'https://dbpedia.org/sparql', label: 'DBpedia' },
    { endpoint: 'https://query.wikidata.org/sparql', label: 'Wikidata' }
  ],
  
  // Persistence
  persistenceId: 'my-yasgui-instance',
  persistencyExpire: 60 * 60 * 24 * 7,  // 7 days
  
  // YASQE config
  yasqe: {
    value: 'SELECT * WHERE { ?s ?p ?o } LIMIT 10',
    lineNumbers: true,
    showQueryButton: true
  },
  
  // YASR config
  yasr: {
    defaultPlugin: 'table',
    maxPersistentResponseSize: 500000
  }
});
```

### YASQE Configuration

YASQE (editor) specific configuration options:

```typescript
interface YasqeConfig {
  // Initial query value
  value?: string;

  // CodeMirror mode
  mode: string;  // default: 'sparql11'

  // Theme
  theme: string;  // default: 'default'

  // Line numbers
  lineNumbers: boolean;  // default: true

  // Line wrapping
  lineWrapping: boolean;  // default: false

  // Tab size
  tabSize: number;  // default: 2

  // Indent unit
  indentUnit: number;  // default: 2

  // Auto close brackets
  autoCloseBrackets: boolean;  // default: true

  // Match brackets
  matchBrackets: boolean;  // default: true

  // Fold gutter (code folding)
  foldGutter: boolean;  // default: true

  // Show query button
  showQueryButton: boolean;  // default: true

  // Show share button
  showShareButton: boolean;  // default: false

  // Persistent storage ID
  persistenceId?: string | ((yasqe: Yasqe) => string);

  // Request configuration
  requestConfig: RequestConfig;

  // Autocomplete configuration
  autocomplete: {
    enabled: boolean;
    completerConfigs: CompleterConfig[];
  };

  // Editor height
  editorHeight: string;  // default: '300px'

  // Resizable editor
  resizeable: boolean;  // default: true
}
```

#### YASQE Example

```javascript
import Yasqe from '@matdata/yasqe';

const yasqe = new Yasqe(document.getElementById('yasqe'), {
  value: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?label WHERE {
  ?s rdfs:label ?label
} LIMIT 10`,
  
  theme: 'github-dark',
  lineNumbers: true,
  lineWrapping: false,
  showQueryButton: true,
  editorHeight: '400px',
  
  requestConfig: {
    endpoint: 'https://dbpedia.org/sparql',
    method: 'POST',
    headers: {
      'Accept': 'application/sparql-results+json'
    }
  },
  
  autocomplete: {
    enabled: true,
    completerConfigs: [
      { name: 'prefixes', enabled: true },
      { name: 'properties', enabled: true },
      { name: 'classes', enabled: true }
    ]
  }
});
```

#### Code Snippets

Configure reusable code snippets that users can quickly insert into their queries.

**Configuration Options:**

```typescript
interface Snippet {
  label: string;      // Button label
  code: string;       // Code to insert
  group?: string;     // Optional group name (for dropdowns when >10 snippets)
}

interface YasqeConfig {
  // ... other config options
  
  // Code snippets
  snippets: Snippet[];           // default: 5 SPARQL snippets
  showSnippetsBar: boolean;      // default: true
}
```

**Basic Example:**

```javascript
import Yasqe from '@matdata/yasqe';

const yasqe = new Yasqe(document.getElementById('yasqe'), {
  snippets: [
    {
      label: 'SELECT',
      code: 'SELECT * WHERE {\n  ?s ?p ?o .\n} LIMIT 10'
    },
    {
      label: 'FILTER',
      code: 'FILTER (?var > 100)'
    },
    {
      label: 'OPTIONAL',
      code: 'OPTIONAL {\n  ?s ?p ?o .\n}'
    }
  ]
});
```

**Grouped Snippets (Dropdown):**

When you have more than 10 snippets, use the `group` property to organize them into dropdown menus:

```javascript
const yasqe = new Yasqe(document.getElementById('yasqe'), {
  snippets: [
    // Query Types group
    {
      label: 'SELECT',
      code: 'SELECT * WHERE {\n  ?s ?p ?o .\n} LIMIT 10',
      group: 'Query Types'
    },
    {
      label: 'CONSTRUCT',
      code: 'CONSTRUCT {\n  ?s ?p ?o .\n} WHERE {\n  ?s ?p ?o .\n}',
      group: 'Query Types'
    },
    {
      label: 'ASK',
      code: 'ASK {\n  ?s ?p ?o .\n}',
      group: 'Query Types'
    },
    
    // Patterns group
    {
      label: 'FILTER',
      code: 'FILTER (?var > 100)',
      group: 'Patterns'
    },
    {
      label: 'OPTIONAL',
      code: 'OPTIONAL {\n  ?s ?p ?o .\n}',
      group: 'Patterns'
    },
    {
      label: 'UNION',
      code: '{ ?s ?p ?o . } UNION { ?s ?p2 ?o2 . }',
      group: 'Patterns'
    },
    
    // Modifiers group
    {
      label: 'ORDER BY',
      code: 'ORDER BY ?var',
      group: 'Modifiers'
    },
    {
      label: 'LIMIT',
      code: 'LIMIT 10',
      group: 'Modifiers'
    }
    // ... more snippets
  ]
});
```

**API Methods:**

```javascript
// Hide the snippets bar
yasqe.setSnippetsBarVisible(false);

// Show the snippets bar
yasqe.setSnippetsBarVisible(true);

// Check if snippets bar is visible
const isVisible = yasqe.getSnippetsBarVisible();
```

**Behavior:**
- When 10 or fewer snippets: All displayed as individual buttons
- When more than 10 snippets: Grouped into dropdown menus by the `group` property
- Snippets without a group appear as individual buttons
- User visibility preference is saved in localStorage
- Snippets bar is hidden automatically when `snippets` array is empty
- Code is inserted at the current cursor position

**Default Snippets:**

YASQE includes 5 default SPARQL snippets:
1. SELECT query template
2. CONSTRUCT query template
3. ASK query template
4. FILTER pattern
5. OPTIONAL pattern

**Disabling Snippets:**

```javascript
// Disable snippets bar
const yasqe = new Yasqe(document.getElementById('yasqe'), {
  showSnippetsBar: false
});

// Or provide empty array
const yasqe = new Yasqe(document.getElementById('yasqe'), {
  snippets: []
});
```

#### Share Configuration

Configure how users can share their SPARQL queries with multiple output formats including URLs, cURL, PowerShell, and wget commands.

**Configuration Options:**

```typescript
interface YasqeConfig {
  // ... other config options
  
  // Function to create a shareable link (required to show share button)
  createShareableLink?: (yasqe: Yasqe) => string;
  
  // Optional URL shortener function
  createShortLink?: (yasqe: Yasqe, longUrl: string) => Promise<string>;
  
  // Function to consume/parse shared links
  consumeShareLink?: (yasqe: Yasqe) => void;
}
```

**Basic Share Configuration:**

```javascript
import Yasqe from '@matdata/yasqe';

const yasqe = new Yasqe(document.getElementById('yasqe'), {
  requestConfig: {
    endpoint: 'https://dbpedia.org/sparql',
    method: 'POST'
  },
  
  // Enable share button with URL generation
  createShareableLink: (yasqe) => {
    const query = yasqe.getValue();
    const endpoint = yasqe.getRequestConfig().endpoint;
    
    // Create shareable URL with query parameters
    const params = new URLSearchParams({
      query: query,
      endpoint: endpoint
    });
    
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  },
  
  // Parse shared URLs on page load
  consumeShareLink: (yasqe) => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('query');
    const endpoint = params.get('endpoint');
    
    if (query) yasqe.setValue(query);
    if (endpoint) {
      yasqe.setRequestConfig({
        ...yasqe.getRequestConfig(),
        endpoint: endpoint
      });
    }
  }
});
```

**URL Shortener Configuration (Kutt Example):**

Configure a URL shortener service to create shorter, more shareable links. This example shows integration with [Kutt](https://kutt.it), but any URL shortener API can be used.

```javascript
import Yasqe from '@matdata/yasqe';

const yasqe = new Yasqe(document.getElementById('yasqe'), {
  requestConfig: {
    endpoint: 'https://dbpedia.org/sparql'
  },
  
  // Basic shareable link creation
  createShareableLink: (yasqe) => {
    const query = yasqe.getValue();
    const config = yasqe.getRequestConfig();
    
    const params = new URLSearchParams({
      query: query,
      endpoint: config.endpoint || ''
    });
    
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
  },
  
  // URL shortener integration (Kutt example)
  createShortLink: async (yasqe, longUrl) => {
    const KUTT_API_URL = 'https://kutt.it/api/v2/links';
    // Important: Load API key from a secure config or environment variable
    // Never hardcode real API keys in source code!
    // Example: Load from window.__CONFIG__ set by server-rendered template
    const KUTT_API_KEY = window.__CONFIG__?.KUTT_API_KEY;
    
    if (!KUTT_API_KEY) {
      throw new Error('Kutt API key not configured. Load it from a secure config or environment variable.');
    }
    
    try {
      const response = await fetch(KUTT_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': KUTT_API_KEY
        },
        body: JSON.stringify({
          target: longUrl,
          // Optional: custom short code
          // customurl: 'my-custom-code',
          // Optional: domain (if using custom domain)
          // domain: 'example.com',
          // Optional: expiration
          // expire_in: '2 hours'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to shorten URL');
      }
      
      const data = await response.json();
      return data.link; // Returns shortened URL
      
    } catch (error) {
      console.error('URL shortening error:', error);
      throw error; // Error will be displayed to user
    }
  },
  
  consumeShareLink: (yasqe) => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('query');
    if (query) yasqe.setValue(query);
  }
});
```

**Other URL Shortener Examples:**

*YOURLS (Your Own URL Shortener):*
```javascript
createShortLink: async (yasqe, longUrl) => {
  const YOURLS_API_URL = 'https://your-domain.com/yourls-api.php'; // Your YOURLS instance
  const YOURLS_SIGNATURE = 'your-signature-token'; // Found in YOURLS admin > Tools
  
  try {
    const params = new URLSearchParams({
      signature: YOURLS_SIGNATURE,
      action: 'shorturl',
      url: longUrl,
      format: 'json',
      // Optional: custom keyword
      // keyword: 'my-custom-keyword'
    });
    
    const response = await fetch(`${YOURLS_API_URL}?${params.toString()}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'fail') {
      throw new Error(data.message || 'Failed to shorten URL');
    }
    
    return data.shorturl; // Returns shortened URL
    
  } catch (error) {
    console.error('YOURLS shortening error:', error);
    throw error;
  }
}
```

**Note:** YOURLS can authenticate using either a signature token (recommended) or username/password. The signature token is more secure and can be found in your YOURLS admin panel under Tools > Signature Token.

*TinyURL:*
```javascript
createShortLink: async (yasqe, longUrl) => {
  try {
    const response = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`
    );

    if (!response.ok) {
      throw new Error(`TinyURL request failed with status ${response.status}`);
    }

    const shortUrl = await response.text();

    // Basic validation: ensure the response is a valid TinyURL link
    let parsedUrl;
    try {
      parsedUrl = new URL(shortUrl);
    } catch {
      throw new Error('TinyURL response was not a valid URL');
    }

    if (!/^https?:\/\/(www\.)?tinyurl\.com\//.test(parsedUrl.href)) {
      throw new Error('TinyURL response did not contain a TinyURL link');
    }

    return parsedUrl.href;
  } catch (error) {
    console.error('TinyURL shortening error:', error);
    throw error;
  }
}
```

*Bitly:*
```javascript
createShortLink: async (yasqe, longUrl) => {
  // Load token from secure config
  const BITLY_TOKEN = window.__CONFIG__?.BITLY_TOKEN;
  
  if (!BITLY_TOKEN) {
    throw new Error('Bitly token not configured');
  }
  
  try {
    const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BITLY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ long_url: longUrl })
    });

    if (!response.ok) {
      throw new Error(`Bitly API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data || typeof data.link !== 'string') {
      throw new Error('Bitly API response missing expected "link" property');
    }

    return data.link;
  } catch (error) {
    console.error('Failed to create Bitly short link:', error);
    throw error;
  }
}
```

*Custom Backend:*
```javascript
createShortLink: async (yasqe, longUrl) => {
  const response = await fetch('/api/shorten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: longUrl })
  });
  
  const data = await response.json();
  return data.shortUrl;
}
```

**Share Button Features:**

When the share button is enabled (by configuring `createShareableLink`), users can:

1. **Copy URL** - Copies the shareable URL to clipboard
2. **Shorten URL** - Creates and copies a shortened URL (only shown if `createShortLink` is configured)
3. **Copy cURL** - Generates a cURL command with all headers and authentication
4. **Copy PowerShell** - Generates a PowerShell `Invoke-WebRequest` command
5. **Copy wget** - Generates a wget command

All command formats include:
- Complete SPARQL query
- Endpoint URL
- HTTP method (GET/POST)
- All configured headers
- Accept header (based on query type: JSON for SELECT/ASK, text/turtle for CONSTRUCT/DESCRIBE)
- Authentication credentials (with security warning)
- Output file specification (PowerShell only, with appropriate extension based on Accept header)

**Security Considerations:**

⚠️ When users copy command-line formats (cURL, PowerShell, wget) that include authentication credentials, YASQE displays a warning toast notification. This helps prevent accidental sharing of sensitive credentials.

**Best Practices:**

1. **Store API keys securely** - Never commit API keys to version control
2. **Use environment variables** - Load API keys from environment or configuration
3. **Implement rate limiting** - Prevent abuse of URL shortener services
4. **Handle errors gracefully** - Provide user-friendly error messages
5. **Consider privacy** - Be transparent about what data is included in shared URLs

**Troubleshooting:**

- If the share button doesn't appear, ensure `createShareableLink` is configured
- If "Shorten URL" doesn't appear, check that `createShortLink` is configured
- Check browser console for API errors when shortening fails
- Verify API keys and endpoints are correct
- Ensure CORS is properly configured for your URL shortener API

### YASR Configuration

YASR (results viewer) specific configuration options:

```typescript
interface YasrConfig {
  // Default plugin to use
  defaultPlugin?: string;

  // Plugin configurations
  plugins: {
    [pluginName: string]: {
      // Plugin-specific options
      // Priority for plugin selection (higher = preferred)
      priority?: number;
    };
  };

  // Prefixes for result display
  prefixes?: Prefixes;

  // Max response size to persist (bytes)
  maxPersistentResponseSize: number;  // default: 500000

  // Persistent storage ID
  persistenceId?: string | ((yasr: Yasr) => string);

  // Persistence labels
  persistenceLabelConfig: string;
  persistenceLabelResponse: string;

  // Download filename
  downloadFilename?: string | ((yasr: Yasr) => string);

  // Error renderers
  errorRenderers?: ErrorRenderer[];

  // Optional callback enabling plugins to execute background SPARQL queries
  executeQuery?: (query: string, options?: PluginQueryOptions) => Promise<any>;
}

interface PluginQueryOptions {
  // Custom Accept header for the request (e.g. "text/turtle", "application/sparql-results+json")
  acceptHeader?: string;
  // Abort signal for cancelling in-flight background queries
  signal?: AbortSignal;
}
```

When YASR is used inside a Yasgui `Tab`, the `executeQuery` callback is automatically
wired up. When using YASR standalone, you must provide your own implementation.

#### YASR Example

```javascript
import Yasr from '@matdata/yasr';

const yasr = new Yasr(document.getElementById('yasr'), {
  defaultPlugin: 'table',
  
  plugins: {
    table: {
      priority: 10,
      pageSize: 50
    },
    graph: {
      priority: 5
    },
    response: {
      priority: 1
    }
  },
  
  prefixes: {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    foaf: 'http://xmlns.com/foaf/0.1/'
  },
  
  maxPersistentResponseSize: 1000000,  // 1MB
  
  downloadFilename: (yasr) => {
    return `results-${new Date().toISOString()}.csv`;
  }
});
```

#### Disabling Response Cache

To ensure YASR never shows a previously cached result, set:

- `maxPersistentResponseSize: 0`

Example:

```javascript
const yasr = new Yasr(document.getElementById("yasr"), {
  persistenceId: "my-yasr",
  maxPersistentResponseSize: 0,
});
```

Behavior details:

- `maxPersistentResponseSize <= 0` disables response persistence.
- On initialization, YASR does not restore a stored response.
- If a stored response exists for the same `persistenceId`, it is removed.
- New responses are not written to storage.

Important:

- `persistencyExpire: 0` does **not** mean "expire immediately". In current storage semantics, `0` acts as no expiry.

Regression coverage:

- Browser test: `test/run.ts` (`Yasr` suite, `does not restore previous response when response persistence is disabled`).

### Request Configuration

HTTP request configuration for SPARQL queries:

```typescript
interface RequestConfig {
  // SPARQL endpoint URL
  endpoint: string;

  // HTTP method
  method: 'GET' | 'POST';  // default: 'POST'

  // Accept header
  acceptHeaderGraph?: string;
  acceptHeaderSelect?: string;
  acceptHeaderUpdate?: string;

  // Named graphs
  namedGraphs?: string[];

  // Default graphs
  defaultGraphs?: string[];

  // Custom headers
  headers?: { [key: string]: string };

  // Custom arguments (URL parameters)
  args?: Array<{ name: string; value: string }>;

  // Adjust query before request
  adjustQueryBeforeRequest?: (query: string) => string;

  // Authentication
  basicAuth?: BasicAuthConfig | ((yasqe: Yasqe) => BasicAuthConfig | undefined);
  bearerAuth?: BearerAuthConfig | ((yasqe: Yasqe) => BearerAuthConfig | undefined);
  apiKeyAuth?: ApiKeyAuthConfig | ((yasqe: Yasqe) => ApiKeyAuthConfig | undefined);
  oauth2Auth?: OAuth2AuthConfig | ((yasqe: Yasqe) => OAuth2AuthConfig | undefined);
}

interface BasicAuthConfig {
  username: string;
  password: string;
}

interface BearerAuthConfig {
  token: string;
}

interface ApiKeyAuthConfig {
  headerName: string;
  apiKey: string;
}

interface OAuth2AuthConfig {
  accessToken: string;
  idToken?: string;
}
```

#### Request Configuration Example

```javascript
const config = {
  requestConfig: {
    endpoint: 'https://dbpedia.org/sparql',
    method: 'POST',
    
    acceptHeaderSelect: 'application/sparql-results+json',
    acceptHeaderGraph: 'text/turtle',
    
    namedGraphs: ['http://dbpedia.org'],
    
    headers: {
      'User-Agent': 'MyApp/1.0'
    },
    
    args: [
      { name: 'timeout', value: '30000' },
      { name: 'debug', value: 'on' }
    ],
    
    adjustQueryBeforeRequest: (query) => {
      // Add timestamp comment
      return `# Query executed at ${new Date().toISOString()}\n${query}`;
    }
  }
};
```

### Authentication

YASGUI supports multiple authentication methods for SPARQL endpoints: Basic Authentication, Bearer Token, and API Key (custom headers). **Authentication is stored per-endpoint**, meaning all tabs using the same endpoint share the same credentials.

#### Authentication Types

YASGUI supports four authentication types:

1. **Basic Authentication**: Username and password sent as HTTP Basic Auth
2. **Bearer Token**: Token sent in the `Authorization: Bearer <token>` header
3. **API Key**: Custom header with an API key (e.g., `X-API-Key: <key>`)
4. **OAuth 2.0**: Industry-standard OAuth 2.0 with automatic token refresh

#### Basic Authentication

Configure basic authentication programmatically when initializing YASGUI. Note that this sets the initial credentials, but users can also configure them via the UI.

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: {
    endpoint: "https://example.com/sparql",
    basicAuth: {
      username: "myuser",
      password: "mypassword"
    }
  }
});
```

#### Bearer Token Authentication

Use Bearer Token authentication for endpoints that require OAuth2 or JWT tokens:

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: {
    endpoint: "https://api.example.com/sparql",
    bearerAuth: {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
});
```

#### API Key Authentication

Use API Key authentication for endpoints that require a custom header:

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: {
    endpoint: "https://api.example.com/sparql",
    apiKeyAuth: {
      headerName: "X-API-Key",
      apiKey: "your-api-key-here"
    }
  }
});
```

**Important:** When using programmatic configuration, the credentials will be used for that initial request, but YASGUI will store them in the endpoint-based configuration. Any subsequent tab that uses the same endpoint will automatically use these credentials.

#### Managing Endpoint Configurations

Use the PersistentConfig API to manage endpoint configurations programmatically:

```javascript
// Add or update an endpoint with Basic Authentication
yasgui.persistentConfig.addOrUpdateEndpoint("https://example.com/sparql", {
  label: "My Secure Endpoint",
  showAsButton: true,
  authentication: {
    type: 'basic',
    username: "myuser",
    password: "mypassword"
  }
});

// Add or update an endpoint with Bearer Token
yasgui.persistentConfig.addOrUpdateEndpoint("https://api.example.com/sparql", {
  label: "API with Bearer Token",
  showAsButton: true,
  authentication: {
    type: 'bearer',
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
});

// Add or update an endpoint with API Key
yasgui.persistentConfig.addOrUpdateEndpoint("https://api.example.com/sparql", {
  label: "API with Custom Header",
  showAsButton: true,
  authentication: {
    type: 'apiKey',
    headerName: 'X-API-Key',
    apiKey: 'your-api-key-here'
  }
});

// Add or update an endpoint with OAuth 2.0
yasgui.persistentConfig.addOrUpdateEndpoint("https://oauth.example.com/sparql", {
  label: "OAuth Protected Endpoint",
  showAsButton: true,
  authentication: {
    type: 'oauth2',
    clientId: 'your-client-id',
    authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
    tokenEndpoint: 'https://auth.example.com/oauth/token',
    redirectUri: 'https://yourapp.com/oauth2-callback', // optional
    scope: 'read write', // optional
    // The following are automatically populated after authentication:
    // accessToken: '...',
    // refreshToken: '...',
    // tokenExpiry: 1234567890
  }
});

// Get endpoint configuration
const config = yasgui.persistentConfig.getEndpointConfig("https://example.com/sparql");

// Remove authentication from an endpoint
yasgui.persistentConfig.addOrUpdateEndpoint("https://example.com/sparql", {
  authentication: undefined
});

// Delete an endpoint completely
yasgui.persistentConfig.deleteEndpointConfig("https://example.com/sparql");
```

#### OAuth 2.0 Provider Examples

**⚠️ Important Prerequisite:**
Before OAuth 2.0 authentication can work, the **OAuth administrator must register the redirect URI** (callback URL) in the OAuth provider's application configuration. YASGUI uses the current page URL as the redirect URI by default (e.g., `https://yasgui.example.com/`). This URL must be added to the list of allowed redirect URIs in your OAuth application settings.

**Microsoft Azure (Entra ID)**

```javascript
yasgui.persistentConfig.addOrUpdateEndpoint("https://your-sparql-endpoint.com/sparql", {
  label: "Azure Protected Endpoint",
  authentication: {
    type: 'oauth2',
    clientId: 'your-azure-client-id',
    authorizationEndpoint: 'https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token',
    scope: 'api://your-app-id/.default', // or specific scopes like 'openid profile'
    redirectUri: window.location.origin + window.location.pathname // optional
  }
});
```

**Redirect URI Registration:** In Azure AD app registration, add your YASGUI URL to "Redirect URIs" under Authentication settings.

**AWS Cognito**

```javascript
yasgui.persistentConfig.addOrUpdateEndpoint("https://your-sparql-endpoint.com/sparql", {
  label: "AWS Cognito Protected Endpoint",
  authentication: {
    type: 'oauth2',
    clientId: 'your-cognito-app-client-id',
    authorizationEndpoint: 'https://your-domain.auth.region.amazoncognito.com/oauth2/authorize',
    tokenEndpoint: 'https://your-domain.auth.region.amazoncognito.com/oauth2/token',
    scope: 'openid profile', // adjust based on your needs
    redirectUri: window.location.origin + window.location.pathname // optional
  }
});
```

**Redirect URI Registration:** In Cognito app client settings, add your YASGUI URL to "Allowed callback URLs".

**Keycloak**

```javascript
yasgui.persistentConfig.addOrUpdateEndpoint("https://your-sparql-endpoint.com/sparql", {
  label: "Keycloak Protected Endpoint",
  authentication: {
    type: 'oauth2',
    clientId: 'your-keycloak-client-id',
    authorizationEndpoint: 'https://your-keycloak-domain.com/realms/{realm-name}/protocol/openid-connect/auth',
    tokenEndpoint: 'https://your-keycloak-domain.com/realms/{realm-name}/protocol/openid-connect/token',
    scope: 'openid profile', // adjust based on your client configuration
    redirectUri: window.location.origin + window.location.pathname // optional
  }
});
```

**Redirect URI Registration:** In Keycloak client configuration, add your YASGUI URL to "Valid Redirect URIs".

**Important Notes:**
- Replace placeholders like `{tenant-id}`, `{realm-name}`, `region`, etc. with your actual values
- **The OAuth administrator must register the redirect URI** in the OAuth provider before authentication will work
- For Azure, the client must be registered in Azure AD with public client flow enabled
- For AWS Cognito, the app client should have "Authorization code grant" flow enabled
- For Keycloak, the client should have "Standard Flow" enabled and "Access Type" set to "public"

#### Dynamic Authentication

Use a function to dynamically provide credentials:

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: {
    endpoint: "https://example.com/sparql",
    // Dynamic Basic Auth
    basicAuth: (yasqe) => {
      return {
        username: getCurrentUsername(),
        password: getCurrentPassword()
      };
    },
    // Dynamic Bearer Token
    bearerAuth: (yasqe) => {
      return {
        token: getAccessToken()
      };
    },
    // Dynamic API Key
    apiKeyAuth: (yasqe) => {
      return {
        headerName: "X-API-Key",
        apiKey: getApiKey()
      };
    }
  }
});
```

#### Disabling Authentication

To disable authentication:

```javascript
tab.setRequestConfig({
  basicAuth: undefined,
  bearerAuth: undefined,
  apiKeyAuth: undefined
});
```

#### TypeScript Support

```typescript
import { BasicAuthConfig, BearerAuthConfig, ApiKeyAuthConfig } from "@matdata/yasqe";

// Basic Auth
const basicAuthConfig: BasicAuthConfig = {
  username: "myuser",
  password: "mypassword"
};

// Bearer Token
const bearerAuthConfig: BearerAuthConfig = {
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
};

// API Key
const apiKeyAuthConfig: ApiKeyAuthConfig = {
  headerName: "X-API-Key",
  apiKey: "your-api-key-here"
};

const yasgui = new Yasgui(element, {
  requestConfig: {
    endpoint: "https://secure-endpoint.com/sparql",
    basicAuth: basicAuthConfig,
    // or
    bearerAuth: bearerAuthConfig,
    // or
    apiKeyAuth: apiKeyAuthConfig
  }
});
```

#### Authentication Priority

When multiple authentication methods are configured:
1. Bearer Token is applied first (if configured)
2. API Key is applied (if configured and doesn't conflict)
3. Basic Authentication is applied last (if no Authorization header exists)

Note: Bearer Token and Basic Authentication both use the `Authorization` header, so only one will be applied. API Key uses a custom header and can coexist with Authorization headers.

#### Examples

**Example 1: Simple Authentication**

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: {
    endpoint: "https://secure-endpoint.example.com/sparql",
    basicAuth: {
      username: "user",
      password: "pass"
    }
  }
});
```

**Example 2: Multiple Endpoints with Different Credentials**

Authentication is stored **per-endpoint**, not per-tab. All tabs using the same endpoint will share the same credentials.

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"));

// Configure authentication for first endpoint
yasgui.persistentConfig.addOrUpdateEndpoint("https://dbpedia.org/sparql", {
  // No authentication needed for public endpoint
});

// Configure authentication for second endpoint
yasgui.persistentConfig.addOrUpdateEndpoint("https://private.example.com/sparql", {
  authentication: {
    type: "basic",
    username: "admin",
    password: "secret"
  }
});

// Create tabs - they will automatically use endpoint-based auth
const tab1 = yasgui.addTab();
tab1.setRequestConfig({ endpoint: "https://dbpedia.org/sparql" });

const tab2 = yasgui.addTab();
tab2.setRequestConfig({ endpoint: "https://private.example.com/sparql" });

// Both tabs pointing to the same endpoint will share credentials
const tab3 = yasgui.addTab();
tab3.setRequestConfig({ endpoint: "https://private.example.com/sparql" }); // Uses same auth as tab2
```

**Example 3: Prompt User for Credentials**

⚠️ **Security Warning**: Storing credentials in localStorage exposes them to any script running on the same origin (e.g., XSS attacks or malicious third-party scripts). For production use:
- Use session-based authentication with short-lived tokens
- Consider OAuth 2.0 or other secure authentication flows
- Avoid storing reusable passwords in browser storage
- Only use HTTPS endpoints

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: {
    endpoint: "https://secure-endpoint.example.com/sparql",
    basicAuth: (yasqe) => {
      // WARNING: This example stores credentials in localStorage for demonstration only.
      // In production, use more secure alternatives (session tokens, OAuth, etc.)
      
      const username = prompt("Enter username:");
      const password = prompt("Enter password:");
      
      if (username && password) {
        return { username, password };
      }
      
      return undefined;
    }
  }
});
```

**Recommended Approach**: Use endpoint-based authentication via the UI or configure it once programmatically:

```javascript
// Configure authentication securely
yasgui.persistentConfig.addOrUpdateEndpoint("https://secure-endpoint.example.com/sparql", {
  authentication: {
    type: "basic",
    username: "user",
    password: "pass"  // Consider using environment variables or secure credential management
  }
});
```

#### Security Best Practices

1. **Use HTTPS Only**: Never use basic authentication with HTTP endpoints
2. **Secure Storage**: Consider implementing additional encryption for stored credentials
3. **Token-Based Auth**: For production applications, consider using token-based authentication instead of basic auth
4. **Clear on Logout**: Implement a logout mechanism that clears stored credentials
5. **Environment Variables**: Store credentials in environment variables for server-side applications

### Endpoint Buttons Configuration

The endpoint quick switch buttons feature allows you to configure a list of predefined SPARQL endpoints that users can quickly switch between with a single click.

**Interface:**

```typescript
interface EndpointButton {
  endpoint: string;  // SPARQL endpoint URL (required)
  label: string;     // Button text displayed to user (required)
}
```

**Configuration:**

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  endpointButtons: [
    { endpoint: "https://dbpedia.org/sparql", label: "DBpedia" },
    { endpoint: "https://query.wikidata.org/sparql", label: "Wikidata" },
    { endpoint: "https://example.com/sparql", label: "Custom" }
  ]
});
```

**Complete Example:**

```javascript
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: {
    endpoint: "https://dbpedia.org/sparql"
  },
  endpointButtons: [
    { endpoint: "https://dbpedia.org/sparql", label: "DBpedia" },
    { endpoint: "https://query.wikidata.org/bigdata/namespace/wdq/sparql", label: "Wikidata" },
    { endpoint: "https://graph.data.era.europa.eu/repositories/rinf-plus", label: "ERA" }
  ]
});
```

**Features:**

- **Predefined Buttons**: Configure endpoint buttons during YASGUI initialization
- **User-Defined Buttons**: Users can add their own custom buttons through the Settings modal
- **One-Click Switching**: Instantly switch to a different SPARQL endpoint with a single click
- **Persistent Storage**: User-defined buttons are saved in local storage
- **Accessible**: Buttons include ARIA labels for accessibility

**Behavior:**

- Buttons are displayed next to the endpoint textbox in the controlbar
- Clicking a button immediately updates the endpoint textbox with the configured endpoint
- The endpoint change triggers the same behavior as manually entering an endpoint
- Buttons are fully accessible with ARIA labels

**User-Defined Custom Buttons:**

Users can add their own custom endpoint buttons through the Settings menu:
1. Click the Settings button (⚙) in the controlbar
2. Navigate to the "Endpoint Buttons" tab
3. Enter a button label and endpoint URL
4. Click "+ Add Button"
5. Click "Save" to apply changes

Custom buttons are persisted in local storage and will appear alongside the configured buttons.

**CSS Customization:**

You can customize button appearance using CSS variables:

```css
:root {
  --yasgui-endpoint-button-bg: #f0f0f0;
  --yasgui-endpoint-button-border: #ccc;
  --yasgui-endpoint-button-text: #333;
  --yasgui-endpoint-button-hover-bg: #e0e0e0;
  --yasgui-endpoint-button-hover-border: #999;
  --yasgui-endpoint-button-focus: #0066cc;
}
```

### Theme Configuration

YASGUI supports both light and dark themes with comprehensive customization options.

**Configuration Options:**

```javascript
// Set initial theme
const yasgui = new Yasgui(element, {
  theme: 'dark',           // 'light' or 'dark'
  showThemeToggle: true    // Show/hide theme toggle button (default: true)
});
```

**Programmatic Theme Control:**

```javascript
// Get current theme
const currentTheme = yasgui.getTheme(); // Returns 'light' or 'dark'

// Set theme
yasgui.setTheme('dark');  // Switch to dark theme
yasgui.setTheme('light'); // Switch to light theme

// Toggle theme
const newTheme = yasgui.toggleTheme(); // Switch and return new theme
```

**TypeScript Support:**

```typescript
import Yasgui, { Theme } from '@matdata/yasgui';

const theme: Theme = 'dark'; // Type-safe: only 'light' or 'dark' allowed
yasgui.setTheme(theme);
```

**Theme Persistence:**

The selected theme is automatically saved to localStorage under the key `yasgui_theme`:
- Theme preference persists across page reloads
- Each user's preference is independent
- No server-side configuration needed

**System Theme Detection:**

If no theme is explicitly set and no saved preference exists, YASGUI will:
1. Check the system's color scheme preference (`prefers-color-scheme` media query)
2. Apply dark theme if system prefers dark mode
3. Apply light theme otherwise
4. Automatically update if the user changes their system preference

**CSS Customization:**

You can customize theme colors by overriding CSS custom properties:

```css
/* Custom dark theme colors */
[data-theme="dark"] {
  --yasgui-bg-primary: #0d1117;
  --yasgui-accent-color: #58a6ff;
  /* Override other variables as needed */
}
```

**Available CSS Custom Properties:**

```css
--yasgui-bg-primary       /* Primary background color */
--yasgui-bg-secondary     /* Secondary background (hover states, etc.) */
--yasgui-bg-tertiary      /* Tertiary background */
--yasgui-text-primary     /* Primary text color */
--yasgui-text-secondary   /* Secondary text color */
--yasgui-text-muted       /* Muted text color */
--yasgui-border-color     /* Primary border color */
--yasgui-link-color       /* Link color */
--yasgui-accent-color     /* Accent color for highlights */
--yasgui-error-color      /* Error message color */
/* ... and more */
```

**Browser Compatibility:**

Themes work in all modern browsers that support:
- CSS Custom Properties
- localStorage
- Media Queries (for system theme detection)

This includes all recent versions of Chrome, Firefox, Safari, and Edge.

---

## API Reference

### Yasgui Class

Main YASGUI instance.

#### Constructor

```typescript
new Yasgui(parent: HTMLElement, config?: PartialConfig)
```

**Parameters:**
- `parent`: DOM element to attach YASGUI to
- `config`: Optional configuration object

**Example:**
```javascript
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  requestConfig: { endpoint: 'https://dbpedia.org/sparql' }
});
```

#### Methods

##### `getTab(tabId?: string): Tab | undefined`

Get a tab instance by ID. If no ID provided, returns current tab.

```javascript
const currentTab = yasgui.getTab();
const specificTab = yasgui.getTab('tab-123');
```

##### `addTab(select?: boolean, config?: PartialTabConfig): Tab`

Add a new query tab.

**Parameters:**
- `select`: Whether to select the new tab (default: false)
- `config`: Optional tab configuration

```javascript
const newTab = yasgui.addTab(true, {
  name: 'My Query',
  yasqe: {
    value: 'SELECT * WHERE { ?s ?p ?o } LIMIT 10'
  }
});
```

##### `selectTabId(tabId: string): void`

Select a tab by ID.

```javascript
yasgui.selectTabId('tab-123');
```

##### `closeTab(tab: Tab): void`

Close a tab.

```javascript
const tab = yasgui.getTab();
yasgui.closeTab(tab);
```

##### `getTabs(): { [tabId: string]: Tab }`

Get all tabs.

```javascript
const allTabs = yasgui.getTabs();
Object.keys(allTabs).forEach(id => {
  console.log('Tab:', allTabs[id].getName());
});
```

##### `setTheme(theme: 'light' | 'dark'): void`

Set the theme.

```javascript
yasgui.setTheme('dark');
```

##### `getTheme(): 'light' | 'dark'`

Get the current theme.

```javascript
const theme = yasgui.getTheme();
console.log('Current theme:', theme);
```

##### `toggleTheme(): 'light' | 'dark'`

Toggle between themes and return the new theme.

```javascript
const newTheme = yasgui.toggleTheme();
console.log('Switched to:', newTheme);
```

### Tab Class

Represents a query tab.

#### Methods

##### `getName(): string`

Get tab name.

```javascript
const name = tab.getName();
```

##### `setName(name: string): void`

Set tab name.

```javascript
tab.setName('My Query Tab');
```

##### `getId(): string`

Get tab ID.

```javascript
const id = tab.getId();
```

##### `getYasqe(): Yasqe`

Get YASQE instance for this tab.

```javascript
const yasqe = tab.getYasqe();
yasqe.setValue('SELECT * WHERE { ?s ?p ?o }');
```

##### `getYasr(): Yasr`

Get YASR instance for this tab.

```javascript
const yasr = tab.getYasr();
yasr.draw();
```

##### `query(): Promise<void>`

Execute the query in this tab.

```javascript
tab.query()
  .then(() => console.log('Query completed'))
  .catch(err => console.error('Query failed:', err));
```

##### `setQuery(query: string): void`

Set the query value.

```javascript
tab.setQuery('SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10');
```

##### `getQuery(): string`

Get the current query.

```javascript
const query = tab.getQuery();
console.log('Current query:', query);
```

### Yasqe Class

SPARQL query editor.

#### Methods

##### `getValue(): string`

Get the query text.

```javascript
const query = yasqe.getValue();
```

##### `setValue(value: string): void`

Set the query text.

```javascript
yasqe.setValue('SELECT * WHERE { ?s ?p ?o } LIMIT 10');
```

##### `query(): Promise<any>`

Execute the query.

```javascript
yasqe.query()
  .then(response => console.log('Results:', response))
  .catch(err => console.error('Error:', err));
```

##### `abortQuery(): void`

Abort the current query.

```javascript
yasqe.abortQuery();
```

##### `format(): void`

Format the query using the selected formatter.

```javascript
yasqe.format();
```

##### `getPrefixes(): Prefixes`

Get defined prefixes in the query.

```javascript
const prefixes = yasqe.getPrefixes();
console.log('Prefixes:', prefixes);
```

##### `addPrefixes(prefixes: Prefixes): void`

Add prefixes to the query.

```javascript
yasqe.addPrefixes({
  foaf: 'http://xmlns.com/foaf/0.1/',
  dc: 'http://purl.org/dc/elements/1.1/'
});
```

##### `removePrefixes(): void`

Remove all PREFIX declarations from the query.

```javascript
yasqe.removePrefixes();
```

### Yasr Class

SPARQL results viewer.

#### Methods

##### `setResponse(response: any, duration?: number): void`

Set the query response to display.

```javascript
yasr.setResponse(response, 1234);  // duration in ms
```

##### `draw(): void`

Redraw the current plugin.

```javascript
yasr.draw();
```

##### `selectPlugin(pluginName: string): void`

Select a specific plugin.

```javascript
yasr.selectPlugin('table');
```

##### `getPlugins(): { [name: string]: Plugin }`

Get all registered plugins.

```javascript
const plugins = yasr.getPlugins();
console.log('Available plugins:', Object.keys(plugins));
```

##### `executeQuery(query: string, options?: PluginQueryOptions): Promise<any>`

Execute a background SPARQL query on behalf of a plugin. This delegates to the
`executeQuery` callback in the YASR configuration and returns the raw response
without replacing the currently displayed results.

The returned response object has the following shape:

```typescript
{
  ok: boolean;          // true if HTTP status is 2xx
  status: number;       // HTTP status code
  statusText: string;   // HTTP status text
  headers: Headers;     // Response headers
  content: string;      // Raw response body
  data: string;         // Alias for content
  json(): Promise<any>; // Parse content as JSON
  text(): Promise<string>; // Return content as string
}
```

Plugins can use this to fetch additional data (e.g. expanding a node in a graph
visualization) without interfering with the main query results.

```javascript
// Inside a plugin
const response = await this.yasr.executeQuery(
  'DESCRIBE <http://example.org/resource>',
  { acceptHeader: 'text/turtle' }
);
const turtle = await response.text();
```

If no `executeQuery` callback is configured, the returned Promise rejects with
an error.

##### `download(filename?: string): void`

Download results using current plugin's download method.

```javascript
yasr.download('my-results.csv');
```

---

## Events

YASGUI uses an event-driven architecture. All components extend EventEmitter and emit events for various actions.

### YASGUI Events

Listen to events on the main YASGUI instance:

```javascript
const yasgui = new Yasgui(element);

// Tab events
yasgui.on('tabSelect', (instance, tabId) => {
  console.log('Tab selected:', tabId);
});

yasgui.on('tabAdd', (instance, tabId) => {
  console.log('Tab added:', tabId);
});

yasgui.on('tabClose', (instance, tab) => {
  console.log('Tab closed:', tab.getName());
});

yasgui.on('tabChange', (instance, tab) => {
  console.log('Tab changed:', tab.getName());
});

yasgui.on('tabOrderChanged', (instance, tabList) => {
  console.log('Tab order changed:', tabList);
});

// Query events
yasgui.on('query', (instance, tab) => {
  console.log('Query started on tab:', tab.getName());
});

yasgui.on('queryBefore', (instance, tab) => {
  console.log('Query about to start on tab:', tab.getName());
});

yasgui.on('queryResponse', (instance, tab) => {
  console.log('Query completed on tab:', tab.getName());
});

yasgui.on('queryAbort', (instance, tab) => {
  console.log('Query aborted on tab:', tab.getName());
});

// Fullscreen events
yasgui.on('fullscreen-enter', (instance) => {
  console.log('Entered fullscreen');
});

yasgui.on('fullscreen-leave', (instance) => {
  console.log('Exited fullscreen');
});

// Autocomplete events
yasgui.on('autocompletionShown', (instance, tab, widget) => {
  console.log('Autocomplete shown on tab:', tab.getName());
});

yasgui.on('autocompletionClose', (instance, tab) => {
  console.log('Autocomplete closed on tab:', tab.getName());
});

// Endpoint events
yasgui.on('endpointHistoryChange', (instance, history) => {
  console.log('Endpoint history updated:', history);
});
```

### YASQE Events

Listen to events on YASQE instances:

```javascript
const yasqe = new Yasqe(element);

yasqe.on('query', (instance, request, abortController) => {
  console.log('Query started with endpoint:', request.url);
});

yasqe.on('queryBefore', (instance, config) => {
  console.log('Query about to start with config:', config);
  // Modify config here if needed
});

yasqe.on('queryResponse', (instance, response, duration) => {
  console.log('Query completed in', duration, 'ms');
});

yasqe.on('queryResults', (instance, results, duration) => {
  console.log('Results received:', results);
});

yasqe.on('queryAbort', (instance, request) => {
  console.log('Query aborted');
});

yasqe.on('error', (instance) => {
  console.log('Error occurred');
});

yasqe.on('blur', (instance) => {
  console.log('Editor lost focus');
});

yasqe.on('autocompletionShown', (instance, widget) => {
  console.log('Autocomplete widget shown');
});

yasqe.on('autocompletionClose', (instance) => {
  console.log('Autocomplete closed');
});

yasqe.on('resize', (instance, newSize) => {
  console.log('Editor resized to:', newSize);
});

// Editor events (Yasqe wraps a CodeMirror 6 EditorView and re-emits CodeMirror 5-style events)
yasqe.on('change', (instance, changeObj) => {
  console.log('Editor content changed');
});

yasqe.on('cursorActivity', (instance) => {
  console.log('Cursor moved');
});
```

### YASR Events

Listen to events on YASR instances:

```javascript
const yasr = new Yasr(element);

yasr.on('change', (instance) => {
  console.log('YASR state changed');
});

yasr.on('draw', (instance, plugin) => {
  console.log('Started drawing with plugin:', plugin.label);
});

yasr.on('drawn', (instance, plugin) => {
  console.log('Finished drawing with plugin:', plugin.label);
});

yasr.on('toggle-help', (instance) => {
  console.log('Help toggled');
});
```

### Event Example: Query Tracking

Track query execution time and results:

```javascript
const yasgui = new Yasgui(element);

yasgui.on('queryBefore', (instance, tab) => {
  tab.queryStartTime = Date.now();
  console.log('Query started:', tab.getQuery());
});

yasgui.on('queryResponse', (instance, tab) => {
  const duration = Date.now() - tab.queryStartTime;
  console.log('Query completed in', duration, 'ms');
  
  const yasr = tab.getYasr();
  if (yasr.results) {
    console.log('Result type:', yasr.results.getType());
    if (yasr.results.getType() === 'json') {
      const bindings = yasr.results.getBindings();
      console.log('Result count:', bindings?.length || 0);
    }
  }
});

yasgui.on('queryAbort', (instance, tab) => {
  console.log('Query aborted after', Date.now() - tab.queryStartTime, 'ms');
});
```

### Event Example: Custom Query Logging

Log all queries to a backend service:

```javascript
yasgui.on('query', async (instance, tab) => {
  const logData = {
    query: tab.getQuery(),
    endpoint: tab.getYasqe().config.requestConfig.endpoint,
    timestamp: new Date().toISOString(),
    tabName: tab.getName()
  };
  
  try {
    await fetch('/api/log-query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    });
  } catch (err) {
    console.error('Failed to log query:', err);
  }
});
```

---

## Plugin Development

YASR uses a plugin system for result visualization. You can create custom plugins to visualize results in new ways.

### Plugin Interface

A YASR plugin must implement the `Plugin` interface:

```typescript
interface Plugin<Options = any> {
  // Priority for automatic plugin selection (higher = preferred)
  priority: number;

  // Label shown in plugin selector
  label?: string;

  // Plugin-specific options
  options?: Options;

  // Hide plugin from manual selection
  hideFromSelection?: boolean;

  // Help/documentation URL
  helpReference?: string;

  // Determine if this plugin can handle current results
  canHandleResults(): boolean;

  // Initialize plugin (async setup)
  initialize?(): Promise<void>;

  // Cleanup when plugin destroyed
  destroy?(): void;

  // Draw visualization
  draw(persistentConfig: any, runtimeConfig?: any): Promise<void> | void;

  // Return plugin icon for selector
  getIcon(): Element | undefined;

  // Provide download functionality
  download?(filename?: string): DownloadInfo | undefined;
}

#### Background Queries from Plugins

Plugins can execute additional SPARQL queries via `this.yasr.executeQuery()`
without overwriting the currently displayed results. This is useful for
interactive features like expanding a node in a graph visualization.

The query runs in **silent mode** — no YASQE lifecycle events (`queryBefore`,
`queryResponse`, etc.) are emitted and `yasr.setResponse()` is not called, so
the visible results remain unchanged.

```typescript
// Example: fetch additional data when a user interacts with a result
async expandNode(uri: string): Promise<void> {
  const controller = new AbortController();

  const response = await this.yasr.executeQuery(
    `DESCRIBE <${uri}>`,
    {
      acceptHeader: 'text/turtle',
      signal: controller.signal,
    }
  );

  const body = await response.text();
  // … parse and merge into the current visualization
}
```

**Response shape** — see [`executeQuery()` method](#executequeryquery-string-options-pluginqueryoptions-promiseany)
for the full response object description.

**Cancellation** — pass an `AbortSignal` via `options.signal` to cancel
in-flight requests (e.g. when the user navigates away or triggers a new
expansion before the previous one finishes).

```typescript
interface DownloadInfo {
  contentType: string;
  getData: () => string;
  filename: string;
  title: string;
}
```

### Step-by-Step Plugin Development Guide

#### Step 1: Create Plugin Class

Create a class implementing the Plugin interface:

```typescript
import { Plugin } from '@matdata/yasr';

export default class MyCustomPlugin implements Plugin {
  private yasr: Yasr;
  private container: HTMLElement;
  
  // Priority for auto-selection (higher = more likely to be auto-selected)
  public priority = 5;
  
  // Label shown in UI
  public label = 'My Visualization';
  
  // Help URL
  public helpReference = 'https://example.com/help';

  constructor(yasr: Yasr) {
    this.yasr = yasr;
    this.container = document.createElement('div');
    this.container.className = 'my-custom-plugin';
    yasr.resultsEl.appendChild(this.container);
  }

  // Determine if this plugin can visualize current results
  canHandleResults(): boolean {
    // Check if results exist and are of the right type
    if (!this.yasr.results) return false;
    
    // Example: only handle SELECT query results
    const results = this.yasr.results;
    if (results.getType() === 'json') {
      return true;
    }
    
    return false;
  }

  // Return icon for plugin selector
  getIcon(): Element | undefined {
    const icon = document.createElement('span');
    icon.textContent = '📊';  // Or use SVG
    return icon;
  }

  // Draw the visualization
  async draw(persistentConfig: any, runtimeConfig?: any): Promise<void> {
    if (!this.yasr.results) return;
    
    // Clear container
    this.container.innerHTML = '';
    
    // Get results
    const bindings = this.yasr.results.getBindings();
    if (!bindings) return;
    
    // Create your visualization
    const table = document.createElement('table');
    table.className = 'my-custom-table';
    
    // Add headers
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const vars = this.yasr.results.getVariables();
    vars?.forEach(varName => {
      const th = document.createElement('th');
      th.textContent = varName;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Add data rows
    const tbody = document.createElement('tbody');
    bindings.forEach(binding => {
      const row = document.createElement('tr');
      vars?.forEach(varName => {
        const td = document.createElement('td');
        const value = binding[varName];
        td.textContent = value?.value || '';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    this.container.appendChild(table);
  }

  // Optional: Provide download functionality
  download(filename?: string): DownloadInfo | undefined {
    if (!this.yasr.results) return undefined;
    
    // Generate CSV
    const bindings = this.yasr.results.getBindings();
    const vars = this.yasr.results.getVariables();
    
    let csv = vars?.join(',') + '\n';
    bindings?.forEach(binding => {
      const row = vars?.map(v => {
        const val = binding[v]?.value || '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
      csv += row + '\n';
    });
    
    return {
      contentType: 'text/csv',
      getData: () => csv,
      filename: filename || 'results.csv',
      title: 'Download as CSV'
    };
  }

  // Optional: Cleanup
  destroy(): void {
    this.container.remove();
  }
}
```

#### Step 2: Register Plugin

Register your plugin with YASR:

```javascript
import Yasr from '@matdata/yasr';
import MyCustomPlugin from './MyCustomPlugin';

// Register globally
Yasr.registerPlugin('MyCustomPlugin', MyCustomPlugin);

// Now use YASR as normal
const yasr = new Yasr(element);
```

Or register for a specific YASR instance:

```javascript
const yasr = new Yasr(element);
yasr.registerPlugin('MyCustomPlugin', MyCustomPlugin);
```

#### Step 3: Configure Plugin

Configure plugin-specific options:

```javascript
const yasr = new Yasr(element, {
  plugins: {
    MyCustomPlugin: {
      priority: 10,
      // Custom plugin options
      customOption: 'value'
    }
  }
});
```

#### Step 4: Add Styling

Create a CSS file for your plugin:

```css
.my-custom-plugin {
  padding: 20px;
  background: var(--yasgui-bg-primary);
  color: var(--yasgui-text-primary);
}

.my-custom-table {
  width: 100%;
  border-collapse: collapse;
}

.my-custom-table th,
.my-custom-table td {
  padding: 8px;
  border: 1px solid var(--yasgui-border-color);
  text-align: left;
}

.my-custom-table th {
  background: var(--yasgui-bg-secondary);
  font-weight: bold;
}

/* Dark theme support */
[data-theme="dark"] .my-custom-plugin {
  background: var(--yasgui-bg-primary);
}
```

### Plugin Example: Chart Plugin

Complete example of a chart visualization plugin:

```typescript
import { Plugin } from '@matdata/yasr';
import Chart from 'chart.js/auto';

export default class ChartPlugin implements Plugin {
  private yasr: Yasr;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private chart: Chart | null = null;
  
  public priority = 7;
  public label = 'Chart';
  public helpReference = 'https://example.com/chart-help';

  constructor(yasr: Yasr) {
    this.yasr = yasr;
    this.container = document.createElement('div');
    this.container.className = 'yasr-chart-plugin';
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    yasr.resultsEl.appendChild(this.container);
  }

  canHandleResults(): boolean {
    if (!this.yasr.results) return false;
    
    // Only handle SELECT results with numeric values
    const results = this.yasr.results;
    if (results.getType() !== 'json') return false;
    
    const vars = results.getVariables();
    const bindings = results.getBindings();
    
    // Need at least 2 variables (label and value)
    if (!vars || vars.length < 2 || !bindings || bindings.length === 0) {
      return false;
    }
    
    // Check if second variable contains numbers
    const firstBinding = bindings[0];
    const valueVar = vars[1];
    const value = firstBinding[valueVar]?.value;
    
    return !isNaN(parseFloat(value));
  }

  getIcon(): Element | undefined {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '24');
    icon.setAttribute('height', '24');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M3 13h2v8H3zm4-4h2v12H7zm4-4h2v16h-2zm4 2h2v14h-2zm4 4h2v10h-2z');
    path.setAttribute('fill', 'currentColor');
    
    icon.appendChild(path);
    return icon;
  }

  async draw(persistentConfig: any, runtimeConfig?: any): Promise<void> {
    if (!this.yasr.results) return;
    
    const results = this.yasr.results;
    const vars = results.getVariables();
    const bindings = results.getBindings();
    
    if (!vars || !bindings) return;
    
    // Extract data
    const labels: string[] = [];
    const data: number[] = [];
    
    bindings.forEach(binding => {
      const label = binding[vars[0]]?.value || '';
      const value = parseFloat(binding[vars[1]]?.value || '0');
      labels.push(label);
      data.push(value);
    });
    
    // Destroy previous chart
    if (this.chart) {
      this.chart.destroy();
    }
    
    // Create chart
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: vars[1],
          data: data,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  destroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
    this.container.remove();
  }
}
```

### Plugin Best Practices

1. **Theme Support**: Use CSS custom properties for colors
2. **Responsive**: Make visualizations responsive to container size
3. **Error Handling**: Gracefully handle invalid or missing data
4. **Performance**: Optimize for large result sets
5. **Accessibility**: Include ARIA labels and keyboard navigation
6. **Documentation**: Provide clear documentation and examples
7. **TypeScript**: Use TypeScript for better type safety
8. **Testing**: Write unit tests for your plugin

### Theme Support for Plugins

YASGUI uses a centralized theme system that plugins should integrate with to provide a consistent user experience across light and dark modes.

#### Implementation Steps

**1. Detect the Current Theme**

Read the `data-theme` attribute on `document.documentElement`:

```javascript
const currentTheme = document.documentElement.getAttribute('data-theme');
// Returns: "light" or "dark"
```

**2. Use CSS Custom Properties**

Use YASGUI's CSS custom properties for consistent theming:

```css
/* Light mode (default) */
.my-plugin-container {
  background-color: var(--yasgui-bg-primary);
  color: var(--yasgui-text-primary);
  border: 1px solid var(--yasgui-border-color);
}

.my-plugin-element {
  fill: var(--yasgui-accent-color);
  stroke: var(--yasgui-border-color);
}

/* Dark mode overrides */
[data-theme="dark"] .my-plugin-tooltip {
  background-color: var(--yasgui-bg-secondary);
  color: var(--yasgui-text-primary);
  border-color: var(--yasgui-border-color);
}
```

**Available CSS Custom Properties:**

- **Background Colors**: `--yasgui-bg-primary`, `--yasgui-bg-secondary`, `--yasgui-bg-tertiary`
- **Text Colors**: `--yasgui-text-primary`, `--yasgui-text-secondary`
- **Accent Colors**: `--yasgui-accent-color`, `--yasgui-link-hover`
- **Border Colors**: `--yasgui-border-color`, `--yasgui-input-border`, `--yasgui-input-focus`
- **Button Colors**: `--yasgui-button-text`, `--yasgui-button-hover`
- **Other Colors**: `--yasgui-notification-bg`, `--yasgui-notification-text`

**3. Watch for Theme Changes**

Use a `MutationObserver` to detect theme changes:

```javascript
class MyPlugin {
  constructor(yasr) {
    this.yasr = yasr;
    this.initializeTheme();
    this.watchThemeChanges();
  }

  initializeTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    this.applyTheme(theme);
  }

  watchThemeChanges() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const theme = document.documentElement.getAttribute('data-theme');
          this.applyTheme(theme);
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  applyTheme(theme) {
    const styles = getComputedStyle(document.documentElement);
    
    // Extract colors from CSS custom properties
    this.config.colors = {
      background: styles.getPropertyValue('--yasgui-bg-primary').trim(),
      text: styles.getPropertyValue('--yasgui-text-primary').trim(),
      accent: styles.getPropertyValue('--yasgui-accent-color').trim(),
      border: styles.getPropertyValue('--yasgui-border-color').trim()
    };

    // Update your visualization
    this.redraw();
  }
}
```

**4. Add Smooth Transitions**

Include CSS transitions for smooth theme switching:

```css
.my-plugin-container,
.my-plugin-node,
.my-plugin-link,
.my-plugin-text {
  transition: fill 0.3s ease, stroke 0.3s ease, 
              background-color 0.3s ease, color 0.3s ease;
}
```

**Elements to Theme:**

Ensure you apply theme colors to all visual elements:
- Graph/Visualization backgrounds
- Nodes/Points and their borders
- Edges/Links between nodes
- Text labels and annotations
- Tooltips (background, text, and borders)
- Control buttons (zoom, pan, etc.)
- Legends and explanatory text
- Loading indicators and error messages
- Selection highlights

**Testing:**

Test your plugin in both themes:
1. **Light Mode**: Verify proper contrast and readability
2. **Dark Mode**: Ensure colors work well on dark backgrounds
3. **Theme Switching**: Verify smooth transitions without visual glitches
4. **Theme Persistence**: Check that the theme persists across page reloads

### Distributing Your Plugin

Package and distribute your plugin:

```json
{
  "name": "yasr-my-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@matdata/yasr": "^4.0.0"
  }
}
```

Users can install and use it:

```bash
npm install yasr-my-plugin
```

```javascript
import Yasr from '@matdata/yasr';
import MyPlugin from 'yasr-my-plugin';

Yasr.registerPlugin('MyPlugin', MyPlugin);
```

---

## Using the Graph Plugin

The Graph Plugin is a specialized YASR plugin for visualizing SPARQL CONSTRUCT and DESCRIBE query results as interactive, force-directed graphs with advanced customization capabilities.

### Installation

**NPM:**

```bash
npm install @matdata/yasgui-graph-plugin
```

```javascript
import Yasgui from '@matdata/yasgui';
import GraphPlugin from '@matdata/yasgui-graph-plugin';

Yasgui.Yasr.registerPlugin('Graph', GraphPlugin);

const yasgui = new Yasgui(document.getElementById('yasgui'));
```

**CDN (UMD):**

```html
<!-- YASGUI -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@matdata/yasgui/build/yasgui.min.css">
<script src="https://cdn.jsdelivr.net/npm/@matdata/yasgui/build/yasgui.min.js"></script>

<!-- Graph Plugin -->
<script src="https://cdn.jsdelivr.net/npm/@matdata/yasgui-graph-plugin/dist/yasgui-graph-plugin.min.js"></script>

<script>
  // Plugin auto-registers as 'graph'
  const yasgui = new Yasgui(document.getElementById('yasgui'));
</script>
```

### Key Features

- **🔷 Interactive Force-Directed Layout**: Automatic physics-based node positioning
- **🎨 Smart Color Coding**: Color-coded nodes by type (URIs, literals, blank nodes, classes)
- **🖼️ Node Icons & Images**: Support for `schema:image` and `schema:icon` properties
- **📦 Compact Mode**: Hide literal/class nodes and show info in tooltips
- **🔍 Advanced Navigation**: Zoom, pan, and "Zoom to Fit" functionality
- **✋ Drag & Drop**: Reorganize nodes with automatic pinning
- **💬 Rich HTML Tooltips**: Detailed node/edge information on hover  
- **🌓 Theme Support**: Automatic light/dark mode with dynamic color switching
- **♿ Accessibility**: WCAG AA color contrast and keyboard navigation

### Configuration Options

The plugin provides extensive configuration through a settings panel (⚙ button). All settings are automatically persisted to localStorage.

**Available Settings:**

```typescript
interface GraphPluginSettings {
  compactMode: boolean;        // Hide literals and classes (default: false)
  edgeStyle: 'curved' | 'straight';  // Edge appearance (default: 'curved')
  predicateDisplay: 'label' | 'icon' | 'hidden';  // Predicate visibility (default: 'icon')
  showLiterals: boolean;       // Include literal nodes (default: true)
  showClasses: boolean;        // Include rdf:type object nodes (default: true)
  showBlankNodes: boolean;     // Include blank nodes (default: true)
  showLabels: boolean;         // Display node labels (default: true)
  physics: boolean;            // Enable force-directed layout (default: true)
  nodeSize: 'small' | 'medium' | 'large';  // Node radius (default: 'medium')
}
```

**Programmatic Configuration:**

```javascript
class CustomGraphPlugin extends GraphPlugin {
  constructor(yasr) {
    super(yasr);
    // Override defaults
    this.settings.edgeStyle = 'straight';
    this.settings.predicateDisplay = 'label';
    this.settings.nodeSize = 'large';
    this.settings.compactMode = true;
  }
}

Yasgui.Yasr.registerPlugin('customGraph', CustomGraphPlugin);
```

### Color Scheme

The plugin uses a semantic color scheme:

| Color | Hex Code | Meaning | Example |
|-------|----------|---------|---------|
| Light Blue | #97C2FC | URI nodes | `ex:Person`, `ex:Alice` |
| Light Green | #a6c8a6ff | Literal values | `"Alice"`, `"30"^^xsd:integer` |
| Light Grey | #c5c5c5ff | Blank nodes | `_:b1`, `_:addr1` |
| Orange | #e15b13ff | rdf:type objects (classes) | `ex:Person` in `ex:Alice rdf:type ex:Person` |

Colors automatically adjust for dark mode with appropriate contrast ratios.

### Node Icons and Images

The plugin supports custom node visualization using standard Schema.org properties:

**`schema:image` (https://schema.org/image):**
- Accepts a URL literal or URI
- Renders the node as a circular image
- Image is loaded asynchronously

**`schema:icon` (https://schema.org/icon):**
- Accepts emoji or short text string
- Displays as the node's label
- Takes priority over `schema:image`

**Compact Mode Inheritance:**

In compact mode, when class nodes are hidden, resources inherit icons/images from their `rdf:type` class:

1. Direct property on resource (highest priority)
2. Property on `rdf:type` class
3. Property on `rdfs:subClassOf` superclass (one hop)

**Example:**

```sparql
CONSTRUCT {
  ex:alice  schema:image <https://example.com/alice.png> .
  ex:alice  rdf:type ex:Person .
  ex:Person schema:icon "👤" .
  ex:bob    rdf:type ex:Person .
}
WHERE {}
```

- `ex:alice`: Shows as circular image (direct `schema:image`)
- `ex:bob`: In compact mode, inherits "👤" from `ex:Person` class
- `ex:Person`: Hidden in compact mode

### Predicate Icons

When `predicateDisplay` is set to `'icon'`, common predicates display as compact symbols:

**RDF/RDFS:**
- `rdf:type` → `a`
- `rdfs:label` → `lbl`
- `rdfs:comment` → `cmt`
- `rdfs:subClassOf` → `⊂`
- `rdfs:subPropertyOf` → `⊆`

**OWL:**
- `owl:sameAs` → `≡`
- `owl:equivalentClass` → `≅`
- `owl:inverseOf` → `⇄`
- `owl:disjointWith` → `≠`

**SKOS:**
- `skos:prefLabel` → `★`
- `skos:altLabel` → `☆`
- `skos:broader` → `↑`
- `skos:narrower` → `↓`
- `skos:related` → `↔`

**Dublin Core / FOAF / Schema.org:**
- `dcterms:title` → `ttl`
- `dcterms:creator` → `by`
- `foaf:knows` → `⟷`
- `schema:name` → `nm`
- And many more...

See the [full list](https://github.com/Matdata-eu/yasgui-graph-plugin#predicate-icons) in the repository.

### API Reference

**Plugin Properties:**

```typescript
class GraphPlugin {
  // Settings object (auto-persisted to localStorage)
  settings: GraphPluginSettings;
  
  // vis-network instance
  network: Network;
  
  // Current theme ('light' | 'dark')
  theme: string;
}
```

**Plugin Methods:**

```typescript
// Inherited from Plugin interface
canHandleResults(): boolean;  // Returns true for CONSTRUCT/DESCRIBE
draw(): Promise<void>;        // Renders the graph
destroy(): void;              // Cleanup

// Graph-specific
updateColors(): void;         // Apply theme colors
resetView(): void;            // Reset zoom/pan to fit all nodes
```

### Theme Integration

The Graph Plugin fully integrates with YASGUI's theme system:

1. **Automatic Detection**: Reads `data-theme` attribute from `document.documentElement`
2. **Dynamic Updates**: Uses `MutationObserver` to detect theme changes
3. **Smooth Transitions**: All color changes are animated
4. **CSS Variables**: Leverages YASGUI's CSS custom properties

**Theme-Aware Elements:**
- Background canvas
- Node fill and border colors
- Edge colors
- Tooltip backgrounds and text
- Control button styling
- Settings panel

### Performance Considerations

**Benchmarks:**
- **< 500 nodes**: Excellent performance, smooth interactions
- **500-1,000 nodes**: Good performance, slight delay on initial render
- **> 1,000 nodes**: May experience lag; consider limiting results

**Optimization Tips:**

1. **Use LIMIT in Queries**: Restrict result size
   ```sparql
   CONSTRUCT { ?s ?p ?o }
   WHERE { ?s ?p ?o }
   LIMIT 500
   ```

2. **Disable Physics**: Turn off physics after initial layout for faster interactions

3. **Use Compact Mode**: Reduces node count by hiding literals and classes

4. **Filter Node Types**: Use "Show literals", "Show classes", and "Show blank nodes" toggles

### Browser Requirements

- **ES2018+ Support**: Uses modern JavaScript features
- **Canvas API**: Required for vis-network rendering
- **localStorage**: For settings persistence

**Tested Browsers:**
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

### Example Queries

**Basic CONSTRUCT:**

```sparql
PREFIX ex: <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

CONSTRUCT {
  ex:Alice rdf:type ex:Person .
  ex:Alice ex:knows ex:Bob .
  ex:Alice ex:name "Alice" .
  ex:Bob rdf:type ex:Person .
  ex:Bob ex:name "Bob" .
}
WHERE {}
```

**With Icons:**

```sparql
PREFIX ex: <http://example.org/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX schema: <https://schema.org/>

CONSTRUCT {
  ex:Alice rdf:type ex:Person .
  ex:Person schema:icon "👤" .
  ex:Alice ex:worksFor ex:Company .
  ex:Company rdf:type ex:Organization .
  ex:Organization schema:icon "🏢" .
}
WHERE {}
```

**DESCRIBE Query:**

```sparql
PREFIX ex: <http://example.org/>

DESCRIBE ex:Alice ex:Bob
```

### Troubleshooting

**Plugin tab not showing:**
- Verify CONSTRUCT or DESCRIBE query type
- Check browser console for errors
- Ensure plugin is properly registered

**Empty visualization:**
- Confirm query returns triples (check "Response" or "Table" tab)
- Verify RDF structure is valid
- Check that node filter settings aren't hiding all nodes

**Performance issues:**
- Reduce result size with LIMIT clause
- Disable physics simulation
- Enable compact mode
- Hide literal nodes if not needed

**Icons/images not displaying:**
- Verify `schema:image` URL is accessible (check CORS)
- Ensure `schema:icon` values are valid emoji or short strings
- Check browser console for image loading errors

### Repository

For complete documentation, examples, and source code, visit:
**[https://github.com/Matdata-eu/yasgui-graph-plugin](https://github.com/Matdata-eu/yasgui-graph-plugin)**

---

## Using the Geo Plugin

The Geo Plugin is a YASR plugin that renders geographic SPARQL results on an interactive [Leaflet](https://leafletjs.com/) map. It supports multiple geometry formats, on-the-fly CRS reprojection, drawing-based spatial filters, export, temporal animation, clustering, heatmap rendering, and more.

### Installation

**npm:**

```bash
npm install @matdata/yasgui-geo-plugin
```

```javascript
import Yasgui from '@matdata/yasgui';
import GeoPlugin from '@matdata/yasgui-geo-plugin';

Yasgui.Yasr.registerPlugin('geo', GeoPlugin);

const yasgui = new Yasgui(document.getElementById('yasgui'));
```

**CDN (IIFE bundle):**

The release ships a minified IIFE bundle. Include Leaflet first, then the bundle:

```html
<!doctype html>
<html>
<head>
  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <!-- YASGUI -->
  <link rel="stylesheet" href="https://unpkg.com/@matdata/yasgui/build/yasgui.min.css" />
  <script src="https://unpkg.com/@matdata/yasgui/build/yasgui.min.js"></script>
  <!-- Geo Plugin -->
  <script src="https://unpkg.com/@matdata/yasgui-geo-plugin/dist/yasgui-geo-plugin.min.js"></script>
</head>
<body>
  <div id="yasgui" style="height:600px"></div>
  <script>
    const GeoPlugin = window.YasguiGeoPlugin?.default ?? window.YasguiGeoPlugin;
    Yasgui.Yasr.registerPlugin('geo', GeoPlugin);
    const yasgui = new Yasgui(document.getElementById('yasgui'), {
      requestConfig: { endpoint: 'https://dbpedia.org/sparql' },
      yasr: { pluginOrder: ['table', 'response', 'geo'], defaultPlugin: 'geo' },
    });
  </script>
</body>
</html>
```

### Registering the Plugin

Call `Yasr.registerPlugin` **before** constructing the `Yasgui` instance:

```javascript
import Yasgui from '@matdata/yasgui';
import GeoPlugin from '@matdata/yasgui-geo-plugin';

// Register under the name 'geo'
Yasgui.Yasr.registerPlugin('geo', GeoPlugin);

const yasgui = new Yasgui(document.getElementById('yasgui'), {
  yasr: {
    pluginOrder: ['table', 'response', 'geo'],
    defaultPlugin: 'geo',
  },
});
```

### Quick Configuration

Pass plugin options through Yasgui's `yasr.plugins.geo` slot:

```javascript
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  yasr: {
    pluginOrder: ['table', 'response', 'geo'],
    defaultPlugin: 'geo',
    plugins: {
      geo: {
        defaultColor: '#ff5722',
        defaultBasemap: 'CartoDB Voyager',
        initialView: { center: [50.85, 4.35], zoom: 8 },
        maxZoom: 18,
        clustering: true,
        permalink: true,
      },
    },
  },
});
```

### Key Features

- **Multi-format geometry**: WKT, GeoJSON, GML, GeoHash, and DBpedia/WGS84 literals
- **On-the-fly reprojection**: 15+ embedded SRIDs plus automatic fetch from epsg.io for unknown ones
- **Lat/lon auto-detection**: Numeric `?lat`/`?lon` column pairs are recognized without WKT
- **Per-column layers**: One toggleable overlay per detected geometry column in the layers control
- **Style control**: Persisted default color, opacity, fill, stroke width and marker radius; per-feature `?wktColor` overrides color
- **Marker clustering**: Optional `leaflet.markercluster` integration for large point sets
- **Heatmap**: Optional `leaflet.heat` rendering mode
- **Drawing tools**: Rectangle/polygon drawing emits a ready-to-paste GeoSPARQL `sfWithin` filter
- **Geometry simplification**: turf-simplify with a live tolerance slider
- **Export**: GeoJSON, KML, CSV-with-WKT, PNG screenshot, clipboard copy
- **Temporal filtering**: Time slider with play/pause animation for `?time`/`?date` bindings
- **Permalink**: Map center, zoom, basemap and visible columns encoded in the URL hash
- **Coordinate readout** and **distance measure** tool
- **Dark-mode-aware** default basemap
- **Safe popups**: bindings rendered via DOM APIs (no XSS), IRI linkification, inline image previews
- **Accessibility**: keyboard-focusable popups, semantic buttons, ARIA-labeled plugin icon
- **TypeScript declarations** included

### Options Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultColor` | `string` (CSS color) | `#3388ff` | Color for features without a `?wktColor` binding. |
| `defaultBasemap` | `string` | `'openStreetMap'` | Name of the basemap to activate on startup. Must match a key in `basemaps`. |
| `initialView` | `{ center: [lat, lon], zoom: number }` | Belgium @ 5 | Map center and zoom when no features are present. |
| `maxZoom` | `number` | `14` | Upper bound applied when auto-fitting bounds to features. |
| `minHeight` | `number` (px) | `500` | Minimum height of the map container. |
| `latLonAutoDetect` | `boolean` | `true` | Auto-detect numeric lat/lon column pairs and synthesize a WKT POINT column. |
| `basemaps` | `{ [name]: L.TileLayer }` | built-in | Replace the bundled basemap dictionary entirely. |
| `clustering` | `boolean` | `false` | Enable marker clustering via `leaflet.markercluster`. |
| `clusteringThreshold` | `number` | `100` | Minimum feature count before clustering activates. |
| `heatmap` | `boolean` | `false` | Render points as a heatmap via `leaflet.heat` instead of markers. |
| `styleControl` | `boolean` | `true` | Show the compact style control panel. |
| `styleStorageKey` | `string \| null` | query hash | Override the localStorage key used to persist style-control values. |
| `simplifyTolerance` | `number` | `0` | Initial turf-simplify tolerance in degrees. |
| `simplifyControl` | `boolean` | `true` | Show the live simplification tolerance slider. |
| `simplifyMaxTolerance` | `number` | `0.05` | Maximum tolerance exposed by the slider. |
| `simplifyStep` | `number` | `0.0001` | Slider step size. |
| `timeSlider` | `boolean` | `true` | Show a temporal slider when rows contain time/date-like bindings. |
| `timeBindingNames` | `string[] \| null` | common names | Override recognized temporal binding names. Defaults: `time`, `date`, `datetime`, `timestamp`, `start`, `startDate`. |
| `timeMode` | `'cumulative' \| 'instant'` | `'cumulative'` | Show all features up to the selected time (`cumulative`) or only features at the exact selected time (`instant`). |
| `permalink` | `boolean` | `false` | Persist center, zoom, basemap and visible geometry columns in the URL hash. |
| `exportControl` | `boolean` | `true` | Show the Export control on the map. |
| `drawing` | `boolean` | `true` | Enable rectangle/polygon drawing tools and spatial filter output. |

### Convention-Based Per-Feature Bindings

The plugin reads the following SPARQL variable names from result rows:

| Binding | Effect |
|---|---|
| `?wktColor` | Override fill/stroke color for that feature (CSS color string). |
| `?wktLabel` | Plain-text popup content (replaces the default key/value table). |
| `?wktTooltip` | Hover tooltip text shown on mouse-over. |

### Supported Geometry Types

| Datatype URI | Parsed as |
|---|---|
| `geo:wktLiteral` (`http://www.opengis.net/ont/geosparql#wktLiteral`) | WKT / CRS-prefixed WKT / EWKT |
| `virtrdf:Geometry` (`http://www.openlinksw.com/schemas/virtrdf#Geometry`) | WKT |
| `wgs84:geometry` (`http://www.w3.org/2003/01/geo/wgs84_pos#geometry`) | WKT (DBpedia style) |
| `geo:geoJSONLiteral` | GeoJSON geometry |
| `geo:gmlLiteral` | GML 2/3 geometry |
| `geo:geoHashLiteral` | GeoHash — decoded to center point |

All major WKT geometry types are supported, including `GeometryCollection`.

### CRS and Coordinate Transformations

The plugin follows GeoSPARQL coordinate-order semantics:

- **No CRS specified**: lon/lat order (CRS84 / plain WKT convention)
- **`SRID=4326;` prefix (EWKT)**: lon/lat order
- **`<http://www.opengis.net/def/crs/EPSG/0/4326>` URI prefix**: authority lat/lon order — coordinates are automatically swapped before Leaflet rendering
- **`<http://www.opengis.net/def/crs/OGC/1.3/CRS84>` URI prefix**: lon/lat order

**Embedded SRIDs** (no network request required):
`4326`, `3857`, `31370`, `4258`, `3035`, `25831`, `25832`, `25833`, `2154`, `27700`, `28992`, `3006`, `2056`, `4269`, `3978`

**Auto-loading unknown SRIDs:**

For any SRID not embedded, the helper `ensureProjDef` fetches the proj4 definition from `https://epsg.io/<srid>.proj4` and registers it at runtime:

```javascript
import { ensureProjDef } from '@matdata/yasgui-geo-plugin';

await ensureProjDef('7855');  // GDA2020 / MGA zone 55
geoPlugin.draw();             // re-render after CRS is registered
```

### Drawing Spatial Filters

When `options.drawing` is `true` (default), the map gains rectangle and polygon drawing tools. After finishing a shape, a panel displays a ready-to-paste GeoSPARQL filter:

```sparql
FILTER(geof:sfWithin(?geom, "POLYGON((4.30 50.80, 4.40 50.80, 4.40 50.90, 4.30 50.80))"^^geo:wktLiteral))
```

A **Copy** button copies the snippet to the clipboard. The required prefixes are:

```sparql
PREFIX geo:  <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
```

### Export Capabilities

The **Export** control (top-right of the map, toggle via `exportControl` option) provides:

| Action | Output | Notes |
|---|---|---|
| GeoJSON download | `results.geojson` | Verbatim copy of the in-memory feature collection. |
| Clipboard copy | — | Formatted GeoJSON copied to clipboard. |
| PNG screenshot | `map.png` | Current viewport captured as an image. |
| KML download | `results.kml` | Supports Point, LineString, Polygon (incl. holes). |
| CSV download | `results.csv` | One row per feature with all binding variables plus a `wkt` column. |

### Temporal Filtering

When result rows contain a binding whose name matches `?time`, `?date`, `?datetime`, `?timestamp`, `?start`, or `?startDate`, the plugin displays a time slider with play/pause controls.

- **Cumulative mode** (default): Shows all features with a timestamp up to and including the selected value. Features without a timestamp remain visible at all times.
- **Instant mode**: Shows only features whose timestamp matches the exact selected value.

Configure via the `timeSlider`, `timeMode`, and `timeBindingNames` options.

### Clustering and Heatmap

**Marker clustering** groups nearby points into cluster markers at lower zoom levels, reducing visual clutter for large point datasets:

```javascript
const yasgui = new Yasgui(el, {
  yasr: {
    plugins: {
      geo: {
        clustering: true,
        clusteringThreshold: 50,  // activate when > 50 points
      },
    },
  },
});
```

**Heatmap** renders point intensity as a color gradient. Clustering and heatmap are mutually exclusive — heatmap takes precedence when both are enabled:

```javascript
geo: { heatmap: true }
```

### Permalink Support

When `permalink: true`, the plugin appends map state to the page URL hash on every map move. State encoded:

- Map center (lat/lon) and zoom level
- Active basemap name
- Visible geometry columns (layer visibility)

This lets users share a URL that reopens the map at the same view and layer configuration.

### TypeScript Support

The package ships `index.d.ts` declarations. Import the options type:

```typescript
import GeoPlugin from '@matdata/yasgui-geo-plugin';
import type { GeoPluginOptions } from '@matdata/yasgui-geo-plugin';

const options: GeoPluginOptions = {
  defaultColor: '#e91e63',
  clustering: true,
  permalink: true,
};
```

### Example Queries

**WKT points with custom colors and tooltips:**

```sparql
PREFIX geo: <http://www.opengis.net/ont/geosparql#>

SELECT * WHERE {
  VALUES (?name ?lat ?lon ?wktColor) {
    ("Brussels"  50.8503 4.3517  "blue")
    ("Antwerp"   51.2194 4.4025  "red")
    ("Ghent"     51.0543 3.7174  "green")
  }
  BIND(STRDT(CONCAT("POINT(", STR(?lon), " ", STR(?lat), ")"), geo:wktLiteral) AS ?wkt)
  BIND(?name AS ?wktTooltip)
}
```

**GeoSPARQL endpoint (e.g., GraphDB, Fuseki with GeoSPARQL):**

```sparql
PREFIX geo: <http://www.opengis.net/ont/geosparql#>

SELECT ?feature ?wkt WHERE {
  ?feature a geo:Feature ;
           geo:hasGeometry/geo:asWKT ?wkt .
}
LIMIT 500
```

**Lat/lon auto-detection (no WKT required):**

```sparql
SELECT ?name ?lat ?lon WHERE {
  ?city a <http://dbpedia.org/ontology/City> ;
        <http://www.w3.org/2000/01/rdf-schema#label>    ?name ;
        <http://www.w3.org/2003/01/geo/wgs84_pos#lat>   ?lat ;
        <http://www.w3.org/2003/01/geo/wgs84_pos#long>  ?lon .
  FILTER(LANG(?name) = 'en')
} LIMIT 100
```

When `latLonAutoDetect` is enabled (default), the plugin synthesizes a `POINT` geometry from `?lat` and `?lon` automatically.

**Temporal data:**

```sparql
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?name ?wkt ?date WHERE {
  # ... your query ...
  BIND("2024-03-15"^^xsd:date AS ?date)
}
```

### Troubleshooting

**Geo plugin tab not appearing:**
- Ensure `Yasgui.Yasr.registerPlugin('geo', GeoPlugin)` is called **before** creating the `Yasgui` instance.
- Verify the query returns at least one geometry binding (WKT literal, GeoJSON, etc.) or a `?lat`/`?lon` pair with `latLonAutoDetect: true`.
- Check the browser console for JavaScript errors.

**Map shows no features:**
- Check that geometry literals use a [supported datatype](#supported-geometry-types).
- For `geo:wktLiteral` with a CRS URI prefix, verify the coordinate order matches the CRS specification.
- Switch to the **Table** or **Response** tab to confirm the query returns data.

**CRS reprojection not working:**
- Verify the SRID number in your WKT CRS prefix is correct.
- For non-embedded SRIDs, call `ensureProjDef(srid)` before rendering (see [CRS section](#crs-and-coordinate-transformations)).
- Check the browser console — failed `epsg.io` fetches are logged as warnings.

**Clustering or heatmap not rendering:**
- Ensure `leaflet.markercluster` / `leaflet.heat` are available if you are using the IIFE bundle without a bundler (they are bundled in the npm package).
- Heatmap mode only applies to point geometries; lines and polygons render normally regardless.

**Drawing tools missing:**
- Confirm `options.drawing` is not set to `false`.
- `leaflet-draw` is included in the bundle; no separate installation is needed.

**Export PNG is blank or missing tiles:**
- Most basemap tile servers restrict cross-origin image use. The PNG export captures whatever the browser can render; third-party basemap tiles may be excluded due to CORS policy.
- Switch to a CORS-friendly basemap (e.g., the bundled OpenStreetMap layer) before exporting.

### Repository

For full source code, issue tracker, and additional documentation:
**[https://github.com/Matdata-eu/yasgui-geo-plugin](https://github.com/Matdata-eu/yasgui-geo-plugin)**

Npm package: [`@matdata/yasgui-geo-plugin`](https://www.npmjs.com/package/@matdata/yasgui-geo-plugin)

---

## Contributing

We welcome contributions to YASGUI! Here's how to get involved.

### Getting Started

1. **Fork the Repository**
   ```bash
   git clone https://github.com/Matdata-eu/Matgui.git
   cd Yasgui
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   
   Visit `http://localhost:5173/demo` to see Matgui in action.

4. **Make Changes**
   - Create a feature branch: `git checkout -b feature/my-feature`
   - Make your changes
   - Test locally

5. **Build**
   ```bash
   npm run build
   ```

6. **Run Tests**
   ```bash
   npm test
   ```

7. **Run Linter**
   ```bash
   npm run util:lint
   ```

### Project Structure

```
Yasgui/
├── packages/
│   ├── utils/           # Shared utilities
│   ├── yasqe/           # Query editor
│   ├── yasr/            # Results viewer
│   └── yasgui/          # Main package
├── dev/                 # Development pages
├── build/               # Build output
├── docs/                # Documentation
├── .github/             # GitHub workflows
└── test/                # Tests
```

### Development Workflow

#### Making Changes

1. **Code Style**: Follow the existing code style
   - Use TypeScript
   - Follow ESLint rules (`npm run util:lint`)
   - Use Prettier for formatting (`npm run util:prettify`)

2. **Commit Messages**: Use conventional commit format
   ```
   feat: add new plugin system
   fix: resolve query execution bug
   docs: update API documentation
   style: format code
   refactor: restructure plugin loading
   test: add unit tests for parser
   chore: update dependencies
   ```

3. **Testing**: Add tests for new features
   ```bash
   npm run unit-test        # Unit tests
   npm run puppeteer-test   # E2E tests
   ```

#### Building

```bash
npm run build    # Production build
npm run dev      # Development server
```

#### Pull Requests

1. **Create PR** with clear description
2. **Link Issues**: Reference related issues
3. **Tests**: Ensure all tests pass
4. **Documentation**: Update docs if needed
5. **Changelog**: Add entry if applicable

### Code Guidelines

#### TypeScript

- Use strict TypeScript settings
- Define interfaces for all public APIs
- Avoid `any` types when possible
- Export types for library consumers

```typescript
// Good
interface PluginConfig {
  priority: number;
  enabled: boolean;
}

function configurePlugin(config: PluginConfig): void {
  // Implementation
}

// Avoid
function configurePlugin(config: any) {
  // Implementation
}
```

#### CSS

- Use CSS custom properties for theming
- Follow BEM naming convention
- Support both light and dark themes

```css
/* Good */
.yasgui__header {
  background: var(--yasgui-bg-primary);
  color: var(--yasgui-text-primary);
}

.yasgui__header--collapsed {
  height: 0;
}

/* Avoid inline styles or theme-specific colors */
```

#### Documentation

- Document all public APIs
- Include code examples
- Keep README up to date
- Add JSDoc comments

```typescript
/**
 * Execute a SPARQL query against the configured endpoint.
 * 
 * @param query - The SPARQL query string
 * @param options - Optional request configuration
 * @returns Promise resolving to query results
 * @throws {Error} If query is invalid or network request fails
 * 
 * @example
 * ```typescript
 * const results = await yasqe.query(
 *   'SELECT * WHERE { ?s ?p ?o } LIMIT 10',
 *   { endpoint: 'https://dbpedia.org/sparql' }
 * );
 * ```
 */
async query(query: string, options?: RequestConfig): Promise<any> {
  // Implementation
}
```

### Reporting Issues

When reporting bugs:

1. **Search Existing Issues**: Check if already reported
2. **Provide Details**:
   - Matgui version
   - Browser and version
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages
   - Example query (if applicable)

3. **Use Issue Template**: Follow the provided template

### Feature Requests

When requesting features:

1. **Describe Use Case**: Explain the problem
2. **Propose Solution**: Suggest implementation
3. **Consider Alternatives**: Mention other approaches
4. **Provide Examples**: Show how it would work

### Release Process

Releases are managed using Changesets:

1. **Create Changeset**
   ```bash
   npx changeset
   ```

2. **Select Packages**: Choose affected packages
3. **Describe Changes**: Write changelog entry
4. **Commit**: Commit changeset file

5. **Release** (maintainers only)
   ```bash
   npm run release
   ```

### Community

- **GitHub Discussions**: Ask questions, share ideas
- **Issues**: Report bugs, request features
- **Pull Requests**: Contribute code

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Follow GitHub's Community Guidelines

---

## Additional Resources

- **GitHub Repository**: [https://github.com/Matdata-eu/Yasgui](https://github.com/Matdata-eu/Matgui)
- **Issue Tracker**: [https://github.com/Matdata-eu/Matgui/issues](https://github.com/Matdata-eu/Matgui/issues)
- **User Guide**: See `docs/user-guide.md`
- **SPARQL Specification**: [https://www.w3.org/TR/sparql11-query/](https://www.w3.org/TR/sparql11-query/)
- **CodeMirror 6 Documentation**: [https://codemirror.net/docs/](https://codemirror.net/docs/)
- **Table Plugin**: [https://github.com/Matdata-eu/yasgui-table-plugin](https://github.com/Matdata-eu/yasgui-table-plugin)
- **Graph Plugin**: [https://github.com/Matdata-eu/yasgui-graph-plugin](https://github.com/Matdata-eu/yasgui-graph-plugin)
- **Geo Plugin**: [https://github.com/Matdata-eu/yasgui-geo-plugin](https://github.com/Matdata-eu/yasgui-geo-plugin)

---

*This developer guide is maintained as part of the Matgui project. For user-facing documentation, see the User Guide.*
