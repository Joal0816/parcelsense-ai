"""Synthetic-only host smoke tests; no generated samples are project data."""
from __future__ import annotations

import csv
import ctypes
import importlib.util
import math
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "ml" / "scripts" / "pipeline.py"
SPEC = importlib.util.spec_from_file_location("parcelsense_pipeline", SCRIPT)
assert SPEC and SPEC.loader
pipeline = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = pipeline
SPEC.loader.exec_module(pipeline)

FIELDS = (*pipeline.REQUIRED_COLUMNS, *pipeline.CONTEXT_COLUMNS)


def synthetic_rows():
    """Produce deterministic class-separated fixtures for software smoke tests only."""
    amplitudes = {"Stable": 0.015, "Normal Handling": 0.25, "Rough Handling": 0.9}
    for label, amplitude in amplitudes.items():
        for trial_number in range(4):
            session = f"SYNTHETIC_TEST_ONLY_{label.replace(' ', '_')}"
            trial = f"trial_{trial_number}"
            for sample_number in range(100):
                phase = 2.0 * math.pi * (sample_number % 10) / 10.0
                yield {
                    "schema_version": pipeline.SCHEMA_VERSION,
                    "session_id": session,
                    "trial_id": trial,
                    "timestamp_ms": str((sample_number * 20) & pipeline.U32_MASK),
                    "accel_x_m_s2": f"{amplitude * math.sin(phase):.8f}",
                    "accel_y_m_s2": f"{amplitude * 0.2 * math.cos(phase):.8f}",
                    "accel_z_m_s2": "9.81",
                    "gyro_x_rad_s": f"{amplitude * math.sin(phase) * 0.1:.8f}",
                    "gyro_y_rad_s": "0.0",
                    "gyro_z_rad_s": "0.0",
                    "valid": "true",
                    "status": "ok",
                    "label": label,
                    **{name: "" for name in pipeline.CONTEXT_COLUMNS},
                }


def write_rows(path: Path, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)


