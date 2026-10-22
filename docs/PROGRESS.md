# Progress

## Current status

**Phase 1 — Initialization: complete. Phase 2 — Firmware foundation: software build complete. Phase 3 — Sensor interfaces: software portion complete. Phase 4 — Host ML pipeline: software portion complete.** The STM32F407ZGT6 image compiles and links with PlatformIO, STM32CubeF4, and FreeRTOS. No upload or physical board test has been performed. See [build instructions and measured link-time sizes](BUILD.md).

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
- `python3 -m unittest discover -s tests/ml -v`: **PASS**, 4 tests. Temporary `SYNTHETIC_TEST_ONLY` fixtures exercise segment breaks, leakage-safe split, report artifacts, the shared 24-feature ABI count, and compiled C/Python parity. No synthetic data or model artifacts are retained in the repository.
- `sh tools/test_host.sh`: **PASS** with AddressSanitizer/UndefinedBehaviorSanitizer, including the classifier-adapter fixture. `pio run`: **PASS** on the current tree; PlatformIO reports 9,956 bytes Flash and 25,640 bytes RAM. The adapter has no caller in firmware tasks, so no model is linked. These remain link-time estimates, not runtime measurements.
- Real board data, labeling definitions, model quality, and embedded performance are **PENDING**. Phase 5 has not started.

## Optional frontend/PWA workstream

- The initial ParcelSense Field Desk app is implemented in `frontend/`: local CSV review, browser storage/export, pipeline report review, install metadata, and an app-shell service worker. This companion does not change the embedded phase status or provide board connectivity.
- `cd frontend && npm test`: **PASS**, 11 tests. `npm run build`: **PASS**; production bundle, manifest, service worker, and security headers are generated.
- An isolated Chromium smoke test used a temporary `SYNTHETIC_TEST_ONLY` CSV to verify review, IndexedDB save, reload/reopen, exact-value export, and deletion. The fixture and export were kept outside the repository; this is software workflow coverage, not board-generated data validation.
- The `parcelsense-ai` Cloudflare Pages Direct Upload project is live at `https://parcelsense-ai.pages.dev`. Hosted production HTTPS, security headers, manifest, service-worker cache, offline navigation, and no-external-resource behavior were verified in Chromium.
- The custom domain `parcelsense.joalvergs.tech` is live. Name.com authoritative DNS and public resolvers return the expected CNAME, Cloudflare Pages reports DNS and HTTP validation active, and HTTPS responds with HTTP 200. After clearing the test environment's cached NXDOMAIN, the system resolver and normal HTTPS request both succeed; custom-host offline navigation also passed in Chromium.
- Muted-text contrast was improved and checked against light surfaces. In local Chromium production preview, keyboard Tab/Enter reached the skip link and main region, page navigation moved focus to the page heading, the accessibility tree exposed named navigation/main landmarks and status semantics, and 1440/768/390/320 px viewports showed no horizontal page overflow. The app-shell service worker cached its assets and reloaded the PWA with network disabled after the first visit was controlled. The last mobile sweep also keeps all five navigation destinations visible at phone widths. Real screen-reader/mobile-device, representative-data workflow, real storage-quota pressure, and cross-browser checks remain pending.
- Deployment commands, DNS guidance, and current blockers are recorded in [PWA deployment](PWA_DEPLOYMENT.md).

## Pending

- RT-Spark revision, crystal/clock expectations, installed components, UART/pins, debugger, and runtime startup behavior remain unverified.
- FreeRTOS runtime heap/stack diagnostics, scheduler behavior, and actual timing have not been observed on target.
- Board-generated dataset, real-data trained/selected model, sensor diagnostics, classifier performance, embedded inference, and hardware tests are pending.
- Exact RT-Spark board revision, module population, bus and pin mapping, and physical diagnostic results are required to finish the Phase 3 hardware gate.
- Use the [board-arrival checklist](BOARD_ARRIVAL_CHECKLIST.md) to collect the missing hardware, real capture, target timing/memory, and submission evidence. The new firmware adapter is only an ABI-validation seam; it is not model inference and does not change the Phase 5 gate.

## Next step

When the board is available, finish the Phase 3 hardware gate by identifying the RT-Spark revision and installed modules, verifying the schematic/pinout and bus mappings, and checking the board clock/debugger. Then run module diagnostics and capture labeled real trials using the reviewed Phase 4 protocol. Only after real held-out evaluation should work move to Phase 5 embedded inference. Do not assign pins from the MCU-only foundation profile.
