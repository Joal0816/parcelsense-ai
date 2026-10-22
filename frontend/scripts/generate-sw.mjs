import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = new URL("../dist/", import.meta.url);
const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
};

const files = (await walk(root.pathname))
  .map((file) => relative(root.pathname, file).split(sep).join("/"))
  .filter((file) => file !== "sw.js" && file !== "_headers")
  .sort();
const fingerprint = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 10);
const source = `const CACHE_NAME = "parcelsense-shell-${fingerprint}";
const APP_SHELL = ${JSON.stringify(files.map((file) => `./${file}`))};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("parcelsense-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("./index.html")) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); }
    return response;
  })));
});
`;
await writeFile(new URL("sw.js", root), source);
console.log(`Generated offline app-shell cache for ${files.length} files (${fingerprint}).`);
