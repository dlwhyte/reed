import { Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignIn, useAuth } from "@clerk/clerk-react";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import Settings from "./pages/Settings";
import Tags from "./pages/Tags";
import Highlights from "./pages/Highlights";
import Admin from "./pages/Admin";
import { CommandPalette } from "./components/CommandPalette";
import { useStore } from "./store";
import { setTokenGetter } from "./lib/api";

const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS === "true";

// Bridges Clerk's useAuth().getToken (only accessible inside the provider
// tree) into the module-level api.ts token getter so fetch() calls can
// attach Authorization headers without being React components.
function AuthBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
    return () => setTokenGetter(null);
  }, [getToken]);
  return null;
}

export default function App() {
  const { prefs } = useStore();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    // Reader theme only scopes the reader surface; the library is always
    // warm paper. Keep class off <html> for the global chrome.
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
  }, [prefs.theme]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ⌘K / Ctrl+K anywhere opens the palette.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const appRoutes = (
    <>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/highlights" element={<Highlights />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );

  // E2E build skips Clerk entirely — the backend honors E2E_AUTH_BYPASS so
  // requests don't need an Authorization header either.
  if (E2E_BYPASS) {
    return appRoutes;
  }

  return (
    <>
      <SignedIn>
        <AuthBridge />
        {appRoutes}
      </SignedIn>
      <SignedOut>
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#f8f1e4",
          }}
        >
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </>
  );
}
