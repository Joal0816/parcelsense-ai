# Requirements and evidence matrix

This matrix turns the BCA182 Laboratory Activity No. 4 project goals into observable deliverables. Every hardware result remains **PENDING** until it is collected and recorded. Phase 1 defined the plan; Phase 2 added and compiled a hardware-independent firmware foundation.

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

## Phase 1 and Phase 2 acceptance

- Required folder layout and named documents are present.
- Architecture, six phases, measurable deliverables, limitations, and next steps are documented.
- Every onboard component is marked **UNVERIFIED** in the inventory.
- Git status and local Markdown links are checked; Phase 1 and Phase 2 changes are committed if identity is available.
- Phase 2 source contains four FreeRTOS tasks, two bounded queues, task notifications, the ARM_CM4F port, and heap_4; `pio run` links the image.
- Host tests cover invalid/unavailable classification output and bounded logging. No hardware behavior is accepted from a host test or cross-compile.
- Flash/RAM evidence distinguishes PlatformIO's report, ELF sections and runtime measurements. FreeRTOS heap and stack high-water values remain runtime-only diagnostics.

## Phase 3 software deliverables

- Typed callback interfaces describe IMU, AP3216C light/proximity, AHT10 environment, display, indicators, buzzer, and buttons without assigning a bus or pin.
- Samples include timestamp, units, validity, and status. Read wrappers clear outputs and propagate transport and invalid-data errors.
- The runtime module registry begins with all candidate components **UNVERIFIED** and cannot probe them until presence is established. Probe outcomes distinguish ready, absent, unprobed, and fault.
- Host-only fixtures are under `tests/support/`; none are linked into the PlatformIO target. Host checks cover invalid readings, unavailable drivers, unknown inventory, and injected probe faults.
- Physical component presence, module self-tests, bus/pin mapping, sensor-fault recovery, and usefulness of the secondary context modality remain **PENDING** until board inspection and bring-up.

## Phase 4 software deliverables

- `ml/data/SCHEMA.md` defines the CSV fields, units, labels, and invalid-row behavior; `ml/data/CAPTURE_PROTOCOL.md` records a draft safe procedure at an initial 50 Hz / 2-second window target, pending hardware and instructor verification.
- `ml/scripts/pipeline.py` validates rows, breaks windows at invalid samples, records exclusions, extracts 24 motion features, splits by session/trial, enforces 30 train and 10 held-out windows per class, compares a median-based threshold baseline with a bounded depth-3 tree, reports confusion/per-class precision/recall/macro-F1, and exports compact C plus JSON metadata.
- `python3 -m unittest discover -s tests/ml -v` creates only temporary `SYNTHETIC_TEST_ONLY` fixtures and checks window segmentation, group separation, artifact generation, and Python/C prediction parity. These checks do not count as a dataset or performance evidence.
- Board-generated data, real held-out results, approved operational label definitions, verified sampling rate, and any useful context-sensor contribution remain **PENDING** until the RT-Spark and installed sensors are available.
