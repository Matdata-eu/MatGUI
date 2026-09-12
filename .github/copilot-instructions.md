# Matgui Copilot Instructions

## Repository Overview

**Matgui (Yet Another SPARQL GUI)** is a web-based SPARQL IDE for querying RDF data. It's a TypeScript/JavaScript monorepo containing four packages that work together to provide a complete SPARQL development environment:

- **@matdata/yasgui** - Main integration package with tab management and UI (entry point)
- **@matdata/yasqe** - SPARQL query editor built on CodeMirror
- **@matdata/yasr** - Results viewer with plugin system for visualizations
- **@matdata/yasgui-utils** - Shared utilities

**Tech Stack:** TypeScript, Node.js (v20 LTS), esbuild, Vite, Sass, CodeMirror
**Size:** ~600 npm packages, 4 main packages, monorepo with npm workspaces
**Build Time:** ~5 seconds for full production build

## Critical Build & Environment Setup

### Installation

**ALWAYS install dependencies with PUPPETEER_SKIP_DOWNLOAD** to avoid network errors:

```bash
PUPPETEER_SKIP_DOWNLOAD=1 npm ci
```

Regular `npm ci` will fail due to puppeteer trying to download Chrome. The CI environment uses AppArmor disabling to allow puppeteer to use system Chrome.

### Build Process

**ALWAYS run build before tests** - tests require compiled output:

```bash
npm run build
```

This runs: `node esbuild.config.js && node distributeBuildFiles.js`
- Builds TypeScript declarations (`tsc -p tsconfig-build.json`)
- Bundles packages with esbuild (production minified)
- Distributes files to `packages/*/build/` directories
- Output: `build/` directory with `yasgui.min.js`, `yasqe.min.js`, `yasr.min.js`, `utils.min.js` and corresponding `.css` files

### Development

```bash
npm run dev
```

Starts Vite dev server at `http://localhost:4000` with hot reload. Dev pages are in `dev/` directory.

### Testing

Tests **require build output** to exist. The pretest script will fail if `build/` is empty.

```bash
npm test  # Runs both puppeteer and unit tests
npm run unit-test  # Unit tests only (works without Chrome)
npm run puppeteer-test  # E2E tests (requires Chrome - will fail in sandboxed environments)
```

**Testing in CI:** GitHub Actions workflow disables AppArmor before running tests:
```bash
echo 0 | sudo tee /proc/sys/kernel/apparmor_restrict_unprivileged_userns
```

For local development without Chrome, run only unit tests.

### Linting & Validation

```bash
npm run util:lint  # ESLint with TypeScript (strict mode if ESLINT_STRICT=true)
npm run util:validateTs  # TypeScript type checking without build
npm run util:prettify  # Format TypeScript and CSS with Prettier
```

**Pre-commit Hook:** Husky runs `lint-staged` which auto-formats and lints changed files.

## Project Structure

### Root Directory

```
.
├── packages/           # Monorepo packages (source code)
│   ├── yasgui/        # Main package - integrates yasqe + yasr
│   ├── yasqe/         # Query editor (CodeMirror-based)
│   ├── yasr/          # Results viewer with plugins
│   └── utils/         # Shared utilities
├── build/             # Build output (gitignored, created by npm run build)
├── dev/               # Development HTML pages for testing
├── test/              # End-to-end tests (run.ts, utils.ts)
├── docs/              # Markdown documentation
├── website/           # Docusaurus documentation site
├── docker/            # Docker setup files
├── build-templates/   # HTML templates copied to build/
├── .github/           # GitHub workflows and config
│   └── workflows/     # CI/CD pipelines
├── esbuild.config.js  # Production build configuration
├── vite.config.ts     # Dev server configuration
├── tsconfig*.json     # TypeScript configurations (4 files)
├── .eslintrc.cjs      # ESLint configuration
└── package.json       # Root package with workspaces
```

### Key Configuration Files

- **tsconfig.json** - Base TypeScript config with path aliases
- **tsconfig-build.json** - For declaration builds
- **tsconfig-test.json** - For test compilation
- **tsconfig-validate.json** - For type checking only
- **esbuild.config.js** - Production build (bundles to IIFE format, minifies)
- **vite.config.ts** - Dev server (port 4000, aliases to source files)
- **distributeBuildFiles.js** - Copies build artifacts to package directories
- **.eslintrc.cjs** - Strict mode when ESLINT_STRICT=true or CI_PIPELINE_ID is set

