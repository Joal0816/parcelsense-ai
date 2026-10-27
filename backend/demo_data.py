"""Deterministic synthetic CSV data for local software demonstrations only."""
from __future__ import annotations

import csv
import io
import math


LABEL_AMPLITUDES = {
    "Stable": 0.015,
    "Normal Handling": 0.25,
    "Rough Handling": 0.9,
}
HEADERS = (
    "schema_version", "session_id", "trial_id", "timestamp_ms",
    "accel_x_m_s2", "accel_y_m_s2", "accel_z_m_s2",
    "gyro_x_rad_s", "gyro_y_rad_s", "gyro_z_rad_s",
    "valid", "status", "label", "ambient_illuminance_lux",
    "proximity_counts", "temperature_celsius", "relative_humidity_percent",
)


def make_demo_csv() -> str:
    """Return a clearly named 1,200-row fixture; values are not sensor readings."""
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=HEADERS, lineterminator="\r\n")
    writer.writeheader()
    for label, amplitude in LABEL_AMPLITUDES.items():
        slug = label.lower().replace(" ", "_")
        for trial_number in range(4):
            trial_id = f"synthetic_{slug}_trial_{trial_number + 1:02d}"
            for sample_number in range(100):
                phase = 2.0 * math.pi * (sample_number % 10) / 10.0
                writer.writerow({
                    "schema_version": "1.0",
                    "session_id": "SYNTHETIC_DEMO_ONLY",
                    "trial_id": trial_id,
                    "timestamp_ms": sample_number * 20,
                    "accel_x_m_s2": f"{amplitude * math.sin(phase):.8f}",
                    "accel_y_m_s2": f"{amplitude * 0.2 * math.cos(phase):.8f}",
                    "accel_z_m_s2": "9.81",
                    "gyro_x_rad_s": f"{amplitude * math.sin(phase) * 0.1:.8f}",
                    "gyro_y_rad_s": "0.0",
                    "gyro_z_rad_s": "0.0",
                    "valid": "true",
                    "status": "ok",
                    "label": label,
                    "ambient_illuminance_lux": "",
                    "proximity_counts": "",
                    "temperature_celsius": "",
                    "relative_humidity_percent": "",
                })
    return output.getvalue()
