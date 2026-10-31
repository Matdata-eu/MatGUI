// Reports what the browser bundles (build/<name>.min.js) are made of, and fails when one grows past its budget.
//
//   npm run util:bundleSize            report + budget check
//   npm run util:bundleSize -- --top 40
//
// Budgets are in bytes of minified, uncompressed JavaScript. Raise one deliberately, in the PR that needs it.
import fs from "fs";
import path from "path";
import zlib from "zlib";

const BUDGETS = {
  yasgui: 5_400_000,
  yasqe: 1_800_000,
  yasr: 650_000,
  utils: 60_000,
};

const topArg = process.argv.indexOf("--top");
const TOP = topArg > -1 ? Number(process.argv[topArg + 1]) || 20 : 15;

const kb = (bytes) => `${(bytes / 1024).toFixed(0).padStart(6)} KB`;

/** Group an input path by npm package, or by source folder for our own code */
function groupOf(input) {
  const parts = input.split(/[\\/]/);
  const nm = parts.lastIndexOf("node_modules");
  if (nm > -1) {
    const name = parts[nm + 1].startsWith("@") ? `${parts[nm + 1]}/${parts[nm + 2]}` : parts[nm + 1];
    return name;
  }
  const pkg = parts.indexOf("packages");
  if (pkg > -1) {
    const file = parts.slice(pkg + 1).join("/");
    if (file.endsWith(".json")) return file;
    return `${parts[pkg + 1]} (${parts.slice(pkg + 3, pkg + 4).join("/") || "src"})`;
  }
  return input;
}

let failed = false;
for (const [name, budget] of Object.entries(BUDGETS)) {
  const bundle = path.join("build", `${name}.min.js`);
  const statsFile = path.join("bundle-stats", `${name}.json`);
  if (!fs.existsSync(bundle)) {
    console.error(`${bundle} not found: run "npm run build" first`);
    process.exit(1);
  }
  const size = fs.statSync(bundle).size;
  const gzip = zlib.gzipSync(fs.readFileSync(bundle), { level: 9 }).length;
  const over = size > budget;
  failed ||= over;
  console.log(
    `\n${name}.min.js  ${kb(size)} minified, ${kb(gzip)} gzipped   budget ${kb(budget)}  ${over ? "OVER BUDGET" : "ok"}`,
  );

  if (!fs.existsSync(statsFile)) continue;
  const meta = JSON.parse(fs.readFileSync(statsFile, "utf8"));
  const output = Object.entries(meta.outputs).find(([file]) => file.endsWith(".js"));
  if (!output) continue;
  const groups = new Map();
  for (const [input, { bytesInOutput }] of Object.entries(output[1].inputs)) {
    const group = groupOf(input);
    groups.set(group, (groups.get(group) || 0) + bytesInOutput);
  }
  [...groups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP)
    .forEach(([group, bytes]) =>
      console.log(`  ${kb(bytes)}  ${((bytes / size) * 100).toFixed(1).padStart(5)}%  ${group}`),
    );
}

if (failed) {
  console.error(
    "\nA bundle is over its budget. Look at what grew above, or raise the budget in scripts/bundle-size.mjs.",
  );
  process.exit(1);
}
