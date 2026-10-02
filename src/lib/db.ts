"use client";

import Database from "@tauri-apps/plugin-sql";

import { EMPTY_SETTINGS, type Settings } from "./types";

/**
 * Migrations Rust side (`src-tauri/src/main.rs`) mein define hain, is liye
 * yahan sirf load karna hai — schema tab tak ready ho chuka hota hai.
 *
 * Plain `pnpm dev` (browser, Tauri ke baghair) mein SQLite plugin available
 * nahi hota — us case mein saaf error dena behtar hai bajaye cryptic crash
 * ke.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let handle: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!isTauri()) {
    return Promise.reject(
      new Error(
        "Ye sirf Tauri app ke andar chalta hai (`pnpm app:dev`), plain browser preview mein nahi.",
      ),
    );
  }
  handle ??= Database.load("sqlite:manzil.db");
  return handle;
}

// ======================================================
// SETTINGS  (key/value)
// ======================================================

const KEYS = {
  apiKey: "api_key",
  model: "model",
  smallModel: "small_model",
  nodePath: "node_path",
  port: "port",
} as const satisfies Record<keyof Settings, string>;

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings",
  );

  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  return {
    apiKey: byKey.get(KEYS.apiKey) ?? EMPTY_SETTINGS.apiKey,
    model: byKey.get(KEYS.model) ?? EMPTY_SETTINGS.model,
    smallModel: byKey.get(KEYS.smallModel) ?? EMPTY_SETTINGS.smallModel,
    nodePath: byKey.get(KEYS.nodePath) ?? EMPTY_SETTINGS.nodePath,
    port: byKey.get(KEYS.port) ?? EMPTY_SETTINGS.port,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDb();

  for (const [field, key] of Object.entries(KEYS) as [keyof Settings, string][]) {
    await db.execute(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = datetime('now')`,
      [key, settings[field]],
    );
  }
}

// ======================================================
// LOCALE  (UI language — same settings table, separate key)
// ======================================================
//
// Settings type se alag rakha gaya hai jaan-boojh kar — locale AppShell
// level par ek global I18nProvider manage karta hai, har page ke apne
// useSettings() instance se nahi.

const LOCALE_KEY = "locale";

export async function loadLocale(): Promise<string> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [LOCALE_KEY],
  );
  return rows[0]?.value ?? "en";
}

export async function saveLocaleSetting(locale: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = datetime('now')`,
    [LOCALE_KEY, locale],
  );
}

// ======================================================
// UI PREFS  (theme / color mode — same settings table, alag keys)
// ======================================================

export async function loadPref(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function savePref(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ($1, $2, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = datetime('now')`,
    [key, value],
  );
}

// ======================================================
// USAGE  (recently used models)
// ======================================================

export async function recordModelUse(modelId: string): Promise<void> {
  if (!modelId) return;
  const db = await getDb();

  await db.execute(
    `INSERT INTO model_usage (model_id, uses, last_used)
     VALUES ($1, 1, datetime('now'))
     ON CONFLICT(model_id) DO UPDATE SET
       uses = uses + 1, last_used = datetime('now')`,
    [modelId],
  );
}

export async function recentModels(limit = 5): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ model_id: string }[]>(
    "SELECT model_id FROM model_usage ORDER BY last_used DESC LIMIT $1",
    [limit],
  );
  return rows.map((r) => r.model_id);
}
