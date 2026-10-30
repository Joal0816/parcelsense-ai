import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { LABELS, type CsvReview, type ImportIssue, type MotionSample, type SavedEvaluation, type SavedSession } from "./domain.ts";
import { parseMotionCsv } from "./lib/csv.ts";
import { deleteBackendSession, getBackendHealth, getBackendSessions, uploadReviewedSession, type BackendHealth, type BackendSession } from "./lib/backend.ts";
import { deleteEvaluation, deleteImport, downloadText, getErrorMessage, getImportSamples, listEvaluations, listImports, makeSafeCsv, saveEvaluation, saveImport, validateEvaluation } from "./lib/storage.ts";

type Page = "overview" | "sessions" | "evaluation" | "device" | "settings";
type DataOrigin = "synthetic" | "real_board" | "unknown";
type CaptureMode = "synthetic" | "stm32";
type IconName = "overview" | "data" | "evaluation" | "device" | "settings" | "upload" | "arrow" | "clock" | "check" | "box" | "download" | "trash" | "file" | "close" | "warning" | "refresh" | "external" | "chevron";

const PAGES: Array<{ id: Page; name: string; detail: string; icon: IconName }> = [
  { id: "overview", name: "Overview", detail: "Field desk", icon: "overview" },
  { id: "sessions", name: "Data sessions", detail: "Imports & review", icon: "data" },
  { id: "evaluation", name: "Evaluation", detail: "Model evidence", icon: "evaluation" },
  { id: "device", name: "Device status", detail: "Hardware gate", icon: "device" },
  { id: "settings", name: "Settings", detail: "Storage & privacy", icon: "settings" },
];

const MAX_CSV_BYTES = 25 * 1024 * 1024;
const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const CSV_HEADERS = ["schema_version", "session_id", "trial_id", "timestamp_ms", "accel_x_m_s2", "accel_y_m_s2", "accel_z_m_s2", "gyro_x_rad_s", "gyro_y_rad_s", "gyro_z_rad_s", "valid", "status", "label"];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const shapes: Record<IconName, ReactNode> = {
    overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.3" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.3" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.3" /><path d="M15 17h5m-2.5-2.5v5" /></>,
    data: <><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v5h5M8 13h8M8 17h8" /></>,
    evaluation: <><path d="M4 19V5m0 14h17" /><path d="m7 15 4-4 3 2 5-6" /><circle cx="7" cy="15" r=".7" /><circle cx="11" cy="11" r=".7" /><circle cx="14" cy="13" r=".7" /><circle cx="19" cy="7" r=".7" /></>,
    device: <><rect x="6" y="3.5" width="12" height="17" rx="2" /><path d="M9 6.5h6m-6 11h6M12 9v5m-2.5-2.5h5" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.3 13.7 1.1.9-1.4 2.4-1.4-.5a7 7 0 0 1-1.6.9l-.3 1.5h-2.8l-.3-1.5a7 7 0 0 1-1.6-.9l-1.4.5-1.4-2.4 1.1-.9a7 7 0 0 1 0-1.8l-1.1-.9 1.4-2.4 1.4.5a7 7 0 0 1 1.6-.9l.3-1.5h2.8l.3 1.5a7 7 0 0 1 1.6.9l1.4-.5 1.4 2.4-1.1.9a7 7 0 0 1 0 1.8Z" transform="translate(-2 -1)" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M5 14v5h14v-5" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v8.5" /></>,
    download: <><path d="M12 4v11m-4-4 4 4 4-4" /><path d="M5 18v2h14v-2" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
    file: <><path d="M6 3.5h8l4 4V21H6z" /><path d="M14 3.5V8h4M9 13h6m-6 4h6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    warning: <><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v4m0 3h.01" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 9a6.5 6.5 0 0 1 11-2L20 12M4 12l2.9 5a6.5 6.5 0 0 0 11-2" /></>,
    external: <><path d="M14 4h6v6m0-6-9 9" /><path d="M18 13v6H4V5h6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...common}>{shapes[name]}</svg>;
}

function formatDate(value: string, compact = false): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, compact ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function originLabel(origin: DataOrigin | undefined): string {
  if (origin === "synthetic") return "synthetic";
  if (origin === "real_board") return "STM32 declared · unverified";
  return "source unknown";
}

