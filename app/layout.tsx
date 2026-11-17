import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Physio Voice — Clinical Copilot for Independent Physiotherapists",
  description: "AI-powered voice intake, automated session-package tracking, and WhatsApp appointment management for physiotherapy clinics in India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-teal-500 selection:text-white">
        <AppProvider>
          <AppShell>
            {children}
          </AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
