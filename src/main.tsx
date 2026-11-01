import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { hydrate } from "./lib/store";
import "./index.css";

hydrate();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
