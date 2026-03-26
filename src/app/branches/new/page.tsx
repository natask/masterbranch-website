import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { createBranch } from "@/lib/actions/branches";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SITE_DOMAIN } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function NewBranchPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Home</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-6 py-16">
        <Badge className="mb-4 bg-gold/10 text-gold hover:bg-gold/20">Fork</Badge>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Create a Branch</h1>
        <p className="mt-2 mb-10 text-sm text-muted-foreground">
          Fork the master branch. Your branch gets its own subdomain and community.
        </p>

        <form action={createBranch} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Branch Name</Label>
            <Input id="name" name="name" type="text" required placeholder="My Hacker Club" />
            <p className="text-xs text-muted-foreground">
              This becomes your subdomain: my-hacker-club.{SITE_DOMAIN}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="What is your branch about?" />
          </div>
          <Button type="submit" className="rounded-full px-8">Create Branch</Button>
        </form>
      </main>
    </div>
  );
}
