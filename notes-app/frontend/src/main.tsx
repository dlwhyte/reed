import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS === "true";

if (!CLERK_PUBLISHABLE_KEY && !E2E_BYPASS) {
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to notes-app/frontend/.env.local — same key as reed/frontend/.env.local."
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {E2E_BYPASS ? (
      <App />
    ) : (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!}>
        <App />
      </ClerkProvider>
    )}
  </React.StrictMode>
);
