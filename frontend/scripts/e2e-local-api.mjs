import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(frontendDir, "..");
const viteEntry = path.join(frontendDir, "node_modules/vite/bin/vite.js");
const chromeBinary = process.env.CHROME_BIN ?? ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"]
  .find((candidate) => existsSync(candidate));
const driverBinary = process.env.CHROMEDRIVER_BIN ?? "/usr/bin/chromedriver";

if (!existsSync(viteEntry)) throw new Error("Vite is not installed. Run npm install in frontend/ first.");
if (!chromeBinary || !existsSync(chromeBinary)) throw new Error("Chromium was not found. Set CHROME_BIN to its executable path.");
if (!existsSync(driverBinary)) throw new Error("ChromeDriver was not found. Set CHROMEDRIVER_BIN to its executable path.");

const children = [];
const logs = new Map();
let driverUrl;
let sessionId;
let tempDir;

function capture(child, name) {
  children.push(child);
  logs.set(name, []);
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk) => {
      const lines = `${chunk}`.trim().split("\n").filter(Boolean);
      const tail = logs.get(name);
      tail.push(...lines);
      if (tail.length > 30) tail.splice(0, tail.length - 30);
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

async function waitFor(description, check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch (error) { lastError = error; }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
}

async function webdriver(method, route, payload) {
  const response = await fetch(new URL(route, driverUrl), {
    method,
    headers: payload ? { "content-type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json();
  if (!response.ok || result.value?.error) {
    throw new Error(`WebDriver ${method} ${route} failed: ${JSON.stringify(result.value ?? result)}`);
  }
  return result.value;
}

async function evaluate(script) {
  return webdriver("POST", `/session/${sessionId}/execute/sync`, { script, args: [] });
}

async function clickNav(name) {
  const clicked = await evaluate(`return (() => {
    const item = [...document.querySelectorAll('.nav-item')].find((node) => node.querySelector('.nav-item-copy span')?.textContent.trim() === ${JSON.stringify(name)});
    if (!item) return false;
    item.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not find ${name} navigation`);
}

async function clickButton(label) {
  const clicked = await evaluate(`return (() => {
    const button = [...document.querySelectorAll('button')].find((node) => node.textContent.trim() === ${JSON.stringify(label)});
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true, `Could not click the “${label}” button`);
}

async function bodyText() {
  return evaluate("return document.body.innerText");
}

function announce(message) { console.log(`✓ ${message}`); }

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(3_000).then(() => { if (child.exitCode === null) child.kill("SIGKILL"); }),
  ]);
}

try {
  const [apiPort, frontendPort, chromeDriverPort] = await Promise.all([freePort(), freePort(), freePort()]);
  const origin = `http://127.0.0.1:${frontendPort}`;
  driverUrl = `http://127.0.0.1:${chromeDriverPort}`;
  tempDir = await mkdtemp(path.join(tmpdir(), "parcelsense-local-api-e2e-"));

  const backend = capture(spawn("python3", ["backend/server.py", "--port", String(apiPort)], {
    cwd: repoDir,
    env: {
      ...process.env,
      PARCELSENSE_DB_PATH: path.join(tempDir, "test.sqlite3"),
      PARCELSENSE_DEV_ORIGIN: origin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  }), "backend");
  const frontend = capture(spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"], {
    cwd: frontendDir,
    env: { ...process.env, PARCELSENSE_API_TARGET: `http://127.0.0.1:${apiPort}` },
    stdio: ["ignore", "pipe", "pipe"],
  }), "frontend");
  const driver = capture(spawn(driverBinary, [`--port=${chromeDriverPort}`], {
    cwd: repoDir,
    stdio: ["ignore", "pipe", "pipe"],
  }), "chromedriver");

  await waitFor("backend health", async () => (await fetch(`http://127.0.0.1:${apiPort}/api/health`).catch(() => null))?.ok);
  await waitFor("Vite development server", async () => (await fetch(origin).catch(() => null))?.ok);
  await waitFor("ChromeDriver", async () => (await fetch(`${driverUrl}/status`).catch(() => null))?.ok);
  const session = await webdriver("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        "goog:chromeOptions": {
          binary: chromeBinary,
          args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--window-size=1440,1100"],
        },
      },
    },
  });
  sessionId = session.sessionId;
  await webdriver("POST", `/session/${sessionId}/url`, { url: origin });
  await waitFor("Field Desk to render", async () => (await bodyText()).includes("ParcelSense"));
  await waitFor("local API connection status", async () => (await bodyText()).includes("No device connected"));
  announce("PWA started against an isolated SQLite database");

  await clickNav("Data sessions");
  await waitFor("synthetic sample control", async () => (await bodyText()).includes("Load synthetic sample"));
  await clickButton("Load synthetic sample");
  await waitFor("review dialog", async () => Boolean(await evaluate("return Boolean(document.querySelector('[role=dialog]'))")));
  const reviewText = await bodyText();
  assert.match(reviewText, /SYNTHETIC_DEMO_ONLY\.csv/);
  assert.match(reviewText, /VALID ROWS[\s\S]*1,200/);
  await clickButton("Save reviewed import");
  await waitFor("saved session review", async () => (await bodyText()).includes("Send reviewed copy"));
  assert.match(await bodyText(), /Synthetic data provenance/);
  announce("synthetic CSV loaded, reviewed, and saved in browser storage");

  await clickButton("Send reviewed copy");
  await waitFor("backend upload confirmation", async () => (await bodyText()).includes("reviewed rows copied to the local backend"));
  assert.match(await bodyText(), /synthetic test data/);
  announce("explicit reviewed copy stored by the local API with synthetic provenance");

  await clickNav("Settings");
  await waitFor("backend copy in Settings", async () => (await bodyText()).includes("SYNTHETIC_DEMO_ONLY.csv"));
  assert.match(await bodyText(), /1,200 rows · Synthetic test data/);
  await evaluate(`return (() => {
    window.confirm = () => true;
    const button = document.querySelector('[aria-label="Delete SYNTHETIC_DEMO_ONLY.csv from the local backend"]');
    if (!button) throw new Error('Backend delete control not found');
    button.click();
    return true;
  })()`);
  await waitFor("backend copy deletion", async () => (await bodyText()).includes("STORED COPIES\n0"));
  assert.doesNotMatch(await bodyText(), /SYNTHETIC_DEMO_ONLY\.csv/);
  announce("backend copy deleted while the browser-local import remains available");

  await clickNav("Data sessions");
  await waitFor("browser-local import to remain", async () => (await bodyText()).includes("SYNTHETIC_DEMO_ONLY.csv"));
  announce("backend copy deletion preserved the browser-local import");

  await stop(backend);
  await clickNav("Settings");
  await clickButton("Check connection");
  await waitFor("stopped backend status", async () => (await bodyText()).includes("NOT RUNNING"));
  await clickNav("Data sessions");
  await waitFor("browser workflow with the backend stopped", async () => (await bodyText()).includes("SYNTHETIC_DEMO_ONLY.csv"));
  announce("browser-local review remains available when the local API is stopped");
  announce("end-to-end local API flow passed");
} catch (error) {
  const details = [...logs].map(([name, lines]) => `\n${name}:\n${lines.join("\n")}`).join("");
  console.error(`${error.stack ?? error}${details}`);
  process.exitCode = 1;
} finally {
  if (sessionId && driverUrl) {
    await fetch(new URL(`/session/${sessionId}`, driverUrl), { method: "DELETE" }).catch(() => {});
  }
  for (const child of children.reverse()) await stop(child);
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
}
