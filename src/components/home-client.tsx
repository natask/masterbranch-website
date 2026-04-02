"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { HeroSection } from "@/components/hero-section";
import { ProjectGrid, type Project } from "@/components/project-grid";
import { UploadModal, type DraftSnapshot } from "@/components/upload-modal";
import { getLatestDraft } from "@/lib/actions/projects";

type InitialDraft = {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
};

export function HomeClient({ initialProjects }: { initialProjects: Project[] }) {
  const [showUpload, setShowUpload] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<InitialDraft | null>(null);

  // On mount, recover any existing draft from the DB
  useEffect(() => {
    getLatestDraft().then((draft) => {
      if (draft) setPendingDraft(draft);
    }).catch(() => {});
  }, []);

  function handleModalClose(draft?: DraftSnapshot) {
    setShowUpload(false);
    if (draft?.id) {
      setPendingDraft({
        id: draft.id,
        title: draft.title,
        description: draft.description || null,
        githubUrl: draft.githubUrl || null,
        demoUrl: draft.demoUrl || null,
        imageUrl: draft.imageUrl || null,
      });
    } else {
      // Published or discarded — clear pending draft
      setPendingDraft(null);
    }
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <HeroSection onUpload={() => setShowUpload(true)} />
      {showUpload && (
        <UploadModal onClose={handleModalClose} initialDraft={pendingDraft} />
      )}
      <ProjectGrid initialProjects={initialProjects} />
    </div>
  );
}
