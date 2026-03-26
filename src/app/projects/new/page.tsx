import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { createProject } from "@/lib/actions/projects";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Dashboard</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-serif text-3xl font-bold tracking-tight">New Project</h1>
        <p className="mt-2 mb-10 text-sm text-muted-foreground">Share what you&apos;ve been building.</p>

        <form action={createProject} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" type="text" required placeholder="My awesome project" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} placeholder="What does it do?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="githubUrl">GitHub URL</Label>
            <Input id="githubUrl" name="githubUrl" type="url" placeholder="https://github.com/..." />
          </div>
          <Button type="submit" className="rounded-full px-8">Create Project</Button>
        </form>
      </main>
    </div>
  );
}
