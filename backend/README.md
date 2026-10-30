# Local development API

This is an opt-in software integration for the Field Desk. It runs only on
`127.0.0.1`, validates uploaded CSV with the Phase 4 pipeline parser, and stores
reviewed copies in `.local/parcelsense.sqlite3`. It is not a deployed cloud
service and it does not connect to or emulate an STM32 transport.

## Run it

The simplest option is to start both the API and PWA from `frontend/`:

```sh
cd frontend
npm run dev:local
```

Alternatively, run the services separately. Start the backend from the repository root:

```sh
python3 backend/server.py
```

Then start Vite in another terminal:

```sh
cd frontend
npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api` to the loopback backend.
Settings shows whether the API is running. Browser CSV import and review keep
working if the backend is stopped.

## Sample data and routes

`GET /api/demo.csv` creates a deterministic 1,200-row demo CSV on demand. Its
three classes use simple generated sine waves with different amplitudes, based
on the synthetic smoke-test pattern in `tests/ml/test_pipeline.py`. It is a
software fixture only: it was not measured by a sensor and is not evidence of
handling behavior or classifier performance. The filename and session ID both
contain `SYNTHETIC_DEMO_ONLY`.

- `GET /api/health` reports local API status.
- `GET /api/sessions` lists CSV copies stored in the local SQLite database.
- `GET /api/sessions/{id}` returns a stored session and its CSV content.
- `POST /api/sessions` validates and stores a reviewed CSV copy.
- `DELETE /api/sessions/{id}` removes a selected backend copy.

The session detail screen sends only valid rows already accepted by the PWA.
Excluded original rows stay on the user's device. The upload is explicit, and
its provenance must be marked `synthetic`, `real_board`, or `unknown`. A
`real_board` value is an operator declaration and is not independently verified;
synthetic data is marked automatically when the generated demo file is used. The API supports local
development only. Cloudflare Pages hosts a static app and does not run this
SQLite service.

The API accepts browser requests only from the local Vite development origin,
and binds to loopback. It has no account or authentication
layer and must not be exposed on a public interface.

For a non-default Vite port, `PARCELSENSE_DEV_ORIGIN` can add one exact
loopback HTTP origin (for example, `http://127.0.0.1:5180`) to the allowlist.
The server rejects remote hosts, paths, credentials, and origins without a
port in this setting.

## Data location

The default database is `.local/parcelsense.sqlite3`, ignored by Git. To use a
different local path, set `PARCELSENSE_DB_PATH` before starting the server.
Deleting the database removes the local backend copies. Keep source CSV files
separately; the database is not a backup service.

## Checks

From the repository root, run the backend API tests with:

```sh
python3 -m unittest discover -s backend/tests -v
```

Run the Field Desk's client and CSV tests with:

```sh
cd frontend
npm test
npm run typecheck
npm run build
npm run e2e:local-api
npm run e2e:readiness
```

The local API end-to-end command requires Chromium and ChromeDriver. The
readiness command requires Chromium, Firefox, and ChromeDriver; it builds the
production app and checks offline behavior in both browser engines. Test
services, profiles, and data are isolated and removed after each run.
