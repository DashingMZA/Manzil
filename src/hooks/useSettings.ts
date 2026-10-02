"use client";

import { useCallback, useEffect, useState } from "react";

import { loadSettings, saveSettings } from "@/lib/db";
import { errorMessage } from "@/lib/tauri";
import { EMPTY_SETTINGS, type Settings } from "@/lib/types";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const persist = useCallback(async (next?: Settings) => {
    const toSave = next ?? settings;
    await saveSettings(toSave);
    setSettings(toSave);
  }, [settings]);

  return { settings, setSettings, update, persist, loading, error };
}
