# Master Branch Website — Implementation Spec

> This document is the single source of truth for what needs to be built.
> A fresh Claude session should be able to read this + the codebase and execute everything.

---

## Current State

- **Framework**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Database**: PostgreSQL (Neon serverless) via Drizzle ORM — **tables not yet created**
- **Auth**: Neon Auth (GitHub OAuth) — **needs to switch to Twitter/X**
- **Deployment**: Cloudflare Workers via OpenNext
- **UI**: shadcn/ui components (Radix UI)

Key files:
- Schema: `src/lib/db/schema.ts`
- DB connection: `src/lib/db/index.ts`
- Auth: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/auth-server.ts`
- Nav: `src/components/nav.tsx`
- Homepage: `src/app/page.tsx`
- Server actions: `src/lib/actions/projects.ts`, `branches.ts`, `traces.ts`, `events.ts`
- CSS: `src/app/globals.css`

---

## Task 1: Schema Overhaul

Edit `src/lib/db/schema.ts`. The database has NOT been created yet so we can change anything freely.

### 1a. Users — replace GitHub with Twitter/X

Change:
```ts
// FROM:
githubId: text("github_id").notNull().unique(),
githubUsername: text("github_username").notNull(),

// TO:
twitterId: text("twitter_id").notNull().unique(),
twitterUsername: text("twitter_username").notNull(),
```

### 1b. Projects — add tags, tech stack, demo URL

Add these columns to the `projects` table:
```ts
tags: text("tags").array().default([]),
techStack: text("tech_stack").array().default([]),
demoUrl: text("demo_url"),
```

### 1c. project_branches — add composite primary key

Currently has no primary key. Fix:
```ts
import { primaryKey } from "drizzle-orm/pg-core";

