/** Rust ke `config::RuntimeInfo` ka mirror. Sab hardcoded, read-only. */
export interface RuntimeInfo {
  /** Sirf default value — actual port Settings (`Settings.port`) se aata hai. */
  default_port: number;
  upstream_base_url: string;
  max_tokens: number;
  reasoning_effort: string;
  temperature: string;
  force_default_model: boolean;
  include_reasoning: boolean;
  debug_logs: boolean;
  min_node_major: number;
  app_version: string;
  homepage_url: string;
  update_check_url: string;
}

/** Rust ke `catalog::CatalogEntry` ka mirror. */
export interface CatalogEntry {
  id: string;
  category: string;
  /** Tool calling support karta hai — yaani Claude Code ke liye kaam ka. */
  agentic: boolean;
}

/** Rust ke `proxy::BundledNodeInfo` ka mirror. */
export interface BundledNodeInfo {
  available: boolean;
  filename: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "app";

export interface LogLine {
  level: LogLevel;
  text: string;
}

/** Ye SQLite mein save hoti hain. */
export interface Settings {
  apiKey: string;
  model: string;
  smallModel: string;
  nodePath: string;
  /** String rakha hai (input field ke liye asaan), number mein parse hota hai use hote waqt. */
  port: string;
}

export const DEFAULT_PORT = "3456";

export const EMPTY_SETTINGS: Settings = {
  apiKey: "",
  model: "",
  smallModel: "",
  nodePath: "",
  port: DEFAULT_PORT,
};
