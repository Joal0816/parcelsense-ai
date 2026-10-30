# ParcelSense AI — synthetic-only software report

> **Scope:** This is a transparent, software-only simulation package prepared because the RT-Spark/STM32 board is unavailable. It is not evidence that the complete Laboratory Activity No. 4 has been performed or passed. The lab PDF requires a real board, board-collected data, inference on the STM32, and a live prototype demonstration. Obtain the instructor's approval before treating this as an alternative submission.

**Student:** [Enter name]  
**Subject/section:** [Enter section]  
**Date:** [Enter date]  
**Project:** ParcelSense AI

## 1. Project concept

ParcelSense is a proposed package-handling monitor for a person who wants to review whether a parcel was mostly stationary, moved in a routine way, or experienced rougher motion. Its intended output classes are **Stable**, **Normal Handling**, and **Rough Handling**. These are project labels only; their physical definitions and safe operating thresholds have not been validated.

The intended product architecture uses motion sensing, windowed signal features, a compact classifier, and local user feedback. Alternatives considered were a fixed acceleration threshold, cloud classification, and camera-based inspection. The threshold remains a baseline; cloud classification conflicts with the lab's offline requirement; and a camera is not part of the verified target hardware.

The project has a browser-based Field Desk for reviewing CSV files and model reports. It does not connect to the STM32, capture live sensor readings, or perform product inference. The web application and generated data support a software demonstration only.

## 2. Simulation method

The reproducible generator is [`ml/scripts/generate_synthetic.py`](../ml/scripts/generate_synthetic.py). With seed `182`, it creates three deliberately distinct motion patterns using fixed class-specific amplitude/noise ranges. It writes a provenance manifest next to the CSV. The generated patterns are designed to exercise the processing pipeline; they are not a physical model of parcels or of the RT-Spark's sensors.

| Simulation parameter | Value |
|---|---:|
| Labels | 3 |
| Generated trial groups per label | 4 |
| Windows per trial group | 10 |
| Samples per window | 100 |
| Configured simulation cadence | 50 Hz |
| Generated rows | 12,000 |
| Complete windows | 120 (40 per label) |
| Grouped split | 90 training windows and 30 held-out windows |
| Excluded rows/windows | 0 |

The train/held-out split keeps complete generated trial IDs together: 30 training windows and 10 held-out windows per label. This demonstrates the pipeline's split mechanics. The held-out groups still come from the same synthetic signal generator and parameter ranges, so the split does not establish independence from real-world conditions.

## 3. Processing and model

The pipeline validates the CSV, forms non-overlapping windows, extracts 24 motion features, and compares a median-threshold baseline with a bounded depth-3 decision tree. It exports the window feature table, exclusions list, `model.json`, and `model.c` under [`ml/models/synthetic/`](../ml/models/synthetic/). The report contains `data_origin: synthetic`; the Field Desk's Evaluation review page should show its synthetic warning when this JSON is loaded.

The threshold and tree each scored 30/30 on this generated held-out set. The confusion matrix for each, with rows as expected labels and columns as predictions ordered Stable / Normal Handling / Rough Handling, was:

| Expected \ predicted | Stable | Normal Handling | Rough Handling |
|---|---:|---:|---:|
| Stable | 10 | 0 | 0 |
| Normal Handling | 0 | 10 | 0 |
| Rough Handling | 0 | 0 | 10 |

Each synthetic class has precision 1.00, recall 1.00, and F1 1.00 in this run; macro-F1 is 1.00. The result is expected because the generator deliberately assigns separated motion amplitudes to the labels. It measures only that this dataset and pipeline can produce a clean software example. **It is not a real-data accuracy estimate and must not be presented as classifier performance on parcels.**

## 4. Software architecture and evidence

The software demonstration follows this path:

```text
Deterministic synthetic generator
  → CSV validation and windowing
  → 24-feature extraction
  → threshold baseline and decision-tree comparison
  → synthetic-tagged JSON/C exports
  → Field Desk report review
```

The STM32 target path is not complete. The repository includes an MCU-level PlatformIO/STM32Cube/FreeRTOS build foundation and typed software interfaces, but no verified RT-Spark board profile, sensor drivers, board-generated dataset, selected real-data model, task-connected inference, serial output, or physical user feedback. The four FreeRTOS tasks are placeholders for live sensor/inference/feedback work; a successful MCU cross-build is not a board run.

Previously recorded software checks and their limits are listed in [`evidence/README.md`](../evidence/README.md), [`docs/PROGRESS.md`](PROGRESS.md), and [`docs/TEST_PLAN.md`](TEST_PLAN.md). They cover host-side behavior, pipeline mechanics, frontend behavior, and compilation. They do not establish hardware compatibility or product behavior.

## 5. Requirements status against the laboratory activity

| Activity requirement | Synthetic-only package status |
|---|---|
| Product concept, alternatives, and three proposed states | Documented; physical class definitions and acceptance criteria still require instructor review and measurement. |
| Board audit and integrated sensor/module diagnostics | Not performed; no physical board was available. |
| STM32Cube/FreeRTOS application on verified RT-Spark | MCU software foundation only; board compatibility and live operation are unverified. |
| Board-collected dataset and real held-out model validation | Not performed; generated CSV is explicitly synthetic. |
| Trained model inference and immediate feedback on STM32 | Not performed; generated export is not linked to target firmware. |
| On-device timing, memory, offline, fault, and continuous-run results | Not measured. |
| Complete lab report and live hardware demonstration | This document covers the simulation only; live RT-Spark demonstration is unavailable. |

Accordingly, this package can demonstrate software preparation if the instructor accepts it as an alternative. It does not satisfy the PDF's standard hardware/data/inference demonstration requirements on its own.

## 6. Limitations and next steps

The simulation does not account for actual sensor noise, sensor orientation, mounting, sample jitter, calibration, parcel variety, human labeling variation, board resources, or environmental effects. No physical sensing, controls, user feedback, safety behavior, privacy behavior on-device, inference latency, or runtime memory use has been evaluated.

If board access is granted later, the next work is to verify the board revision and fitted modules; obtain approval for safe label definitions; capture and split real trials; compare the baseline and model on real held-out trials; connect the reviewed model to firmware; then record target diagnostics, timing, memory, offline operation, reliability, and a live demonstration. See the [board-arrival checklist](BOARD_ARRIVAL_CHECKLIST.md).

## 7. Reproduction

From the repository root, run:

```sh
python3 ml/scripts/generate_synthetic.py \
  --output ml/data/synthetic/activity4-synthetic-only.csv \
  --seed 182
python3 ml/scripts/pipeline.py train \
  --input ml/data/synthetic/activity4-synthetic-only.csv \
  --output-dir ml/models/synthetic \
  --window-samples 100 --min-train 30 --min-test 10 --seed 182 \
  --data-origin synthetic
```

To demonstrate the visual CSV workflow, use **Overview → Try the synthetic demo** in the hosted Field Desk. To review the generated pipeline report, open **Evaluation review** and load `ml/models/synthetic/model.json`. Both are software demonstrations and should be identified as synthetic.

## 8. Google Classroom disclaimer

> **Disclaimer:** I did not have access to the RT-Spark/STM32 board. This submission uses generated synthetic data for a software-only demonstration of CSV processing, feature extraction, and the model-export pipeline. The synthetic values are not sensor readings, and the reported synthetic metrics are not real parcel-classification performance. I did not perform board diagnostics, real data collection, on-device inference, hardware timing/memory measurements, or a live board demonstration. Please advise whether this can be accepted as an alternative submission or whether I should complete the hardware portion during a make-up session.
