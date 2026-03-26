"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createInviteLink, getCollaborators, fetchGithubContributors } from "@/lib/actions/collaborators";
import { useQuery } from "@tanstack/react-query";
export type ProjectForModal = {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  tracesPublic?: boolean;
};

export function ProjectDetailModal({
  project,
  onClose,
  onEdit,
}: {
  project: ProjectForModal;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: collaborators } = useQuery({
    queryKey: ["collaborators", project.id],
    queryFn: () => getCollaborators(project.id),
    staleTime: 60_000,
  });

  async function handleGenerateInvite() {
    setInviteLoading(true);
    try {
      const token = await createInviteLink(project.id);
      const url = `${window.location.origin}/api/invites/${token}`;
      setInviteUrl(url);
    } catch {
      // Not a collaborator / not logged in — silently ignore
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {project.imageUrl ? (
          <div className="h-48 w-full overflow-hidden">
            <img src={project.imageUrl} alt={project.title} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-secondary">
            <img src="/icon.png" alt="Branch icon" className="h-16 w-16 opacity-20" />
          </div>
        )}

        <div className="p-8">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-serif text-2xl font-bold leading-snug text-white">{project.title}</h2>
            <button
              onClick={onClose}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {project.description && (
            <p className="mb-6 text-sm leading-relaxed text-white/60">{project.description}</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            {project.githubUrl && (
              <Button asChild variant="outline" size="sm" className="rounded-full gap-2">
                <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  GitHub
                </a>
              </Button>
            )}
            {project.demoUrl && (
              <Button asChild variant="outline" size="sm" className="rounded-full gap-2">
                <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Demo
                </a>
              </Button>
            )}
            {onEdit && (
              <Button variant="outline" size="sm" className="rounded-full" onClick={onEdit}>
                Edit
              </Button>
            )}
          </div>

          {/* Collaborators */}
          {(collaborators && collaborators.length > 0) && (
            <div className="mb-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Collaborators</p>
              <div className="flex flex-wrap gap-2">
                {collaborators.map((c) => (
                  <div key={c.userId} className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs">
                    {c.user.avatarUrl ? (
                      <img src={c.user.avatarUrl} alt={c.user.name ?? ""} className="h-4 w-4 rounded-full" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-gold/20 text-[9px] flex items-center justify-center text-gold">
                        {(c.user.name || c.user.githubUsername || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-muted-foreground">{c.user.name || c.user.githubUsername}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite link */}
          <div className="border-t border-white/[0.06] pt-4">
            {inviteUrl ? (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground font-mono"
                />
                <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-xs text-muted-foreground"
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
              >
                {inviteLoading ? "Generating…" : "+ Invite collaborator"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
