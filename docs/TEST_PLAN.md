# Software test plan and acceptance record

This plan separates repeatable software checks from tests that require the RT-Spark. Host results establish code behavior under the test environment; they do not establish board compatibility, sensor behavior, or classifier quality.

## Reproducible software checks

Run commands from the repository root unless noted.

| Area | Command | What it covers | Hardware required? |
| --- | --- | --- | --- |
| Documentation links | `python3 tools/check_docs.py` | Relative Markdown file links resolve within the checkout. | No |
| Firmware host tests | `sh tools/test_host.sh` | Classifier boundary, sample validation, feature extraction and inference composition, module registry safeguards, and bounded log buffer. Sanitizers are enabled where supported by the host compiler. | No |
| Firmware target compile | `pio run` | Compiles and links the STM32F407ZGT6 MCU foundation and FreeRTOS integration. It does not upload or exercise the board. | No |
| ML pipeline | `python3 -m unittest discover -s tests/ml -v` | Schema/window behavior, trial-group split, temporary synthetic training/export smoke checks, generated C prediction parity, and Python/C feature parity. | No |
| Local API | `python3 -m unittest discover -s backend/tests -v` | Local-only API validation, provenance, limits/origin checks, SQLite persistence, and deletion. | No |
| Frontend type check | `cd frontend && npm run typecheck` | TypeScript project checks. | No |
| Frontend unit tests | `cd frontend && npm test` | CSV validation, browser storage, report parsing, and API client behavior. | No |
| Frontend build | `cd frontend && npm run build` | Production static PWA bundle, manifest, service worker, and headers. | No |
| Local API browser flow | `cd frontend && npm run e2e:local-api` | Synthetic CSV → browser review/save → explicit local API copy → backend deletion, retaining the browser copy. Requires Chromium and ChromeDriver. | No |
| PWA readiness | `cd frontend && npm run e2e:readiness` | Semantics, keyboard navigation, responsive layout, service-worker offline shell behavior, and production hiding of development-only controls. Requires Chromium, Firefox, and ChromeDriver. | No |
| Production smoke check | `cd frontend && npm run verify:production` | Confirms the configured public host serves the expected static bundle, manifest, service worker, and headers. Requires network access. | No |

Use the Python standard library for the backend/ML tests. Frontend commands require the Node version stated in [frontend setup](../frontend/README.md). PlatformIO may download pinned packages on its first build.

## Software acceptance boundaries

- The C feature extractor must match `ml/scripts/pipeline.py` feature order and values within floating-point tolerance for the host parity fixtures.
- Invalid, non-finite, missing, or out-of-order samples must not yield a class. Every failure returns an unavailable state from the inference boundary.
- Model callback fixtures are test-only. No deterministic test callback is linked as a production model.
- Synthetic test data is temporary and clearly named. A passing synthetic smoke test does not produce real-data metrics or a trained ParcelSense model.
- Browser imports remain local by default. Sending a reviewed copy is an explicit local-development action; the production PWA does not persist records on the server.

## Hardware-gated acceptance

Perform these steps only after the exact board and installed modules are identified and the instructor-approved capture procedure is available. Record actual results; do not fill them from host builds or synthetic data.

| Test | Required evidence | Current state |
| --- | --- | --- |
| Verify board revision, power, programmer, clock, linker map, sensors, buses, and pinout | Dated photos or authoritative board documents, inventory, and review record | Pending board access |
| Diagnose each physically present sensor and UI module | Repeatable per-module pass/fail/fault logs | Pending board access |
| Capture labeled data for all classes | Original board-generated CSV, metadata, checksums, and reviewed label protocol | Pending board access and instructor review |
| Evaluate on held-out real trials | Session/trial-group split, class counts, exclusions, confusion matrix, per-class metrics, macro-F1, and error analysis | Pending real data |
| Run inference and local feedback on the target | Firmware/model revision, observed output, invalid-input behavior, and logs | Pending board and real model |
| Measure timing and memory | At least 50 target timing samples with median/p95 and sampling-to-response latency; compiled Flash/RAM sections; runtime FreeRTOS heap free/minimum and task stack high-water values | Pending target execution |
| Check offline operation and reliability | At least 5 minutes offline inference, 15-minute continuous operation, controlled fault/recovery record, and at least 20 additional independent product trials for each classification state, separate from training/tuning | Pending target execution |

See the [board-arrival checklist](BOARD_ARRIVAL_CHECKLIST.md) for the detailed procedure and evidence slots.

## Privacy, safety, accessibility, and improvement checks

- **Privacy:** confirm there are no telemetry or third-party tracking requests; verify that hosted CSV imports remain in browser storage, local API transfers require an explicit action, and delete/export paths behave as documented. Do not commit raw recordings or personal identifiers.
- **Safety:** use only instructor-approved class definitions and handling procedure. No force/drop threshold is approved by this codebase. Invalid samples, unavailable model callbacks, and invalid model outputs must produce `UNAVAILABLE`, not a class.
- **Accessibility:** automate named controls/landmarks, skip navigation, keyboard interaction, reduced motion, and responsive reflow where covered by the browser check. Manually validate mobile screen readers, zoom, touch targets, and assistive technology before claiming full accessibility acceptance.
- **Limitations:** report browser and host versions, fixture provenance, unmeasured mobile storage limits, absent board data, unknown hardware revision, and target/runtime measurements that remain pending.

The current software includes these test-supported improvements: (1) invalid windows and bad model results keep the output unavailable (`tests/unit/test_foundation.c`); (2) unverified modules are never probed (`tests/unit/test_foundation.c`); and (3) deleting an explicit local API copy leaves the browser-local import intact (`frontend/scripts/e2e-local-api.mjs`). These are software safeguards, not hardware validation.

## Execution record

Append dated command results to [the evidence manifest](../evidence/README.md). Do not mark a check passed unless its command completed with exit status zero and the output is retained or linked. Do not report a hardware-only row as passed based on a simulator or MCU cross-build.
