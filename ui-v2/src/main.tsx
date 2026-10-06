import "@fontsource-variable/inter";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isStandalone } from "./bridge/bridge";
import { DesignLab } from "./dev/DesignLab";
import "./ui/tokens.css";
import "./ui/primitives.css";
import "./styles.css";

const params = new URLSearchParams(window.location.search);
const showDesignLab = isStandalone && params.get("lab") === "1";

window.addEventListener("dragstart", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {showDesignLab ? <DesignLab /> : <App />}
  </React.StrictMode>,
);
