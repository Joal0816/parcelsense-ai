# ParcelSense AI

ParcelSense AI is a proposed offline, on-device package-handling classifier for BCA182 Embedded Systems Programming, Laboratory Activity No. 4. Its target is the RT-Thread RT-Spark with STM32F407ZGT6. Phase 1 establishes the repository and verification plan; it does not include firmware, trained models, or hardware validation.

## Objective

Capture package motion on the board, classify handling locally, provide a local indication, and record diagnostic/evaluation data. The intended classes are **Stable**, **Normal Handling**, and **Rough Handling**. Class boundaries will be defined from repeatable labeled trials and evaluated against a transparent baseline before claiming useful classification performance.

## Intended technology

- PlatformIO with `ststm32` and `stm32cube`.
- STM32Cube HAL/LL and FreeRTOS (integration and configuration to be verified in a later phase).
- Offline on-device inference; no network is required by the prediction path.
- Python tooling for board-data processing, training, validation, and compact model export.

The RT-Spark revision, installed sensors and UI, pinout, clocks, storage, debugger, and board-specific PlatformIO manifest are **UNVERIFIED**. See [hardware inventory](docs/HARDWARE_INVENTORY.md) and [blockers](docs/BLOCKERS.md). No performance or test results are claimed.

## Planned architecture

**Sense → Process → Infer → Act → Record.** See [architecture](docs/ARCHITECTURE.md) for responsibilities and data flow.

## Repository map

- `firmware/`: future embedded application and board notes.
- `ml/`: future board-generated data, processing scripts, and exported models.
- `tests/`: future host unit and system integration tests.
- `tools/`: future capture, build, and evidence helpers.
- `evidence/`: future build, log, and test records.
- `docs/`: requirements, architecture, progress, blockers, inventory, and roadmap.

## Getting started

This initialization requires no installed dependencies. Later firmware work is planned around PlatformIO; the exact toolchain and board configuration remain a verification task. Do not treat host-side builds as proof of board operation. Keep sensitive participant information and raw recordings out of Git unless explicitly reviewed and approved for sharing.

## Development phases

The six phases, measurable deliverables, and acceptance evidence are tracked in [the roadmap](docs/ROADMAP.md) and [requirements matrix](docs/REQUIREMENTS.md). The current phase status is in [progress](docs/PROGRESS.md).
