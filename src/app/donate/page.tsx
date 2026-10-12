"use client";

import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";

import { Alert, Card } from "@/components/Field";
import { useI18n } from "@/components/I18nProvider";
import { CRYPTO_OPTIONS, LINK_OPTIONS, isConfigured } from "@/lib/donation";
import { errorMessage } from "@/lib/tauri";

type Tab = "crypto" | "other";

export default function DonatePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("crypto");
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copyAddress(key: string, address: string) {
    try {
      await writeText(address);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2500);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function openLink(url: string) {
    try {
      await openUrl(url);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <header>
        <h1>{t("donate.title")}</h1>
        <p>{t("donate.subtitle")}</p>
      </header>

      {error ? <Alert>{error}</Alert> : null}

      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === "crypto" ? " active" : ""}`}
          onClick={() => setTab("crypto")}
        >
          {t("donate.tabCrypto")}
        </button>
        <button
          type="button"
          className={`tab${tab === "other" ? " active" : ""}`}
          onClick={() => setTab("other")}
        >
          {t("donate.tabOther")}
        </button>
      </div>

      {tab === "crypto" ? (
        <div className="donate-list">
          {CRYPTO_OPTIONS.map((opt) => {
            const key = `${opt.coin}-${opt.network ?? ""}`;
            const configured = isConfigured(opt.address);
            return (
              <Card key={key}>
                <div className="donate-row">
                  <div>
                    <div className="donate-coin">
                      {opt.coin}
                      {opt.network ? <span className="muted"> · {opt.network}</span> : null}
                    </div>
                    <div className="donate-address">
                      {configured ? opt.address : t("donate.notConfigured")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!configured}
                    onClick={() => copyAddress(key, opt.address)}
                  >
                    {copiedKey === key ? t("donate.copied") : t("donate.copyAddress")}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="donate-list">
          {LINK_OPTIONS.map((opt) => {
            const configured = isConfigured(opt.url);
            return (
              <Card key={opt.id}>
                <div className="donate-row">
                  <div>
                    <div className="donate-coin">{opt.label}</div>
                    <div className="donate-address">
                      {configured ? opt.url : t("donate.notConfigured")}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={!configured}
                    onClick={() => openLink(opt.url)}
                  >
                    {t("donate.openLink")}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="muted" style={{ textAlign: "center", marginTop: 8 }}>
        {t("donate.thankYou")}
      </p>
    </>
  );
}
