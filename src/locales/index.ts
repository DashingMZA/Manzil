import ar from "./ar.json";
import de from "./de.json";
import en from "./en.json";
import hi from "./hi.json";
import ur from "./ur.json";

export const locales = { en, ur, de, ar, hi } as const;

export type LocaleCode = keyof typeof locales;

export const LOCALE_CODES = Object.keys(locales) as LocaleCode[];

/** Scripts jo right-to-left mein likhi jati hain. */
export const RTL_LOCALES = new Set<LocaleCode>(["ur", "ar"]);

/** Har language ka naam usi ki apni script mein — dropdown ke liye. */
export const LOCALE_NAMES: Record<LocaleCode, string> = {
  en: "English",
  ur: "اردو",
  de: "Deutsch",
  ar: "العربية",
  hi: "हिन्दी",
};

export function isLocaleCode(value: string): value is LocaleCode {
  return value in locales;
}
