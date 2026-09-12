# Skill: Create MatGUI/YasGUI External Plugin

## Description
Scaffolds a new external YASR plugin repository with all required boilerplate, following MatGUI's strict plugin policy and interface requirements. Any plugin developed for YasGUI should also work within MatGUI.

## When to Use
- User wants to create a new MatGUI/YASR visualization plugin
- User asks about adding plugin functionality to MatGUI/YASGUI
- User mentions creating a custom result renderer
- User references plugin examples like table-plugin or graph-plugin

## Problem Statement
MatGUI has a **strict policy**: New plugins MUST NOT be added to the core repository. Instead, plugins must be:
- Created in separate repositories
- Published to npm independently
- Implement required interface methods
- Support responsive design and theming

From CONTRIBUTING.md:
> "🚫 Do NOT Add New Plugins to This Repository. New plugins should be created in their own separate repositories."

## Required Inputs
- **Plugin name** (e.g., "timeline", "map", "chart")
- **Plugin description** (purpose and visualization type)
- **Output format** (What the plugin downloads/exports)
- **Package scope** (npm organization, e.g., "@myorg" or none)

## Instructions

### Step 1: Gather Plugin Requirements

Ask the user:
1. **Plugin name:** What should the plugin be called? (e.g., "Timeline Visualizer")
2. **Npm package name:** How should it be published? (e.g., "@myorg/yasgui-timeline-plugin")
3. **Description:** What data does it visualize and how?
4. **Export format:** What file format for downloads? (JSON, CSV, PNG, etc.)
5. **Dependencies:** Any specific libraries needed? (D3.js, Leaflet, etc.)

### Step 2: Create Repository Structure

Generate the following directory structure:

```
yasgui-[name]-plugin/
├── src/
│   ├── index.ts           # Main plugin class
│   ├── plugin.scss        # Plugin styles
│   └── types.ts           # TypeScript types
├── examples/
│   └── demo.html          # Demo page
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

### Step 3: Implement Plugin Interface

Create `src/index.ts` with the following template:

```typescript
import { Plugin, DownloadInfo } from "@matdata/yasr";
import "./plugin.scss";

export interface PluginConfig {
  // Plugin-specific configuration options
}

export default class [PluginName]Plugin extends Plugin {
  // REQUIRED: Help documentation URL
  helpReference = "https://github.com/[username]/yasgui-[name]-plugin#readme";
  
  // Plugin label shown in UI
  label = "[Plugin Display Name]";
  
  // Priority for plugin selection (higher = preferred)
  priority = 10;

  constructor(yasr: any) {
    super(yasr);
  }

  // REQUIRED: Check if this plugin can handle the response
  canHandleResults(): boolean {
    // Check if response is compatible with this plugin
    const response = this.yasr.results;
    
    if (!response) return false;
    
    // Example: Check for specific result type
    // return response.getVariables?.()?.length > 0;
    
    return true;
  }

  // REQUIRED: Render the visualization
  draw(persistentConfig?: any): void {
    const container = this.yasr.resultsEl;
    
    // Clear previous content
    container.innerHTML = "";
    
    // Create your visualization
    const visualizationEl = document.createElement("div");
    visualizationEl.className = "yasgui-[name]-plugin";
    
    // TODO: Implement visualization logic here
    visualizationEl.textContent = "Plugin visualization goes here";
    
    container.appendChild(visualizationEl);
    
    // Handle resize events
    this.handleResize();
  }

  // REQUIRED: Download functionality
  download(filename?: string): DownloadInfo {
    const data = this.prepareDownloadData();
    
    return {
      getData: () => data,
      filename: filename || `yasgui-[name]-${Date.now()}.[ext]`,
      contentType: "text/[format]", // e.g., "text/csv", "application/json"
      buttonTitle: "Download as [FORMAT]",
    };
  }

  // Helper: Prepare data for download
  private prepareDownloadData(): string {
    const results = this.yasr.results;
    
    // TODO: Format results for download
    return JSON.stringify(results, null, 2);
  }

  // Helper: Handle container resize
  private handleResize(): void {
    // Observe container size changes
    const resizeObserver = new ResizeObserver(() => {
      this.redraw();
    });
    
    resizeObserver.observe(this.yasr.resultsEl);
  }

