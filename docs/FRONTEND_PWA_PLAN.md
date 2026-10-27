# ParcelSense Companion Frontend and PWA Plan

**Status: Initial F1–F3 companion implementation available in `frontend/`; an opt-in loopback API prototype is available under `backend/`; field validation remains open.** The local-first shell, CSV review, browser storage/export, pipeline report view, and explicit reviewed-copy API flow are implemented as a separate companion product. The development API can generate synthetic demo data and store reviewed copies in local SQLite. PWA install/offline behavior and supported-device accessibility still require validation. Board-to-browser transport, live capture, and hardware diagnostics are not implemented; this does not change the six embedded-system phases or claim board connectivity. The embedded classifier remains the primary product and must operate without this PWA.

## Purpose and product boundary

The proposed ParcelSense Companion is an installable, offline-capable web application for reviewing device status, organizing capture sessions, importing and inspecting CSV data, and viewing evaluation reports. It may later provide a live operator interface if the board exposes a verified communication interface. It must never be required for sampling, inference, or local feedback on the STM32.

The first usable version should work without a board connection: users can import a CSV using the documented [dataset schema](../ml/data/SCHEMA.md), inspect data and exclusions, and export their reviewed files. Local backend copies are optional and remain on the development computer; synthetic demo data is visibly marked and must not be treated as board evidence. Live capture/control is a later, optional capability behind a hardware verification gate. The proposed [capture protocol](../ml/data/CAPTURE_PROTOCOL.md) still requires board and instructor review.

## Goals

- Provide a clear, mobile-friendly companion experience that works after installation without a network connection.
- Make the current device/data state explicit: disconnected, no data, imported data, verified live session, or error.
- Import and validate the project CSV format; show malformed rows and exclusions without silently changing labels or sensor values.
- Review session/trial metadata, class balance, sensor status, and data quality before export or analysis.
- Display evaluation results from the host pipeline with class order, split provenance, data counts, and clear synthetic-versus-real provenance.
- Keep experiment data local by default and provide explicit export and deletion controls.
- Allow an explicit upload of validated rows to a loopback-only development API; keep backend integration independent from device status and inference.
- Preserve accessible operation on small screens, with keyboard and assistive-technology support.

## Out of scope for the first release

- Replacing or controlling embedded inference.
- Creating class labels from model predictions or claiming operational thresholds.
- Training a model in the browser; training and model export stay in the documented host pipeline initially.
- Cloud accounts, cloud synchronization, analytics, remote firmware updates, or public data sharing.
- A deployed API service or a backend dependency for the hosted static app.
- Assuming Bluetooth, USB serial, Wi-Fi, UART, pins, or any particular board transport. The board's installed communication hardware and protocol are unverified.
- Treating a PWA browser runtime as equivalent to on-device offline operation.

## Proposed information architecture

| Screen | Purpose and primary content |
|---|---|
| **Overview** | Device connection state, last imported session, data-origin badge, current project limitations, and shortcuts to import/review. With no verified connection, clearly show “Board not connected” rather than simulated live values. |
| **Capture** | Initially a protocol checklist and session metadata form. Start/stop capture controls remain disabled until a real transport, safe procedure, and board diagnostics are verified. |
| **Data** | Import CSV, browse sessions and trials, inspect timestamps/axes/status/labels, see validation errors and exclusions, filter by class, and export a reviewed copy. |
| **Evaluation** | Load a pipeline report and show confusion matrix, per-class precision/recall/F1, macro-F1, split groups, counts, and model type. Prominently distinguish synthetic smoke-test output from real held-out board results. |
| **Diagnostics** | Show only verified device/module facts. Unknown hardware remains “Unverified”; no UI placeholder may imply a sensor test ran. |
| **Settings and privacy** | Offline/install status, local data inventory, export/delete actions, units and display preferences, and version/schema information. |

Navigation should remain shallow: Overview, Capture, Data, Evaluation, Diagnostics, Settings. Pages should show a useful empty state and next action rather than fabricated sample measurements.

## Key user workflows

### 1. First launch without a board

1. Open or install the PWA and see that the app shell is available offline.
2. Read the project status and board/data limitations.
3. Import a CSV or evaluation JSON generated by the host pipeline.
4. Review schema errors, invalid rows, trial grouping, labels, and provenance.
5. Export a reviewed copy or delete local records.

An optional local-development workflow can generate the clearly marked synthetic CSV through the loopback API and explicitly store reviewed valid rows in its SQLite database. See [backend instructions](../backend/README.md). This is software integration evidence only; it does not verify sensor data or board connectivity.

