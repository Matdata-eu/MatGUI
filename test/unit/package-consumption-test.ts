import * as chai from "chai";
import { describe, it, before, after } from "mocha";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const expect = chai.expect;

// process.cwd() is the repo root when mocha is invoked via the package scripts.
const repoRoot = process.cwd();

/**
 * Regression tests for issue #185: verify that the npm package produced for
 * @matdata/yasgui can be consumed by real JavaScript tooling.
 *
 * The tests intentionally go through `npm pack` so they exercise the same
 * artifact that a user receives from the npm registry, not a direct source
 * import.
 */
describe("Package consumption: @matdata/yasgui published artifact (regression #185)", function () {
  let tmpDir: string;
  let packageDir: string; // the "package/" directory unpacked from the tarball

  before(function () {
    this.timeout(60_000);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yasgui-pkg-test-"));
    const packDest = path.join(tmpDir, "pack");
    fs.mkdirSync(packDest);

    execSync(`npm pack --pack-destination "${packDest}"`, {
      cwd: path.join(repoRoot, "packages", "yasgui"),
      stdio: "pipe",
    });

    const tarballs = fs.readdirSync(packDest).filter((f) => f.endsWith(".tgz"));
    if (tarballs.length !== 1) {
      throw new Error(`Expected exactly 1 tarball in pack dest, found: ${JSON.stringify(tarballs)}`);
    }
    const tarball = path.join(packDest, tarballs[0]);

    // npm pack always places extracted content under a "package/" sub-directory.
    execSync(`tar -xzf "${tarball}" -C "${tmpDir}"`);
    packageDir = path.join(tmpDir, "package");
  });

  after(function () {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  /** Copies the extracted package into a consumer directory's node_modules. */
  function installPackageIntoConsumer(consumerDir: string): void {
    const dest = path.join(consumerDir, "node_modules", "@matdata", "yasgui");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(packageDir, dest, { recursive: true });
  }

  // ── artifact structure ─────────────────────────────────────────────────────

  it("tarball contains ESM, CJS and CSS build artifacts", () => {
    const buildDir = path.join(packageDir, "build");
    for (const file of ["yasgui.mjs", "yasgui.cjs", "yasgui.min.css"]) {
      expect(fs.existsSync(path.join(buildDir, file)), `build/${file} must exist in the tarball`).to.be.true;
    }
  });

  it("package.json exports['.'].import resolves to an existing file", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
    const importEntry: unknown = pkg?.exports?.["."]?.import;
    expect(importEntry, "exports['.'].import must be a string").to.be.a("string");
    expect(
      fs.existsSync(path.join(packageDir, importEntry as string)),
      `exports['.'].import path '${importEntry}' must exist in the package`,
    ).to.be.true;
  });

  it("package.json exports['.'].require resolves to an existing file", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));
    const requireEntry: unknown = pkg?.exports?.["."]?.require;
    expect(requireEntry, "exports['.'].require must be a string").to.be.a("string");
    expect(
      fs.existsSync(path.join(packageDir, requireEntry as string)),
      `exports['.'].require path '${requireEntry}' must exist in the package`,
    ).to.be.true;
  });

  // ── ESM consumer ──────────────────────────────────────────────────────────

  // Yasgui is a browser-only package (it accesses the DOM at module init time)
  // so we cannot execute it in a plain Node.js process. Instead we verify that
  // the `exports` field resolves the bare import `@matdata/yasgui` to the .mjs
  // build — the exact mapping that was broken in issue #185. The Vite test
  // below covers end-to-end bundler consumption including the default export.
  it("ESM: `import '@matdata/yasgui'` resolves via exports field to the .mjs build", function () {
    const consumerDir = path.join(tmpDir, "esm-consumer");
    fs.mkdirSync(consumerDir, { recursive: true });
    installPackageIntoConsumer(consumerDir);

    fs.writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify({ name: "esm-consumer", type: "module", version: "0.0.0" }),
    );
    // import.meta.resolve() checks the exports field without executing the module.
    fs.writeFileSync(
      path.join(consumerDir, "consumer.mjs"),
      [
        `const url = import.meta.resolve("@matdata/yasgui");`,
        `if (!url.includes("yasgui.mjs"))`,
        `  throw new Error("Expected .mjs resolution, got: " + url);`,
        `console.log("ESM resolution OK:", url.split("/").pop());`,
      ].join("\n"),
    );

    const out = execSync("node consumer.mjs", {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(out.trim()).to.match(/^ESM resolution OK:/);
  });

  // ── CJS consumer ──────────────────────────────────────────────────────────

  it("CJS: `require('@matdata/yasgui')` resolves via exports field to the .cjs build", function () {
    const consumerDir = path.join(tmpDir, "cjs-consumer");
    fs.mkdirSync(consumerDir, { recursive: true });
    installPackageIntoConsumer(consumerDir);

    fs.writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify({ name: "cjs-consumer", version: "0.0.0" }),
    );
    // require.resolve() checks the exports field without executing the module.
    fs.writeFileSync(
      path.join(consumerDir, "consumer.cjs"),
      [
        `const resolved = require.resolve("@matdata/yasgui");`,
        `if (!resolved.endsWith(".cjs"))`,
        `  throw new Error("Expected .cjs resolution, got: " + resolved);`,
        `console.log("CJS resolution OK:", resolved.split(/[\\/]/).pop());`,
      ].join("\n"),
    );

    const out = execSync("node consumer.cjs", {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: "pipe",
    });
    expect(out.trim()).to.match(/^CJS resolution OK:/);
  });

  // ── Vite consumer ─────────────────────────────────────────────────────────

  it("Vite: `vite build` succeeds when importing Yasgui and its CSS", function () {
    this.timeout(90_000);
    const consumerDir = path.join(tmpDir, "vite-consumer");
    fs.mkdirSync(consumerDir, { recursive: true });
    installPackageIntoConsumer(consumerDir);

    fs.writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify({ name: "vite-consumer", type: "module", version: "0.0.0" }),
    );
    fs.writeFileSync(
      path.join(consumerDir, "main.js"),
      [
        `import Yasgui from "@matdata/yasgui";`,
        `import "@matdata/yasgui/build/yasgui.min.css";`,
        `export default Yasgui;`,
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(consumerDir, "vite.config.js"),
      [
        `export default {`,
        `  build: {`,
        `    lib: {`,
        `      entry: "./main.js",`,
        `      name: "TestApp",`,
        `      fileName: "test-app",`,
        `      formats: ["es"],`,
        `    },`,
        `    outDir: "./dist",`,
        `  },`,
        `  logLevel: "warn",`,
        `};`,
      ].join("\n"),
    );

    // Use the repo-local Vite via its entry script to avoid shell wrapper
    // differences between platforms.
    const nodeExec = process.execPath;
    const viteScript = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
    execSync(`"${nodeExec}" "${viteScript}" build`, {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: "pipe",
    });

    const distJs = fs.existsSync(path.join(consumerDir, "dist"))
      ? fs.readdirSync(path.join(consumerDir, "dist")).filter((f) => f.endsWith(".js"))
      : [];
    expect(distJs, "dist/ should contain at least one JS file after Vite build").to.have.length.greaterThan(0);
  });
});