### Package Structure

Each package in `packages/*/`:
```
packages/yasgui/
├── src/               # TypeScript source
├── build/             # Build output (created by distributeBuildFiles.js)
│   ├── yasgui.min.js
│   ├── yasgui.min.css
│   └── ts/            # TypeScript declarations
└── package.json
```

## CI/CD Workflows

### build.yml & test.yaml (Pull Requests & Main Branch)

**Critical Steps:**
1. Install Node.js LTS
2. **Disable AppArmor** (required for puppeteer)
3. Run `npm ci` (not `npm install`)
4. Run `npm run build`
5. Run `npm test`

### publish.yml (Releases)

Triggered on GitHub releases. Uses Changesets for versioning.

## Common Issues & Workarounds

### Issue: `npm ci` fails with puppeteer Chrome download error

**Solution:** Use `PUPPETEER_SKIP_DOWNLOAD=1 npm ci` or set in CI environment

### Issue: Tests fail with "Run npm run build before running a test"

**Solution:** Always run `npm run build` before `npm test`. The pretest script checks for build output.

### Issue: Puppeteer tests fail with Chrome not found

**Solution:** Install Chrome manually or run only `npm run unit-test` to skip E2E tests.

### Issue: ESLint shows "No files matching the pattern 'packages/*/test/**/*.{ts,tsx}' were found"

**Expected Behavior:** This is not an error - it's an informational message. The packages don't have test subdirectories; tests are in the root `test/` directory instead. The linter still successfully checks source files.

### Issue: AppArmor restrictions prevent Chrome from starting

**Solution:** Disable AppArmor (as done in CI):
```bash
echo 0 | sudo tee /proc/sys/kernel/apparmor_restrict_unprivileged_userns
```

## Architecture Notes

### Monorepo Dependencies

Packages depend on each other:
- yasgui → yasqe, yasr, utils
- yasqe → utils
- yasr → utils

Path aliases in tsconfig.json map `@matdata/package-name` to source directories for development.

### Build Output

- **Development:** Vite serves source files directly with aliases
- **Production:** esbuild bundles to single IIFE files with global variables (Yasgui, Yasqe, Yasr, Utils)
- **Distribution:** `distributeBuildFiles.js` copies files to each package's build directory for npm publishing

### Theme System

Uses CSS custom properties for theming. Data attribute `data-theme="light|dark"` on `<html>` element.

## Validation Checklist

Before submitting changes:

1. **Build:** `npm run build` (must complete in ~5-10 seconds)
2. **Lint:** `npm run util:lint` (will show "No files matching packages/*/test/**/*.{ts,tsx}" - this is expected as tests are in root test/ directory, not per-package)
3. **Type Check:** `npm run util:validateTs` (existing TypeScript errors in dependencies are expected)
4. **Tests:** `npm test` (or `npm run unit-test` if Chrome unavailable)
5. **Format:** `npm run util:prettify` (or let pre-commit hook handle it)

## Important Notes

- **Trust these instructions** - only search if information is incomplete or incorrect
- **Build is fast** (~5s) - don't hesitate to rebuild often
- **Puppeteer is optional** - unit tests work without it
- **Use path aliases** - `@matdata/yasgui` etc. resolve to source in dev, packages in production
- **Check CI workflows** - they show the exact sequence that must pass
- **Monorepo coordination** - changes in utils affect all packages
- **Documentation is versioned** - website/ contains Docusaurus docs that build separately

## Development Tips

- Changes to source files hot-reload in dev server (port 4000)
- Build artifacts are gitignored - never commit `build/` directory
- Pre-commit hooks auto-format staged files
- Use `dev/*.html` files to test changes interactively
- The `build-templates/` directory contains HTML files copied to build output for testing built packages

## Commit messages

- Use conventional commits (feat:, fix:, docs:, style:, refactor:, test:, chore:)

## Documentation

- Update docs in `docs/` as needed

## Screenshots

- Include screenshots in pull request communication when UI changes are made

## Run tests

- Ensure tests pass locally before pushing changes