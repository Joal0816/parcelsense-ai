# ParcelSense AI

ParcelSense AI is an offline, on-device package-handling classifier project for BCA182 Embedded Systems Programming, Laboratory Activity No. 4. Its intended target is the RT-Thread RT-Spark with STM32F407ZGT6. The firmware foundation builds, and a host-side Phase 4 processing/export pipeline is available, but neither has been run on an RT-Spark board. Sensors, embedded model inference, and serial output are not implemented.

## Objective

Capture package motion on the board, classify handling locally, provide a local indication, and record diagnostic/evaluation data. The intended classes are **Stable**, **Normal Handling**, and **Rough Handling**. Class boundaries will be defined from repeatable labeled trials and evaluated against a transparent baseline before claiming useful classification performance.

## Intended technology

- PlatformIO with `ststm32` and `stm32cube`.
- STM32Cube HAL/LL and the CubeF4-bundled FreeRTOS GCC Cortex-M4F port.
- Offline on-device inference; no network is required by the prediction path.
- Python tooling for board-data processing, training, validation, and compact model export.

The RT-Spark revision, installed sensors and UI, pinout, clock source, programmer, and physical board compatibility are **UNVERIFIED**. The local PlatformIO configuration targets the STM32F407ZGT6 MCU at internal 16 MHz HSI without assigning peripheral pins. Phase 3 defines hardware-independent typed sensor/UI interfaces; no device drivers or physical probes are included. See [hardware inventory](docs/HARDWARE_INVENTORY.md), [blockers](docs/BLOCKERS.md), and the [board-arrival checklist](docs/BOARD_ARRIVAL_CHECKLIST.md). No board runtime or classifier performance results are claimed.

## Architecture

**Sense → Process → Infer → Act → Record.** See [architecture](docs/ARCHITECTURE.md) for responsibilities and data flow.

## Repository map

- `firmware/`: future embedded application and board notes.
- `ml/`: future board-generated data, processing scripts, and exported models.
- `tests/`: future host unit and system integration tests.
- `frontend/`: optional local-first PWA for CSV/session and evaluation review; no device transport is implemented.
- `backend/`: optional loopback development API for synthetic demo CSV and explicit reviewed-session storage; no STM32 link is implemented.
- `tools/`: future capture, build, and evidence helpers.
- `evidence/`: future build, log, and test records.
- `docs/`: requirements, architecture, progress, blockers, inventory, and roadmap.

## Getting started

See [firmware build instructions](docs/BUILD.md). Run `pio run` to build the MCU foundation and `sh tools/test_host.sh` for hardware-independent checks. A successful compile does not establish RT-Spark board compatibility; do not upload until the physical board and debug interface are verified. Keep sensitive participant information and raw recordings out of Git unless explicitly reviewed and approved for sharing.

The offline CSV processing steps and synthetic-only pipeline tests are described in [the ML pipeline guide](docs/ML_PIPELINE.md). Real capture requires the board and an instructor-reviewed safe labeling protocol.

A separate [ParcelSense Field Desk PWA](frontend/README.md) is available for local CSV/session and evaluation review. Run `cd frontend && npm ci && npm run dev` to open it at `http://localhost:5173`. It is an optional review tool; embedded inference remains independent of it. The [frontend/PWA plan](docs/FRONTEND_PWA_PLAN.md) tracks its remaining validation work.

For local backend integration, start `python3 backend/server.py` from the repository root before opening the Field Desk. It provides generated synthetic sample data and stores reviewed CSV copies in a local SQLite database. See [backend instructions](backend/README.md). Synthetic values are software fixtures, not STM32 readings or classifier evidence. The API is not part of the hosted static PWA.

The Field Desk is live at [parcelsense-ai.pages.dev](https://parcelsense-ai.pages.dev). Its intended custom address, `parcelsense.joalvergs.tech`, is associated with Pages and awaits the Name.com CNAME listed in the [PWA deployment guide](docs/PWA_DEPLOYMENT.md).

## Development phases

The six phases, measurable deliverables, and acceptance evidence are tracked in [the roadmap](docs/ROADMAP.md) and [requirements matrix](docs/REQUIREMENTS.md). The current phase status is in [progress](docs/PROGRESS.md).
