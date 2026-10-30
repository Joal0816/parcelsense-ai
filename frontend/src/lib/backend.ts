export interface BackendSession {
  id: string;
  source_name: string;
  created_at: string;
  data_origin: "synthetic" | "real_board" | "unknown";
  session_ids: string[];
  sample_count: number;
  source_row_count: number;
  issue_count: number;
}

export interface BackendHealth {
  status: "ok";
  api_version: string;
  storage: string;
}

function assertLocalDevelopment(): void {
  if (typeof import.meta.env !== "undefined" && !import.meta.env.DEV) {
    throw new Error("The ParcelSense API is available only in local development mode.");
  }
}

async function responseError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: unknown };
    if (typeof payload.error === "string") return new Error(payload.error);
  } catch { /* Use the status code below. */ }
  return new Error(`Local backend request failed (${response.status}).`);
}

export async function getBackendHealth(): Promise<BackendHealth> {
  assertLocalDevelopment();
  const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
  if (!response.ok) throw await responseError(response);
  return await response.json() as BackendHealth;
}

export async function getBackendSessions(): Promise<BackendSession[]> {
  assertLocalDevelopment();
  const response = await fetch("/api/sessions", { headers: { Accept: "application/json" } });
  if (!response.ok) throw await responseError(response);
  const payload = await response.json() as { sessions?: BackendSession[] };
  return Array.isArray(payload.sessions) ? payload.sessions : [];
}

export async function getSyntheticDemoCsv(): Promise<string> {
  assertLocalDevelopment();
  const response = await fetch("/api/demo.csv", { headers: { Accept: "text/csv" } });
  if (!response.ok) throw await responseError(response);
  if (response.headers.get("X-Data-Origin") !== "synthetic-demo-only") {
    throw new Error("The backend did not identify this download as synthetic demo data.");
  }
  return response.text();
}

export async function uploadReviewedSession(input: {
  source_name: string;
  csv_text: string;
  data_origin: "synthetic" | "real_board" | "unknown";
}): Promise<BackendSession> {
  assertLocalDevelopment();
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await responseError(response);
  return await response.json() as BackendSession;
}

export async function deleteBackendSession(id: string): Promise<void> {
  assertLocalDevelopment();
  const response = await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Accept: "application/json" } });
  if (!response.ok) throw await responseError(response);
}
