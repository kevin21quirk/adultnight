import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const videoStatus = pgEnum("video_status", [
  "pending_review",
  "approved",
  "rejected",
  "unavailable",
  "removed",
]);

export const importRunStatus = pgEnum("import_run_status", [
  "running",
  "completed",
  "failed",
]);

export const takedownStatus = pgEnum("takedown_status", [
  "open",
  "actioned",
  "dismissed",
]);

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  integrationType: varchar("integration_type", { length: 50 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  allowedHosts: text("allowed_hosts").array().notNull().default([]),
  importIntervalMinutes: integer("import_interval_minutes").notNull().default(360),
  operationalStatus: varchar("operational_status", { length: 50 })
    .notNull()
    .default("unconfigured"),
  termsReviewedAt: timestamp("terms_reviewed_at", { withTimezone: true }),
  lastSuccessfulImportAt: timestamp("last_successful_import_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "restrict" }),
    providerVideoId: varchar("provider_video_id", { length: 100 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    thumbnailUrl: text("thumbnail_url"),
    embedUrl: text("embed_url"),
    sourceUrl: text("source_url"),
    durationSeconds: integer("duration_seconds"),
    views: bigint("views", { mode: "number" }),
    tags: text("tags").array().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    status: videoStatus("status").notNull().default("pending_review"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("videos_provider_video_unique").on(
      t.providerId,
      t.providerVideoId
    ),
    index("videos_status_idx").on(t.status),
    index("videos_published_at_idx").on(t.publishedAt),
    index("videos_provider_id_idx").on(t.providerId),
  ]
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("categories_slug_idx").on(t.slug)]
);

export const videoCategories = pgTable(
  "video_categories",
  {
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.videoId, t.categoryId] }),
    index("video_categories_category_idx").on(t.categoryId),
  ]
);

export const importRuns = pgTable(
  "import_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providers.id, { onDelete: "cascade" }),
    mode: varchar("mode", { length: 30 }).notNull(),
    dryRun: boolean("dry_run").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: importRunStatus("status").notNull().default("running"),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsInserted: integer("records_inserted").notNull().default(0),
    recordsUpdated: integer("records_updated").notNull().default(0),
    recordsSkipped: integer("records_skipped").notNull().default(0),
    recordsDeactivated: integer("records_deactivated").notNull().default(0),
    errorSummary: text("error_summary"),
  },
  (t) => [index("import_runs_provider_idx").on(t.providerId, t.startedAt)]
);

export const moderationEvents = pgTable(
  "moderation_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    reason: text("reason"),
    actorId: varchar("actor_id", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("moderation_events_video_idx").on(t.videoId)]
);

export const takedownRequests = pgTable(
  "takedown_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    requestType: varchar("request_type", { length: 50 }).notNull(),
    reporterContact: varchar("reporter_contact", { length: 320 }),
    reason: text("reason").notNull(),
    status: takedownStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("takedown_requests_status_idx").on(t.status),
    index("takedown_requests_video_idx").on(t.videoId),
  ]
);

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: varchar("actor_id", { length: 200 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    targetType: varchar("target_type", { length: 100 }),
    targetId: varchar("target_id", { length: 200 }),
    detail: jsonb("detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)]
);

export const blocklist = pgTable(
  "blocklist",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryType: varchar("entry_type", { length: 30 }).notNull(),
    value: varchar("value", { length: 500 }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("blocklist_type_value_unique").on(t.entryType, t.value)]
);

export type Provider = typeof providers.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type ImportRun = typeof importRuns.$inferSelect;
export type TakedownRequest = typeof takedownRequests.$inferSelect;
