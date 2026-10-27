import assert from "node:assert/strict";
import test from "node:test";
import { deleteBackendSession, getBackendHealth, getBackendSessions, getSyntheticDemoCsv, uploadReviewedSession } from "../src/lib/backend.ts";

const originalFetch = globalThis.fetch;

test("backend client reads health and stored sessions", async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return String(input).endsWith("/health")
      ? new Response(JSON.stringify({ status: "ok", api_version: "1.0", storage: "local SQLite" }), { status: 200 })
      : new Response(JSON.stringify({ count: 1, sessions: [{ id: "s1", source_name: "sample.csv", created_at: "2026-01-01T00:00:00Z", data_origin: "synthetic", session_ids: ["SYNTHETIC_DEMO_ONLY"], sample_count: 1, source_row_count: 1, issue_count: 0 }] }), { status: 200 });
  };
  try {
    assert.equal((await getBackendHealth()).status, "ok");
    assert.equal((await getBackendSessions())[0].data_origin, "synthetic");
    assert.deepEqual(calls, ["/api/health", "/api/sessions"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("backend client requires the synthetic provenance response header", async () => {
  globalThis.fetch = async () => new Response("demo csv", { status: 200, headers: { "X-Data-Origin": "synthetic-demo-only" } });
  try { assert.equal(await getSyntheticDemoCsv(), "demo csv"); }
  finally { globalThis.fetch = originalFetch; }

  globalThis.fetch = async () => new Response("not a tagged sample", { status: 200 });
  try { await assert.rejects(getSyntheticDemoCsv(), /did not identify this download as synthetic/); }
  finally { globalThis.fetch = originalFetch; }
});

test("backend client uploads an explicit provenance and deletes a selected copy", async () => {
  const requests: Array<{ url: string; method: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    requests.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
    return method === "POST"
      ? new Response(JSON.stringify({ id: "copy-1", source_name: "sample.csv", created_at: "2026-01-01T00:00:00Z", data_origin: "unknown", session_ids: ["S1"], sample_count: 3, source_row_count: 3, issue_count: 0 }), { status: 201 })
      : new Response(JSON.stringify({ deleted: true, id: "copy-1" }), { status: 200 });
  };
  try {
    const saved = await uploadReviewedSession({ source_name: "sample.csv", csv_text: "schema_version,...", data_origin: "unknown" });
    await deleteBackendSession(saved.id);
    assert.equal(saved.sample_count, 3);
    assert.equal(requests[0].method, "POST");
    assert.equal(JSON.parse(requests[0].body ?? "{}").data_origin, "unknown");
    assert.deepEqual(requests.slice(1), [{ url: "/api/sessions/copy-1", method: "DELETE", body: undefined }]);
  } finally { globalThis.fetch = originalFetch; }
});
