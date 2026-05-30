"use client";

import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { COMMUNITY_URL, SITE_NAME } from "@/lib/config";

export function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function SocialNavLink() {
  return (
    <a
      href={COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-gold"
    >
      <XIcon className="topbar-social-icon h-4 w-4" />
    </a>
  );
}

type NavProps = {
  showBrandName?: boolean;
  variant?: "app" | "landing";
};

export function Nav({ showBrandName = true, variant = "app" }: NavProps = {}) {
  const { data: session, isPending } = useSession();

  return (
    <nav className="topbar-nav sticky top-0 z-50 h-[6vh] min-h-[44px] border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        <div className="topbar-brand-group flex items-center gap-3">
          <Logo />
          {showBrandName ? (
            <span className="topbar-text hidden font-cinzel text-sm font-semibold tracking-wider text-white sm:inline">
              {SITE_NAME}
            </span>
          ) : null}
        </div>

        <div className="topbar-link-group flex items-center gap-5">
          {variant === "landing" ? (
            <SocialNavLink />
          ) : (
            <>
              <Link href="/about" className="topbar-text text-sm text-white transition-colors hover:text-white/80">
                About
              </Link>
              {session ? (
                <div className="topbar-link-group appear-auth flex items-center gap-5">
                  <Link href="/dashboard" className="topbar-text text-sm text-white transition-colors hover:text-white/80">
                    Dashboard
                  </Link>
                  <div className="h-4 w-px bg-border" />
                  <button onClick={() => signOut()} className="topbar-text text-sm text-white transition-colors hover:text-white/80">
                    Sign out
                  </button>
                </div>
              ) : !isPending ? (
                <div className="appear-auth">
                  <Button asChild size="sm" className="shimmer-pill border-beam rounded-full px-5">
                    <Link href="/login" className="topbar-text">Sign in</Link>
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export function NavSimple({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <nav className="topbar-nav sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Logo />
        <Link href={backHref} className="text-sm text-foreground/60 transition-colors hover:text-foreground">
          {backLabel}
        </Link>
      </div>
    </nav>
  );
}
