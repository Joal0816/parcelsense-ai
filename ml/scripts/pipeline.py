#!/usr/bin/env python3
"""Offline, dependency-free ParcelSense dataset and model pipeline.

The CLI consumes a CSV captured from hardware. Test fixtures are deliberately
kept in tests/ml and are never emitted into ml/data or ml/models.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import statistics
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

LABELS = ("Stable", "Normal Handling", "Rough Handling")
LABEL_TO_INDEX = {name: index for index, name in enumerate(LABELS)}
SCHEMA_VERSION = "1.0"
U32_MASK = 0xFFFFFFFF
U32_HALF = 0x80000000
AXES = ("x", "y", "z")
ACCEL_COLUMNS = tuple(f"accel_{axis}_m_s2" for axis in AXES)
GYRO_COLUMNS = tuple(f"gyro_{axis}_rad_s" for axis in AXES)
CONTEXT_COLUMNS = (
    "ambient_illuminance_lux", "proximity_counts",
    "temperature_celsius", "relative_humidity_percent",
)
REQUIRED_COLUMNS = (
    "schema_version", "session_id", "trial_id", "timestamp_ms",
    *ACCEL_COLUMNS, *GYRO_COLUMNS, "valid", "status", "label",
)
WINDOW_METADATA = ("session_id", "trial_id", "window_index",
                   "start_timestamp_ms", "end_timestamp_ms", "sample_count", "label")
FEATURE_NAMES = tuple(
    f"{kind}_{axis}" for kind in ("mean", "std", "rms")
    for axis in (*ACCEL_COLUMNS, *GYRO_COLUMNS)
) + (
    "accel_norm_mean", "accel_norm_std", "accel_norm_rms", "accel_norm_max",
    "gyro_norm_rms", "jerk_norm_rms",
)


@dataclass(frozen=True)
class Sample:
    line: int
    timestamp_ms: int
    label: str
    acceleration: tuple[float, float, float]
    angular_velocity: tuple[float, float, float]
    context: dict[str, float | None]


@dataclass
class Trial:
    session_id: str
    trial_id: str
    label: str
    records: list[Sample | None] = field(default_factory=list)
    lines: list[int] = field(default_factory=list)
    conflicted: bool = False
    last_timestamp: int | None = None


@dataclass(frozen=True)
class Window:
    session_id: str
    trial_id: str
    window_index: int
    start_timestamp_ms: int
    end_timestamp_ms: int
    sample_count: int
    label: str
    features: dict[str, float]

    @property
    def group(self) -> tuple[str, str]:
        return self.session_id, self.trial_id


@dataclass
class TreeNode:
    label: int | None = None
    feature: int = -1
    threshold: float = 0.0
    left: TreeNode | None = None
    right: TreeNode | None = None


def _exclude(exclusions: list[dict[str, object]], session: str, trial: str,
             label: str, line: int | str, reason: str, count: int = 1) -> None:
    exclusions.append({"session_id": session, "trial_id": trial, "label": label,
                       "line_number": line, "row_count": count, "reason": reason})


def _finite_float(value: str) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("non_finite_value")
    return number


def _text(value: str | None) -> str:
    """Normalize a CSV field, including short/malformed rows from DictReader."""
    return value.strip() if value is not None else ""


def read_trials(path: Path) -> tuple[list[Trial], list[dict[str, object]]]:
    """Read samples, preserving invalid rows as segment breaks and logging them."""
    trials: dict[tuple[str, str], Trial] = {}
    exclusions: list[dict[str, object]] = []
    with path.open(newline="", encoding="utf-8-sig") as stream:
        reader = csv.DictReader(stream)
        missing = [name for name in REQUIRED_COLUMNS if name not in (reader.fieldnames or [])]
        if missing:
            raise ValueError("missing required CSV columns: " + ", ".join(missing))
        for line, row in enumerate(reader, start=2):
            session = _text(row.get("session_id"))
            trial_id = _text(row.get("trial_id"))
            label = _text(row.get("label"))
            if not session or not trial_id:
                _exclude(exclusions, session, trial_id, label, line, "missing_session_or_trial_id")
                continue
            key = (session, trial_id)
            if label not in LABEL_TO_INDEX:
                _exclude(exclusions, session, trial_id, label, line, "unknown_label")
                if key in trials:
                    trials[key].records.append(None)
                    trials[key].lines.append(line)
                continue
            if _text(row.get("schema_version")) != SCHEMA_VERSION:
                _exclude(exclusions, session, trial_id, label, line, "unsupported_schema_version")
                if key in trials:
                    trials[key].records.append(None)
                    trials[key].lines.append(line)
                continue

            trial = trials.get(key)
            if trial is None:
                trial = Trial(session, trial_id, label)
                trials[key] = trial
            elif trial.label != label:
                trial.conflicted = True
            trial.lines.append(line)
            if trial.label != label:
                trial.records.append(None)
                _exclude(exclusions, session, trial_id, label, line, "conflicting_trial_labels")
                continue

            try:
                timestamp = int(row["timestamp_ms"])
                if timestamp < 0 or timestamp > U32_MASK:
                    raise ValueError("timestamp_out_of_range")
                if trial.last_timestamp is not None:
                    delta = (timestamp - trial.last_timestamp) & U32_MASK
                    if delta == 0 or delta >= U32_HALF:
                        raise ValueError("timestamp_not_monotonic")
                trial.last_timestamp = timestamp
                valid_text = _text(row.get("valid")).lower()
                if valid_text not in ("true", "false", "1", "0"):
                    raise ValueError("invalid_validity_flag")
                if valid_text in ("false", "0"):
                    raise ValueError("sample_marked_invalid")
                status = _text(row.get("status")).lower()
                if status != "ok":
                    raise ValueError("sensor_status_" + (status or "empty"))
                acceleration = tuple(_finite_float(row[name]) for name in ACCEL_COLUMNS)
                angular_velocity = tuple(_finite_float(row[name]) for name in GYRO_COLUMNS)
            except (ValueError, TypeError, KeyError) as error:
                reason = str(error) or "invalid_required_sample"
                trial.records.append(None)
                _exclude(exclusions, session, trial_id, label, line, reason)
                continue

            context: dict[str, float | None] = {}
            for name in CONTEXT_COLUMNS:
                raw = _text(row.get(name))
                if not raw:
                    context[name] = None
                    continue
                try:
                    context[name] = _finite_float(raw)
                except ValueError:
                    # Context is optional and not used by the Phase 4 motion model.
                    context[name] = None
                    _exclude(exclusions, session, trial_id, label, line,
                             "invalid_optional_context:" + name)
            trial.records.append(Sample(line, timestamp, label, acceleration,
                                        angular_velocity, context))

    for trial in trials.values():
        if trial.conflicted:
            trial.records = []
            _exclude(exclusions, trial.session_id, trial.trial_id, trial.label,
                     "trial", "trial_discarded_for_conflicting_labels", len(trial.lines))
    return list(trials.values()), exclusions


def _mean_std_rms(values: list[float]) -> tuple[float, float, float]:
    mean = statistics.fmean(values)
    variance = statistics.fmean((value - mean) ** 2 for value in values)
    rms = math.sqrt(statistics.fmean(value * value for value in values))
    return mean, math.sqrt(variance), rms


def extract_features(samples: list[Sample]) -> dict[str, float]:
    features: dict[str, float] = {}
    channels = [(f"accel_{axis}_m_s2", [s.acceleration[i] for s in samples])
                for i, axis in enumerate(AXES)]
    channels += [(f"gyro_{axis}_rad_s", [s.angular_velocity[i] for s in samples])
                 for i, axis in enumerate(AXES)]
    for name, values in channels:
        mean, std, rms = _mean_std_rms(values)
        features[f"mean_{name}"] = mean
        features[f"std_{name}"] = std
        features[f"rms_{name}"] = rms

    accel_norm = [math.sqrt(sum(value * value for value in sample.acceleration))
                  for sample in samples]
    gyro_norm = [math.sqrt(sum(value * value for value in sample.angular_velocity))
                 for sample in samples]
    mean, std, rms = _mean_std_rms(accel_norm)
    features.update(accel_norm_mean=mean, accel_norm_std=std,
                    accel_norm_rms=rms, accel_norm_max=max(accel_norm),
                    gyro_norm_rms=math.sqrt(statistics.fmean(x * x for x in gyro_norm)))
    jerks: list[float] = []
    for previous, current in zip(samples, samples[1:]):
        delta_ms = (current.timestamp_ms - previous.timestamp_ms) & U32_MASK
        if delta_ms == 0 or delta_ms >= U32_HALF:
            raise ValueError("non_monotonic timestamps inside a feature window")
        seconds = delta_ms / 1000.0
        magnitude = math.sqrt(sum(((current.acceleration[i] - previous.acceleration[i]) /
                                   seconds) ** 2 for i in range(3)))
        jerks.append(magnitude)
    features["jerk_norm_rms"] = (math.sqrt(statistics.fmean(x * x for x in jerks))
                                  if jerks else 0.0)
    return features


def make_windows(trials: Iterable[Trial], window_samples: int
                 ) -> tuple[list[Window], list[dict[str, object]]]:
    if window_samples <= 0:
        raise ValueError("window_samples must be positive")
    windows: list[Window] = []
    exclusions: list[dict[str, object]] = []
    for trial in trials:
        if trial.conflicted:
            continue
        segment: list[Sample] = []
        index = 0

        def emit(sample_segment: list[Sample]) -> None:
            nonlocal index
            start = 0
            while start + window_samples <= len(sample_segment):
                block = sample_segment[start:start + window_samples]
                windows.append(Window(
                    trial.session_id, trial.trial_id, index,
                    block[0].timestamp_ms, block[-1].timestamp_ms, len(block), trial.label,
                    extract_features(block)))
                index += 1
                start += window_samples
            remaining = sample_segment[start:]
            if remaining:
                _exclude(exclusions, trial.session_id, trial.trial_id, trial.label,
                         remaining[0].line, "incomplete_window", len(remaining))

        for record in trial.records:
            if record is None:
                emit(segment)
                segment.clear()
            else:
                segment.append(record)
        emit(segment)
    return windows, exclusions


def split_by_trial(windows: list[Window], min_train: int = 30, min_test: int = 10,
                   seed: int = 182) -> tuple[list[Window], list[Window], dict[str, object]]:
    """Select whole session/trial groups for test; no window-level leakage."""
    if min_train <= 0 or min_test <= 0:
        raise ValueError("minimum training and test counts must be positive")
    by_label: dict[str, dict[tuple[str, str], list[Window]]] = {label: {} for label in LABELS}
    for window in windows:
        by_label[window.label].setdefault(window.group, []).append(window)
    rng = random.Random(seed)
    test_groups: set[tuple[str, str]] = set()
    counts: dict[str, dict[str, int]] = {}
    for label in LABELS:
        groups = list(by_label[label].items())
        rng.shuffle(groups)
        total = sum(len(group) for _, group in groups)
        if total < min_train + min_test:
            raise ValueError(f"{label}: need at least {min_train} train and {min_test} held-out windows; found {total}")
        chosen = 0
        remaining = groups[:]
        while chosen < min_test:
            feasible = [(key, rows) for key, rows in remaining
                        if total - chosen - len(rows) >= min_train]
            if not feasible:
                raise ValueError(f"{label}: trials cannot meet split minima without leakage")
            key, rows = min(feasible, key=lambda item: (abs(len(item[1]) - (min_test - chosen)),
                                                        item[0]))
            test_groups.add(key)
            chosen += len(rows)
            remaining.remove((key, rows))
        counts[label] = {"train": total - chosen, "test": chosen}
    train = [w for w in windows if w.group not in test_groups]
    test = [w for w in windows if w.group in test_groups]
    return train, test, {
        "seed": seed,
        "group_key": ["session_id", "trial_id"],
        "test_groups": [list(group) for group in sorted(test_groups)],
        "windows_by_class": counts,
    }


def fit_threshold_baseline(train: list[Window]) -> dict[str, float]:
    medians = [statistics.median(w.features["accel_norm_std"] for w in train
                                 if w.label == label) for label in LABELS]
    return {"stable_normal": (medians[0] + medians[1]) / 2.0,
            "normal_rough": (medians[1] + medians[2]) / 2.0,
            "training_class_medians": dict(zip(LABELS, medians))}


def predict_threshold(model: dict[str, float], window: Window) -> int:
    value = window.features["accel_norm_std"]
    if value <= model["stable_normal"]:
        return 0
    if value <= model["normal_rough"]:
        return 1
    return 2


def _gini(counts: list[int]) -> float:
    total = sum(counts)
    return 0.0 if total == 0 else 1.0 - sum((n / total) ** 2 for n in counts)


def _majority(rows: list[Window]) -> int:
    counts = [sum(row.label == label for row in rows) for label in LABELS]
    return max(range(len(LABELS)), key=lambda index: counts[index])


def fit_tree(rows: list[Window], max_depth: int = 3, min_leaf: int = 2) -> TreeNode:
    """Small deterministic CART classifier using Gini gain and bounded depth."""
    if not rows:
        raise ValueError("cannot train a tree without rows")

    def grow(items: list[Window], depth: int) -> TreeNode:
        majority = _majority(items)
        if depth >= max_depth or len(items) < 2 * min_leaf or _gini(
                [sum(row.label == label for row in items) for label in LABELS]) == 0.0:
            return TreeNode(label=majority)
        parent_counts = [sum(row.label == label for row in items) for label in LABELS]
        parent_impurity = _gini(parent_counts)
        best: tuple[float, int, float] | None = None
        for feature_index, feature in enumerate(FEATURE_NAMES):
            ordered = sorted((row.features[feature], LABEL_TO_INDEX[row.label]) for row in items)
            left_counts = [0] * len(LABELS)
            for split_index in range(1, len(ordered)):
                moved_label = ordered[split_index - 1][1]
                left_counts[moved_label] += 1
                left_size = split_index
                right_size = len(ordered) - split_index
                lower, upper = ordered[split_index - 1][0], ordered[split_index][0]
                if lower == upper or left_size < min_leaf or right_size < min_leaf:
                    continue
                right_counts = [parent_counts[i] - left_counts[i] for i in range(len(LABELS))]
                threshold = lower * 0.5 + upper * 0.5
                impurity = (left_size * _gini(left_counts) +
                            right_size * _gini(right_counts)) / len(ordered)
                if best is None or impurity < best[0] - 1e-12:
                    best = (impurity, feature_index, threshold)
        if best is None or best[0] >= parent_impurity - 1e-12:
            return TreeNode(label=majority)
        _, feature_index, threshold = best
        feature = FEATURE_NAMES[feature_index]
        left_rows = [row for row in items if row.features[feature] <= threshold]
        right_rows = [row for row in items if row.features[feature] > threshold]
        if not left_rows or not right_rows:
            return TreeNode(label=majority)
        return TreeNode(feature=feature_index, threshold=threshold,
                        left=grow(left_rows, depth + 1),
                        right=grow(right_rows, depth + 1))

    return grow(rows, 0)


def predict_tree(tree: TreeNode, window: Window) -> int:
    node = tree
    while node.label is None:
        if node.left is None or node.right is None or node.feature < 0:
            raise ValueError("malformed decision tree")
        node = node.left if window.features[FEATURE_NAMES[node.feature]] <= node.threshold else node.right
    return node.label


def tree_nodes(tree: TreeNode) -> list[dict[str, object]]:
    nodes: list[dict[str, object]] = []

    def visit(node: TreeNode) -> int:
        index = len(nodes)
        nodes.append({})
        if node.label is not None:
            nodes[index] = {"label": node.label, "feature": -1,
                            "threshold": 0.0, "left": -1, "right": -1}
        else:
            left = visit(node.left)  # type: ignore[arg-type]
            right = visit(node.right)  # type: ignore[arg-type]
            nodes[index] = {"label": -1, "feature": node.feature,
                            "threshold": node.threshold, "left": left, "right": right}
        return index

    visit(tree)
    return nodes


def tree_to_c(nodes: list[dict[str, object]]) -> str:
    node_lines = []
    for node in nodes:
        node_lines.append("    {%d, %d, %d, %d, %.9g}," % (
            int(node["feature"]), int(node["left"]), int(node["right"]),
            int(node["label"]), float(node["threshold"])))
    return """/* Generated from the training split; see adjacent model.json. */