class PipelineTests(unittest.TestCase):
    def test_firmware_model_abi_matches_pipeline_feature_contract(self):
        header = (ROOT / "firmware" / "include" / "classifier.h").read_text(encoding="utf-8")
        match = re.search(r"#define\s+PARCELSENSE_FEATURE_COUNT\s+(\d+)U", header)
        self.assertIsNotNone(match)
        self.assertEqual(int(match.group(1)), len(pipeline.FEATURE_NAMES))

    @unittest.skipUnless(shutil.which("cc"), "C compiler is unavailable")
    def test_firmware_feature_extractor_matches_python_pipeline(self):
        class MotionSample(ctypes.Structure):
            _fields_ = [
                ("timestamp_ms", ctypes.c_uint32),
                ("status", ctypes.c_int),
                ("valid", ctypes.c_bool),
                ("acceleration_m_s2", ctypes.c_float * 3),
                ("angular_velocity_rad_s", ctypes.c_float * 3),
            ]

        rows = list(synthetic_rows())[:100]
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            source = tmp_path / "SYNTHETIC_TEST_ONLY.csv"
            write_rows(source, rows)
            library_path = tmp_path / "libfeatures.so"
            subprocess.run([
                "cc", "-shared", "-fPIC", "-std=c11", "-Wall", "-Wextra", "-Werror",
                "-I", str(ROOT / "firmware" / "include"),
                str(ROOT / "firmware" / "src" / "features.c"),
                str(ROOT / "firmware" / "src" / "sensor_validation.c"),
                "-lm", "-o", str(library_path),
            ], check=True, capture_output=True, text=True)
            library = ctypes.CDLL(str(library_path))
            extract = library.parcelsense_extract_features
            extract.argtypes = [ctypes.POINTER(MotionSample), ctypes.c_size_t,
                                ctypes.POINTER(ctypes.c_float)]
            extract.restype = ctypes.c_int

            trials, exclusions = pipeline.read_trials(source)
            self.assertFalse(exclusions)
            samples = [sample for sample in trials[0].records if sample is not None]
            self.assertEqual(len(samples), 100)
            c_samples = (MotionSample * len(samples))(*[
                MotionSample(
                    sample.timestamp_ms, 0, True,
                    (ctypes.c_float * 3)(*sample.acceleration),
                    (ctypes.c_float * 3)(*sample.angular_velocity),
                )
                for sample in samples
            ])
            actual = (ctypes.c_float * len(pipeline.FEATURE_NAMES))()
            self.assertEqual(extract(c_samples, len(samples), actual), 0)
            expected = pipeline.extract_features(samples)
            for index, name in enumerate(pipeline.FEATURE_NAMES):
                self.assertAlmostEqual(actual[index], expected[name], delta=1e-5, msg=name)

    def test_invalid_sample_breaks_contiguous_windows(self):
        rows = list(synthetic_rows())[:100]
        for i, row in enumerate(rows):
            row["session_id"] = "SYNTHETIC_TEST_ONLY_cleaning"
            row["trial_id"] = "one_trial"
            row["label"] = "Stable"
            row["timestamp_ms"] = str(i * 20)
        rows[13]["valid"] = "false"
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "input.csv"
            write_rows(source, rows[:25])
            trials, rejects = pipeline.read_trials(source)
            windows, window_rejects = pipeline.make_windows(trials, 10)
        self.assertEqual(len(windows), 2)
        self.assertEqual([window.start_timestamp_ms for window in windows], [0, 280])
        self.assertTrue(any(entry["reason"] == "sample_marked_invalid" for entry in rejects))
        self.assertEqual(sum(int(row["row_count"]) for row in window_rejects), 4)

    def test_training_group_split_and_generated_artifacts(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "SYNTHETIC_TEST_ONLY.csv"
            output = Path(tmp) / "artifacts"
            write_rows(source, synthetic_rows())
            result = pipeline.train_dataset(source, output, window_samples=10,
                                            min_train=30, min_test=10, seed=182)
            self.assertEqual(result["data_counts"]["valid_windows"], 120)
            self.assertEqual(result["split"]["windows_by_class"], {
                label: {"train": 30, "test": 10} for label in pipeline.LABELS
            })
            test_groups = {tuple(group) for group in result["split"]["test_groups"]}
            train, test, _ = pipeline.split_by_trial(
                pipeline.make_windows(pipeline.read_trials(source)[0], 10)[0], 30, 10, 182)
            self.assertFalse({window.group for window in train} & {window.group for window in test})
            self.assertEqual({window.group for window in test}, test_groups)
            self.assertTrue((output / "windows_features.csv").is_file())
            self.assertTrue((output / "exclusions.csv").is_file())
            self.assertTrue((output / "model.json").is_file())
            self.assertTrue((output / "model.c").is_file())

    @unittest.skipUnless(shutil.which("cc"), "C compiler is unavailable")
    def test_exported_c_matches_python_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "SYNTHETIC_TEST_ONLY.csv"
            output = Path(tmp) / "artifacts"
            write_rows(source, synthetic_rows())
            model = pipeline.train_dataset(source, output, window_samples=10,
                                           min_train=30, min_test=10)
            library_path = Path(tmp) / "libmodel.so"
            subprocess.run(["cc", "-shared", "-fPIC", "-std=c11", str(output / "model.c"),
                            "-o", str(library_path), "-lm"], check=True,
                           capture_output=True, text=True)
            library = ctypes.CDLL(str(library_path))
            predict = library.parcelsense_predict
            predict.argtypes = [ctypes.POINTER(ctypes.c_float), ctypes.c_size_t]
            predict.restype = ctypes.c_int

            trials, _ = pipeline.read_trials(source)
            windows, _ = pipeline.make_windows(trials, 10)
            train, test, _ = pipeline.split_by_trial(windows)
            tree = pipeline.fit_tree(train)
            for window in test:
                values = (ctypes.c_float * len(pipeline.FEATURE_NAMES))(
                    *(window.features[name] for name in pipeline.FEATURE_NAMES))
                self.assertEqual(predict(values, len(values)),
                                 pipeline.predict_tree(tree, window))
            invalid = (ctypes.c_float * len(pipeline.FEATURE_NAMES))(*([math.nan] * len(pipeline.FEATURE_NAMES)))
            self.assertEqual(predict(invalid, len(invalid)), -1)
            self.assertEqual(predict(None, 0), -1)


if __name__ == "__main__":
    unittest.main()
