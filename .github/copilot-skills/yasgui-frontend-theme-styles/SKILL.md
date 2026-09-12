# Skill: MatGUI Frontend Theme & Styles

## Description
Guides developers in implementing frontend styles and theme support following MatGUI's theming system, CSS conventions, and responsive design patterns.

> **Note:** MatGUI was formerly branded *Yasgui*, and this guidance most likely also applies to Yasgui-based projects. CSS classes and custom properties keep their `yasgui`/`--yasgui-*` names for backwards compatibility.

## When to Use
- User is working on CSS/SCSS files
- User asks about styling or themes
- User wants to add dark/light mode support
- User mentions CSS custom properties or variables
- User is creating UI components
- User needs responsive design guidance
- User asks about theme switching

## Problem Statement
MatGUI has a comprehensive theming system with specific requirements:

**Theme System:**
- Dual theme support: light and dark modes
- Theme controlled by `data-theme` attribute on `<html>` element
- CSS custom properties for all colors
- Smooth transitions between themes
- Theme persistence via LocalStorage

**CSS Structure:**
- Sass/SCSS for source files
- CSS custom properties for runtime theming
- BEM-like naming conventions
- Responsive design patterns
- Scoped styles per component

**Build Pipeline:**
- SCSS → CSS compilation via esbuild-sass-plugin
- PostCSS with autoprefixer
- Minification in production
- CSS bundled with JS in build output

## Required Inputs
- **Component being styled**
- **Theme requirements** (colors, spacing, etc.)
- **Responsive behavior** needs
- **Dark/light mode** considerations

## Instructions

### Step 1: Understand Theme Architecture

YASGUI uses a two-layer theming system:

1. **CSS Custom Properties (Runtime):**
   - Colors change dynamically via JavaScript
   - `data-theme="light|dark"` on `<html>`
   - No rebuild required for theme switch

2. **SCSS Variables (Build-time):**
   - Structure and spacing
   - Compiled once
   - Cannot change at runtime

### Step 2: Use CSS Custom Properties

**Always use** these custom properties for colors:

```scss
// Background colors
var(--yasgui-bg-primary)      // Main background
var(--yasgui-bg-secondary)    // Card/panel background
var(--yasgui-bg-tertiary)     // Hover states, subtle highlights

// Text colors
var(--yasgui-text-primary)    // Main text
var(--yasgui-text-secondary)  // Muted text, labels
var(--yasgui-text-muted)      // Disabled text, placeholders

// Accent colors
var(--yasgui-accent-color)         // Primary brand color, active states
var(--yasgui-accent-color-hover)   // Hover state for accent elements

// Border colors
var(--yasgui-border-color)         // Default borders
var(--yasgui-border-color-light)   // Subtle borders, dividers

// Status colors
var(--yasgui-error-color)     // Error messages, validation
var(--yasgui-warning-color)   // Warnings
var(--yasgui-success-color)   // Success states

// Button colors
var(--yasgui-btn-bg)          // Button background
var(--yasgui-btn-text)        // Button text
var(--yasgui-btn-hover-bg)    // Button hover background

// Input colors
var(--yasgui-input-bg)        // Input background
var(--yasgui-input-border)    // Input border
var(--yasgui-input-focus)     // Input focus state
```

### Step 3: SCSS Structure Pattern

Create component styles following this pattern:

```scss
// packages/[package]/src/[component].scss

// Import utilities if needed
@import "mixins";

// Component root class
.yasgui-[component-name] {
  // Layout (responsive)
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  
  // Use CSS custom properties for colors
  background: var(--yasgui-bg-primary);
  color: var(--yasgui-text-primary);
  border: 1px solid var(--yasgui-border-color);
  
  // Smooth theme transitions
  transition: background-color 0.3s ease,
              color 0.3s ease,
              border-color 0.3s ease;
  
  // Spacing
  padding: 1rem;
  gap: 0.5rem;
  
  // Child elements (BEM-like)
  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--yasgui-border-color-light);
  }
  
  &__content {
    flex: 1;
    overflow: auto;
  }
  
  &__footer {
    margin-top: auto;
    padding-top: 0.5rem;
  }
  
  // State modifiers
  &--loading {
    opacity: 0.6;
    pointer-events: none;
  }
  
  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Dark theme specific adjustments (if needed)
[data-theme="dark"] .yasgui-[component-name] {
  // Only add if CSS custom properties aren't sufficient
  // Most theming should work automatically
}

// Light theme specific adjustments (if needed)
[data-theme="light"] .yasgui-[component-name] {
  // Only add if CSS custom properties aren't sufficient
}

// Responsive breakpoints
@media (max-width: 768px) {
  .yasgui-[component-name] {
    padding: 0.5rem;
    
    &__header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
}

@media (max-width: 480px) {
  .yasgui-[component-name] {
    font-size: 0.9rem;
  }
}
```

### Step 4: Implement Theme Switching Support

For components that need to react to theme changes:

