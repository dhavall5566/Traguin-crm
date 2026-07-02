import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/ui/LayoutShell";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { CrmToastProvider } from "@/components/ui/CrmToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Traguin CRM - Travel Agency Operations",
  description: "Enterprise-grade multi-tenant CRM, day-wise itinerary builder, finance ledger, and portal for travel agencies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
          <CrmToastProvider>
            <LayoutShell>{children}</LayoutShell>
          </CrmToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
