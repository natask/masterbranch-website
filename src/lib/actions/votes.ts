"use server";

import { db } from "@/lib/db";
import { projectVotes } from "@/lib/db/schema";
import { getSession } from "@/lib/auth-server";
import { eq, and, count } from "drizzle-orm";

export async function castVote(
  projectId: string,
  fingerprint: string,
  voteType: "up" | "down"
) {
  const session = await getSession();
  const userId = session?.user.id ?? null;

  await db
    .insert(projectVotes)
    .values({ projectId, fingerprint, userId, voteType })
    .onConflictDoUpdate({
      target: [projectVotes.projectId, projectVotes.fingerprint],
      set: { voteType, userId },
    });
}

export async function removeVote(projectId: string, fingerprint: string) {
  await db
    .delete(projectVotes)
    .where(
      and(
        eq(projectVotes.projectId, projectId),
        eq(projectVotes.fingerprint, fingerprint)
      )
    );
}

export async function getVoteCounts(
  projectId: string
): Promise<{ up: number; down: number; myVote: "up" | "down" | null }> {
  const rows = await db
    .select({ voteType: projectVotes.voteType, ct: count() })
    .from(projectVotes)
    .where(eq(projectVotes.projectId, projectId))
    .groupBy(projectVotes.voteType);

  const up = Number(rows.find((r) => r.voteType === "up")?.ct ?? 0);
  const down = Number(rows.find((r) => r.voteType === "down")?.ct ?? 0);
  return { up, down, myVote: null };
}
