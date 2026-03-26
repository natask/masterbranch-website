"use server";

import { db } from "@/lib/db";
import { projectCollaborators, projectInvites, users, projects } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-server";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

// ── Invite token ──────────────────────────────────────────────────────────────

export async function createInviteLink(projectId: string): Promise<string> {
  const session = await requireSession();

  // Only creator or existing collaborator can invite
  await assertCanEdit(projectId, session.user.id);

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(projectInvites).values({
    projectId,
    token,
    createdBy: session.user.id,
    expiresAt,
  });

  return token;
}

export async function acceptInvite(token: string): Promise<string> {
  const session = await requireSession();

  const invite = await db.query.projectInvites.findFirst({
    where: eq(projectInvites.token, token),
  });

  if (!invite) throw new Error("Invalid invite link");
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new Error("Invite link has expired");
  }

  await db
    .insert(projectCollaborators)
    .values({ projectId: invite.projectId, userId: session.user.id })
    .onConflictDoNothing();

  return invite.projectId;
}

// ── GitHub contributor auto-suggest ──────────────────────────────────────────

export async function fetchGithubContributors(
  githubUrl: string
): Promise<Array<{ login: string; avatarUrl: string; htmlUrl: string }>> {
  // Extract owner/repo from URL like https://github.com/owner/repo
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return [];

  const [, owner, repo] = match;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=30`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) return [];

  const data = (await res.json()) as Array<{
    login: string;
    avatar_url: string;
    html_url: string;
  }>;
  return data.map((c) => ({
    login: c.login,
    avatarUrl: c.avatar_url,
    htmlUrl: c.html_url,
  }));
}

export async function addCollaboratorByUserId(
  projectId: string,
  userId: string
) {
  const session = await requireSession();
  await assertCanEdit(projectId, session.user.id);

  await db
    .insert(projectCollaborators)
    .values({ projectId, userId })
    .onConflictDoNothing();
}

export async function removeCollaborator(projectId: string, userId: string) {
  const session = await requireSession();
  await assertCanEdit(projectId, session.user.id);

  await db
    .delete(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.projectId, projectId),
        eq(projectCollaborators.userId, userId)
      )
    );
}

export async function getCollaborators(projectId: string) {
  return db.query.projectCollaborators.findMany({
    where: eq(projectCollaborators.projectId, projectId),
    with: { user: true },
  });
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function assertCanEdit(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project) throw new Error("Project not found");
  if (project.createdBy === userId) return;

  const collab = await db.query.projectCollaborators.findFirst({
    where: and(
      eq(projectCollaborators.projectId, projectId),
      eq(projectCollaborators.userId, userId)
    ),
  });
  if (!collab) throw new Error("Not authorized");
}
