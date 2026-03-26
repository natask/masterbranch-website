"use client";

import { useState, useTransition } from "react";
import { deleteProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1">
      <span className="text-xs text-destructive">
        Delete project and all traces?
      </span>
      <button
        className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Cancel
      </button>
      <button
        className="text-xs font-medium text-destructive transition-opacity hover:opacity-80 disabled:opacity-50"
        disabled={pending}
        onClick={() =>
          startTransition(() => deleteProject(projectId))
        }
      >
        {pending ? "Deleting…" : "Confirm"}
      </button>
    </div>
  );
}
