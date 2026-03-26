import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { updateProject } from "@/lib/actions/projects";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project) notFound();
  if (project.createdBy !== session.user.id) redirect(`/projects/${id}`);

  const updateWithId = updateProject.bind(null, id);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href={`/projects/${id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Back to project</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-serif text-3xl font-bold tracking-tight">Edit Project</h1>
        <p className="mt-2 mb-10 text-sm text-muted-foreground">Update your project details.</p>

        <form action={updateWithId} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" type="text" required defaultValue={project.title} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={4} defaultValue={project.description || ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="githubUrl">GitHub URL</Label>
            <Input id="githubUrl" name="githubUrl" type="url" defaultValue={project.githubUrl || ""} placeholder="https://github.com/..." />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="tracesPublic"
              name="tracesPublic"
              type="checkbox"
              defaultChecked={project.tracesPublic}
              className="h-4 w-4 rounded border-border bg-secondary accent-gold"
            />
            <Label htmlFor="tracesPublic" className="font-normal text-muted-foreground">
              Make traces public (visible to everyone)
            </Label>
          </div>
          <Button type="submit" className="rounded-full px-8">Save Changes</Button>
        </form>
      </main>
    </div>
  );
}