#include <math.h>
#include <stddef.h>
#include <stdint.h>
typedef struct { int16_t feature, left, right; int8_t label; float threshold; } Node;
static const Node nodes[] = {
%s
};
int parcelsense_predict(const float *features, size_t count) {
    if (features == NULL || count != %dU) return -1;
    for (size_t i = 0; i < count; ++i) if (!isfinite(features[i])) return -1;
    int index = 0;
    for (size_t step = 0; step < sizeof(nodes) / sizeof(nodes[0]); ++step) {
        if (index < 0 || (size_t)index >= sizeof(nodes) / sizeof(nodes[0])) return -1;
        const Node *node = &nodes[index];
        if (node->label >= 0) return node->label;
        if (node->feature < 0 || (size_t)node->feature >= count) return -1;
        index = features[node->feature] <= node->threshold ? node->left : node->right;
    }
    return -1;
}
""" % ("\n".join(node_lines), len(FEATURE_NAMES))


def evaluate(expected: list[str], predicted: list[int]) -> dict[str, object]:
    matrix = [[0] * len(LABELS) for _ in LABELS]
    for truth, guess in zip(expected, predicted):
        matrix[LABEL_TO_INDEX[truth]][guess] += 1
    per_class: dict[str, dict[str, float]] = {}
    f1s = []
    for index, label in enumerate(LABELS):
        tp = matrix[index][index]
        predicted_count = sum(matrix[row][index] for row in range(len(LABELS)))
        actual_count = sum(matrix[index])
        precision = tp / predicted_count if predicted_count else 0.0
        recall = tp / actual_count if actual_count else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        f1s.append(f1)
        per_class[label] = {"precision": precision, "recall": recall, "f1": f1,
                            "support": actual_count}
    return {"confusion_matrix": matrix, "per_class": per_class,
            "macro_f1": statistics.fmean(f1s) if f1s else 0.0,
            "sample_count": len(expected)}


def write_csv(path: Path, columns: tuple[str, ...], rows: Iterable[dict[str, object]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def train_dataset(input_path: Path, output_dir: Path, *, window_samples: int = 100,
                  min_train: int = 30, min_test: int = 10, seed: int = 182,
                  data_origin: str = "unknown") -> dict[str, object]:
    if data_origin not in ("synthetic", "real_board", "unknown"):
        raise ValueError("data_origin must be synthetic, real_board, or unknown")
    trials, exclusions = read_trials(input_path)
    windows, window_exclusions = make_windows(trials, window_samples)
    exclusions.extend(window_exclusions)
    if not windows:
        raise ValueError("no complete valid windows found")
    train, test, split = split_by_trial(windows, min_train, min_test, seed)
    baseline = fit_threshold_baseline(train)
    tree = fit_tree(train, max_depth=3)
    baseline_metrics = evaluate([row.label for row in test],
                                [predict_threshold(baseline, row) for row in test])
    tree_metrics = evaluate([row.label for row in test],
                            [predict_tree(tree, row) for row in test])
    nodes = tree_nodes(tree)
    model: dict[str, object] = {
        "schema_version": SCHEMA_VERSION,
        "data_origin": data_origin,
        "model_type": "bounded_cart_decision_tree",
        "max_depth": 3,
        "window_samples": window_samples,
        "window_overlap": 0,
        "labels": list(LABELS),
        "feature_order": list(FEATURE_NAMES),
        "threshold_baseline": baseline,
        "tree_nodes": nodes,
        "split": split,
        "evaluation": {"threshold_baseline": baseline_metrics,
                       "decision_tree": tree_metrics},
        "data_counts": {"valid_windows": len(windows), "training_windows": len(train),
                        "held_out_windows": len(test), "excluded_records": len(exclusions)},
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    metadata = tuple(WINDOW_METADATA)
    write_csv(output_dir / "windows_features.csv", metadata + FEATURE_NAMES,
              ({**{name: getattr(window, name) for name in metadata}, **window.features}
               for window in windows))
    exclusion_fields = ("session_id", "trial_id", "label", "line_number", "row_count", "reason")
    write_csv(output_dir / "exclusions.csv", exclusion_fields, exclusions)
    (output_dir / "model.json").write_text(json.dumps(model, indent=2, sort_keys=True) + "\n",
                                            encoding="utf-8")
    (output_dir / "model.c").write_text(tree_to_c(nodes), encoding="utf-8")
    return model


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    train_parser = subparsers.add_parser("train", help="process board CSV, split by trial, compare and export")
    train_parser.add_argument("--input", required=True, type=Path)
    train_parser.add_argument("--output-dir", required=True, type=Path)
    train_parser.add_argument("--window-samples", type=int, default=100)
    train_parser.add_argument("--min-train", type=int, default=30)
    train_parser.add_argument("--min-test", type=int, default=10)
    train_parser.add_argument("--seed", type=int, default=182)
    train_parser.add_argument("--data-origin", choices=("synthetic", "real_board", "unknown"),
                              default="unknown",
                              help="user-declared report provenance; defaults to unknown")
    args = parser.parse_args(argv)
    try:
        model = train_dataset(args.input, args.output_dir, window_samples=args.window_samples,
                              min_train=args.min_train, min_test=args.min_test, seed=args.seed,
                              data_origin=args.data_origin)
    except (OSError, ValueError, csv.Error) as error:
        print(f"pipeline error: {error}", file=sys.stderr)
        return 2
    print(json.dumps({"data_counts": model["data_counts"],
                      "evaluation": model["evaluation"],
                      "model_type": model["model_type"],
                      "data_origin": model["data_origin"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
