"use client";

import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/I18nProvider";
import { CopyIcon } from "@/components/Icons";
import { NAV_ITEMS } from "@/components/navItems";

interface MenuState {
  x: number;
  y: number;
  selection: string;
}

const MENU_WIDTH = 200;

/**
 * Browser ka default right-click menu (Back / Refresh / Save as / Print /
 * Inspect) band karta hai aur uski jagah app ke pages ke links dikhata hai.
 *
 * Input / textarea par native menu chhoda gaya hai — warna API key paste
 * karne ka Cut/Copy/Paste menu bhi chala jata.
 */
export function ContextMenu() {
  const { t } = useI18n();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuState | null>(null);

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;

      e.preventDefault();

      const itemCount = NAV_ITEMS.length + 1; // +1 copy row ke liye jagah
      const menuHeight = itemCount * 36 + 16;
      setMenu({
        x: Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 8),
        y: Math.min(e.clientY, window.innerHeight - menuHeight - 8),
        selection: window.getSelection()?.toString() ?? "",
      });
    }

    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!menu) return null;

  return (
    <div
      className="context-menu"
      style={{ left: menu.x, top: menu.y, width: MENU_WIDTH }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.selection ? (
        <>
          <button
            type="button"
            role="menuitem"
            className="context-item"
            onClick={() => {
              writeText(menu.selection).catch(() => {});
              setMenu(null);
            }}
          >
            <CopyIcon />
            <span>{t("contextMenu.copy")}</span>
          </button>
          <div className="context-sep" />
        </>
      ) : null}

      {NAV_ITEMS.map(({ href, labelKey, Icon }) => (
        <button
          key={href}
          type="button"
          role="menuitem"
          className="context-item"
          onClick={() => {
            router.push(href);
            setMenu(null);
          }}
        >
          <Icon />
          <span>{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
