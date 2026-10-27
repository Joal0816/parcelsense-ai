import { LABELS, type CsvReview, type EvaluationReport, type MotionSample, type SavedEvaluation, type SavedSession, type StoredSample } from "../domain.ts";

const DB_NAME = "parcelsense-field-desk";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) return Promise.reject(new Error("This browser does not provide local IndexedDB storage."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("samples")) {
        const store = db.createObjectStore("samples", { keyPath: ["importId", "rowNumber"] });
        store.createIndex("importId", "importId", { unique: false });
      }
      if (!db.objectStoreNames.contains("evaluations")) db.createObjectStore("evaluations", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local database could not be opened."));
    request.onblocked = () => reject(new Error("Local database upgrade is blocked by another ParcelSense tab. Close other tabs and retry."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local database request failed."));
  });
}

export async function saveImport(id: string, sourceName: string, review: CsvReview, dataOrigin: "synthetic" | "unknown" = "unknown"): Promise<SavedSession> {
  const db = await openDatabase();
  const now = new Date().toISOString();
  const sessionIds = [...new Set(review.samples.map((sample) => sample.sessionId))].sort();
  const session: SavedSession = {
    id,
    sourceName,
    dataOrigin,
    importedAt: now,
    sessionIds,
    sampleCount: review.samples.length,
    excludedCount: review.excludedRowCount,
    schemaVersion: "1.0",
    totalRecords: review.totalRecords,
    issues: review.issues,
    headers: review.headers,
  };
  try {
    const tx = db.transaction(["sessions", "samples"], "readwrite");
    tx.objectStore("sessions").put(session);
    const samples = tx.objectStore("samples");
    for (const sample of review.samples) samples.put({ ...sample, importId: id } satisfies StoredSample);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Import transaction failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Import was not saved."));
    });
    return session;
  } finally { db.close(); }
}

export async function listImports(): Promise<SavedSession[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction("sessions", "readonly");
    const result = await requestResult(tx.objectStore("sessions").getAll() as IDBRequest<SavedSession[]>);
    return result.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  } finally { db.close(); }
}

export async function getImportSamples(importId: string): Promise<MotionSample[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction("samples", "readonly");
    const result = await requestResult(tx.objectStore("samples").index("importId").getAll(importId) as IDBRequest<StoredSample[]>);
    return result.sort((a, b) => a.rowNumber - b.rowNumber).map(({ importId: _id, ...sample }) => sample);
  } finally { db.close(); }
}

export async function deleteImport(importId: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(["sessions", "samples"], "readwrite");
    tx.objectStore("sessions").delete(importId);
    const keys = await requestResult(tx.objectStore("samples").index("importId").getAllKeys(importId));
    const store = tx.objectStore("samples");
    for (const key of keys) store.delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Deletion failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Deletion was canceled by the browser."));
    });
  } finally { db.close(); }
}

export async function listEvaluations(): Promise<SavedEvaluation[]> {
  const db = await openDatabase();
  try {
    const tx = db.transaction("evaluations", "readonly");
    const items = await requestResult(tx.objectStore("evaluations").getAll() as IDBRequest<SavedEvaluation[]>);
    return items.sort((a, b) => b.loadedAt.localeCompare(a.loadedAt));
  } finally { db.close(); }
}

export async function saveEvaluation(id: string, sourceName: string, report: EvaluationReport): Promise<SavedEvaluation> {
  const db = await openDatabase();
  const item: SavedEvaluation = { id, sourceName, loadedAt: new Date().toISOString(), report };
  try {
    const tx = db.transaction("evaluations", "readwrite");
    tx.objectStore("evaluations").put(item);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Evaluation report could not be saved."));
      tx.onabort = () => reject(tx.error ?? new Error("Evaluation report was not saved."));
    });
    return item;
  } finally { db.close(); }
}

export async function deleteEvaluation(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    const tx = db.transaction("evaluations", "readwrite");
    tx.objectStore("evaluations").delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Evaluation deletion failed."));
    });
  } finally { db.close(); }
}

