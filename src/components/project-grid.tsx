"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchProjects } from "@/lib/actions/projects";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProjectCard } from "@/components/project-card";
import { VoteButtons } from "@/components/vote-buttons";
import { ProjectDetailModal } from "@/components/project-detail-modal";

export type Project = {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  tracesPublic: boolean;
  upvotes: number;
  downvotes: number;
  createdAt: Date;
  creator: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    githubUsername: string | null;
  };
};

export function ProjectGrid({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Project[]>(initialProjects);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("project")
  );

  // Sync selectedId → URL
  useEffect(() => {
    const current = searchParams.get("project");
    if (selectedId && selectedId !== current) {
      router.replace(`?project=${selectedId}`, { scroll: false });
    } else if (!selectedId && current) {
      router.replace("/", { scroll: false });
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync URL → selectedId on back/forward
  useEffect(() => {
    setSelectedId(searchParams.get("project"));
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      searchProjects(query)
        .then((r) => setResults(r as Project[]))
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectedProject = results.find((p) => p.id === selectedId) ?? null;

  const emptyMessage = error
    ? "Failed to load projects. Please try again."
    : query
    ? `No projects found for "${query}"`
    : "Search for projects or start building something new.";

  return (
    <section data-pretext="home-projects" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-10 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h2 data-pretext="home-projects-heading" className="font-serif text-3xl font-bold">Explore Projects</h2>
        <div className="relative w-full sm:w-72">
          {loading ? (
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
          <Input
            type="text"
            placeholder="Search projects..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 pl-10 text-sm placeholder:text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((project, i) => (
          <CardItem
            key={project.id}
            project={project}
            index={i}
            onOpen={() => setSelectedId(project.id)}
          />
        ))}
      </div>

      {results.length === 0 && !loading && (
        <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}

function CardItem({
  project,
  index,
  onOpen,
}: {
  project: Project;
  index: number;
  onOpen: () => void;
}) {
  const [showLinks, setShowLinks] = useState(false);
  const longPressRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => { timer = setTimeout(() => setShowLinks(true), 500); };
    const cancel = () => { clearTimeout(timer); setShowLinks(false); };
    node.addEventListener("touchstart", start);
    node.addEventListener("touchend", cancel);
    node.addEventListener("touchcancel", cancel);
    return () => {
      node.removeEventListener("touchstart", start);
      node.removeEventListener("touchend", cancel);
      node.removeEventListener("touchcancel", cancel);
    };
  }, []);

  return (
    <div
      className="group relative pb-10"
      onMouseEnter={() => setShowLinks(true)}
      onMouseLeave={() => setShowLinks(false)}
    >
      <button
        ref={longPressRef}
        className="block w-full text-left"
        onClick={onOpen}
      >
        <ProjectCard data-pretext="home-project-card" className="h-full overflow-hidden rounded-3xl border border-white/[0.07] bg-card">
          {/* Image area */}
          <div className="relative flex h-44 items-center justify-center overflow-hidden bg-secondary">
            {project.imageUrl ? (
              <img
                src={project.imageUrl}
                alt={project.title}
                loading={index < 6 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <img
                src="/icon.png"
                alt="Branch icon"
                className="h-16 w-16 opacity-20 select-none"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
            {project.tracesPublic && (
              <div className="absolute right-2.5 top-2.5">
                <Badge className="bg-gold/75 text-primary-foreground text-xs backdrop-blur-md">Traces</Badge>
              </div>
            )}
          </div>

          {/* Card body */}
          <div className="relative z-10 p-4">
            <h3 data-pretext="home-project-card-title" className="font-serif text-base font-semibold leading-snug line-clamp-1 text-white">
              {project.title}
            </h3>
            {project.description && (
              <p className="mt-1.5 text-sm text-white/60 line-clamp-2 leading-relaxed">
                {project.description}
              </p>
            )}

            {/* Footer: creator + votes */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-3">
              <div className="flex items-center gap-2">
                {project.creator?.avatarUrl ? (
                  <img
                    src={project.creator.avatarUrl}
                    alt={project.creator.name || (project.creator.githubUsername ?? undefined)}
                    loading="lazy"
                    className="h-5 w-5 rounded-full ring-1 ring-white/10"
                  />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gold/10 text-[10px] font-medium text-gold ring-1 ring-white/10">
                    {(project.creator?.name || project.creator?.githubUsername || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {project.creator?.name || project.creator?.githubUsername}
                </span>
              </div>

              <VoteButtons
                projectId={project.id}
                initialUp={project.upvotes}
                initialDown={project.downvotes}
              />
            </div>
          </div>
        </ProjectCard>
      </button>

      {/* Hover / long-press action links */}
      <div
        className={`absolute inset-x-0 bottom-0 flex justify-center gap-2 transition-opacity duration-200 ${
          showLinks ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <HoverLinks project={project} />
      </div>
    </div>
  );
}

function HoverLinks({ project }: { project: Project }) {
  return (
    <div
      className="flex gap-2"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => e.stopPropagation()}
    >
      {project.githubUrl && (
        <a
          href={project.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          GitHub
        </a>
      )}
      {project.demoUrl && (
        <a
          href={project.demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-full border border-white/10 bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Demo
        </a>
      )}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${project.title}" on The Master Branch`)}&url=${encodeURIComponent(`https://masterbranch.club/?project=${project.id}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 rounded-full border border-white/10 bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        Share
      </a>
    </div>
  );
}