No connection prompt should appear as a blocker to these file-based workflows.

### 2. Board-backed capture, after hardware verification

1. Confirm board identity/revision, verified modules, diagnostics, and approved capture protocol.
2. Create an opaque session ID and trial IDs; select the operator-approved label and non-identifying trial metadata.
3. Show sensor readiness and clear start/stop/error status before enabling capture.
4. Capture through a separately verified transport adapter; visibly count valid/invalid samples and dropped data.
5. Review the resulting session, then save/export the original data and validation report.

If the connection drops, stop or mark the trial according to the verified protocol; never silently join data across a gap. The exact recovery behavior must be designed after transport and firmware semantics are known.

### 3. Evaluation review

1. Load a report produced by `ml/scripts/pipeline.py`.
2. Show label order, model type, feature order/version, split seed and trial groups, data counts, and exclusions.
3. Place a persistent provenance banner above all metrics: `Synthetic smoke test`, `Real board data`, or `Provenance unknown`.
4. Do not present synthetic metrics as product accuracy. Require an explicit warning when a report lacks sufficient provenance.

## Technical architecture proposal

### Suggested application stack

Use a small TypeScript PWA with a component-based UI, static build output, and service-worker-managed app-shell caching. The user selected Vite + React + TypeScript. Review current package maintenance, licensing, and security before adding dependencies.

Proposed repository boundary: a top-level `frontend/` directory containing the app, tests, and its own build documentation, separate from the optional `backend/` local development API. Neither component is added to the firmware PlatformIO source or target image. The user selected localhost and hosted HTTPS use, with Cloudflare Pages as the hosted target. The recommended hostname is `parcelsense.joalvergs.tech`; DNS setup is documented in [PWA deployment](PWA_DEPLOYMENT.md). The app's file workflows and hosted build do not require a backend.

### Layers

1. **Presentation:** route/page components, accessible forms and tables, status/provenance banners, and responsive layouts.
2. **Application logic:** import/review/export workflows and explicit state transitions (idle, validating, ready, capturing, disconnected, error).
3. **Domain model:** versioned session, trial, sample, diagnostic, and evaluation-report types. Reuse field names and units from `ml/data/SCHEMA.md`; maintain one source of truth for label order.
4. **Adapters:** CSV parser/exporter, evaluation JSON reader, browser persistence, and a future `DeviceTransport` interface.
5. **PWA shell:** manifest, service worker, offline fallback, app-shell cache, and update notification.

The first transport adapter is file import/export. A later live adapter must implement an explicit capability contract and return verified connection state, data frames, disconnect/error events, and protocol version. Keep it behind the application boundary: screens consume normalized session/sample events and do not contain transport-specific logic. File import, review, evaluation, and export must work with no device adapter. Select USB/Bluetooth/etc. only after the RT-Spark board revision, firmware support, and target browsers have been verified. Do not build a speculative transport into the initial release.

### Local persistence and offline behavior

- Cache the static application shell and versioned UI assets so previously installed app screens open offline.
- Show **Offline ready** only after the app shell has been successfully cached. Distinguish first-load, update-in-progress, cache-failed, and offline-ready states. If first load or caching fails, explain that offline launch is not ready and offer retry when online.
- Store user-selected sessions and reports in browser-local structured storage (IndexedDB is the leading option); keep large recordings out of transient component state.
- Keep raw data out of service-worker caches and network requests. Do not upload, synchronize, or include analytics by default.
- Show storage usage/retention limitations when the browser exposes them. The app may request persistent storage, but must report whether the request is unsupported, denied, or granted and must not imply local records are guaranteed to survive device cleanup.
- On a quota/write failure, keep the source file untouched, preserve successfully saved records, explain what was not saved, and offer export/free-space/retry actions. Never remove older data automatically to make room.
- If local records are missing after browser reset or eviction, show a recovery state with instructions to re-import the user's saved source file. Never reconstruct or fabricate records.
- Let the user export before deletion and delete one session or all local project data.
- Treat browser storage as best-effort, not as the authoritative archive. Preserve original CSV separately at the user's direction.
- Apply service-worker updates deliberately and explain when a new app version will take effect; do not discard in-progress review state. If update installation or cache migration fails, retain the last working shell where possible and provide a retry path.

Offline acceptance means the installed app shell and previously saved local records remain usable with network access disabled. It does not mean a disconnected browser can receive new samples from the STM32.

## Data and provenance rules