export function validateEvaluation(value: unknown): { report?: EvaluationReport; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "The report must be a JSON object." };
  const report = value as EvaluationReport;
  if (report.schema_version !== "1.0") return { error: "Unsupported report schema. Expected schema_version 1.0." };
  if (typeof report.model_type !== "string" || !report.model_type) return { error: "The report is missing model_type." };
  const labels = report.labels ?? report.label_order;
  if (!Array.isArray(labels) || labels.length !== 3 || labels.some((label) => typeof label !== "string")) return { error: "The report must include the three ordered class labels." };
  if (labels.some((label, index) => label !== LABELS[index])) return { error: "Report label order does not match the project order: Stable, Normal Handling, Rough Handling." };
  if (!report.evaluation || typeof report.evaluation !== "object" || Array.isArray(report.evaluation)) return { error: "The report is missing evaluation metrics." };
  for (const [name, metric] of Object.entries(report.evaluation)) {
    if (!metric || typeof metric !== "object" || Array.isArray(metric)) return { error: `Metric “${name.slice(0, 60)}” is not an object.` };
    for (const key of ["macro_f1", "accuracy"] as const) {
      const value = metric[key];
      if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) return { error: `Metric “${name.slice(0, 60)}” has an invalid ${key} value.` };
    }
    if (metric.sample_count !== undefined && (!Number.isSafeInteger(metric.sample_count) || metric.sample_count < 0)) return { error: `Metric “${name.slice(0, 60)}” has an invalid sample count.` };
    if (metric.confusion_matrix !== undefined && (!Array.isArray(metric.confusion_matrix) || metric.confusion_matrix.length !== 3 || metric.confusion_matrix.some((row) => !Array.isArray(row) || row.length !== 3 || row.some((count) => !Number.isSafeInteger(count) || count < 0)))) return { error: `Metric “${name.slice(0, 60)}” has an invalid confusion matrix.` };
    if (metric.per_class !== undefined) {
      if (!metric.per_class || (!Array.isArray(metric.per_class) && typeof metric.per_class !== "object")) return { error: `Metric “${name.slice(0, 60)}” has invalid per-class values.` };
      const classes = Array.isArray(metric.per_class) ? metric.per_class : Object.values(metric.per_class);
      if (classes.length !== 3 || classes.some((entry) => !entry || typeof entry !== "object" || [entry.precision, entry.recall, entry.f1].some((value) => value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)) || (entry.support !== undefined && (!Number.isSafeInteger(entry.support) || entry.support < 0)))) return { error: `Metric “${name.slice(0, 60)}” has invalid per-class values.` };
    }
  }
  if (report.data_counts !== undefined && (!report.data_counts || typeof report.data_counts !== "object" || Object.values(report.data_counts).some((count) => count !== undefined && (!Number.isSafeInteger(count) || count < 0)))) return { error: "The report has invalid data counts." };
  const featureOrder = report.feature_order ?? report.feature_names;
  if (featureOrder !== undefined && (!Array.isArray(featureOrder) || featureOrder.some((feature) => typeof feature !== "string"))) return { error: "The report has an invalid feature order." };
  if (report.split !== undefined && (!report.split || typeof report.split !== "object" || Array.isArray(report.split))) return { error: "The report has invalid split metadata." };
  const testGroups = report.split?.test_groups;
  if (testGroups !== undefined && (!Array.isArray(testGroups) || testGroups.some((group) => !Array.isArray(group) || group.length !== 2 || group.some((part) => typeof part !== "string" || part.length > 300)))) return { error: "The report has invalid held-out trial groups." };
  return { report };
}

const NUMERIC_FIELDS = new Set(["timestamp_ms", "accel_x_m_s2", "accel_y_m_s2", "accel_z_m_s2", "gyro_x_rad_s", "gyro_y_rad_s", "gyro_z_rad_s", "ambient_illuminance_lux", "proximity_counts", "temperature_celsius", "relative_humidity_percent"]);

export function makeSafeCsv(headers: string[], samples: MotionSample[], spreadsheetSafe: boolean): string {
  const cell = (value: string, header: string) => {
    const safe = spreadsheetSafe && !NUMERIC_FIELDS.has(header) && /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [headers.map((header) => cell(header, "")).join(","), ...samples.map((sample) => headers.map((header) => cell(sample.raw[header] ?? "", header)).join(","))].join("\r\n");
}

export function downloadText(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown browser storage error.";
  if (/quota/i.test(message)) return "Browser storage is full. Nothing older was removed; export existing records or delete a selected item, then retry.";
  return message;
}
