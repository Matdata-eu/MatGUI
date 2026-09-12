# Skill: MatGUI Test Strategy Advisor

## Description
Recommends the appropriate testing approach for code changes and generates test scaffolding following MatGUI's patterns. Helps developers choose between unit tests and E2E tests, and provides templates.

> **Note:** MatGUI was formerly branded *Yasgui*, and this guidance most likely also applies to Yasgui-based projects. Source folders, packages and CSS classes still use the `yasgui`/`yasqe`/`yasr` names.

## When to Use
- User adds new functionality and needs tests
- User asks "how should I test this?"
- User wants to add test coverage
- User mentions writing tests
- User modified code and needs to validate it

## Problem Statement
MatGUI has **two distinct test types** with different characteristics:

### Unit Tests
- **Location:** `test/unit/*-test.ts`
- **Command:** `npm run unit-test`
- **Framework:** Mocha + Chai
- **Environment:** Node.js (no browser needed)
- **Speed:** Fast
- **Scope:** Logic, utilities, data structures, backends
- **Pros:** No Chrome required, fast feedback
- **Cons:** Can't test UI/browser interactions

### E2E Tests (Puppeteer)
- **Location:** `test/run.ts`
- **Command:** `npm run puppeteer-test`
- **Framework:** Mocha + Chai + Puppeteer
- **Environment:** Chrome browser
- **Speed:** Slower (~30s timeout per test)
- **Scope:** UI interactions, browser behavior, visual features
- **Pros:** Tests real user interactions
- **Cons:** Requires Chrome, slower, more fragile

## Required Inputs
- **Code changes** or description of what was modified
- **Type of functionality** (UI, logic, backend, etc.)
- **Files modified**

## Instructions

### Step 1: Analyze Code Changes

Determine what was changed:

1. **UI Components:**
   - React/vanilla JS components
   - DOM manipulation
   - Event handlers
   - CSS/styling
   - → **E2E Tests**

2. **Business Logic:**
   - Data transformations
   - Algorithms
   - Utility functions
   - Calculations
   - → **Unit Tests**

3. **Backend/Storage:**
   - Query management backends
   - LocalStorage operations
   - Data persistence
   - → **Unit Tests** (can mock browser APIs)

4. **CodeMirror/Editor:**
   - Autocompletion
   - Syntax highlighting
   - Editor commands
   - → **E2E Tests** (CodeMirror needs DOM)

5. **Plugin System:**
   - Plugin interface changes
   - Plugin rendering
   - → **E2E Tests** for rendering, **Unit Tests** for logic

### Step 2: Recommend Test Type

Based on analysis:

**Recommend Unit Tests if:**
- Pure functions or data transformations
- Backend implementations
- Utility functions
- Configuration parsing
- URL parsing/generation
- Query versioning logic
- Data validation

**Recommend E2E Tests if:**
- DOM rendering
- User interactions (clicks, typing)
- Visual features
- Tab management UI
- Editor behavior
- Plugin rendering
- Theme switching
- Autocomplete dropdowns

**Recommend Both if:**
- Complex feature with logic AND UI
- Example: Query management (unit tests for backend, E2E for browser UI)

### Step 3: Generate Test Scaffolding

#### For Unit Tests

Template location: `test/unit/[feature]-test.ts`

```typescript
import { expect } from "chai";
import { describe, it } from "mocha";

// Import what you're testing
import { YourFunction } from "../../packages/[package]/src/[file]";

describe("[Feature Name]", () => {
  describe("[Method/Function Name]", () => {
    it("should [expected behavior]", () => {
      // Arrange
      const input = "test data";
      const expected = "expected result";
      
      // Act
      const result = YourFunction(input);
      
      // Assert
      expect(result).to.equal(expected);
    });

    it("should handle edge case: [description]", () => {
      // Test edge cases
      expect(() => YourFunction(null)).to.throw();
    });

    it("should [another behavior]", () => {
      // More test cases
    });
  });
});
```

#### For E2E Tests (Puppeteer)

Add to existing `test/run.ts` in appropriate describe block:

```typescript
describe("[Your Feature]", function () {
  // If you need custom timeout
  this.timeout(10000);

  beforeEach(async function () {
    // Setup: navigate to page, clear state
    page = await getPage(browser, "yasgui.html");
    await page.evaluate(() => localStorage.clear());
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  it("should [expected behavior]", async function () {
    // Arrange: Set up initial state
    await page.evaluate(() => {
      window.yasgui.getTab().setQuery("SELECT * WHERE { ?s ?p ?o }");
    });

    // Act: Perform user action
    await page.click(".some-button");

    // Assert: Check result
    const result = await page.evaluate(() => {
      return window.yasgui.getTab().getQuery();
    });
    
    expect(result).to.contain("expected text");
  });

  it("should handle [user interaction]", async function () {
    // Type into editor
    await page.evaluate(() => {
      window.yasqe.setValue("");
      window.yasqe.focus();
    });
    await page.keyboard.type("SELECT");

    // Wait for autocomplete
    await page.waitForSelector(".CodeMirror-hints", { timeout: 600 });

    // Check result
    const hasHints = await page.evaluate(() => {
      return document.querySelector(".CodeMirror-hints") !== null;
    });
    expect(hasHints).to.be.true;
  });

  it("should wait for async operation", async function () {
    // Trigger async action
    await page.click(".query-button");

    // Wait for completion
    await page.waitForFunction(
      () => !document.querySelector(".loading-spinner"),
      { timeout: 5000 }
    );

    // Verify result
    const response = await page.evaluate(() => {
      return window.yasgui.getTab().getYasr().results;
    });
    expect(response).to.not.be.undefined;
  });
});
```

