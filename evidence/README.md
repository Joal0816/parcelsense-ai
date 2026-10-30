# Evidence manifest

This index describes evidence currently in the repository and separates host/software artifacts from hardware evidence. A log's presence is not proof beyond the command and revision it records. Check the date, source commit, tool versions, and exit status in each artifact before citing it.

## Existing software evidence

| Artifact | What it supports | What it does not establish |
| --- | --- | --- |
| `build/phase2-pio-run.log` | Earlier PlatformIO compile/link attempt and tool output. | RT-Spark compatibility, upload, or runtime behavior. |
| `build/phase3-pio-run.log` | Phase 3 firmware interface build output. | Sensor presence, timing, free heap at runtime, or on-board operation. |
| `build/phase2-elf-audit.txt` | ELF section and linker reservation analysis for that recorded build. | Runtime FreeRTOS heap/stack headroom. |
| `tests/phase2-host-tests.log` | Earlier firmware host-test output. | Hardware behavior or classification quality. |
| `tests/phase3-host-tests.log` | Earlier sensor-interface/module-registry host tests. | Physical probes or sensor diagnostics. |
| `tests/phase4-firmware-host-tests.log` | Earlier classifier adapter, sensor validation, module registry, and log-buffer host tests. | A trained classifier or target inference. |
| `tests/phase4-ml-host-tests.log` | Earlier synthetic-only host pipeline checks and C/Python model-export parity. | Real dataset adequacy or model performance. |
| `build/phase5-host-feature-pio-run.log` | Clean MCU-profile compile/link with portable feature and inference modules included; 9,976 bytes Flash / 25,640 bytes RAM reported. | Board compatibility, upload, runtime measurement, or real inference. |
| `tests/phase5-host-inference-tests.log` | Sanitized host tests for feature extraction, inference composition, and existing firmware interfaces. | Target timing or sensor behavior. |
| `tests/phase5-ml-parity-tests.log` | Five temporary-fixture pipeline tests, including all-feature C/Python parity. | Real-data classifier performance. |
| `tests/phase5-backend-tests.log` | Seven local API unit tests. | Hosted backend behavior; no public API is deployed. |
| `tests/phase5-frontend-checks.log` | Frontend typecheck, 14 unit tests, and production static build. | Browser/device behavior beyond the listed automation. |
| `tests/phase5-frontend-e2e-local-api.log` | Chromium synthetic browser-to-local-API flow. | STM32 integration or physical capture. |
| `tests/phase5-frontend-e2e-readiness.log` | Chromium/Firefox semantics, responsive widths, offline app-shell checks. | Mobile screen-reader, Safari/iOS, or board behavior. |
| `tests/phase5-doc-links.log` | Local Markdown links resolved in the current checkout. | External URL availability or factual review. |
| `../docs/PWA_DEPLOYMENT.md` | Recorded web build, browser checks, and production release evidence. | Embedded offline inference or a live sensor link. |

New dated software checks should be added under `evidence/tests/` or `evidence/build/` and linked here. Record the exact command, revision, date, tool versions, exit status, and any warnings. Never replace a prior run in a way that removes its provenance.

## Hardware evidence: pending

No RT-Spark board evidence is currently available. The following must remain pending until observed and recorded:

- Exact board/revision, MCU marking, power/debug setup, authoritative schematic and pinout.
- Installed sensor/UI modules and repeatable per-module diagnostics.
- Board-generated labeled CSV, capture metadata, integrity checksums, and approved label protocol.
- Held-out real-trial evaluation and error analysis.
- On-target model output, at least 50 inference timing observations, sampling-to-response latency, runtime heap/stack, and continuous/fault/offline run logs.

Use the [board-arrival checklist](../docs/BOARD_ARRIVAL_CHECKLIST.md) to collect this evidence. Store participant-safe data only after privacy review; raw recordings remain ignored by Git by default.