function PageTitle({ overline, title, description, action }: { overline: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-title"><div><div className="eyebrow">{overline}</div><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div>{action}</div>;
}

function StatusPill({ children, tone = "neutral", dot = true }: { children: ReactNode; tone?: "neutral" | "good" | "alert"; dot?: boolean }) {
  return <span className={`status-pill status-pill--${tone}`}>{dot && <span className="status-dot" aria-hidden="true" />}{children}</span>;
}

function EmptyMark({ icon = "box" }: { icon?: IconName }) {
  return <span className="empty-mark"><Icon name={icon} size={19} /></span>;
}

function App({ offlineReady }: { offlineReady: boolean }) {
  const [page, setPage] = useState<Page>("overview");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("synthetic");
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [imports, setImports] = useState<SavedSession[]>([]);
  const [evaluations, setEvaluations] = useState<SavedEvaluation[]>([]);
  const [pending, setPending] = useState<{ name: string; review: CsvReview; dataOrigin: DataOrigin } | null>(null);
  const [selected, setSelected] = useState<SavedSession | null>(null);
  const [selectedSamples, setSelectedSamples] = useState<MotionSample[]>([]);
  const [report, setReport] = useState<SavedEvaluation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ supported: boolean; persistent?: boolean; usage?: number; quota?: number }>({ supported: false });
  const [requestingPersistence, setRequestingPersistence] = useState(false);
  const [backendState, setBackendState] = useState<{ available: boolean; health?: BackendHealth; sessions: BackendSession[]; error?: string }>({ available: false, sessions: [] });
  const [backendRefreshing, setBackendRefreshing] = useState(false);
  const [backendUploadId, setBackendUploadId] = useState<string | null>(null);
  const [backendDeleteId, setBackendDeleteId] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const mainContentRef = useRef<HTMLElement>(null);
  const previousPageRef = useRef(page);
  const previousSelectionRef = useRef(selected?.id);
  const workerRef = useRef<Worker | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const csvImportOriginRef = useRef<DataOrigin>("unknown");
  const reportInput = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const [savedImports, savedReports] = await Promise.all([listImports(), listEvaluations()]);
      setImports(savedImports);
      setEvaluations(savedReports);
      if (selected) {
        const latest = savedImports.find((item) => item.id === selected.id);
        if (latest) setSelected(latest);
        else { setSelected(null); setSelectedSamples([]); }
      }
      if (report) {
        const latestReport = savedReports.find((item) => item.id === report.id);
        if (latestReport) setReport(latestReport);
        else setReport(null);
      }
    } catch (reason) { setError(getErrorMessage(reason)); }
  };

  async function refreshBackend() {
    if (!import.meta.env.DEV) {
      setBackendState({ available: false, sessions: [], error: "The local API is available only with the development server." });
      return;
    }
    setBackendRefreshing(true);
    try {
      const [health, sessions] = await Promise.all([getBackendHealth(), getBackendSessions()]);
      setBackendState({ available: health.status === "ok", health, sessions });
    } catch (reason) {
      setBackendState({ available: false, sessions: [], error: getErrorMessage(reason) });
    } finally { setBackendRefreshing(false); }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => { void refreshBackend(); }, []);
  useEffect(() => {
    if (previousPageRef.current === page) return;
    previousPageRef.current = page;
    mainContentRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [page]);
  useEffect(() => {
    if (previousSelectionRef.current === selected?.id) return;
    previousSelectionRef.current = selected?.id;
    const heading = selected ? ".session-detail h2" : ".data-list-section h2";
    mainContentRef.current?.querySelector<HTMLElement>(heading)?.focus({ preventScroll: true });
  }, [selected?.id]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    void (async () => {
      const storage = navigator.storage;
      if (!storage?.estimate) { setStorageInfo({ supported: Boolean(storage) }); return; }
      try {
        const [estimate, persistent] = await Promise.all([storage.estimate(), storage.persisted?.() ?? Promise.resolve(undefined)]);
        setStorageInfo({ supported: true, persistent, usage: estimate.usage, quota: estimate.quota });
      } catch { setStorageInfo({ supported: true }); }
    })();
    return () => workerRef.current?.terminate();
  }, []);

  useEffect(() => {
    if (!selected) { setSelectedSamples([]); return; }
    let alive = true;
    void getImportSamples(selected.id).then((items) => { if (alive) setSelectedSamples(items); }).catch((reason) => setError(getErrorMessage(reason)));
    return () => { alive = false; };
  }, [selected?.id]);

  const totalSamples = useMemo(() => imports.reduce((sum, item) => sum + item.sampleCount, 0), [imports]);
  const totalExcluded = useMemo(() => imports.reduce((sum, item) => sum + item.excludedCount, 0), [imports]);
  const pageName = page === "overview" ? "Field desk" : PAGES.find((item) => item.id === page)?.name ?? "Settings";

  function chooseCsv(dataOrigin: DataOrigin = "unknown") {
    csvImportOriginRef.current = dataOrigin;
    csvInput.current?.click();
  }

  function beginCsv(file?: File, dataOrigin: DataOrigin = "unknown") {
    if (!file) return;
    setError(""); setMessage(""); setPending(null);
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Choose a .csv file generated from the ParcelSense dataset schema."); return; }
    if (file.size > MAX_CSV_BYTES) { setError("This import is over the current 25 MiB safety cap. That cap is conservative and has not yet been benchmarked on target phones; the original file is unchanged."); return; }
    if (!("Worker" in window)) {
      if (file.size > 2 * 1024 * 1024) { setError("This browser cannot run the CSV worker. For now, its fallback is limited to 2 MiB; the original file is unchanged."); return; }
      setProcessing(true); setProgress(null);
      void file.text().then((text) => setPending({ name: file.name, review: parseMotionCsv(text), dataOrigin })).catch(() => setError("The selected file could not be read.")).finally(() => setProcessing(false));
      return;
    }
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./lib/csv.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker; setProcessing(true); setProgress(null);
    worker.onmessage = (event: MessageEvent<{ type: string; loaded?: number; total?: number; message?: string; review?: CsvReview }>) => {
      if (event.data.type === "progress" && event.data.loaded !== undefined && event.data.total) setProgress(Math.round((event.data.loaded / event.data.total) * 100));
      if (event.data.type === "complete" && event.data.review) {
        setPending({ name: file.name, review: event.data.review, dataOrigin }); setProcessing(false); worker.terminate(); workerRef.current = null;
      }
      if (event.data.type === "error") { setError(event.data.message ?? "Import failed."); setProcessing(false); worker.terminate(); workerRef.current = null; }
    };
    worker.onerror = () => { setError("The CSV worker stopped unexpectedly. The original file is unchanged."); setProcessing(false); worker.terminate(); workerRef.current = null; };
    worker.postMessage(file);
  }

  function onCsvChange(event: ChangeEvent<HTMLInputElement>) {
    const origin = csvImportOriginRef.current;
    csvImportOriginRef.current = "unknown";
    beginCsv(event.target.files?.[0], origin);
    event.target.value = "";
  }
  function onDrop(event: DragEvent<HTMLElement>, dataOrigin: DataOrigin = "unknown") { event.preventDefault(); setDragging(false); beginCsv(event.dataTransfer.files[0], dataOrigin); }

  async function confirmImport(boardOriginConfirmed = false) {
    if (!pending) return;
    if (pending.dataOrigin === "real_board" && !boardOriginConfirmed) return;
    try {
      const saved = await saveImport(crypto.randomUUID(), pending.name, pending.review, pending.dataOrigin);
      setPending(null); setSelected(saved); setPage("sessions"); setMessage(`${saved.sampleCount.toLocaleString()} valid rows saved locally. The original file remains on your device.`); setError("");
      await refresh();
    } catch (reason) { setError(getErrorMessage(reason)); }
  }

  async function loadDemoCsv() {
    setDemoLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}samples/synthetic-demo.csv`, { headers: { Accept: "text/csv" } });
      if (!response.ok) throw new Error(`Bundled sample request failed (${response.status}).`);
      const csv = await response.text();
      beginCsv(new File([csv], "SYNTHETIC_DEMO_ONLY.csv", { type: "text/csv" }), "synthetic");
      setMessage("Loaded the bundled synthetic sample for review. These values are not STM32 readings.");
    } catch (reason) { setError(`Synthetic sample could not be loaded. ${getErrorMessage(reason)}`); }
    finally { setDemoLoading(false); }
  }

  async function sendReviewedToBackend(item: SavedSession, origin: DataOrigin) {
    setBackendUploadId(item.id); setError(""); setMessage("");
    try {
      const samples = await getImportSamples(item.id);
      const csvText = makeSafeCsv(item.headers.length ? item.headers : CSV_HEADERS, samples, false);
      const saved = await uploadReviewedSession({ source_name: item.sourceName, csv_text: csvText, data_origin: origin });
      const provenance = origin === "synthetic" ? "synthetic test data" : origin === "real_board" ? "user-declared STM32 capture (unverified)" : "unknown provenance";
      setMessage(`${saved.sample_count.toLocaleString()} reviewed rows copied to the local backend (${provenance}). This does not verify STM32 hardware.`);
      await refreshBackend();
    } catch (reason) { setError(`Could not send this reviewed copy to the local backend. ${getErrorMessage(reason)}`); }
    finally { setBackendUploadId(null); }
  }

  async function removeBackendCopy(item: BackendSession) {
    if (!window.confirm(`Delete “${item.source_name}” and its ${item.sample_count.toLocaleString()} rows from the local backend? This does not delete the browser copy.`)) return;
    setBackendDeleteId(item.id); setError(""); setMessage("");
    try {
      await deleteBackendSession(item.id);
      setMessage("Selected copy deleted from the local backend. The browser copy was not changed.");
      await refreshBackend();
    } catch (reason) { setError(`Could not delete the local backend copy. ${getErrorMessage(reason)}`); }
    finally { setBackendDeleteId(null); }
  }

  async function openImport(item: SavedSession) { setSelected(item); setPage("sessions"); setError(""); }

  async function removeImport(item: SavedSession) {
    if (!window.confirm(`Delete “${item.sourceName}” and its ${item.sampleCount.toLocaleString()} saved rows from this browser? This cannot be undone.`)) return;
    try { await deleteImport(item.id); if (selected?.id === item.id) { setSelected(null); setSelectedSamples([]); } setMessage("Selected import deleted from this browser."); await refresh(); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }

  async function exportImport(item: SavedSession, safe: boolean) {
    try {
      const samples = await getImportSamples(item.id);
      const csv = makeSafeCsv(item.headers.length ? item.headers : CSV_HEADERS, samples, safe);
      const basename = item.sourceName.replace(/\.csv$/i, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "parcelsense-session";
      downloadText(`${basename}-${safe ? "spreadsheet-safe" : "exact"}.csv`, csv, "text/csv;charset=utf-8");
      setMessage(safe ? "Spreadsheet-safe export started. Text values beginning with a formula character are prefixed with an apostrophe." : "Exact-value export started for validated rows only.");
    } catch (reason) { setError(getErrorMessage(reason)); }
  }

  async function importReport(file?: File) {
    if (!file) return;
    setError(""); setMessage("");
    if (!file.name.toLowerCase().endsWith(".json")) { setError("Choose a JSON model report produced by ml/scripts/pipeline.py."); return; }
    if (file.size > MAX_REPORT_BYTES) { setError("Evaluation reports are limited to 2 MiB for this local review workflow."); return; }
    try {
      const parsed = validateEvaluation(JSON.parse(await file.text()));
      if (!parsed.report) { setError(parsed.error ?? "This report is not supported."); return; }
      const saved = await saveEvaluation(crypto.randomUUID(), file.name, parsed.report);
      setReport(saved); await refresh(); setMessage("Evaluation report saved locally. Its data provenance remains unknown unless explicitly recorded in the report.");
    } catch (reason) { setError(reason instanceof SyntaxError ? "The selected JSON file is malformed." : getErrorMessage(reason)); }
    finally { if (reportInput.current) reportInput.current.value = ""; }
  }

  async function removeEvaluation(item: SavedEvaluation) {
    if (!window.confirm(`Delete “${item.sourceName}” from this browser?`)) return;
    try { await deleteEvaluation(item.id); if (report?.id === item.id) setReport(null); await refresh(); setMessage("Evaluation report deleted."); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) { setError("This browser does not support persistent-storage requests. Local records can still be removed by browser cleanup."); return; }
    setRequestingPersistence(true);
    try {
      const persistent = await navigator.storage.persist();
      const estimate = await navigator.storage.estimate();
      setStorageInfo({ supported: true, persistent, usage: estimate.usage, quota: estimate.quota });
      setMessage(persistent ? "The browser granted a storage-persistence request. This is not a backup." : "The browser declined the request. Export records you need to keep.");
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setRequestingPersistence(false); }
  }

  async function deleteAllLocalData() {
    if (!window.confirm("Delete all ParcelSense imports, samples, and evaluation reports from this browser? Export anything you need first. This cannot be undone.")) return;
    setDeleting(true);
    try {
      for (const item of imports) await deleteImport(item.id);
      for (const item of evaluations) await deleteEvaluation(item.id);
      setSelected(null); setSelectedSamples([]); setReport(null); setMessage("All ParcelSense records were deleted from this browser."); await refresh();
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setDeleting(false); }
  }

  function chooseReport(id: string) { setReport(evaluations.find((item) => item.id === id) ?? null); }
  function handleDrag(event: DragEvent<HTMLElement>, active: boolean) { event.preventDefault(); setDragging(active); }

  return <div className="app-frame">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar">
      <button className="brand" type="button" onClick={() => { setPage("overview"); setSelected(null); }} aria-label="ParcelSense Field Desk home">
        <span className="brand-mark"><svg viewBox="0 0 44 44" aria-hidden="true"><path d="m6 15 16-9 16 9-16 9-16-9Zm0 0v15l16 9 16-9V15M22 24v15"/><path d="M29 25h7v-7"/></svg></span>
        <span className="brand-name">ParcelSense<span>FIELD DESK <i>v0.1</i></span></span>
      </button>
      <div className="nav-label">WORKSPACE</div>
      <nav className="nav-list" aria-label="Workspace sections">
        {PAGES.map((item, index) => <button key={item.id} className={`nav-item ${page === item.id ? "is-active" : ""}`} type="button" onClick={() => { setPage(item.id); if (item.id !== "sessions") setSelected(null); }} aria-current={page === item.id ? "page" : undefined}>
          <span className="nav-icon"><Icon name={item.icon} /></span><span className="nav-item-copy"><span>{item.name}</span><small>{item.detail}</small></span><span className="nav-index">0{index + 1}</span>
        </button>)}
      </nav>
      <div className="sidebar-fill" />
      <div className="sidebar-note"><span className="sidebar-note-icon"><Icon name="box" size={16} /></span><div><b>Local by default</b><span>{import.meta.env.DEV ? "Backend copies are always optional." : "Your files stay in this browser."}</span></div></div>
      <div className="sidebar-footer"><span>BC A182 · LAB 04</span><span>Build 0.1.0</span></div>
    </aside>

    <div className="main-column">
      <header className="topbar">
        <div className="breadcrumb"><span>ParcelSense AI</span><Icon name="chevron" size={14} /><b>{pageName}</b></div>
        <div className="topbar-status">
          <StatusPill tone={offlineReady ? "good" : "neutral"}>{offlineReady ? "Offline ready" : "Local preview"}</StatusPill>
          <span className={`connection-label ${online ? "" : "is-offline"}`} role="status" aria-live="polite" aria-atomic="true"><span className="connection-dot" aria-hidden="true" />{online ? "No device connected" : "Browser offline"}</span>
        </div>
      </header>

      <main className="content" id="main-content" ref={mainContentRef} tabIndex={-1}>
        {error && <div className="alert alert--error" role="alert"><Icon name="warning" /><span>{error}</span><button type="button" className="icon-button" onClick={() => setError("")} aria-label="Dismiss error"><Icon name="close" size={16} /></button></div>}
        {message && <div className="alert alert--success" role="status"><Icon name="check" /><span>{message}</span><button type="button" className="icon-button" onClick={() => setMessage("")} aria-label="Dismiss message"><Icon name="close" size={16} /></button></div>}

        {page === "overview" && <OverviewPage imports={imports} samples={totalSamples} excluded={totalExcluded} offlineReady={offlineReady} onImport={() => chooseCsv()} onOpen={(item) => void openImport(item)} onPage={setPage} />}
        {page === "sessions" && <SessionsPage imports={imports} selected={selected} samples={selectedSamples} processing={processing} progress={progress} dragging={dragging} demoLoading={demoLoading} captureMode={captureMode} onCaptureModeChange={setCaptureMode} backendAvailable={backendState.available} backendUploadId={backendUploadId} onLoadDemo={() => void loadDemoCsv()} onUpload={(item, origin) => void sendReviewedToBackend(item, origin)} onChoose={() => chooseCsv(captureMode === "stm32" ? "real_board" : "unknown")} onBack={() => setSelected(null)} onDrop={(event) => onDrop(event, captureMode === "stm32" ? "real_board" : "unknown")} onDrag={handleDrag} onOpen={(item) => void openImport(item)} onDelete={(item) => void removeImport(item)} onExport={(item, safe) => void exportImport(item, safe)} onCancelParse={() => { workerRef.current?.terminate(); workerRef.current = null; setProcessing(false); setProgress(null); setMessage("Import canceled. The source file was not changed."); }} />}
        {page === "evaluation" && <EvaluationPage reports={evaluations} report={report} inputRef={reportInput} onImport={() => reportInput.current?.click()} onChange={(event) => void importReport(event.target.files?.[0])} onChoose={chooseReport} onDelete={(item) => void removeEvaluation(item)} />}
        {page === "device" && <DevicePage />}
        {page === "settings" && <SettingsPage imports={imports} evaluations={evaluations} storageInfo={storageInfo} requesting={requestingPersistence} deleting={deleting} backendState={backendState} backendRefreshing={backendRefreshing} backendDeleteId={backendDeleteId} onDeleteBackend={(item) => void removeBackendCopy(item)} onRefreshBackend={() => void refreshBackend()} onPersist={() => void requestPersistentStorage()} onDeleteAll={() => void deleteAllLocalData()} />}
      </main>
    </div>

    <input ref={csvInput} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={onCsvChange} aria-label="Choose a ParcelSense CSV file" />
    <input ref={reportInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => void importReport(event.target.files?.[0])} aria-label="Choose a pipeline evaluation report" />
    {processing && <div className="processing-bar" role="status" aria-live="polite" aria-atomic="true"><span className="processing-spinner" aria-hidden="true" />Reading CSV in a background worker{progress !== null && <><span aria-hidden="true">{progress}%</span><span className="processing-progress" role="progressbar" aria-label="CSV import progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}%`} style={{ transform: `scaleX(${progress / 100})` }} /></>}<button type="button" onClick={() => { workerRef.current?.terminate(); workerRef.current = null; setProcessing(false); setProgress(null); setMessage("Import canceled. The source file was not changed."); }}>Cancel</button></div>}
    {pending && <ReviewDialog name={pending.name} review={pending.review} dataOrigin={pending.dataOrigin} onCancel={() => setPending(null)} onSave={(boardConfirmed) => void confirmImport(boardConfirmed)} />}
  </div>;
}

