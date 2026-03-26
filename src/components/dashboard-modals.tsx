"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createProject } from "@/lib/actions/projects";
import { createBranch } from "@/lib/actions/branches";

export function NewProjectModal({
  triggerLabel = "New Project",
  triggerClassName,
  triggerVariant,
  triggerSize,
}: {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "link";
  triggerSize?: "default" | "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={triggerClassName}
        variant={triggerVariant}
        size={triggerSize}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-bold">New Project</DialogTitle>
            <DialogDescription>Share what you&apos;ve been building.</DialogDescription>
          </DialogHeader>
          <form action={createProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="proj-title">Title</Label>
              <Input id="proj-title" name="title" type="text" required placeholder="My awesome project" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-description">Description</Label>
              <Textarea id="proj-description" name="description" rows={3} placeholder="What does it do?" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-githubUrl">GitHub URL</Label>
              <Input id="proj-githubUrl" name="githubUrl" type="url" placeholder="https://github.com/..." />
            </div>
            <Button type="submit" className="rounded-full px-8">Create Project</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NewBranchModal({
  triggerLabel = "Create a Branch",
  triggerClassName,
  triggerVariant,
  triggerSize,
}: {
  triggerLabel?: string;
  triggerClassName?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "link";
  triggerSize?: "default" | "sm" | "lg";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={triggerClassName}
        variant={triggerVariant}
        size={triggerSize}
      >
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <Badge className="mb-1 w-fit bg-gold/10 text-gold hover:bg-gold/20">Fork</Badge>
            <DialogTitle className="font-serif text-2xl font-bold">Create a Branch</DialogTitle>
            <DialogDescription>
              Fork the master branch. Your branch gets its own subdomain and community.
            </DialogDescription>
          </DialogHeader>
          <form action={createBranch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input id="branch-name" name="name" type="text" required placeholder="My Hacker Club" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-description">Description</Label>
              <Textarea id="branch-description" name="description" rows={3} placeholder="What is your branch about?" />
            </div>
            <Button type="submit" className="rounded-full px-8">Create Branch</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