- The CSV schema in `ml/data/SCHEMA.md` is canonical for imported motion records. Keep units and class spelling intact.
- Assign opaque identifiers; do not request names, contact information, or other personal identifiers.
- Preserve source files and report import corrections as a separate derived view. Never silently overwrite source data.
- Mark imported records with source filename, import time, schema version, validation outcome, and user-visible provenance; avoid exposing local absolute paths unnecessarily.
- Evaluation screens must retain split grouping and real/synthetic provenance from reports. If origin is missing, display “Unknown”; do not infer real data from file names.
- CSV export must neutralize spreadsheet formula prefixes in text fields or warn and produce a safe export, while retaining a way to preserve exact source values.
- Parse large imports incrementally or in a Web Worker so parsing does not block interaction; provide progress, cancellation, and a clear partial-import policy. Establish a tested file-size/row-count limit on supported target devices before release. If streaming/Worker support is unavailable, enforce a smaller synchronous limit and explain it before processing.

## Failure states and recovery behavior

| Trigger | User-visible behavior | Recovery rule |
|---|---|---|
| First launch while offline before the shell was cached | Explain that the app is not yet offline-ready; show a retry state instead of a broken screen. | Open once while online to finish caching, then verify the offline-ready indicator. |
| Service-worker cache or update fails | Keep the current page usable if possible and identify the app version/update state. | Retry later; never clear the last working cache or abandon an in-progress review silently. |
| CSV has unsupported schema or malformed rows | Show file-level errors separately from row exclusions, including line and reason where available. | Let the user cancel or import valid portions only after showing the proposed exclusion count; retain the untouched original file. |
| CSV exceeds tested device limits | Reject before expensive processing or offer incremental processing with progress and cancellation. | Do not freeze the interface or claim a partial import is complete. |
| Local storage quota is exceeded or a write fails | Identify unsaved session/report data and offer export, user-selected deletion, and retry. | Never remove existing records automatically to make room. |
| Browser storage was cleared or evicted | Show that local records are unavailable and explain re-import from the user's saved source file. | Do not infer or recreate previously stored samples. |
| Device transport disconnects or sends invalid frames (if F4 is built) | Mark connection and affected trial state; show last confirmed sample time and an explicit fault. | Apply only the board-verified stop/resume policy; do not join records across a gap without a protocol rule. |
| Report provenance is absent or inconsistent | Mark provenance as unknown and warn before displaying metrics. | Do not describe results as real board performance. |

For spreadsheet use, offer two clearly named exports when needed: **exact data export** and **spreadsheet-safe export**. The safe version detects text cells beginning with formula prefixes such as `=`, `+`, `-`, or `@`, neutralizes them under a documented rule, and tells the user the exported representation changed. Keep original imported values available in the app and provide exact export for analysis workflows.

## UX, accessibility, and visual direction

- Design mobile-first, then support tablet and desktop review layouts.
- Use plain status language and text labels alongside color; never encode Stable/Normal/Rough or sensor faults by color alone.
- Support keyboard-only navigation, visible focus, logical headings, labeled controls, table headers, screen-reader announcements for import/errors, and reduced motion preferences.
- Keep destructive actions (delete all, discard edits) explicit and recoverable where possible.
- Separate **device state**, **data quality**, and **classifier result** into different visual groups so a valid prediction cannot hide a sensor fault.
- Display units beside sensor values and show missing/invalid values explicitly; do not substitute zero for absent readings.
- Use restrained motion and high-contrast status treatments suited to an engineering tool; no visual styling should imply a measurement is verified when it is not.

## Security and privacy requirements

- No authentication or publicly hosted data store. The optional loopback development API stores only CSV copies a user explicitly submits.
- No telemetry, third-party trackers, remote fonts, or external API calls in the offline workflow.
- Treat CSV and JSON files as untrusted input: validate schema, types, lengths, nesting depth, and numeric ranges; render imported strings as text, never as executable HTML.
- Avoid logging sample contents or sensitive local metadata to the console.
- Define a restrictive content-security policy for the eventual static deployment and review all dependencies before release.
- Ensure file exports do not unintentionally expose local paths or personal metadata.
- Document that local browser storage may be cleared by the browser/device and is not encrypted or backed up by this app unless a later design explicitly implements that behavior.

## Delivery milestones and gates

