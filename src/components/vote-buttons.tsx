"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { castVote, removeVote, getVoteCounts } from "@/lib/actions/votes";
import { useFingerprint } from "@/hooks/use-fingerprint";

export function VoteButtons({
  projectId,
  initialUp,
  initialDown,
}: {
  projectId: string;
  initialUp: number;
  initialDown: number;
}) {
  const fingerprint = useFingerprint();
  const qc = useQueryClient();

  const storageKey = `mb_vote_${projectId}`;
  const getMyVote = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(storageKey) as "up" | "down" | null;
  };

  const { data } = useQuery({
    queryKey: ["votes", projectId],
    queryFn: () => getVoteCounts(projectId),
    initialData: { up: initialUp, down: initialDown, myVote: getMyVote() },
    staleTime: 30_000,
  });

  const up = data.up;
  const down = data.down;
  const myVote = data.myVote ?? getMyVote();

  const { mutate } = useMutation({
    mutationFn: async (type: "up" | "down" | null) => {
      if (!fingerprint) return;
      if (type === null) {
        await removeVote(projectId, fingerprint);
        localStorage.removeItem(storageKey);
      } else {
        await castVote(projectId, fingerprint, type);
        localStorage.setItem(storageKey, type);
      }
    },
    onMutate: async (type) => {
      await qc.cancelQueries({ queryKey: ["votes", projectId] });
      const prev = qc.getQueryData<{ up: number; down: number; myVote: "up" | "down" | null }>(["votes", projectId]);

      qc.setQueryData(["votes", projectId], (old: typeof prev) => {
        if (!old) return old;
        const next = { ...old };
        if (old.myVote === "up") next.up = Math.max(0, next.up - 1);
        if (old.myVote === "down") next.down = Math.max(0, next.down - 1);
        if (type === "up") next.up += 1;
        if (type === "down") next.down += 1;
        next.myVote = type;
        return next;
      });

      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["votes", projectId], ctx.prev);
    },
  });

  function handleVote(e: React.MouseEvent, type: "up" | "down") {
    e.preventDefault();
    e.stopPropagation();
    mutate(myVote === type ? null : type);
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => handleVote(e, "up")}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
          myVote === "up"
            ? "bg-gold/20 text-gold"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Upvote"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={myVote === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
        <span>{up}</span>
      </button>

      <button
        onClick={(e) => handleVote(e, "down")}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
          myVote === "down"
            ? "bg-destructive/20 text-destructive"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Downvote"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={myVote === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
        <span>{down}</span>
      </button>
    </div>
  );
}
