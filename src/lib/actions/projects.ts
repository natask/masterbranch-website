"use server";

import { db } from "@/lib/db";
import { projects, traces, projectBranches, projectVotes } from "@/lib/db/schema";
import { getSession, requireSession } from "@/lib/auth-server";
import { eq, ilike, or, and, count, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { capitalizeFirst } from "./capitalize";

export async function createProject(formData: FormData) {
  const session = await requireSession();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const githubUrl = formData.get("githubUrl") as string;
  const demoUrl = formData.get("demoUrl") as string;

  if (!title?.trim()) {
    throw new Error("Title is required");
  }

  const [project] = await db
    .insert(projects)
    .values({
      title: capitalizeFirst(title) || title.trim(),
      description: capitalizeFirst(description),
      githubUrl: githubUrl?.trim() || null,
      demoUrl: demoUrl?.trim() || null,
      createdBy: session.user.id,
    })
    .returning();

  redirect(`/projects/${project.id}`);
}

export async function updateProject(id: string, formData: FormData) {
  const session = await requireSession();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const githubUrl = formData.get("githubUrl") as string;
  const tracesPublic = formData.get("tracesPublic") === "on";

  if (!title?.trim()) {
    throw new Error("Title is required");
  }

  // Only creator can edit (for now)
  const existing = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!existing || existing.createdBy !== session.user.id) {
    throw new Error("Not authorized to edit this project");
  }

  await db
    .update(projects)
    .set({
      title: capitalizeFirst(title) || title.trim(),
      description: capitalizeFirst(description),
      githubUrl: githubUrl?.trim() || null,
      tracesPublic,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id));

  redirect(`/projects/${id}`);
}

export async function saveDraft(data: {
  id?: string;
  title?: string;
  description?: string;
  githubUrl?: string;
  demoUrl?: string;
  imageUrl?: string;
}) {
  const session = await requireSession();

  if (data.id) {
    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, data.id),
    });
    if (!existing || existing.createdBy !== session.user.id) {
      throw new Error("Not authorized");
    }
    await db
      .update(projects)
      .set({
        title: capitalizeFirst(data.title) || existing.title,
        description: capitalizeFirst(data.description),
        githubUrl: data.githubUrl?.trim() || null,
        demoUrl: data.demoUrl?.trim() || null,
        imageUrl: data.imageUrl?.trim() || existing.imageUrl,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, data.id));
    return { id: data.id };
  }

  const [project] = await db
    .insert(projects)
    .values({
      title: capitalizeFirst(data.title) || "Untitled",
      description: capitalizeFirst(data.description),
      githubUrl: data.githubUrl?.trim() || null,
      demoUrl: data.demoUrl?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      published: false,
      createdBy: session.user.id,
    })
    .returning({ id: projects.id });

  return { id: project.id };
}

export async function publishProject(id: string) {
  const session = await requireSession();

  const existing = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!existing || existing.createdBy !== session.user.id) {
    throw new Error("Not authorized");
  }
  if (!existing.title?.trim()) {
    throw new Error("Title is required to publish");
  }

  await db
    .update(projects)
    .set({ published: true, updatedAt: new Date() })
    .where(eq(projects.id, id));

  return { id };
}

export async function deleteProject(id: string) {
  const session = await requireSession();

  const existing = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });
  if (!existing || existing.createdBy !== session.user.id) {
    throw new Error("Not authorized");
  }

  // Delete R2 image if present
  if (existing.imageUrl) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const bucket = env.IMAGES_BUCKET;
      if (bucket) {
        const key = new URL(existing.imageUrl).pathname.slice(1);
        await bucket.delete(key);
      }
    } catch {
      // Non-fatal — proceed with DB deletion even if R2 delete fails
    }
  }

  // Delete related rows then the project
  await db.delete(traces).where(eq(traces.projectId, id));
  await db.delete(projectBranches).where(eq(projectBranches.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));

  redirect("/");
}

export async function getLatestDraft() {
  const session = await getSession();
  if (!session) return null;
  return db.query.projects.findFirst({
    where: and(
      eq(projects.createdBy, session.user.id),
      eq(projects.published, false)
    ),
    orderBy: (projects, { desc }) => [desc(projects.updatedAt)],
  }).then(r => r ?? null);
}

export async function discardDraft(id: string) {
  const session = await requireSession();

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.createdBy, session.user.id)),
  });
  if (!existing) throw new Error("Not found");
  if (existing.published) throw new Error("Cannot discard a published project");

  if (existing.imageUrl) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const bucket = env.IMAGES_BUCKET;
      if (bucket) {
        const key = new URL(existing.imageUrl).pathname.slice(1);
        await bucket.delete(key);
      }
    } catch {
      // Non-fatal
    }
  }

  await db.delete(traces).where(eq(traces.projectId, id));
  await db.delete(projectBranches).where(eq(projectBranches.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));
}

export async function searchProjects(query: string) {
  const baseWhere = query?.trim()
    ? and(
        eq(projects.published, true),
        or(
          ilike(projects.title, `%${query.trim()}%`),
          ilike(projects.description, `%${query.trim()}%`)
        )
      )
    : eq(projects.published, true);

  const rows = await db.query.projects.findMany({
    with: { creator: true },
    where: baseWhere,
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    limit: 50,
  });

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const voteCounts = await db
    .select({
      projectId: projectVotes.projectId,
      voteType: projectVotes.voteType,
      ct: count(),
    })
    .from(projectVotes)
    .where(inArray(projectVotes.projectId, ids))
    .groupBy(projectVotes.projectId, projectVotes.voteType);

  // Build a map: projectId -> { up, down }
  const voteMap = new Map<string, { up: number; down: number }>();
  for (const row of voteCounts) {
    const entry = voteMap.get(row.projectId) ?? { up: 0, down: 0 };
    if (row.voteType === "up") entry.up = Number(row.ct);
    else entry.down = Number(row.ct);
    voteMap.set(row.projectId, entry);
  }

  return rows.map((r) => ({
    ...r,
    upvotes: voteMap.get(r.id)?.up ?? 0,
    downvotes: voteMap.get(r.id)?.down ?? 0,
  }));
}
