"use server";

import { db } from "@/lib/db";
import { traces, projects, projectBranches, memberships } from "@/lib/db/schema";
import { requireSession, getSession } from "@/lib/auth-server";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";

export async function addTrace(projectId: string, formData: FormData) {
  const session = await requireSession();

  const content = formData.get("content") as string;
  if (!content?.trim()) throw new Error("Content is required");

  // Verify the user is the project creator
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || project.createdBy !== session.user.id) {
    throw new Error("Not authorized");
  }

  await db.insert(traces).values({
    projectId,
    content: content.trim(),
    createdBy: session.user.id,
  });

  redirect(`/projects/${projectId}/traces`);
}

export async function getTracesForProject(projectId: string) {
  const session = await getSession();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: { traces: { with: { creator: true } } },
  });

  if (!project) return { project: null, traces: [], canView: false };

  // If traces are public, anyone can see them
  if (project.tracesPublic) {
    return { project, traces: project.traces, canView: true };
  }

  // If not logged in, no access
  if (!session) {
    return { project, traces: [], canView: false };
  }

  // If the user is the creator, they can always see
  if (project.createdBy === session.user.id) {
    return { project, traces: project.traces, canView: true };
  }

  // Check if the user is a member of any branch this project is in
  const pbs = await db.query.projectBranches.findMany({
    where: eq(projectBranches.projectId, projectId),
  });

  for (const pb of pbs) {
    const membership = await db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, session.user.id),
        eq(memberships.branchId, pb.branchId),
        eq(memberships.status, "approved")
      ),
    });
    if (membership && membership.role !== "hacker") {
      return { project, traces: project.traces, canView: true };
    }
  }

  return { project, traces: [], canView: false };
}
