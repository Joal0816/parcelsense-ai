import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(frontendDir, "..");
const viteEntry = path.join(frontendDir, "node_modules/vite/bin/vite.js");
const databasePath = process.env.PARCELSENSE_DB_PATH ?? path.join(repoDir, ".local/parcelsense.sqlite3");
const requestedApiPort = Number(process.env.PARCELSENSE_API_PORT ?? 8000);
const requestedFrontendPort = Number(process.env.PARCELSENSE_FRONTEND_PORT ?? 5173);
const children = [];

if (!existsSync(viteEntry)) throw new Error("Vite is not installed. Run npm ci in frontend/ first.");
if (!Number.isInteger(requestedApiPort) || requestedApiPort < 1 || requestedApiPort > 65535) throw new Error("PARCELSENSE_API_PORT must be a valid TCP port.");
if (!Number.isInteger(requestedFrontendPort) || requestedFrontendPort < 1 || requestedFrontendPort > 65535) throw new Error("PARCELSENSE_FRONTEND_PORT must be a valid TCP port.");

async function isPortAvailable(port) {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    return true;
  } catch {
    server.close(() => {});
    return false;
  }
}

async function findFreePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function selectPort(requested, envName, reserved = new Set(), allowFallback = false) {
  if (await isPortAvailable(requested) && !reserved.has(requested)) return requested;
  if (process.env[envName] || !allowFallback) throw new Error(`Port ${requested} is unavailable. Stop its service or choose another ${envName}.`);
  let port;
  do { port = await findFreePort(); } while (reserved.has(port));
  console.log(`Port ${requested} is already in use; using ${port} for this run.`);
  return port;
}

function start(command, args, options) {
  const child = spawn(command, args, { stdio: "inherit", ...options });
  child.once("error", (error) => { console.error(`Could not start ${command}: ${error.message}`); void shutdown(1); });
  child.once("exit", (code, signal) => {
    if (!stopping) {
      console.error(`${command} stopped (${signal ?? code ?? "unknown status"}); stopping the other service.`);
      void shutdown(typeof code === "number" ? code || 1 : 1);
    }
  });
  children.push(child);
  return child;
}

let stopping = false;
let shutdownPromise;
function shutdown(code = 0) {
  if (shutdownPromise) return shutdownPromise;
  stopping = true;
  shutdownPromise = (async () => {
    for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
    await Promise.all(children.map((child) => new Promise((resolve) => {
      if (child.exitCode !== null) { resolve(); return; }
      child.once("exit", resolve);
      setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 3_000).unref();
    })));
    process.exitCode = code;
  })();
  return shutdownPromise;
}

process.on("SIGINT", () => { void shutdown(0); });
process.on("SIGTERM", () => { void shutdown(0); });

try {
  const backendPort = await selectPort(requestedApiPort, "PARCELSENSE_API_PORT");
  const frontendPort = await selectPort(requestedFrontendPort, "PARCELSENSE_FRONTEND_PORT", new Set([backendPort]), true);
  const apiTarget = `http://127.0.0.1:${backendPort}`;
  const appOrigin = `http://127.0.0.1:${frontendPort}`;

  const python = process.env.PYTHON ?? "python3";
  start(python, ["backend/server.py", "--port", String(backendPort)], {
    cwd: repoDir,
    env: { ...process.env, PARCELSENSE_DEV_ORIGIN: appOrigin },
  });

  const deadline = Date.now() + 15_000;
  let healthy = false;
  while (Date.now() < deadline) {
    if (children[0].exitCode !== null) throw new Error("The local API stopped before becoming ready.");
    healthy = (await fetch(`${apiTarget}/api/health`).catch(() => null))?.ok ?? false;
    if (healthy) break;
    await delay(200);
  }
  if (!healthy) throw new Error(`Local API did not become ready on 127.0.0.1:${backendPort}.`);

  const vite = start(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"], {
    cwd: frontendDir,
    env: { ...process.env, PARCELSENSE_API_TARGET: apiTarget },
  });
  const viteDeadline = Date.now() + 15_000;
  let appReady = false;
  while (Date.now() < viteDeadline) {
    if (vite.exitCode !== null) throw new Error("Vite stopped before the app became ready.");
    appReady = (await fetch(appOrigin).catch(() => null))?.ok ?? false;
    if (appReady) break;
    await delay(200);
  }
  if (!appReady) throw new Error(`Field Desk did not become ready at ${appOrigin}.`);

  console.log(`\nParcelSense is ready at ${appOrigin}`);
  console.log(`Local API: loopback only; reviewed copies are stored in ${databasePath}.`);
  console.log("Press Ctrl+C to stop both services.");
  await new Promise((resolve) => children.forEach((child) => child.once("exit", resolve)));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  await shutdown(1);
}
