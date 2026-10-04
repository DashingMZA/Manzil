"use client";

import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useState } from "react";

import { Alert, Card } from "@/components/Field";
import { fmt, useI18n } from "@/components/I18nProvider";
import { errorMessage, runtimeInfo } from "@/lib/tauri";
import type { RuntimeInfo } from "@/lib/types";

type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date" }
  | { kind: "available"; version: string; run: () => Promise<void> }
  | { kind: "installing" }
  | { kind: "installed" }
  | { kind: "error"; message: string };

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export default function AboutPage() {
  const { t } = useI18n();
  const [info, setInfo] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateState>({ kind: "idle" });

  useEffect(() => {
    runtimeInfo().then(setInfo).catch((err) => setError(errorMessage(err)));
  }, []);

  async function openLink(url: string) {
    try {
      await open(url);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function checkForUpdates() {
    if (!isTauri()) {
      // Browser preview (`pnpm dev`) — updater Tauri ke baghair kaam nahi
      // karta, seedha releases page par bhej do.
      if (info) openLink(info.update_check_url);
      return;
    }

    setUpdate({ kind: "checking" });
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const result = await check();

      if (!result) {
        setUpdate({ kind: "up-to-date" });
        return;
      }

      setUpdate({
        kind: "available",
        version: result.version,
        run: async () => {
          setUpdate({ kind: "installing" });
          try {
            await result.downloadAndInstall();
            setUpdate({ kind: "installed" });
          } catch (err) {
            setUpdate({ kind: "error", message: errorMessage(err) });
          }
        },
      });
    } catch (err) {
      setUpdate({ kind: "error", message: errorMessage(err) });
    }
  }

  async function restartNow() {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <header>
        <h1>{t("about.title")}</h1>
        <p>{t("about.subtitle")}</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <Card>
        <div className="about-brand">
          <div className="brand-mark large">M</div>
          <div>
            <div className="about-name">{t("brand.name")}</div>
            <div className="muted">{t("brand.tagline")}</div>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 16 }}>
          {t("about.description")}
        </p>

        <dl className="summary" style={{ marginTop: 18 }}>
          <div className="summary-row">
            <dt>{t("about.version")}</dt>
            <dd>{info ? info.app_version : "…"}</dd>
          </div>
          <div className="summary-row">
            <dt>{t("about.homepage")}</dt>
            <dd>
              {info ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => openLink(info.homepage_url)}
                >
                  {info.homepage_url}
                </button>
              ) : (
                "…"
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t("about.checkUpdates")}</div>
            <p className="muted small" style={{ margin: "4px 0 0" }}>
              {update.kind === "idle" && t("about.updateNote")}
              {update.kind === "checking" && t("about.checking")}
              {update.kind === "up-to-date" && t("about.upToDate")}
              {update.kind === "available" &&
                fmt(t("about.updateAvailable"), { version: update.version })}
              {update.kind === "installing" && t("about.installing")}
              {update.kind === "installed" && t("about.installed")}
              {update.kind === "error" && update.message}
            </p>
          </div>

          {update.kind === "available" ? (
            <button type="button" className="btn primary" onClick={update.run}>
              {t("about.downloadInstall")}
            </button>
          ) : update.kind === "installed" ? (
            <button type="button" className="btn primary" onClick={restartNow}>
              {t("about.restart")}
            </button>
          ) : (
            <button
              type="button"
              className="btn primary"
              disabled={!info || update.kind === "checking" || update.kind === "installing"}
              onClick={checkForUpdates}
            >
              {t("about.checkUpdates")}
            </button>
          )}
        </div>
      </Card>
    </>
  );
}
