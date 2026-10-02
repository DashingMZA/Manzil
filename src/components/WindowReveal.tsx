"use client";

import { useEffect, useRef } from "react";

import { useTheme } from "@/components/ThemeProvider";

const FALLBACK_MS = 800;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * `tauri.conf.json` ke windows config mein `visible: false` hai — window
 * launch par khud nahi dikhti. Wajah: agar turant dikha di jaye to ek pal
 * ke liye default theme (dark + green) flash hoti hai, phir saved
 * theme/mode load ho kar switch hoti hai — is component ka kaam wahi flash
 * rokna hai.
 *
 * `ThemeProvider` ka `ready` flag true hote hi (saved prefs load ho chuki,
 * `<html data-theme>`/`data-mode` set ho chuke) window show karte hain.
 * Ek fallback timeout bhi hai — agar kisi wajah se `ready` kabhi true na ho,
 * window hamesha ke liye invisible na reh jaye.
 */
export function WindowReveal() {
  const { ready } = useTheme();
  const shown = useRef(false);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;

    async function reveal() {
      if (shown.current || cancelled) return;
      shown.current = true;
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().show();
      } catch {
        // Window pehle se visible ho ya API fail ho — chup chaap ignore,
        // ye sirf ek cosmetic reveal hai, app ke kaam karne se koi taalluq nahi.
      }
    }

    if (ready) {
      reveal();
      return;
    }

    const timer = setTimeout(reveal, FALLBACK_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready]);

  return null;
}
