import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const baseUrl = new URL(process.env.PARCELSENSE_PRODUCTION_URL ?? "https://parcelsense.joalvergs.tech/");
if (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseUrl.hostname))) {
  throw new Error("Production verification requires HTTPS (HTTP is allowed for loopback checks).");
}

const expectedHtml = await readFile(path.join(frontendDir, "dist/index.html"), "utf8");
const assetReferences = [...expectedHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((value) => new URL(value, baseUrl).pathname.includes("/assets/"));
assert.ok(assetReferences.length >= 2, "Expected built JavaScript and CSS references are missing.");

async function getReady(url) {
  let lastStatus = "no response";
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "follow" });
      if (response.status === 200) return response;
      lastStatus = `HTTP ${response.status}`;
    } catch (error) {
      lastStatus = error.message;
    }
    if (attempt < 11) await delay(5_000);
  }
  throw new Error(`${url} did not become available after 12 attempts: ${lastStatus}`);
}

const indexResponse = await getReady(baseUrl);
const liveHtml = await indexResponse.text();
assert.ok(liveHtml.includes("ParcelSense — Field Desk"), "Production root did not return the ParcelSense app shell.");
for (const reference of assetReferences) {
  const assetUrl = new URL(reference, baseUrl);
  assert.ok(liveHtml.includes(reference), `Production HTML does not reference the tested bundle asset ${reference}.`);
  await getReady(assetUrl);
  console.log(`✓ ${assetUrl.pathname} returned HTTP 200`);
}

if (baseUrl.protocol === "https:") {
  for (const requiredHeader of ["content-security-policy", "x-content-type-options"]) {
    assert.ok(indexResponse.headers.has(requiredHeader), `Production response is missing ${requiredHeader}.`);
  }
} else {
  console.log("! Security headers are provided by the production host and are not present on Vite preview.");
}

const manifestReference = [...liveHtml.matchAll(/<link\s+rel="manifest"\s+href="([^"]+)"/g)][0]?.[1];
assert.ok(manifestReference, "Production app shell does not link its install manifest.");
const manifestResponse = await getReady(new URL(manifestReference, baseUrl));
const manifest = await manifestResponse.json();
assert.equal(manifest.name, "ParcelSense Field Desk");
assert.equal(manifest.display, "standalone");
const serviceWorker = await getReady(new URL("sw.js", baseUrl));
const serviceWorkerSource = await serviceWorker.text();
for (const reference of assetReferences) {
  assert.ok(serviceWorkerSource.includes(reference), `Service worker does not cache the tested bundle asset ${reference}.`);
}

console.log(`✓ production app shell, manifest, service worker, security headers, and ${assetReferences.length} tested bundle assets are available at ${baseUrl.origin}`);
