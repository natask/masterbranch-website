import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Cinzel,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { FontConfigurator } from "@/components/font-configurator";
import { LayoutShell } from "@/components/layout-shell";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${cormorant.variable} ${cinzel.variable} ${jetbrainsMono.variable} appear-1 antialiased flex min-h-screen flex-col`}
      >
        <QueryProvider>
          <LayoutShell>{children}</LayoutShell>
        </QueryProvider>
        {process.env.NODE_ENV === "development" && <FontConfigurator />}
      </body>
    </html>
  );
}
