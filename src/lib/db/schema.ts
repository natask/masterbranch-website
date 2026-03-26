import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const tierEnum = pgEnum("tier", ["hacker", "member"]);
export const membershipRoleEnum = pgEnum("membership_role", [
  "admin",
  "member",
  "hacker",
]);
export const membershipStatusEnum = pgEnum("membership_status", [
  "pending",
  "approved",
  "rejected",
]);
export const voteTypeEnum = pgEnum("vote_type", ["up", "down"]);

// ── Users ──
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // Neon Auth user ID — not auto-generated
  githubId: text("github_id").unique(),
  githubUsername: text("github_username"),
  email: text("email"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  tier: tierEnum("tier").default("hacker").notNull(),
  isSuperAdmin: boolean("is_super_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Branches ──
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  lumaApiKey: text("luma_api_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Memberships ──
export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  role: membershipRoleEnum("role").default("hacker").notNull(),
  status: membershipStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Projects ──
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  githubUrl: text("github_url"),
  demoUrl: text("demo_url"),
  imageUrl: text("image_url"),
  tracesPublic: boolean("traces_public").default(false).notNull(),
  published: boolean("published").default(false).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  launchedAt: timestamp("launched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Project ↔ Branch junction ──
export const projectBranches = pgTable("project_branches", {
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
});

// ── Project Votes ──
export const projectVotes = pgTable(
  "project_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    voteType: voteTypeEnum("vote_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.projectId, t.fingerprint)]
);

// ── Project Collaborators ──
export const projectCollaborators = pgTable(
  "project_collaborators",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.projectId, t.userId)]
);

// ── Project Invite Tokens ──
export const projectInvites = pgTable("project_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Traces ──
export const traces = pgTable("traces", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  content: text("content").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Events ──
export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  lumaEventId: text("luma_event_id"),
  title: text("title").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  lumaUrl: text("luma_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Relations ──
export const usersRelations = relations(users, ({ many }) => ({
  branches: many(branches),
  memberships: many(memberships),
  projects: many(projects),
  traces: many(traces),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  creator: one(users, {
    fields: [branches.createdBy],
    references: [users.id],
  }),
  memberships: many(memberships),
  projectBranches: many(projectBranches),
  events: many(events),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  branch: one(branches, {
    fields: [memberships.branchId],
    references: [branches.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  projectBranches: many(projectBranches),
  traces: many(traces),
  votes: many(projectVotes),
  collaborators: many(projectCollaborators),
  invites: many(projectInvites),
}));

export const projectVotesRelations = relations(projectVotes, ({ one }) => ({
  project: one(projects, { fields: [projectVotes.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectVotes.userId], references: [users.id] }),
}));

export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({
  project: one(projects, { fields: [projectCollaborators.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectCollaborators.userId], references: [users.id] }),
}));

export const projectInvitesRelations = relations(projectInvites, ({ one }) => ({
  project: one(projects, { fields: [projectInvites.projectId], references: [projects.id] }),
  createdBy: one(users, { fields: [projectInvites.createdBy], references: [users.id] }),
}));

export const projectBranchesRelations = relations(
  projectBranches,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectBranches.projectId],
      references: [projects.id],
    }),
    branch: one(branches, {
      fields: [projectBranches.branchId],
      references: [branches.id],
    }),
  })
);

export const tracesRelations = relations(traces, ({ one }) => ({
  project: one(projects, {
    fields: [traces.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [traces.createdBy],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  branch: one(branches, {
    fields: [events.branchId],
    references: [branches.id],
  }),
}));