  // Helper: Redraw on resize
  private redraw(): void {
    // TODO: Implement resize logic
    // Recalculate dimensions, redraw charts, etc.
  }
  
  // Cleanup
  destroy(): void {
    // Clean up event listeners, observers, etc.
  }
}
```

### Step 4: Implement Theme Support

Create `src/plugin.scss`:

```scss
.yasgui-[name]-plugin {
  // Use 100% of available space
  width: 100%;
  height: 100%;
  min-height: 200px; // Define minimum usable size
  
  // Use YASGUI CSS custom properties for theming
  background: var(--yasgui-bg-primary);
  color: var(--yasgui-text-primary);
  border: 1px solid var(--yasgui-border-color);
  
  // Smooth theme transitions
  transition: background-color 0.3s ease, 
              color 0.3s ease, 
              border-color 0.3s ease;
  
  // Responsive padding
  padding: 1rem;
  overflow: auto;
}

// Dark theme specific adjustments
[data-theme="dark"] .yasgui-[name]-plugin {
  // Add any dark-theme specific styles
}

// Light theme specific adjustments
[data-theme="light"] .yasgui-[name]-plugin {
  // Add any light-theme specific styles
}

// Plugin content styles
.yasgui-[name]-plugin__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

// Handle small screens
@media (max-width: 768px) {
  .yasgui-[name]-plugin {
    min-height: 150px;
    padding: 0.5rem;
  }
}
```

Add theme change detection in `src/index.ts`:

```typescript
// Watch for theme changes
private watchThemeChanges(): void {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'data-theme') {
        this.handleThemeChange();
      }
    });
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
}

private handleThemeChange(): void {
  // Redraw or update colors when theme changes
  this.draw();
}
```

### Step 5: Create package.json

```json
{
  "name": "[package-name]",
  "version": "1.0.0",
  "description": "[Plugin description]",
  "main": "build/index.js",
  "types": "build/index.d.ts",
  "scripts": {
    "build": "tsc && sass src/plugin.scss build/plugin.css",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "yasgui",
    "yasr",
    "sparql",
    "plugin",
    "visualization"
  ],
  "peerDependencies": {
    "@matdata/yasr": "^4.0.0"
  },
  "devDependencies": {
    "@matdata/yasr": "^4.7.0",
    "typescript": "^5.9.0",
    "sass": "^1.93.0"
  },
  "files": [
    "build/**/*",
    "README.md",
    "LICENSE"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/[username]/yasgui-[name]-plugin"
  },
  "author": "[Your Name]",
  "license": "MIT"
}
```

### Step 6: Create TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "declaration": true,
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
```

### Step 7: Create README.md

```markdown
# YASGUI [Plugin Name] Plugin

A YASR plugin for [description of what it does].

## Installation

```bash
npm install [package-name]
```

## Usage

```javascript
import Yasgui from "@matdata/yasgui";
import [PluginName]Plugin from "[package-name]";

// Register the plugin
Yasgui.Yasr.registerPlugin("[plugin-name]", [PluginName]Plugin);

// Create YASGUI instance
const yasgui = new Yasgui(document.getElementById("yasgui"), {
  yasqe: {
    value: "SELECT * WHERE { ?s ?p ?o } LIMIT 10"
  },
  yasr: {
    pluginOrder: ["[plugin-name]", "table", "response"],
  }
});
```

## Configuration

```javascript
{
  yasr: {
    plugins: {
      "[plugin-name]": {
        // Plugin-specific options
      }
    }
  }
}
```

## Features

- ✅ Responsive design (100% width/height)
- ✅ Light and dark theme support
- ✅ Download functionality ([format])
- ✅ TypeScript support

## Demo

See `examples/demo.html` for a working example.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev
```

## License

