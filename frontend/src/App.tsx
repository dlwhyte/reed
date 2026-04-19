import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Library from "./pages/Library";
import Reader from "./pages/Reader";
import Settings from "./pages/Settings";
import { useStore } from "./store";
import { BookOpen, Settings as SettingsIcon } from "lucide-react";

export default function App() {
  const { prefs } = useStore();
  const location = useLocation();
  const isReader = location.pathname.startsWith("/read/");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.theme === "dark");
  }, [prefs.theme]);

  return (
    <div className="min-h-screen">
      {!isReader && (
        <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/70 backdrop-blur sticky top-0 z-20">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <BookOpen className="w-5 h-5" /> Reader
            </Link>
            <Link to="/settings" className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900">
              <SettingsIcon className="w-5 h-5" />
            </Link>
          </div>
        </header>
      )}
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/read/:id" element={<Reader />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}
