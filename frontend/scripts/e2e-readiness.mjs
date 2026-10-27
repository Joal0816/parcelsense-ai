import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const viteEntry = path.join(frontendDir, "node_modules/vite/bin/vite.js");
const chromeBinary = process.env.CHROME_BIN ?? ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].find(existsSync);
const driverBinary = process.env.CHROMEDRIVER_BIN ?? "/usr/bin/chromedriver";
const firefoxBinary = process.env.FIREFOX_BIN ?? ["/usr/bin/firefox", "/usr/bin/firefox-esr"].find(existsSync);

for (const [name, file] of [["Vite", viteEntry], ["Chromium", chromeBinary], ["ChromeDriver", driverBinary], ["Firefox", firefoxBinary]]) {
  if (!file || !existsSync(file)) throw new Error(`${name} was not found. Set the corresponding *_BIN environment variable if it is installed elsewhere.`);
}
if (!existsSync(path.join(frontendDir, "dist/index.html")) || !existsSync(path.join(frontendDir, "dist/sw.js"))) {
  throw new Error("Production output is missing. Run npm run build before this check.");
}

const tempDir = await mkdtemp(path.join(tmpdir(), "parcelsense-browser-readiness-"));
const childLogs = new Map();

function capture(child, label) {
  childLogs.set(label, []);
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk) => {
      const tail = childLogs.get(label);
      tail.push(...`${chunk}`.trim().split("\n").filter(Boolean));
      if (tail.length > 25) tail.splice(0, tail.length - 25);
    });
  }
  return child;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitFor(label, check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch (error) { lastError = error; }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(3_000).then(() => { if (child.exitCode === null) child.kill("SIGKILL"); }),
  ]);
}

async function startPreview() {
  const port = await freePort();
  const child = capture(spawn(process.execPath, [viteEntry, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: frontendDir,
    stdio: ["ignore", "pipe", "pipe"],
  }), `preview-${port}`);
  const url = `http://127.0.0.1:${port}/`;
  await waitFor("production preview", async () => (await fetch(url).catch(() => null))?.ok);
  return { child, url };
}