```typescript
// In your TypeScript component file

class MyComponent {
  private themeObserver: MutationObserver;
  
  constructor() {
    this.watchThemeChanges();
  }
  
  /**
   * Watch for theme changes on document
   */
  private watchThemeChanges(): void {
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          this.handleThemeChange();
        }
      });
    });
    
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }
  
  /**
   * Called when theme changes
   */
  private handleThemeChange(): void {
    const theme = document.documentElement.getAttribute('data-theme');
    console.log(`Theme changed to: ${theme}`);
    
    // Redraw if needed (e.g., for canvas/SVG that doesn't use CSS)
    this.redraw();
  }
  
  /**
   * Get current theme
   */
  private getCurrentTheme(): 'light' | 'dark' {
    return document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'light';
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.themeObserver?.disconnect();
  }
}
```

### Step 5: Responsive Design Patterns

Follow these responsive design patterns:

**1. Flexible Containers:**
```scss
.container {
  width: 100%;
  max-width: 1200px; // Optional max width
  margin: 0 auto;
  padding: 1rem;
}

@media (max-width: 768px) {
  .container {
    padding: 0.5rem;
  }
}
```

**2. Flexible Typography:**
```scss
.heading {
  font-size: clamp(1.5rem, 2vw + 1rem, 2.5rem);
}

.text {
  font-size: clamp(0.875rem, 1vw + 0.5rem, 1rem);
}
```

**3. Responsive Grid:**
```scss
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}
```

**4. Stack on Mobile:**
```scss
.toolbar {
  display: flex;
  gap: 0.5rem;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
  }
}
```

### Step 6: Component State Styles

Implement interactive states consistently:

```scss
.button {
  background: var(--yasgui-btn-bg);
  color: var(--yasgui-btn-text);
  border: 1px solid var(--yasgui-border-color);
  padding: 0.5rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  // Hover state
  &:hover:not(:disabled) {
    background: var(--yasgui-btn-hover-bg);
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  // Active/pressed state
  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: none;
  }
  
  // Focus state (for accessibility)
  &:focus-visible {
    outline: 2px solid var(--yasgui-accent-color);
    outline-offset: 2px;
  }
  
  // Disabled state
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

### Step 7: Accessibility Considerations

Ensure accessible styling:

```scss
// Focus indicators
.interactive-element {
  &:focus-visible {
    outline: 2px solid var(--yasgui-accent-color);
    outline-offset: 2px;
  }
}

// Color contrast
// Ensure text has sufficient contrast with background
// WCAG AA: 4.5:1 for normal text, 3:1 for large text

// Screen reader only content
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

// Reduced motion preference
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Step 8: Testing Theme Implementation

Test checklist:

1. **Visual Testing:**
   ```typescript
   // Switch theme programmatically
   document.documentElement.setAttribute('data-theme', 'dark');
   // Verify colors update
   
   document.documentElement.setAttribute('data-theme', 'light');
   // Verify colors update
   ```

2. **Responsive Testing:**
   - Test at 320px (small mobile)
   - Test at 768px (tablet)
   - Test at 1024px (desktop)
   - Test at 1920px (large desktop)

3. **Browser Testing:**
   - Chrome/Edge (Chromium)
   - Firefox
   - Safari

4. **Accessibility Testing:**
   - Tab navigation works
   - Focus indicators visible
   - Screen reader friendly
   - Color contrast sufficient

## Common Patterns

### Pattern 1: Modal/Dialog

```scss
.yasgui-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  
  &__content {
    background: var(--yasgui-bg-primary);
    color: var(--yasgui-text-primary);
    border: 1px solid var(--yasgui-border-color);
    border-radius: 4px;
    padding: 2rem;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow: auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
}

@media (max-width: 768px) {
  .yasgui-modal__content {
    width: 95%;
    padding: 1rem;
  }
}
```

### Pattern 2: Card Component

```scss
.yasgui-card {
  background: var(--yasgui-bg-secondary);
  border: 1px solid var(--yasgui-border-color);
  border-radius: 4px;
  padding: 1rem;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-color: var(--yasgui-accent-color);
  }
  
  &__title {
    color: var(--yasgui-text-primary);
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  &__content {
    color: var(--yasgui-text-secondary);
    line-height: 1.5;
  }
}
```

### Pattern 3: Form Inputs

```scss
.yasgui-input {
  width: 100%;
  background: var(--yasgui-input-bg);
  color: var(--yasgui-text-primary);
  border: 1px solid var(--yasgui-input-border);
  padding: 0.5rem;
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  
  &::placeholder {
    color: var(--yasgui-text-muted);
  }
  
  &:focus {
    outline: none;
    border-color: var(--yasgui-input-focus);
    box-shadow: 0 0 0 3px rgba(var(--yasgui-accent-color), 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &--error {
    border-color: var(--yasgui-error-color);
  }
}
```

### Pattern 4: Loading Spinner

```scss
.yasgui-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid var(--yasgui-border-color);
  border-top-color: var(--yasgui-accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// Respect reduced motion
@media (prefers-reduced-motion: reduce) {
  .yasgui-spinner {
    animation: none;
    border-top-color: var(--yasgui-accent-color);
  }
}
```

