<!--
SYNC IMPACT REPORT

Version change: (template placeholder) → 1.0.0

Modified principles:
- Replaced placeholder principles with YASGUI-specific governance (new set of principles)

Added sections:
- Standards & Constraints
- Workflow & Quality Gates

Removed sections:
- Placeholder-only principle and section tokens

Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ .specify/templates/checklist-template.md
- ✅ .specify/templates/spec-template.md (no changes required)
- ⚠️ .specify/templates/commands/*.md (directory not present in this repo)
-->

# Matgui Constitution

This constitution defines non-negotiable standards for Matgui (Yet Another SPARQL GUI): a TypeScript
monorepo SPARQL IDE composed of `@matdata/yasgui`, `@matdata/yasqe`, `@matdata/yasr`, and
`@matdata/yasgui-utils`.

## Core Principles

### 1. Build Before Test (CRITICAL)
All test runs MUST be preceded by a successful build.

- `npm run build` MUST run before `npm test`, `npm run unit-test`, or `npm run puppeteer-test`.
- Tests MUST fail fast if build output is missing from `build/`.
- Build duration baseline: target ~5s, MUST remain under 10s on typical CI hardware.
- Build pipeline is authoritative: TypeScript declarations → esbuild bundles → distribute artifacts.

Rationale: tests rely on built artifacts and type declarations; enforcing build-first prevents
misleading failures and keeps CI deterministic.

### 2. Reproducible Installs (CRITICAL)
Dependency installation MUST be deterministic and CI-friendly.

- Use `npm ci`, not `npm install`, for CI and reproducible local setups.
- `PUPPETEER_SKIP_DOWNLOAD=1` MUST be set for installs to avoid Chrome download failures.
- Lockfile changes MUST be intentional and reviewed.

Rationale: puppeteer downloads and non-deterministic installs are a frequent source of CI breakage.

### 3. Never Commit Build Output (CRITICAL)
Generated artifacts MUST NOT be committed.

- The repository-level `build/` directory is build output and MUST remain gitignored.
- Package build outputs in `packages/*/build/` are also generated and MUST remain uncommitted.
- Only source-of-truth code lives in `packages/*/src/`, `test/`, and config files.

Rationale: committed build artifacts drift, cause merge conflicts, and mask real build problems.

### 4. Monorepo Dependency Integrity (HIGH)
The workspace dependency graph MUST stay acyclic and consistent:

- `yasgui → yasqe, yasr, utils`
- `yasqe → utils`
- `yasr → utils`
- `utils → (no dependencies)`
- Circular dependencies are forbidden.
- Changes to `packages/utils` MUST be treated as cross-cutting and validated across all packages.

Rationale: the repo’s design relies on a strict layering that keeps packages reusable and stable.

### 5. TypeScript Configuration Discipline (HIGH)
The monorepo uses multiple TypeScript configurations with distinct responsibilities.

- `tsconfig.json`: base configuration + path aliases for development.
- `tsconfig-build.json`: declaration build configuration.
- `tsconfig-test.json`: test compilation configuration.
- `tsconfig-validate.json`: type checking (no build output).
- Path aliases use the `@matdata/*` namespace and MUST resolve to source in dev and builds in prod.

Rationale: build speed and developer ergonomics depend on stable, purpose-specific tsconfigs.

### 6. Production Build Artifacts Are Contract (HIGH)
Production bundling and distributed outputs are part of the public interface.

- Output format is IIFE bundles exposing globals (Yasgui, Yasqe, Yasr, Utils).
- Each package produces `*.min.js` and `*.min.css` files.
- `distributeBuildFiles.js` MUST copy artifacts into `packages/*/build/`.

Rationale: consumers rely on these outputs (npm package + CDN use cases).

### 7. Testing Strategy: Always-Runnable Unit Tests, Optional E2E (HIGH)
Testing MUST be reliable across environments.

- Unit tests MUST run without Chrome and MUST be runnable in constrained environments.
- Puppeteer E2E tests require Chrome; they are allowed to be skipped locally when unavailable.
- CI pipelines that run puppeteer MUST disable AppArmor restrictions for unprivileged user namespaces.
- Pretest MUST verify build output exists.

Rationale: developer productivity depends on always-available unit tests; E2E adds coverage where
available and is enforced in CI.

### 8. Code Quality Gates (HIGH)
Quality checks MUST remain predictable; known informational output must not be treated as failure.

- Lint: `npm run util:lint` (strict mode when `ESLINT_STRICT=true` or `CI_PIPELINE_ID` is set).
- The ESLint message "No files matching the pattern 'packages/*/test/**/*.{ts,tsx}' were found" is

  INFORMATIONAL (tests live in `test/`), not an error.
- Type check: `npm run util:validateTs` is required even if some dependency type errors exist and are

  known/expected; new errors caused by the change are not acceptable.
- Formatting: Prettier is required (TypeScript + CSS) and pre-commit hooks enforce formatting.

Rationale: consistent gates prevent accidental regressions and reduce review churn.

### 9. Development Workflow Contract (MEDIUM)
Local development MUST follow the monorepo’s expected dev setup.

- Dev server uses Vite on port 4000 with hot reload.
- Development pages live in `dev/`.
- Aliases map `@matdata/package-name` to the source directories during dev.

Rationale: the repo is optimized for fast iteration; deviating breaks shared workflows.

### 10. Accessibility (WCAG 2.1 AA) Is Non-Negotiable (CRITICAL)
UI changes MUST uphold accessibility standards.

- Meet WCAG 2.1 Level AA.
- All interactive elements MUST be keyboard accessible.
- Focus indicators MUST be visible and meaningful.
- Provide ARIA labels where semantics are not obvious.
- Contrast MUST meet AA thresholds (4.5:1 normal text, 3:1 large text).

Rationale: accessibility is a user requirement and a quality bar; regressions are unacceptable.

### 11. UX Consistency & Performance Budgets (HIGH)
User experience MUST remain consistent across packages and interactions.

- Interaction feedback target: < 100ms for instant UI responses (e.g., tab switching).
- Debounce user-input where appropriate (300–500ms for search/filter type interactions).
- Use virtualization/progressive rendering for large result sets (> 1000 rows).
- Error messages MUST be clear and actionable; avoid internal jargon where possible.

Rationale: Matgui is an IDE-like UI; perceived performance and consistency drive usability.

### 12. Theme System Consistency (MEDIUM)
Themes are implemented via CSS custom properties.

- Theme selection uses `data-theme="light|dark"` on the `<html>` element.
- Components MUST not hardcode theme-specific colors; use theme variables.
- Theme changes MUST work for both light and dark.

Rationale: the theme system is a cross-cutting design constraint.

### 13. Documentation & Release Hygiene (MEDIUM)
Documentation and releases MUST remain coherent.

- User and developer docs live in `docs/`; update when behavior or APIs change.
- Website docs live in `website/` (Docusaurus); update when relevant.
- UI changes SHOULD include screenshots in PR descriptions.
- Version coordination uses Changesets; packages are versioned together.

Rationale: Matgui is consumed by developers and end users; docs are part of the product.

### 14. Commit Conventions (HIGH)
Commits MUST follow conventional commits.

- Allowed prefixes include: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`

