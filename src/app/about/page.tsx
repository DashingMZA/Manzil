"use client";

import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useState } from "react";

import { Alert, Card } from "@/components/Field";
import { useI18n } from "@/components/I18nProvider";
import { errorMessage, runtimeInfo } from "@/lib/tauri";
import type { RuntimeInfo } from "@/lib/types";

export default function AboutPage() {
  const { t } = useI18n();
  const [info, setInfo] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

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
              {t("about.updateNote")}
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            disabled={!info}
            onClick={() => info && openLink(info.update_check_url)}
          >
            {t("about.checkUpdates")}
          </button>
        </div>
      </Card>
    </>
  );
}