function OverviewPage({ imports, samples, excluded, offlineReady, onImport, onOpen, onPage }: { imports: SavedSession[]; samples: number; excluded: number; offlineReady: boolean; onImport: () => void; onOpen: (item: SavedSession) => void; onPage: (page: Page) => void }) {
  const latest = imports[0];
  return <>
    <PageTitle overline="OPERATOR WORKSPACE · 01" title="A clearer view of every handling session." description="Review real capture files, check the data, and keep your evaluation evidence together." action={<button className="button button--primary" type="button" onClick={onImport}><Icon name="upload" size={16} />Import CSV</button>} />
    <div className="overview-grid">
      <section className="panel welcome-panel">
        <div className="welcome-heading"><div><div className="eyebrow eyebrow--muted">FIELD DESK / LOCAL WORKSPACE</div><h2>Make the data<br /><em>easy to trust.</em></h2></div><div className="welcome-stamp"><span>{import.meta.env.DEV ? "OPT-IN" : "OFFLINE"}</span><b>{import.meta.env.DEV ? "01" : "02"}</b><span>{import.meta.env.DEV ? <>LOCAL<br />API</> : <>NO<br />CLOUD</>}</span></div></div>
        <p>{import.meta.env.DEV ? "Import a board recording or a pipeline report. Files stay in this browser unless you choose to send reviewed rows to the local API." : "Import a board recording or a pipeline report. Files stay in this browser; the hosted app has no backend connection."}</p>
        <button className="button button--light" type="button" onClick={onImport}><Icon name="upload" size={16} />Choose a recording <Icon name="arrow" size={15} /></button>
        <div className="welcome-foot"><span><span className="tiny-led" />{offlineReady ? "APP SHELL CACHED" : "FIRST VISIT · OPEN WHILE ONLINE"}</span><span>STABLE / NORMAL / ROUGH</span></div>
      </section>
      <section className="panel device-summary">
        <div className="panel-overline"><span>01 / DEVICE</span><span className="signal-dashes" aria-hidden="true"><i /><i /><i /><i /></span></div>
        <div className="device-illustration" aria-hidden="true"><div className="device-orbit device-orbit--one" /><div className="device-orbit device-orbit--two" /><div className="device-chip"><span>PS</span><i /><i /><i /><i /></div><span className="device-cross device-cross--one" /><span className="device-cross device-cross--two" /></div>
        <div className="device-summary-status"><StatusPill>Not connected</StatusPill><span>RT-Spark board</span></div>
        <h3>Ready when<br />the hardware is.</h3>
        <p>Live capture stays locked until the board and its interface are verified.</p>
        <button className="text-button" type="button" onClick={() => onPage("device")}>View device status <Icon name="arrow" size={15} /></button>
      </section>
    </div>

    <div className="metric-strip" aria-label="Local workspace summary">
      <div className="metric"><span>IMPORTED SESSIONS</span><b>{imports.length.toString().padStart(2, "0")}</b><small>Stored in this browser</small></div>
      <div className="metric"><span>VALID MOTION ROWS</span><b>{samples.toLocaleString()}</b><small>Across reviewed imports</small></div>
      <div className="metric"><span>ROWS EXCLUDED</span><b>{excluded.toLocaleString().padStart(2, "0")}</b><small>Validation issues recorded</small></div>
      <button className="metric metric--action" type="button" onClick={() => onPage("evaluation")}><span>EVALUATION REPORTS</span><b><Icon name="arrow" size={20} /></b><small>Review model evidence</small></button>
    </div>

    <div className="section-heading"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>On your desk</h2></div><button className="text-button" type="button" onClick={() => onPage("sessions")}>All data sessions <Icon name="arrow" size={15} /></button></div>
    {latest ? <button className="recent-row" type="button" onClick={() => onOpen(latest)}><span className="recent-icon"><Icon name="file" /></span><span className="recent-main"><b>{latest.sourceName}</b><small>{latest.sampleCount.toLocaleString()} valid rows · {latest.excludedCount} exclusions</small></span><span className="recent-date">{formatDate(latest.importedAt, true)}</span><Icon name="chevron" size={16} /></button> : <div className="empty-row"><EmptyMark /><div><b>No session files yet</b><span>Import a CSV from the documented dataset schema to start your local review.</span></div><button className="button button--outline" type="button" onClick={onImport}>Import first CSV <Icon name="arrow" size={15} /></button></div>}

    <div className="footer-note"><span className="footer-rule" /><span>THE COMPANION IS OPTIONAL. ON-DEVICE INFERENCE REMAINS INDEPENDENT.</span><span className="footer-rule" /></div>
  </>;
}

