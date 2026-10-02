"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert, Card } from "@/components/Field";
import { EnvSnippet } from "@/components/EnvSnippet";
import { interpolate, renderRich, useI18n } from "@/components/I18nProvider";
import { LogConsole } from "@/components/LogConsole";
import { StatusPill } from "@/components/StatusPill";
import { useProxyContext } from "@/components/AppShell";
import { useSettings } from "@/hooks/useSettings";
import { errorMessage, runtimeInfo } from "@/lib/tauri";
import { DEFAULT_PORT, type RuntimeInfo } from "@/lib/types";

export default function ServerPage() {
  const { t } = useI18n();
  const { running, busy, error, logs, start, stop, clearLogs } = useProxyContext();
  const { settings, loading } = useSettings();
  const [info, setInfo] = useState<RuntimeInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  useEffect(() => {
    runtimeInfo().then(setInfo).catch((err) => setInfoError(errorMessage(err)));
  }, []);

  const ready = Boolean(settings.apiKey && settings.model);
  const activePort = settings.port || DEFAULT_PORT;
  const localUrl = `http://127.0.0.1:${activePort}`;

  const maskedKey = settings.apiKey
    ? `${settings.apiKey.slice(0, 10)}…${settings.apiKey.slice(-4)}`
    : t("server.notSet");

  const rows: [string, string][] = info
    ? [
        [t("server.listeningOn"), localUrl],
        [t("server.upstream"), info.upstream_base_url],
        [t("server.model"), settings.model || t("server.notSelected")],
        [t("server.smallModel"), settings.smallModel || settings.model || "—"],
        [t("server.apiKey"), maskedKey],
        [t("server.maxTokens"), String(info.max_tokens)],
        [t("server.reasoningEffort"), info.reasoning_effort || t("server.notSent")],
        [t("server.temperature"), info.temperature || t("server.clientDecides")],
        [t("server.forceModel"), String(info.force_default_model)],
        [t("server.debugLogs"), String(info.debug_logs)],
      ]
    : [];

  return (
    <>
      <header>
        <h1>{t("server.title")}</h1>
        <p>{t("server.subtitle")}</p>
      </header>

      {infoError ? <Alert>{infoError}</Alert> : null}
      {error ? <Alert>{error}</Alert> : null}

      {!loading && !ready ? (
        <Alert kind="warn">
          {interpolate(t("server.setupWarning"), {
            settingsLink: <Link href="/settings">{t("nav.settings")}</Link>,
          })}
        </Alert>
      ) : null}

      <div className="card run-card">
        <div className="run-left">
          <StatusPill running={running} />
          <span className="run-url">{localUrl}</span>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn primary big"
            disabled={running || busy || !ready}
            onClick={() => start(settings)}
          >
            {busy && !running ? t("server.starting") : t("server.start")}
          </button>

          <button
            type="button"
            className="btn danger big"
            disabled={!running || busy}
            onClick={stop}
          >
            {t("server.stop")}
          </button>
        </div>
      </div>

      <Card title={t("server.configTitle")}>
        <dl className="summary">
          {rows.map(([key, value]) => (
            <div key={key} className="summary-row">
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">{renderRich(t("server.configNote"))}</p>
      </Card>

      {info ? <EnvSnippet port={activePort} /> : null}

      <LogConsole logs={logs} onClear={clearLogs} />
    </>
  );
}
