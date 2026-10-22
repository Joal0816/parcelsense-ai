# Planned architecture

The system is organized as **Sense → Process → Infer → Act → Record**. Interfaces and data contracts are planned here; no firmware or driver is implemented in Phase 1.

1. **Sense:** Acquire timestamped motion readings from the verified onboard IMU and optional verified context sensors. Attach units and validity/error status. Never assume a sensor, bus, or pin before inspection.
2. **Process:** Validate samples, handle missing/invalid values, form fixed-duration windows, and apply the same documented features and scaling used during model training.
3. **Infer:** Run a compact, exported classifier locally on the STM32F407. Emit Stable, Normal Handling, or Rough Handling with any confidence/quality metadata the selected model supports. Invalid input must not produce an unqualified classification.
4. **Act:** Present the state using verified onboard display/LED/buzzer components where available. Keep handling feedback local and avoid blocking acquisition.
5. **Record:** Capture diagnostics, labels, timings, faults, and experiment metadata for evaluation. Logging must not disrupt sampling or inference. Network access is not part of the prediction path.

## Planned scheduling

The firmware phase will define independently scheduled FreeRTOS responsibilities for acquisition, inference, feedback, and diagnostics as hardware and timing constraints allow. Queues or task notifications will make ownership and data flow explicit. Task count, rates, priorities, stack sizes, and interrupt priorities are not selected until the board configuration and measured workload are known.

## Data and evaluation flow

Board capture produces trial/session-identified labeled records. Preprocessing splits data by trial/session to reduce leakage, compares a simple threshold baseline with compact candidates, and exports fixed preprocessing parameters with the chosen model. Host parity checks support model integration; final performance claims require held-out real board trials. Synthetic samples, if later used, are limited to clearly labeled pipeline smoke tests.

## Constraints and limitations

- Exact board revision, component population, pinout, buses, clock setup, linker script, debugger, and PlatformIO manifest are unverified.
- STM32F407ZGT6 nominal capacities are commonly specified as up to 1 MiB Flash and 192 KiB SRAM, with additional 64 KiB CCM RAM that has different access/DMA constraints. Confirm the exact part datasheet and linker regions before budgeting; these capacities do not establish free application memory.
- No sensor readings, class thresholds, data volume, accuracy, latency, or memory use have been measured.
- Classification quality depends on safe, repeatable labeling and independent trials across realistic parcel masses, orientations, operators, and sessions.
- Offline prediction does not itself establish safety, tamper detection, or suitability for every parcel type.
