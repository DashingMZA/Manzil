"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { loadPref, savePref } from "@/lib/db";
import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  isColorMode,
  isThemeId,
  type ColorMode,
  type ThemeId,
} from "@/lib/theme";

const THEME_KEY = "theme";
const MODE_KEY = "color_mode";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  /** Saved theme/mode load ho chuki (ya fail ho chuki) — ab window dikhana safe hai. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mode, setModeState] = useState<ColorMode>(DEFAULT_MODE);
  const [ready, setReady] = useState(false);

  // Saved prefs load karo (Tauri ke baghair — plain `pnpm dev` — default par
  // rehna theek hai). `visible: false` window ke liye `ready` flag zaroori
  // hai — window tabhi dikhani hai jab sahi theme load ho chuki ho, warna
  // ek pal ke liye default (dark/green) theme flash hoti (dekhein
  // WindowReveal.tsx).
  useEffect(() => {
    Promise.allSettled([
      loadPref(THEME_KEY).then((v) => v && isThemeId(v) && setThemeState(v)),
      loadPref(MODE_KEY).then((v) => v && isColorMode(v) && setModeState(v)),
    ]).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // "system" ko asli light/dark mein resolve karo aur OS setting badalne par
  // live follow karo.
  useEffect(() => {
    const root = document.documentElement;
    if (mode !== "system") {
      root.dataset.mode = mode;
      return;
    }
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      root.dataset.mode = query.matches ? "dark" : "light";
    };
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, [mode]);

  function setTheme(next: ThemeId) {
    setThemeState(next);
    savePref(THEME_KEY, next).catch(() => {});
  }

  function setMode(next: ColorMode) {
    setModeState(next);
    savePref(MODE_KEY, next).catch(() => {});
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
