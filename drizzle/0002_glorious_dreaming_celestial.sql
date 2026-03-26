CREATE TYPE "public"."collaborator_role" AS ENUM('editor', 'admin');--> statement-breakpoint
ALTER TABLE "project_collaborators" ADD COLUMN "role" "collaborator_role" DEFAULT 'editor' NOT NULL;