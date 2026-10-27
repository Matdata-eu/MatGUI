# MatGUI User Guide

**MatGUI** (formerly *Yasgui*) is a powerful, user-friendly workbench for querying and exploring knowledge graphs and RDF data using SPARQL. This guide will help you understand and make the most of MatGUI's features. 

> The Yasgui project has been renamed Matgui. But this is a brand rename only. The technical name still remains Yasgui for backwards compatibility. Whenever you read 'Matgui' in this document, you can likely read 'yasgui' as well.

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Introduction](#introduction)
- [What is SPARQL?](#what-is-sparql)
  - [Basic Concepts](#basic-concepts)
  - [Learning SPARQL](#learning-sparql)
  - [Common SPARQL Query Types](#common-sparql-query-types)
- [Getting Started](#getting-started)
  - [Accessing MatGUI](#accessing-matgui)
  - [Running Matgui with Docker](#running-matgui-with-docker)
  - [Your First Query](#your-first-query)
  - [Saving Your Work](#saving-your-work)
  - [Querying Local Endpoints](#querying-local-endpoints)
- [Components Overview](#components-overview)
  - [YASQE (Query Editor)](#yasqe-query-editor)
  - [YASR (Results Viewer)](#yasr-results-viewer)
  - [YASGUI (Main Interface)](#yasgui-main-interface)
- [The Interface](#the-interface)
  - [Top Bar](#top-bar)
  - [Search](#search)
  - [Query Card](#query-card)
  - [Endpoint Picker](#endpoint-picker)
  - [Run and Stop](#run-and-stop)
  - [Insert Menu](#insert-menu)
  - [Side Panel](#side-panel)
  - [Saved Status](#saved-status)
  - [Small Screens](#small-screens)
  - [Fonts and Colors](#fonts-and-colors)
- [Features](#features)
  - [Themes](#themes)
  - [Layout Orientation](#layout-orientation)
  - [Query Formatting](#query-formatting)
  - [CONSTRUCT Query Validation](#construct-query-validation)
  - [Code Snippets](#code-snippets)
  - [Fullscreen Mode](#fullscreen-mode)
  - [Prefix Management](#prefix-management)
  - [Endpoint Quick Switch](#endpoint-quick-switch)
  - [Configuration Import/Export](#configuration-importexport)
  - [URI Explorer](#uri-explorer)
  - [Class and Property Autocomplete](#class-and-property-autocomplete)
  - [IRI Hover Info](#iri-hover-info)
  - [Endpoint Overview](#endpoint-overview)
  - [AI Assistant](#ai-assistant)
  - [SPARQL Anything Sources](#sparql-anything-sources)
  - [Query Tabs](#query-tabs)
  - [Settings Modal](#settings-modal)
  - [SPARQL Endpoints Management](#sparql-endpoints-management)
  - [Managed Queries and Workspaces](#managed-queries-and-workspaces)
    - [Workspaces](#workspaces)
      - [SPARQL workspaces](#sparql-workspaces)
      - [Git based workspaces](#git-based-workspaces)
    - [Managed queries](#managed-queries)
  - [Query History and Persistence](#query-history-and-persistence)
  - [Share Queries](#share-queries)
- [Plugins](#plugins)
  - [Table Plugin](#table-plugin)
  - [Boolean Plugin](#boolean-plugin)
  - [Response Plugin](#response-plugin)
  - [Graph Plugin](#graph-plugin)
  - [Geo Plugin](#geo-plugin)
  - [Chart Plugin](#chart-plugin)
  - [Explain Plugin](#explain-plugin)
  - [Error Plugin](#error-plugin)
  - [Plugin Selection](#plugin-selection)
  - [Describing a Resource](#describing-a-resource)
- [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Query Editor (YASQE)](#query-editor-yasqe)
  - [Fullscreen](#fullscreen)
  - [Matgui Tabs](#matgui-tabs)
  - [Workspace](#workspace)
  - [General Editor](#general-editor)
  - [Results Viewer (YASR)](#results-viewer-yasr)
- [Troubleshooting](#troubleshooting)
  - [Common Issues and Solutions](#common-issues-and-solutions)
    - [Query Not Executing](#query-not-executing)
    - [CORS Errors](#cors-errors)
    - [Local Endpoint Issues](#local-endpoint-issues)
    - [Virtuoso Preflight Authentication Issues](#virtuoso-preflight-authentication-issues)
    - [Slow Queries](#slow-queries)
    - [Results Not Displaying Correctly](#results-not-displaying-correctly)
    - [Autocomplete Not Working](#autocomplete-not-working)
    - [Lost Queries](#lost-queries)
    - [Theme/Layout Not Saving](#themelayout-not-saving)
    - [Formatting Issues](#formatting-issues)
    - [AI Assistant Issues](#ai-assistant-issues)
  - [Getting Help](#getting-help)
  - [Best Practices](#best-practices)
- [Additional Resources](#additional-resources)

---

## Introduction

Matgui is a comprehensive SPARQL query interface that combines a powerful query editor (YASQE) with a versatile results viewer (YASR). Whether you're new to SPARQL or an experienced user, Matgui provides an intuitive interface for working with semantic data.

**Key Benefits:**

- Write and execute SPARQL queries against any endpoint
- Visualize results in multiple formats (tables, graphs, maps, etc.)
- Save and manage multiple query tabs
- Auto-complete and syntax highlighting
- Theme support (light and dark modes)
- Responsive layouts for different screen sizes

---

## What is SPARQL?

**SPARQL** (SPARQL Protocol and RDF Query Language) is the standard query language for retrieving and manipulating data stored in RDF (Resource Description Framework) format. Think of it as SQL for linked data and knowledge graphs.

### Basic Concepts

- **Triples**: RDF data is organized as subject-predicate-object statements
- **URIs**: Resources are identified using URIs (Uniform Resource Identifiers)
- **Prefixes**: Shortcuts for long URIs (e.g., `foaf:` for `http://xmlns.com/foaf/0.1/`)
- **Endpoints**: Web services that accept SPARQL queries

### Learning SPARQL

For a comprehensive, beginner-friendly guide to SPARQL, visit:
**[https://kvistgaard.github.io/sparql/](https://kvistgaard.github.io/sparql/)**

This excellent resource covers:

- SPARQL syntax and structure
- Query types (SELECT, CONSTRUCT, ASK, DESCRIBE)
- Filters and functions
- Real-world examples and exercises

### Common SPARQL Query Types

- **SELECT**: Returns a table of results (like SQL SELECT)
- **CONSTRUCT**: Creates new RDF triples from query results
- **ASK**: Returns true/false for whether a pattern exists
- **DESCRIBE**: Returns all information about a resource

---

## Getting Started

### Accessing MatGUI

Matgui is available at: **[https://matgui.matdata.eu/](https://matgui.matdata.eu/)**

### Running Matgui with Docker

You can run Matgui locally using Docker, which is especially useful when working with local SPARQL endpoints.

**Why Use Docker?**

- Avoids browser mixed content restrictions when querying local endpoints
- No need to grant browser permissions for local network access
- Self-contained environment with all dependencies included
- Easy to set up and run

**Running MatGUI:**

```bash
docker run -p 8080:8080 mathiasvda/matgui
```

This command:

- Downloads the Matgui Docker image (first run only)
- Starts Matgui on port 8080
- Makes it accessible at `http://localhost:8080`

**Accessing MatGUI:**

- Open your browser and navigate to: `http://localhost:8080`
- Matgui will load and be ready to use
- You can now query local endpoints without browser permission prompts

**Benefits for Local Endpoints:**

- Both Matgui and your local endpoint use HTTP (no mixed content issues)
- No browser security prompts
- Seamless connection to localhost services
- See [Querying Local Endpoints](#querying-local-endpoints) for more details

**Stopping MatGUI:**

- Press `Ctrl+C` in the terminal where Docker is running
- Or use: `docker stop <container-id>`

**Custom Port:**
To run on a different port (e.g., 3000):

```bash
docker run -p 3000:8080 mathiasvda/matgui
```

Then access at `http://localhost:3000`

### Your First Query

1. **Select an Endpoint**: Enter a SPARQL endpoint URL in the endpoint field (or use the default)
2. **Write a Query**: Type your SPARQL query in the editor
3. **Execute**: Click **Run** at the top of the query card or press `Ctrl+Enter` (`Cmd+Enter` on a Mac)
4. **View Results**: Results appear in the results viewer below

**Example Query:**

```sparql
SELECT ?subject ?predicate ?object
WHERE {
  ?subject ?predicate ?object
}
LIMIT 10
```

### Saving Your Work

Matgui automatically saves:

- Your queries in local storage
- Tab configurations
- User preferences (theme, layout, etc.)

Your work persists across browser sessions on the same device.

### Querying Local Endpoints

Matgui can query SPARQL endpoints running on your local machine (e.g., Apache Jena Fuseki, GraphDB). However, browsers require special permission to access local servers from web applications.

**Steps to Query Local Endpoints:**

1. **Enter Local Endpoint URL**: Add your local endpoint to the endpoint input box
   - Example: `http://localhost:3030/g/`
   - Example: `http://127.0.0.1:3030/dataset/query`

2. **Execute Your Query**: Click **Run** or press `Ctrl+Enter`

3. **Grant Browser Permission**: Your browser will show a permission request to access the local endpoint

   **In Microsoft Edge:**

   ![Permission request dialog](img/local_endpoint_msedge_permission_request.png)
   - Click **"Allow"** to grant permission
   - The permission applies for the domain on which you run Matgui (for example https://matgui.matdata.eu/)

4. **If You Blocked the Request**: You can change the permission later

   ![Change permission settings](img/local_endpoint_msedge_permission_change.png)
   - Click the lock icon in the address bar
   - Find the "Local network access" or similar setting
   - Change it to "Allow"
   - Execute the query again

5. **Permission Denied Error**: If same-origin policy was not accepted, you'll see an error

   ![Permission denied error](img/local_endpoint_msedge_error.png)
   - Follow step 4 to grant permission
   - Re-execute your query

**Other Browsers:**

The process is similar in Chrome, Firefox, and Safari:

- Chrome: the same as Edge (verified by author)
- Firefox: May require setting `security.mixed_content.block_active_content` to false in about:config (unverified by author)
- Safari: Check "Disable local file restrictions" in Develop menu (unverified by author)
- Vivaldi: the same as Edge (verified by author)

**Alternative: Use Docker to Avoid Permission Issues**

If you frequently work with local endpoints, consider running Matgui locally with Docker:

```bash
docker run -p 8080:8080 mathiasvda/matgui
```

Then open your browser and navigate to `http://localhost:8080`.

This eliminates browser permission prompts since both Matgui and your local endpoint use HTTP. See [Running Matgui with Docker](#running-matgui-with-docker) for details.

**Important Notes:**

- Permission is required because Matgui is served over HTTPS while your local endpoint uses HTTP
- This is a browser security feature to protect against mixed content attacks
- You'll need to grant permission once and it should apply for all browser session (when you don't clear cache & settings)
- Consider using HTTPS for your local endpoint for automatic permission

**Troubleshooting Local Endpoints:**

- Ensure your local SPARQL server is running before querying
- Check that the port number is correct (e.g., 3030, 3333, 7200)
- Verify the endpoint path matches your server configuration
- See [Troubleshooting - Local Endpoint Issues](#local-endpoint-issues) for more help

---

## Components Overview

Matgui consists of three main components working together:

### YASQE (Query Editor)

The query editor where you write and edit SPARQL queries.

**Features:**

- Syntax highlighting for SPARQL
- Auto-completion for keywords, prefixes, and URIs (classes and properties used in the endpoint come first, see [Class and Property Autocomplete](#class-and-property-autocomplete))
- Line numbers and code folding
- Query validation with error highlighting
- Find and replace functionality
- Multiple editor themes

### YASR (Results Viewer)

The results viewer displays query results in various formats.

**Features:**

- Multiple visualization plugins (table, graph, map, etc.)
- Export results to different formats
- Pagination for large result sets
- Sortable and filterable tables
- Raw response viewer

### YASGUI (Main Interface)

The container that brings YASQE and YASR together with additional functionality.

**Features:**

- Multiple query tabs
- Tab management (rename, duplicate, close)
- Endpoint management
- Settings configuration
- Theme switching
- Layout orientation options

---

## The Interface

The MatGUI window has a **top bar** with your query tabs and the search, a **side panel** on the left with your saved queries and the overview of the current endpoint, and one **query card** for the active tab. The card holds the title of the query, the endpoint and **Run**, the editor, and the results below it (or next to it, see [Layout Orientation](#layout-orientation)).

### Top Bar

From left to right:

- **MatGUI**: the name of the application (sites that embed MatGUI can hide it)
- **Query tabs**: one tab per query. The active tab is raised. Tabs that hold a saved (managed) query show a small dot before their name; the dot turns amber when the query has unsaved changes. Hover a tab to show its close button (×), click **+** to add a tab
- **Search queries and commands** (`Ctrl+K`, or `⌘K` on a Mac): see [Search](#search)
- **Help** (?): opens the MatGUI user guide in a new browser tab
- **Theme** (sun / moon): switches between the light and dark theme
- **Settings** (gear): opens the settings of the active tab

### Search

Click **Search queries and commands** in the top bar, or press `Ctrl+K` (`⌘K` on a Mac), to open the search. Start typing to find:

- **Queries**: the saved queries of all your workspaces, with the workspace and folder they are in. Pick one to open it in a new tab, or to go to the tab that already has it open
- **Snippets**: the code snippets of the [Insert menu](#insert-menu), found by name, group or the code they write (`filter` finds the comparison snippets). Pick one to insert it at the cursor
- **Commands**: Run query, New tab, Insert snippet, Insert PREFIX declarations, Switch endpoint, Explore endpoint, Show saved queries, Toggle side panel, Toggle side-by-side layout, Format, Share, Save, Download, full screen editor, dark mode and the documentation. Commands with a shortcut show it at the right
- **Settings**: every section of the settings (Request, SPARQL endpoints, Workspaces, Prefixes, Editor, Import / export, Keyboard shortcuts, About), for example type `prefixes` and pick **Settings: Prefixes**

Type `>` first to search commands and settings only. Snippets and settings show up once you type something. Use `↑` and `↓` to move, `Enter` to open and `Esc` to close.

### Query Card

The head of the card shows:

| Control              | What it does                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Breadcrumbs          | For a saved query: the workspace and the folders it is in. Click one to show the query browser   |
| Title                | The name of the tab. Double-click it to rename the query. Saved queries also show their version (for example `3f9c2ab`) |
| Endpoint picker      | Shows the label and URL of the endpoint the query runs against; click it to switch (see below)  |
| **Saved**            | Shown for saved queries only (see [Saved Status](#saved-status))                                 |
| **Run**              | Runs the query. Becomes **Stop** while the query runs                                            |

The toolbar at the top right of the editor:

| Control              | What it does                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Prefixes**         | Inserts your saved prefix declarations into the query (see [Prefix Management](#prefix-management)) |
| **Insert**           | Opens a menu with code snippets and a map to draw a geometry (see [Insert Menu](#insert-menu))   |
| Editor tools         | Share, Format, Save (when a workspace is configured), Download and Fullscreen for the editor. On small screens they move into the **⋯** menu |
| Layout toggle        | Switches between the editor above the results and side by side                                   |

When the editor gets narrow (a small window or the side-by-side layout), **Prefixes** and **Insert** keep their icon and hide their label. Hover a button to see its name.

The editor and the results share the card, separated by a thin line with a grip in the middle: drag the grip to give the editor more or less room, double-click it to show the whole query.

### Endpoint Picker

The endpoint picker shows the label of the current endpoint (when it has one) followed by its URL. Click it, or tab to it and start typing, to open the endpoint dropdown:

- **Quick switch**: your favourite endpoints, one click away. This group lists the endpoint buttons configured by the site (that you did not disable) and the endpoints you marked **Show as button** in the settings. The current endpoint is highlighted
- **Endpoints**: the endpoints you used before, filtered while you type. Hover an entry and click × to remove it from your history
- **Manage endpoints**: opens the **Endpoints** section of the settings

Type a URL and press `Enter` to use an endpoint that is not in the list. Press `Esc` to close the dropdown without changing anything.

### Run and Stop

**Run** sits at the right of the card head and shows the shortcut (`Ctrl ↵`, or `⌘ ↵` on a Mac). While a query runs, the button turns into **Stop**: click it to cancel the request. When the query contains a syntax error, the play icon is replaced by an amber warning icon and the tooltip says so; you can still run the query.

### Insert Menu

**Insert** gathers everything you can add to your query:

- A search field to find a snippet by name or group
- The code snippets, grouped as configured (for example *Query types* or *Patterns*). Click a group to expand it, click a snippet to insert it at the cursor
- **Geometry from a map**: draw a point, line or polygon and insert it as a WKT literal

Use the arrow keys to move through the menu and `Esc` to close it.

You can also find a snippet with the [search](#search) (`Ctrl+K`). The snippets bar that earlier versions showed above the editor is gone, unless the site that embeds MatGUI turns it on.

### Side Panel

The side panel on the left has up to four views, selected with **Queries**, **Endpoint**, **Source** and **AI** at its top:

- **Queries**: the query browser for your workspaces. Pick a workspace, search, open a saved query in a new tab, or save the current tab with **Save current tab**
- **Endpoint**: the endpoint overview of the current endpoint (see [Endpoint Overview](#endpoint-overview))
- **Source**: the structure, a preview and a query builder for the file of a SPARQL Anything `SERVICE` block (see [SPARQL Anything Sources](#sparql-anything-sources)). This view is only listed while the query of the tab has such a block
- **AI**: the AI assistant, which writes, explains and fixes queries (see [AI Assistant](#ai-assistant)). The **AI** button in the editor toolbar opens it too. A site can switch it off, and then this view is not shown

While the panel is closed, a narrow bar of icons stays at the left edge: **Open side panel**, then one button per view. Click a view to open the panel on it. You can also press `Ctrl+B` (`⌘B` on a Mac) to show or hide the panel, `F8` to toggle the Endpoint view, or use **Show saved queries** and **Explore endpoint** in the [search](#search).

The buttons at the top right of the panel:

- **Pin**: keeps the panel open while you work in the editor, also after you reload the page. An unpinned panel closes when you open a query from it, and steps aside when you click into the editor
- **Collapse** («): closes the panel back to the bar of icons (`Ctrl+B` does the same). `Esc` closes an unpinned panel too

Drag the right edge of the panel to change its width; double-click the edge to restore the default width. The view, the width and the pinned state are remembered.

### Saved Status

Tabs that hold a saved (managed) query show their status next to **Run**:

- **✓ Saved**: the tab matches the saved version. The version itself is shown next to the title. Hover the status to see the workspace and the full version
- **Unsaved changes** (with an amber dot): you changed the query since it was last saved
- **Read-only**: the query comes from a read-only workspace

### Small Screens

On screens narrower than about 770 pixels:

- The card head keeps the title, the endpoint picker and **Run**; the other actions move into the menu button (☰) next to Run: Prefixes, Explore endpoint, Saved queries, Geometry from a map, Switch theme, the layout toggle and Settings. The editor toolbar keeps **Insert** and the **⋯** menu
- **Panel** in the top bar opens the side panel, which opens over the editor instead of next to it. The bar of icons is not shown
- The search in the top bar becomes a magnifier icon

### Fonts and Colors

MatGUI uses the MatData colors: a calm blue for actions, amber for unsaved changes, and quiet greys for the page, with the query card raised on it, in both the light and the dark theme. The query editor colors SPARQL keywords, variables, IRIs, prefixed names and literals in the same palette.

The interface prefers the **Geist** font at 13 pixels and the editor prefers **JetBrains Mono**. MatGUI does not download fonts by itself: if your browser or the page that embeds MatGUI provides these fonts they are used, otherwise MatGUI falls back to the standard fonts of your system. Site owners can load them, see the Developer Guide.

---

## Features

### Themes

MatGUI supports both light and dark themes, allowing you to customize the appearance of the SPARQL IDE according to your preferences.

**Features:**

- **Light Theme**: Default bright theme suitable for well-lit environments with high contrast and blue accents
- **Dark Theme**: Easy-on-the-eyes dark theme with Material Palenight syntax highlighting and cyan accents
- **Theme Toggle**: Quick switching between themes via the theme button at the right of the top bar
- **Persistence**: Your theme preference is automatically saved in browser storage
- **System Preference**: Automatically detects and applies your system's theme preference on first visit

**How to Change Theme:**

- Click the theme button at the right of the top bar
  - **Light Mode**: Shows a moon icon - clicking switches to dark mode
  - **Dark Mode**: Shows a sun icon - clicking switches to light mode
- On small screens, use **Switch theme** in the menu (☰) of the query card
- Your theme preference persists across page reloads and browser sessions

**Theme Details:**

Light Theme characteristics:

- Clean, bright interface with high contrast
- Default CodeMirror syntax highlighting
- White backgrounds with dark text
- MatData blue accent color (#0563bb) and amber highlight (#f2b300)

Dark Theme characteristics:

- Dark backgrounds with light text
- GitHub Dark CodeMirror theme for syntax highlighting (customizable)
- Reduced eye strain in low-light environments
- Light blue accent color and amber highlight

**Editor Theme Customization:**

You can customize the syntax highlighting theme separately for light and dark modes:

1. Click the Settings button (gear icon) at the right of the top bar
2. Navigate to the "Editor" tab
3. Select your preferred theme for light mode from the dropdown
4. Select your preferred theme for dark mode from the dropdown
5. Click "Save" to apply your changes

**Available Themes:**
The editor is built on CodeMirror 6 and ships with the following syntax highlighting themes:

- **Default**: Light theme that follows the application's color variables
- **GitHub Dark**: Custom theme matching GitHub's dark default colors

Both themes adapt automatically to the light/dark application theme through CSS custom properties. Additional themes can be added by styling the `cm-s-<name>` class on the editor (see the Developer Guide).

Your theme preferences are stored separately for light and dark modes, so switching between app themes (light/dark) will automatically apply the appropriate editor theme.

**System Theme Detection:**

If you haven't manually selected a theme, MatGUI will:

1. Check your system's color scheme preference
2. Apply dark theme if your system prefers dark mode
3. Apply light theme otherwise
4. Automatically update if you change your system preference

### Layout Orientation

MAtGUI offers two layout options to optimize screen space:

**Vertical Layout (Default):**

- Query editor on top
- Results viewer below
- Best for standard monitors and laptops

**Horizontal Layout:**

- Query editor on left
- Results viewer on right (side-by-side)
- Ideal for wide/ultrawide monitors
- Maximizes vertical space for both components

**How to Change Layout:**

- Click the layout toggle button at the right end of the editor toolbar
- The icon shows the layout you switch to: two columns (side by side) or two rows (stacked)
- Layout preference is saved automatically

**Resizing the editor and results:**

- Vertical layout: drag the bottom edge of the editor to make it taller or shorter; double-click it to show the whole query
- Horizontal layout: drag the line between the editor and the results; double-click it to go back to a 50/50 split
- Like the side panel's edge, the handle shows a blue line when you hover or drag it

### Query Formatting

Keep your SPARQL queries clean and readable with automatic formatting.

**Features:**

- Format button in the editor toolbar
- Keyboard shortcut: `Shift+Ctrl+F`
- Choice of formatting engines:
  - **SPARQL 1.2 Formatter** (default): [@matdata/sparql-formatter](https://github.com/Matdata-eu/sparql-formatter), supports SPARQL 1.2 (triple terms, reifiers, annotations, `VERSION`, ...) and keeps comments where you put them
  - **Legacy formatter**: Original MatGUI formatter
- Auto-format on query execution (configurable in Settings)

**How to Format:**

1. Write or paste your query
2. Click the format button or press `Shift+Ctrl+F`
3. Query is automatically reformatted with proper indentation and spacing

**Configuration:**

- Open Settings (gear icon in the top bar) to:
  - Select your preferred formatter
  - Enable/disable auto-format on query execution
  - Both settings are saved persistently

### CONSTRUCT Query Validation

MatGUI helps you write correct CONSTRUCT queries by detecting undefined variables.

**Feature:**

- Automatically checks if variables used in the CONSTRUCT template are defined in the WHERE clause
- Shows orange warning markers in the gutter for undefined variables
- Displays tooltips explaining which variable is undefined
- Does not prevent query execution (informational only)

**How It Works:**
When you write a CONSTRUCT query, MAtGUI analyzes the variables:

```sparql
PREFIX ex: <http://example.org/>
CONSTRUCT {
  ?s ex:hasName ?name .
  ?s ex:hasAge ?age .      # ⚠️ Warning: ?age not defined in WHERE
}
WHERE {
  ?s ex:name ?name .       # Only ?s and ?name are defined
}
```

**Visual Feedback:**

- **Orange warning icon**: Appears in the gutter next to lines with undefined variables
- **Tooltip**: Hover over the warning icon to see which variable is undefined
- **Non-blocking**: Queries can still be executed even with warnings

**Configuration:**

- Open Settings (gear icon in the top bar) → Editor tab
- Toggle "Validate CONSTRUCT query variables" checkbox
- Enabled by default
- Setting is saved persistently

**Why This Helps:**

- Catch typos in variable names early
- Ensure CONSTRUCT queries will produce expected results
- Understand which variables are actually bound in your query
- Improve query quality without blocking execution

### Code Snippets

Quickly insert common SPARQL patterns and query types with the **Insert** menu of the editor toolbar (see [Insert Menu](#insert-menu)) or the [search](#search) (`Ctrl+K`).

**Features:**

- **Insert menu**: All snippets in one searchable menu, grouped by their group name
- **Search**: Type part of a snippet's name, group or code in the `Ctrl+K` search and pick it
- **Quick insertion**: Click a snippet to insert code at your cursor position
- **Default snippets**: Includes 5 useful SPARQL snippets (SELECT, CONSTRUCT, ASK, FILTER, OPTIONAL)
- **Dropdown grouping**: When more than 10 snippets are configured, they are grouped in dropdown menus
- **Customizable**: Developers can configure custom snippets

**How to Use:**

1. Position your cursor where you want to insert code
2. Click **Insert** in the editor toolbar and pick a snippet, or press `Ctrl+K` and search for it
3. The code is inserted at your cursor position
4. Continue editing as needed

**Default Snippets:**

- **SELECT**: Basic SELECT query template
- **CONSTRUCT**: CONSTRUCT query template
- **ASK**: ASK query template
- **FILTER**: FILTER pattern example
- **OPTIONAL**: OPTIONAL pattern template

**Grouped Snippets (>10):**
When more than 10 snippets are configured, they are organized into dropdown menus by group:

- Click a group button (e.g., "Query Types", "Patterns") to open the dropdown
- Click a snippet in the dropdown to insert it
- The dropdown closes automatically after insertion

**Configuration:**

- The snippets bar above the editor only shows when the site that embeds MatGUI turns it on (`showSnippetsBar: true`)
- Developers can configure custom snippets with label, code, and group properties
- The bar is hidden automatically when no snippets are configured

### Fullscreen Mode

Maximize screen space for editing or viewing results.

**Available Modes:**

- **YASQE Fullscreen**: Editor takes up the entire screen
- **YASR Fullscreen**: Results viewer takes up the entire screen

**How to Use:**

- Press `F11` to toggle YASQE fullscreen
- Press `F10` to toggle YASR fullscreen
- Press `F9` to switch between YASQE and YASR fullscreen
- Press `Esc` or click the close button to exit fullscreen

### Prefix Management

Simplify query writing with reusable prefix declarations.

**Features:**

- **Saved Prefixes**: Define commonly-used prefixes once, reuse everywhere
- **Auto-capture**: MatGUI automatically captures new prefixes from your queries
- **Prefixes Button**: Insert saved prefixes into your query with one click
- **Prefix Autocomplete**: Type a prefix (e.g., `PREFIX foaf:`) and MatGUI suggests the full URI from prefix.cc

**Default Prefixes:**
MatGUI includes standard prefixes like:

- `rdf:` - RDF vocabulary
- `rdfs:` - RDF Schema

**How to Use:**

1. Click **Prefixes** in the editor toolbar to insert all saved prefixes
2. Open Settings (gear icon in the top bar) to manage your prefix collection
3. Enable/disable auto-capture in Settings

Prefixes are added below the comment lines a query starts with, so a leading comment such as `#defaultView:Geo` (see [Plugin Selection](#plugin-selection)) stays on top.

**Auto-completion:**
When typing a prefix declaration, Matgui queries [prefix.cc](https://prefix.cc) to suggest standard URIs:

```sparql
PREFIX foaf: <  # Auto-suggests http://xmlns.com/foaf/0.1/
```

MatGUI ships the prefix.cc list, so this works offline too. A few prefixes are always in it, with these namespaces, whatever prefix.cc says: `era:` (ERA ontology), `railml:` (railML 3), `rtm:` (RailTopoModel) and the three [SPARQL Anything](https://sparql-anything.cc) namespaces `xyz:` (`http://sparql.xyz/facade-x/data/`), `fx:` (`http://sparql.xyz/facade-x/ns/`) and `fxe:` (`http://sparql.xyz/facade-x/engine/`). Typing one of them in a query, such as `fxe:location`, adds its `PREFIX` declaration.

### Endpoint Quick Switch

Quick switch endpoints let you change the SPARQL endpoint of a tab with a single click. They are listed in the **Quick switch** group at the top of the endpoint dropdown (see [Endpoint Picker](#endpoint-picker)).

**Features:**

- **One-click switching**: Open the endpoint picker and click a quick switch endpoint
- **Developer-configured endpoints**: Administrators can configure quick switch endpoints (`endpointButtons`) during initialization
- **Your own endpoints**: Mark any endpoint with a label as **Show as button** in the settings
- **Persistent storage**: Your endpoints and preferences are saved in local storage
- **Fully themed**: The dropdown adapts to the light and dark themes
- **Accessible**: The dropdown can be used with the keyboard

**Developer-Configured Endpoints:**

If the developer has configured endpoint buttons when initializing MatGUI, you can manage them through the Settings interface:

1. Open the endpoint picker and click **Manage endpoints**, or click the Settings button (gear icon) at the right of the top bar and go to the "Endpoints" section
2. Look for the "Developer-Configured Endpoint Buttons" section at the top
3. Toggle the "Enabled" checkbox for each one to show or hide it in the Quick switch group

**How to Add Your Own Quick Switch Endpoints:**

1. Open the endpoint picker and click **Manage endpoints**
2. Scroll to the "SPARQL Endpoints" section
3. Enter an endpoint URL in the "Add New Endpoint" field
4. Click "+ Add Endpoint"
5. Add a label and enable "Show as Button"
6. Changes are saved automatically

Custom endpoint configurations persist across browser sessions. You can delete endpoints by clicking the "Delete" button.

**How to Switch Endpoints:**

- Click the endpoint picker at the top of the query card
- Click an endpoint in the **Quick switch** group
- The endpoint change triggers the same behavior as manually entering an endpoint
- The new endpoint is used for all subsequent queries
- The label of the endpoint is shown in the picker, followed by its URL

> Earlier versions showed these endpoints as buttons next to the endpoint field, with an overflow menu (⋯) when they did not fit. They now live in the endpoint dropdown, so the query card stays tidy however many endpoints you add.

### Configuration Import/Export

Backup, share, and migrate your Matgui configuration using RDF Turtle format. This feature allows you to export all your settings, tabs, queries, and preferences, then import them on another device or browser.

**Features:**

- **Export to file**: Download your configuration as a `.ttl` file
- **Copy to clipboard**: Quickly copy configuration for sharing
- **Import from file**: Upload a previously exported configuration
- **Paste from clipboard**: Import configuration directly from clipboard
- **Drag & drop**: Drop a `.ttl` file to import configuration
- **RDF/Turtle format**: Standard, semantic format for configuration data

**Configuration Ontology:**

Matgui uses a custom RDF ontology to represent configuration:

- Namespace: `https://yasgui.matdata.eu/ontology#`
- Classes: `Configuration`, `Tab`
- Properties: `activeTab`, `prefixes`, `endpoint`, `query`, `tabName`, etc.

**What Gets Exported:**

- All query tabs and their content
- Endpoint configurations
- Saved prefixes
- Custom endpoint buttons
- Auto-capture settings
- Editor preferences

**How to Export Configuration:**

1. Click the Settings button (gear icon) at the right of the top bar
2. Navigate to the "Import/Export" tab
3. Choose export method:
   - **📋 Copy to Clipboard**: Copies configuration as RDF Turtle text
   - **💾 Download as File**: Downloads as `matgui-config.ttl`
4. Share the file or clipboard content with others, or save it for backup

**How to Import Configuration:**

1. Click the Settings button (gear icon) at the right of the top bar
2. Navigate to the "Import/Export" tab
3. Choose import method:
   - **Drag & drop**: Drag a `.ttl` file onto the drop zone
   - **📂 Browse Files**: Click to select a file from your computer
   - **📋 Paste from Clipboard**: Import directly from clipboard
4. Confirm the import when prompted
5. Reload the page to see the imported configuration

**Example Configuration (RDF Turtle):**

```turtle
@prefix yasgui: <https://yasgui.matdata.eu/ontology#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

[] a yasgui:Configuration ;
  yasgui:activeTab "tab1" ;
  yasgui:prefixes """PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>""" ;
  yasgui:autoCaptureEnabled "true"^^xsd:boolean ;
  yasgui:tab [
    yasgui:tabId "tab1" ;
    yasgui:tabName "My Query" ;
    yasgui:query "SELECT * WHERE { ?s ?p ?o } LIMIT 10" ;
    yasgui:endpoint "https://dbpedia.org/sparql" ;
    yasgui:requestMethod "POST"
  ] .
```

**Use Cases:**

- **Backup**: Export configuration before clearing browser data
- **Migration**: Move your setup to a different browser or device
- **Sharing**: Share query collections with colleagues
- **Version Control**: Track configuration changes over time
- **Collaboration**: Distribute standardized query setups to teams

**Important Notes:**

- Import will replace your current configuration (confirm before proceeding)
- Page reload is required to fully apply imported configuration
- Configuration is stored in browser's local storage
- Export includes all tabs and queries, but not query execution results

### URI Explorer

Quickly explore RDF resources by Ctrl+(Shift+)clicking on URIs in your query.

**How It Works:**

1. Hold `Ctrl` and click any URI in the query editor
2. MatGUI automatically generates and executes a CONSTRUCT query where the URI is the **subject**
3. Results appear without modifying your original query
4. View the resource's connections in the results viewer

Alternatively, use `Ctrl`+`Shift` and click on the URI to executes a CONSTRUCT query where the URI is the **object**.

**Example:**
Ctrl+clicking on `http://dbpedia.org/resource/European_Union` automatically queries for all triples where the European Union is the subject of.

### Class and Property Autocomplete

Press `Ctrl+Space` after `a` (or `rdf:type`) to get class suggestions, or in the position of a property to get property suggestions. MatGUI suggests:

1. **Used in this endpoint**: the classes and properties the endpoint of the tab actually uses, most used first, with the number of instances (classes) or triples (properties) next to them. This also covers vocabularies that are not registered anywhere, such as railML 3, the ERA ontology or your own ontologies.
2. **Linked Open Vocabularies**: matching classes and properties of the most used vocabularies in [LOV](https://lov.linkeddata.es/dataset/lov/). MatGUI ships this list, so no request is made to LOV while you type. Terms that the endpoint already suggested are not repeated, and a term is inserted as a prefixed name with its `PREFIX` when LOV knows the vocabulary's preferred prefix. The ERA ontology (`era:`), railML 3 (`railml:`), RailTopoModel (`rtm:`) and the SPARQL Anything vocabularies (`fx:`, `fxe:`, see below) are always included, even though they are not in LOV.

**SPARQL Anything**

The [SPARQL Anything](https://sparql-anything.cc) terms are always suggested, so you can write its queries without looking up the documentation:

- `fx:` (`http://sparql.xyz/facade-x/ns/`): the `fx:anySlot` magic property and the `fx:Root` class as properties and classes, and the functions, such as `fx:entity`, `fx:literal`, `fx:String.substring` or `fx:LevenshteinDistance`, wherever an expression can start (in `BIND`, `FILTER`, a `SELECT` expression...). A function also matches on its local name, so `substr` finds `fx:String.substring`.
- `fxe:` (`http://sparql.xyz/facade-x/engine/`): the options of a SPARQL Anything `SERVICE` clause, such as `fxe:location`, `fxe:media-type`, `fxe:csv.headers` or `fxe:json.path`.
- `xyz:` (`http://sparql.xyz/facade-x/data/`): the namespace of the generated data. Its terms come from your data (`xyz:name`), so only the prefix is known, unless the endpoint uses them.

```sparql
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX fxe: <http://sparql.xyz/facade-x/engine/>

SELECT ?name WHERE {
  SERVICE <x-sparql-anything:> {
    fxe:properties fxe:location "https://sparql-anything.cc/example1.json" .
    ?show xyz:name ?name ; xyz:stars ?star .
    ?star fx:anySlot "Courteney Cox" .
  }
  BIND(fx:entity("https://example.org/show/", fx:String.toLowerCase(?name)) AS ?iri)
}
```

Without typing anything, the endpoint's most used terms are listed. While you type, a suggestion matches on its full IRI, its prefixed name (`era:Op`) or, when you type a plain word (`Operat`), on any part of its local name.

Picking a suggestion inserts a prefixed name when MatGUI knows a prefix for it, and adds the missing `PREFIX` declaration to your query, just like clicking an IRI in the [Endpoint Overview](#endpoint-overview). When you are typing with a prefix that your query declares, that prefix is used.

**Where the suggestions come from**

MatGUI reuses what the endpoint overview already knows about the endpoint, so in most cases no extra query is needed:

- The class and property partitions of the endpoint's VoID description.
- The results of the **Classes** and **Properties** overview queries, when they hold the complete list.
- Otherwise MatGUI runs one limited query in the background (the 200 most used classes or properties) the first time you ask for suggestions, with the endpoint and authentication settings of the tab. The result is remembered per endpoint like the other overview results; use **Run again** on the overview's Classes or Properties query to refresh what is suggested. When this query fails or times out, it is not retried for an hour.

**Switching it off for an endpoint**

Counting all properties of a very large public endpoint is expensive. Open the [Endpoint Overview](#endpoint-overview) for that endpoint and clear **Suggest this endpoint's classes and properties in autocomplete**: MatGUI then neither queries the endpoint nor shows its terms, and only the Linked Open Vocabularies suggestions remain. The choice is remembered per endpoint.

### IRI Hover Info

Rest the mouse on an IRI or prefixed name in the query editor (for example `era:solNature`) to see what it means, without running anything or losing your results. After a short moment a tooltip shows:

- the label (`rdfs:label` or `skos:prefLabel`), in your browser's language when the endpoint has it, otherwise in English,
- the full IRI, when you hovered a prefixed name,
- the description (`rdfs:comment` or `skos:definition`), shortened when it is long,
- the type, and for properties the domain and range, shortened with the prefixes of your query.

The information is fetched with a small query on the endpoint of the tab, using its authentication and request settings, and is remembered per endpoint and IRI, so hovering the same IRI again is instant. When the endpoint doesn't describe the IRI, MatGUI looks it up in [LOV (Linked Open Vocabularies)](https://lov.linkeddata.es), which knows most published vocabularies; the tooltip then says "Description from LOV".

Prefixed names whose prefix isn't declared in the query get no tooltip. The tooltip also reminds you that Ctrl+click and Ctrl+Shift+click open the [URI Explorer](#uri-explorer).

To switch it off, untick **Show IRI information on hover** in **Settings → Editor**.

### Endpoint Overview

Get to know an unfamiliar SPARQL endpoint while you write your queries. Click the compass in the bar of icons at the left, press `F8`, or pick **Explore endpoint** in the [search](#search) to open the **Endpoint** view of the [side panel](#side-panel), next to the editor.

**Service description and VoID**

When the panel opens, MatGUI looks for metadata that the endpoint publishes about itself:

- The [SPARQL Service Description](https://www.w3.org/TR/sparql11-service-description/), returned by the endpoint URL when it is requested without a query. It lists the supported SPARQL features, extension functions, result formats and named graphs.
- A [VoID](https://www.w3.org/TR/void/) dataset description at `/.well-known/void` (or embedded in the service description), with statistics such as the number of triples, classes, vocabularies and class/property partitions.

Some descriptions are very large (Wikidata's includes statistics for every class and property). Only the first 5 MB are read; the panel mentions it when a description was cut off.

Many endpoints publish neither (for example GraphDB has no service description). The panel then simply says so and you can use the overview queries instead. If you run an endpoint yourself, publishing a service description and VoID makes it much easier to explore.

**Overview queries**

The panel contains predefined queries, grouped in categories:

| Category                      | Queries                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Endpoint & dataset overview   | Named graphs, triples per named graph, total number of triples, most used namespaces       |
| Vocabulary & schema           | Classes and properties with usage counts, SKOS concept schemes, SHACL/ShEx shapes          |
| Instances                     | Sample instances of the most used classes, most connected nodes (hubs)                     |
| Labels, languages & literals  | Labels per language, properties with language-tagged literals                              |
| Interlinking & external links | Referenced hosts (e.g. Wikidata, GeoNames, DBpedia), linking properties, linked entities   |
| Time & geo                    | Temporal properties, geospatial properties, coordinate reference systems, bounding boxes   |

- Queries only run when you click **Run** (▶) or **Run all** for a category, so large endpoints are never queried unexpectedly. Queries marked **may be slow** scan the whole dataset and may time out on large endpoints.
- Every query is limited. Lists such as the named graphs are loaded page by page with **Load more**.
- Some endpoints stop long-running queries at a time limit and return whatever they found so far (for example Virtuoso's "anytime queries", used by DBpedia). Such results are marked as **Partial result**: counts may be too low and an empty result does not mean there is no such data.
- Public endpoints limit how many (expensive) queries you can run. When an endpoint answers that you are sending too many requests, wait a moment before running more queries. Errors of the endpoint are shown below the query (e.g. "estimated execution time exceeds the limit").
- Describe queries run in the background with the endpoint and authentication settings of the current tab. They do not change your query or the results view. The default and named graphs configured for the tab are not applied, so the whole endpoint is described.
- Click an IRI in the results to insert it into your query. MatGUI uses a prefixed name when it knows the prefix and adds the missing `PREFIX` declaration.
- The classes and properties the overview knows are also suggested in the editor's autocomplete. The **Suggest this endpoint's classes and properties in autocomplete** checkbox at the top of the panel switches this off for the current endpoint (see [Class and Property Autocomplete](#class-and-property-autocomplete)).
- Click the **Open query in a new tab** button next to a query to open it in a new tab, to adapt it further.

**Remembered results**

Results are remembered per endpoint, also when you execute other queries, switch tabs or reload the page. The panel always follows the endpoint of the active tab. Use the **Run again** button to refresh a result; the time it was fetched is shown next to it.

**Keeping the panel out of the way**

The endpoint overview lives in the side panel, so it shares the panel's controls:

- **Collapse** («) shrinks the panel to a narrow bar at the left of the screen. Click the Endpoint button on the bar to expand it again.
- An unpinned panel steps aside when you click into the query editor.
- The **pin** button pins the panel: it stays open while you write queries and is restored when you reload the page.
- Drag the right edge of the panel to change its width.
- On small screens the panel opens over the editor.

### AI Assistant

The AI assistant helps you write and understand queries. Open it with the **AI** button in the editor toolbar, the sparkles icon in the bar at the left, or **Ask AI…** in the [search](#search) (`Ctrl+K`). It lives in the **AI** view of the [side panel](#side-panel).

It can:

- **Write a query from a question.** Type what you want to know in your own words ("Which tunnels are longer than 5 km?") and press `Enter` (`Shift+Enter` adds a new line). The assistant answers with a query and a short explanation. Ask follow-up questions in the same conversation ("now only in Belgium"); the **+** button starts a new conversation.
- **Explain the query** in the editor in plain language: a one-sentence summary, then the parts of the query, and possible problems such as a missing `LIMIT`.
- **Fix the query.** When the query has a syntax error, or the endpoint answers with an error, click **Fix query** in the AI view or **Fix with AI** in the error view of the results. When the query runs but returns nothing, the button becomes **Why no results?**.
- **Explain the results**: a summary of what the results show, notable values, and anything that looks wrong.

Queries in an answer get buttons: **Use in editor** replaces your query (press `Ctrl+Z` in the editor to get the old one back), **Insert** puts the query at the cursor, **New tab** opens it in a new tab with the same endpoint, and **Copy** copies it. Nothing is ever run automatically: you decide when to run a query.

> AI answers can be wrong. The assistant may use a class or property that doesn't exist, or misread what you meant. Check a query, and its results, before you rely on it.

**Setting up an AI service**

The assistant works with any service that offers an OpenAI-compatible API. Open **Settings → AI** (or the gear in the AI view). Under **AI services** you see:

- **The AI service of the site**, when the site you use MatGUI on provides one (it may offer more than one). You need no key of your own.
- **Your own services.** Click **Add service**, pick a provider in the **Base URL** list or enter another URL, and fill in your **API key** and the **Model**. **Name** is how the service is shown in the AI view; it defaults to the provider or host. Use **Test connection** to check the key and to list the models of the service. The key is optional: local models and some proxies need none. Add as many services as you like, and change or remove them with **Edit** and **Remove**.
- **No AI service**: nothing is sent anywhere. See "Without an AI service" below.

Select the service the assistant uses by default and click **Save**. In the AI view, the service name at the top is a list: pick another service there to use it for your next questions, until you reload the page. "No AI service: copy a prompt" in that list makes the actions copy prompts instead.

The Base URL list includes OpenAI, Anthropic (Claude), Google Gemini, Mistral, Moonshot (Kimi), DeepSeek, xAI (Grok), OpenRouter, Groq, Together AI, Fireworks AI, Cerebras, Hugging Face, Scaleway, Azure OpenAI, Ollama and LM Studio. Some of them:

  | Service                   | Base URL                                                   |
  | ------------------------- | ---------------------------------------------------------- |
  | OpenAI                    | `https://api.openai.com/v1` (the default)                  |
  | Anthropic (Claude)        | `https://api.anthropic.com/v1`                             |
  | Google Gemini             | `https://generativelanguage.googleapis.com/v1beta/openai` |
  | Mistral                   | `https://api.mistral.ai/v1`                                |
  | OpenRouter                | `https://openrouter.ai/api/v1`                             |
  | Groq                      | `https://api.groq.com/openai/v1`                           |
  | Azure OpenAI              | `https://<resource>.openai.azure.com/openai/v1`            |
  | Ollama (your computer)    | `http://localhost:11434/v1` (no key needed)                |
  | LM Studio (your computer) | `http://localhost:1234/v1` (no key needed)                 |

  Enter the base URL without an endpoint path: when you paste a URL ending in `/chat/completions` or `/messages`, MatGUI drops that part. A few services need something extra, which MatGUI handles for you:
  - **Anthropic**: MatGUI adds the header Anthropic asks of browser requests (`anthropic-dangerous-direct-browser-access`) and uses its OpenAI-compatible endpoint, with Claude model names such as `claude-sonnet-4-5`.
  - **Azure OpenAI**: the key is sent in the `api-key` header, as Azure expects. The model is the name of your deployment.

  The service must accept requests from a browser (CORS). OpenAI, Anthropic, Google Gemini and OpenRouter do; when **Test connection** can't reach another service, that service probably doesn't, and the AI service of the site or a local model is the way to go. Models on your own computer need one setting:
  - **Ollama** only accepts the MatGUI site when it is started with `OLLAMA_ORIGINS` set to that site, for example `OLLAMA_ORIGINS=https://matgui.matdata.eu ollama serve`.
  - **LM Studio**: turn on **Enable CORS** in the settings of its local server.
  - Your browser may ask whether the site may access devices on your local network. Allow it, or requests to `localhost` fail.

  Small local models often can't run check queries (tool calls). MatGUI then asks again without them, so the answer comes without checks on the endpoint.

Your API keys are stored in this browser only (in its local storage). Each key is sent only to the base URL of its service, and it is never included in exported settings ([Configuration Import/Export](#configuration-importexport)) or share links. Anyone who uses the same browser profile can read it, so use a key with a spending limit, and click **Forget key** on a shared computer.

**Without an AI service: Copy for AI**

You don't need an API key to get help. Without an AI service, the actions of the AI view, and **Copy for AI** in the error view, copy a ready-made prompt to the clipboard: the instructions, the context of your endpoint, your query and, for a fix, the error. Paste it in ChatGPT, Claude, Le Chat, Copilot or any other AI chat. The AI view shows the copied prompt, so you see exactly what you are about to paste. With an AI service set up, **Copy query for AI** in the search does the same.

**What is sent, and to whom**

Nothing is sent until you click an action or send a question. Before the first request to a service, the AI view shows what the request includes and where it goes, and asks you to confirm. Tick **Don't ask again** to skip this for that service; **Ask me again** in **Settings → AI** brings the question back.

| Action          | Sent to the AI service                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Ask a question  | Your question, the query in the editor, the endpoint URL, and the names of the classes and properties used in the endpoint with their counts |
| Fix query       | The query, the error message, the endpoint URL, and the class and property names                                                             |
| Explain query   | The query and the endpoint URL                                                                                                               |
| Explain results | The query, the endpoint URL and the first 50 result rows (the site can change this number)                                                   |

Follow-up questions also send the earlier questions and answers of the conversation. Result data is only sent by **Explain results**, and by check queries (below). Your endpoint credentials and your other tabs are never sent.

Every answer has a **What was sent** section with the exact text of the request, and shows which service and model answered.

**Check queries**

To give better answers, the assistant may run a few small check queries on the endpoint of the tab before it answers, for example to see whether a class exists or which values a property has. Check queries are read-only (`SELECT` or `ASK`), return at most 20 rows, and at most 5 are run per question. They run from your browser with the endpoint and authentication settings of the tab, and their results are sent to the AI service. Each check query and its result is shown in the answer.

To switch them off, untick **Let the assistant run check queries on the endpoint** in **Settings → AI**. When a service or model doesn't support this (some local models don't), the assistant answers without check queries.

**Where the endpoint context comes from**

The class and property names come from the same place as the [autocomplete](#class-and-property-autocomplete): the endpoint's VoID description, the [Endpoint Overview](#endpoint-overview) results, or one limited background query. When you switched autocomplete off for an endpoint, the assistant gets only your prefixes for it. Telling the assistant which vocabulary to use ("use the ERA ontology") also helps.

### SPARQL Anything Sources

[SPARQL Anything](https://sparql-anything.cc) queries CSV, JSON, XML and other files as if they were RDF, with a `SERVICE <x-sparql-anything:...>` block. The column names, keys and element names of the file become properties and types in the `xyz:` namespace (`http://sparql.xyz/facade-x/data/`), for example `xyz:email` for an `email` column. MatGUI can find these for you, so you don't have to open the file to know what to write.

```sparql
PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:location=https://example.org/people.csv,csv.headers=true> {
    ?root a fx:root ; fx:anySlot ?row .
    ?row xyz:email ?email .
  }
}
```

**Loading the structure**

As soon as you close the block with `}`, a chip appears after its opening brace, with the file name and **Load structure**. Clicking it opens the **Source** view of the side panel and sends one query to the endpoint of the tab, with your SERVICE IRI and `fx:properties` options unchanged. The endpoint reads the file, so this also works for files that only the endpoint can reach (a path on the server, a URL behind a firewall, or a URL that needs authentication). Nothing is sent before you click: SPARQL Anything reads the whole file to answer, which can take a while for big files. While it runs the chip offers **Cancel**; when it fails it shows **Retry**, with the endpoint's error when you hover it.

When the structure is loaded, the chip shows the number of properties and **Inspect**, and:

- **Autocompletion** suggests the properties of the file (`Ctrl+Space` after `xyz:` or in a property position) first, under **From people.csv**, with how often they occur. After `a`, the XML element types are suggested. Picking one adds `PREFIX xyz:` when it is missing. Inside a SERVICE block only that block's source is used; elsewhere in the query, all loaded sources.
- The **Source** view of the side panel (**Inspect** on the chip, or **Inspect people.csv** in the [search](#search)) shows the source of the block the cursor is in. With several blocks, a picker at the top switches between them.

The structure is remembered per endpoint and set of options for a day; the reload button in the Source view loads it again. A block whose location is a variable (`fx:location ?file`) can't be inspected before the query runs, and its chip says so.

**The Source view**

- **Structure**: the tree of the file as SPARQL Anything sees it: the document (`fx:root`), its rows, array items or elements, and their properties, each with a count and an example value. Click a property or element to insert it at the cursor.
- **Preview**: the first 100 triples of the converted file, in Turtle, fetched with a `CONSTRUCT ... LIMIT 100` query. **Open as query** puts that query in a new tab.
- **Build query**: tick the values you need, or **All** at the top to tick them all (click it again to clear the selection; next to it you see how many are ticked). MatGUI writes the patterns from the root to each value: `fx:anySlot` for rows and array items, `a xyz:<element>` for XML elements, and `OPTIONAL` for values you mark as optional (the first value you tick is required, later ones optional; click the label to switch). The bar with **All** stays at the top of the view and has the actions: **Replace block** puts the patterns in the SERVICE block (keeping its `fx:properties` options; `Ctrl+Z` undoes it), the text cursor button inserts them at the cursor, and the arrow button opens a complete SELECT query in a new tab.

CSV, JSON and XML sources are shown best; other formats SPARQL Anything supports work too, with a more generic tree. A site can switch all of this off with `sparqlAnything: false`. To try it, the repository has a Docker Compose setup with a SPARQL Anything server and sample files in `dev/sparql-anything`.

### Query Tabs

Manage multiple queries simultaneously with tabs.

**Features:**

- Create unlimited query tabs
- Rename tabs by double-clicking the tab name
- Duplicate tabs to create query variations
- Reorder tabs by dragging
- Close individual tabs
- Each tab maintains its own:
  - Query content
  - Endpoint configuration
  - Results
  - Plugin selection

**Tab Operations:**

- **New Tab**: Click the "+" button in the tab bar
- **Rename**: Double-click the tab name
- **Duplicate**: Right-click and select "Duplicate"
- **Close**: Hover the tab and click its "×", or use the context menu
- **Reorder**: Drag and drop tabs to rearrange

### Settings Modal

Access comprehensive configuration options through the Settings modal.

**How to Open:**

- Click the settings button (gear icon) at the right of the top bar
- Or choose **Settings** in the menu (☰) of the query card on small screens
- Or search for a section with `Ctrl+K`, for example **Settings: Prefixes**
- **Manage endpoints** in the endpoint dropdown opens the Endpoints section directly

**Settings Sections:**

**Prefixes Tab:**

- Manage saved prefix declarations
- Enable/disable auto-capture
- Add, edit, or remove prefixes

**Request Configuration Tab:**

- HTTP request method (GET/POST)
- Accept headers
- Custom request parameters
- Named/default graphs configuration
- Custom HTTP headers

**Endpoints Tab:**

- **Developer-Configured Endpoint Buttons**: Enable/disable developer-configured buttons
- **SPARQL Endpoints**: Manage all your endpoints in one place
- Configure authentication per endpoint
- Add labels and add endpoints to the Quick switch group of the endpoint dropdown
- Automatically tracks accessed endpoints

**Formatting Tab:**

- Select formatter (sparql-formatter or legacy)
- Enable/disable auto-format on query execution

**Editor Tab:**

- Select CodeMirror theme for light mode
- Select CodeMirror theme for dark mode
- Switch between the Default and GitHub Dark editor themes in the Settings → Editor tab
- Includes custom "GitHub Dark" theme matching GitHub's dark default colors
- Show IRI information on hover (see [IRI Hover Info](#iri-hover-info))

**AI Tab:**

- Choose the AI service: the service of the site (when it provides one), your own API key, or none ("Copy for AI" only)
- Base URL, API key and model of your own service, with **Test connection** and **Forget key**
- Let the assistant run check queries on the endpoint
- Bring back the privacy notice for services you chose not to be asked about again

See [AI Assistant](#ai-assistant).

All settings are saved automatically to local storage.

### SPARQL Endpoints Management

MatGUI automatically tracks all SPARQL endpoints you access and lets you manage them from a single location.

**Accessing the Endpoints Manager:**

1. **Open Settings**: Click **Manage endpoints** in the endpoint dropdown, or the settings icon (gear) at the right of the top bar
2. **Navigate to Endpoints**: Click on the "Endpoints" tab in the settings modal

**Developer-Configured Endpoint Buttons:**

If the developer has configured endpoint buttons during initialization, you'll see them in the "Developer-Configured Endpoint Buttons" section:

- **Label**: The display name for the button
- **Endpoint**: The SPARQL endpoint URL
- **Enabled**: Toggle to show/hide the endpoint in the Quick switch group

You can enable or disable any developer-configured button by checking or unchecking the "Enabled" checkbox. Your preferences are saved locally and persist across sessions.

**Managing User Endpoints:**

The SPARQL Endpoints table shows:

- **Endpoint**: The URL of the SPARQL endpoint
- **Label**: Optional friendly name for the endpoint
- **Button**: Checkbox to list the endpoint in the Quick switch group of the endpoint dropdown (requires label)
- **Authentication**: Configure authentication (Basic, Bearer, API Key, OAuth2)
- **Actions**: Delete endpoint from the list

**Adding Quick-Switch Buttons:**

1. Find your endpoint in the list (or add a new one)
2. Enter a label (e.g., "DBpedia", "Wikidata")
3. Check the "Button" checkbox
4. The endpoint will now appear in the Quick switch group of the endpoint dropdown

**Configuring Authentication:**

Matgui supports multiple authentication methods for endpoints that require credentials.

1. **Find your endpoint** in the SPARQL Endpoints table
2. **Click "Configure"** in the Authentication column
3. **Select authentication type**:
   - **HTTP Basic Authentication**: Username and password
   - **Bearer Token**: Pre-configured access token
   - **API Key**: Custom header with API key
   - **OAuth 2.0**: Industry-standard OAuth 2.0 authorization
4. **Enter credentials** based on your selected type (see below)
5. **Click "Save"** (or "Save & Authenticate" for OAuth 2.0) to apply

**Authentication Types:**

_HTTP Basic Authentication:_

- Username: Your endpoint username
- Password: Your endpoint password
- Use case: Simple username/password authentication

_Bearer Token:_

- Token: Your pre-configured bearer token
- Use case: When you have a pre-generated access token

_API Key (Custom Header):_

- Header Name: The HTTP header name (e.g., X-API-Key)
- API Key: Your API key value
- Use case: Endpoints using custom header-based authentication

_OAuth 2.0:_

- Client ID: Your OAuth application's client ID
- Authorization Endpoint: The OAuth provider's authorization URL
- Token Endpoint: The OAuth provider's token exchange URL
- Redirect URI: Callback URL (optional, defaults to current page)
- Scope: Space-separated OAuth scopes (optional)
- Use case: Secure, industry-standard authorization with automatic token refresh
- **Process**: Click "Save & Authenticate" to open OAuth login window
- **⚠️ Important**: The redirect URI must be registered with your OAuth provider by the OAuth administrator before authentication will work

⚠️ **Important Security Notes:**

- **Credentials are stored in browser localStorage**: Your authentication credentials are stored locally in your browser
- **Only use with HTTPS endpoints**: Never send credentials to HTTP endpoints as they will be transmitted in plain text
- **Be cautious on shared computers**: Clear your browser data when using Matgui on shared or public computers
- **OAuth 2.0 tokens**: Access tokens are automatically refreshed when expired (if refresh token is available)
- **Token security**: OAuth 2.0 uses secure PKCE flow (Proof Key for Code Exchange) for enhanced security

**How Authentication Works:**

Authentication is stored per-endpoint, which means:

- All tabs using the same endpoint share the same credentials
- You only need to configure authentication once per endpoint
- Credentials persist across browser sessions (stored in localStorage)

When authentication is configured:

For **Basic Authentication**:

1. Matgui encodes your credentials using Base64 encoding
2. Adds an `Authorization` header with the format: `Basic <encoded-credentials>`
3. Sends this header with every SPARQL query request to that endpoint

For **Bearer Token**:

1. Uses the provided token as-is
2. Adds an `Authorization` header with the format: `Bearer <token>`
3. Sends this header with every SPARQL query request to that endpoint

For **API Key**:

1. Uses the specified custom header name and API key value
2. Adds a custom header with the format: `<Header-Name>: <api-key>`
3. Sends this header with every SPARQL query request to that endpoint

For **OAuth 2.0**:

1. Opens a popup window for OAuth provider authentication
2. Uses Authorization Code flow with PKCE for secure token exchange
3. Stores access token and refresh token
4. Automatically checks token expiration before each query
5. Automatically refreshes expired tokens using refresh token (if available)
6. Adds an `Authorization` header with the format: `Bearer <access-token>`
7. If token refresh fails, prompts user to re-authenticate

**OAuth 2.0 Provider Examples:**

**⚠️ Important Prerequisite:**
Before using OAuth 2.0, the OAuth administrator must register the redirect URI (callback URL) in the OAuth provider's configuration. By default, Matgui uses the current page URL as the redirect URI. For example, if Matgui is hosted at `https://matgui.example.com/`, this URL must be added to the allowed redirect URIs in your OAuth application settings.

_Microsoft Azure (Entra ID):_

- Authorization Endpoint: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/authorize`
- Token Endpoint: `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`
- Scope: `api://your-app-id/.default` or `openid profile`
- Note: Your app must be registered in Azure AD with public client flow enabled
- **Redirect URI Registration**: Add your Matgui URL to "Redirect URIs" in Azure AD app registration

_AWS Cognito:_

- Authorization Endpoint: `https://your-domain.auth.region.amazoncognito.com/oauth2/authorize`
- Token Endpoint: `https://your-domain.auth.region.amazoncognito.com/oauth2/token`
- Scope: `openid profile` (adjust as needed)
- Note: Enable "Authorization code grant" flow in your app client settings
- **Redirect URI Registration**: Add your Matgui URL to "Allowed callback URLs" in Cognito app client settings

_Keycloak:_

- Authorization Endpoint: `https://your-keycloak-domain.com/realms/{realm-name}/protocol/openid-connect/auth`
- Token Endpoint: `https://your-keycloak-domain.com/realms/{realm-name}/protocol/openid-connect/token`
- Scope: `openid profile` (adjust based on client configuration)
- Note: Client should have "Standard Flow" enabled and "Access Type" set to "public"
- **Redirect URI Registration**: Add your Matgui URL to "Valid Redirect URIs" in Keycloak client configuration

### Managed Queries and Workspaces

Matgui can be configured with **managed queries and workspaces**, which provide a shared, versioned store for SPARQL queries (for example in Git or in an RDF store). A managed query is a saved query stored in a workspace. A workspace can be linked to a Git repository or SPARQL endpoint, is set up by the user, and is required before queries can be saved.

**Purpose and Use Cases:**

This feature is designed for **power users** who want to:

- Save and organize their favorite queries with versioning
- Collaborate on queries with team members through Git or shared RDF stores
- Maintain project-specific query collections
- Have persistent, reliable query storage beyond browser tabs

**Not for new user onboarding:** This is not primarily intended as a way to distribute sample queries to help new users get started with an endpoint. If you need to provide example queries for onboarding, consider:

- Using the developer configuration to embed queries in your Matgui instance
- Using the snippets functionality for quick templates
- Implementing a custom wrapper that loads example queries programmatically

#### Workspaces

**Configure workspaces:**

1. Open **Settings** (gear icon in the top bar)
2. Go to the **Workspaces** tab
3. Add one or more workspaces (Git or SPARQL) and choose a **Default workspace**
4. (Optional) Click **Validate access** to test the configuration and show how many managed queries are already saved in that workspace

**Read-only workspaces:** tick **Read-only** in a workspace's settings (or set `readOnly: true` when adding it through `persistentConfig.addOrUpdateWorkspace`) to protect a shared or published set of queries. Queries in a read-only workspace can be browsed and opened, but:

- the workspace is never offered as a save target, and is marked "(read-only)" in the Query Browser
- saving a query opened from it (`Ctrl+S`, the save button or the tab menu) opens **Save as**, so the changes can only be stored as a copy in another workspace
- rename, move and delete are not available in the Query Browser, and renaming the tab only changes the tab label
- editing a query opened from it does not mark the tab as unsaved, and closing the tab does not ask to save

When every configured workspace is read-only, the save button is hidden.

Note: the recommended type of workspace is SPARQL. It is more feature rich (allows to save endpoints and descriptions) and is much faster. The Git based workspace uses HTTP calls to the Git provider API, several calls are required to read/write queries, which makes it slower.

##### SPARQL workspaces

**Configuration fields:**

- **SPARQL endpoint**: which endpoint to use for reading/writing the workspace data. This is selected from your configured endpoints (including any auth headers you set up for that endpoint).
- **Workspace IRI**: the IRI that identifies the workspace in the RDF store (the `yasgui:Workspace` / SKOS concept scheme).
  - After selecting an endpoint, Matgui **automatically queries** the endpoint to discover existing workspaces. Any workspaces found will appear in a dropdown menu for easy selection.
  - You can **select an existing workspace** from the dropdown to reuse already-stored managed queries and collaborate with others using the same workspace.
  - Or choose **"➕ Enter new workspace IRI"** from the dropdown to create a fresh workspace. This reveals a text field where you can enter a custom IRI for your new workspace.
  - If the query for existing workspaces fails (e.g., due to permissions), the dropdown will show "Failed to load workspaces" and you can still enter a new workspace IRI manually.
- **Default graph (optional)**: the named graph to read/write workspace data in (sent as `default-graph-uri`). Leave empty to use the store’s default dataset behavior.

**URI minting strategy:**

In SPARQL-based workspaces, Matgui assigns **immutable identifiers** (URIs) to managed queries and their versions.
This is important because users can rename queries (and query names can change over time), but the **identity** of a managed query should remain stable.

- Managed query URI: `<workspaceIri>_mq_<uuid>`
- Managed query version URI: `<workspaceIri>_mq_v_<uuid>`

Notes:

- The base is always the workspace URI (`workspaceIri`), followed by `_mq_` or `_mq_v_`, then a UUID.
- The URI does **not** include the query name
- Renaming a query changes its `rdfs:label`, not its URI.
- Versions are immutable snapshots linked via `dcterms:isVersionOf`.

**Vocabulary and Ontology:** SPARQL workspaces use RDF vocabularies including SPIN/SP (for representing SPARQL queries), DCTERMS (for versioning via `dcterms:isVersionOf`), RDFS (for labels and descriptions), SKOS (for workspace organization), and custom Matgui predicates for workspace-specific metadata. For implementation details and example data, see the [example workspace data in Turtle format](https://github.com/Matdata-eu/Matgui/blob/main/specs/001-query-management/manual-input/example-data.ttl) and the [full specification](https://github.com/Matdata-eu/Matgui/tree/main/specs/001-query-management). To see how the data is structured in practice, save a few queries with versions in a SPARQL workspace, then query the endpoint to examine the RDF triples.

**Example Workspace Data:**

Here's an example showing how a managed query with multiple versions is stored in RDF:

```turtle
PREFIX dcterms:  <http://purl.org/dc/terms/>
PREFIX prov:     <http://www.w3.org/ns/prov#>
PREFIX rdf:      <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs:     <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sp:       <http://spinrdf.org/sp#>
PREFIX spin:     <http://spinrdf.org/spin#>
PREFIX ssd:      <http://www.w3.org/ns/sparql-service-description#>
PREFIX xsd:      <http://www.w3.org/2001/XMLSchema#>
PREFIX yasgui:   <https://matdata.eu/ns/yasgui#>
PREFIX yasgui-d: <http://matdata.eu/d/yasgui/>

# Workspace definition
yasgui-d:ws1  rdf:type  yasgui:Workspace .

# Managed query (with stable identifier)
yasgui-d:ws1_mq_aaf6a7e1-6dfa-4d06-89c4-7fbd8de475c4
        rdf:type          yasgui:ManagedQuery;
        rdfs:label        "DemoQuery";
        dcterms:isPartOf  yasgui-d:ws1 .

# Version 1 (original version with endpoint and description)
yasgui-d:ws1_mq_v_1e1c4bec-0d79-474a-a930-6f38ec8f90b5
        rdf:type             yasgui:ManagedQueryVersion;
        dcterms:created      "2026-01-06T21:31:33.736Z"^^xsd:dateTime;
        dcterms:description  "This is a demo query to use as example in the user documentation of Yasgui";
        dcterms:isVersionOf  yasgui-d:ws1_mq_aaf6a7e1-6dfa-4d06-89c4-7fbd8de475c4;
        spin:text            "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nSELECT * WHERE {\n  ?sub ?pred ?obj .\n} LIMIT 10";
        prov:used            [ rdf:type      ssd:Service;
                               ssd:endpoint  <https://graph.data.era.europa.eu/repositories/rinf-plus>
                             ] .

# Version 2 (updated query text)
yasgui-d:ws1_mq_v_a7aa79b3-f6b9-441b-a33c-c4a7569b2d89
        rdf:type             yasgui:ManagedQueryVersion;
        dcterms:created      "2026-01-06T21:31:52.422Z"^^xsd:dateTime;
        dcterms:isVersionOf  yasgui-d:ws1_mq_aaf6a7e1-6dfa-4d06-89c4-7fbd8de475c4;
        spin:text            "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nSELECT * WHERE {\n  # New version\n  ?s ?p ?o .\n} LIMIT 10" .

# Version 3 (latest version with formatting changes)
yasgui-d:ws1_mq_v_21c919b1-cc80-4dea-a94f-9ab1cb8b7df5
        rdf:type             yasgui:ManagedQueryVersion;
        dcterms:created      "2026-01-06T21:32:19.959Z"^^xsd:dateTime;
        dcterms:isVersionOf  yasgui-d:ws1_mq_aaf6a7e1-6dfa-4d06-89c4-7fbd8de475c4;
        spin:text            "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n\nSELECT *\nWHERE {\n  # New version\n  ?s ?p ?o .\n}\nLIMIT 10" .

# Endpoint reference (can be shared across queries)
[ rdf:type      ssd:Service;
  ssd:endpoint  <https://dbpedia.org/sparql>
] .
```

This example shows:

- A **workspace** (`yasgui-d:ws1`)
- A **managed query** with a stable URI and human-readable label ("DemoQuery")
- Three **versions** of that query, each with:
  - Creation timestamp
  - Link back to the parent query via `dcterms:isVersionOf`
  - Query text stored in `spin:text`
  - Optional endpoint reference (version 1) via `prov:used`
  - Optional description (version 1)

**Authentication Requirements:** SPARQL workspaces require appropriate permissions on the endpoint. Read access is required to browse and open queries, while write access is required to save, update, or delete queries. Configure authentication for the endpoint in the Endpoints tab before setting up the workspace. If saving fails silently, check that your endpoint credentials have write permissions.

**Tip: local Apache Jena/Fuseki endpoint (Docker)**

If you want a quick local SPARQL endpoint to test with, you can run a Fuseki server with GeoSPARQL support:

```sh
docker run -p 3030:3030 mathiasvda/apache-jena-fuseki-geosparql
```

Then configure Matgui to use the endpoint URL:

`http://localhost:3030/ds/`

**Limitations / notes:**

- If the SPARQL endpoint is blocked by browser **CORS** policies, the workspace may not work without a proxy.

##### Git based workspaces

**Supported providers:**

- **GitHub** (including GitHub Enterprise)
- **GitLab** (GitLab.com and self-hosted)
- **Bitbucket Cloud**
- **Gitea** (self-hosted)

Currently GitHub and GitLab have been thoroughly tested; Bitbucket Cloud and Gitea support covers the same as GitHub/GitLab but have not been extensively tested.

Git workspaces are implemented via the providers' **HTTPS REST APIs**.

- The `remoteUrl` can be `https://...`, `ssh://...`, or SCP-style (e.g. `git@host:org/repo.git`).
- **Important:** SSH/SCP-like remotes are **only parsed** to identify `host` + `owner/repo`. Matgui does **not** implement Git-over-SSH; all reads/writes still happen through the provider's HTTPS API.

**Configuration fields:**

- **Remote URL**: repository URL (see formats above)
- **Token**: stored locally and never re-displayed after entry
- **Advanced (optional)**:
  - **Provider**: force a specific provider client (otherwise auto-detect)
  - **API base URL**: for enterprise/self-hosted instances (e.g., GitHub Enterprise `.../api/v3`, GitLab `.../api/v4`, Gitea `.../api/v1`)
  - **Branch**: optional; if left empty, the provider default branch is used when possible
  - **Root path**: optional subfolder within the repo
  - **Username**: optional; required by Bitbucket Cloud when using an app password

**GitHub Personal Access Token Setup:**

To use a GitHub repository as a workspace, you need to create a Personal Access Token with appropriate permissions.

[Create a GitHub Personal Access Token →](https://github.com/settings/personal-access-tokens)

Required permissions:

**For Classic Personal Access Token:**

- **`public_repo`** - For public repositories only
- **`repo`** (full scope) - For private repositories or full access

**For Fine-grained Personal Access Token:**

Select these Repository permissions:

- **Contents**: Read and write (required for reading/writing `.rq` and `.sparql` files)
- **Metadata**: Read (required for repository access validation)

The token must have access to the specific repository you're configuring as a workspace.

**What the token is used for:**

- Reading repository structure and query files (`.rq`, `.sparql`)
- Creating and updating query files
- Deleting query files
- Reading commit history for versioning
- Validating repository access

**Limitations / notes:**

- If the provider API is blocked by browser **CORS** policies, a Git workspace may not work without a proxy.
- Git workspaces store only query text files (`.rq` or `.sparql`); they do not store endpoint associations, so opening a Git-managed query will not auto-switch endpoints.
- **File format**: Queries are stored as plain text files containing only the SPARQL query text. Files with `.rq` extension (W3C recommended) or `.sparql` extension are recognized and displayed in the query browser.
- The repository can contain other files; only `.rq` and `.sparql` files will be shown in the query browser.
- Authentication/permission errors may not always display clear error messages - check browser console if saves fail silently.

#### Managed queries

**Browse and open managed queries:**

- Click **Panel** in the top bar and select the **Queries** view of the side panel (the query browser)
- Navigate folders and select a query to open it in a new tab
- Pin the panel to keep it open while you open several queries
- SPARQL based workspace only: the endpoint is automatically switched to the one saved with the managed query

**Save as managed query:**

- Use the tab context menu action **Save as managed query**, or **Save current tab** at the bottom of the Queries view
- Saving the same query text does not create a new version; changing text creates a new version

**Copy URI of a managed query:**

- In the **Query Browser**: use the **Copy URI** action button next to any query to copy its URI to the clipboard
- In the **tab context menu** (right-click a tab): use **Copy URI** when the tab is linked to a managed query
- For SPARQL workspaces the URI is the managed-query IRI stored in the triplestore
- For Git workspaces the URI is the browser-accessible link to the file in the repository (GitHub/GitLab/Bitbucket/Gitea)

**View version history of a managed query:**

- In the **Query Browser**: right-click any query and choose **History**
- A dialog opens listing all saved versions of that query (newest first), each showing its date, author, and save message
- Click a version in the list to preview its SPARQL text on the right side of the dialog
- Click **Open in tab** to open the selected historical version in a new tab linked to the managed query; from there you can edit and re-save it to create a new version

**Credentials:**

- Tokens are stored locally, not saved together with the managed query and are not re-displayed after entry

### Query History and Persistence

Matgui automatically saves your work locally.

**What's Saved:**

- Query text in each tab
- Tab names and order
- Endpoint configurations
- Last query results
- User preferences (theme, layout, etc.)
- Custom endpoint buttons

**Persistence Duration:**

- Default: 30 days
- Configurable by administrators

**Note:** Data is stored in your browser's local storage. Clearing browser data will remove saved queries.

### Share Queries

Share your queries with colleagues using multiple formats including URL parameters, cURL, PowerShell, and wget commands.

**Share Button:**

YASQE provides a share button (when `createShareableLink` is configured) that offers multiple sharing options:

1. **Copy URL** - Copies the shareable URL to your clipboard
2. **Shorten URL** - Creates a shortened URL (if URL shortener is configured)
3. **Copy cURL** - Generates and copies a cURL command for command-line execution
4. **Copy PowerShell** - Generates and copies a PowerShell command using `Invoke-WebRequest`
5. **Copy wget** - Generates and copies a wget command

**How to Share:**

Matgui supports URL-based query sharing:

1. Craft your query in MatGUI
2. Click the share button (sharing icon in the top-right corner)
3. Select your preferred format
4. The content is automatically copied to your clipboard
5. Share with others or execute in your terminal

**URL Parameters:**

- `query`: The SPARQL query
- `endpoint`: The endpoint URL
- Other tab configurations

**Command-Line Formats:**

All command-line formats (cURL, PowerShell, wget) include:

- The complete SPARQL query
- All configured headers
- Authentication credentials (if configured)
- Proper HTTP method (GET or POST)

⚠️ **Security Notice:** When copying commands with authentication credentials, a warning notification will appear. Be cautious about sharing these commands as they contain sensitive authentication information.

**Example Formats:**

_cURL:_

```bash
curl 'https://example.com/sparql' \
  --data 'query=SELECT%20...' \
  -X POST \
  -H 'Authorization: Bearer token' \
  -H 'Accept: application/sparql-results+json'
```

_PowerShell:_

```powershell
$params = @{
    Uri = "https://example.com/sparql"
    Method = "Post"
    Headers = @{
        "Accept" = "application/sparql-results+json"
        "Authorization" = "Bearer token"
    }
    ContentType = "application/x-www-form-urlencoded"
    Body = "query=SELECT%20..."
    OutFile = "result.json"
}

Invoke-WebRequest @params
```

_wget:_

```bash
wget 'https://example.com/sparql' \
  --body-data 'query=SELECT%20...' \
  --method POST \
  --header 'Authorization: Bearer token' \
  --header 'Accept: application/sparql-results+json' \
  -O -
```

---

## Plugins

YASR (Results Viewer) uses plugins to visualize query results in different formats. The appropriate plugin is automatically selected based on your query type and results.

### Table Plugin

Displays SELECT query results in an interactive, high-performance table with advanced features.

**Features:**

- **Virtual Scrolling**: Efficiently handles 10,000+ rows without pagination
- **Sortable Columns**: Click column headers to sort ascending/descending
- **Column Resizing**: Drag column borders to resize
- **Real-time Search**: Filter rows by text with highlighting
- **Cell Selection**: Select individual cells or ranges with Shift+Click, copy with Ctrl+C
- **Cell Formatting**: URIs, literals, blank nodes, and datatypes properly rendered
- **Tooltips**: Hover over any cell to view full content
- **Copy to Clipboard**: Export as Markdown, CSV, or TSV (tab-delimited) with visual notifications
- **CSV Download**: Integrated with YASR's download interface
- **Dynamic Theming**: Automatically adapts to Matgui light/dark theme changes
- **Customizable Display**:
  - **URI Display**: Toggle between full URIs and prefixed abbreviations (e.g., `foaf:name`)
  - **Datatypes**: Show/hide datatype annotations on literals (e.g., `"42"^^xsd:integer`)
  - **Ellipsis Mode**: Truncate long cell content with "..." (hover for tooltip or click for modal)
  - **Fit Controls**: Fit table to data width or window width
- **Smart Formatters**: Auto-render columns based on variable name suffixes — `stars` (star ratings), `percent` (progress bars), `image` (images), `color`/`colour` (color swatches), and `description` (wrapping text)
- **Decimal Places**: Configure a fixed number of fraction digits for `xsd:float`, `xsd:double`, and `xsd:decimal` literals, or leave unset to show raw values
- **Describe Resource**: Ctrl+click (or Cmd+click on macOS) any URI to run a background query for the triples where it is the **subject**, or Ctrl+Shift+click for the triples where it is the **object**, and view them in a modal. Right-click a URI for the same options, or to run them as a new query that replaces the editor query
- **Describe Navigation**: Ctrl+click (or Ctrl+Shift+click) a URI inside the describe modal to hop to that resource. Use the ◀ / ▶ buttons in the modal header (or `Alt+←` / `Alt+→`) to step back and forward through the resources you visited, and ⏮ to return to the resource you started from

**Controls:**

- **Search**: Text field to filter rows in real-time with highlighted matches
- **Display**: Dropdown with display options:
  - **URI Display**: Toggle between abbreviated (prefix:localName) and full URI display
  - **Datatypes**: Toggle visibility of datatype annotations on literal values
  - **Ellipsis**: Toggle content truncation for long values (hover shows tooltip)
  - **Smart Formatters**: Toggle convention-based rendering for columns ending in `stars`, `percent`, `image`, `color`/`colour`, or `description`
  - **Decimal Places**: Set a fixed number of fraction digits for `xsd:float`, `xsd:double`, and `xsd:decimal` values (empty = raw value)
- **Fit to Data**: Resize columns to show all content without truncation
- **Fit to Window**: Resize columns proportionally to fill viewport width
- **Copy as Markdown**: Copy entire table in Markdown format with visual confirmation
- **Copy as CSV**: Copy entire table as comma-separated values with visual confirmation
- **Copy as TSV**: Copy entire table as tab-delimited values with visual confirmation
- **Download CSV**: Access via YASR's download button for CSV file export
- **URI Context Menu**: Right-click any URI to open, describe in a modal, or describe as a new query

**Best For:**

- SELECT queries with large result sets (10,000+ rows)
- Exploring structured data with complex URIs
- Interactive data analysis with sorting and filtering
- Sharing results in documentation (Markdown/CSV/TSV)
- Extracting specific data subsets via cell selection

**Usage:**

- Execute a SELECT query
- Table plugin activates automatically for SELECT results
- Click column headers to sort (click again to reverse)
- Type in search box to filter rows (highlights matches)
- Hover over cells to see full content in tooltip
- Click and drag to select cell ranges, then Ctrl+C to copy
- Use copy buttons to export entire table in different formats
- Use fit controls to optimize column widths
- Open the **Display** dropdown to toggle URI mode, datatypes, ellipsis, smart formatters, and set decimal places
- Use columns named with smart-formatter suffixes (e.g., `ratingStars`, `completionPercent`) for automatic visual formatting
- Ctrl+click (or Cmd+click) any URI to see its triples as subject, Ctrl+Shift+click to see them as object, or right-click the URI for more options
- In the describe modal, keep Ctrl+clicking URIs to hop from resource to resource; use ◀ / ▶ (or `Alt+←` / `Alt+→`) to go back and forward, and ⏮ to return to the first resource
- Use YASR's download button for CSV file export
- Preferences (column widths, sort state, display options) are saved to localStorage

**More Information:**
Visit the [Table Plugin Repository](https://github.com/Matdata-eu/yasgui-table-plugin) for detailed documentation.

### Boolean Plugin

Displays boolean results from ASK queries.

**Features:**

- Clear true/false visual indicator
- Color-coded responses (green for true, red for false)
- Large, easy-to-read display

**Best For:**

- ASK queries
- Checking if patterns exist in the data
- Boolean validation queries

**Usage:**

- Execute an ASK query
- Boolean plugin activates automatically
- Result shown as TRUE ✓ or FALSE ✗

### Response Plugin

Shows the raw response from the SPARQL endpoint.

**Features:**

- Syntax highlighting for different formats:
  - JSON
  - XML
  - Turtle
  - Other RDF serializations
- Code folding for nested structures
- Copy to clipboard functionality
- Line numbers
- **Ctrl+Click on a URI** executes a CONSTRUCT query where the URI is the **subject** and append the returned triples to the response view (similar to the Graph plugin's node expansion)
- **Ctrl+Click on a URI** executes a CONSTRUCT query where the URI is the **object** and append the returned triples to the response view (similar to the Graph plugin's node expansion)

**Best For:**

- Debugging queries
- Inspecting raw endpoint responses
- Understanding response structure
- Working with specific response formats
- Progressively exploring a resource without leaving the raw response view

**Usage:**

- Execute any query
- Select "Response" from the plugin selector
- View raw response with syntax highlighting
- Hold `Ctrl` (or `Cmd` on macOS) and click any URI in the response to fetch and append its `DESCRIBE` result

### Graph Plugin

Visualizes RDF data as an interactive node-edge graph with advanced customization options.

**Features:**

- **🔷 Interactive Force-Directed Layout**: Automatic physics-based positioning with smooth animations
- **� Node Expansion**: Double-click any URI node to fetch and merge related triples via DESCRIBE queries
- **🎨 Smart Color Coding**: 
  - 🔵 Light Blue (#97C2FC) = URIs
  - 🟢 Light Green (#a6c8a6ff) = Literals
  - ⚪ Light Grey (#c5c5c5ff) = Blank nodes
  - 🟠 Orange (#e15b13ff) = rdf:type objects (classes)
- **🖼️ Node Icons & Images**: Display images or emoji icons on nodes via `schema:image` or `schema:icon` properties
- **📦 Compact Mode**: Hide literal and class nodes; show rdf:type and datatype properties in enhanced tooltips instead
- **🔍 Advanced Navigation**: 
  - Mouse wheel zoom
  - Drag to pan
  - "Zoom to Fit" button to center the entire graph
- **✋ Drag & Drop**: Reorganize nodes by dragging (nodes stay pinned after manual drag)
- **💬 Rich HTML Tooltips**: Display node type, value, namespace, and datatype information on hover
- **🌓 Theme Support**: Automatic light/dark mode detection with dynamic color switching
- **♿ Accessibility**: WCAG AA color contrast, keyboard navigation support

**Best For:**

- CONSTRUCT queries returning RDF triples
- DESCRIBE queries exploring resource relationships
- Exploring RDF structure and relationships
- Visualizing knowledge graphs
- Understanding complex ontologies

**Basic Usage:**

1. Execute a CONSTRUCT or DESCRIBE query
2. Select "Graph" from the plugin selector
3. Navigate:
   - **Zoom**: Mouse wheel (scroll up = zoom in, scroll down = zoom out)
   - **Pan**: Click and drag the background
   - **Fit to View**: Click the "Zoom to Fit" button
4. Interact:
   - **Drag Nodes**: Click and drag any node to reposition it
   - **Tooltips**: Hover over nodes/edges to see detailed information

**Configuration Settings:**

Click the **⚙ Settings** button to access these options:

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| **Compact mode** | on / off | off | Hide literal and class nodes; show in tooltips instead |
| **Arrow style** | Curved / Straight | Curved | Edge appearance between nodes |
| **Predicate display** | Label / Icon / Hidden | Icon | Show full URI, compact symbol, or nothing on edges |
| **Show literals** | on / off | on | Include/exclude literal value nodes |
| **Show classes** | on / off | on | Include/exclude rdf:type object nodes |
| **Show blank nodes** | on / off | on | Include/exclude blank nodes |
| **Show node labels** | on / off | on | Display labels inside nodes |
| **Enable physics** | on / off | on | Keep force-directed layout simulation running |
| **Node size** | Small / Medium / Large | Medium | Set the radius of all nodes |

**Predicate Icons:**

When *Predicate display* is set to **Icon**, edges show compact symbols for common predicates:

- **RDF/RDFS**: `a` (rdf:type), `lbl` (rdfs:label), `cmt` (rdfs:comment), `⊂` (rdfs:subClassOf), `⊆` (rdfs:subPropertyOf)
- **OWL**: `≡` (owl:sameAs), `≅` (owl:equivalentClass), `⇄` (owl:inverseOf), `≠` (owl:disjointWith)
- **SKOS**: `★` (skos:prefLabel), `☆` (skos:altLabel), `↑` (skos:broader), `↓` (skos:narrower), `↔` (skos:related)
- **Dublin Core**: `ttl` (dcterms:title), `dsc` (dcterms:description), `crt` (dcterms:created), `by` (dcterms:creator)
- **FOAF/Schema.org**: `nm` (name), `⟷` (foaf:knows), and more

**Node Icons and Images:**

Display custom icons or images on nodes using:

- **`schema:image`** (`https://schema.org/image`): URL to image (renders as circular image)
- **`schema:icon`** (`https://schema.org/icon`): Emoji or short string (displays as node label)

**Example:**
```sparql
CONSTRUCT {
  ex:alice schema:image <https://example.com/alice.png> .
  ex:alice ex:knows ex:bob .
  ex:Person schema:icon "👤" .
  ex:alice rdf:type ex:Person .
}
WHERE {}
```

In compact mode, `ex:alice` will inherit the `👤` emoji from the `ex:Person` class.

**Understanding Colors:**

| Color | Meaning | Example |
|-------|---------|---------|
| 🔵 Light Blue | URI nodes | `ex:Person`, `ex:Alice` |
| 🟢 Light Green | Literal values | `"Alice"`, `"30"^^xsd:integer` |
| ⚪ Light Grey | Blank nodes | `_:b1`, `_:addr1` |
| 🟠 Orange | rdf:type objects (classes) | `ex:Person` in `ex:Alice rdf:type ex:Person` |

**Double click expansion:**

The graph plugin supports **interactive node expansion** via double-clicking. This allows you to progressively explore RDF graphs by fetching additional triples for any URI node without redrawing the entire graph.

How It Works:

1. **Double-click a blue URI node** in the graph
2. The node's border turns **orange and thickens** (loading state)
3. A `DESCRIBE <uri>` query is sent to the SPARQL endpoint
4. **New triples are merged** into the existing graph
5. Node's border returns to normal width with **thicker border (3px) to indicate expansion**
6. Graph layout and zoom level are **preserved**

**Performance:**

- Good performance: 500-1,000 nodes
- For large graphs: Consider using LIMIT in your SPARQL query

**Persistence:**

All settings are automatically saved to localStorage and persist across browser sessions.

**More Information:**

Visit the [Graph Plugin Repository](https://github.com/Matdata-eu/yasgui-graph-plugin) for detailed documentation, examples, and troubleshooting.

### Geo Plugin

Displays geographic SPARQL results on an interactive [Leaflet](https://leafletjs.com/) map. It supports a wide range of geometry formats and coordinate systems, and includes tools for styling, filtering, exploring, and exporting spatial data.

**Best For:**

- Queries returning WKT geometries (`geo:wktLiteral`)
- Queries returning GeoJSON, GML, or GeoHash literals
- Queries with `?lat`/`?lon` numeric columns (auto-detected, no WKT needed)
- Visualizing geographic distributions, routes, and regions
- Spatial exploration with drawing-based SPARQL filter generation
- Animated playback of time-stamped geographic data

---

**Supported Data Formats:**

The plugin automatically recognizes result columns whose values use any of these datatypes:

| Format | Datatype |
|---|---|
| WKT | `geo:wktLiteral`, `virtrdf:Geometry`, `wgs84:geometry` |
| GeoJSON | `geo:geoJSONLiteral` |
| GML | `geo:gmlLiteral` |
| GeoHash | `geo:geoHashLiteral` |

When your query returns `?lat` and `?lon` (or `?latitude`/`?longitude`) as numeric values, the plugin synthesizes a point geometry automatically — no WKT column required.

All WKT geometry types are supported: `POINT`, `LINESTRING`, `POLYGON`, `MULTIPOINT`, `MULTILINESTRING`, `MULTIPOLYGON`, and `GEOMETRYCOLLECTION`.

---

**Getting Started:**

1. Execute a query that returns geometry bindings or `?lat`/`?lon` columns.
2. The Geo plugin tab appears automatically when geographic data is detected.
3. Click the **Geo** tab to switch to the map view.
4. The map auto-fits to the extent of the returned features.

**Minimal example — lat/lon columns:**

```sparql
SELECT ?name ?lat ?lon WHERE {
  ?city a <http://dbpedia.org/ontology/City> ;
        rdfs:label   ?name ;
        geo:lat      ?lat ;
        geo:long     ?lon .
  FILTER(LANG(?name) = 'en')
} LIMIT 100
```

**Minimal example — WKT geometry:**

```sparql
PREFIX geo: <http://www.opengis.net/ont/geosparql#>

SELECT ?feature ?wkt WHERE {
  ?feature geo:hasGeometry/geo:asWKT ?wkt .
} LIMIT 500
```

---

**Map Controls:**

The map toolbar includes several controls:

| Control | Location | Description |
|---|---|---|
| Zoom in / out | Top-left | Standard Leaflet zoom buttons. |
| Layers | Top-right | Toggle basemaps and switch geometry column overlays on/off. |
| Style | Top-right | Set default color, opacity, fill, stroke width, and marker radius. |
| Simplify | Top-right | Live tolerance slider to reduce geometry complexity. |
| Drawing | Top-left | Draw a rectangle or polygon to generate a spatial SPARQL filter. |
| Export | Top-right | Download or copy results in multiple formats. |
| Coordinate readout | Bottom | Shows the cursor's lat/lon position. |
| Attribution | Bottom-right | Basemap attribution. |

---

**Popups:**

Click any feature on the map to open an information popup. The popup shows:

- All SPARQL binding values for that result row, rendered as a key/value table.
- IRIs are linkified (clickable links).
- Bindings whose value is an image URL render as an inline image preview.

You can override the popup content by including a `?wktLabel` binding in your query (plain text or Markdown), or add a `?wktTooltip` binding for hover-only tooltips.

---

**Describing Entities:**

Explore the graph behind a feature without losing the map:

- **Ctrl+click** (Cmd+click on macOS) a feature, or an IRI in its popup, to list the triples where that entity is the **subject**.
- **Ctrl+Shift+click** lists the triples where it is the **object**.
- The triples are fetched with a background query and shown in a modal, so the map keeps its results. IRIs are abbreviated with the prefixes declared in your query.
- Ctrl+click (or Ctrl+Shift+click) an IRI inside the modal to hop to that entity.
- Use the ◀ / ▶ buttons in the modal header (or `Alt+←` / `Alt+→`) to step back and forward through the entities you visited, and ⏮ to return to the entity you started from. Ctrl+clicking a new IRI after going back drops the forward steps, like a browser.

---

**Per-Feature Styling:**

Include a `?wktColor` variable in your SELECT to color individual features:

```sparql
SELECT ?name ?wkt ?wktColor WHERE {
  VALUES (?name ?wktColor) {
    ("Forest" "green")
    ("Lake"   "blue")
    ("Road"   "#888888")
  }
  # ... bind ?wkt ...
}
```

The style control also lets you set global defaults (color, opacity, fill on/off, stroke width, point radius) that are remembered across sessions for the same query.

---

**Marker Clustering:**

When clustering is enabled by the site administrator, nearby point markers are grouped into cluster markers at lower zoom levels. The cluster marker displays the feature count; zoom in or click to expand. Clustering activates automatically when the result set exceeds a configured threshold.

---

**Heatmap:**

When heatmap mode is enabled, point features are rendered as a colour-gradient intensity layer instead of individual markers. Lines and polygons always render normally.

---

**Drawing Spatial Filters:**

Use the drawing tools (rectangle or polygon) to select an area on the map. After you finish drawing, a panel displays a GeoSPARQL `sfWithin` filter snippet:

```sparql
FILTER(geof:sfWithin(?geom, "POLYGON((...))"^^geo:wktLiteral))
```

Click **Copy** to copy it to the clipboard, then paste it into your SPARQL query to restrict results to that area. Required prefixes:

```sparql
PREFIX geo:  <http://www.opengis.net/ont/geosparql#>
PREFIX geof: <http://www.opengis.net/def/function/geosparql/>
```

---

**Geometry Simplification:**

The simplify slider reduces the number of vertices in complex polygon/line geometries. Drag the slider right to increase the tolerance; drag left to restore full detail. This is useful for improving rendering performance with highly detailed boundaries.

---

**Temporal Filtering (Time Slider):**

When your results include a `?time`, `?date`, `?datetime`, `?timestamp`, `?start`, or `?startDate` binding, a time slider appears below the map. Use it to:

- Scrub through time and see which features are active at each point.
- Press **Play** to animate forward through the timeline automatically.
- Toggle between **Cumulative** mode (show all features up to the selected time) and **Instant** mode (show only features at exactly the selected time).

Features without a timestamp are always visible regardless of the slider position.

---

**Export:**

The Export control (top-right of the map) lets you save or share the visible data:

| Option | Description |
|---|---|
| **Download GeoJSON** | Save all visible features as a `.geojson` file. |
| **Copy GeoJSON** | Copy the GeoJSON to the clipboard. |
| **Download KML** | Save as a `.kml` file (compatible with Google Earth, QGIS, etc.). |
| **Download CSV** | Save as a `.csv` file with one row per feature and a `wkt` column. |
| **Download PNG** | Save a screenshot of the current map viewport. |

---

**Permalink:**

When permalink support is enabled, the URL in your browser's address bar is automatically updated as you pan and zoom. Sharing that URL with a colleague will open the map at the same view, with the same basemap and layer visibility. No extra steps needed.

---

**CRS and Coordinate Order:**

The plugin handles coordinate reference systems automatically:

- **Plain WKT / CRS84**: coordinates are in lon/lat order.
- **`SRID=4326;` EWKT prefix**: lon/lat order.
- **EPSG:4326 URI prefix** (e.g. `<http://www.opengis.net/def/crs/EPSG/0/4326>`): lat/lon authority order — the plugin swaps the coordinates automatically for correct display.
- **Other projected CRS** (e.g. Belgian Lambert, RD New, ETRS89-LCC): reprojected on the fly; no manual configuration needed for common systems.

---

**Troubleshooting:**

| Symptom | What to check |
|---|---|
| Geo tab does not appear | Verify the query returns a geometry binding or `?lat`/`?lon` columns. |
| Map is empty after switching to Geo | Open the Table tab to confirm the query returned data. Check that geometry literals use a recognized datatype. |
| Features appear in the wrong location | Check the coordinate order. WKT from a GeoSPARQL endpoint using EPSG:4326 URI CRS is in lat/lon order, not lon/lat. |
| Popup shows raw IRI instead of a label | Add a `?wktLabel` binding to your query for a human-readable popup. |
| Time slider not visible | Ensure your query includes a variable named `?time`, `?date`, or another recognized temporal binding. |
| PNG export is blank or missing basemap tiles | Most tile providers block cross-origin rendering. Switch to the OpenStreetMap basemap before exporting. |

---

**More Information:**

Visit the [Matgui Geo Plugin repository](https://github.com/Matdata-eu/yasgui-geo-plugin/) for full documentation.

### Chart Plugin

Visualises SELECT results as charts with [Apache ECharts](https://echarts.apache.org/): bar (grouped, stacked or horizontal), line, area, pie, donut, scatter and histogram.

**Best For:**

- Aggregation queries (`COUNT`, `SUM`, `AVG` with `GROUP BY`), e.g. track length per line category or operational points per country
- Values over time (a date column plus numbers)
- Comparing two numeric columns (scatter plot)
- The distribution of one numeric column (histogram)

---

**Getting Started:**

1. Execute a SELECT query that returns at least one numeric column.
2. Click the **Chart** tab. It is only enabled when the results contain a numeric column; SELECT results still open in the Table by default.
3. The plugin picks a chart automatically:
   - a label or IRI column plus numbers gives a **bar chart**
   - a date column (`xsd:date`, `xsd:dateTime`, `xsd:gYear`, `xsd:gYearMonth`) plus numbers gives a **line chart**
   - only numeric columns give a **scatter plot** (first column on the x axis), or a **histogram** when there is a single one
   - "long" results such as `?country ?type ?count` are split into one **series** per `?type`

**Example:**

```sparql
PREFIX era: <http://data.europa.eu/949/>

SELECT ?country (COUNT(?op) AS ?operationalPoints) WHERE {
  ?op a era:OperationalPoint ;
      era:inCountry ?country .
}
GROUP BY ?country
ORDER BY DESC(?operationalPoints)
```

---

**Toolbar:**

The chart's controls sit in the shared toolbar under the results header:

| Control | What it does |
| --- | --- |
| **Type** | Chart type: Bar, Stacked bar, Horizontal bar, Line, Area, Pie, Donut, Scatter, Histogram |
| **X axis** / **Slices** | Column used for the categories or the x axis |
| **Values** / **Size** | Numeric column(s) to plot (pie, donut and histogram use one) |
| **Series** | Column whose values split the data into series |

The **View settings** menu at the far right of the toolbar has **Automatic chart** (go back to the automatic chart) and **Download PNG** / **Download SVG**. It also has **Shorten IRIs with prefixes** (on by default): IRIs without a label column show as prefixed names, using the prefixes from your query and a few well-known ones such as `wd:` and `rdfs:`. Turn it off to see full IRIs. This setting arrives with the next chart plugin release.

Your choices are saved per tab. When the query returns other variables, the chart starts again from the automatic choice. The download button in the results header also saves the chart as PNG.

**Labels and IRIs:**

- IRIs are shown with their label when the query returns a label column named after them (`?line` with `?lineLabel`, `?line_label` or `?lineName`), otherwise as prefixed names.
- Hover a bar, slice or point to see its value and full IRI.
- **Ctrl+click** (Cmd+click on macOS) a bar, slice or point to show the triples of its IRI in the [describe panel](#describing-a-resource), like in the Table, Geo and Graph plugins. **Ctrl+Shift+click** shows the triples where the IRI is the object.

**Good to know:**

- Rows that repeat a category (and series) are summed.
- Long category axes get a zoom slider.
- At most 5,000 rows are plotted; a note says when results are cut.
- The chart follows the light and dark theme.

---

**More Information:**

Visit the [Chart Plugin repository](https://github.com/Matdata-eu/yasgui-chart-plugin) for full documentation and the [online demo](https://matdata-eu.github.io/yasgui-chart-plugin/).

### Explain Plugin

Shows how your query is executed. The **Explain** tab has two parts:

- **Execution plan**: the operations the triple store ran for your query, with the rows and the time of each. MatGUI asks the endpoint for it with one extra request after your query completed, using the authentication and request settings of the tab. The slowest operation is highlighted, which is usually the answer to "why is this query slow".
- **Algebra**: your query translated to SPARQL algebra, the form in which engines plan it (`project`, `join`, `leftjoin`, `filter`, `union`, ...). It is computed in MatGUI itself and works for any endpoint. Syntax errors are reported here with the parser's message.

**Best For:**

- Finding the join or scan that takes the time in a slow query
- Checking that a `FILTER` or `OPTIONAL` is evaluated where you think it is
- Learning how a query reads in SPARQL algebra

---

**Supported engines:**

| Engine | What the plan shows |
|---|---|
| QLever | The operation tree with time, rows and cache status per operation |
| GraphDB | The chosen order of the patterns with estimated sizes (no timings) |
| Stardog | The profiled plan with rows, wall time and memory per operator |
| Blazegraph | Blazegraph's explain page (syntax tree, operator plan, statistics) |
| Amazon Neptune | Neptune's explain table, one row per operator |

Virtuoso, Jena Fuseki, Oxigraph, RDF4J and Comunica publish no plan over the SPARQL protocol; for those endpoints only the algebra is shown.

---

**Getting Started:**

1. Run your query.
2. Open the **Explain** tab. The algebra appears at once.
3. MatGUI recognises the engine from the endpoint URL (QLever, GraphDB, Blazegraph, Stardog and Neptune have recognisable URLs). When it does not, pick the engine in the **Engine** list; the choice is remembered for that endpoint. **No plan** switches the request off for an endpoint.
4. **Refresh plan** asks the engine again, for example after the endpoint's cache warmed up.

Each operation of the plan can be folded. **Expand all**, **Collapse all** and **Copy** act on the whole tree; **Download** in the results header saves the plan and the algebra as a text file. The algebra's **Copy** gives the s-expression notation used by Apache Jena ARQ and the SPARQL specification, handy for issues and documentation.

---

**Good to know:**

- The plan request is a second, separate request. Your results are never changed by it, and when it fails (unsupported engine, authentication, CORS) only the plan section says so.
- QLever answers the plan request from its result cache, so operations that were already cached show their original times in their details.
- The GraphDB plan is asked with the `onto:explain` pseudo graph. RDF4J shares GraphDB's URL layout but has no explain, so the request fails there.

---

**More Information:**

Visit the [Explain Plugin repository](https://github.com/Matdata-eu/yasgui-explain-plugin) for full documentation and the [online demo](https://matdata-eu.github.io/yasgui-explain-plugin/).

### Error Plugin

Displays error messages and diagnostic information when queries fail.

**Features:**

- Detailed error messages
- HTTP status codes
- SPARQL endpoint errors
- CORS troubleshooting guidance
- Helpful suggestions for common issues

**Best For:**

- Understanding query failures
- Debugging endpoint issues
- Troubleshooting CORS problems

**When It Appears:**

- Query execution fails
- Network errors occur
- SPARQL syntax errors
- Endpoint unavailable

**Common Error Types:**

- **CORS Errors**: Cross-origin request blocked
- **Syntax Errors**: Invalid SPARQL syntax
- **Timeout**: Query took too long
- **404**: Endpoint not found
- **500**: Server error

**AI help:** with the [AI assistant](#ai-assistant), the error view shows **Fix with AI**, which explains the error and suggests a corrected query, and **Copy for AI**, which copies the query and the error as a prompt for an AI chat of your choice.

### Plugin Selection

**Automatic Selection:**
Matgui automatically selects the most appropriate plugin based on:

- Query type (SELECT, CONSTRUCT, ASK, DESCRIBE)
- Response content type
- Data structure

**Manual Selection:**

- Use the plugin selector buttons at the top of the results area
- Available plugins depend on the query results
- Your selection is saved per tab

**Selection from the Query:**

Start the query with a `#defaultView:` comment to pick the view its results open in, the same way the [Wikidata Query Service](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/Wikidata_Query_Help/Result_Views) does:

```sparql
#defaultView:Geo
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?station ?wkt WHERE { ?station geo:hasGeometry/geo:asWKT ?wkt }
```

- Use a plugin name (`Table`, `Geo`, `Graph`, `Chart`, `Response`); the casing doesn't matter
- Wikidata view names work too: `Map` opens the Geo plugin, and `LineChart`, `BarChart`, `ScatterChart`, `AreaChart` and `BubbleChart` open the Chart plugin
- Each run applies the comment again, so it wins over the plugin you picked by hand for that tab
- When the plugin can't show the results (for example `#defaultView:Geo` on a query without geometries), MatGUI falls back to a plugin that can, as usual
- Inserting prefixes keeps the comment on the first line

---

### Describing a Resource

When a result view lets you describe a resource (for example Ctrl+click on an IRI in the table, or on a feature in the map, a node in the graph or a bar in a chart), its triples open in the describe panel on the right of the results. On narrow screens the panel slides over the results instead. The panel shows the resource's label, its IRI and its types, and a list of its properties. When a resource has more than three types, click **…** to see the rest. Use **Outgoing** and **Incoming** to switch between the triples where the resource is the subject and those where it is the object (incoming triples are limited to the first 1000). Click any resource in the panel to describe it in turn, or Shift+click to see its incoming triples. The back and forward buttons (or Alt+Left and Alt+Right while the panel has focus) walk through the resources you visited. The **Raw** tab shows the response exactly as the endpoint returned it. **Open as query** opens the query behind the panel in a new tab, and **Copy IRI** copies the resource's IRI. Press Escape or the close button to close the panel. "Opened from …" tells you which view opened it. Prefixes from your query are used to shorten IRIs.

To give the panel more room:

- drag its left edge to make it wider (double-click the edge to go back to the default width)
- click the **Float** button next to the close button to turn it into a window you can move by its top bar and resize from its bottom-right corner; the **Dock** button puts it back next to the results
- click **Maximize** to show it over the whole window; **Restore** or Escape brings it back, and double-clicking the top bar of the floating window maximizes it too

MatGUI remembers the width, and whether the panel floats and where, for the next time.

Every view now shows its controls in the same toolbar under the result header, with **View settings** at the far right. Plugin versions that predate this keep their own toolbar and describe window.

## Keyboard Shortcuts

Master Matgui with these keyboard shortcuts for faster querying.

### Query Editor (YASQE)

| Shortcut                    | Action                           |
| --------------------------- | -------------------------------- |
| `Ctrl+Enter` / `Cmd+Enter`  | Execute query                    |
| `Ctrl+Space`                | Trigger autocomplete             |
| `Ctrl+S`                    | Save query to local storage      |
| `Ctrl+Shift+F`              | Format query                     |
| `Ctrl+/`                    | Toggle comment on selected lines |
| `Ctrl+Shift+D`              | Duplicate current line           |
| `Ctrl+Shift+K`              | Delete current line              |
| `Esc`                       | Remove focus from editor         |
| `Esc` (side panel, menu)    | Close the menu, or the unpinned side panel |
| `Ctrl+Click` (on URI)       | Explore outgoing URI connections |
| `Ctrl+Shift+Click` (on URI) | Explore incoming URI connections |

### Fullscreen

| Shortcut | Action                                   |
| -------- | ---------------------------------------- |
| `F11`    | Toggle YASQE (editor) fullscreen         |
| `F10`    | Toggle YASR (results) fullscreen         |
| `F9`     | Switch between YASQE and YASR fullscreen |
| `F8`     | Toggle the Endpoint view of the side panel |
| `Esc`    | Exit fullscreen mode                     |

### Matgui Tabs

| Shortcut                                 | Action                                        |
| ---------------------------------------- | --------------------------------------------- |
| `Ctrl+Alt+Tab` / `Cmd+Alt+Tab`           | Switch to previously used Matgui tab          |
| `Ctrl+Alt+Shift+Tab` / `Cmd+Alt+Shift+Tab` | Switch to next tab in recently used order   |

### Workspace

| Shortcut           | Action                                       |
| ------------------ | -------------------------------------------- |
| `Ctrl+K` / `Cmd+K` | Search saved queries, commands and settings  |
| `Ctrl+B` / `Cmd+B` | Show or hide the side panel                  |
| `F8`               | Show or hide the endpoint overview           |

### General Editor

| Shortcut           | Action            |
| ------------------ | ----------------- |
| `Ctrl+F` / `Cmd+F` | Find in query     |
| `Ctrl+H` / `Cmd+H` | Find and replace  |
| `Ctrl+G` / `Cmd+G` | Go to line        |
| `Ctrl+Z` / `Cmd+Z` | Undo              |
| `Ctrl+Y` / `Cmd+Y` | Redo              |
| `Tab`              | Indent selection  |
| `Shift+Tab`        | Outdent selection |

### Results Viewer (YASR)

Navigation and interaction depend on the active plugin. Most plugins support:

- **Mouse wheel**: Scroll through results
- **Arrow keys**: Navigate table cells (in Table plugin)
- **Click**: Select/interact with elements
- **Ctrl+Click / Ctrl+Shift+Click** (on a URI in the Table or Geo plugin): Show the triples where the URI is the subject / object in a describe modal
- **Alt+← / Alt+→** (in a describe modal): Go back / forward through the resources you hopped to

---

## Troubleshooting

### Common Issues and Solutions

#### Query Not Executing

**Symptoms:**

- Click Execute but nothing happens
- No results appear

**Solutions:**

1. **Check Query Syntax**: Look for red error indicators in the editor
2. **Verify Endpoint**: Ensure the endpoint URL is correct and accessible
3. **Check Browser Console**: Open browser developer tools (F12) for error messages
4. **Check Internet Connection**: Ensure you're online
5. **Try a Simple Query**: Execute a basic query to test the endpoint:
   ```sparql
   SELECT * WHERE { ?s ?p ?o } LIMIT 1
   ```

#### CORS Errors

**Symptoms:**

- Error message about "Cross-Origin Request Blocked"
- Query works in other tools but not in MatGUI

**Explanation:**
CORS (Cross-Origin Resource Sharing) is a browser security feature. Some SPARQL endpoints don't allow browser-based queries from different domains.

**Solutions:**

1. **Check Endpoint CORS Policy**: Contact the endpoint administrator
2. **Use CORS Proxy**: Setup a local hosted CORS proxy (see (#virtuoso-preflight-authentication-issues)) or a remote one (google it)
3. **Use Desktop/Server Version**: Run Matgui locally or server-side where CORS doesn't apply
4. **Server-Side Proxy**: Query through a backend service
5. **Virtuoso-Specific Issues**: If using Virtuoso 07.20.3242 or earlier with authentication, see [Virtuoso Preflight Authentication Issues](#virtuoso-preflight-authentication-issues)

#### Local Endpoint Issues

**Symptoms:**

- Cannot connect to localhost or 127.0.0.1 endpoints
- "Mixed content blocked" or similar errors
- Permission denied when querying local server

**Explanation:**
Browsers block HTTP requests to local endpoints from HTTPS pages (mixed content policy). This is a security feature to prevent malicious websites from accessing your local services.

**Solutions:**

1. **Run Matgui Locally with Docker** (Recommended):

   ```bash
   docker run -p 8080:8080 mathiasvda/matgui
   ```

   - Eliminates all permission issues
   - Both Matgui and local endpoint use HTTP
   - See [Running Matgui with Docker](#running-matgui-with-docker) for details

2. **Grant Browser Permission**:
   - Click "Allow" when the browser prompts for permission
   - See [Querying Local Endpoints](#querying-local-endpoints) for detailed instructions with screenshots
3. **Check Permission Settings**:
   - Click the lock/info icon in the address bar
   - Find "Insecure content" or "Mixed content" setting
   - Change to "Allow" and reload
4. **Verify Local Server is Running**:
   - Open `http://localhost:PORT/` in a new tab
   - Ensure you see your SPARQL endpoint's interface
5. **Check Port Number**: Common SPARQL ports are 3030 (Fuseki), 7200 (GraphDB), 3333 (Blazegraph)
6. **Try 127.0.0.1**: If `localhost` doesn't work, try `http://127.0.0.1:PORT/`
7. **Enable CORS on Local Server**: Configure your SPARQL server to allow CORS requests
8. **Use HTTPS for Local Endpoint**: Set up SSL/TLS on your local server (advanced)
9. **Virtuoso with Authentication**: If using Virtuoso 07.20.3242 or earlier with Basic Authentication, see [Virtuoso Preflight Authentication Issues](#virtuoso-preflight-authentication-issues)

**Browser-Specific Notes:**

- **Edge/Chrome/Vivaldi**: Look for shield icon in address bar to manage blocked content
- **Firefox**: May need to adjust `security.mixed_content.block_active_content` in about:config
- **Safari**: Enable "Disable local file restrictions" in Develop menu

#### Virtuoso Preflight Authentication Issues

**Symptoms:**

- Using Virtuoso 07.20.3242 (and earlier?) with Basic Authentication
- SPARQL queries work from curl/Postman but fail from browser
- Browser shows 401 Unauthorized error on OPTIONS request
- Error occurs before the actual query is sent

**Explanation:**
When querying a SPARQL endpoint with authentication from a web browser, the browser sends a preflight OPTIONS request first (before the actual GET/POST request). This is standard CORS behavior. However, **Virtuoso versions 07.20.3242 and earlier have a bug** where they require authentication for the OPTIONS request, which violates the CORS specification. The browser never sends credentials with OPTIONS requests, so Virtuoso returns a 401 error and blocks the query.

This issue was supposed to be fixed in Virtuoso 08.03.3326 (see [release notes](https://community.openlinksw.com/t/virtuoso-08-03-3326-release-notes/3376): "Fixed OPTIONS is pre-flight; should be 200 w/ CORS headers").

**Solutions:**

**Option 1: Use a Local CORS Proxy** (Recommended for development)

Run a simple proxy server that handles CORS and authentication correctly:

1. **Quick Start with Docker:**

   ```bash
   docker run -d --name simple-cors-proxy -p 8080:8080 mathiasvda/simple-cors-proxy
   ```

2. **Or install from source:**

   ```bash
   git clone https://github.com/Matdata-eu/simple-cors-proxy.git
   cd simple-cors-proxy
   npm install
   npm start
   ```

   The proxy runs on port 8080 by default.

3. **Configure Matgui endpoint:**
   - For **local Virtuoso** (running on your machine):
     ```
     http://localhost:8080/proxy/http://host.docker.internal:8890/sparql-auth
     ```
   - For **remote Virtuoso** servers:
     ```
     http://localhost:8080/proxy/https://your-virtuoso-server.com/sparql
     ```

   The proxy URL format is: `http://localhost:8080/proxy/[TARGET_ENDPOINT_URL]`

**Option 2: Upgrade Virtuoso** (Recommended for production)

At the time of writing, the issue was present in the latest Virtuoso Opensource version 07.20.3242. This issue has been raised with OpenLink and hopefully they will patch the proble.

**Option 3: Configure Server-Side URL Rewrite**

If you control the web server in front of Virtuoso, configure it to return 200 OK for OPTIONS requests without authentication. See your web server documentation (Apache, Nginx, IIS) for URL rewrite rules.

**Why This Happens:**

When Matgui sends an authenticated request from a browser:

1. Browser detects cross-origin request with custom headers (Authorization)
2. Browser sends preflight OPTIONS request (without credentials)
3. Virtuoso incorrectly requires authentication for OPTIONS
4. OPTIONS returns 401, blocking the actual query
5. Your SPARQL query never executes

The proxy solves this by:

- Accepting the OPTIONS request and returning proper CORS headers
- Forwarding only the actual GET/POST requests to Virtuoso with credentials
- Translating between browser CORS requirements and Virtuoso's behavior

**Additional Notes:**

- This issue only affects browser-based queries with authentication
- Command-line tools (curl, Postman) work fine because they don't send OPTIONS
- The issue affects other triple stores with similar CORS/authentication bugs
- The proxy is safe for local development but shouldn't be exposed publicly

#### Slow Queries

**Symptoms:**

- Query takes very long to execute
- Browser becomes unresponsive

**Solutions:**

1. **Add LIMIT Clause**: Restrict result size:
   ```sparql
   SELECT * WHERE { ?s ?p ?o } LIMIT 100
   ```
2. **Optimize Query**: Make query more specific with filters
3. **Check Endpoint Status**: Endpoint might be under heavy load
4. **Break Into Smaller Queries**: Split complex queries into simpler parts
5. **Use Query Timeout**: Set a reasonable timeout in settings

#### Results Not Displaying Correctly

**Symptoms:**

- Results appear but look wrong
- Visualization doesn't show expected data

**Solutions:**

1. **Try Different Plugin**: Switch between Table, Response, and other plugins
2. **Check Response Plugin**: View raw response to verify data structure
3. **Check Data Format**: Ensure query returns expected format for the plugin
4. **Clear Cache**: Clear browser cache and reload MatGUI
5. **Check Browser Compatibility**: Use a modern browser (Chrome, Firefox, Safari, Edge)

#### Autocomplete Not Working

**Symptoms:**

- No suggestions appear when typing
- Ctrl+Space does nothing

**Solutions:**

1. **Check Internet Connection**: Prefix suggestions require network access
2. **Wait for Typing Pause**: Autocomplete appears after a brief delay
3. **Position Cursor Correctly**: Autocomplete context-dependent (prefixes, keywords, etc.)
4. **Manually Trigger**: Press `Ctrl+Space` to force autocomplete
5. **Classes and properties**: Suggestions come from the endpoint of the tab and from a list of the most used vocabularies in LOV that ships with MatGUI. Rarely used vocabularies are not in that list. If your ontology is not in it, the endpoint suggestions still cover the terms the endpoint uses, unless they are switched off for that endpoint in the Endpoint overview, or the background query failed (it is retried after an hour; running the Classes or Properties overview query also fills the suggestions). See [Class and Property Autocomplete](#class-and-property-autocomplete).

#### Lost Queries

**Symptoms:**

- Previous queries disappeared
- Tabs missing after reload

**Solutions:**

1. **Check Browser Storage**: Ensure browser allows local storage
2. **Avoid Private/Incognito Mode**: These modes don't persist local storage
3. **Check Storage Limits**: Browser might have cleared old data
4. **Export Important Queries**: Save critical queries externally
5. **Use Bookmarks**: Bookmark queries as URLs for safekeeping
6. **Same browser**: Use the same browser and profile to access MAtGUI

#### Theme/Layout Not Saving

**Symptoms:**

- Theme reverts to default on reload
- Layout orientation doesn't persist

**Solutions:**

1. **Enable Local Storage**: Check browser settings
2. **Check Private Mode**: Use normal browser mode
3. **Clear and Reset**: Clear browser data, reconfigure preferences
4. **Check Browser Compatibility**: Ensure modern browser with localStorage support

#### Formatting Issues

**Symptoms:**

- Format button doesn't work
- Query becomes malformed after formatting

**Solutions:**

1. **Check Query Syntax**: Formatter requires valid SPARQL
2. **Try Different Formatter**: Switch between sparql-formatter and legacy in Settings
3. **Manual Formatting**: Format query manually if auto-format fails
4. **Report Invalid Results**: If formatter produces incorrect output, it's a bug

#### AI Assistant Issues

**Symptoms:**

- The AI actions copy a prompt instead of answering
- "Could not reach …" or an error from the AI service
- Answers use classes or properties that don't exist

**Solutions:**

1. **No AI service set up**: without a service, the actions copy a prompt ([Copy for AI](#ai-assistant)). Add a service in **Settings → AI**, or pick one in the list at the top of the AI view.
2. **Key refused (401)**: check the API key in **Settings → AI**, and that it belongs to the service of the base URL.
3. **Model not found (404)**: use **Test connection** and pick a model from the list.
4. **Could not reach the service**: check the base URL (it usually ends in `/v1`). The service must allow requests from a browser (CORS); for Ollama, start it with `OLLAMA_ORIGINS` set to the MatGUI site.
5. **Invented names**: keep **check queries** switched on, open the [Endpoint Overview](#endpoint-overview) and run its Classes and Properties queries so the assistant knows more of the endpoint, or name the vocabulary in your question.

### Getting Help

If you encounter issues not covered here:

1. **Check GitHub Issues**: Visit [Matgui Issues](https://github.com/Matdata-eu/Matgui/issues)
2. **Search Existing Issues**: Your problem might already be reported
3. **Create New Issue**: Provide:
   - Matgui version
   - Browser and version
   - Steps to reproduce
   - Error messages
   - Example query (if applicable)
4. **Community Support**: Engage with the Matgui community

### Best Practices

**For Reliable Querying:**

- Always use `LIMIT` when exploring new data
- Test complex queries incrementally
- Save important queries outside the browser
- Use meaningful tab names
- Keep Matgui updated (if self-hosted)
- Monitor endpoint status pages
- Use appropriate query types (SELECT vs CONSTRUCT)

**For Better Performance:**

- Format queries for readability
- Use specific property paths instead of `?p`
- Add filters early in query patterns
- Avoid `SELECT *` on large datasets
- Close unused tabs
- Clear old results periodically

---

## Additional Resources

- **SPARQL Tutorial**: [https://kvistgaard.github.io/sparql/](https://kvistgaard.github.io/sparql/)
- **Matgui GitHub**: [https://github.com/Matdata-eu/MatGUI](https://github.com/Matdata-eu/MatGUI)
- **Developer Documentation**: See Developer Guide for API and integration details
- **RDF Primer**: [https://www.w3.org/TR/rdf11-primer/](https://www.w3.org/TR/rdf11-primer/)
- **SPARQL Specification**: [https://www.w3.org/TR/sparql11-query/](https://www.w3.org/TR/sparql11-query/)

---

_This user guide is maintained as part of the Matgui project. For technical implementation details, see the Developer Guide._
