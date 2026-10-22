# Board-arrival checklist

Use this checklist only after the RT-Thread RT-Spark is physically available. The working copy currently has **no board evidence**. Do not mark a step complete from the STM32F407ZGT6 MCU profile or a successful cross-build alone. Keep dated evidence under `evidence/` and record the exact board revision and tool versions.

## 1. Identify the hardware before powering or uploading

- [ ] Photograph the board front and back, including silkscreen, revision, module connectors, and installed components. Store the original photos under `evidence/hardware/`.
- [ ] Record exact product name, board revision, MCU marking, and any module identifiers visible on the hardware. **Status: PENDING.**
- [ ] Obtain the matching official schematic, pinout, user manual, and board support configuration. Record source, revision, and retrieval date under `evidence/hardware/`; reconcile documents against the physical board.
- [ ] Fill in `docs/HARDWARE_INVENTORY.md` only from physical inspection and matching board documentation. Keep uncertain components **UNVERIFIED**.
- [ ] Verify the power input, expected supply range, USB/debug connectors, jumper positions, and any board-specific precautions from authoritative documentation before connection.
- [ ] Identify the actual programmer/debug probe and host permissions. Do not attempt upload until the board, memory map, clock source, reset method, and probe configuration match the project manifest.

## 2. Reconcile the firmware target

- [ ] Compare the project MCU profile, linker memory regions, startup file, clock configuration, and PlatformIO upload/debug options against the exact board revision and official documents.
- [ ] Confirm whether the board's external oscillator is fitted and documented before changing the current internal-HSI foundation clock. Do not assume a crystal, frequency, peripheral pin, or alternate function.
- [ ] Confirm that HAL tick (TIM6) and FreeRTOS SysTick/SVC/PendSV ownership remain unique after any board support changes.
- [ ] Build with `pio run`; save the full output, tool versions, exit status, ELF, map, and binary under `evidence/build/`. A build proves compilation/linking only.
- [ ] Before first upload, record the exact approved image hash and recovery procedure. Make the first upload a controlled, supervised test and record its console/debug output under `evidence/logs/`.
- [ ] Verify scheduler startup and each task heartbeat on target. Record FreeRTOS free/minimum heap, each task's stack high-water mark, reset cause, and observed tick behavior. Do not infer runtime memory headroom from link-time sections.

## 3. Inventory and diagnose each fitted module

- [ ] Map each module to its source-document citation, observed marking, physical location, and confidence in `docs/HARDWARE_INVENTORY.md`.
- [ ] For every module marked present, verify voltage, bus, address/identity, reset/interrupt wiring, and pin mapping from the matching schematic/manual before implementing or enabling a probe.
- [ ] Run the existing diagnostics only for explicitly verified-present modules. Record command/firmware revision, raw output, status, and repeatability for each module in `evidence/logs/`.
- [ ] Test absent, disconnected, malformed, and bus-fault behavior safely; confirm an unverified module is never probed and a fault cannot become a handling prediction.
- [ ] Verify any display, LED, buzzer, buttons, or serial console separately. Enable UART diagnostics only after the exact UART and pins are verified. Otherwise retain the hardware-independent log interface.

## 4. Capture and review board-generated data before model work

