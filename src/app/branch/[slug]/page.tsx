import { db } from "@/lib/db";
import { branches, memberships, events } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function BranchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();

  const branch = await db.query.branches.findFirst({
    where: eq(branches.slug, slug),
    with: {
      projectBranches: {
        with: {
          project: {
            with: { creator: true },
          },
        },
      },
      creator: true,
    },
  });

  if (!branch) notFound();

  let isAdmin = false;
  if (session) {
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.branchId, branch.id),
        eq(memberships.role, "admin")
      ),
    });
    isAdmin = !!membership;
  }

  const branchProjects = branch.projectBranches.map((pb) => pb.project);

  const branchEvents = await db.query.events.findMany({
    where: eq(events.branchId, branch.id),
    orderBy: (events, { asc }) => [asc(events.startsAt)],
    limit: 10,
  });

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Home</Link>
            {isAdmin && (
              <Link href={`/branch/${slug}/admin`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Admin</Link>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Badge className="mb-4 bg-gold/10 text-gold hover:bg-gold/20">Branch</Badge>
            <h1 className="font-serif text-4xl font-bold tracking-tight">{branch.name}</h1>
            {branch.description && (
              <p className="mt-3 text-base text-muted-foreground">{branch.description}</p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Created by {branch.creator.name || branch.creator.githubUsername}
            </p>
          </div>
          <Button asChild className="shrink-0 rounded-full">
            <Link href={`/branch/${slug}/apply`}>Apply to Join</Link>
          </Button>
        </div>

        <Separator className="my-10" />

        {/* Projects */}
        <section className="mb-12">
          <h2 className="mb-4 font-serif text-xl font-bold">
            Projects
            <span className="ml-2 text-sm font-normal text-muted-foreground">({branchProjects.length})</span>
          </h2>
          {branchProjects.length === 0 ? (
            <Card className="py-10 text-center">
              <CardContent><p className="text-sm text-muted-foreground">No projects in this branch yet.</p></CardContent>
            </Card>
          ) : (
            <div className="stagger-children space-y-3">
              {branchProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="transition-colors hover:border-gold/20">
                    <CardContent className="py-5">
                      <h3 className="text-sm font-semibold">{project.title}</h3>
                      {project.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        by {project.creator.name || project.creator.githubUsername}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Events */}
        <section>
          <h2 className="mb-4 font-serif text-xl font-bold">
            Events
            <span className="ml-2 text-sm font-normal text-muted-foreground">({branchEvents.length})</span>
          </h2>
          {branchEvents.length === 0 ? (
            <Card className="py-10 text-center">
              <CardContent><p className="text-sm text-muted-foreground">No events yet.</p></CardContent>
            </Card>
          ) : (
            <div className="stagger-children space-y-3">
              {branchEvents.map((event) => (
                <Card key={event.id}>
                  <CardContent className="flex items-start justify-between gap-4 py-5">
                    <div>
                      <h3 className="text-sm font-semibold">{event.title}</h3>
                      {event.startsAt && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {new Date(event.startsAt).toLocaleDateString()} at{" "}
                          {new Date(event.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                      {event.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                      )}
                    </div>
                    {event.lumaUrl && (
                      <Button asChild variant="outline" size="sm" className="shrink-0 rounded-full">
                        <a href={event.lumaUrl} target="_blank" rel="noopener noreferrer">RSVP</a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
