# Draft capture protocol

**Status: DRAFT — hardware and instructor review required. No capture has been performed.** The rates below are initial software targets, not verified capabilities of the RT-Spark or an installed sensor.

## Initial recording format

- Target 50 samples/second and 2-second non-overlapping windows (100 samples/window), subject to verified sensor data rate, timestamp behavior, scheduling jitter, and storage/transfer limits.
- Record all six motion axes, validity/status, timestamp, opaque session/trial IDs, and the operator-assigned label. Include optional context columns only when that sensor is physically verified and its units are confirmed.
- Keep one class label per trial. Mark start/stop and handling event boundaries consistently; do not include transitions unless the labeling guide explicitly assigns them.
- Capture enough independent trials to produce at least 30 training and 10 held-out windows per class. Split by whole trial/session before model selection; keep additional evaluation trials separate from tuning.

## Safe, repeatable trial procedure

1. Before collection, obtain instructor approval for operational definitions of **Stable**, **Normal Handling**, and **Rough Handling**, and for a safe handling setup. The labels do not yet have force, acceleration, or drop-height thresholds.
2. Verify the board, sensor identity, mounting, axes, units, sample rate, timestamp source, and diagnostic status. Record board revision, verified module/configuration, firmware revision, operator code, parcel mass category, orientation, session, trial, and environmental notes in a separate non-identifying manifest.
3. Secure the board and parcel with an approved fixture or controlled hand procedure. Use a clear, padded work area; keep people and fragile contents clear. Do not drop parcels from height, throw them, or perform any action outside the instructor-approved protocol.
4. Record a quiet baseline, then perform only the approved labeled handling action. Start a fresh trial for each repeated action and label from the protocol, not from what the classifier predicts.
5. Stop immediately for a loose mount, unexpected sensor fault, damaged parcel, unsafe movement, or discomfort. Mark the affected samples invalid; do not relabel or silently repair them.
6. Review timestamps, sample gaps, sensor status, class counts, and exclusions after each session. Repeat a trial only under the same written protocol and assign a new trial ID.

Vary parcel mass, orientation, operator, and recording session where feasible and approved. Record these as evaluation metadata, not as personal identifiers. Do not collect personal data. Preserve original raw files read-only; keep a manifest of exclusions and transformations. A missing board means this protocol remains a draft and all real-data model metrics remain **PENDING**.
