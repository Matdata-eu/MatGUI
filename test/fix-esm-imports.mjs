import fs from "fs/promises";
import path from "path";

const repoRoot = process.cwd();
const targetDir = path.join(repoRoot, "build", "test", "packages", "yasgui", "src", "queryManagement");

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(full)));
    else if (ent.isFile() && ent.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function shouldRewrite(spec) {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return false;
  if (spec.endsWith(".js") || spec.endsWith(".json") || spec.endsWith(".node")) return false;
  if (spec.includes("?")) return false;
  return true;
}

function rewriteSource(source, filePath) {
  return source.replace(
    /(\bfrom\s+["'])(\.\.?\/.+?)(["'])/g,
    (match, prefix, spec, suffix) => {
      if (!shouldRewrite(spec)) return match;
      return prefix + spec + ".js" + suffix;
    },
  );
}

// The SPARQL tokenizer imports its generated LL(1) table, a plain JS file that tsc does not emit
async function copyGrammarTable() {
  const grammarDir = path.join("packages", "yasqe", "grammar");
  const destDir = path.join(repoRoot, "build", "test", grammarDir);
  if (!(await exists(destDir))) return;
  await fs.copyFile(path.join(repoRoot, grammarDir, "_tokenizer-table.js"), path.join(destDir, "_tokenizer-table.js"));
}

async function main() {
  await copyGrammarTable();
  if (!(await exists(targetDir))) return;

  const files = await walk(targetDir);
  await Promise.all(
    files.map(async (f) => {
      const src = await fs.readFile(f, "utf8");
      const rewritten = rewriteSource(src, f);
      if (rewritten !== src) await fs.writeFile(f, rewritten, "utf8");
    }),
  );
}

await main();