### Step 4: Provide Test Data

Suggest appropriate test data based on feature:

**For SPARQL Queries:**
```typescript
const testQuery = `PREFIX ex: <http://example.org/>
SELECT * WHERE {
  ?s ex:property ?o .
} LIMIT 10`;
```

**For Query Management:**
```typescript
const testManagedQuery = {
  filename: "test-query",
  query: "SELECT * WHERE { ?s ?p ?o }",
  version: 1,
  created: new Date().toISOString()
};
```

**For UI State:**
```typescript
await page.evaluate(() => {
  const yasgui = window.yasgui;
  yasgui.addTab();
  yasgui.getTab().setQuery("...");
});
```

### Step 5: Identify Existing Test Patterns

Search for similar tests:

```typescript
// Find tests for similar features
grep_search({
  query: "[similar feature name]",
  isRegexp: false,
  includePattern: "test/**/*.ts"
})
```

Point user to existing test that matches their use case.

### Step 6: Recommend Test File Location

**Unit Tests:**
- Create new file: `test/unit/[feature-name]-test.ts`
- Follow naming: `[feature]-test.ts`
- Examples:
  - `query-management-backend-test.ts`
  - `url-utils-test.ts`
  - `query-versioning-test.ts`

**E2E Tests:**
- Add to existing: `test/run.ts`
- Add new `describe` block
- Keep related tests grouped

### Step 7: Provide Execution Instructions

```bash
# Build first (always required)
npm run build

# Run unit tests
npm run unit-test

# Run specific test file (via mocha)
node ./node_modules/mocha/bin/mocha.js "build/test/unit/your-test-name-test.js"

# Run E2E tests
npm run puppeteer-test

# Run all tests
npm test
```

## Common Testing Patterns

### Pattern 1: Testing Pure Functions

```typescript
import { expect } from "chai";
import { myUtilityFunction } from "../../packages/utils/src/index";

describe("myUtilityFunction", () => {
  it("should transform input correctly", () => {
    expect(myUtilityFunction("input")).to.equal("output");
  });

  it("should handle empty input", () => {
    expect(myUtilityFunction("")).to.equal("");
  });

  it("should throw on invalid input", () => {
    expect(() => myUtilityFunction(null)).to.throw();
  });
});
```

### Pattern 2: Testing Async Operations (E2E)

```typescript
it("should complete async operation", async function () {
  await page.evaluate(() => {
    window.yasgui.getTab().query();
  });

  // Wait for completion
  await page.waitForFunction(
    () => !window.yasgui.getTab().getYasqe().queryInProgress,
    { timeout: 5000 }
  );

  const hasResults = await page.evaluate(() => {
    return window.yasgui.getTab().getYasr().results !== undefined;
  });

  expect(hasResults).to.be.true;
});
```

### Pattern 3: Testing User Input (E2E)

```typescript
it("should handle user typing", async function () {
  await page.evaluate(() => {
    window.yasqe.setValue("");
    window.yasqe.focus();
  });

  // Type and wait for it to register
  await page.keyboard.type("PREFIX");
  await page.waitForFunction(
    () => window.yasqe.getValue().includes("PREFIX"),
    { timeout: 600 }
  );

  const value = await page.evaluate(() => window.yasqe.getValue());
  expect(value).to.equal("PREFIX");
});
```

### Pattern 4: Testing LocalStorage (Unit)

```typescript
describe("LocalStorage operations", () => {
  beforeEach(() => {
    // Mock localStorage if needed
    global.localStorage = {
      getItem: (key: string) => mockData[key],
      setItem: (key: string, value: string) => { mockData[key] = value; },
      clear: () => { mockData = {}; }
    };
  });

  it("should save data to localStorage", () => {
    saveToStorage("key", "value");
    expect(localStorage.getItem("key")).to.equal("value");
  });
});
```

### Pattern 5: Testing Error Handling

