# ParcelSense AI

ParcelSense AI is an offline, on-device package-handling classifier project for BCA182 Embedded Systems Programming, Laboratory Activity No. 4. Its intended target is the RT-Thread RT-Spark with STM32F407ZGT6. The Phase 2 firmware foundation builds, but has not been run on an RT-Spark board. Sensors, model inference, and serial output are not implemented.

## Objective

Capture package motion on the board, classify handling locally, provide a local indication, and record diagnostic/evaluation data. The intended classes are **Stable**, **Normal Handling**, and **Rough Handling**. Class boundaries will be defined from repeatable labeled trials and evaluated against a transparent baseline before claiming useful classification performance.

## Intended technology

- PlatformIO with `ststm32` and `stm32cube`.
- STM32Cube HAL/LL and the CubeF4-bundled FreeRTOS GCC Cortex-M4F port.
- Offline on-device inference; no network is required by the prediction path.
- Python tooling for board-data processing, training, validation, and compact model export.

The RT-Spark revision, installed sensors and UI, pinout, clock source, programmer, and physical board compatibility are **UNVERIFIED**. The local PlatformIO configuration targets the STM32F407ZGT6 MCU at internal 16 MHz HSI without assigning peripheral pins. Phase 3 defines hardware-independent typed sensor/UI interfaces; no device drivers or physical probes are included. See [hardware inventory](docs/HARDWARE_INVENTORY.md) and [blockers](docs/BLOCKERS.md). No board runtime or classifier performance results are claimed.

## Architecture

**Sense → Process → Infer → Act → Record.** See [architecture](docs/ARCHITECTURE.md) for responsibilities and data flow.

## Repository map

- `firmware/`: future embedded application and board notes.
- `ml/`: future board-generated data, processing scripts, and exported models.
- `tests/`: future host unit and system integration tests.
- `tools/`: future capture, build, and evidence helpers.
- `evidence/`: future build, log, and test records.
- `docs/`: requirements, architecture, progress, blockers, inventory, and roadmap.

## Getting started

See [firmware build instructions](docs/BUILD.md). Run `pio run` to build the MCU foundation and `sh tools/test_host.sh` for hardware-independent checks. A successful compile does not establish RT-Spark board compatibility; do not upload until the physical board and debug interface are verified. Keep sensitive participant information and raw recordings out of Git unless explicitly reviewed and approved for sharing.

## Development phases

The six phases, measurable deliverables, and acceptance evidence are tracked in [the roadmap](docs/ROADMAP.md) and [requirements matrix](docs/REQUIREMENTS.md). The current phase status is in [progress](docs/PROGRESS.md).