| Milestone | Scope | Exit criteria |
|---|---|---|
| **F0 — Product and protocol design** | Confirm audience, screen flows, canonical data types, privacy choices, and supported browser/device targets. | Reviewed UI sketches, CSV/report contracts, and no unresolved assumptions presented as facts. |
| **F1 — Offline shell** | Create frontend app shell, navigation, status/empty states, install metadata, and app-shell service worker. | Builds locally; launches offline after first load; core workflows have no backend or external runtime dependency; accessible keyboard navigation. |
| **F2 — File workspace** | CSV import, validation, session/trial review, exclusions, local persistence, export/delete. | Tests cover valid, malformed, oversized, invalid-sample, unknown-label, and conflicting-trial input; original data remains unchanged. |
| **F3 — Evaluation reports** | Read pipeline JSON and present results/provenance clearly. | Fixtures verify label order, metric values, missing metrics, synthetic warning, and unknown provenance behavior. No performance claim from synthetic fixtures. |
| **Local API prototype** | Optional loopback API, deterministic synthetic CSV endpoint, CSV validation, SQLite reviewed-copy storage. | API remains local-only; uploads are explicit; provenance is recorded; synthetic values are identified as fixtures; no hardware link is claimed. |
| **F4 — Verified device transport (optional)** | Implement a transport adapter only after board/firmware protocol and browser compatibility are known. | Board revision and transport are documented; connect/disconnect/fault behavior is tested; live data matches firmware logs and schema. |
| **F5 — Field validation and release** | User testing, offline/update checks, privacy/accessibility review, and reproducible static release. | Offline use, storage quota/eviction recovery, data deletion/export, supported browser/device matrix, accessibility checks, and release artifacts documented. |

## Test and acceptance plan

- **Unit:** schema parsing, timestamp wrap/gap handling, label validation, provenance, report parsing, and safe export.
- **Integration:** import → inspect → persist → reload offline → export; report import → evaluation rendering; delete one/all sessions.
- **PWA:** install/update lifecycle, first-load and repeat-load offline behavior, cache version changes, and recovery from interrupted updates.
- **Storage and scale:** representative file sizes on supported mobile/desktop devices, quota failures, browser-cleared storage, canceled large imports, and recovery without losing the source file.
- **Security:** malformed/large files, HTML/script-like strings, spreadsheet formula fields, no unexpected network requests, and storage deletion.
- **Accessibility:** keyboard walkthrough, screen-reader labels and announcements, focus order, contrast, zoom/reflow, and non-color status communication.
- **Transport, if later added:** permission denial, unavailable API, connect/disconnect, malformed frame, timestamp gap, sensor fault, and interrupted trial against actual board evidence.
- Keep browser-based tests separate from firmware host tests. Automated fixtures must be visibly marked synthetic and must never be stored in production dataset directories.

## Risks and unresolved decisions

| Risk or unknown | Plan |
|---|---|
| No board is currently available; its communication capabilities are unknown | Keep file workflows first; leave live capture disabled until hardware and protocol are verified. |
| Actual labels and safe handling actions need instructor approval | Use the documented draft protocol; do not put force thresholds or unsafe trial instructions into the UI. |
| Browser storage limits and eviction vary | Report persistence request state and storage limits when available, provide export/deletion/re-import recovery, and avoid promising archival durability. |
| Large CSV parsing can block a mobile browser | Use incremental/Worker parsing with progress and cancellation; benchmark representative real files on each supported target and enforce a tested fallback limit. |
| Evaluation report schema may evolve | Version the report and reject unsupported versions with actionable errors. |
| PWA install, cache behavior, and device APIs differ by platform | Choose supported browser/device combinations during F0; test install, offline cache, storage pressure, and file behavior on each; keep core file workflows independent of optional APIs. |
| Embedded and PWA status may be confused | Keep device state, sensor/data quality, and model output separate and provenance-marked. |

## Immediate next steps

The current software pass adds a skip link, visible programmatic route/session focus, live connection and import-progress semantics, 44 px primary controls, and a reduced-motion override. Unit tests cover quota-error recovery copy, and `cd frontend && npm run e2e:local-api` verifies the synthetic browser-to-local-API flow in Chromium. Previously recorded keyboard, accessibility-tree, contrast, reflow, and offline checks are in `docs/PROGRESS.md`; they do not complete mobile screen-reader or real quota-pressure validation.

1. Validate import → review → persist → reload → export/delete with representative board CSVs when available; no board CSV is currently available.
2. Complete screen-reader, supported-browser/device, browser-cleared storage, and real quota-pressure validation before declaring F5 field acceptance.
3. Keep all live device transport disabled until board revision, firmware protocol, and browser compatibility are verified. The board-arrival and firmware evidence gates remain in `docs/BOARD_ARRIVAL_CHECKLIST.md` and Phases 3–6 of the embedded roadmap.
