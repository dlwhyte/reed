import { create } from "zustand";

type Prefs = {
  theme: "light" | "dark" | "sepia";
  font: "serif" | "sans";
  fontSize: number;
  width: number;
};

type Store = {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
};

const LOAD = (): Prefs => {
  try {
    const raw = localStorage.getItem("reader.prefs");
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
};

const DEFAULTS: Prefs = { theme: "light", font: "serif", fontSize: 18, width: 680 };

export const useStore = create<Store>((set, get) => ({
  prefs: LOAD(),
  setPrefs: (p) => {
    const next = { ...get().prefs, ...p };
    set({ prefs: next });
    localStorage.setItem("reader.prefs", JSON.stringify(next));
  },
}));
