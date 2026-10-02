"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { recordModelUse } from "@/lib/db";
import {
  errorMessage,
  onProxyExit,
  onProxyLog,
  proxyStatus,
  startProxy,
  stopProxy,
} from "@/lib/tauri";
import type { LogLine, Settings } from "@/lib/types";
import { DEFAULT_PORT } from "@/lib/types";

const MAX_LOGS = 3000;

export function useProxy() {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);

  // Har log line par setState karne se render storm ban jaata hai jab model
  // stream kar raha ho — is liye ~100ms ke batches mein flush karte hain.
  const pending = useRef<LogLine[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((line: LogLine) => {
    pending.current.push(line);
    if (timer.current) return;

    timer.current = setTimeout(() => {
      timer.current = null;
      const batch = pending.current;
      pending.current = [];
      setLogs((prev) => [...prev, ...batch].slice(-MAX_LOGS));
    }, 100);
  }, []);

  useEffect(() => {
    let unlistenLog: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    onProxyLog(push).then((fn) => (unlistenLog = fn));

    onProxyExit(() => {
      setRunning(false);
      push({ level: "app", text: "── proxy process exited ──" });
    }).then((fn) => (unlistenExit = fn));

    proxyStatus().then(setRunning).catch(() => setRunning(false));

    return () => {
      unlistenLog?.();
      unlistenExit?.();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [push]);

  const start = useCallback(
    async (settings: Settings) => {
      setError(null);
      setBusy(true);
      try {
        await startProxy({
          apiKey: settings.apiKey,
          model: settings.model,
          smallModel: settings.smallModel || settings.model,
          nodePath: settings.nodePath,
          port: Number(settings.port) || Number(DEFAULT_PORT),
        });
        await recordModelUse(settings.model);
        setRunning(true);
        push({ level: "app", text: "── starting proxy ──" });
      } catch (err) {
        setError(errorMessage(err));
        setRunning(false);
      } finally {
        setBusy(false);
      }
    },
    [push],
  );

  const stop = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await stopProxy();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRunning(false);
      setBusy(false);
    }
  }, []);

  const clearLogs = useCallback(() => {
    pending.current = [];
    setLogs([]);
  }, []);

  return { running, busy, error, logs, start, stop, clearLogs, setError };
}