function createChromeDriverClient(baseUrl, sessionId) {
  async function request(method, route, payload) {
    const response = await fetch(new URL(route, baseUrl), {
      method,
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const result = await response.json();
    if (!response.ok || result.value?.error) throw new Error(`ChromeDriver ${method} ${route}: ${JSON.stringify(result.value ?? result)}`);
    return result.value;
  }
  return {
    navigate: (url) => request("POST", `/session/${sessionId}/url`, { url }),
    evaluate: async (expression) => request("POST", `/session/${sessionId}/execute/sync`, { script: `return (${expression});`, args: [] }),
    resize: async (width, height) => request("POST", `/session/${sessionId}/window/rect`, { x: 0, y: 0, width, height }),
    key: (value) => request("POST", `/session/${sessionId}/actions`, { actions: [{
      type: "key", id: "readiness-keyboard", actions: [{ type: "keyDown", value }, { type: "keyUp", value }],
    }] }),
    close: () => request("DELETE", `/session/${sessionId}`),
  };
}

async function startChromium() {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const driver = capture(spawn(driverBinary, [`--port=${port}`], { stdio: ["ignore", "pipe", "pipe"] }), "chromedriver");
  await waitFor("ChromeDriver", async () => (await fetch(`${url}/status`).catch(() => null))?.ok);
  const response = await fetch(`${url}/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ capabilities: { alwaysMatch: {
      browserName: "chrome",
      "goog:chromeOptions": {
        binary: chromeBinary,
        args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=1440,1000"],
      },
    } } }),
  });
  const result = await response.json();
  if (!response.ok || result.value?.error) { await stop(driver); throw new Error(`Could not create Chromium session: ${JSON.stringify(result.value ?? result)}`); }
  return { browser: createChromeDriverClient(url, result.value.sessionId), cleanup: async () => {
    await createChromeDriverClient(url, result.value.sessionId).close().catch(() => {});
    await stop(driver);
  } };
}

function bidiClient(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id === undefined) return;
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    if (message.error) item.reject(new Error(`${message.error}: ${message.message ?? "WebDriver BiDi command failed"}`));
    else item.resolve(message.result);
  });
  return {
    command(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`WebDriver BiDi command timed out: ${method}`));
        }, 15_000);
        pending.set(id, {
          resolve: (value) => { clearTimeout(timeout); resolve(value); },
          reject: (error) => { clearTimeout(timeout); reject(error); },
        });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function connectFirefox(port) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Firefox WebDriver BiDi connection timed out")), 12_000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Firefox WebDriver BiDi connection failed")); }, { once: true });
  });
  return socket;
}

async function startFirefox() {
  const port = await freePort();
  const profile = path.join(tempDir, "firefox-profile");
  await mkdir(profile, { recursive: true });
  const child = capture(spawn(firefoxBinary, ["--headless", "--no-remote", "--remote-debugging-port", String(port), "--profile", profile], {
    stdio: ["ignore", "pipe", "pipe"],
  }), "firefox");
  let socket;
  await waitFor("Firefox WebDriver BiDi", async () => {
    try { socket = await connectFirefox(port); return true; }
    catch { return false; }
  }, 30_000);
  const protocol = bidiClient(socket);
  try {
    await protocol.command("session.new", { capabilities: { alwaysMatch: { browserName: "firefox" } } });
    const tree = await protocol.command("browsingContext.getTree");
    const context = tree.contexts[0]?.context;
    if (!context) throw new Error("Firefox did not create a browsing context");
    const browser = {
      navigate: (url) => protocol.command("browsingContext.navigate", { context, url, wait: "complete" }),
      evaluate: async (expression) => {
        const result = await protocol.command("script.evaluate", {
          expression: `(async () => JSON.stringify(await (${expression})))()`,
          target: { context },
          awaitPromise: true,
          resultOwnership: "none",
        });
        if (result.type !== "success") throw new Error(result.exceptionDetails?.text ?? "Firefox script evaluation failed");
        return result.result?.type === "string" ? JSON.parse(result.result.value) : undefined;
      },
      resize: (width, height) => protocol.command("browsingContext.setViewport", { context, viewport: { width, height } }),
      activate: () => protocol.command("browsingContext.activate", { context }),
      key: (value) => protocol.command("input.performActions", { context, actions: [{
        type: "key", id: "readiness-keyboard", actions: [{ type: "keyDown", value }, { type: "keyUp", value }],
      }] }),
    };
    return { browser, cleanup: async () => {
      await protocol.command("session.end").catch(() => {});
      socket.close();
      await stop(child);
    } };
  } catch (error) {
    socket.close();
    await stop(child);
    throw error;
  }
}

async function visibleAppChecks(label, browser, url) {
  await browser.navigate(url);
  await waitFor(`${label} app render`, async () => (await browser.evaluate("document.querySelector('main h1')?.textContent"))?.length > 0);

  const initial = await browser.evaluate(`(() => {
    const controls = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]')];
    const accessibleName = (element) => {
      const label = element.getAttribute('aria-label');
      if (label?.trim()) return label.trim();
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) return labelledBy.split(/\\s+/).map((id) => document.getElementById(id)?.textContent.trim() ?? '').join(' ').trim();
      const text = element.labels?.length ? [...element.labels].map((node) => node.textContent.trim()).join(' ') : element.innerText || element.textContent;
      return text?.trim() || element.getAttribute('title') || '';
    };
    const duplicateIds = [...document.querySelectorAll('[id]')].map((node) => node.id).filter((id, i, all) => all.indexOf(id) !== i);
    return {
      h1Count: document.querySelectorAll('main h1').length,
      mainCount: document.querySelectorAll('main#main-content').length,
      namedNavigation: Boolean(document.querySelector('nav[aria-label="Workspace sections"]')),
      skipLink: document.querySelector('.skip-link')?.getAttribute('href') === '#main-content',
      unnamedControls: controls.filter((element) => !accessibleName(element)).map((element) => element.outerHTML.slice(0, 160)),
      imagesWithoutAlt: [...document.images].filter((image) => !image.hasAttribute('alt')).length,
      duplicateIds,
    };
  })()`);
  assert.equal(initial.h1Count, 1, `${label}: expected one page heading`);
  assert.equal(initial.mainCount, 1, `${label}: expected a focusable main landmark`);
  assert.equal(initial.namedNavigation, true, `${label}: workspace navigation must be named`);
  assert.equal(initial.skipLink, true, `${label}: skip link must target the main landmark`);
  assert.deepEqual(initial.unnamedControls, [], `${label}: controls need accessible names`);
  assert.equal(initial.imagesWithoutAlt, 0, `${label}: images need alt attributes`);
  assert.deepEqual(initial.duplicateIds, [], `${label}: IDs must be unique`);

  if (label === "Chromium") {
    await browser.evaluate("(() => { window.scrollTo(0, 0); document.activeElement?.blur(); return true; })()");
    await browser.key("\uE004");
    await waitFor("Chromium skip link focus", async () => (await browser.evaluate("document.activeElement?.className"))?.includes("skip-link"));
    await waitFor("Chromium visible skip link", async () => await browser.evaluate(`(() => {
      const rect = document.activeElement.getBoundingClientRect();
      return rect.height >= 44 && rect.top >= 0;
    })()`));
    await browser.key("\uE007");
    await waitFor("Chromium skip link target", async () => (await browser.evaluate("document.activeElement.id")) === "main-content");
    await browser.evaluate(`(() => {
      const item = [...document.querySelectorAll('.nav-item')].find((node) => node.querySelector('.nav-item-copy span')?.textContent.trim() === 'Evaluation');
      item?.focus();
      return Boolean(item);
    })()`);
    await browser.key("\uE007");
  } else {
    await browser.evaluate(`(() => {
      const item = [...document.querySelectorAll('.nav-item')].find((node) => node.querySelector('.nav-item-copy span')?.textContent.trim() === 'Evaluation');
      item?.click();
      return Boolean(item);
    })()`);
  }
  await waitFor(`${label} keyboard page navigation`, async () => (await browser.evaluate("document.querySelector('main h1')?.textContent")) === "Evaluation review");
  if (label === "Chromium") assert.equal(await browser.evaluate("document.activeElement.tagName"), "H1", "Chromium: route changes should focus the page heading");
  console.log(label === "Chromium"
    ? "✓ Chromium: landmarks, control names, IDs, skip link and keyboard navigation"
    : "✓ Firefox: landmarks, control names, IDs and client-side route navigation");

  await browser.evaluate("document.querySelector('.brand')?.click()");
  await waitFor(`${label} overview page`, async () => (await browser.evaluate("document.querySelector('main h1')?.textContent")) === "A clearer view of every handling session.");
  for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 844]]) {
    await browser.resize(width, height);
    await waitFor(`${label} ${width}px viewport`, async () => await browser.evaluate("window.innerWidth") === width);
    const layout = await browser.evaluate(`(() => {
      const nav = [...document.querySelectorAll('.nav-item')].map((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth;
      });
      return { viewport: innerWidth, pageWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), nav };
    })()`);
    assert.equal(layout.pageWidth <= layout.viewport, true, `${label}: horizontal overflow at ${width}px`);
    assert.equal(layout.nav.length, 5, `${label}: expected all five navigation items`);
    assert.equal(layout.nav.every(Boolean), true, `${label}: a navigation item is clipped at ${width}px`);
  }
  await browser.resize(1440, 1000);
  console.log(`✓ ${label}: responsive widths 1440, 768, 390 and 320px without horizontal overflow`);
}

async function offlineShellChecks(label, browser, preview) {
  await waitFor(`${label} offline-ready status`, async () => (await browser.evaluate("document.body.innerText"))?.includes("Offline ready"), 30_000);
  await browser.navigate(preview.url);
  await waitFor(`${label} service worker control`, async () => await browser.evaluate("Boolean(navigator.serviceWorker?.controller)"), 15_000);
  const shellCached = await browser.evaluate(`caches.keys().then(async (keys) => {
    for (const key of keys) if (key.startsWith('parcelsense-shell-') && await (await caches.open(key)).match(new URL('index.html', location.href))) return true;
    return false;
  })`);
  assert.equal(shellCached, true, `${label}: app shell HTML should be cached before offline use`);

  await stop(preview.child);
  await browser.navigate(preview.url);
  await waitFor(`${label} offline reload`, async () => (await browser.evaluate("document.querySelector('main h1')?.textContent")) === "A clearer view of every handling session.");
  assert.equal(await browser.evaluate("Boolean(navigator.serviceWorker?.controller)"), true, `${label}: app should remain service-worker controlled offline`);
  assert.equal((await browser.evaluate("document.body.innerText")).includes("Load synthetic sample"), false, `${label}: production build must not expose development API controls`);
  await browser.evaluate(`(() => {
    const item = [...document.querySelectorAll('.nav-item')].find((node) => node.querySelector('.nav-item-copy span')?.textContent.trim() === 'Device status');
    item?.click();
    return true;
  })()`);
  await waitFor(`${label} offline client navigation`, async () => (await browser.evaluate("document.querySelector('main h1')?.textContent")) === "Device status");
  console.log(`✓ ${label}: production app shell reloads and navigates with the preview server stopped`);
}

async function runBrowser(label, startBrowser) {
  const preview = await startPreview();
  let instance;
  try {
    instance = await startBrowser();
    await visibleAppChecks(label, instance.browser, preview.url);
    await offlineShellChecks(label, instance.browser, preview);
  } finally {
    if (instance) await instance.cleanup();
    await stop(preview.child);
  }
}

try {
  await runBrowser("Chromium", startChromium);
  await runBrowser("Firefox", startFirefox);
  console.log("✓ browser readiness checks passed");
} catch (error) {
  const logs = [...childLogs].map(([name, lines]) => `\n${name}:\n${lines.join("\n")}`).join("");
  console.error(`${error.stack ?? error}${logs}`);
  process.exitCode = 1;
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
