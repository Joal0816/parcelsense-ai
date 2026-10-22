import assert from "node:assert/strict";
import test from "node:test";
import { parseMotionCsv } from "../src/lib/csv.ts";

const header = "schema_version,session_id,trial_id,timestamp_ms,accel_x_m_s2,accel_y_m_s2,accel_z_m_s2,gyro_x_rad_s,gyro_y_rad_s,gyro_z_rad_s,valid,status,label,operator_note";
const row = (timestamp: number, label = "Stable", note = "") => `1.0,S1,T1,${timestamp},0,0,9.81,0,0,0,true,ok,${label},${note}`;

test("parses a valid sample and preserves unknown source columns", () => {
  const review = parseMotionCsv(`${header}\n${row(1, "Stable", "kept")}`);
  assert.equal(review.samples.length, 1);
  assert.equal(review.samples[0].raw.operator_note, "kept");
  assert.deepEqual(review.samples[0].accel, [0, 0, 9.81]);
});

test("handles quoted commas, escaped quotes, and embedded newlines", () => {
  const review = parseMotionCsv(`${header}\n${row(1, "Stable", '"box, ""A""\nsecond line"')}`);
  assert.equal(review.samples.length, 1);
  assert.equal(review.samples[0].raw.operator_note, 'box, "A"\nsecond line');
});

test("rejects unknown labels and malformed timestamps", () => {
  const review = parseMotionCsv(`${header}\n${row(1, "Unknown")}\n1.0,S1,T1,nope,0,0,9.81,0,0,0,true,ok,Stable,`);
  assert.equal(review.samples.length, 0);
  assert.equal(review.issues.length, 2);
  assert.equal(review.excludedRowCount, 2);
});

test("excludes all valid samples in a trial with conflicting labels", () => {
  const review = parseMotionCsv(`${header}\n${row(1, "Stable")}\n${row(2, "Rough Handling")}`);
  assert.equal(review.samples.length, 0);
  assert.ok(review.issues.some((entry) => entry.message.includes("conflicting labels")));
});

test("supports uint32 timestamp wrap and excludes duplicate timestamps", () => {
  const review = parseMotionCsv(`${header}\n${row(4_294_967_290)}\n${row(2)}\n${row(2)}`);
  assert.equal(review.samples.length, 2);
  assert.ok(review.issues.some((entry) => entry.message.includes("duplicated")));
});

test("reports unsupported schema and missing columns before review", () => {
  assert.match(parseMotionCsv("x,y\n1,2").fatalError ?? "", /Missing required columns/);
  assert.ok(parseMotionCsv(`${header}\n${row(1).replace("1.0,", "2.0,")}`).issues.some((entry) => entry.message.includes("Unsupported schema")));
});

test("spreadsheet-safe export keeps signed sensor values and neutralizes text formulas", async () => {
  const { makeSafeCsv } = await import("../src/lib/storage.ts");
  const review = parseMotionCsv(`${header}\n1.0,=SESSION,T1,1,-9.81,0,9.81,0,0,0,true,ok,Stable,=1+1`);
  const safe = makeSafeCsv(review.headers, [review.samples[0]], true);
  assert.match(safe, /"-9\.81"/);
  assert.match(safe, /"'=SESSION"/);
  assert.match(safe, /"'=1\+1"/);
});
