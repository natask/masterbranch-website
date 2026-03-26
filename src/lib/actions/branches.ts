"use server";

import { db } from "@/lib/db";
import { branches, memberships, users } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-server";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { sendApplicationApproved } from "@/lib/email";
import { slugify } from "@/lib/slug";

export async function createBranch(formData: FormData) {
  const session = await requireSession();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  if (!name?.trim()) {
    throw new Error("Name is required");
  }

  const slug = slugify(name);

  if (!slug) {
    throw new Error("Invalid name for branch");
  }

  // Create branch + admin membership in one go
  const [branch] = await db
    .insert(branches)
    .values({
      slug,
      name: name.trim(),
      description: description?.trim() || null,
      createdBy: session.user.id,
    })
    .returning();

  await db.insert(memberships).values({
    userId: session.user.id,
    branchId: branch.id,
    role: "admin",
    status: "approved",
  });

  redirect(`/dashboard`);
}

export async function applyToBranch(branchId: string, formData: FormData) {
  const session = await requireSession();

  const email = formData.get("email") as string;

  // Check not already a member
  const existing = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.branchId, branchId)
    ),
  });

  if (existing) {
    throw new Error("Already applied or member");
  }

  await db.insert(memberships).values({
    userId: session.user.id,
    branchId,
    role: "hacker",
    status: "pending",
  });

  redirect("?applied=true");
}

export async function updateMembershipStatus(
  membershipId: string,
  status: "approved" | "rejected"
) {
  const session = await requireSession();

  // Verify the caller is an admin of the branch
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.id, membershipId),
    with: { branch: true },
  });

  if (!membership) throw new Error("Membership not found");

  const callerMembership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.branchId, membership.branchId),
      eq(memberships.role, "admin")
    ),
  });

  if (!callerMembership) throw new Error("Not authorized");

  await db
    .update(memberships)
    .set({
      status,
      role: status === "approved" ? "member" : "hacker",
    })
    .where(eq(memberships.id, membershipId));

  // Send email on approval
  if (status === "approved") {
    const user = await db.query.users.findFirst({
      where: eq(users.id, membership.userId),
    });
    if (user?.email) {
      await sendApplicationApproved(user.email, membership.branch.name);
    }
  }
}

export async function updateBranchSettings(branchId: string, formData: FormData) {
  const session = await requireSession();

  // Verify admin
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.branchId, branchId),
      eq(memberships.role, "admin")
    ),
  });

  if (!membership) throw new Error("Not authorized");

  const lumaApiKey = formData.get("lumaApiKey") as string;
  const description = formData.get("description") as string;

  await db
    .update(branches)
    .set({
      description: description?.trim() || null,
      lumaApiKey: lumaApiKey?.trim() || null,
    })
    .where(eq(branches.id, branchId));
}
