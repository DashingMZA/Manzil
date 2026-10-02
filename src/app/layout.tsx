import type { Metadata } from "next";

import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/components/I18nProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manzil",
  description: "NVIDIA NIM models ko Claude Code mein chalayein",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // lang/dir yahan sirf initial (server-rendered) value hai — I18nProvider
  // client par persisted locale load hote hi <html> par live update kar
  // deta hai (dekhein I18nProvider.tsx).
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <I18nProvider>
            <AppShell>{children}</AppShell>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
