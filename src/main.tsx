import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { hydrate } from "./lib/store";
import { seedAll } from "./lib/explain";
import "./index.css";

// Resume preparing explanations that were not finished last time.
hydrate().then(seedAll);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
