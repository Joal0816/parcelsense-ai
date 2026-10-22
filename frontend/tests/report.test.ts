import assert from "node:assert/strict";
import test from "node:test";
import { validateEvaluation } from "../src/lib/storage.ts";

test("accepts the pipeline report contract and preserves unknown provenance", () => {
  const result = validateEvaluation({ schema_version: "1.0", model_type: "bounded_cart_decision_tree", labels: ["Stable", "Normal Handling", "Rough Handling"], evaluation: {} });
  assert.equal(result.error, undefined);
  assert.equal(result.report?.data_origin, undefined);
});

test("rejects a missing or unsupported report schema", () => {
  assert.match(validateEvaluation({}).error ?? "", /Unsupported report schema/);
  assert.match(validateEvaluation({ schema_version: "1.0", model_type: "tree" }).error ?? "", /ordered class labels/);
});
