"use client";

import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useState } from "react";

import { renderRich, useI18n } from "@/components/I18nProvider";
import { errorMessage } from "@/lib/tauri";

export function EnvSnippet({ port }: { port: string | number }) {
  const { t } = useI18n();
  const [note, setNote] = useState("");

  const snippet = [
    `export ANTHROPIC_BASE_URL="http://127.0.0.1:${port}"`,
    `export ANTHROPIC_AUTH_TOKEN="local"`,
    `export ANTHROPIC_API_KEY=""`,
    `export API_TIMEOUT_MS=600000`,
    `claude`,
  ].join("\n");

  async function copy() {
    try {
      await writeText(snippet);
      setNote(t("envSnippet.copied"));
    } catch (err) {
      setNote(errorMessage(err));
    }
    setTimeout(() => setNote(""), 3000);
  }

  return (
    <section className="card">
      <h2>{t("envSnippet.title")}</h2>
      <p className="muted">{t("envSnippet.intro")}</p>

      <pre className="snippet">{snippet}</pre>

      <div className="row">
        <button type="button" className="btn ghost" onClick={copy}>
          {t("envSnippet.copy")}
        </button>
        <span className="note ok">{note}</span>
      </div>

      <p className="muted small">{renderRich(t("envSnippet.note"))}</p>
    </section>
  );
}
