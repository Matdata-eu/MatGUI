# Contributing to MatGUI

Thank you for your interest in contributing to MatGUI! We welcome contributions from the community to make MatGUI better for everyone.

This document provides guidelines for contributing to MatGUI, including information about our development process, coding standards, and particularly important information about plugin development.

> **Note:** MatGUI was formerly branded *Yasgui*. The npm packages, source modules, class names and CSS classes keep their existing `yasgui`/`yasqe`/`yasr` names for backwards compatibility — only the user-facing project name changed. Keep this in mind when editing code versus user-facing text.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Plugin Development Policy](#plugin-development-policy)
- [Development Workflow](#development-workflow)
- [Code Guidelines](#code-guidelines)
- [Testing](#testing)
- [Pull Requests](#pull-requests)
- [Reporting Issues](#reporting-issues)
- [Community](#community)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js**: v20 LTS or higher
- **npm**: v10 or higher
- **Git**: For version control

### Setting Up Your Development Environment

1. **Fork the Repository**
   
   Click the "Fork" button on the [Matgui GitHub repository](https://github.com/Matdata-eu/MatGUI) to create your own fork.

2. **Clone Your Fork**
   
   ```bash
   git clone https://github.com/YOUR-USERNAME/Yasgui.git
   cd Yasgui
   ```

3. **Install Dependencies**
   
   ```bash
   PUPPETEER_SKIP_DOWNLOAD=1 npm ci
   ```
   
   Note: We use `PUPPETEER_SKIP_DOWNLOAD=1` to skip downloading Chromium during installation.

4. **Build the Project**
   
   ```bash
   npm run build
   ```
   
   This compiles TypeScript and bundles all packages. Build time is typically ~5 seconds.

5. **Start the Development Server**
   
   ```bash
   npm run dev
   ```
   
   Visit `http://localhost:4000` to see Matgui in action with hot module reloading.

## Plugin Development Policy

**IMPORTANT: This section describes our policy for plugin contributions.**

### Core Philosophy: Separation of Concerns

Matgui follows a **strict plugin development policy** to maintain a clean, maintainable codebase:

#### 🚫 Do NOT Add New Plugins to This Repository

**New plugins should be created in their own separate repositories.** This policy ensures:

- **Clean codebase**: The core Matgui repository stays focused on core functionality
- **Separation of concerns**: Each plugin manages its own lifecycle, tests, dependencies, and releases
- **Independent versioning**: Plugins can be versioned and released independently
- **Easier maintenance**: Plugin maintainers have full control over their code
- **Better modularity**: Users can choose which plugins to install

#### ✅ Core Plugins (Keep As-Is)

The following **core plugins** remain in the repository and should **not be modified** unless fixing bugs or making necessary improvements:

- **`packages/yasr/src/plugins/boolean/`** - ASK query results (true/false)
- **`packages/yasr/src/plugins/error/`** - Error message display
- **`packages/yasr/src/plugins/response/`** - Raw response viewer

These are essential plugins that are tightly integrated with the core YASR functionality.

#### 📦 External Plugin Examples

Our ecosystem already includes successful external plugins that serve as excellent examples:

- **[@matdata/yasgui-table-plugin](https://www.npmjs.com/package/@matdata/yasgui-table-plugin)** - Table visualization
- **[@matdata/yasgui-graph-plugin](https://www.npmjs.com/package/@matdata/yasgui-graph-plugin)** - Graph/network visualization  
- **[yasgui-geo-tg](https://www.npmjs.com/package/yasgui-geo-tg)** - Geographic data on maps

#### 🔧 Creating Your Own Plugin

If you want to create a new plugin:

1. **Create a separate repository** (e.g., `yasr-my-custom-plugin`)
2. **Follow the plugin interface** documented in our [Developer Guide - Plugin Development](./docs/developer-guide.md#plugin-development)
3. **Manage your own**:
   - Dependencies
   - Tests
   - Documentation
   - Releases
   - Issues
4. **Publish to npm** for easy installation by users
5. **Share with the community** by mentioning it in GitHub Discussions

##### Plugin Requirements

All plugins **must** implement the following requirements:

**📚 Help Reference & Download Functionality**
- **`helpReference`**: Provide a URL to documentation/help page for your plugin
- **`download()`**: Implement download functionality to allow users to export results in appropriate formats

**📐 Responsive Design**
- **Utilize 100% of available width and height** of the parent element
- **Define minimum usable dimensions** when applicable (e.g., minimum width/height for proper visualization)
- **Respond to layout changes**: Support both vertical and horizontal orientations when the layout changes
- **Handle resize events**: Redraw or adjust visualization when container size changes

**🎨 Theme Support**
- **Implement both dark and light mode** support
- **Use CSS custom properties** for colors (e.g., `--yasgui-bg-primary`, `--yasgui-text-primary`)
- **Watch for theme changes** using `MutationObserver` on `document.documentElement`
- **Smooth transitions** between themes for better user experience

For detailed plugin development instructions and code examples, see the [Developer Guide - Plugin Development](./docs/developer-guide.md#plugin-development) section.

## Development Workflow

### Creating a Feature or Bug Fix

1. **Create a feature branch** from `main`:
   
   ```bash
   git checkout -b feature/my-feature
   # or
   git checkout -b fix/my-bugfix
   ```

2. **Make your changes** following our [Code Guidelines](#code-guidelines)

3. **Test your changes**:
   
   ```bash
   # Build first (required before testing)
   npm run build
   
   # Run all tests
   npm test
   
   # Or run specific test types
   npm run unit-test      # Unit tests only (works without Chrome)
   npm run puppeteer-test # E2E tests (requires Chrome)
   ```

4. **Lint and format your code**:
   
   ```bash
   npm run util:lint      # ESLint check
   npm run util:validateTs # TypeScript type checking
   npm run util:prettify  # Auto-format with Prettier
   ```
   
   Note: Pre-commit hooks will automatically format staged files.

5. **Commit your changes** using [Conventional Commits](https://www.conventionalcommits.org/):
   
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve issue with query execution"
   git commit -m "docs: update API documentation"
   ```
   
   Commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

6. **Push to your fork**:
   
   ```bash
   git push origin feature/my-feature
   ```

7. **Create a Pull Request** on GitHub

## Code Guidelines

### TypeScript

- **Use TypeScript** for all new code
- **Follow existing patterns** in the codebase
- **Define proper types** - avoid `any` when possible
- **Export types** that are part of the public API
- **Document complex types** with JSDoc comments

### Code Style

- **2 spaces** for indentation (enforced by Prettier)
- **Semicolons** are required
- **Single quotes** for strings
- **Trailing commas** in multi-line objects/arrays
- **ESLint rules** must pass (run `npm run util:lint`)

### CSS/SCSS

- **Use CSS custom properties** for theming
- **Support both light and dark themes**
- **Follow BEM naming** when appropriate
- **Keep specificity low** - avoid deeply nested selectors
- **Use existing CSS variables**:
  - `--yasgui-bg-primary`, `--yasgui-bg-secondary`, `--yasgui-bg-tertiary`
  - `--yasgui-text-primary`, `--yasgui-text-secondary`
  - `--yasgui-accent-color`, `--yasgui-border-color`

Example:
```css
.my-component {
  background: var(--yasgui-bg-primary);
  color: var(--yasgui-text-primary);
  border: 1px solid var(--yasgui-border-color);
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

### Documentation

- **Update documentation** when changing behavior
- **Add JSDoc comments** for public APIs
- **Include examples** for complex features
- **Update README** if adding major features

## Testing

### Build Before Testing

**Always build before running tests** - tests require compiled output:

```bash
npm run build
npm test
```

### Test Types

- **Unit Tests**: Test individual functions and components
  ```bash
  npm run unit-test
  ```

- **E2E Tests**: Test the full application (requires Chrome)
  ```bash
  npm run puppeteer-test
  ```

### Writing Tests

- **Test files** should end with `-test.ts` or `.test.ts`
- **Use Mocha and Chai** (existing test framework)
- **Follow existing test patterns** in the `test/` directory
- **Test both success and error cases**
- **Keep tests focused** - one concept per test

Example test structure:
```typescript
import { expect } from 'chai';
import MyClass from '../src/MyClass';

describe('MyClass', () => {
  it('should do something correctly', () => {
    const instance = new MyClass();
    const result = instance.doSomething();
    expect(result).to.equal('expected value');
  });
});
```

## Pull Requests

### Before Submitting

- ✅ **Build succeeds**: `npm run build`
- ✅ **All tests pass**: `npm test`
- ✅ **Linting passes**: `npm run util:lint`
- ✅ **Type checking passes**: `npm run util:validateTs`
- ✅ **Code is formatted**: `npm run util:prettify` (or rely on pre-commit hooks)
- ✅ **Documentation updated** (if applicable)
- ✅ **Commits follow conventional format**

### PR Description

Include in your pull request:

1. **Description** of what the PR does
2. **Issue reference** (if applicable): "Fixes #123" or "Closes #456"
3. **Testing performed** - how you verified the changes
4. **Screenshots** (if UI changes)
5. **Breaking changes** (if any)

### Review Process

1. **Automated checks** run on all PRs (GitHub Actions)
2. **Code review** by maintainers
3. **Feedback addressed** through additional commits
4. **Approval and merge** by maintainers

### PR Best Practices

- **Keep PRs focused** - one feature or fix per PR
- **Small is better** - easier to review and merge
- **Respond to feedback** promptly and constructively
- **Rebase if needed** to keep history clean (if requested)

## Reporting Issues

### Bug Reports

When reporting a bug, include:

- **Environment**: Browser version, OS, Node.js version (if relevant)
- **Steps to reproduce**: Detailed steps to trigger the bug
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Console errors**: Any error messages from browser console
- **Sample query**: A minimal SPARQL query that demonstrates the issue

Use the GitHub issue template if available.

### Feature Requests

When requesting a feature:

- **Use case**: Explain why this feature is needed
- **Proposed solution**: Describe how you envision it working
- **Alternatives**: Mention any alternative approaches you've considered
- **Willingness to implement**: Let us know if you're willing to work on it

## Community

### Getting Help

- **📖 [User Guide](./docs/user-guide.md)** - Comprehensive usage documentation
- **🛠️ [Developer Guide](./docs/developer-guide.md)** - API reference and integration guide
- **💬 [GitHub Discussions](https://github.com/Matdata-eu/Matgui/discussions)** - Ask questions and share ideas
- **🐛 [Issue Tracker](https://github.com/Matdata-eu/Matgui/issues)** - Report bugs or request features

### Communication Guidelines

- **Be respectful** and considerate
- **Search existing issues/discussions** before posting
- **Provide context** and details
- **Stay on topic**
- **Help others** when you can

## Project Structure

For reference, here's the repository structure:

```
Yasgui/
├── packages/               # Monorepo packages (source code)
│   ├── yasgui/            # Main package - integrates yasqe + yasr
│   ├── yasqe/             # Query editor (CodeMirror-based)
│   ├── yasr/              # Results viewer with plugin system
│   │   └── src/plugins/   # ⚠️ CORE PLUGINS ONLY - Keep as-is
│   └── utils/             # Shared utilities
├── build/                 # Build output (gitignored)
├── dev/                   # Development HTML pages for testing
├── test/                  # Test files
├── docs/                  # Markdown documentation
├── .github/workflows/     # CI/CD pipelines
└── CONTRIBUTING.md        # This file
```

## Additional Resources

- **[Developer Guide](./docs/developer-guide.md)** - Complete API reference
- **[User Guide](./docs/user-guide.md)** - End-user documentation
- **[Release Process](./docs/release-note-instructions.md)** - How releases are managed

## Questions?

If you have questions about contributing, please:

1. Check the [Developer Guide](./docs/developer-guide.md)
2. Search [GitHub Discussions](https://github.com/Matdata-eu/Matgui/discussions)
3. Open a new discussion if your question isn't answered

Thank you for contributing to YASGUI! 🎉