MIT
```

### Step 8: Create Demo Page

Create `examples/demo.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Plugin Name] Demo</title>
  <link rel="stylesheet" href="https://unpkg.com/@matdata/yasgui/build/yasgui.min.css">
  <link rel="stylesheet" href="../build/plugin.css">
  <style>
    body {
      margin: 0;
      font-family: sans-serif;
    }
    #yasgui {
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="yasgui"></div>
  
  <script src="https://unpkg.com/@matdata/yasgui/build/yasgui.min.js"></script>
  <script src="../build/index.js"></script>
  <script>
    // Register plugin
    Yasgui.Yasr.registerPlugin('[plugin-name]', [PluginName]Plugin);
    
    // Initialize YASGUI
    const yasgui = new Yasgui(document.getElementById('yasgui'), {
      yasqe: {
        value: `PREFIX dbo: <http://dbpedia.org/ontology/>
SELECT * WHERE {
  ?s a dbo:Person .
  ?s dbo:birthDate ?birthDate .
} LIMIT 10`
      },
      yasr: {
        pluginOrder: ['[plugin-name]', 'table', 'response']
      }
    });
  </script>
</body>
</html>
```

### Step 9: Validation Checklist

Ensure the plugin meets all requirements:

**Required Interface Methods:**
- [ ] `helpReference` property defined
- [ ] `download()` method implemented
- [ ] `canHandleResults()` method implemented
- [ ] `draw()` method implemented

**Responsive Design:**
- [ ] Uses 100% width and height of parent
- [ ] Defines minimum usable dimensions
- [ ] Handles resize events with ResizeObserver
- [ ] Works in both horizontal and vertical layouts

**Theme Support:**
- [ ] Uses CSS custom properties (--yasgui-*)
- [ ] Implements both light and dark mode
- [ ] Uses MutationObserver to watch theme changes
- [ ] Smooth transitions between themes

**Best Practices:**
- [ ] TypeScript types defined
- [ ] README with usage examples
- [ ] Demo page included
- [ ] Proper npm package structure
- [ ] MIT or compatible license

### Step 10: Testing Before Publishing

1. **Local testing:**
   ```bash
   npm run build
   # Test with demo.html
   ```

2. **Link to YASGUI for testing:**
   ```bash
   cd yasgui-[name]-plugin
   npm link
   
   cd path/to/yasgui-project
   npm link [package-name]
   ```

3. **Publish to npm:**
   ```bash
   npm publish
   ```

## Available CSS Custom Properties

Reference these in your plugin styles:

```css
/* Background colors */
--yasgui-bg-primary
--yasgui-bg-secondary
--yasgui-bg-tertiary

/* Text colors */
--yasgui-text-primary
--yasgui-text-secondary
--yasgui-text-muted

/* Accent colors */
--yasgui-accent-color
--yasgui-accent-color-hover

/* Border colors */
--yasgui-border-color
--yasgui-border-color-light

/* Status colors */
--yasgui-error-color
--yasgui-warning-color
--yasgui-success-color
```

## Example Plugins for Reference

Point users to these existing external plugins:
- [@matdata/yasgui-table-plugin](https://www.npmjs.com/package/@matdata/yasgui-table-plugin)
- [@matdata/yasgui-graph-plugin](https://www.npmjs.com/package/@matdata/yasgui-graph-plugin)
- [@matdata/yasgui-geo-plugin](https://www.npmjs.com/package/@matdata/yasgui-geo-plugin)

## Output Format

When executing this skill:

1. **Confirm requirements:**
   ```
   Creating YASGUI plugin: [name]
   Package name: [package-name]
   Export format: [format]
   ```

2. **Generate files:**
   ```
   ✓ Created src/index.ts
   ✓ Created src/plugin.scss
   ✓ Created package.json
   ✓ Created tsconfig.json
   ✓ Created README.md
   ✓ Created examples/demo.html
   ```

3. **Next steps:**
   ```
   Next steps:
   1. cd yasgui-[name]-plugin
   2. npm install
   3. npm run build
   4. Open examples/demo.html in browser
   5. Implement visualization logic in src/index.ts
   ```

## Related Files
- `CONTRIBUTING.md` - Plugin development policy
- `docs/developer-guide.md` - Plugin interface documentation
- `packages/yasr/src/plugins/` - Core plugin examples (reference only)

## Notes
- **Never add to core repo:** External plugins ONLY
- **Follow interface:** All required methods must be implemented
- **Theme support mandatory:** Both light and dark modes required
- **Responsive required:** Must work at all viewport sizes
- **Document thoroughly:** Users need clear integration examples
