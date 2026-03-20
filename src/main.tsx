import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from '@/lib/sentry';
initSentry();

// Limpar sessões do projeto antigo (Lovable/Supabase antigo)
const OLD_PROJECT_ID = 'gyovaxenxtrogrxmbjde';
Object.keys(localStorage).forEach(key => {
  if (key.includes(OLD_PROJECT_ID)) {
    localStorage.removeItem(key);
  }
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
