import fs from "fs-extra";
import puppeteer, { Browser, Page } from "puppeteer";
import * as http from "http";
import * as path from "path";
import * as Mocha from "mocha";
import _ from "lodash"; // eslint-disable-line
const TEST_ON_DEV_BUILD = !!process.env["TEST_ON_DEV_BUILD"];
const PORT = TEST_ON_DEV_BUILD ? 4000 : 40001;
const MIME_TYPES: { [ext: string]: string } = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};
// Minimal static file server for the puppeteer tests (replaces the unmaintained node-static)
function serveStatic(root: string, request: http.IncomingMessage, response: http.ServerResponse) {
  const urlPath = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  let filePath = path.resolve(root, "." + urlPath);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
  if (!fs.existsSync(filePath)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}

export async function setupServer(buildDir: string): Promise<http.Server | undefined> {
  // to serve the logo for the tests
  const dir = `${buildDir}/`;
  if (!fs.existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.copy("./dev/yasgui.png", `${dir}/yasgui.png`);

  if (TEST_ON_DEV_BUILD) return Promise.resolve(undefined);
  const root = path.resolve(buildDir);
  return new Promise<http.Server>((resolve, reject) => {
    var server = http
      .createServer(function (request, response) {
        serveStatic(root, request, response);
      })
      .listen(PORT, "localhost", () => {
        resolve(server);
      })
      .on("error", (e) => reject(e));
  });
}

export function wait(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
//@ts-ignore ignore unused warning
export async function inspectLive(mocha: Mocha.ISuiteCallbackContext) {
  const waitFor = 9999999;
  mocha.timeout(waitFor);
  console.info(`Go to http://localhost:${PORT}?noExternalServices=true`);
  await wait(waitFor);
}
export async function setup(ctx: Mocha.Context, buildDir: string) {
  ctx.timeout(10000);
  const server = await setupServer(buildDir);
  await fs.emptyDir("./test/screenshots");
  const browser = await puppeteer.launch({
    args: [process.env["NO_SANDBOX"] ? "--no-sandbox" : ""],
    headless: true,
  });
  return { server, browser };
}
export async function destroy(browser: Browser, server?: http.Server) {
  if (browser) await browser.close();
  if (server) server.close();
}
export async function getPage(browser: Browser, path: string, options: { quickStart?: boolean } = {}) {
  const page = await browser.newPage();
  // The quick start tour opens on the first visit and would cover the page; tests that want it pass quickStart
  if (!options.quickStart) {
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem("matgui_quickStart_seen", "1");
      } catch {
        // ignore
      }
    });
  }
  await page.goto(`http://localhost:${PORT}/${path}?noExternalServices=true`, {
    waitUntil: "networkidle2",
    timeout: 30000,
  });

  await Promise.race([
    new Promise((_resolve, reject) => {
      page.once("error", (err) => {
        reject(err);
      });
      page.once("pageerror", (err) => {
        reject(err);
      });
    }),
    page.waitForFunction(() => "yasgui" in window || "yasr" in window || "yasqe" in window || "stories" in window, {
      timeout: 30000,
    }),
  ]);
  page.on("error", (e) => {
    console.error("Error on page: ", e);
  });
  return page;
}
/**
 * Click an element once it is visible. Panels that re-render right after they open can replace the element
 * between finding and clicking it, so a failed click is retried with a fresh element.
 */
export async function clickWhenVisible(page: Page, selector: string, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    await page.waitForSelector(selector, { visible: true });
    try {
      await page.click(selector);
      return;
    } catch (e) {
      if (attempt >= attempts) throw e;
      await wait(100);
    }
  }
}
export function makeScreenshot(page: Page, name?: string) {
  return page.screenshot({ type: "png", path: `./test/screenshots/${name ?? Date.now()}.png` });
}
export async function closePage(suite: Mocha.Suite, page: Page | undefined) {
  if (!page) return;
  const state = suite.ctx.currentTest?.state || "unknown";
  const title = suite.ctx.currentTest?.fullTitle() || "unknown";
  try {
    await makeScreenshot(page, `${state}-${_.kebabCase(title)}`);
  } catch (e) {
    console.error("Failed to take screenshot:", e);
  }
  await page.close();
}
