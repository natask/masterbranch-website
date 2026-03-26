import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function BranchNotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-4">
          <Logo />
        </div>
      </nav>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Branch not found</h1>
        <p className="mt-3 text-muted-foreground">
          This branch doesn&apos;t exist or may have been removed.
        </p>
        <Button asChild className="mt-8 rounded-full">
          <Link href="/">Back to home</Link>
        </Button>
      </main>
    </div>
  );
}
