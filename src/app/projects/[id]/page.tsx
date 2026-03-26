import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DeleteProjectButton } from "@/components/delete-project-button";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: { creator: true },
  });

  if (!project) notFound();

  const isOwner = session?.user.id === project.createdBy;

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Home</Link>
            {session && (
              <Link href="/dashboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Dashboard</Link>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">{project.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              by {project.creator.name || project.creator.githubUsername}
            </p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href={`/projects/${id}/edit`}>Edit</Link>
              </Button>
              <DeleteProjectButton projectId={id} />
            </div>
          )}
        </div>

        {project.description && (
          <>
            <Separator className="my-8" />
            <p className="text-base leading-relaxed text-muted-foreground">{project.description}</p>
          </>
        )}

        <div className="mt-8 flex gap-3">
          {project.githubUrl && (
            <Button asChild variant="outline" size="sm" className="rounded-full gap-2">
              <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={`/projects/${id}/traces`}>Traces</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
