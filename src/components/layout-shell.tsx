"use client";

import { FlashlightBackground } from "./flashlight-card";
import { Footer } from "./footer";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <FlashlightBackground className="flex min-h-screen flex-col">
      <main className="flex-1">{children}</main>
      <Footer />
    </FlashlightBackground>
  );
}