```typescript
it("should handle network errors gracefully", async function () {
  // Mock failed request
  await page.setRequestInterception(true);
  page.on("request", request => {
    if (request.url().includes("/sparql")) {
      request.abort("failed");
    } else {
      request.continue();
    }
  });

  // Trigger query
  await page.evaluate(() => {
    window.yasgui.getTab().query();
  });

  // Check error handling
  await page.waitForSelector(".error-message");
  const errorText = await page.$eval(".error-message", el => el.textContent);
  expect(errorText).to.contain("error");
});
```

## Decision Tree

```
START
  ↓
What type of code was changed?
  ├─ Pure function/utility
  │   → Unit Test
  │
  ├─ Browser API/DOM manipulation
  │   → E2E Test
  │
  ├─ Data structure/backend
  │   → Unit Test
  │
  ├─ UI component/interaction
  │   → E2E Test
  │
  ├─ Editor feature (CodeMirror)
  │   → E2E Test
  │
  └─ Complex feature (logic + UI)
      → Both (unit for logic, E2E for UI)
  ↓
Generate appropriate test template
  ↓
Suggest test file location
  ↓
Provide execution commands
```

## Test Coverage Guidelines

For complete feature testing:

**Unit Test Coverage:**
- ✅ All public functions
- ✅ Edge cases and error conditions
- ✅ Data transformations
- ✅ Configuration parsing
- ✅ Utility functions

**E2E Test Coverage:**
- ✅ Happy path user flows
- ✅ Critical UI interactions
- ✅ Tab management
- ✅ Query execution
- ✅ Plugin rendering
- ✅ Theme switching

**What NOT to test:**
- ❌ Third-party library internals
- ❌ Browser API implementations
- ❌ CodeMirror internals (test your usage of it)

## Example Recommendations

### Scenario 1: New Query Backend

**User:** "I added a new GitHub-based query backend"

**Recommendation:**
```
Testing Strategy: Unit Tests

Location: test/unit/query-management-github-backend-test.ts

Reason:
- Backend logic doesn't require browser
- Can mock fetch/GitHub API
- Fast iteration cycles

Test cases needed:
✓ Load queries from GitHub
✓ Save queries to GitHub
✓ Handle authentication
✓ Handle network errors
✓ Parse GitHub API responses

Template: [provide unit test template]

Command: npm run build && npm run unit-test
```

### Scenario 2: New Tab Context Menu

**User:** "I added a right-click context menu on tabs"

**Recommendation:**
```
Testing Strategy: E2E Tests (Puppeteer)

Location: Add to test/run.ts in Tab section

Reason:
- Requires DOM manipulation
- Tests user interaction (right-click)
- Menu positioning is visual
- Need to verify menu appears

Test cases needed:
✓ Right-click shows menu
✓ Menu has correct items
✓ Clicking menu item performs action
✓ Menu closes on outside click

Template: [provide E2E test template]

⚠️  Requires Chrome

Command: npm run build && npm run puppeteer-test
```

### Scenario 3: URL Parsing Utility

**User:** "I added a function to parse SPARQL from URL"

**Recommendation:**
```
Testing Strategy: Unit Tests

Location: test/unit/url-utils-test.ts (file already exists)

Reason:
- Pure function
- No browser interaction needed
- Fast to test

Test cases needed:
✓ Parse query parameter
✓ Handle encoded URLs
✓ Handle missing parameters
✓ Handle malformed URLs
✓ Multiple parameters

Template: [provide unit test template]

Example:
expect(parseQueryFromUrl("?query=SELECT...")).to.equal("SELECT...");

Command: npm run build && npm run unit-test
```

## Output Format

Format recommendations as:

1. **Strategy Header:**
   ```
   🧪 Testing Strategy: [Unit/E2E/Both]
   ```

2. **Location:**
   ```
   📁 test/unit/[filename]-test.ts
   ```

3. **Reasoning:**
   ```
   Why this approach:
   - [reason 1]
   - [reason 2]
   ```

4. **Test Cases:**
   ```
   Test cases to cover:
   ✓ [case 1]
   ✓ [case 2]
   ```

5. **Template:**
   ````
   ```typescript
   [Full test template]
   ```
   ````

6. **Execution:**
   ```bash
   npm run build && npm run unit-test
   ```

## Validation Checklist

- [ ] Test type recommended (unit/E2E)
- [ ] Test file location specified
- [ ] Template provided
- [ ] Test cases listed
- [ ] Execution command given
- [ ] Warnings provided (Chrome requirement, etc.)
- [ ] Existing similar tests referenced

## Related Files
- `test/run.ts` - E2E test suite
- `test/unit/` - Unit tests directory
- `test/utils.ts` - Test utilities
- `.github/copilot-instructions.md` - Testing guidelines

## Notes
- **Unit tests preferred:** Default to unit tests when possible (faster, no Chrome)
- **E2E for UI only:** Reserve puppeteer for visual/interaction testing
- **Check existing tests:** Point to similar tests as examples
- **Build always required:** Both test types need build/ output
- **Mocha + Chai:** Follow existing patterns for consistency
