import { db } from "@/lib/db";
import { projects, memberships, traces } from "@/lib/db/schema";
import { getSession } from "@/lib/auth-server";
import { eq, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Nav } from "@/components/nav";
import { NewProjectModal, NewBranchModal } from "@/components/dashboard-modals";
import { DashboardProjects } from "@/components/dashboard-projects";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [userProjects, userMemberships, traceCount] = await Promise.all([
    db.query.projects.findMany({
      where: eq(projects.createdBy, session.user.id),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    }),
    db.query.memberships.findMany({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.status, "approved")
      ),
      with: {
        branch: true,
      },
    }),
    db
      .select({ value: count() })
      .from(traces)
      .where(eq(traces.createdBy, session.user.id))
      .then((r) => r[0]?.value ?? 0),
  ]);

  return (
    <div className="min-h-screen">
      <Nav />

      <main className="mx-auto max-w-5xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-gold">
            Dashboard
          </p>
          <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight text-white">
            Welcome back
          </h1>
        </div>

        {/* Quick stats */}
        <div className="mb-12 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-5 text-center">
              <p className="text-3xl font-bold text-gold">{userProjects.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5 text-center">
              <p className="text-3xl font-bold text-gold">{traceCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Traces</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5 text-center">
              <p className="text-3xl font-bold text-gold">{userMemberships.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Branches</p>
            </CardContent>
          </Card>
        </div>

        {/* Upload / Create project CTA */}
        <Card className="mb-12 border-gold/20 bg-gold/[0.03]">
          <CardContent className="flex flex-col items-center gap-4 py-10 sm:flex-row sm:justify-between sm:py-8">
            <div>
              <h2 className="font-serif text-xl font-bold">Share what you&apos;ve built</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a project, link your GitHub repo, and add the traces behind it.
              </p>
            </div>
            <NewProjectModal triggerClassName="shrink-0 rounded-full px-8" />
          </CardContent>
        </Card>

        {/* Projects section */}
        <section className="mb-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-2xl font-bold">Your Projects</h2>
            {userProjects.length > 0 && (
              <NewProjectModal triggerLabel="+ New" triggerVariant="link" triggerSize="sm" triggerClassName="text-gold h-auto p-0" />
            )}
          </div>

          {userProjects.length === 0 ? (
            <Card className="py-12 text-center">
              <CardContent className="flex flex-col items-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                  <svg className="h-6 w-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-sm font-medium">No projects yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first project to get started.
                </p>
                <NewProjectModal triggerLabel="Create Project" triggerClassName="mt-6 rounded-full" triggerSize="sm" />
              </CardContent>
            </Card>
          ) : (
            <DashboardProjects projects={userProjects} />
          )}
        </section>

        <Separator className="mb-12" />

        {/* Branches section */}
        <section>
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-serif text-2xl font-bold">Your Branches</h2>
            <NewBranchModal triggerLabel="+ Create" triggerVariant="link" triggerSize="sm" triggerClassName="text-gold h-auto p-0" />
          </div>

          {userMemberships.length === 0 ? (
            <Card className="py-12 text-center">
              <CardContent className="flex flex-col items-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
                  <svg className="h-6 w-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
                <p className="text-sm font-medium">No branches yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Join a branch or create your own community fork.
                </p>
                <NewBranchModal triggerLabel="Create a Branch" triggerClassName="mt-6 rounded-full" triggerVariant="outline" triggerSize="sm" />
              </CardContent>
            </Card>
          ) : (
            <div className="stagger-children grid gap-4 sm:grid-cols-2">
              {userMemberships.map((m) => (
                <Link key={m.id} href={`/branch/${m.branch.slug}`}>
                  <Card className="h-full transition-colors hover:border-gold/20">
                    <CardContent className="py-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-lg font-bold">{m.branch.name}</h3>
                        <Badge
                          className={
                            m.role === "admin"
                              ? "bg-gold/10 text-gold hover:bg-gold/20 text-xs"
                              : "text-xs"
                          }
                          variant={m.role === "admin" ? "default" : "secondary"}
                        >
                          {m.role}
                        </Badge>
                      </div>
                      {m.branch.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {m.branch.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
