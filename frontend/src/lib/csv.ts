import { LABELS, type CsvReview, type HandlingLabel, type ImportIssue, type MotionSample } from "../domain.ts";

const REQUIRED = [
  "schema_version", "session_id", "trial_id", "timestamp_ms",
  "accel_x_m_s2", "accel_y_m_s2", "accel_z_m_s2",
  "gyro_x_rad_s", "gyro_y_rad_s", "gyro_z_rad_s",
  "valid", "status", "label",
];
const MOTION = [
  "accel_x_m_s2", "accel_y_m_s2", "accel_z_m_s2",
  "gyro_x_rad_s", "gyro_y_rad_s", "gyro_z_rad_s",
];
const CONTEXT = ["ambient_illuminance_lux", "proximity_counts", "temperature_celsius", "relative_humidity_percent"];
const UINT32_MAX = 0xffff_ffff;

interface CsvRecord { fields: string[]; record: number; error?: string }

function tokenize(text: string): CsvRecord[] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let record = 1;
  let error: string | undefined;

  const finishField = () => { fields.push(field); field = ""; closedQuote = false; };
  const finishRecord = () => {
    finishField();
    if (fields.some((value) => value.trim() !== "")) records.push({ fields, record, error });
    fields = [];
    error = undefined;
    record += 1;
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
      continue;
    }
    if (char === '"') {
      if (field.length === 0 && !closedQuote) quoted = true;
      else error ??= "Unexpected quote in an unquoted field.";
    } else if (char === ",") finishField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      finishRecord();
    } else {
      if (closedQuote && char.trim() !== "") error ??= "Unexpected text after a closing quote.";
      field += char;
    }
  }
  if (quoted) error ??= "Unclosed quoted field at end of file.";
  if (field.length || fields.length) finishRecord();
  return records;
}

const issue = (rowNumber: number, message: string, sessionId?: string, trialId?: string): ImportIssue => ({
  rowNumber, severity: "error", message, ...(sessionId ? { sessionId } : {}), ...(trialId ? { trialId } : {}),
});

