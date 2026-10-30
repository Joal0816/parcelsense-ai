# ParcelSense AI

ParcelSense AI is an offline, on-device package-handling classifier project for BCA182 Embedded Systems Programming, Laboratory Activity No. 4. Its intended target is the RT-Thread RT-Spark with STM32F407ZGT6. The firmware foundation, host-side 24-feature/inference boundary, and Phase 4 processing/export pipeline are available, but none has been run on an RT-Spark board. Physical sensor drivers, a real-data model, task-connected inference, and serial output are not implemented.

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

The project selection and tradeoffs are summarized in [project rationale](docs/PROJECT_RATIONALE.md). Laboratory reporting, test acceptance, and demonstration guidance are in the [report outline](docs/REPORT_OUTLINE.md), [test plan](docs/TEST_PLAN.md), [software demo script](docs/DEMO_SCRIPT.md), and [evidence manifest](evidence/README.md). License and third-party notice status is recorded in [attribution notes](docs/ATTRIBUTION.md).

## Repository map

- `firmware/`: future embedded application and board notes.
- `ml/`: processing scripts, a clearly labeled synthetic-only demonstration dataset/model, and reserved locations for future board-generated data and real model exports.
- `tests/`: future host unit and system integration tests.
- `frontend/`: local-first PWA with synthetic-demo and STM32-capture CSV review modes; no device transport is implemented.
- `backend/`: optional loopback development API for synthetic demo CSV and explicit reviewed-session storage; no STM32 link is implemented.
- `tools/`: future capture, build, and evidence helpers.
- `evidence/`: future build, log, and test records.
- `docs/`: requirements, architecture, progress, blockers, inventory, and roadmap.

## Getting started

See [firmware build instructions](docs/BUILD.md). Run `pio run` to build the MCU foundation and `sh tools/test_host.sh` for hardware-independent checks. A successful compile does not establish RT-Spark board compatibility; do not upload until the physical board and debug interface are verified. Keep sensitive participant information and raw recordings out of Git unless explicitly reviewed and approved for sharing.

The offline CSV processing steps and synthetic-only pipeline tests are described in [the ML pipeline guide](docs/ML_PIPELINE.md). Real capture requires the board and an instructor-reviewed safe labeling protocol.

The C feature extractor and sample-window inference boundary are host-testable and checked against the Python feature contract. They are not connected to firmware tasks until physical sensors and a real-data model are verified. Run `sh tools/test_host.sh`, `python3 -m unittest discover -s tests/ml -v`, `python3 -m unittest discover -s backend/tests -v`, and `python3 tools/check_docs.py` for software checks. Frontend checks are `cd frontend && npm ci && npm run typecheck && npm test && npm run build`. The [software test plan](docs/TEST_PLAN.md) lists browser, release, and hardware-gated checks.

A separate [ParcelSense Field Desk PWA](frontend/README.md) is available for local CSV/session and evaluation review. It includes a synthetic sample for trying the workflow now and an STM32 capture mode for importing a compatible file when board data becomes available. See the [Field Desk user guide](docs/ParcelSense%20User%20Guide.md) for step-by-step instructions. Run `cd frontend && npm ci && npm run dev:local` to start both the loopback PWA and optional local API. It is an optional review tool; embedded inference remains independent of it. The [frontend/PWA plan](docs/FRONTEND_PWA_PLAN.md) tracks its remaining validation work.

The local API stores explicitly reviewed CSV copies in a local SQLite database. See [backend instructions](backend/README.md). The PWA's bundled synthetic values are software fixtures, not STM32 readings or classifier evidence. The local API is not part of the hosted static PWA.

The Field Desk is live at [parcelsense-ai.pages.dev](https://parcelsense-ai.pages.dev) and [parcelsense.joalvergs.tech](https://parcelsense.joalvergs.tech). Deployment and DNS details are in the [PWA deployment guide](docs/PWA_DEPLOYMENT.md).

## Development phases

The six phases, measurable deliverables, and acceptance evidence are tracked in [the roadmap](docs/ROADMAP.md) and [requirements matrix](docs/REQUIREMENTS.md). The current phase status is in [progress](docs/PROGRESS.md).

For the board-unavailable case, see the explicitly **synthetic-only software report** in [docs/SYNTHETIC_ONLY_REPORT.md](docs/SYNTHETIC_ONLY_REPORT.md). Its generated data and model artifacts demonstrate the host pipeline only; they do not replace the lab's real board, real-data, on-device inference, or live demonstration requirements.
