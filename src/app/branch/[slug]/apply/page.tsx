import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { applyToBranch } from "@/lib/actions/branches";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ applied?: string }>;
}) {
  const { slug } = await params;
  const { applied } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const branch = await db.query.branches.findFirst({
    where: eq(branches.slug, slug),
  });

  if (!branch) notFound();

  const applyWithId = applyToBranch.bind(null, branch.id);

  if (applied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
            <svg className="h-7 w-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">Application Submitted</h1>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">
            Your application to join {branch.name} has been submitted. The branch admin will review it.
          </p>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={`/branch/${slug}`}>Back to branch</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href={`/branch/${slug}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Back to branch</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Join {branch.name}</h1>
        <p className="mt-2 mb-10 text-sm text-muted-foreground">Apply to become a member of this branch.</p>

        <form action={applyWithId} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Contact Email</Label>
            <Input id="email" name="email" type="email" required placeholder="you@example.com" />
          </div>
          <Button type="submit" className="rounded-full px-8">Submit Application</Button>
        </form>
      </main>
    </div>
  );
}