### Pattern 5: Tooltip

```scss
.yasgui-tooltip {
  position: relative;
  
  &__content {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--yasgui-bg-tertiary);
    color: var(--yasgui-text-primary);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    margin-bottom: 0.5rem;
    
    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 4px solid transparent;
      border-top-color: var(--yasgui-bg-tertiary);
    }
  }
  
  &:hover &__content {
    opacity: 1;
  }
}
```

## Decision Tree

```
START
  ↓
What are you styling?
  ├─ New component
  │   → Create [component].scss
  │   → Use CSS custom properties
  │   → Add theme transitions
  │   → Make responsive
  │
  ├─ Modifying existing styles
  │   → Find existing .scss file
  │   → Check if using var(--yasgui-*)
  │   → If not, refactor to use custom properties
  │
  ├─ Adding theme-specific style
  │   → Try CSS custom properties first
  │   → Only use [data-theme] selectors if necessary
  │
  └─ Plugin styles
      → Follow plugin style guide
      → Must support both themes
      → Must be responsive
  ↓
Test in both themes
  ↓
Test responsive behavior
  ↓
Check accessibility
```

## Example: Complete Component Styling

**Scenario:** Styling a new query browser panel

**SCSS File:** `packages/yasgui/src/queryManagement/QueryBrowser.scss`

```scss
.yasgui-query-browser {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--yasgui-bg-primary);
  transition: background-color 0.3s ease;
  
  // Header with search and actions
  &__header {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-bottom: 1px solid var(--yasgui-border-color);
    background: var(--yasgui-bg-secondary);
    transition: all 0.3s ease;
  }
  
  // Search input
  &__search {
    flex: 1;
    background: var(--yasgui-input-bg);
    color: var(--yasgui-text-primary);
    border: 1px solid var(--yasgui-input-border);
    padding: 0.5rem;
    border-radius: 4px;
    
    &:focus {
      outline: none;
      border-color: var(--yasgui-accent-color);
    }
  }
  
  // Query list
  &__list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }
  
  // Individual query item
  &__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--yasgui-bg-secondary);
    border: 1px solid var(--yasgui-border-color);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: var(--yasgui-bg-tertiary);
      border-color: var(--yasgui-accent-color);
    }
    
    &--selected {
      background: var(--yasgui-accent-color);
      color: white;
      border-color: var(--yasgui-accent-color);
    }
  }
  
  &__item-name {
    flex: 1;
    color: var(--yasgui-text-primary);
    font-weight: 500;
  }
  
  &__item-date {
    color: var(--yasgui-text-muted);
    font-size: 0.875rem;
  }
  
  // Empty state
  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--yasgui-text-muted);
    text-align: center;
    padding: 2rem;
  }
  
  // Loading state
  &__loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .yasgui-query-browser {
    &__header {
      flex-direction: column;
      padding: 0.5rem;
    }
    
    &__item {
      flex-direction: column;
      align-items: flex-start;
    }
  }
}
```

## Output Format

When providing styling guidance:

1. **Component Location:**
   ```
   📁 packages/[package]/src/[component].scss
   ```

2. **SCSS Template:**
   ````scss
   ```scss
   [Component styles]
   ```
   ````

3. **CSS Custom Properties Used:**
   ```
   Colors used:
   - var(--yasgui-bg-primary)
   - var(--yasgui-text-primary)
   - var(--yasgui-accent-color)
   ```

4. **Responsive Breakpoints:**
   ```
   Breakpoints:
   - 768px: [changes]
   - 480px: [changes]
   ```

5. **Theme Support:**
   ```
   ✓ Light mode supported
   ✓ Dark mode supported
   ✓ Smooth transitions
   ```

## Validation Checklist

- [ ] Uses CSS custom properties for all colors
- [ ] Smooth transitions on theme change (0.3s ease)
- [ ] Responsive (works at 320px, 768px, 1920px)
- [ ] Accessible (focus states, contrast, keyboard nav)
- [ ] BEM-like naming convention
- [ ] Compatible with both themes
- [ ] No hardcoded colors (use var(--yasgui-*))
- [ ] Tested in Chrome, Firefox, Safari
- [ ] Works with reduced motion preference

## Related Files
- `packages/yasgui/src/themes.scss` - Theme definitions
- `packages/yasgui/src/github-dark-theme.scss` - Dark theme
- `packages/yasgui/src/index.scss` - Main stylesheet
- `packages/*/src/*.scss` - Component stylesheets
- `packages/yasgui/src/ThemeManager.ts` - Theme switching logic

## Notes
- **CSS custom properties are key:** All color-related styles must use them
- **Transitions make it smooth:** 0.3s ease for theme switches
- **Mobile-first approach:** Base styles for mobile, enhance for desktop
- **Test both themes:** Always verify light AND dark mode
- **Sass is compiled:** Changes require rebuild
- **Follow existing patterns:** Match styling in similar components
