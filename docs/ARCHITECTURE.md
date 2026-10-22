# Planned architecture

The system is organized as **Sense → Process → Infer → Act → Record**. Phase 2 provides task and data-flow placeholders. No sensor drivers, trained model, or physical feedback is implemented.

1. **Sense:** Acquire timestamped motion readings from the verified onboard IMU and optional verified context sensors. Attach units and validity/error status. Never assume a sensor, bus, or pin before inspection.
2. **Process:** Validate samples, handle missing/invalid values, form fixed-duration windows, and apply the same documented features and scaling used during model training.
3. **Infer:** Run a compact, exported classifier locally on the STM32F407. Emit Stable, Normal Handling, or Rough Handling with any confidence/quality metadata the selected model supports. Invalid input must not produce an unqualified classification.
4. **Act:** Present the state using verified onboard display/LED/buzzer components where available. Keep handling feedback local and avoid blocking acquisition.
5. **Record:** Capture diagnostics, labels, timings, faults, and experiment metadata for evaluation. Logging must not disrupt sampling or inference. Network access is not part of the prediction path.

## Planned scheduling

The firmware uses independently scheduled FreeRTOS responsibilities for acquisition, inference, feedback, and diagnostics. Queues and task notifications define ownership and data flow. The current task count and rates are provisional; priorities, stack sizes, interrupt priorities, and periods need measurement and board-specific review.

### Phase 2 implementation

`SensorTask` emits 100 ms liveness heartbeats with `sensor_valid=false`. A one-element overwrite queue passes the latest heartbeat to `InferenceTask`; the placeholder result always has `classification_valid=false` and `HANDLING_UNAVAILABLE`. A second one-element queue passes the result to `FeedbackTask`, which records a bounded event and notifies `DiagnosticTask`. Diagnostics expose heartbeat count, minimum FreeRTOS heap, task stack high-water marks, latest result, and a 32-record RAM log through debugger-visible state. No UART is initialized because the RT-Spark UART mapping has not been verified.

The GCC `ARM_CM4F` port owns SVC, PendSV, and SysTick. SysTick is the 1 kHz FreeRTOS tick. HAL's 1 ms tick uses internal TIM6 and `TIM6_DAC_IRQHandler`; this avoids HAL/RTOS SysTick ownership conflict. The foundation clock selects internal 16 MHz HSI without PLL, HSE, or board-specific pin configuration. Board clock accuracy and suitability remain unverified. FreeRTOS uses `heap_4` with a 24 KiB arena in main SRAM. Task stack depths are provisional 32-bit words and runtime high-water marks are not yet measured.

## Data and evaluation flow

Board capture produces trial/session-identified labeled records. Preprocessing splits data by trial/session to reduce leakage, compares a simple threshold baseline with compact candidates, and exports fixed preprocessing parameters with the chosen model. Host parity checks support model integration; final performance claims require held-out real board trials. Synthetic samples, if later used, are limited to clearly labeled pipeline smoke tests.

## Constraints and limitations

- Exact board revision, component population, pinout, buses, clock setup, linker script, debugger, and PlatformIO manifest are unverified.
- STM32F407ZG local linker evidence describes 1 MiB Flash, 128 KiB main SRAM, and 64 KiB CCM RAM. This corrects the Phase 1 wording: 192 KiB is combined main SRAM plus CCM, not main SRAM alone. The PlatformIO SRAM limit is 128 KiB; this project leaves CCM unused. These capacities do not establish free application memory.
- Local PlatformIO board metadata and linker scripts for STM32F407ZG plus the installed CubeF4 package support the MCU-level configuration. No local RT-Spark schematic, board revision record, or authoritative RT-Spark manifest was found. The custom manifest is therefore an MCU foundation profile, not proof of RT-Spark board mapping.
- No sensor readings, class thresholds, data volume, accuracy, latency, or memory use have been measured.
- Classification quality depends on safe, repeatable labeling and independent trials across realistic parcel masses, orientations, operators, and sessions.
- Offline prediction does not itself establish safety, tamper detection, or suitability for every parcel type.