export const projectBranches = pgTable("project_branches", {
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
}, (table) => [
  primaryKey({ columns: [table.projectId, table.branchId] }),
]);
```

### 1d. New table: `stars` (likes/bookmarks on projects)

```ts
export const stars = pgTable("stars", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique().on(table.userId, table.projectId),
]);
```

Import `unique` from `drizzle-orm/pg-core`.

### 1e. New table: `comments`

```ts
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  projectId: uuid("project_id")
    .references(() => projects.id),
  traceId: uuid("trace_id")
    .references(() => traces.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

A comment belongs to either a project OR a trace (one must be non-null). Enforced at application level.

### 1f. Events — add location

Add to `events` table:
```ts
location: text("location"),
```

### 1g. Update all relations

Add relations for the new tables:

```ts
// Update usersRelations — add:
stars: many(stars),
comments: many(comments),

// Update projectsRelations — add:
stars: many(stars),
comments: many(comments),

// Update tracesRelations — add:
comments: many(comments),

// New:
export const starsRelations = relations(stars, ({ one }) => ({
  user: one(users, {
    fields: [stars.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [stars.projectId],
    references: [projects.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [comments.projectId],
    references: [projects.id],
  }),
  trace: one(traces, {
    fields: [comments.traceId],
    references: [traces.id],
  }),
}));
```

---

## Task 2: Auth — Switch to Twitter/X Only

### 2a. Check Neon Auth Twitter support

Neon Auth (`@neondatabase/auth`) wraps Better Auth. Check if it supports Twitter/X as a social provider. If it does:
- Update `src/lib/auth.ts` to configure Twitter provider
- If Neon Auth does NOT support Twitter, replace with Better Auth directly (`better-auth` package)

### 2b. Update auth client

In `src/lib/auth-client.ts`, change:
```ts
// FROM:
signIn.social({ provider: "github", callbackURL: "/" })

// TO:
signIn.social({ provider: "twitter", callbackURL: "/" })
```

### 2c. Update login page

`src/app/login/page.tsx` — change button text from "Sign in with GitHub" to "Sign in with X"

### 2d. Environment variables

Update `.env.example`:
```
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
```

### 2e. Update all GitHub username references across the codebase

Every file that references `githubUsername` or `githubId` must change to `twitterUsername`/`twitterId`. Key files:
- `src/components/nav.tsx` — user display
- `src/app/page.tsx` — project creator display (`creator.githubUsername`)
- `src/app/dashboard/page.tsx`
- `src/app/projects/[id]/page.tsx`
- `src/app/projects/[id]/traces/page.tsx`
- `src/app/branch/[slug]/page.tsx`
- `src/app/branch/[slug]/admin/page.tsx`

---

## Task 3: Nav Dropdown Menu

### 3a. Install shadcn dropdown-menu

Run: `npx shadcn@latest add dropdown-menu`

This creates `src/components/ui/dropdown-menu.tsx`.

### 3b. Rewrite Nav component

File: `src/components/nav.tsx`

**Signed out state:**
```
[Logo] The Master Branch          [About]  [Sign in]
```

**Signed in state:**
```
[Logo] The Master Branch    [About]  [+ Share Project]  [Avatar ▾]
                                                          ┌──────────────┐
                                                          │ name/email   │
                                                          │ ──────────── │
                                                          │ Dashboard    │
                                                          │ Create Branch│
                                                          │ ──────────── │
                                                          │ Sign out     │
                                                          └──────────────┘
```

Use the `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator` components from shadcn.

Avatar trigger: show user avatar image (or fallback initial) — clickable to open dropdown.

Remove: the old "Create Branch" top-level link, the plain username text, the separate "Sign out" button.

---

## Task 4: Simplify Homepage

File: `src/app/page.tsx`

### What to KEEP:
- Hero section: "The Master Branch" title + tagline
- CTAs: "Get Started" (if signed out) / "Share a Project" (if signed in) + "About" link (replaces "Create a Branch")
- "Explore Projects" search + project card grid

### What to REMOVE:
- The entire bento grid section (Build, Traces, Branch, Events, Community cards — lines ~82-153)
- The `<Separator />` between bento and projects

### Update project cards to show tags
Project cards currently show title, description, creator. Add tags display if the project has them.

---

## Task 5: About Page

Create new file: `src/app/about/page.tsx`

This is a content page with the club's manifesto. Use the existing Nav component and the dark/gold design system.

Content sections (drawn from `well_argued_description.md` and `4__on_your_mind/partiful.txt`):

### Section 1: Hero
> "SF's Premier Hacker Club"
> A hacking club where you practice and learn best practices commanding the latest LLM models by building projects alongside peers.

### Section 2: Hack vs. Hackathon
> This is a hacking group, not a hackathon.
> - Hackathons: tight timelines, pre-formed teams, sponsor prizes, half-finished prototypes
> - Master Branch: We play the long game. We compete against our past selves.
> - We command, we master our agents to bring our ideas to fruition.
> - Cooperation isn't the opposite of competition, it's how you win.
> - The metric isn't applause, it's adoption.
> - No BS. Only the facts on what was built and how.

### Section 3: How It Works
> Weekly Sundai sessions: 1 PM - 5 PM (4 hours of rapid prototyping)
> 1. Ideation (First Hour) — throw around ideas, form teams (max 3)
> 2. Building (Core Hours) — ship don't polish, use AI to collapse timelines
> 3. Deep Focus (Final Hour) — locked in, no distractions
> 4. Demo (On the Dot) — real deploys, show prompts, share best practices

### Section 4: What We Build
> Software projects using the latest AI tools. Period.
> - Master AI Tools: explore, share, understand the latest
> - Share the Traces: prompts, .cursor files, engineering decisions
> - Grow Together: meet top-tier engineers, level up collectively

### Section 5: The Details
> - Weekly Hacking. Every Sunday.
> - Retreats Every 8 Weeks.
> - Self-Funded. Laptop + ideas + energy.

### Section 6: Who Should Join
> You should join if you:
> - Love building for the sake of building
> - Want to push AI tools to their limits
> - Value speed over perfection
>
> It's for people who would build even if no one was watching.

### Section 7: CTA
> "Just hackers, AI tools, and the pure thrill of building something real."
> [Get Started] button

Style: Use serif font for headings, gold accents for emphasis, clean whitespace-heavy layout.

---

## Task 6: CSS Cleanup

File: `src/app/globals.css`

Remove the unused bento grid styles (lines ~154-188):
- `.bento-grid`
- `.bento-cell`
- `.bento-cell:hover`
- `.bento-cell-wide`
- Related media queries

---

## Task 7: Update Server Actions

### `src/lib/actions/projects.ts`

- `createProject`: accept `tags`, `techStack`, `demoUrl` from form data
- `updateProject`: accept `tags`, `techStack`, `demoUrl`
- `searchProjects`: include tags in search (search tags array)

### New actions needed (can be in new files or existing):

- `toggleStar(projectId)` — star/unstar a project
- `getStarCount(projectId)` — return count
- `addComment(projectId | traceId, content)` — add comment
- `getComments(projectId | traceId)` — list comments with user info

---

## Task 8: Push Database Schema

After all schema changes are done:

```bash
npx drizzle-kit push
# or for migrations:
npx drizzle-kit generate && npx drizzle-kit migrate
```

---

## Execution Order

1. Schema overhaul (Task 1) — everything depends on this
2. Auth switch (Task 2) — changes user model references
3. Install dropdown-menu (Task 3a)
4. Nav rewrite (Task 3b)
5. Simplify homepage (Task 4)
6. About page (Task 5)
7. CSS cleanup (Task 6)
8. Server actions update (Task 7)
9. Push database (Task 8)
10. Verify with `npm run dev`

---

## Summary of New/Modified Files

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Schema overhaul — Twitter fields, tags, stars, comments, location, PK fix |
| `src/lib/auth.ts` | Twitter provider config |
| `src/lib/auth-client.ts` | Twitter sign-in |
| `src/app/login/page.tsx` | "Sign in with X" |
| `.env.example` | Twitter OAuth vars |
| `src/components/ui/dropdown-menu.tsx` | NEW — shadcn component |
| `src/components/nav.tsx` | Dropdown menu, restructured layout |
| `src/app/page.tsx` | Simplified — no bento, just hero + projects |
| `src/app/about/page.tsx` | NEW — manifesto/about page |
| `src/app/globals.css` | Remove bento styles |
| `src/lib/actions/projects.ts` | Tags, tech stack, demo URL support |
| `src/lib/actions/stars.ts` | NEW — star/unstar actions |
| `src/lib/actions/comments.ts` | NEW — comment actions |
| `src/app/dashboard/page.tsx` | Twitter username refs |
| `src/app/projects/[id]/page.tsx` | Twitter username refs, stars, comments |
| `src/app/projects/[id]/traces/page.tsx` | Twitter username refs, comments |
| `src/app/branch/[slug]/page.tsx` | Twitter username refs |
| `src/app/branch/[slug]/admin/page.tsx` | Twitter username refs, event location |
| `src/app/projects/new/page.tsx` | Tags, tech stack, demo URL fields |
| `src/app/projects/[id]/edit/page.tsx` | Tags, tech stack, demo URL fields |
