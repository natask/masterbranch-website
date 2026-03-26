"use client";

import { updateMembershipStatus } from "@/lib/actions/branches";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MemberActions({ membershipId }: { membershipId: string }) {
  const router = useRouter();

  async function handleAction(status: "approved" | "rejected") {
    await updateMembershipStatus(membershipId, status);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => handleAction("approved")}
        size="xs"
        className="rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
      >
        Approve
      </Button>
      <Button
        onClick={() => handleAction("rejected")}
        size="xs"
        variant="ghost"
        className="rounded-full text-red-400 hover:bg-red-500/10 hover:text-red-400"
      >
        Reject
      </Button>
    </div>
  );
}