export function parseMotionCsv(text: string): CsvReview {
  const records = tokenize(text);
  if (records.length === 0) return { headers: [], samples: [], issues: [], totalRecords: 0, excludedRowCount: 0, fatalError: "The file is empty." };
  const headers = records[0].fields.map((header) => header.trim());
  if (new Set(headers).size !== headers.length) return { headers, samples: [], issues: [], totalRecords: 0, excludedRowCount: 0, fatalError: "The header contains duplicate column names." };
  const missing = REQUIRED.filter((header) => !headers.includes(header));
  if (missing.length) return { headers, samples: [], issues: [], totalRecords: 0, excludedRowCount: 0, fatalError: `Missing required columns: ${missing.join(", ")}.` };
  const index = new Map(headers.map((header, position) => [header, position]));
  const issues: ImportIssue[] = [];
  const samples: MotionSample[] = [];
  const excludedRows = new Set<number>();
  const trialLabels = new Map<string, Set<string>>();
  let totalRecords = 0;

  for (const record of records.slice(1)) {
    totalRecords += 1;
    const rowNumber = record.record;
    const row = record.fields;
    const values = Object.fromEntries(headers.map((header, i) => [header, row[i] ?? ""]));
    const get = (name: string) => (row[index.get(name)!] ?? "").trim();
    const sessionId = get("session_id");
    const trialId = get("trial_id");
    const report = (message: string) => { issues.push(issue(rowNumber, message, sessionId, trialId)); excludedRows.add(rowNumber); };
    let bad = Boolean(record.error);
    if (record.error) report(record.error);
    if (row.length !== headers.length) { report(`Expected ${headers.length} fields but found ${row.length}.`); bad = true; }
    if (get("schema_version") !== "1.0") { report("Unsupported schema version; expected 1.0."); bad = true; }
    if (!sessionId || !trialId) { report("Session ID and trial ID are required."); bad = true; }
    const timestampText = get("timestamp_ms");
    const timestampMs = /^\d+$/.test(timestampText) ? Number(timestampText) : Number.NaN;
    if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 || timestampMs > UINT32_MAX) { report("Timestamp must be an unsigned 32-bit integer in milliseconds."); bad = true; }
    const numeric = MOTION.map((name) => Number(get(name)));
    if (numeric.some((value, i) => get(MOTION[i]) === "" || !Number.isFinite(value))) { report("Motion values must all be finite numbers."); bad = true; }
    for (const name of CONTEXT) {
      const value = get(name);
      if (value && !Number.isFinite(Number(value))) issues.push({ rowNumber, severity: "warning", message: `Optional context value “${name}” is not numeric and will be ignored.`, sessionId, trialId });
    }
    const validFlag = get("valid").toLowerCase();
    if (!["true", "false", "1", "0"].includes(validFlag)) { report("Valid flag must be true, false, 1, or 0."); bad = true; }
    else if (validFlag === "false" || validFlag === "0") { report("Sample is marked invalid and is excluded."); bad = true; }
    if (get("status") !== "ok") { report(`Sensor status “${get("status") || "(blank)"}” excludes this sample.`); bad = true; }
    const label = get("label");
    if (!LABELS.includes(label as HandlingLabel)) { report(`Unknown label “${label || "(blank)"}”.`); bad = true; }
    if (sessionId && trialId && LABELS.includes(label as HandlingLabel)) {
      const key = `${sessionId}\u0000${trialId}`;
      const labels = trialLabels.get(key) ?? new Set<string>();
      labels.add(label);
      trialLabels.set(key, labels);
    }
    if (bad) continue;
    const accel: MotionSample["accel"] = [numeric[0], numeric[1], numeric[2]];
    const gyro: MotionSample["gyro"] = [numeric[3], numeric[4], numeric[5]];
    samples.push({ rowNumber, sessionId, trialId, timestampMs, label: label as HandlingLabel, accel, gyro, raw: values });
  }

  const conflicts = new Set<string>();
  for (const [key, labels] of trialLabels) if (labels.size > 1) conflicts.add(key);
  if (conflicts.size) {
    const conflicted = samples.filter((sample) => conflicts.has(`${sample.sessionId}\u0000${sample.trialId}`));
    for (const key of conflicts) {
      const [sessionId, trialId] = key.split("\u0000");
      const first = conflicted.find((sample) => sample.sessionId === sessionId && sample.trialId === trialId);
      issues.push(issue(first?.rowNumber ?? 0, "Trial contains conflicting labels; all valid motion rows in the trial are excluded.", sessionId, trialId));
      for (const sample of conflicted) excludedRows.add(sample.rowNumber);
    }
    for (let i = samples.length - 1; i >= 0; i -= 1) {
      if (conflicts.has(`${samples[i].sessionId}\u0000${samples[i].trialId}`)) samples.splice(i, 1);
    }
  }

  const byTrial = new Map<string, MotionSample[]>();
  for (const sample of samples) {
    const key = `${sample.sessionId}\u0000${sample.trialId}`;
    const previous = byTrial.get(key) ?? [];
    previous.push(sample);
    byTrial.set(key, previous);
  }
  for (const group of byTrial.values()) {
    group.sort((a, b) => a.rowNumber - b.rowNumber);
    let previous: number | undefined;
    for (const sample of group) {
      if (previous !== undefined) {
        const delta = (sample.timestampMs - previous) >>> 0;
        if (delta === 0 || delta >= 0x8000_0000) {
          issues.push(issue(sample.rowNumber, delta === 0 ? "Timestamp is duplicated within this trial." : "Timestamp moved backward within this trial.", sample.sessionId, sample.trialId));
          excludedRows.add(sample.rowNumber);
          const sampleIndex = samples.indexOf(sample);
          if (sampleIndex >= 0) samples.splice(sampleIndex, 1);
          continue;
        }
      }
      previous = sample.timestampMs;
    }
  }
  return { headers, samples, issues, totalRecords, excludedRowCount: excludedRows.size };
}

export function isSupportedMotionCsv(review: CsvReview): boolean {
  return !review.fatalError && review.headers.length > 0;
}
