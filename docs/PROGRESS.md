# Progress

## Current status

**Phase 1 — Initialization: complete. Phase 2 — Firmware foundation: software build complete. Phase 3 — Sensor interfaces: software interfaces complete. Phase 4 — Host ML pipeline: software portion complete. Phase 5 — portable feature extraction and inference composition: software portion complete.** The STM32F407ZGT6 MCU foundation compiles and links with PlatformIO, STM32CubeF4, and FreeRTOS. No upload or physical board test has been performed. See [build instructions and measured link-time sizes](BUILD.md).

**Phase 3 — Sensor interfaces: software portion complete; physical bring-up pending.** Typed sensor/UI APIs and safe diagnostics are present; no hardware driver or physical module test is claimed.

## Verified in this phase

- MCU manifest uses the locally available `ststm32` metadata for the F407ZG, startup/system files from installed STM32CubeF4, and a project linker script derived from the locally installed F407ZG linker script. No local RT-Spark schematic or board support package was found.
- HAL clock selection is internal 16 MHz HSI. HAL 1 ms tick is on TIM6; FreeRTOS 1 kHz tick is on SysTick. Cortex-M4F SVC/PendSV/SysTick handlers are owned by one FreeRTOS port.
- Four FreeRTOS tasks, two one-slot overwrite queues, a diagnostic task notification, and a 24 KiB `heap_4` arena compile and link.
- Host unit command `sh tools/test_host.sh`: **PASS**. It verifies unavailable task placeholders, the host-testable classifier adapter's label/error contract, and RAM log-buffer behavior.
- `pio run`: **PASS**. PlatformIO-reported usage is 9,524 bytes Flash and 25,380 bytes RAM. ELF/raw-bin and linker-reserved stack details are recorded in `docs/BUILD.md` and `evidence/build/`.
- Existing workflow file and Phase 1 project documents were preserved; Git history was retained.

## Phase 3 software evidence

- `sh tools/test_host.sh`: **PASS** with AddressSanitizer/UndefinedBehaviorSanitizer; checks valid and invalid samples, unbound drivers, bus fault propagation, verified/unverified/absent module states, and probe counters. Test fixtures are isolated in `tests/support/`.
- Runtime diagnostics retain all nine candidate modules as **UNVERIFIED** and do not call probe functions until presence is explicitly set. The diagnostic task updates this registry without accessing hardware.
- `pio run`: **PASS** after the final interface changes. PlatformIO reports 9,956 bytes Flash and 25,640 bytes RAM; output is in `evidence/build/phase3-pio-run.log`.

## Phase 4 software evidence

- `ml/data/SCHEMA.md` defines required motion/session/label fields and optional context fields; `ml/data/CAPTURE_PROTOCOL.md` specifies an initial 50 Hz / 2-second procedure, pending sensor and instructor verification.
- `ml/scripts/pipeline.py` implements validation, fault-aware windowing, 24 motion features, trial-group splitting with class minimums, threshold/tree comparison, held-out metrics, and C export.
- `python3 -m unittest discover -s tests/ml -v`: **PASS**, 4 tests. Temporary `SYNTHETIC_TEST_ONLY` fixtures exercise segment breaks, leakage-safe split, report artifacts, the shared 24-feature ABI count, and compiled C/Python parity. These test fixtures are distinct from the explicitly labeled synthetic-only demonstration dataset added later.
- `sh tools/test_host.sh`: **PASS** with AddressSanitizer/UndefinedBehaviorSanitizer, including the classifier-adapter fixture. `pio run`: **PASS** on the current tree; PlatformIO reports 9,956 bytes Flash and 25,640 bytes RAM. The adapter has no caller in firmware tasks, so no model is linked. These remain link-time estimates, not runtime measurements.
- Real board data, labeling definitions, model quality, and embedded performance are **PENDING**. Target-connected Phase 5 work has not started.

## Phase 5 software-only progress (2026-10-30)

