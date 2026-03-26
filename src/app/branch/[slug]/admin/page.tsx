import { db } from "@/lib/db";
import { branches, memberships, events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { updateMembershipStatus, updateBranchSettings } from "@/lib/actions/branches";
import { syncLumaEvents } from "@/lib/actions/events";
import { MemberActions } from "./member-actions";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function BranchAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const branch = await db.query.branches.findFirst({
    where: eq(branches.slug, slug),
  });

  if (!branch) notFound();

  const adminMembership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.branchId, branch.id),
      eq(memberships.role, "admin")
    ),
  });

  if (!adminMembership) redirect(`/branch/${slug}`);

  const branchMemberships = await db.query.memberships.findMany({
    where: eq(memberships.branchId, branch.id),
    with: { user: true },
    orderBy: (memberships, { desc }) => [desc(memberships.createdAt)],
  });

  const pending = branchMemberships.filter((m) => m.status === "pending");
  const approved = branchMemberships.filter((m) => m.status === "approved");

  const updateSettingsWithId = updateBranchSettings.bind(null, branch.id);
  const syncEventsWithId = syncLumaEvents.bind(null, branch.id);

  const branchEvents = await db.query.events.findMany({
    where: eq(events.branchId, branch.id),
    orderBy: (events, { desc }) => [desc(events.startsAt)],
  });

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href={`/branch/${slug}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">Back to branch</Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <Badge variant="outline" className="mb-4 border-gold/30 text-gold">Admin</Badge>
        <h1 className="font-serif text-3xl font-bold tracking-tight">{branch.name}</h1>

        {/* Settings */}
        <Card className="mt-10">
          <CardHeader>
            <CardTitle className="font-serif">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateSettingsWithId} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} defaultValue={branch.description || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lumaApiKey">Luma API Key</Label>
                <Input id="lumaApiKey" name="lumaApiKey" type="password" defaultValue={branch.lumaApiKey || ""} placeholder="Enter your Luma API key" />
              </div>
              <Button type="submit" className="rounded-full">Save Settings</Button>
            </form>
          </CardContent>
        </Card>

        <Separator className="my-10" />

        {/* Pending Applications */}
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-serif text-xl font-bold">Pending Applications</h2>
            {pending.length > 0 && (
              <Badge className="bg-gold/10 text-gold hover:bg-gold/20">{pending.length}</Badge>
            )}
          </div>
          {pending.length === 0 ? (
            <Card className="py-8 text-center">
              <CardContent><p className="text-sm text-muted-foreground">No pending applications.</p></CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pending.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium">{m.user.name || m.user.githubUsername}</p>
                      <p className="text-xs text-muted-foreground">{m.user.email}</p>
                    </div>
                    <MemberActions membershipId={m.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Members */}
        <section className="mb-10">
          <h2 className="mb-4 font-serif text-xl font-bold">
            Members <span className="text-sm font-normal text-muted-foreground">({approved.length})</span>
          </h2>
          {approved.length === 0 ? (
            <Card className="py-8 text-center">
              <CardContent><p className="text-sm text-muted-foreground">No members yet.</p></CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {approved.map((m) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-xs">
                        {(m.user.name || m.user.githubUsername || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{m.user.name || m.user.githubUsername}</p>
                      <Badge variant="secondary" className="text-xs">{m.role}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <Separator className="my-10" />

        {/* Events */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold">
              Events <span className="text-sm font-normal text-muted-foreground">({branchEvents.length})</span>
            </h2>
            {branch.lumaApiKey && (
              <form action={syncEventsWithId}>
                <Button type="submit" variant="outline" size="sm" className="rounded-full">Sync from Luma</Button>
              </form>
            )}
          </div>
          {!branch.lumaApiKey ? (
            <Card className="py-8 text-center">
              <CardContent><p className="text-sm text-muted-foreground">Add a Luma API key in Settings above to sync events.</p></CardContent>
            </Card>
          ) : branchEvents.length === 0 ? (
            <Card className="py-8 text-center">
              <CardContent><p className="text-sm text-muted-foreground">No events synced yet. Click &quot;Sync from Luma&quot; to pull events.</p></CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {branchEvents.map((event) => (
                <Card key={event.id}>
                  <CardContent className="py-4">
                    <h3 className="text-sm font-medium">{event.title}</h3>
                    {event.startsAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.startsAt).toLocaleDateString()} at{" "}
                        {new Date(event.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {event.lumaUrl && (
                      <a href={event.lumaUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-gold hover:text-gold-light">
                        View on Luma
                      </a>
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
