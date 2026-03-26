import { auth } from "./auth";
import { db } from "./db";
import { users } from "./db/schema";

export async function getSession() {
  try {
    const { data: session } = await auth.getSession();
    return session;
  } catch {
    // During build/prerender, auth isn't available
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Upsert the user row so FK constraints on projects.createdBy are satisfied.
  // Neon Auth manages identity; we mirror the essentials here.
  await db
    .insert(users)
    .values({
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      avatarUrl: session.user.image ?? null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        avatarUrl: session.user.image ?? null,
      },
    });

  return session;
}