- Added `firmware/src/features.c`, which computes the pipeline's ordered 24-feature vector from a valid timestamped motion window. Invalid samples, invalid timestamp order, and features outside finite `float` range return an error with a zeroed output.
- Added `firmware/src/inference.c`, a host-testable composition from samples through features to the existing model callback and three-state mapping. The FreeRTOS `InferenceTask` intentionally remains unavailable until a verified sensor source and real-data model exist.
- `sh tools/test_host.sh`: **PASS** with AddressSanitizer/UndefinedBehaviorSanitizer, including feature formulas, timestamp wrap, invalid windows, unavailable model handling, and inference callback mapping.
- `python3 -m unittest discover -s tests/ml -v`: **PASS**, 5 tests. The additional parity case compares every C feature with the Python pipeline on a temporary fixture explicitly marked synthetic. This is implementation parity only, not a performance result.
- Added the software test plan, report outline, demo script, project rationale, license/attribution status, and evidence manifest. Added Arch Linux setup guidance and a local Markdown-link checker to CI.
- `PLATFORMIO_CORE_DIR=/tmp/parcelsense-platformio pio run`: **PASS** after a clean build. PlatformIO reports 9,976 bytes Flash and 25,640 bytes RAM. The complete output is `evidence/build/phase5-host-feature-pio-run.log`; the MCU profile still does not establish RT-Spark compatibility or runtime use.
- `python3 -m unittest discover -s backend/tests -v`: **PASS**, 7 tests. Loopback permission was needed to start the isolated local API fixture; output is `evidence/tests/phase5-backend-tests.log`.
- Frontend `npm run typecheck`, `npm test`, and `npm run build`: **PASS**; 14 tests passed. Output is `evidence/tests/phase5-frontend-checks.log`.
- `npm run e2e:local-api`: **PASS** in Chromium. `npm run e2e:readiness`: **PASS** in Chromium and Firefox, including responsive checks and offline shell reload/navigation. Logs are in `evidence/tests/`.
- `python3 tools/check_docs.py`: **PASS**, 63 local Markdown file targets resolve. Output is `evidence/tests/phase5-doc-links.log`.

## Optional frontend/PWA workstream

