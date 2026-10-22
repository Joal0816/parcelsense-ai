# Progress

## Current status

**Phase 1 — Initialization: complete. Phase 2 — Firmware foundation: software build complete. Phase 3 — Sensor interfaces: software portion complete. Phase 4 — Host ML pipeline: software portion complete.** The STM32F407ZGT6 image compiles and links with PlatformIO, STM32CubeF4, and FreeRTOS. No upload or physical board test has been performed. See [build instructions and measured link-time sizes](BUILD.md).

**Phase 3 — Sensor interfaces: software portion complete; physical bring-up pending.** Typed sensor/UI APIs and safe diagnostics are present; no hardware driver or physical module test is claimed.

## Verified in this phase

- MCU manifest uses the locally available `ststm32` metadata for the F407ZG, startup/system files from installed STM32CubeF4, and a project linker script derived from the locally installed F407ZG linker script. No local RT-Spark schematic or board support package was found.
- HAL clock selection is internal 16 MHz HSI. HAL 1 ms tick is on TIM6; FreeRTOS 1 kHz tick is on SysTick. Cortex-M4F SVC/PendSV/SysTick handlers are owned by one FreeRTOS port.
- Four FreeRTOS tasks, two one-slot overwrite queues, a diagnostic task notification, and a 24 KiB `heap_4` arena compile and link.
- Host unit command `sh tools/test_host.sh`: **PASS**. It verifies unavailable classification placeholders and RAM log-buffer behavior.
- `pio run`: **PASS**. PlatformIO-reported usage is 9,524 bytes Flash and 25,380 bytes RAM. ELF/raw-bin and linker-reserved stack details are recorded in `docs/BUILD.md` and `evidence/build/`.
- Existing workflow file and Phase 1 project documents were preserved; Git history was retained.

## Phase 3 software evidence

- `sh tools/test_host.sh`: **PASS** with AddressSanitizer/UndefinedBehaviorSanitizer; checks valid and invalid samples, unbound drivers, bus fault propagation, verified/unverified/absent module states, and probe counters. Test fixtures are isolated in `tests/support/`.
- Runtime diagnostics retain all nine candidate modules as **UNVERIFIED** and do not call probe functions until presence is explicitly set. The diagnostic task updates this registry without accessing hardware.
- `pio run`: **PASS** after the final interface changes. PlatformIO reports 9,956 bytes Flash and 25,640 bytes RAM; output is in `evidence/build/phase3-pio-run.log`.

## Phase 4 software evidence

- `ml/data/SCHEMA.md` defines required motion/session/label fields and optional context fields; `ml/data/CAPTURE_PROTOCOL.md` specifies an initial 50 Hz / 2-second procedure, pending sensor and instructor verification.
- `ml/scripts/pipeline.py` implements validation, fault-aware windowing, 24 motion features, trial-group splitting with class minimums, threshold/tree comparison, held-out metrics, and C export.
- `python3 -m unittest discover -s tests/ml -v`: **PASS**. Temporary `SYNTHETIC_TEST_ONLY` fixtures exercise segment breaks, leakage-safe split, report artifacts, and compiled C/Python parity. No synthetic data or model artifacts are retained in the repository.
- `sh tools/test_host.sh`: **PASS**. A final `pio run` reattempt could not start compilation because PlatformIO could not write its lock under the read-only `/home/joal/.platformio`; there was no firmware compiler result. The prior successful Phase 3 build remains the latest successful target build, and Phase 4 did not change firmware.
- Real board data, labeling definitions, model quality, and embedded performance are **PENDING**. Phase 5 has not started.

## Pending

- RT-Spark revision, crystal/clock expectations, installed components, UART/pins, debugger, and runtime startup behavior remain unverified.
- FreeRTOS runtime heap/stack diagnostics, scheduler behavior, and actual timing have not been observed on target.
- Board-generated dataset, real-data trained/selected model, sensor diagnostics, classifier performance, embedded inference, and hardware tests are pending.
- Exact RT-Spark board revision, module population, bus and pin mapping, and physical diagnostic results are required to finish the Phase 3 hardware gate.

## Next step

When the board is available, finish the Phase 3 hardware gate by identifying the RT-Spark revision and installed modules, verifying the schematic/pinout and bus mappings, and checking the board clock/debugger. Then run module diagnostics and capture labeled real trials using the reviewed Phase 4 protocol. Only after real held-out evaluation should work move to Phase 5 embedded inference. Do not assign pins from the MCU-only foundation profile.
