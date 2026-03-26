"use server";

import { db } from "@/lib/db";
import { events, branches, memberships } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth-server";
import { eq, and } from "drizzle-orm";
import * as luma from "@/lib/luma/client";

async function requireBranchAdmin(branchId: string) {
  const session = await requireSession();
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, session.user.id),
      eq(memberships.branchId, branchId),
      eq(memberships.role, "admin")
    ),
  });
  if (!membership) throw new Error("Not authorized");
  return session;
}

export async function syncLumaEvents(branchId: string) {
  await requireBranchAdmin(branchId);

  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, branchId),
  });

  if (!branch?.lumaApiKey) throw new Error("No Luma API key configured");

  const lumaEvents = await luma.listEvents(branch.lumaApiKey);

  for (const evt of lumaEvents) {
    // Upsert: check if already synced
    const existing = await db.query.events.findFirst({
      where: and(
        eq(events.branchId, branchId),
        eq(events.lumaEventId, evt.api_id)
      ),
    });

    if (existing) {
      await db
        .update(events)
        .set({
          title: evt.name,
          description: evt.description || null,
          startsAt: evt.start_at ? new Date(evt.start_at) : null,
          endsAt: evt.end_at ? new Date(evt.end_at) : null,
          lumaUrl: evt.url || null,
        })
        .where(eq(events.id, existing.id));
    } else {
      await db.insert(events).values({
        branchId,
        lumaEventId: evt.api_id,
        title: evt.name,
        description: evt.description || null,
        startsAt: evt.start_at ? new Date(evt.start_at) : null,
        endsAt: evt.end_at ? new Date(evt.end_at) : null,
        lumaUrl: evt.url || null,
      });
    }
  }
}

export async function getLumaGuests(branchId: string, eventId: string) {
  await requireBranchAdmin(branchId);

  const branch = await db.query.branches.findFirst({
    where: eq(branches.id, branchId),
  });

  if (!branch?.lumaApiKey) throw new Error("No Luma API key configured");

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event?.lumaEventId) throw new Error("Event not linked to Luma");

  return luma.getEventGuests(branch.lumaApiKey, event.lumaEventId);
}
