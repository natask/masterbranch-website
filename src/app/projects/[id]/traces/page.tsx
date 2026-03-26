import { getTracesForProject, addTrace } from "@/lib/actions/traces";
import { getSession } from "@/lib/auth-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function TracesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const { project, traces, canView } = await getTracesForProject(id);

  if (!project) notFound();

  const isOwner = session?.user.id === project.createdBy;
  const addTraceWithId = addTrace.bind(null, id);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href={`/projects/${id}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Back to project</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight">{project.title} — Traces</h1>
          <div className="mt-3">
            {project.tracesPublic ? (
              <Badge className="bg-gold/10 text-gold hover:bg-gold/20">Public</Badge>
            ) : (
              <Badge variant="secondary">Branch-private</Badge>
            )}
          </div>
        </div>

        {!canView ? (
          <Card className="py-14 text-center">
            <CardContent className="flex flex-col items-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                <svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-sm font-medium">Traces are private</p>
              <p className="mt-1 text-sm text-muted-foreground">Join a branch this project belongs to as a member to view traces.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {traces.length === 0 ? (
              <Card className="py-14 text-center">
                <CardContent>
                  <p className="text-sm text-muted-foreground">No traces yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="stagger-children space-y-4">
                {traces.map((trace) => (
                  <Card key={trace.id}>
                    <CardContent className="py-5">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          by {trace.creator.name || trace.creator.githubUsername}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(trace.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-muted-foreground">
                        {trace.content}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {isOwner && (
              <div className="mt-12">
                <Separator className="mb-10" />
                <h2 className="font-serif text-xl font-bold">Add Trace</h2>
                <form action={addTraceWithId} className="mt-4 space-y-4">
                  <Textarea
                    name="content"
                    rows={8}
                    required
                    placeholder="Paste the conversation or instructions used to build this project..."
                    className="font-mono text-sm"
                  />
                  <Button type="submit" className="rounded-full px-8">Add Trace</Button>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
