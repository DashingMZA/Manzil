"use client";

import { createContext, useContext, type ReactNode } from "react";

import { useProxy } from "@/hooks/useProxy";
import { ContextMenu } from "./ContextMenu";
import { Sidebar } from "./Sidebar";
import { WindowReveal } from "./WindowReveal";

type ProxyContext = ReturnType<typeof useProxy>;

const Ctx = createContext<ProxyContext | null>(null);

/**
 * Ek hi `useProxy` instance poori app ke liye. Warna har page apna listener
 * lagata aur logs duplicate ho jate.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const proxy = useProxy();

  return (
    <Ctx.Provider value={proxy}>
      <Sidebar running={proxy.running} />
      <main>{children}</main>
      <ContextMenu />
      <WindowReveal />
    </Ctx.Provider>
  );
}

export function useProxyContext(): ProxyContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProxyContext must be used inside <AppShell>");
  return ctx;
}
