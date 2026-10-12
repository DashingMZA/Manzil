"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { loadLocale, saveLocaleSetting } from "@/lib/db";
import { setTrayLocale } from "@/lib/tauri";
import {
  locales,
  RTL_LOCALES,
  isLocaleCode,
  type LocaleCode,
} from "@/locales";

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  /** Dot-path lookup, e.g. t("settings.save"). English par fallback. */
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function lookup(dict: unknown, key: string): string | undefined {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined,
      dict,
    );
  return typeof value === "string" ? value : undefined;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("en");

  // Persisted locale load hone tak "en" dikhta hai — blocking nahi karte,
  // taake app khulte hi blank screen na aaye. Load hote hi tray menu
  // (Rust side) ko bhi isi locale par sync kar dete hain — warna tray
  // hamesha English hi dikhata rehta jab tak user khud language na badle.
  useEffect(() => {
    loadLocale()
      .then((saved) => {
        if (isLocaleCode(saved)) {
          setLocaleState(saved);
          setTrayLocale(saved).catch(() => {});
        }
      })
      .catch(() => {
        /* Tauri ke baghair (plain `pnpm dev`) — default "en" par rehna theek hai */
      });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  }, [locale]);

  function setLocale(next: LocaleCode) {
    setLocaleState(next);
    saveLocaleSetting(next).catch(() => {
      /* best-effort — UI turant switch ho chuki hai, save fail bhi ho to koi crash nahi */
    });
    setTrayLocale(next).catch(() => {});
  }

  function t(key: string): string {
    return lookup(locales[locale], key) ?? lookup(locales.en, key) ?? key;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

// ======================================================
// TEXT HELPERS
// ======================================================

/** `{name}` tokens ko string values se replace karta hai (numbers, dates). */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    text,
  );
}

/**
 * `{name}` tokens ko JSX (jaisa ek <Link>) se replace karta hai — matlab
 * translated sentence ke beech mein ek clickable element rakhna ho to.
 */
export function interpolate(
  text: string,
  replacements: Record<string, ReactNode>,
): ReactNode[] {
  const keys = Object.keys(replacements);
  if (keys.length === 0) return [text];

  const pattern = new RegExp(`(${keys.map((k) => `\\{${k}\\}`).join("|")})`, "g");
  return text.split(pattern).map((part, i) => {
    const key = keys.find((k) => `{${k}}` === part);
    return key ? <span key={i}>{replacements[key]}</span> : part;
  });
}

/**
 * Halka sa markdown: `**bold**`, `*italic*`, `` `code` ``. Locale strings
 * mein emphasis ke liye — taake har translation apni jagah bold/code khud
 * carry kar sake, component mein JSX todne ki zaroorat na pade.
 */
export function renderRich(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) parts.push(<b key={key++}>{token.slice(2, -2)}</b>);
    else if (token.startsWith("`")) parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    else parts.push(<i key={key++}>{token.slice(1, -1)}</i>);
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return parts;
}
