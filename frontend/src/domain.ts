export const LABELS = ["Stable", "Normal Handling", "Rough Handling"] as const;
export type HandlingLabel = (typeof LABELS)[number];

export type SensorVector = readonly [number, number, number];

export interface MotionSample {
  rowNumber: number;
  sessionId: string;
  trialId: string;
  timestampMs: number;
  label: HandlingLabel;
  accel: SensorVector;
  gyro: SensorVector;
  raw: Record<string, string>;
}

export interface ImportIssue {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
  sessionId?: string;
  trialId?: string;
}

export interface CsvReview {
  headers: string[];
  samples: MotionSample[];
  issues: ImportIssue[];
  fatalError?: string;
  totalRecords: number;
  excludedRowCount: number;
}

export interface SavedSession {
  id: string;
  sourceName: string;
  dataOrigin?: "synthetic" | "unknown";
  importedAt: string;
  sessionIds: string[];
  sampleCount: number;
  excludedCount: number;
  schemaVersion: string;
  totalRecords: number;
  issues: ImportIssue[];
  headers: string[];
}

export interface EvaluationReport {
  schema_version?: string;
  model_type?: string;
  labels?: string[];
  label_order?: string[];
  feature_names?: string[];
  feature_order?: string[];
  split?: { seed?: number; test_fraction?: number; groups?: Record<string, string[]>; [key: string]: unknown };
  data_counts?: { valid_windows?: number; training_windows?: number; held_out_windows?: number; excluded_records?: number };
  evaluation?: Record<string, {
    confusion_matrix?: number[][];
    per_class?: Array<{ label?: string; precision?: number; recall?: number; f1?: number; support?: number }> | Record<string, { precision?: number; recall?: number; f1?: number; support?: number }>;
    macro_f1?: number;
    accuracy?: number;
    sample_count?: number;
  }>;
  data_origin?: string;
  [key: string]: unknown;
}

export interface StoredSample extends MotionSample { importId: string }

export interface SavedEvaluation {
  id: string;
  sourceName: string;
  loadedAt: string;
  report: EvaluationReport;
}
