"use client";

import { useI18n } from "@/components/I18nProvider";

export function StatusPill({ running }: { running: boolean }) {
  const { t } = useI18n();
  return (
    <span className={`pill ${running ? "running" : "stopped"}`}>
      {running ? t("status.running") : t("status.stopped")}
    </span>
  );
}
