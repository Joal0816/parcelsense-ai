import assert from "node:assert/strict";
import test from "node:test";
import { getErrorMessage } from "../src/lib/storage.ts";

test("quota failures explain recovery without implying older records were removed", () => {
  const message = getErrorMessage(new DOMException("Storage quota exceeded", "QuotaExceededError"));
  assert.match(message, /storage is full/i);
  assert.match(message, /Nothing older was removed/i);
  assert.match(message, /export existing records or delete a selected item/i);
});

test("non-quota storage errors retain their original explanation", () => {
  assert.equal(getErrorMessage(new Error("IndexedDB is unavailable")), "IndexedDB is unavailable");
});
