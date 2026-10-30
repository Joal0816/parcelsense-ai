# Synthetic-only model artifacts

`model.json`, `model.c`, `windows_features.csv`, and `exclusions.csv` are exported from the generated simulation dataset in `ml/data/synthetic/`. The report declares `data_origin: synthetic`, and the Field Desk displays a synthetic provenance warning.

The C source is an export-format example only. It is not linked into the STM32 firmware, has not run on the RT-Spark, and must not be described as a validated ParcelSense model.

Regenerate the data and artifacts from the repository root:

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
