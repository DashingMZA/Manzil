"use client";

import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import type { LogLevel, LogLine } from "@/lib/types";

const RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  app: 1,
  warn: 2,
  error: 3,
};

export function LogConsole({
  logs,
  onClear,
}: {
  logs: LogLine[];
  onClear: () => void;
}) {
  const { t } = useI18n();
  const [minLevel, setMinLevel] = useState<number>(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const filters = [
    { value: -1, label: t("logs.filterAll") },
    { value: 1, label: t("logs.filterInfo") },
    { value: 2, label: t("logs.filterWarn") },
    { value: 3, label: t("logs.filterError") },
  ] as const;

  const visible = logs.filter((line) => RANK[line.level] >= minLevel);

  useEffect(() => {
    if (!autoScroll) return;
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [visible.length, autoScroll]);

  return (
    <section className="card logs-card">
      <div className="logs-head">
        <h2>{t("logs.title")}</h2>
        <div className="row">
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(Number(e.target.value))}
            aria-label={t("logs.title")}
          >
            {filters.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <label className="mini-check">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span>{t("logs.autoScroll")}</span>
          </label>

          <button type="button" className="btn ghost" onClick={onClear}>
            {t("logs.clear")}
          </button>
        </div>
      </div>

      <div className="logs" ref={boxRef}>
        {visible.length === 0 ? (
          <div className="log-empty">
            {logs.length === 0 ? t("logs.emptyStopped") : t("logs.emptyFiltered")}
          </div>
        ) : (
          visible.map((line, i) => (
            <div key={i} className={`log ${line.level}`}>
              {line.text}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
