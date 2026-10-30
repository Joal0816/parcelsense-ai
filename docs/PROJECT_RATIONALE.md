# Project rationale and alternatives

## Why ParcelSense AI

ParcelSense AI applies embedded sensing and offline classification to a concrete handling question: distinguish **Stable**, **Normal Handling**, and **Rough Handling** from motion windows. This gives the lab a path through sensor interfaces, labeled data collection, leakage-aware model evaluation, compact C export, and local feedback. The labels are project categories; their operational definitions and any safety-related thresholds still require instructor review and real trials.

The STM32 is the intended inference target. Prediction must remain local and independent of the browser companion, internet access, or a hosted service. The Field Desk is an optional tool for importing, reviewing, exporting, and presenting evidence.

## Alternatives considered

| Alternative | Benefit | Why ParcelSense's current direction was chosen | Tradeoff or open issue |
| --- | --- | --- | --- |
| Fixed acceleration threshold only | Small and easy to reason about on a microcontroller. | Keep a threshold as a transparent baseline, then compare it with a compact tree on held-out trials. | A threshold is not a validated handling rule and may miss differences in motion patterns. |
| Cloud-based inference and dashboard | Centralized processing and easier remote aggregation. | The assignment calls for offline local classification; keeping the prediction path on the MCU reduces connectivity dependence and avoids sending motion data to a service. | The browser review tool is not a cloud sync system and does not provide remote collaboration. |
| Camera-based parcel inspection | Visual inspection can reveal package or label conditions. | Motion sensing matches the available embedded target and the lab's focus on real-time embedded sensing/classification. | No camera is verified or required by this project's hardware inventory; image-based claims are out of scope. |

These are engineering tradeoffs, not results from a measured comparison. The project has no board-generated dataset yet, so no option has demonstrated classification quality. Revisit the choice if the instructor changes the lab requirements or the verified board has materially different resources.

## Constraints that shape the implementation

- The exact RT-Spark revision, installed sensors, buses, clock, memory map, and programmer have not been verified.
- The repository's STM32F407ZG profile is an MCU-level compile foundation, not a verified board definition.
- Synthetic fixtures verify software mechanics only. They are not sensor recordings or evidence of model performance.
- Physical inventory, data collection, model selection, embedded inference, runtime measurements, and reliability trials remain gated on board access and instructor-approved procedures.

See the [architecture](ARCHITECTURE.md), [requirements matrix](REQUIREMENTS.md), and [hardware blockers](BLOCKERS.md) for the current evidence boundary.