- The initial ParcelSense Field Desk app is implemented in `frontend/`: local CSV review, browser storage/export, pipeline report review, install metadata, and an app-shell service worker. This companion does not change the embedded phase status or provide board connectivity.
- `cd frontend && npm test`: **PASS**, 14 tests. `npm run typecheck`: **PASS**. `npm run build`: **PASS**; production bundle, manifest, service worker, and security headers are generated.
- An opt-in loopback-only API in `backend/` supports generated synthetic demo CSVs and explicit storage/deletion of reviewed copies in local SQLite. `python3 -m unittest discover -s backend/tests -v`: **PASS**, 7 tests covering provenance, CSV validation, request limits, origin checks, persistence, and deletion. The deterministic 1,200-row demo uses the software-only synthetic signal pattern from pipeline fixtures; it is not board data or evaluation evidence. The API is not deployed to Cloudflare Pages.
- `cd frontend && npm run e2e:local-api`: **PASS** in headless Chromium. The repeatable check launches an isolated backend database and verifies synthetic sample → browser review/save → explicit API copy → backend deletion while retaining the browser copy. `PARCELSENSE_DEV_ORIGIN` supports this test's free Vite port while accepting only an exact loopback HTTP origin.
- `cd frontend && npm run e2e:readiness`: **PASS** in Chromium and Firefox. It checks named landmarks and controls, duplicate IDs, keyboard skip/navigation and heading focus in Chromium, responsive widths 1440/768/390/320 px without horizontal overflow in both engines, and production service-worker reload plus client navigation after stopping the preview server. It also confirms the production build hides development API controls.
- `cd frontend && npm run dev:local`: **PASS** smoke check. Starts the API and PWA together, selects a free loopback port when the default Vite port is busy, and stops only its child services on Ctrl+C. The standalone Vite dev and preview commands now bind to loopback too.
- An isolated Chromium smoke test used a temporary `SYNTHETIC_TEST_ONLY` CSV to verify review, IndexedDB save, reload/reopen, exact-value export, and deletion. The fixture and export were kept outside the repository; this is software workflow coverage, not board-generated data validation.
- The `parcelsense-ai` Cloudflare Pages Direct Upload project is live at `https://parcelsense-ai.pages.dev`. Hosted production HTTPS, security headers, manifest, service-worker cache, offline navigation, and no-external-resource behavior were verified in Chromium.
- The custom domain `parcelsense.joalvergs.tech` is live. Name.com authoritative DNS and public resolvers return the expected CNAME, Cloudflare Pages reports DNS and HTTP validation active, and HTTPS responds with HTTP 200. After clearing the test environment's cached NXDOMAIN, the system resolver and normal HTTPS request both succeed; custom-host offline navigation also passed in Chromium.
- Latest Pages production deployment serves commit `8f4a0ee` (deployment `f9cddb6d-22d9-40d9-8108-195c14240d1a`) on both production hosts. The new bundle/assets returned HTTP 200, and the custom-domain service worker passed an offline app-shell reload check. Details are in [PWA deployment](PWA_DEPLOYMENT.md).
- Muted-text contrast was improved and checked against light surfaces. Automated desktop checks cover Chromium and Firefox, while real screen-reader/mobile-device use, representative real captures, real storage-quota pressure, browser eviction, and Safari/mobile-browser coverage remain pending. The app-shell service worker and local API checks use synthetic data only.
- Deployment commands, DNS guidance, and current blockers are recorded in [PWA deployment](PWA_DEPLOYMENT.md).

## Pending

- RT-Spark revision, crystal/clock expectations, installed components, UART/pins, debugger, and runtime startup behavior remain unverified.
- FreeRTOS runtime heap/stack diagnostics, scheduler behavior, and actual timing have not been observed on target.
- Board-generated dataset, real-data trained/selected model, sensor diagnostics, classifier performance, embedded inference, and hardware tests are pending.
- Full GitHub release CI and production smoke verification remain to be completed after publishing the Phase 5 host code and documentation updates.
- Exact RT-Spark board revision, module population, bus and pin mapping, and physical diagnostic results are required to finish the Phase 3 hardware gate.
- Use the [board-arrival checklist](BOARD_ARRIVAL_CHECKLIST.md) to collect the missing hardware, real capture, target timing/memory, and submission evidence. The host feature extractor and window-inference composition validate software interfaces; neither supplies a trained model or changes the target Phase 5 gate.

## Next step

When the board is available, finish the Phase 3 hardware gate by identifying the RT-Spark revision and installed modules, verifying the schematic/pinout and bus mappings, and checking the board clock/debugger. Then run module diagnostics and capture labeled real trials using the reviewed Phase 4 protocol. Only after real held-out evaluation should the host-tested window inference path be connected to physical acquisition and a selected model. Do not assign pins from the MCU-only foundation profile.

## Synthetic-only software package (2026-10-30)

- Added `ml/scripts/generate_synthetic.py` and a checked-in 12,000-row dataset with an adjacent manifest that marks it `synthetic` and `measured_hardware: false`.
- Ran the host pipeline on 120 generated windows (40 per label); its grouped split contains 30 training and 10 held-out synthetic windows per label. Both the threshold baseline and bounded tree scored 30/30 on the generated holdout. This deliberately easy simulation only demonstrates pipeline/report mechanics and says nothing about real-world performance.
- Exported a synthetic-tagged `model.json` and `model.c` under `ml/models/synthetic/`; these files are not included in the PlatformIO firmware target.
- Added a clearly scoped synthetic-only report and a copy-ready instructor disclaimer. Board diagnostics, real data, RT-Spark inference, and the live demonstration remain pending.
