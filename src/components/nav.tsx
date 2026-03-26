"use client";

import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export function Nav() {
  const { data: session, isPending } = useSession();

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden font-cinzel text-sm font-semibold tracking-wider text-white sm:inline">
            The Master Branch
          </span>
        </div>

        <div className="flex items-center gap-5">
          <Link href="/about" className="text-sm text-white transition-colors hover:text-white/80">
            About
          </Link>
          {session ? (
            <div className="appear-auth flex items-center gap-5">
              <Link href="/dashboard" className="text-sm text-white transition-colors hover:text-white/80">
                Dashboard
              </Link>
              <div className="h-4 w-px bg-border" />
              <button onClick={() => signOut()} className="text-sm text-white transition-colors hover:text-white/80">
                Sign out
              </button>
            </div>
          ) : !isPending ? (
            <div className="appear-auth">
              <Button asChild size="sm" className="shimmer-pill border-beam rounded-full px-5">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

export function NavSimple({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo />
        <Link href={backHref} className="text-sm text-foreground/60 transition-colors hover:text-foreground">
          {backLabel}
        </Link>
      </div>
    </nav>
  );
}
