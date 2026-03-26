"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PROJECT_IMAGE_W = 800;
const PROJECT_IMAGE_H = 400;

function resizeImageToTarget(file: File, w: number, h: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      const scale = Math.max(w / img.width, h / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas export failed")); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.88
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type });
}

import { saveDraft, publishProject, discardDraft } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";

type SaveStatus = "idle" | "saving" | "saved";

export type DraftSnapshot = {
  id: string | null;
  title: string;
  description: string;
  githubUrl: string;
  demoUrl: string;
  imageUrl: string;
};

type InitialDraft = {
  id: string;
  title: string;
  description: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
};

type ImageGenState = "idle" | "generating" | "picking";

export function UploadModal({
  onClose,
  initialDraft,
}: {
  onClose: (draft?: DraftSnapshot) => void;
  initialDraft?: InitialDraft | null;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(initialDraft?.id ?? null);
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [description, setDescription] = useState(initialDraft?.description ?? "");
  const [githubUrl, setGithubUrl] = useState(initialDraft?.githubUrl ?? "");
  const [demoUrl, setDemoUrl] = useState(initialDraft?.demoUrl ?? "");
  const [imageUrl, setImageUrl] = useState(initialDraft?.imageUrl ?? "");
  const [imageUploading, setImageUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image generation
  const [genState, setGenState] = useState<ImageGenState>("idle");
  const [genImages, setGenImages] = useState<string[]>([]);
  const [genChat, setGenChat] = useState("");
  const [genPrompt, setGenPrompt] = useState("");
  const [showGenChat, setShowGenChat] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialDraft) {
      setProjectId(initialDraft.id);
      setTitle(initialDraft.title);
      setDescription(initialDraft.description ?? "");
      setGithubUrl(initialDraft.githubUrl ?? "");
      setDemoUrl(initialDraft.demoUrl ?? "");
      setImageUrl(initialDraft.imageUrl ?? "");
    }
  }, [initialDraft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSave = useCallback(
    (fields: { title: string; description: string; githubUrl: string; demoUrl: string; imageUrl: string }, id: string | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          const result = await saveDraft({ id: id ?? undefined, ...fields });
          setProjectId(result.id);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("idle");
        }
      }, 800);
    },
    []
  );

  useEffect(() => {
    if (!isDirtyRef.current) return;
    triggerSave({ title, description, githubUrl, demoUrl, imageUrl }, projectId);
  }, [title, description, githubUrl, demoUrl, imageUrl, triggerSave, projectId]);

  function handleChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      isDirtyRef.current = true;
      setter(e.target.value);
    };
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
    const { url } = await res.json();
    return url;
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setError(null);
    try {
      const resized = await resizeImageToTarget(file, PROJECT_IMAGE_W, PROJECT_IMAGE_H);
      const url = await uploadFile(resized);
      setImageUrl(url);
      isDirtyRef.current = true;
      triggerSave({ title, description, githubUrl, demoUrl, imageUrl: url }, projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setImageUploading(false);
    }
  }

  async function generateImages(prompt: string, count = 1) {
    setGenState("generating");
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Generation failed");
      const { images } = await res.json() as { images: { dataUrl: string }[] };
      if (count === 1) {
        // Auto-apply single image
        await applyGeneratedImage(images[0].dataUrl);
      } else {
        setGenImages(images.map((i) => i.dataUrl));
        setGenState("picking");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
      setGenState("idle");
    }
  }

  async function applyGeneratedImage(dataUrl: string) {
    setImageUploading(true);
    try {
      const file = await dataUrlToFile(dataUrl, "generated.jpg");
      const resized = await resizeImageToTarget(file, PROJECT_IMAGE_W, PROJECT_IMAGE_H);
      const url = await uploadFile(resized);
      setImageUrl(url);
      isDirtyRef.current = true;
      triggerSave({ title, description, githubUrl, demoUrl, imageUrl: url }, projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply image");
    } finally {
      setImageUploading(false);
      setGenState("idle");
      setGenImages([]);
      setShowGenChat(false);
    }
  }

  function buildPrompt() {
    const base = genChat.trim() || [title, description].filter(Boolean).join(". ");
    return base || "A creative tech project";
  }

  async function handlePublish() {
    if (!title.trim()) { setError("Title is required"); return; }
    setPublishing(true);
    setError(null);
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const { id } = projectId
        ? { id: projectId }
        : await saveDraft({ title, description, githubUrl, demoUrl, imageUrl });
      await publishProject(id);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPublishing(false);
    }
  }

  function handleClose() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isDirtyRef.current && (title || description || githubUrl)) {
      saveDraft({ id: projectId ?? undefined, title, description, githubUrl, demoUrl, imageUrl }).catch(() => {});
    }
    onClose({ id: projectId, title, description, githubUrl, demoUrl, imageUrl });
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (projectId) await discardDraft(projectId);
    } catch { /* Non-fatal */ }
    onClose();
  }

  const hasDraft = projectId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={handleClose} className="absolute top-4 right-4 z-10 text-muted-foreground transition-colors hover:text-foreground" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="mb-6 pr-8">
          <h2 className="font-serif text-2xl font-bold">Upload Project</h2>
          {hasDraft && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Draft
            </span>
          )}
        </div>

        <div className="space-y-5">
          {/* Image upload / generation */}
          <div className="space-y-2">
            <Label>Image</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageUploading || genState === "generating"}
              className="relative flex aspect-[2/1] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-secondary/40 transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed"
            >
              {imageUrl ? (
                <img src={imageUrl} alt="Project" className="h-full w-full object-cover" />
              ) : genState === "generating" ? (
                <span className="text-sm text-muted-foreground">Generating…</span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {imageUploading ? "Uploading…" : "Click to upload image"}
                </span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

            {/* AI generation controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => generateImages(buildPrompt(), 1)}
                disabled={genState === "generating" || imageUploading}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                ✦ Generate image
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button
                type="button"
                onClick={() => generateImages(buildPrompt(), 5)}
                disabled={genState === "generating" || imageUploading}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                5 options
              </button>
              <span className="text-muted-foreground/30">·</span>
              <button
                type="button"
                onClick={() => setShowGenChat((v) => !v)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {showGenChat ? "Hide chat" : "Chat to refine"}
              </button>
            </div>

            {/* 5-option picker */}
            {genState === "picking" && genImages.length > 0 && (
              <div className="grid grid-cols-5 gap-1.5">
                {genImages.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyGeneratedImage(src)}
                    className="overflow-hidden rounded border border-white/10 transition-opacity hover:opacity-80"
                  >
                    <img src={src} alt={`Option ${i + 1}`} className="aspect-[2/1] w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Prompt chat */}
            {showGenChat && (
              <div className="flex gap-2">
                <Input
                  value={genChat}
                  onChange={(e) => setGenChat(e.target.value)}
                  placeholder="Describe the image you want…"
                  className="text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") generateImages(genChat || buildPrompt(), 1);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={genState === "generating"}
                  onClick={() => generateImages(genChat || buildPrompt(), 1)}
                >
                  Go
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="modal-title">Title</Label>
            <Input
              id="modal-title"
              value={title}
              onChange={handleChange(setTitle)}
              placeholder="My project"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-desc">Description</Label>
            <Textarea
              id="modal-desc"
              value={description}
              onChange={handleChange(setDescription)}
              placeholder="What does it do?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-github">GitHub URL</Label>
            <Input
              id="modal-github"
              value={githubUrl}
              onChange={handleChange(setGithubUrl)}
              placeholder="https://github.com/…"
              type="url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-demo">Demo URL</Label>
            <Input
              id="modal-demo"
              value={demoUrl}
              onChange={handleChange(setDemoUrl)}
              placeholder="https://…"
              type="url"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && "Saved"}
            </span>
            <div className="flex items-center gap-3">
              {hasDraft && (
                <button
                  onClick={handleDiscard}
                  disabled={discarding}
                  className="text-sm text-muted-foreground/60 transition-colors hover:text-destructive"
                >
                  {discarding ? "Discarding…" : "Discard"}
                </button>
              )}
              <button
                onClick={handleClose}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Save as draft
              </button>
              <Button
                onClick={handlePublish}
                disabled={publishing}
                className="shimmer-pill border-beam rounded-full px-6"
              >
                {publishing ? "Publishing…" : "Publish"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
