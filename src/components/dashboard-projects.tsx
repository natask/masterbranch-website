"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UploadModal } from "@/components/upload-modal";
import { ProjectDetailModal, type ProjectForModal } from "@/components/project-detail-modal";

export type DashboardProject = {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  tracesPublic: boolean;
  published: boolean;
};

export function DashboardProjects({ projects }: { projects: DashboardProject[] }) {
  const router = useRouter();
  const [editingDraft, setEditingDraft] = useState<DashboardProject | null>(null);
  const [viewingProject, setViewingProject] = useState<ProjectForModal | null>(null);

  const drafts = projects.filter((p) => !p.published);
  const published = projects.filter((p) => p.published);

  function handleModalClose() {
    setEditingDraft(null);
    router.refresh();
  }

  return (
    <>
      {/* Drafts section */}
      {drafts.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Drafts
          </h3>
          <div className="space-y-2">
            {drafts.map((project) => (
              <button
                key={project.id}
                className="w-full text-left"
                onClick={() => setEditingDraft(project)}
              >
                <Card className="transition-colors hover:border-amber-400/30">
                  <CardContent className="flex items-start justify-between gap-4 py-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{project.title || "Untitled"}</h3>
                        <Badge
                          variant="outline"
                          className="border-amber-400/40 text-amber-400 text-[10px] px-1.5 py-0"
                        >
                          Draft
                        </Badge>
                      </div>
                      {project.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground/50 pt-0.5">
                      Edit →
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Published section */}
      {published.length > 0 && (
        <div>
          {drafts.length > 0 && (
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Published
            </h3>
          )}
          <div className="space-y-2">
            {published.map((project) => (
              <button
                key={project.id}
                className="w-full text-left"
                onClick={() => setViewingProject(project)}
              >
                <Card className="transition-colors hover:border-gold/20">
                  <CardContent className="flex items-start justify-between gap-4 py-5">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{project.title}</h3>
                      {project.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {project.tracesPublic && (
                        <Badge className="bg-gold/10 text-gold hover:bg-gold/20 text-xs">
                          Public Traces
                        </Badge>
                      )}
                      {project.githubUrl && (
                        <Badge variant="outline" className="text-xs">GitHub</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Draft edit modal */}
      {editingDraft && (
        <UploadModal
          initialDraft={editingDraft}
          onClose={handleModalClose}
        />
      )}

      {/* Published project detail modal */}
      {viewingProject && (
        <ProjectDetailModal
          project={viewingProject}
          onClose={() => setViewingProject(null)}
        />
      )}
    </>
  );
}
