# Requirements and evidence matrix

This matrix turns the BCA182 Laboratory Activity No. 4 project goals into observable deliverables. Every hardware result remains **PENDING** until it is collected and recorded. Phase 1 defines the plan only.

| Requirement | Measurable deliverable | Evidence location / acceptance |
|---|---|---|
| Offline package-handling classification | Three output labels: Stable, Normal Handling, Rough Handling; prediction path works without network access | `evidence/tests/`; demonstrate offline operation for at least 5 minutes (Phase 6) |
| Target and required stack | Verified RT-Spark revision / STM32F407ZGT6 setup; PlatformIO `ststm32`, `stm32cube`; STM32Cube HAL/LL; explicit FreeRTOS integration | Build configuration and logs in `evidence/build/`; board configuration evidence, Phase 2 |
| Independent concurrent work | At least three FreeRTOS tasks with documented responsibility and scheduling/communication | Source and task diagnostics; build evidence, Phase 2 |
| Actual data collection | Board-generated labeled recordings across all three classes; schema includes session/trial, timestamps, acceleration XYZ, angular velocity XYZ, context readings where available, and label | Reviewed CSV/data manifest and capture logs in `ml/data/` and `evidence/logs/`; raw data stays ignored by default |
| Dataset sufficiency and leakage control | At least 30 training and 10 held-out windows per class, split by session/trial; record exclusions and class balance | Dataset manifest and split report, Phase 4 |
| Sensor/module diagnostics | Each physically present and supported sensor/UI module receives a repeatable detection/self-test with pass/fail/fault result; absent hardware is reported | Inventory plus diagnostic logs; Phase 3 |
| Baseline comparison | Compare a documented threshold baseline with one or more compact trained classifiers using held-out real trials | Confusion matrix, per-class precision/recall, macro-F1, error analysis; Phase 4 |
| Offline embedded inference | Exported model and fixed preprocessing run on target with validated inputs and no network dependency | Firmware integration and offline test log; Phase 5/6 |
| Latency | At least 50 on-board inference timing observations; report median and p95 plus sampling-to-response latency | Raw timing log and summary in `evidence/tests/`; Phase 5/6 |
| Memory | Report compiled Flash and RAM sections, FreeRTOS heap use, and task stack high-water marks; distinguish link-time from runtime values | Build map/size output and diagnostic logs in `evidence/build/` and `evidence/logs/`; Phase 2/5 |
| Reliability / fault handling | At least 15-minute continuous run and controlled sensor/data fault test; document recovery and observed behavior | Timestamped logs and test record in `evidence/tests/`; Phase 6 |
| Submission evidence | Reproducible build steps, test plan/results, logs, screenshots/photos only when captured, limitations, and evidence manifest | `docs/` and `evidence/`; Phase 6 |

## Phase 1 acceptance

- Required folder layout and named documents are present.
- Architecture, six phases, measurable deliverables, limitations, and next steps are documented.
- Every onboard component is marked **UNVERIFIED** in the inventory.
- Git status and local Markdown links are checked; only Phase 1 files are committed if identity is available.
