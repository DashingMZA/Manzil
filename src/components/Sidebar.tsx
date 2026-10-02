"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";

import { useI18n } from "@/components/I18nProvider";
import {
  ChevronDoubleIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@/components/Icons";
import { NAV_ITEMS } from "@/components/navItems";
import { useTheme } from "@/components/ThemeProvider";
import { loadPref, savePref } from "@/lib/db";
import { COLOR_MODES, type ColorMode } from "@/lib/theme";

const SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed";

const MODE_OPTIONS: { mode: ColorMode; Icon: ComponentType }[] = [
  { mode: "light", Icon: SunIcon },
  { mode: "dark", Icon: MoonIcon },
  { mode: "system", Icon: MonitorIcon },
];

const MODE_ICON: Record<ColorMode, ComponentType> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

export function Sidebar({ running }: { running: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { mode, setMode } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    loadPref(SIDEBAR_COLLAPSED_KEY)
      .then((v) => setCollapsed(v === "true"))
      .catch(() => {});
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    savePref(SIDEBAR_COLLAPSED_KEY, String(next)).catch(() => {});
  }

  function cycleMode() {
    const i = COLOR_MODES.indexOf(mode);
    setMode(COLOR_MODES[(i + 1) % COLOR_MODES.length]);
  }

  const CurrentModeIcon = MODE_ICON[mode];

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="brand">
        <div className="brand-mark">M</div>
        {!collapsed ? (
          <div>
            <div className="brand-name">{t("brand.name")}</div>
            <div className="brand-sub">{t("brand.tagline")}</div>
          </div>
        ) : null}
      </div>

      <nav>
        {NAV_ITEMS.map(({ href, labelKey, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`nav-item${active ? " active" : ""}`}
              title={collapsed ? t(labelKey) : undefined}
            >
              <Icon />
              {!collapsed ? <span>{t(labelKey)}</span> : null}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="collapse-btn"
        onClick={toggleCollapsed}
        title={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
        aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
      >
        <ChevronDoubleIcon pointLeft={!collapsed} />
        {!collapsed ? <span>{t("sidebar.collapse")}</span> : null}
      </button>

      {collapsed ? (
        <button
          type="button"
          className="mode-btn mode-btn-single"
          title={t(`mode.${mode}`)}
          aria-label={t(`mode.${mode}`)}
          onClick={cycleMode}
        >
          <CurrentModeIcon />
        </button>
      ) : (
        <div className="mode-toggle" role="group" aria-label={t("mode.label")}>
          {MODE_OPTIONS.map(({ mode: m, Icon }) => (
            <button
              key={m}
              type="button"
              className={`mode-btn${mode === m ? " active" : ""}`}
              title={t(`mode.${m}`)}
              aria-label={t(`mode.${m}`)}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              <Icon />
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-foot">
        <span className={`dot${running ? " on" : ""}`} />
        {!collapsed ? (
          <span>{running ? t("status.running") : t("status.stopped")}</span>
        ) : null}
      </div>
    </aside>
  );
}
