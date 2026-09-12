# MatGUI

### A modern knowledge graph and SPARQL workbench

> **More than just Another SPARQL GUI.**

**MatGUI** is a powerful, user-friendly web-based workbench for querying, exploring and visualising knowledge graphs and RDF data with SPARQL. It combines a feature-rich query editor with a versatile results viewer to provide a complete SPARQL IDE.

> **Formerly Yasgui.** MatGUI began as a fork of the Yasgui ecosystem and has since evolved well beyond it. The npm packages (`@matdata/yasgui`, `@matdata/yasqe`, `@matdata/yasr`) keep their names for backwards compatibility — **only the project branding has changed.** See the [Rebranding & migration Guide](./docs/rebranding-to-matgui.md).

🌐 **Try it now**: [https://matgui.matdata.eu/](https://matgui.matdata.eu/)

[![npm version](https://img.shields.io/npm/v/@matdata/yasgui)](https://www.npmjs.com/package/@matdata/yasgui)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Quick Links

- 📖 **[User Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md)** - Complete guide for end users
- 🛠️ **[Developer Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md)** - API reference and integration guide
- 🚀 **[Production Environment](https://matgui.matdata.eu/)** - Live instance
- 📦 **[npm Package](https://www.npmjs.com/package/@matdata/yasgui)**
- 🐳 **[Docker Hub](https://hub.docker.com/r/mathiasvda/yasgui)**
- 📝 **[Releases & Changelog](https://github.com/Matdata-eu/Matgui/releases)**
- 💻 **[GitHub Repository](https://github.com/Matdata-eu/Matgui)**

---

## Documentation

The **documentation for Matgui is hosted on GitHub Pages**:

- **📚 Documentation Website**: [https://matgui-doc.matdata.eu/](https://matdata-eu.github.io/Yasgui/)
  - User Guide, Developer Guide, API Reference
  - Built with Docusaurus
  - Version-tagged with the repository

- **🚀 Development Build**: [https://matgui-doc.matdata.eu/dev/main/](https://matdata-eu.github.io/Yasgui/dev/main/)
  - Live build from the main branch
  - Updated automatically with every commit
  - Test latest features before release

The documentation is version-tagged with the repository, ensuring consistency between code and documentation across releases.

## Features

Matgui provides a complete SPARQL development environment with powerful features:

### ✏️ Advanced Query Editor
- **[SPARQL Syntax Highlighting](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#yasqe-query-editor)** - Color-coded SPARQL with error detection
- **[Smart Autocomplete](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#prefix-management)** - Context-aware suggestions for keywords, prefixes, and URIs
- **[Query Formatting](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#query-formatting)** - One-click query beautification with configurable formatters
- **[Prefix Management](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#prefix-management)** - Auto-capture and reuse PREFIX declarations
- **[URI Explorer](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#uri-explorer)** - Ctrl+Click URIs to explore connections
- **[Keyboard Shortcuts](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#keyboard-shortcuts)** - Efficient query development workflow

### 📊 Powerful Visualizations
- **[Table Plugin](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#table-plugin)** - Sortable, filterable, paginated result tables
- **[Graph Plugin](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#graph-plugin)** - Interactive RDF graph visualization
- **[Geo Plugin](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#geo-plugin)** - Geographic data on interactive maps
- **[Response Plugin](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#response-plugin)** - Raw response viewer with syntax highlighting
- **[Boolean Plugin](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#boolean-plugin)** - Visual true/false indicators for ASK queries
- **[Error Plugin](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#error-plugin)** - Detailed error diagnostics

### 🎨 Themes & Layouts
- **[Light & Dark Themes](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#themes)** - Seamless theme switching with persistent preferences
- **[Flexible Layouts](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#layout-orientation)** - Vertical or horizontal editor/results arrangement

### 🔧 Expert Features
- **[Multiple Tabs](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#query-tabs)** - Work on multiple queries simultaneously
- **[Endpoint Management](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#endpoint-quick-switch)** - Quick-switch between SPARQL endpoints
- **[Authentication Support](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md#authentication)** - Basic Auth, Bearer Token, API Key, OAuth2
- **[Persistent Storage](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#query-history-and-persistence)** - Auto-save queries and preferences
- **[URL Sharing](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#share-queries)** - Share queries via URL parameters
- **[Fullscreen Mode](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#fullscreen-mode)** - Maximize editor or results viewer
- **[Export Results](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md#yasr-class)** - Download results in various formats
- **[Configuration Import/Export](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#configuration-importexport)** - Backup and restore settings

For detailed feature documentation, see the **[User Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md)**.

---

## Browser Support

Matgui works on all modern browsers:

- ✅ Chrome / Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Opera (latest)

**Requirements:**
- JavaScript enabled
- Cookies/LocalStorage enabled (for query persistence)
- Modern ES6+ support

---

## Installation

### npm

```bash
npm install @matdata/yasgui
```

### Yarn

```bash
yarn add @matdata/yasgui
```

### CDN

```html
<link rel="stylesheet" href="https://unpkg.com/@matdata/yasgui/build/yasgui.min.css" />
<script src="https://unpkg.com/@matdata/yasgui/build/yasgui.min.js"></script>
```

### Docker

**Run with default endpoint:**
```bash
docker pull mathiasvda/yasgui:latest
docker run -p 8080:8080 mathiasvda/yasgui:latest
```

Access at: `http://localhost:8080`

**Custom endpoint:**
```bash
docker run -p 8080:8080 \
  -e MATGUI_DEFAULT_ENDPOINT=https://your-endpoint.com/sparql \
  mathiasvda/yasgui:latest
```

For detailed installation instructions and usage examples, see the **[Developer Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md#installation)** and **[User Guide - Docker](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#running-yasgui-with-docker)**.

## Quick Start

### Basic HTML Usage

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

### ES Modules / React / Vue / Angular

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

### Authentication

Matgui supports multiple authentication methods for secure SPARQL endpoints:

**Basic Authentication:**
```javascript
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  requestConfig: {
    endpoint: 'https://secure-endpoint.com/sparql',
    basicAuth: {
      username: 'myuser',
      password: 'mypassword'
    }
  }
});
```

**Bearer Token (OAuth2/JWT):**
```javascript
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  requestConfig: {
    endpoint: 'https://api.example.com/sparql',
    bearerAuth: {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
    }
  }
});
```

**API Key (Custom Headers):**
```javascript
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  requestConfig: {
    endpoint: 'https://api.example.com/sparql',
    apiKeyAuth: {
      headerName: 'X-API-Key',
      apiKey: 'your-api-key-here'
    }
  }
});
```

Authentication can also be configured through the UI via the Settings modal (gear icon). For detailed authentication documentation including dynamic auth and OAuth2, see the **[Developer Guide - Authentication](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md#authentication)**.

For framework-specific examples and advanced usage, see the **[Developer Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md#usage-examples)**.

---

## Configuration Options

Matgui is highly configurable. Here are some common configuration options:

```javascript
const yasgui = new Yasgui(document.getElementById('yasgui'), {
  // Request configuration
  requestConfig: {
    endpoint: 'https://dbpedia.org/sparql',
    method: 'POST',                        // GET or POST
    headers: { 'Custom-Header': 'value' }, // Custom HTTP headers
    args: [{ name: 'param', value: 'val' }] // URL parameters
  },
  
  // UI configuration
  theme: 'dark',                           // 'light' or 'dark'
  orientation: 'horizontal',               // 'horizontal' or 'vertical'
  showSnippetsBar: true,                   // Show code snippets
  
  // Persistence
  persistenceId: 'my-yasgui-instance',     // Custom storage ID
  persistencyExpire: 7 * 24 * 60 * 60,     // Storage expiration (7 days)
  
  // Default query
  yasqe: {
    value: 'SELECT * WHERE { ?s ?p ?o } LIMIT 10'
  }
});
```

For complete configuration options, see the **[Developer Guide - Configuration](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md#configuration)**.

---

## Troubleshooting

### CORS Issues

If you encounter CORS errors when querying remote endpoints:

1. **Use a CORS proxy** - Set up a proxy server that adds CORS headers
2. **Configure the endpoint** - Some endpoints support CORS with proper configuration
3. **Server-side queries** - Execute queries server-side and display results client-side

See the **[User Guide - CORS Errors](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#cors-errors)** for detailed solutions.

### Local Endpoint Access

To query local SPARQL endpoints from YASGUI:

```bash
# Example: Running a local endpoint accessible to YASGUI
docker run -p 3030:3030 stain/jena-fuseki
```

Access at: `http://localhost:3030/dataset/sparql`

For more details, see **[User Guide - Querying Local Endpoints](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md#querying-local-endpoints)**.

---

## Contributing

We welcome contributions! To get started:

1. Fork the repository
2. Clone and install: `PUPPETEER_SKIP_DOWNLOAD=1 npm ci`
3. Run dev server: `npm run dev`
4. Make your changes
5. Run tests: `npm test`
6. Submit a pull request

**📋 For detailed contribution guidelines, including our plugin development policy, see [CONTRIBUTING.md](./CONTRIBUTING.md).**

Additional resources:
- **[Developer Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md)** - API reference and integration guide
- **[Plugin Development](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md#plugin-development)** - How to create plugins

---

## Support & Community

### Getting Help

- 📖 **[User Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/user-guide.md)** - Comprehensive usage documentation
- 🛠️ **[Developer Guide](https://github.com/Matdata-eu/Matgui/blob/main/docs/developer-guide.md)** - API reference and integration
- 🐛 **[Issue Tracker](https://github.com/Matdata-eu/Matgui/issues)** - Report bugs or request features
- 💬 **[Discussions](https://github.com/Matdata-eu/Matgui/discussions)** - Ask questions and share ideas

### Reporting Issues

When reporting issues, please include:
- Browser version and operating system
- Steps to reproduce the problem
- Expected vs. actual behavior
- Console errors (if any)
- Minimal example query demonstrating the issue

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

### Attribution & Acknowledgements

MatGUI stands on the shoulders of the **Yasgui** project and gratefully acknowledges its origins.

- The project began as a fork of [Zazuko/Yasgui](https://github.com/zazuko/Yasgui), which was itself forked from the original [Triply/Yasgui](https://github.com/TriplyDB/Yasgui) created by **Laurens Rietveld** and the Triply team.
- The name “Yasgui” (Yet Another SPARQL GUI) and the original YASQE/YASR components were created and maintained by those teams and their contributors. We thank every original author and contributor for their foundational work on SPARQL tooling for the web.
- MatGUI has since evolved substantially — with new features, a modernised codebase, and an expanded scope — and is developed and maintained independently by [Matdata](https://matdata.eu).

**MatGUI is not affiliated with, endorsed by, or an official continuation of the rdfjs-, Zazuko-, or Triply-maintained Yasgui projects.** It is an independent project that honours its heritage while charting its own direction. For details on how the projects relate, see the [Rebranding & migration Guide](./docs/rebranding-to-matgui.md).

**Maintained by:** [Matdata](https://matdata.eu)

---

## Release Notes & Changelog

Release notes and changelog are available in the [Releases](https://github.com/Matdata-eu/Matgui/releases) section.

For instructions on writing release notes, see [release-note-instructions.md](./docs/release-note-instructions.md).
