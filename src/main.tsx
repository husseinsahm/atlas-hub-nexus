import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress hydration warnings for theme persistence
if (typeof window !== "undefined") {
  const root = document.getElementById("root")!;
  createRoot(root).render(<App />);
} else {
  const root = document.getElementById("root")!;
  createRoot(root).render(<App />);
}