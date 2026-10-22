# Development roadmap

Six phases are planned. Work stops at each genuine hardware gate until the relevant board evidence is available. **Phases 1–3 software work and the Phase 4 host pipeline are complete. Phase 3 physical inventory/diagnostics and Phase 4 board capture/real-data evaluation remain pending because the board is not available. Phase 5 has not started.**

| Phase | Focus | Measurable deliverables / exit evidence |
|---|---|---|
| 1. Initialization | Repository, requirements, design, inventory, blockers | Required directory tree and documents exist; relative Markdown links resolve; Git status reviewed; no hardware claims. |
| 2. Firmware foundation | PlatformIO `ststm32` + `stm32cube`, STM32Cube HAL/LL, FreeRTOS | Reproducible target build where tooling and verified board configuration permit; at least three independent FreeRTOS tasks; build log and Flash/RAM report. Board manifest, clock, linker and interrupt settings documented with evidence. |
| 3. Sensor interfaces | Define interfaces; then verify and bring up installed sensing/UI modules | Typed IMU/context/UI interfaces and host validity/fault tests (software portion complete); inventory evidence for each physical module; bus/pin mapping from board evidence; diagnostics for each supported module; safe invalid-data handling. Physical acceptance remains gated on board inspection. |
| 4. ML pipeline | Capture protocol, processing, baseline and model comparison | **Software gate complete:** documented CSV schema and draft 50 Hz/2-second capture protocol; host pipeline validates/cleans, creates features, separates trials, compares baseline/tree, reports metrics, exports C, and passes synthetic-only host parity tests. **Hardware/data gate pending:** board-generated labeled dataset; at least 30 training and 10 held-out windows per class separated by trial/session; held-out real-data metrics and reviewed export. Synthetic data may test pipeline mechanics only. |
| 5. Embedded inference | Offline feature and model inference with local feedback | On-device three-class inference with input validation; at least 50 timing samples with median and p95; measured sampling-to-response latency; compiled Flash, FreeRTOS heap and task stack usage recorded. |
| 6. Testing and documentation | Independent evaluation, reliability, evidence and handoff | At least 20 additional independent trials per state; at least 15-minute continuous run, 5-minute offline run and controlled fault test; logs, test report, reproducible instructions, evidence manifest and limitations. |

## Hardware gates

Before board-dependent claims: identify exact RT-Spark revision; obtain authoritative schematic/pinout and board support configuration; inspect installed modules; verify debugger/programming access and power; record actual toolchain and build. Then test module diagnostics and capture data on the target. Never substitute synthetic samples for actual board-generated evaluation data. Follow the detailed [board-arrival checklist](BOARD_ARRIVAL_CHECKLIST.md).

## Next steps

1. When the board arrives, follow `BOARD_ARRIVAL_CHECKLIST.md`: identify the board and modules, reconcile the MCU profile and memory map, then verify debugger and power before upload.
2. Complete the Phase 3 physical diagnostics gate, then capture instructor-approved board data for Phase 4; do not use synthetic fixtures as a substitute.
3. Once real held-out evaluation is accepted, begin Phase 5 model integration and record target latency and runtime memory.
4. Finish Phase 6 reliability, independent trials, offline checks, and the submission evidence index. The optional PWA transport remains gated on a verified board protocol.
