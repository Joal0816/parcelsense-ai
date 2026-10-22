import { parseMotionCsv } from "./csv.ts";

const workerScope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<File>) => void): void;
  postMessage(message: unknown): void;
};

workerScope.addEventListener("message", (event: MessageEvent<File>) => {
  const reader = new FileReader();
  reader.onprogress = (progress) => {
    if (progress.lengthComputable) workerScope.postMessage({ type: "progress", loaded: progress.loaded, total: progress.total });
  };
  reader.onerror = () => workerScope.postMessage({ type: "error", message: "The selected file could not be read." });
  reader.onload = () => {
    try { workerScope.postMessage({ type: "complete", review: parseMotionCsv(String(reader.result ?? "")) }); }
    catch { workerScope.postMessage({ type: "error", message: "The CSV could not be parsed. Check the file format and try again." }); }
  };
  reader.readAsText(event.data);
});
