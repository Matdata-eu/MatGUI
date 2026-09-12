# Development Environment

This folder contains the development setup for Matgui using Vite.

## Quick Start

```bash
npm run dev
```

This will start the Vite dev server on http://localhost:4000

You can open a debug page in your IDE or in your browser.

## What Changed

### From Webpack to Vite + esbuild

- **Dev Server**: Webpack Dev Server → Vite (with esbuild)
- **Production Build**: Webpack → esbuild
- **Speed**: 
  - Dev: Instant HMR and sub-second startup
  - Build: 10-100x faster than Webpack
- **Output**: Same bundle structure with improved performance

### Dev Pages

- `index.html` - Landing page with links to all components
- `yasgui.html` - Full Matgui SPARQL IDE
- `yasqe.html` - SPARQL Query Editor only
- `yasr.html` - SPARQL Results Viewer with query editor

## Configuration

### Development (Vite)
Configuration: `vite.config.ts`

Key features:
- Module path aliases for `@matdata/*` packages
- esbuild for fast TypeScript transpilation
- SASS/SCSS support with PostCSS autoprefixer
- Optimized dependency pre-bundling

### Production (esbuild)
Configuration: `esbuild.config.js`

Features:
- IIFE format with global exports (Yasgui, Yasqe, Yasr, Utils)
- Minification and sourcemaps
- Separate CSS extraction
- TypeScript declaration generation
- ES2020 target

## Build Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Validate TypeScript
npm run util:validateTs

# Lint code
npm run util:lint
```