function ImportDropzone({ dragging, onChoose, onDrop, onDrag, compact = false, captureMode = "stm32" }: { dragging: boolean; onChoose: () => void; onDrop: (event: DragEvent<HTMLElement>) => void; onDrag: (event: DragEvent<HTMLElement>, active: boolean) => void; compact?: boolean; captureMode?: CaptureMode }) {
  return <section className={`dropzone ${dragging ? "is-dragging" : ""} ${compact ? "dropzone--compact" : ""}`} onDragOver={(event) => onDrag(event, true)} onDragLeave={(event) => onDrag(event, false)} onDrop={onDrop} aria-label="CSV import area">
    <div className="dropzone-icon"><Icon name="upload" size={19} /></div><div className="dropzone-copy"><b>{captureMode === "stm32" ? "Import an STM32 capture CSV" : "Bring in a compatible CSV"}</b><span>Drop a file here or browse your device</span></div><button className="button button--outline" type="button" onClick={onChoose}>Browse files <Icon name="arrow" size={15} /></button>
    <small>ParcelSense schema v1.0 · UTF-8 CSV · Up to 25 MiB <span>· Safety cap not yet benchmarked on target phones</span></small>
  </section>;
}

function SessionsPage({ imports, selected, samples, processing, progress, dragging, demoLoading, captureMode, onCaptureModeChange, backendAvailable, backendUploadId, onLoadDemo, onUpload, onChoose, onBack, onDrop, onDrag, onOpen, onDelete, onExport, onCancelParse }: { imports: SavedSession[]; selected: SavedSession | null; samples: MotionSample[]; processing: boolean; progress: number | null; dragging: boolean; demoLoading: boolean; captureMode: CaptureMode; onCaptureModeChange: (mode: CaptureMode) => void; backendAvailable: boolean; backendUploadId: string | null; onLoadDemo: () => void; onUpload: (item: SavedSession, origin: DataOrigin) => void; onChoose: () => void; onBack: () => void; onDrop: (event: DragEvent<HTMLElement>) => void; onDrag: (event: DragEvent<HTMLElement>, active: boolean) => void; onOpen: (item: SavedSession) => void; onDelete: (item: SavedSession) => void; onExport: (item: SavedSession, safe: boolean) => void; onCancelParse: () => void }) {
  return <>
    <PageTitle overline="DATA WORKSPACE · 02" title="Data sessions" description="Use the synthetic demo now, or review a compatible STM32 capture when hardware data is available." action={<div className="page-title-actions">{captureMode === "synthetic" ? <button className="button button--primary" type="button" onClick={onLoadDemo} disabled={demoLoading}>{demoLoading ? "Loading sample…" : "Load synthetic sample"}</button> : <button className="button button--primary" type="button" onClick={onChoose}><Icon name="upload" size={16} />Import STM32 CSV</button>}</div>} />
    <fieldset className="capture-mode">
      <legend>Choose data mode</legend>
      <label className={captureMode === "synthetic" ? "is-selected" : ""}><input type="radio" name="capture-mode" value="synthetic" checked={captureMode === "synthetic"} onChange={() => onCaptureModeChange("synthetic")} /><span>Synthetic demo</span></label>
      <label className={captureMode === "stm32" ? "is-selected" : ""}><input type="radio" name="capture-mode" value="stm32" checked={captureMode === "stm32"} onChange={() => onCaptureModeChange("stm32")} /><span>STM32 capture</span></label>
    </fieldset>
    <p className="capture-mode-description" role="status">{captureMode === "synthetic" ? "Loads a bundled 1,200-row software fixture. It is synthetic, not sensor data, and does not prove classifier performance." : "Imports a compatible CSV recorded elsewhere. Live STM32 connection and recording are not implemented; the app cannot verify a file’s source."}</p>
    {import.meta.env.DEV && !backendAvailable && <p className="backend-hint" role="status">The optional local API is offline. Synthetic demo and CSV review work in the app; local API copies are unavailable.</p>}
    <ImportDropzone dragging={dragging} onChoose={onChoose} onDrop={onDrop} onDrag={onDrag} compact captureMode={captureMode} />
    {processing && <div className="inline-progress"><span className="processing-spinner" />Processing in a background worker {progress === null ? "" : `${progress}%`}<button className="text-button" type="button" onClick={onCancelParse}>Cancel</button></div>}
    {selected ? <SessionDetail key={selected.id} item={selected} samples={samples} backendAvailable={backendAvailable} uploading={backendUploadId === selected.id} onUpload={(origin) => onUpload(selected, origin)} onExport={onExport} onDelete={onDelete} onBack={onBack} /> : <section className="data-list-section">
      <div className="section-heading section-heading--tight"><div><div className="eyebrow">LOCAL RECORDS · {imports.length.toString().padStart(2, "0")}</div><h2 tabIndex={-1}>Imported files</h2></div><span className="local-only"><span className="tiny-led" />THIS BROWSER ONLY</span></div>
      {imports.length ? <div className="session-list">{imports.map((item, index) => <button className="session-list-row" key={item.id} type="button" onClick={() => onOpen(item)}>
        <span className="session-row-number">{String(index + 1).padStart(2, "0")}</span><span className="session-row-icon"><Icon name="file" /></span><span className="session-row-name"><b>{item.sourceName}</b><small>Imported {formatDate(item.importedAt)} · {item.sessionIds.length} {item.sessionIds.length === 1 ? "source session" : "source sessions"} · {originLabel(item.dataOrigin)}</small></span><span className="session-row-count"><b>{item.sampleCount.toLocaleString()}</b><small>VALID ROWS</small></span><span className="session-row-issues">{item.excludedCount ? <StatusPill tone="alert">{item.excludedCount} issues</StatusPill> : <StatusPill tone="good">Clean import</StatusPill>}</span><Icon name="chevron" size={17} />
      </button>)}</div> : <div className="large-empty"><EmptyMark icon="data" /><div><b>Your session archive starts here.</b><p>Import a CSV generated from the project schema. Invalid rows will be shown before anything is saved.</p></div><button className="button button--outline" type="button" onClick={onChoose}>Choose a CSV <Icon name="arrow" size={15} /></button></div>}
      <p className="privacy-caption"><Icon name="box" size={14} /> Imported records stay in browser storage. Keep your original files separately; browser storage is not a backup.</p>
    </section>}
  </>;
}

