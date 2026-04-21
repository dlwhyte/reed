import { Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import Settings from "./pages/Settings";
import Tags from "./pages/Tags";
import Highlights from "./pages/Highlights";
import { CommandPalette } from "./components/CommandPalette";
import { useStore } from "./store";

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

  return (
    <>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/highlights" element={<Highlights />} />
      </Routes>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