Rationale: changelog generation and release automation rely on consistent commit metadata.

## Standards & Constraints

### Build & Test Commands (Authoritative)

- Install: `PUPPETEER_SKIP_DOWNLOAD=1 npm ci`
- Build: `npm run build`
- Full test: `npm test`
- Unit only (safe anywhere): `npm run unit-test`
- E2E (requires Chrome + CI AppArmor setup): `npm run puppeteer-test`

### CI/CD Workflow Requirements
Pull requests and main-branch checks MUST follow this ordering:

1. Install Node.js v20 LTS
2. Disable AppArmor restriction for puppeteer environments:
   `echo 0 | sudo tee /proc/sys/kernel/apparmor_restrict_unprivileged_userns`
3. Install with `PUPPETEER_SKIP_DOWNLOAD=1` and `npm ci`
4. Run `npm run build`
5. Run `npm test`

Releases are triggered on GitHub releases and use Changesets.

### File Structure Rules

- Root source: `packages/*/src/`
- Tests: `test/` (not per package)
- Dev pages: `dev/`
- Build templates: `build-templates/`
- Repo build output: `build/` (gitignored; never commit)

## Workflow & Quality Gates

### PR Validation Checklist (Must Pass)

1. `npm run build` completes in ~5–10s.
2. `npm run util:lint` passes (ignore informational "No files matching..." message).
3. `npm run util:validateTs` passes within project expectations (no new TS errors introduced).
4. `npm test` OR `npm run unit-test` if Chrome is unavailable.
5. `npm run util:prettify` (or rely on Husky + lint-staged).
6. Accessibility: keyboard navigation verified for UI changes.
7. UX: visual consistency checked (spacing, typography, colors).
8. Performance: user interactions feel responsive (< 100ms feedback for instant interactions).
9. Themes: verify both light and dark.
10. Cross-browser support verified for affected areas (Chrome/Edge/Firefox/Safari: last 2 versions).

### Common Pitfalls to Prevent

- Running `npm ci` without `PUPPETEER_SKIP_DOWNLOAD=1`.
- Running tests before build.
- Treating ESLint "No files matching..." as an error.
- Committing generated `build/` artifacts.
- Creating circular dependencies between packages.

## Governance

### Authority
This constitution supersedes local conventions and feature-specific preferences. Where a feature spec
conflicts with this constitution, the constitution wins unless explicitly amended.

### Amendment Process

- Amendments MUST be made via PR with a clear rationale.
- The PR MUST state whether the change is a semver MAJOR/MINOR/PATCH governance change.
- If the change affects developer workflow, update the relevant templates under `.specify/templates/`.
- If the change affects end users, update docs in `docs/` and/or `website/`.

### Versioning Policy

- MAJOR: backward-incompatible governance changes (e.g., removing a critical gate or redefining a

  non-negotiable principle).
- MINOR: adding a new principle/section or materially expanding requirements.
- PATCH: clarifications and wording that do not change enforcement expectations.

### Compliance Review Expectations

- Reviews MUST include a constitution check when the change touches build, test, packaging, UI/UX,

  accessibility, or cross-package boundaries.
- For UI changes, reviewers MUST verify keyboard navigation and theme correctness.

**Version**: 1.0.0 | **Ratified**: 2025-12-26 | **Last Amended**: 2025-12-26
