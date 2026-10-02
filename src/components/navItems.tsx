import type { ComponentType } from "react";

import { HeartIcon, InfoIcon, ServerIcon, SettingsIcon } from "./Icons";

export interface NavItem {
  href: string;
  /** Locale key, jaise "nav.server" */
  labelKey: string;
  Icon: ComponentType;
}

/** Sidebar aur right-click menu dono isi list se bante hain — ek jagah edit. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.server", Icon: ServerIcon },
  { href: "/settings", labelKey: "nav.settings", Icon: SettingsIcon },
  { href: "/donate", labelKey: "nav.donate", Icon: HeartIcon },
  { href: "/about", labelKey: "nav.about", Icon: InfoIcon },
];
