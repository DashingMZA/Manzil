"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { BundledNodeInfo, LogLine, RuntimeInfo } from "./types";

/**
 * `true` sirf Tauri window ke andar (`pnpm app:dev` / `pnpm app:build`).
 * Plain `pnpm dev` (browser mein Next.js dekhna, UI par kaam karte waqt)
 * mein `window.__TAURI_INTERNALS__` maujood nahi hota — us case mein
 * `invoke`/`listen` seedha call karne se cryptic crash aata hai
 * ("Cannot read properties of undefined (reading 'transformCallback')").
 * Is guard se browser preview UI dikhata hai, bas Tauri commands no-op ho
 * jate hain.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const NOT_TAURI_MESSAGE =
  "Ye sirf Tauri app ke andar chalta hai (`pnpm app:dev` / `pnpm app:build`), " +
  "plain browser preview mein nahi.";

function requireTauri<T>(run: () => Promise<T>): Promise<T> {
  if (!isTauri()) return Promise.reject(new Error(NOT_TAURI_MESSAGE));
  return run();
}

// ======================================================
// COMMANDS
// ======================================================

export const runtimeInfo = () =>
  requireTauri(() => invoke<RuntimeInfo>("runtime_info"));

export const checkNode = (nodePath: string) =>
  requireTauri(() => invoke<string>("check_node", { nodePath }));

export const bundledNodeInfo = () =>
  requireTauri(() => invoke<BundledNodeInfo>("bundled_node_info"));

export const proxyStatus = () => requireTauri(() => invoke<boolean>("proxy_status"));

export const startProxy = (args: {
  apiKey: string;
  model: string;
  smallModel: string;
  nodePath: string;
  port: number;
}) => requireTauri(() => invoke<void>("start_proxy", args));

export const stopProxy = () => requireTauri(() => invoke<void>("stop_proxy"));

/** Tray menu ("Show Manzil" / "Quit Manzil") ki language badalta hai. */
export const setTrayLocale = (locale: string) =>
  requireTauri(() => invoke<void>("set_tray_locale", { locale }));

// ======================================================
// EVENTS
// ======================================================
//
// Ye silently no-op hote hain (crash nahi) jab Tauri na ho — events sirf
// UI ko live update karne ke liye hain, in ka fail hona fatal nahi hai.

const noopUnlisten: UnlistenFn = () => {};

export const onProxyLog = (handler: (line: LogLine) => void): Promise<UnlistenFn> => {
  if (!isTauri()) return Promise.resolve(noopUnlisten);
  return listen<LogLine>("proxy://log", (event) => handler(event.payload));
};

export const onProxyExit = (handler: () => void): Promise<UnlistenFn> => {
  if (!isTauri()) return Promise.resolve(noopUnlisten);
  return listen("proxy://exit", () => handler());
};

// ======================================================
// ERRORS
// ======================================================

/** Tauri `Err(String)` ko plain string bana deta hai. */
export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return String(err);
}
