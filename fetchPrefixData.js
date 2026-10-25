#!/usr/bin/env node

/**
 * Fetches the latest prefix data from prefix.cc and writes it to the build directory.
 *
 * The SSL certificate of prefix.cc has historically had issues, so this script uses
 * rejectUnauthorized: false for the HTTPS request as a build-time-only workaround.
 * If the fetch fails entirely, it falls back to the committed file at
 * packages/yasqe/src/prefixes.json so the build never breaks.
 *
 * When a successful fetch occurs, the committed fallback file is also updated so
 * future offline builds stay reasonably fresh.
 *
 * The prefixes of the always included vocabularies of fetchLovData.js (ERA, railML, SPARQL Anything...) are
 * added to the prefix.cc data, replacing prefix.cc's namespace for the same prefix, so they are always available.
 */

import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { ALWAYS_INCLUDED } from "./fetchLovData.js";

const PREFIXES_URL_HTTPS = "https://prefix.cc/popular/all.file.json";
const PREFIXES_URL_HTTP = "http://prefix.cc/popular/all.file.json";
const FALLBACK_FILE = path.join("packages", "yasqe", "src", "prefixes.json");
const OUTPUT_FILE = path.join("build", "prefixes.json");

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;
    const req = client.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, options).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Request timed out")));
  });
}

/** The prefix data with the prefixes of the always included vocabularies, serialized */
function withAlwaysIncluded(prefixes, alwaysIncluded = ALWAYS_INCLUDED) {
  const result = { ...prefixes };
  for (const { prefix, namespace } of alwaysIncluded) {
    if (prefix) result[prefix] = namespace;
  }
  return JSON.stringify(result, null, 2) + "\n";
}

async function main() {
  let data = null;

  // Try HTTPS first (rejectUnauthorized: false because prefix.cc cert may be expired)
  try {
    console.log("Fetching prefix data from prefix.cc (HTTPS)...");
    data = await fetchUrl(PREFIXES_URL_HTTPS, {
      agent: new https.Agent({ rejectUnauthorized: false }),
    });
    console.log("Successfully fetched prefix data via HTTPS.");
  } catch (e) {
    console.warn(`HTTPS fetch failed: ${e.message}`);
  }

  // Fall back to HTTP if HTTPS failed
  if (!data) {
    try {
      console.log("Trying HTTP fallback...");
      data = await fetchUrl(PREFIXES_URL_HTTP);
      console.log("Successfully fetched prefix data via HTTP.");
    } catch (e) {
      console.warn(`HTTP fetch failed: ${e.message}`);
    }
  }

  // Validate the fetched JSON
  if (data) {
    try {
      data = withAlwaysIncluded(JSON.parse(data));
    } catch (e) {
      console.warn("Fetched data is not valid JSON, ignoring and using committed fallback.");
      data = null;
    }
  }

  if (data) {
    // Update the committed fallback so it stays fresh for future offline builds
    fs.writeFileSync(FALLBACK_FILE, data);
    console.log(`Updated committed fallback: ${FALLBACK_FILE}`);
  } else {
    // Use the committed fallback
    if (fs.existsSync(FALLBACK_FILE)) {
      data = withAlwaysIncluded(JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf-8")));
      console.log(`Using committed fallback: ${FALLBACK_FILE}`);
    } else {
      console.error("No fallback file found and all fetches failed. Cannot provide prefix data.");
      process.exit(1);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, data);
  console.log(`Written prefix data to: ${OUTPUT_FILE}`);
}

main().catch((e) => {
  console.error("Fatal error in fetchPrefixData:", e);
  process.exit(1);
});
