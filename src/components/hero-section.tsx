"use client";

import { useSession } from "@/lib/auth-client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroSection({ onUpload }: { onUpload: () => void }) {
  const { data: session } = useSession();

  return (
    <section className="relative flex min-h-[calc(100vh-57px)] items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-gold/[0.05] blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h1 className="font-cinzel text-6xl font-bold leading-[1.1] tracking-wide md:text-7xl lg:text-8xl">
          <span className="text-gold-shimmer">The Master</span>
          <br />
          <span className="text-white">Branch</span>
        </h1>
        <div className="mt-10 flex items-center justify-center">
          {!session ? (
            <Button asChild size="lg" className="shimmer-pill border-beam rounded-full px-8 shadow-layered-gold">
              <Link href="/login">Upload Project</Link>
            </Button>
          ) : (
            <Button
              size="lg"
              className="shimmer-pill border-beam rounded-full px-8 shadow-layered-gold"
              onClick={onUpload}
            >
              Upload Project
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