function SessionDetail({ item, samples, backendAvailable, uploading, onUpload, onExport, onDelete, onBack }: { item: SavedSession; samples: MotionSample[]; backendAvailable: boolean; uploading: boolean; onUpload: (origin: DataOrigin) => void; onExport: (item: SavedSession, safe: boolean) => void; onDelete: (item: SavedSession) => void; onBack: () => void }) {
  const isSynthetic = item.dataOrigin === "synthetic";
  const isRealBoard = item.dataOrigin === "real_board";
  const [dataOrigin, setDataOrigin] = useState<DataOrigin>(item.dataOrigin ?? "unknown");
  useEffect(() => { setDataOrigin(item.dataOrigin ?? "unknown"); }, [item.id, item.dataOrigin]);
  const labels = LABELS.map((label) => ({ label, count: samples.filter((sample) => sample.label === label).length }));
  return <section className="session-detail">
    <button className="text-button detail-back" type="button" onClick={onBack}><Icon name="chevron" size={14} />All imported files</button>
    <div className="detail-toolbar"><div><div className="eyebrow">IMPORT REVIEW · {item.schemaVersion}</div><h2 tabIndex={-1}>{item.sourceName}</h2><span className="detail-meta">Imported {formatDate(item.importedAt)} · {item.sessionIds.length} source session IDs</span></div><div className="detail-actions"><button className="button button--outline" type="button" onClick={() => onExport(item, false)}><Icon name="download" size={15} />Exact values</button><button className="button button--outline" type="button" onClick={() => onExport(item, true)}>Spreadsheet-safe</button><button className="icon-button icon-button--danger" type="button" onClick={() => onDelete(item)} aria-label={`Delete ${item.sourceName}`}><Icon name="trash" size={16} /></button></div></div>
    {(isSynthetic || dataOrigin === "synthetic") && <div className="synthetic-note"><b>Synthetic data provenance.</b> Marked as generated software data; these values are not physical sensor readings or classifier evidence.</div>}
    {isRealBoard && <div className="board-origin-note"><b>STM32 origin declared by user · not verified.</b> The app cannot inspect how this CSV was recorded. Confirm the hardware, sensor units, and capture procedure before using it as real-device evidence.</div>}
    {import.meta.env.DEV && <div className="backend-upload-row"><div><span className="eyebrow">OPTIONAL LOCAL API COPY</span><p>Copies the reviewed valid rows to the local SQLite backend. Excluded source rows are not uploaded.</p></div><div className="backend-upload-controls"><label className="visually-hidden" htmlFor="backend-data-origin">Data provenance</label><select id="backend-data-origin" value={dataOrigin} onChange={(event) => setDataOrigin(event.target.value as DataOrigin)} disabled={!backendAvailable || uploading || isSynthetic}><option value="unknown">Provenance unknown</option><option value="synthetic">Synthetic test data</option><option value="real_board" disabled={!isRealBoard}>User-declared STM32 · unverified</option></select><button className="button button--outline" type="button" disabled={!backendAvailable || uploading || samples.length === 0} onClick={() => onUpload(dataOrigin)}>{uploading ? "Sending…" : "Send reviewed copy"}</button></div></div>}
    <div className="detail-stats"><div><span>VALID ROWS</span><b>{item.sampleCount.toLocaleString()}</b></div><div><span>EXCLUDED ROWS</span><b>{item.excludedCount.toLocaleString()}</b></div><div><span>SOURCE RECORDS</span><b>{item.totalRecords.toLocaleString()}</b></div><div><span>SESSION IDS</span><b>{item.sessionIds.length.toString().padStart(2, "0")}</b></div></div>
    <div className="detail-two-col"><section className="subpanel"><div className="subpanel-heading"><div><span className="eyebrow">CLASS DISTRIBUTION</span><h3>Reviewed labels</h3></div><span>VALID ROWS</span></div>{labels.map(({ label, count }, index) => <div className="label-meter" key={label}><span className={`label-marker label-marker--${index}`} /><span>{label}</span><b>{count.toLocaleString()}</b><span className="meter-track"><i style={{ width: `${samples.length ? Math.max(count / samples.length * 100, count ? 2 : 0) : 0}%` }} /></span></div>)}<p className="muted-caption">Distribution describes imported labels; it does not describe classifier predictions.</p></section>
      <section className="subpanel"><div className="subpanel-heading"><div><span className="eyebrow">VALIDATION LOG</span><h3>{item.issues.length ? `${item.issues.length} notes` : "No exclusions"}</h3></div><span>{item.totalRecords} RECORDS</span></div>{item.issues.length ? <div className="issue-list">{item.issues.slice(0, 8).map((entry, index) => <IssueRow key={`${entry.rowNumber}-${index}`} issue={entry} />)}{item.issues.length > 8 && <div className="more-issues">+ {item.issues.length - 8} more notes saved with this import</div>}</div> : <p className="empty-note">Every imported row passed the available schema checks.</p>}</section></div>
    <div className="table-toolbar"><div><span className="eyebrow">SAMPLE PREVIEW</span><h3>Original values · first {Math.min(samples.length, 8)} rows</h3></div><span>{samples.length.toLocaleString()} VALID TOTAL</span></div>
    {samples.length ? <div className="table-scroll"><table className="sample-table"><thead><tr><th>RECORD</th><th>SESSION / TRIAL</th><th>TIME (MS)</th><th>ACCELERATION (M/S²)</th><th>GYRO (RAD/S)</th><th>LABEL</th></tr></thead><tbody>{samples.slice(0, 8).map((sample) => <tr key={sample.rowNumber}><td>#{sample.rowNumber}</td><td><b>{sample.sessionId}</b><small>{sample.trialId}</small></td><td>{sample.timestampMs}</td><td>{sample.accel.map((value) => value.toFixed(3)).join(" / ")}</td><td>{sample.gyro.map((value) => value.toFixed(3)).join(" / ")}</td><td><LabelPill label={sample.label} /></td></tr>)}</tbody></table></div> : <p className="empty-note">No valid rows were saved. The validation log above contains the exclusions.</p>}
    <p className="exact-export-note">Exact-value export preserves imported cell values for validated rows. Spreadsheet-safe export prefixes formula-like text values. Neither export changes the stored record.</p>
  </section>;
}

function IssueRow({ issue }: { issue: ImportIssue }) {
  return <div className={`issue-row issue-row--${issue.severity}`}><span className="issue-icon"><Icon name={issue.severity === "error" ? "warning" : "clock"} size={14} /></span><span><b>Record {issue.rowNumber || "—"}</b><small>{issue.message}</small></span></div>;
}

function LabelPill({ label }: { label: string }) {
  const index = LABELS.indexOf(label as (typeof LABELS)[number]);
  return <span className={`label-pill label-pill--${index < 0 ? "unknown" : index}`}><i />{label}</span>;
}

function EvaluationPage({ reports, report, inputRef, onImport, onChange, onChoose, onDelete }: { reports: SavedEvaluation[]; report: SavedEvaluation | null; inputRef: React.RefObject<HTMLInputElement | null>; onImport: () => void; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onChoose: (id: string) => void; onDelete: (item: SavedEvaluation) => void }) {
  const model = report?.report;
  const labels = model?.labels ?? model?.label_order ?? [...LABELS];
  const metrics = model?.evaluation ?? {};
  const metricEntries = Object.entries(metrics);
  const counts = model?.data_counts;
  const testGroups = Array.isArray(model?.split?.test_groups) ? model.split.test_groups.filter((entry): entry is string[] => Array.isArray(entry) && entry.length === 2 && entry.every((part) => typeof part === "string")) : [];
  const origin = model?.data_origin;
  const provenance = origin === "synthetic" ? "Synthetic provenance declared by report" : origin === "real_board" ? "Real-board origin declared · not independently verified" : "Provenance unknown";
  return <>
    <PageTitle overline="EVIDENCE WORKSPACE · 03" title="Evaluation review" description="Read pipeline results with their split counts and provenance in view." action={<button className="button button--primary" type="button" onClick={onImport}><Icon name="upload" size={16} />Load report</button>} />
    <div className="report-picker-bar"><div className="report-picker-icon"><Icon name="file" /></div><div><b>{report?.sourceName ?? "No evaluation report selected"}</b><small>{report ? `Loaded ${formatDate(report.loadedAt)} · saved locally` : "Import model.json from an offline pipeline run"}</small></div>{reports.length > 1 && <label className="report-select-label">SAVED REPORTS<select value={report?.id ?? ""} onChange={(event) => onChoose(event.target.value)}><option value="">Choose a report</option>{reports.map((item) => <option key={item.id} value={item.id}>{item.sourceName}</option>)}</select></label>}{report && <button type="button" className="icon-button icon-button--danger" onClick={() => onDelete(report)} aria-label="Delete selected report"><Icon name="trash" size={16} /></button>}</div>
    <input ref={inputRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={onChange} aria-label="Choose a pipeline report" />
    {model ? <>
      <div className={`provenance-banner ${origin === "synthetic" ? "provenance-banner--synthetic" : ""}`}><span className="provenance-mark"><Icon name={origin === "synthetic" ? "warning" : "box"} size={17} /></span><div><b>{provenance}</b><span>{origin === "synthetic" ? "Do not present these values as real parcel-handling performance." : origin === "real_board" ? "The report describes its origin; board provenance is not independently confirmed here." : "This pipeline report does not record whether its data came from hardware or a synthetic smoke test."}</span></div><StatusPill tone={origin === "synthetic" ? "alert" : "neutral"}>{origin === "synthetic" ? "SYNTHETIC" : origin === "real_board" ? "UNVERIFIED ORIGIN" : "SOURCE UNKNOWN"}</StatusPill></div>
      <div className="report-overview"><div className="report-model"><span className="eyebrow">MODEL TYPE</span><h2>{model.model_type?.replaceAll("_", " ") ?? "Unknown model"}</h2><p>Label order: {labels.join(" / ")}</p><p>Feature order: {(model.feature_order ?? model.feature_names ?? []).join(", ") || "Not included"}</p></div><div className="report-counts">{[["VALID WINDOWS", counts?.valid_windows], ["TRAINING", counts?.training_windows], ["HELD OUT", counts?.held_out_windows], ["EXCLUSIONS", counts?.excluded_records]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{typeof value === "number" ? value.toLocaleString() : "—"}</b></div>)}</div></div>
      <div className="evaluation-grid">{metricEntries.map(([name, metric]) => {
        const matrix = metric.confusion_matrix ?? [];
        const perClass = Array.isArray(metric.per_class) ? metric.per_class : labels.map((label) => (metric.per_class as Record<string, { precision?: number; recall?: number; f1?: number; support?: number }> | undefined)?.[label] ?? {});
        const diagonal = matrix.reduce((sum, row, i) => sum + (Number.isFinite(row?.[i]) ? row[i] : 0), 0);
        const total = matrix.flat().reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
        const accuracy = total ? diagonal / total : undefined;
        return <section className="metric-report" key={name}><div className="metric-report-header"><div><span className="eyebrow">HELD-OUT COMPARISON</span><h3>{name.replaceAll("_", " ")}</h3></div><span className="metric-chip">{metric.sample_count ?? total} samples</span></div><div className="f1-summary"><span>MACRO F1</span><b>{metric.macro_f1 === undefined ? "—" : `${(metric.macro_f1 * 100).toFixed(1)}%`}</b><i>{accuracy === undefined ? "No accuracy count" : `${(accuracy * 100).toFixed(1)}% accuracy derived from matrix`}</i></div><div className="metric-rows">{labels.map((label, index) => { const entry = perClass[index] ?? {}; return <div className="metric-line" key={label}><LabelPill label={label} /><span>Precision <b>{percent(entry.precision)}</b></span><span>Recall <b>{percent(entry.recall)}</b></span><span>F1 <b>{percent(entry.f1)}</b></span></div>; })}</div><div className="matrix-heading"><span>CONFUSION MATRIX</span><small>Rows: actual · columns: predicted</small></div>{matrix.length === labels.length ? <div className="table-scroll"><table className="matrix-table"><thead><tr><th>ACTUAL ↓ / PRED. →</th>{labels.map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{matrix.map((row, r) => <tr key={labels[r]}><th>{labels[r]}</th>{labels.map((label, c) => <td className={r === c ? "is-correct" : ""} key={label}>{Number.isFinite(row?.[c]) ? row[c] : "—"}</td>)}</tr>)}</tbody></table></div> : <p className="empty-note">This report does not contain a full confusion matrix.</p>}</section>;
      })}</div>
      <div className="report-split-note"><span><Icon name="check" size={16} /></span><p><b>Trial-group split preserved in the pipeline.</b> {testGroups.length} held-out groups shown in the report. Metrics do not establish device accuracy, especially when provenance is unknown.</p><small>SEED {typeof model.split?.seed === "number" ? model.split.seed : "—"}</small>{testGroups.length > 0 && <details className="split-groups"><summary>View held-out trial IDs</summary><ul>{testGroups.map(([session, trial]) => <li key={`${session}/${trial}`}>{session} / {trial}</li>)}</ul></details>}</div>
    </> : <div className="large-empty report-empty"><EmptyMark icon="evaluation" /><div><b>Bring the evidence with the model.</b><p>Load the pipeline’s <code>model.json</code>. The review keeps class order, held-out counts, and provenance visible together.</p></div><button className="button button--outline" type="button" onClick={onImport}>Choose report <Icon name="arrow" size={15} /></button></div>}
  </>;
}

function percent(value: number | undefined): string { return typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—"; }

function DevicePage() {
  const checks = [
    ["Development board", "RT-Spark / STM32F407ZGT6 target", "Unverified"],
    ["Sensor population", "Board module inventory not inspected", "Unverified"],
    ["Communication interface", "No UART / USB / BLE mapping confirmed", "Unverified"],
    ["Firmware link", "No browser transport adapter implemented", "Disabled"],
    ["Live capture", "Unlock after board and protocol verification", "Disabled"],
  ];
  return <>
    <PageTitle overline="HARDWARE GATE · 04" title="Device status" description="The browser only reports facts established by a real board check. Unknown hardware remains unknown." />
    <section className="device-hero"><div className="device-hero-art" aria-hidden="true"><div className="hero-chip"><span>STM32</span><b>F407</b><i /><i /><i /><i /></div><span className="hero-orbit hero-orbit--a" /><span className="hero-orbit hero-orbit--b" /><span className="hero-cross hero-cross--a" /><span className="hero-cross hero-cross--b" /></div><div className="device-hero-copy"><StatusPill>BOARD UNVERIFIED</StatusPill><h2>No device is connected.</h2><p>This field desk can review files without the RT-Spark. It cannot capture, command, or read from the board yet.</p><div className="device-target"><span>TARGET RECORDED IN PROJECT</span><b>RT-Thread RT-Spark</b><small>STM32F407ZGT6 · actual board revision not inspected</small></div></div></section>
    <section className="device-checks"><div className="section-heading section-heading--tight"><div><div className="eyebrow">VERIFICATION CHECKLIST</div><h2>What is known today</h2></div><StatusPill tone="alert">0 VERIFIED</StatusPill></div>{checks.map(([title, detail, status], index) => <div className="device-check-row" key={title}><span className="check-index">0{index + 1}</span><span className="check-copy"><b>{title}</b><small>{detail}</small></span><StatusPill tone={status === "Disabled" ? "alert" : "neutral"}>{status}</StatusPill></div>)}</section>
    <div className="device-footnote"><Icon name="warning" size={17} /><p><b>Hardware work is still ahead.</b> Sensor identities, pin mappings, module diagnostics, serial behavior, and capture protocol must be confirmed against the physical board before live features are enabled.</p></div>
  </>;
}

function SettingsPage({ imports, evaluations, storageInfo, requesting, deleting, backendState, backendRefreshing, backendDeleteId, onDeleteBackend, onRefreshBackend, onPersist, onDeleteAll }: { imports: SavedSession[]; evaluations: SavedEvaluation[]; storageInfo: { supported: boolean; persistent?: boolean; usage?: number; quota?: number }; requesting: boolean; deleting: boolean; backendState: { available: boolean; health?: BackendHealth; sessions: BackendSession[]; error?: string }; backendRefreshing: boolean; backendDeleteId: string | null; onDeleteBackend: (item: BackendSession) => void; onRefreshBackend: () => void; onPersist: () => void; onDeleteAll: () => void }) {
  const formatBytes = (bytes?: number) => bytes === undefined ? "Not reported" : bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
  return <>
    <PageTitle overline="PREFERENCES · 05" title="Settings & privacy" description="Understand where local records live, how much space the browser reports, and how to remove them." />
    {import.meta.env.DEV && <section className="settings-panel">
      <div className="settings-panel-head"><div className="settings-symbol"><Icon name="box" /></div><div><span className="eyebrow">OPTIONAL BACKEND</span><h2>Local API connection</h2><p>The development API stores reviewed CSV copies in a SQLite file on this computer. It does not run on the hosted static PWA.</p></div><StatusPill tone={backendState.available ? "good" : "alert"}>{backendState.available ? "CONNECTED" : "NOT RUNNING"}</StatusPill></div>
      <div className="storage-stats"><div><span>API VERSION</span><b>{backendState.health?.api_version ?? "—"}</b></div><div><span>STORED COPIES</span><b>{backendState.sessions.length}</b></div><div><span>STORAGE</span><b>{backendState.health?.storage ?? "Unavailable"}</b></div><div><span>DEVICE LINK</span><b>Not connected</b></div></div>
      <div className="settings-actions"><button className="button button--outline" type="button" onClick={onRefreshBackend} disabled={backendRefreshing}>{backendRefreshing ? "Checking…" : "Check connection"}<Icon name="refresh" size={15} /></button><span>{backendState.error ?? "Uploads are explicit. Only reviewed valid rows are sent; the local API does not imply an STM32 connection."}</span></div>
      {backendState.sessions.length > 0 && <div className="backend-session-list" aria-label="Sessions stored in the local backend">{backendState.sessions.map((session) => <div key={session.id}><span className="backend-session-copy"><b>{session.source_name}</b><small>{session.sample_count.toLocaleString()} rows · {originLabel(session.data_origin)}</small></span><button className="icon-button icon-button--danger" type="button" disabled={backendDeleteId === session.id} onClick={() => onDeleteBackend(session)} aria-label={`Delete ${session.source_name} from the local backend`} title="Delete backend copy"><Icon name="trash" size={16} /></button></div>)}</div>}
    </section>}
    <section className="settings-panel"><div className="settings-panel-head"><div className="settings-symbol"><Icon name="box" /></div><div><span className="eyebrow">BROWSER STORAGE</span><h2>Local records stay here.</h2><p>Imports and evaluation reports are stored in this browser’s IndexedDB. They are not encrypted, backed up, or synchronized.</p></div></div>
      <div className="storage-stats"><div><span>USAGE</span><b>{formatBytes(storageInfo.usage)}</b></div><div><span>AVAILABLE QUOTA</span><b>{formatBytes(storageInfo.quota)}</b></div><div><span>PERSISTENCE</span><b>{storageInfo.persistent === undefined ? "Unknown" : storageInfo.persistent ? "Granted" : "Not granted"}</b></div><div><span>RECORD INVENTORY</span><b>{imports.length} imports · {evaluations.length} reports</b></div></div>
      <div className="settings-actions"><button className="button button--outline" type="button" onClick={onPersist} disabled={requesting}>{requesting ? "Requesting…" : "Ask browser to keep storage"}<Icon name="arrow" size={15} /></button><span>{storageInfo.supported ? "Browser estimates may not reflect all limits; exporting is the safest archive." : "This browser does not expose storage estimates."}</span></div>
    </section>
    <section className="settings-panel settings-panel--privacy"><div><span className="eyebrow">DATA CONTROL</span><h2>Clear local project data</h2><p>Delete every imported recording, validated sample, and evaluation report from this browser. This cannot be undone; export anything you need first.</p></div><button className="button button--danger" type="button" onClick={onDeleteAll} disabled={deleting}><Icon name="trash" size={15} />{deleting ? "Deleting…" : "Delete all local data"}</button></section>
    <div className="privacy-disclosure"><Icon name="warning" size={17} /><p><b>Keep a separate copy of your original files.</b> Browser storage can be cleared. {import.meta.env.DEV ? "No cloud copy is made; a CSV is sent only if you choose “Send reviewed copy” while the local API is running." : "The hosted static app has no backend connection."} The app does not collect telemetry.</p></div>
  </>;
}

function ReviewDialog({ name, review, dataOrigin, onCancel, onSave }: { name: string; review: CsvReview; dataOrigin: DataOrigin; onCancel: () => void; onSave: (boardOriginConfirmed: boolean) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const warnings = review.issues.filter((entry) => entry.severity === "warning").length;
  const [boardOriginConfirmed, setBoardOriginConfirmed] = useState(false);
  useEffect(() => { setBoardOriginConfirmed(false); }, [name, dataOrigin]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onCancel(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    };
    focusable()[0]?.focus();
    dialog?.addEventListener("keydown", onKeyDown);
    return () => { dialog?.removeEventListener("keydown", onKeyDown); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" role="presentation"><section ref={dialogRef} className="review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title" aria-describedby="review-description">
    <div className="review-dialog-header"><span className="review-file-icon"><Icon name="file" /></span><div><span className="eyebrow">BEFORE SAVING · CSV REVIEW</span><h2 id="review-title">Check this recording.</h2><p id="review-description">{name}</p></div><button className="icon-button" type="button" onClick={onCancel} aria-label="Cancel CSV review"><Icon name="close" /></button></div>
    {review.fatalError ? <div className="fatal-error"><Icon name="warning" /><div><b>This file cannot be reviewed.</b><span>{review.fatalError}</span></div></div> : <>
      <div className="review-stats"><div><span>VALID ROWS</span><b>{review.samples.length.toLocaleString()}</b><small>Will be available to inspect</small></div><div><span>EXCLUDED ROWS</span><b className={review.excludedRowCount ? "text-alert" : ""}>{review.excludedRowCount.toLocaleString()}</b><small>Will not enter sample storage</small></div><div><span>NOTES</span><b>{warnings.toLocaleString()}</b><small>Warnings retained locally</small></div></div>
      <div className="review-split"><section><div className="eyebrow">VALIDATION NOTES · {review.issues.length}</div><div className="review-issues">{review.issues.length ? review.issues.slice(0, 5).map((entry, index) => <IssueRow key={`${entry.rowNumber}-${index}`} issue={entry} />) : <p className="empty-note">No validation issues found in {review.totalRecords} records.</p>}{review.issues.length > 5 && <p className="more-issues">+ {review.issues.length - 5} more; all notes will be saved</p>}</div></section><section><div className="eyebrow">SAMPLE PREVIEW · FIRST {Math.min(review.samples.length, 4)}</div>{review.samples.length ? <div className="review-sample-list">{review.samples.slice(0, 4).map((sample) => <div key={sample.rowNumber}><span>#{sample.rowNumber}</span><b>{sample.sessionId} / {sample.trialId}</b><LabelPill label={sample.label} /></div>)}</div> : <p className="empty-note">No valid rows. You may save the review notes only.</p>}</section></div>
      {dataOrigin === "real_board" && <label className="origin-confirm"><input type="checkbox" checked={boardOriginConfirmed} onChange={(event) => setBoardOriginConfirmed(event.target.checked)} /><span><b>I declare this CSV was recorded using an STM32 board.</b><small>ParcelSense cannot verify the device or recording process. This import will be labeled “STM32 declared · unverified.”</small></span></label>}
    </>}
    <div className="review-footer"><span><Icon name="box" size={14} />Original file remains unchanged on your device.</span><div><button className="button button--text" type="button" onClick={onCancel}>Cancel</button>{!review.fatalError && <button className="button button--primary" type="button" disabled={dataOrigin === "real_board" && !boardOriginConfirmed} onClick={() => onSave(boardOriginConfirmed)}>Save reviewed import <Icon name="arrow" size={15} /></button>}</div></div>
  </section></div>;
}

export default App;
