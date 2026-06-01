import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { FontConfigurator } from "@/components/font-configurator";
import { LayoutShell } from "@/components/layout-shell";
import { SITE_DESCRIPTION, SITE_DOMAIN, SITE_NAME } from "@/lib/config";

const ogImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: SITE_DESCRIPTION,
};

export const metadata: Metadata = {
  metadataBase: new URL(`https://${SITE_DOMAIN}`),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: `https://${SITE_DOMAIN}`,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [ogImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Cormorant+Garamond:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,350;8..60,450;8..60,550;8..60,650&display=swap"
        />
      </head>
      <body className="appear-1 antialiased flex min-h-screen flex-col">
        <QueryProvider>
          <LayoutShell>{children}</LayoutShell>
        </QueryProvider>
        {process.env.NODE_ENV === "development" && <FontConfigurator />}
      </body>
    </html>
  );
}
