import "../shared.scss";
import "./window.scss";

import React from "react";
import { createRoot } from "react-dom/client";
import ErrorBoundary from "../components/ErrorBoundary.tsx";
import App from "./app.tsx";

const container = document.getElementById("app");
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
