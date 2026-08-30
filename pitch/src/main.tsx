import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { Pitch } from "./Pitch";
import "./base.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Pitch />
  </React.StrictMode>,
);