- [ ] Obtain instructor approval for safe handling labels, parcel setup, operator procedure, trial boundaries, and stopping conditions. The current capture protocol is a draft, not permission to perform an unsafe trial.
- [ ] Follow the reviewed [capture protocol](../ml/data/CAPTURE_PROTOCOL.md) and [dataset schema](../ml/data/SCHEMA.md); record sensor identity/range/ODR, sample rate, units, calibration/configuration, firmware revision, operator pseudonym, session/trial IDs, label rationale, and faults.
- [ ] Capture **at least 30 training windows and 10 held-out windows per class** from independent trial/session groups for Stable, Normal Handling, and Rough Handling. Keep the held-out groups out of tuning and feature/model selection.
- [ ] Store unmodified board-generated CSVs in `ml/data/raw/` only after checking that they contain no personal identifiers. Preserve checksums and capture notes in `evidence/`.
- [ ] Run `python3 -m unittest discover -s tests/ml -v`, then process the real capture with the documented pipeline. Store derived data under `ml/data/processed/` and generated artifacts under `ml/models/`; label provenance as real board capture with session/trial references.
- [ ] Compare the simple threshold baseline with the compact candidate on the held-out trials. Save class counts, confusion matrix, per-class precision/recall/F1, macro-F1, split groups, exclusions, and model export. Do not present synthetic-fixture results as product performance.
- [ ] Review label quality, leakage, sensor faults, and error cases with the instructor before selecting a model for embedded work.

## 5. Integrate and measure on target (Phase 5 gate)

- [ ] Integrate only the reviewed exported model and exact preprocessing/feature order. Confirm parity between Python, host C, and target C on recorded fixture vectors.
- [ ] Check input length, finite values, invalid sensor/window status, and model return values. Any invalid condition must leave the state unavailable rather than emit a class.
- [ ] Measure at least **50 inference samples** on target; report median and p95 inference latency and sampling-to-feedback latency, with clock/compiler/model details.
- [ ] Record firmware Flash, static RAM, FreeRTOS heap free/minimum, and every task's stack high-water mark. Compare use with documented linker regions and safe runtime headroom.
- [ ] Verify the three user-visible states and feedback output on physical hardware; record video or photos and timestamped logs without implying a state that was not produced by the model.

## 6. Complete independent validation and submission evidence (Phase 6 gate)

- [ ] Run at least **20 additional independent trials per state**, beyond model-development captures, and publish a separate report with counts and provenance.
- [ ] Complete a **15-minute continuous run**, a **5-minute offline run**, and a controlled fault test. Save logs and note any reset, dropped sample, invalid window, or recovery behavior.
- [ ] Re-run host unit tests, ML tests, frontend tests/build, and `pio run`; archive commands, tool versions, exit statuses, and resulting logs under `evidence/tests/` and `evidence/build/`.
- [ ] Verify the PWA works from its cached app shell while offline and can export/delete local records. Its offline operation does not establish embedded offline inference.
- [ ] Create a submission evidence index linking board identity photos, schematic/pinout, inventory, diagnostics, raw-data checksums, split/model report, target measurements, test logs, and limitations. Obtain instructor review before declaring laboratory acceptance.

## Evidence ledger

| Evidence | Current state | Record when available |
|---|---|---|
| Exact RT-Spark revision and installed modules | **PENDING — no board available** | Photos, markings, inventory entries, date |
| Matching schematic/pinout and board support configuration | **PENDING — not locally verified** | Document revision/source and checked mappings |
| Power, debugger, upload, and target boot | **PENDING — not tested** | Probe, procedure, image hash, logs |
| Sensor/module diagnostics | **PENDING — no physical modules verified** | Per-module diagnostic report |
| Board-generated labeled dataset | **PENDING — none captured** | Raw CSV checksums, session/trial metadata |
| Real held-out baseline/model comparison | **PENDING — no real dataset/model** | Pipeline report and split provenance |
| Target latency, heap, stack, and feedback | **PENDING — not measured** | At least 50 timings plus runtime diagnostics |
| Independent trials, reliability, and submission evidence | **PENDING — not run** | Phase 6 evidence index |

## Current software-only preparation

The local `ststm32`/STM32CubeF4 profile targets the STM32F407ZG MCU, not a verified RT-Spark board revision. The four FreeRTOS task skeletons remain sensor-independent; all module inventory entries remain unverified. `firmware/src/classifier.c` provides a host-testable, validated adapter for the pipeline's 24-feature C ABI, but it has no trained model and is not connected to `InferenceTask`. Do not upload or claim board operation until the relevant checklist evidence exists.
