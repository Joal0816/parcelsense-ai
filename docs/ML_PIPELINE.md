# Offline Phase 4 ML pipeline

`ml/scripts/pipeline.py` provides a dependency-free host pipeline for schema-compatible CSV. It is not an acquisition program and there is no validated model trained on real ParcelSense board data. A separate synthetic-only dataset/model demonstrates the processing path; it is not a product model. See the [CSV schema](../ml/data/SCHEMA.md) and [draft capture protocol](../ml/data/CAPTURE_PROTOCOL.md).

For an explicitly synthetic software demonstration, [`generate_synthetic.py`](../ml/scripts/generate_synthetic.py) creates a deterministic fixture with an adjacent provenance manifest. Train it with `--data-origin synthetic`; the exported report carries that provenance into the Field Desk. The frontend sync script bundles this report into the PWA at development/build time, where Overview can open it with one action. Synthetic metrics only demonstrate pipeline mechanics. See the [synthetic-only report](SYNTHETIC_ONLY_REPORT.md) and [dataset notes](../ml/data/synthetic/README.md).

## Processing and split

The command validates required columns, schema version, class labels, timestamps, motion values, sensor validity/status, and trial label consistency. Invalid motion rows are recorded in an exclusions report and break a contiguous segment. Complete non-overlapping windows are featurized; incomplete tails are also reported. Optional context fields are retained only as CSV inputs in this version and are not used by the motion classifier.

Windows are split by `(session_id, trial_id)` with a deterministic seed. The default minimum is 30 training and 10 held-out windows per class. The pipeline fails if the recorded groups cannot meet both minima without splitting a trial. The held-out trials are used for the threshold-baseline and decision-tree comparison.

Features are per-axis mean, population standard deviation, and RMS for acceleration and angular velocity, plus acceleration-norm mean/std/RMS/maximum, gyro-norm RMS, and acceleration-jerk RMS. This is 24 input features. There is no learned scaling step. A simple ordinal threshold baseline uses training medians of acceleration-norm standard deviation; a deterministic depth-3 CART tree is the compact candidate. The threshold is a comparison baseline, not a validated handling rule.

The JSON report records the split, class counts, confusion matrices, per-class precision/recall/F1, macro-F1, and exclusions count. `model.c` exports the tree with a `parcelsense_predict()` entry point; its feature order and integer output mapping (index into `labels`, ordered Stable, Normal Handling, Rough Handling) are in `model.json`. The test suite compiles this C export and checks predictions against the Python tree. Firmware `features.c` implements the same ordered 24 window features, and a host parity check compares its outputs with this Python implementation on temporary synthetic fixtures.

## Run

With PlatformIO's existing Python environment or another Python 3 interpreter (standard library only):

```sh
python3 ml/scripts/pipeline.py train \
  --input ml/data/raw/session.csv \
  --output-dir /tmp/parcelsense-phase4 \
  --window-samples 100
```

The synthetic alternative can be reproduced with:

```sh
python3 ml/scripts/generate_synthetic.py \
  --output ml/data/synthetic/activity4-synthetic-only.csv --seed 182
python3 ml/scripts/pipeline.py train \
  --input ml/data/synthetic/activity4-synthetic-only.csv \
  --output-dir ml/models/synthetic \
  --window-samples 100 --min-train 30 --min-test 10 --seed 182 \
  --data-origin synthetic
```

At 50 Hz, 100 samples represent a nominal 2-second window; verify the actual sample cadence on the board before treating that duration as measured. The command writes `windows_features.csv`, `exclusions.csv`, `model.json`, and `model.c` into the chosen output directory. Review data privacy before processing or sharing recordings. Raw recordings and ordinary processed/model artifacts are ignored by Git by default; the clearly named synthetic demonstration CSV and synthetic model report are tracked separately for reproducibility.

## Evidence boundary

Automated fixtures are generated temporarily by `tests/ml/test_pipeline.py` and are named synthetic smoke tests. They only verify parser/windowing, group split, training mechanics, report generation, Python/C model-export parity, and Python/C feature parity. They do not establish real-world class separability, accuracy, safe thresholds, hardware sampling, latency, or embedded resource use. With no STM32 board or board-generated data, the Phase 4 real-data gate is open and all performance claims remain **PENDING**. The C feature/inference modules are software integration seams; no trained model is linked to the firmware task.
