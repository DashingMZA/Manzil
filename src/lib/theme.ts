/** 10 accent color themes. Colors ka asal CSS `globals.css` ke `data-theme` blocks mein hai — yahan sirf id + swatch preview. */
export const THEMES = [
  { id: "green", swatch: "#76b900" },
  { id: "blue", swatch: "#3b82f6" },
  { id: "indigo", swatch: "#6366f1" },
  { id: "purple", swatch: "#8b5cf6" },
  { id: "pink", swatch: "#ec4899" },
  { id: "red", swatch: "#ef4444" },
  { id: "orange", swatch: "#f97316" },
  { id: "yellow", swatch: "#eab308" },
  { id: "teal", swatch: "#14b8a6" },
  { id: "cyan", swatch: "#06b6d4" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const COLOR_MODES = ["light", "dark", "system"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

/** Purani (pehle se maujood) look ko barqarar rakhne ke liye default dark + green. */
export const DEFAULT_THEME: ThemeId = "green";
export const DEFAULT_MODE: ColorMode = "dark";

export const isThemeId = (v: string): v is ThemeId => THEMES.some((t) => t.id === v);
export const isColorMode = (v: string): v is ColorMode =>
  (COLOR_MODES as readonly string[]).includes(v);
