# Development roadmap

Six phases are planned. Work stops at each genuine hardware gate until the relevant board evidence is available. **Phase 1 and the software-only portion of Phase 2 are complete.**

| Phase | Focus | Measurable deliverables / exit evidence |
|---|---|---|
| 1. Initialization | Repository, requirements, design, inventory, blockers | Required directory tree and documents exist; relative Markdown links resolve; Git status reviewed; no hardware claims. |
| 2. Firmware foundation | PlatformIO `ststm32` + `stm32cube`, STM32Cube HAL/LL, FreeRTOS | Reproducible target build where tooling and verified board configuration permit; at least three independent FreeRTOS tasks; build log and Flash/RAM report. Board manifest, clock, linker and interrupt settings documented with evidence. |
| 3. Sensor interfaces | Verify and bring up installed sensing/UI modules | Inventory evidence for each physical module; bus/pin mapping from board documentation or inspection; diagnostics report detected/absent/fault state for every supported module; safe invalid-data handling. |
| 4. ML pipeline | Real board capture, processing, baseline and model comparison | Board-generated labeled dataset; at least 30 training and 10 held-out windows per class separated by trial/session; threshold baseline compared with compact model; confusion matrix, per-class precision/recall and macro-F1; preprocessing and export artifacts. Synthetic data may test pipeline mechanics only. |
| 5. Embedded inference | Offline feature and model inference with local feedback | On-device three-class inference with input validation; at least 50 timing samples with median and p95; measured sampling-to-response latency; compiled Flash, FreeRTOS heap and task stack usage recorded. |
| 6. Testing and documentation | Independent evaluation, reliability, evidence and handoff | At least 20 additional independent trials per state; at least 15-minute continuous run, 5-minute offline run and controlled fault test; logs, test report, reproducible instructions, evidence manifest and limitations. |

## Hardware gates

Before board-dependent claims: identify exact RT-Spark revision; obtain authoritative schematic/pinout and board support configuration; inspect installed modules; verify debugger/programming access and power; record actual toolchain and build. Then test module diagnostics and capture data on the target. Never substitute synthetic samples for actual board-generated evaluation data.
