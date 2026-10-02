"use client";

import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import { Alert, Card, Field } from "@/components/Field";
import { fmt, renderRich, useI18n } from "@/components/I18nProvider";
import { ModelPicker } from "@/components/ModelPicker";
import { useTheme } from "@/components/ThemeProvider";
import { MODEL_CATALOG } from "@/lib/models";
import { useSettings } from "@/hooks/useSettings";
import { bundledNodeInfo, checkNode, errorMessage } from "@/lib/tauri";
import { DEFAULT_PORT, type BundledNodeInfo } from "@/lib/types";
import { THEMES } from "@/lib/theme";
import { LOCALE_CODES, LOCALE_NAMES, type LocaleCode } from "@/locales";

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const { settings, update, persist, loading, error } = useSettings();

  const [showKey, setShowKey] = useState(false);
  const [saveNote, setSaveNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [nodeNote, setNodeNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [bundled, setBundled] = useState<BundledNodeInfo | null>(null);

  // Node runtime card khulte hi khud pata chal jaye ke bundled Node
  // maujood hai ya nahi — user ko manually kuch dhoondna na pade.
  useEffect(() => {
    bundledNodeInfo()
      .then(setBundled)
      .catch(() => setBundled(null)); // Tauri ke baghair (browser preview) — chup chaap skip
  }, []);

  async function save() {
    try {
      await persist();
      setSaveNote({ text: t("settings.saved"), ok: true });
    } catch (err) {
      setSaveNote({ text: errorMessage(err), ok: false });
    }
    setTimeout(() => setSaveNote(null), 4000);
  }

  async function verifyNode() {
    setNodeNote({ text: t("settings.checking"), ok: true });
    try {
      const version = await checkNode(settings.nodePath);
      setNodeNote({ text: `Node ${version}`, ok: true });
    } catch (err) {
      setNodeNote({ text: errorMessage(err), ok: false });
    }
  }

  async function browseNode() {
    const picked = await open({ multiple: false, directory: false, title: "node binary" });
    if (typeof picked === "string") update("nodePath", picked);
  }

  if (loading) {
    return (
      <>
        <header>
          <h1>{t("settings.title")}</h1>
        </header>
        <p className="muted">{t("settings.loading")}</p>
      </>
    );
  }

  return (
    <>
      <header>
        <h1>{t("settings.title")}</h1>
        <p>{t("settings.subtitle")}</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <Card title={t("settings.apiKeyCardTitle")}>
        <Field label={t("settings.apiKeyLabel")} hint={t("settings.apiKeyHint")}>
          <div className="row">
            <input
              type={showKey ? "text" : "password"}
              value={settings.apiKey}
              placeholder="nvapi-…"
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => update("apiKey", e.target.value)}
            />
            <button
              type="button"
              className="btn ghost"
              onClick={() => setShowKey((v) => !v)}
            >
              {showKey ? t("settings.hide") : t("settings.show")}
            </button>
          </div>
        </Field>
      </Card>

      <Card title={t("settings.modelCardTitle")}>
        <Field
          label={t("settings.mainModelLabel")}
          hint={renderRich(fmt(t("settings.modelHint"), { count: MODEL_CATALOG.length }))}
        >
          <ModelPicker
            value={settings.model}
            onChange={(id) => update("model", id)}
          />
        </Field>

        <Field label={t("settings.smallModelLabel")} hint={t("settings.smallModelHint")}>
          <ModelPicker
            value={settings.smallModel}
            onChange={(id) => update("smallModel", id)}
          />
        </Field>

        <div className="info-box">{renderRich(t("settings.infoBox"))}</div>
      </Card>

      <Card title={t("settings.portCardTitle")}>
        <Field
          label={t("settings.portLabel")}
          hint={fmt(t("settings.portHint"), { defaultPort: DEFAULT_PORT })}
        >
          <input
            type="number"
            min={1024}
            max={65535}
            value={settings.port}
            placeholder={DEFAULT_PORT}
            onChange={(e) => update("port", e.target.value)}
          />
        </Field>
      </Card>

      <Card title={t("settings.nodeCardTitle")}>
        <p className="muted small">{renderRich(t("settings.nodeIntro"))}</p>

        {bundled ? (
          <p className={`note ${bundled.available ? "ok" : ""}`}>
            {bundled.available
              ? fmt(t("settings.bundledFound"), { filename: bundled.filename })
              : fmt(t("settings.bundledMissing"), { filename: bundled.filename })}
          </p>
        ) : null}

        <Field label={t("settings.nodePathLabel")} hint={t("settings.nodePathHint")}>
          <div className="row">
            <input
              type="text"
              value={settings.nodePath}
              placeholder="(PATH se dhoondo)"
              spellCheck={false}
              onChange={(e) => update("nodePath", e.target.value)}
            />
            <button type="button" className="btn ghost" onClick={browseNode}>
              {t("settings.browse")}
            </button>
            <button type="button" className="btn ghost" onClick={verifyNode}>
              {t("settings.check")}
            </button>
          </div>
        </Field>

        {nodeNote ? (
          <p className={`note ${nodeNote.ok ? "ok" : "bad"}`}>{nodeNote.text}</p>
        ) : null}
      </Card>

      <Card title={t("settings.themeCardTitle")}>
        <Field label={t("settings.themeHint")}>
          <div className="swatches" role="radiogroup">
            {THEMES.map(({ id, swatch }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                className={`swatch${theme === id ? " active" : ""}`}
                onClick={() => setTheme(id)}
              >
                <span className="swatch-dot" style={{ background: swatch }} />
                <span>{t(`themes.${id}`)}</span>
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <Card title={t("settings.languageCardTitle")}>
        <Field label={t("settings.languageLabel")}>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as LocaleCode)}
          >
            {LOCALE_CODES.map((code) => (
              <option key={code} value={code}>
                {LOCALE_NAMES[code]}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <div className="actions">
        <button type="button" className="btn primary" onClick={save}>
          {t("settings.save")}
        </button>
        {saveNote ? (
          <span className={`note ${saveNote.ok ? "ok" : "bad"}`}>{saveNote.text}</span>
        ) : null}
      </div>
    </>
  );
}
