# Skill: Matgui Build-Test Workflow

## Description
Automates the critical build-before-test workflow for YASGUI. This skill ensures tests are run with valid build output and selects the appropriate test command based on the environment and code changes.

## When to Use
- User wants to run tests
- User mentions test failures related to missing build output
- User asks to "test my changes" or "run tests"
- Before any test execution command
- When CI/CD workflow questions arise

## Problem Statement
Matgui has a **mandatory build-before-test requirement**. Running tests without building first will fail with:
```
Run "npm run build" before running a test
```

Additionally:
- **Puppeteer tests** require Chrome and AppArmor configuration on Linux
- **Unit tests** can run without Chrome
- Build must complete successfully (~5 seconds)
- Build output goes to `build/` directory (gitignored)

## Required Inputs
- Current workspace state
- Whether code changes affect UI/E2E scenarios
- Operating system (for AppArmor warnings)

## Instructions

### Step 1: Check Build Status
1. Check if `build/` directory exists and has content
2. Check timestamps: if source files are newer than build output, rebuild is needed
3. Look for these key build artifacts:
   - `build/yasgui.min.js`
   - `build/yasqe.min.js`
   - `build/yasr.min.js`
   - `build/utils.min.js`

### Step 2: Determine if Build is Needed
Build is required if:
- `build/` directory is missing
- `build/` directory is empty
- Source files have been modified since last build
- User explicitly requests a full test run
- This is a fresh clone of the repository

### Step 3: Run Build (if needed)
Execute the build command:
```bash
npm run build
```

**Expected output:**
- "✓ Build complete!" message
- Completes in ~5-10 seconds
- Creates/updates files in `build/` directory

**If build fails:**
- Check for TypeScript errors (some are expected from dependencies)
- Check for esbuild errors (these are critical)
- Verify all packages have dependencies installed

### Step 4: Select Appropriate Test Command

#### Option A: Unit Tests Only (Recommended for most cases)
```bash
npm run unit-test
```
- **Use when:** Testing logic, utilities, backend code
- **Pros:** Fast, works without Chrome, no AppArmor issues
- **Tests:** Files in `test/unit/*-test.ts`

#### Option B: Puppeteer E2E Tests Only
```bash
npm run puppeteer-test
```
- **Use when:** Testing UI, browser interactions, visual features
- **Requires:** Chrome installed, AppArmor configured (Linux)
- **Tests:** `test/run.ts` (main E2E test suite)
- **Timeout:** 30 seconds per test

#### Option C: Full Test Suite
```bash
npm test
```
- **Use when:** Pre-commit, final validation, CI emulation
- **Runs:** Both puppeteer and unit tests
- **Time:** Longer execution (~30-60 seconds)

### Step 5: Handle Test Execution

**Before running tests:**
1. Ensure build directory exists and is populated
2. Provide context on what's being tested
3. Warn about Chrome requirements if running puppeteer tests

**During test execution:**
- Monitor for timeout errors (increase if needed with `--timeout` flag)
- Watch for AppArmor errors on Linux

**After test execution:**
- Report pass/fail status
- If failures occur, analyze error messages
- Suggest fixes based on error patterns

### Step 6: Handle Common Issues

#### Issue: Puppeteer Chrome Not Found
**Solution:**
```bash
# Run unit tests only
npm run unit-test

# OR install Chrome and disable AppArmor (Linux only)
echo 0 | sudo tee /proc/sys/kernel/apparmor_restrict_unprivileged_userns
```

#### Issue: Build Fails with TypeScript Errors
**Solution:**
- Check if errors are in dependencies (expected, can be ignored)
- Check if errors are in source code (must fix)
- Run `npm run util:validateTs` for type-checking only

#### Issue: "No files matching packages/*/test/**/*.{ts,tsx}"
**Solution:**
- This is **expected** and **not an error**
- Tests are in root `test/` directory, not per-package
- ESLint message is informational only

## Decision Tree

```
START
  ↓
Does build/ exist with content?
  ├─ NO → Run `npm run build`
  └─ YES → Check timestamps
      ↓
Are source files newer than build?
  ├─ YES → Run `npm run build`
  └─ NO → Skip build
      ↓
What type of changes were made?
  ├─ UI/Frontend → Recommend `npm run puppeteer-test`
  │                (warn about Chrome requirement)
  ├─ Logic/Utils → Recommend `npm run unit-test`
  └─ Unknown → Recommend `npm run unit-test` (safer default)
      ↓
Execute selected test command
  ↓
Tests pass?
  ├─ YES → Report success
  └─ NO → Analyze errors and suggest fixes
```

## Examples

### Example 1: Fresh Clone
```bash
# User just cloned repo
# Skill detects: build/ doesn't exist

# Action: Build first
npm run build

# Then: Run appropriate tests
npm run unit-test
```

### Example 2: After Code Changes
```bash
# User modified packages/yasgui/src/Tab.ts
# Skill detects: source newer than build

# Action: Rebuild
npm run build

# Then: Run unit tests (logic change)
npm run unit-test
```

### Example 3: UI Feature Testing
```bash
# User added new theme toggle button
# Skill detects: UI change requires E2E tests

# Action: Build first
npm run build

# Then: Run puppeteer tests
# Warning: Requires Chrome
npm run puppeteer-test
```

### Example 4: Pre-commit Validation
```bash
# User ready to commit
# Skill suggests: Full validation

# Action: Build
npm run build

# Then: Run all tests
npm test
```

## Output Format

When executing this skill, provide:

1. **Status Check:**
   ```
   ✓ Build directory exists
   ⚠ Source files modified since last build
   ```

2. **Action Plan:**
   ```
   Building project...
   Running unit tests (logic changes detected)...
   ```

3. **Results Summary:**
   ```
   ✓ Build completed in 5.2s
   ✓ 15 unit tests passed
   ```

4. **If Issues Found:**
   ```
   ⚠ 2 tests failed in query-management-test.ts
   Analyzing errors...
   ```

## Integration with Other Workflows

- **Pre-commit:** Run `npm run build && npm test`
- **CI/CD:** This skill explains GitHub Actions workflow requirements
- **Development Loop:** Quick iteration with `npm run build && npm run unit-test`

## Validation Checklist

Before marking workflow complete:
- [ ] Build output exists in `build/` directory
- [ ] At least one test command executed successfully
- [ ] User informed of test results
- [ ] Any failures have actionable suggestions
- [ ] Chrome requirement warned if puppeteer tests selected

## Related Files
- `.github/copilot-instructions.md` - Build & test requirements
- `package.json` - Test scripts
- `test/run.ts` - E2E test entry point
- `test/unit/` - Unit test directory
- `esbuild.config.js` - Build configuration

## Notes
- **Trust the build:** It's fast (~5s), rebuild when in doubt
- **Unit tests first:** Default to unit-test for safety
- **Puppeteer optional:** Skip E2E if Chrome unavailable
- **CI mirrors this:** GitHub Actions follows same workflow
