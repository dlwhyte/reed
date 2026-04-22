import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;
const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS === "true";

if (!CLERK_PUBLISHABLE_KEY && !E2E_BYPASS) {
  // Fail loud and early rather than crash deep inside ClerkProvider.
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to frontend/.env.local — see Clerk dashboard → API Keys."
  );
}

const tree = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {E2E_BYPASS ? (
      tree
    ) : (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!}>{tree}</ClerkProvider>
    )}
  </React.StrictMode>
);
