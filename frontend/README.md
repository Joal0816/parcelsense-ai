# ParcelSense Field Desk

An optional local-first PWA for reviewing ParcelSense CSV sessions and pipeline evaluation reports. It is separate from STM32 firmware: no board transport, live capture, sensor diagnostics, or classifier is implemented here. An opt-in local development API supports demo data and reviewed CSV copies; it does not imply board connectivity.

## Run locally

Requirements: Node.js 22.12+ (the Vite 8 toolchain requires a recent Node release), npm, and Python 3 for the optional local API.

```sh
cd frontend
npm ci
npm run dev:local
```

This starts the local API and PWA on loopback and stops both with Ctrl+C. Open the URL it prints (normally <http://127.0.0.1:5173>). If that Vite port is already in use, the launcher selects and prints a free local port. The SQLite copy store remains in `.local/parcelsense.sqlite3` between runs. For a frontend-only session, use `npm run dev`; to run each service separately, see [backend instructions](../backend/README.md).

Development mode does not register the service worker; use the production preview to check app-shell caching:

```sh
npm test
npm run build
npm run preview
```

Open <http://127.0.0.1:4173>, allow the first visit to finish caching, then reload once before testing offline. Browser-local IndexedDB is best-effort storage, not a backup. Keep source recordings separately.

For a frontend-only development session, use `npm run dev`. The API is not included in the static Cloudflare Pages deployment.

## Cloudflare Pages

Set the Pages project root to `frontend`, the build command to `npm ci && npm run build`, and the output directory to `dist`. The static `_headers` file applies a restrictive same-origin policy. There are no Pages Functions or server-side data stores in this release. See [the domain and DNS guide](../docs/PWA_DEPLOYMENT.md).

## Current behavior

- Imports UTF-8 CSV using the project schema, validates rows in a Web Worker, shows exclusions and notes, and stores only accepted motion rows plus the review log in IndexedDB.
- Preserves imported cell text for exact-value export and offers a spreadsheet-safe export. Formula protection applies only to text columns so negative sensor values remain numeric.
- Loads pipeline `model.json` reports and shows model type, split counts, confusion matrices, per-class metrics, and explicit unknown provenance when the report lacks origin metadata.
- Caches the static app shell for offline relaunch after a successful production visit.
- Can load a synthetic-only CSV from the local API and explicitly send reviewed valid rows to its local SQLite store.
- Keeps device state unverified and live actions disabled until a physical board and interface are verified.

The current import cap is 25 MiB with a 2 MiB synchronous fallback if Web Workers are unavailable. The cap is intentionally conservative and has not been benchmarked on target phones. Route/session focus, keyboard skip navigation, live connection/import status, larger touch controls, and reduced-motion handling are implemented. Quota recovery copy has a unit test; actual quota pressure, browser eviction, mobile assistive technology, and supported-device field validation remain pending.

Run frontend checks with `npm test`, `npm run typecheck`, and `npm run build`. `npm run e2e:local-api` covers the synthetic browser-to-backend flow in Chromium and requires Chromium plus ChromeDriver. `npm run e2e:readiness` rebuilds the production app and checks semantics, keyboard use in Chromium, responsive layout, and offline reload/navigation in Chromium and Firefox; it requires both browsers and ChromeDriver. Set `CHROME_BIN`, `FIREFOX_BIN`, or `CHROMEDRIVER_BIN` if needed. Browser automation does not replace mobile screen-reader or real storage-pressure testing.
