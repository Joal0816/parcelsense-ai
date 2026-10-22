import React from "react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.css";

const mount = document.getElementById("root");
if (!mount) throw new Error("ParcelSense app root is missing.");

function Root() {
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => setOfflineReady(true))
      .catch(() => setOfflineReady(false));
  }, []);
  return <App offlineReady={offlineReady} />;
}

createRoot(mount).render(<React.StrictMode><Root /></React.StrictMode>);
