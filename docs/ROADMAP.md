# Development roadmap

Six phases are planned. Work stops at each genuine hardware gate until the relevant board evidence is available. **Phases 1–4 software work is complete. The Phase 5 portable feature extraction and sample-window inference path is implemented and host-tested. Physical inventory/diagnostics, board capture/real-data evaluation, task-connected model inference, and all target measurements remain pending because no board or real dataset is available. Phase 6 software handoff documentation and automated checks are in place; board-level validation remains pending.**

| Phase | Focus | Measurable deliverables / exit evidence |
|---|---|---|
| 1. Initialization | Repository, requirements, design, inventory, blockers | Required directory tree and documents exist; relative Markdown links resolve; Git status reviewed; no hardware claims. |
| 2. Firmware foundation | PlatformIO `ststm32` + `stm32cube`, STM32Cube HAL/LL, FreeRTOS | Reproducible target build where tooling and verified board configuration permit; at least three independent FreeRTOS tasks; build log and Flash/RAM report. Board manifest, clock, linker and interrupt settings documented with evidence. |
| 3. Sensor interfaces | Define interfaces; then verify and bring up installed sensing/UI modules | Typed IMU/context/UI interfaces and host validity/fault tests (software portion complete); inventory evidence for each physical module; bus/pin mapping from board evidence; diagnostics for each supported module; safe invalid-data handling. Physical acceptance remains gated on board inspection. |
| 4. ML pipeline | Capture protocol, processing, baseline and model comparison | **Software gate complete:** documented CSV schema and draft 50 Hz/2-second capture protocol; host pipeline validates/cleans, creates features, separates trials, compares baseline/tree, reports metrics, exports C, and passes synthetic-only host parity tests. **Hardware/data gate pending:** board-generated labeled dataset; at least 30 training and 10 held-out windows per class separated by trial/session; held-out real-data metrics and reviewed export. Synthetic data may test pipeline mechanics only. |
| 5. Embedded inference | Offline feature and model inference with local feedback | **Software portion complete:** C features match the Python pipeline in host parity tests; a host-testable sample-window → feature → model callback composition rejects invalid samples. **Hardware/data portion pending:** connect a real sensor source and evaluated model to `InferenceTask`/verified feedback; at least 50 target timing samples with median/p95; sampling-to-response latency; runtime heap/stack measurements. |
| 6. Testing and documentation | Independent evaluation, reliability, evidence and handoff | **Software documentation portion complete:** test plan, evidence index, demo script, report outline, rationale, attribution status, Arch/Linux and build instructions, and local Markdown-link CI check. **Hardware validation pending:** at least 20 additional independent trials per state; 15-minute continuous run, 5-minute offline target inference, controlled fault test, and measured target results. |

## Hardware gates

Before board-dependent claims: identify exact RT-Spark revision; obtain authoritative schematic/pinout and board support configuration; inspect installed modules; verify debugger/programming access and power; record actual toolchain and build. Then test module diagnostics and capture data on the target. Never substitute synthetic samples for actual board-generated evaluation data. Follow the detailed [board-arrival checklist](BOARD_ARRIVAL_CHECKLIST.md).

## Next steps

1. When the board arrives, follow `BOARD_ARRIVAL_CHECKLIST.md`: identify the board and modules, reconcile the MCU profile and memory map, then verify debugger and power before upload.
2. Complete the Phase 3 physical diagnostics gate, then capture instructor-approved board data for Phase 4; do not use synthetic fixtures as a substitute.
3. Once real held-out evaluation is accepted, connect the reviewed model and physical sample source to `InferenceTask`, then record target latency and runtime memory.
4. Complete Phase 6 hardware trials, reliability, offline target checks, and the remaining evidence. The optional PWA transport remains gated on a verified board protocol.
