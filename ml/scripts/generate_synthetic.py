#!/usr/bin/env python3
"""Generate a deterministic, synthetic-only ParcelSense motion dataset.

This simulator exercises the CSV and ML pipeline. Its signals are not sensor
measurements and are not intended to model physical parcel handling.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
from pathlib import Path

LABELS = ("Stable", "Normal Handling", "Rough Handling")
SIGNALS = {
    "Stable": (0.012, 0.003),
    "Normal Handling": (0.20, 0.015),
    "Rough Handling": (1.25, 0.09),
}
FIELDS = (
    "schema_version", "session_id", "trial_id", "timestamp_ms",
    "accel_x_m_s2", "accel_y_m_s2", "accel_z_m_s2",
    "gyro_x_rad_s", "gyro_y_rad_s", "gyro_z_rad_s",
    "valid", "status", "label", "ambient_illuminance_lux",
    "proximity_counts", "temperature_celsius", "relative_humidity_percent",
)


def generate(output: Path, *, seed: int, trials_per_class: int,
             windows_per_trial: int, window_samples: int,
             sample_rate_hz: int) -> dict[str, object]:
    if trials_per_class < 4:
        raise ValueError("use at least 4 trial groups per class for the 30/10 demo split")
    if windows_per_trial <= 0 or window_samples <= 1 or sample_rate_hz <= 0:
        raise ValueError("window and sample-rate values must be positive")
    if trials_per_class * windows_per_trial < 40:
        raise ValueError("each class needs at least 40 windows for the 30/10 demo split")

    rng = random.Random(seed)
    output.parent.mkdir(parents=True, exist_ok=True)
    row_count = 0
    with output.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        for label in LABELS:
            base_amplitude, noise = SIGNALS[label]
            for trial_index in range(trials_per_class):
                session_id = f"SYNTHETIC_ONLY_SEED_{seed}"
                trial_id = f"synthetic_{label.lower().replace(' ', '_')}_{trial_index + 1:02d}"
                gain = rng.uniform(0.90, 1.10)
                phase = rng.uniform(0.0, 2.0 * math.pi)
                count = windows_per_trial * window_samples
                for sample_index in range(count):
                    time_s = sample_index / sample_rate_hz
                    amplitude = base_amplitude * gain
                    ax = amplitude * math.sin(2.0 * math.pi * 0.70 * time_s + phase)
                    ay = 0.65 * amplitude * math.sin(2.0 * math.pi * 0.93 * time_s + phase * 0.5)
                    az = 9.81 + 0.18 * amplitude * math.sin(2.0 * math.pi * 1.10 * time_s + phase * 1.4)
                    gx = 0.35 * amplitude * math.cos(2.0 * math.pi * 0.70 * time_s + phase)
                    gy = 0.23 * amplitude * math.cos(2.0 * math.pi * 0.93 * time_s + phase * 0.5)
                    gz = 0.12 * amplitude * math.sin(2.0 * math.pi * 1.10 * time_s + phase * 1.4)
                    values = [
                        ax + rng.gauss(0.0, noise),
                        ay + rng.gauss(0.0, noise),
                        az + rng.gauss(0.0, noise),
                        gx + rng.gauss(0.0, noise * 0.2),
                        gy + rng.gauss(0.0, noise * 0.2),
                        gz + rng.gauss(0.0, noise * 0.2),
                    ]
                    writer.writerow({
                        "schema_version": "1.0",
                        "session_id": session_id,
                        "trial_id": trial_id,
                        "timestamp_ms": round(sample_index * 1000 / sample_rate_hz),
                        **dict(zip(FIELDS[4:10], (f"{value:.8f}" for value in values))),
                        "valid": "true",
                        "status": "ok",
                        "label": label,
                        "ambient_illuminance_lux": "",
                        "proximity_counts": "",
                        "temperature_celsius": "",
                        "relative_humidity_percent": "",
                    })
                    row_count += 1

    manifest: dict[str, object] = {
        "data_origin": "synthetic",
        "generator": "ml/scripts/generate_synthetic.py",
        "generator_version": "1.0",
        "seed": seed,
        "sample_rate_hz": sample_rate_hz,
        "window_samples": window_samples,
        "windows_per_trial": windows_per_trial,
        "trials_per_class": trials_per_class,
        "labels": list(LABELS),
        "samples_per_class": trials_per_class * windows_per_trial * window_samples,
        "total_samples": row_count,
        "measured_hardware": False,
        "signal_definition": {
            label: {"nominal_motion_amplitude_m_s2": amplitude, "noise_std": noise}
            for label, (amplitude, noise) in SIGNALS.items()
        },
        "limitations": [
            "Generated signals are not physical sensor readings.",
            "Class patterns are deliberately distinct to exercise processing mechanics.",
            "Metrics from this dataset do not estimate real-world or board performance.",
        ],
    }
    manifest_path = output.with_suffix(output.suffix + ".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=182)
    parser.add_argument("--trials-per-class", type=int, default=4)
    parser.add_argument("--windows-per-trial", type=int, default=10)
    parser.add_argument("--window-samples", type=int, default=100)
    parser.add_argument("--sample-rate-hz", type=int, default=50)
    args = parser.parse_args()
    try:
        manifest = generate(args.output, seed=args.seed,
                            trials_per_class=args.trials_per_class,
                            windows_per_trial=args.windows_per_trial,
                            window_samples=args.window_samples,
                            sample_rate_hz=args.sample_rate_hz)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps({"csv": str(args.output), **manifest}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
