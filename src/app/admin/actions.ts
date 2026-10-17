"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  adminUsers,
  auditLog,
  blocklist,
  moderationEvents,
  providers,
  takedownRequests,
  videos,
} from "@/lib/db/schema";
import {
  ADMIN_COOKIE,
  createSession,
  requireAdmin,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit } from "@/lib/security/rate-limit";
import { adapterForSourceUrl } from "@/lib/providers/registry";
import { runImport, type ImportMode } from "@/lib/importer/run";

async function audit(
  actor: string,
  action: string,
  targetType?: string,
  targetId?: string,
  detail?: Record<string, unknown>
) {
  const db = getDb();
  await db.insert(auditLog).values({
    actorId: actor,
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    detail: detail ?? null,
  });
}

export async function loginAction(formData: FormData) {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`login:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.ok) redirect("/admin/login?error=rate");

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const db = getDb();
  const user = await db.query.adminUsers.findFirst({
    where: eq(adminUsers.username, username),
  });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/admin/login?error=credentials");
  }
  const token = await createSession(username);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
  await audit(username, "admin.login");
  redirect("/admin");
}

export async function logoutAction() {
  const actor = await requireAdmin();
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  await audit(actor, "admin.logout");
  redirect("/admin/login");
}

export async function toggleProviderAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("providerId"));
  const enabled = formData.get("enabled") === "true";
  const db = getDb();
  await db
    .update(providers)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(providers.id, id));
  await audit(actor, enabled ? "provider.enable" : "provider.disable", "provider", id);
  revalidatePath("/admin/providers");
}

export async function markTermsReviewedAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("providerId"));
  const db = getDb();
  await db
    .update(providers)
    .set({ termsReviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(providers.id, id));
  await audit(actor, "provider.terms_reviewed", "provider", id);
  revalidatePath("/admin/providers");
}

export async function triggerImportAction(formData: FormData) {
  const actor = await requireAdmin();
  const slug = z.string().max(100).parse(formData.get("providerSlug"));
  const mode = z
    .enum(["initial", "incremental", "deletions"])
    .parse(formData.get("mode") ?? "incremental") as ImportMode;
  const dryRun = formData.get("dryRun") === "true";
  const maxRows = Math.min(
    Math.max(parseInt(String(formData.get("maxRows") ?? "500"), 10) || 500, 1),
    50_000
  );
  const summary = await runImport({
    providerSlug: slug,
    mode,
    dryRun,
    maxRows,
    force: dryRun, // allow dry-run validation on disabled providers
  });
  await audit(actor, dryRun ? "import.dry_run" : "import.trigger", "provider", slug, {
    mode,
    status: summary.status,
    inserted: summary.recordsInserted,
    deactivated: summary.recordsDeactivated,
    error: summary.error,
  });
  revalidatePath("/admin/imports");
  revalidatePath("/admin/providers");
}

const videoAction = z.enum(["approve", "reject", "deactivate", "unavailable"]);
const actionToStatus = {
  approve: "approved",
  reject: "rejected",
  deactivate: "removed",
  unavailable: "unavailable",
} as const;

export async function moderateVideoAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("videoId"));
  const action = videoAction.parse(formData.get("action"));
  const reason = String(formData.get("reason") ?? "").slice(0, 2000) || null;
  const status = actionToStatus[action];

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(videos)
      .set({
        status,
        removedAt: status === "removed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id));
    await tx.insert(moderationEvents).values({
      videoId: id,
      eventType: action,
      reason,
      actorId: actor,
    });
  });
  await audit(actor, `video.${action}`, "video", id, { reason });
  revalidatePath("/admin/videos");
}

export async function resolveTakedownAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("takedownId"));
  const outcome = z.enum(["actioned", "dismissed"]).parse(formData.get("outcome"));

  const db = getDb();
  const req = await db.query.takedownRequests.findFirst({
    where: and(eq(takedownRequests.id, id), eq(takedownRequests.status, "open")),
  });
  if (!req) return;

  await db.transaction(async (tx) => {
    await tx
      .update(takedownRequests)
      .set({ status: outcome, resolvedAt: new Date() })
      .where(eq(takedownRequests.id, id));
    if (outcome === "actioned") {
      await tx
        .update(videos)
        .set({ status: "removed", removedAt: new Date(), updatedAt: new Date() })
        .where(eq(videos.id, req.videoId));
      await tx.insert(moderationEvents).values({
        videoId: req.videoId,
        eventType: "takedown_actioned",
        reason: `takedown ${id}`,
        actorId: actor,
      });
    }
  });
  await audit(actor, `takedown.${outcome}`, "takedown", id, { videoId: req.videoId });
  revalidatePath("/admin/moderation");
}

const mediaUrlSchema = z
  .string()
  .url()
  .max(2000)
  .refine((u) => u.startsWith("https://"), "Media URL must be https")
  .nullable();
const vrModeSchema = z.enum(["mono360", "sbs180", "sbs360"]).nullable();

export async function addManualVideoAction(formData: FormData) {
  const actor = await requireAdmin();
  const url = z.string().url().max(2000).parse(formData.get("url"));
  const title = z.string().min(1).max(300).parse(formData.get("title"));
  const mediaUrl = mediaUrlSchema.parse(formData.get("mediaUrl") || null);
  const vrMode = vrModeSchema.parse(formData.get("vrMode") || null);

  const adapter = adapterForSourceUrl(url);
  if (!adapter) {
    throw new Error("Unsupported or disallowed provider URL.");
  }
  const videoId = adapter.videoIdFromUrl(url)!;
  const db = getDb();
  const provider = await db.query.providers.findFirst({
    where: eq(providers.slug, adapter.slug),
  });
  if (!provider) throw new Error("Provider is not configured.");

  const embedUrl = adapter.embedUrlFor(videoId);
  const [row] = await db
    .insert(videos)
    .values({
      providerId: provider.id,
      providerVideoId: videoId,
      title,
      embedUrl,
      sourceUrl: adapter.sourceUrlFor(videoId),
      mediaUrl,
      vrMode,
      status: "pending_review",
      tags: [],
    })
    .onConflictDoUpdate({
      target: [videos.providerId, videos.providerVideoId],
      set: {
        title,
        embedUrl,
        sourceUrl: adapter.sourceUrlFor(videoId),
        mediaUrl,
        vrMode,
        updatedAt: new Date(),
      },
    })
    .returning({ id: videos.id });

  await db.insert(moderationEvents).values({
    videoId: row.id,
    eventType: "manual_add",
    reason: url,
    actorId: actor,
  });
  await audit(actor, "video.manual_add", "video", row.id, { url });
  revalidatePath("/admin/videos");
}

/**
 * Attach (or clear) an authorized direct media file on an existing video.
 * When set on a VR-flagged video, the public player switches to the
 * interactive WebGL sphere player via /api/vr-stream.
 */
export async function setVideoMediaAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("videoId"));
  const mediaUrl = mediaUrlSchema.parse(formData.get("mediaUrl") || null);
  const vrMode = vrModeSchema.parse(formData.get("vrMode") || null);

  const db = getDb();
  await db
    .update(videos)
    .set({ mediaUrl, vrMode: mediaUrl ? vrMode : null, updatedAt: new Date() })
    .where(eq(videos.id, id));
  await audit(actor, "video.set_media", "video", id, { mediaUrl, vrMode });
  revalidatePath("/admin/videos");
}

export async function revalidateVideoAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = z.string().uuid().parse(formData.get("videoId"));
  const db = getDb();
  const video = await db.query.videos.findFirst({ where: eq(videos.id, id) });
  if (!video) return;

  const adapter = adapterForSourceUrl(video.sourceUrl ?? "") ??
    (video.embedUrl ? adapterForSourceUrl(video.embedUrl) : null);
  const formatValid =
    adapter &&
    adapter.validateVideoId(video.providerVideoId) &&
    (!video.embedUrl || adapter.validateEmbedUrl(video.embedUrl));

  let outcome: string = "valid";
  if (!formatValid || !adapter) {
    outcome = "format_invalid";
  } else {
    outcome = await adapter.checkAvailable(video.providerVideoId);
  }

  if (outcome === "format_invalid" || outcome === "unavailable") {
    await db
      .update(videos)
      .set({ status: "unavailable", updatedAt: new Date() })
      .where(eq(videos.id, id));
    await db.insert(moderationEvents).values({
      videoId: id,
      eventType: "revalidate_failed",
      reason: outcome,
      actorId: actor,
    });
  }
  await audit(actor, "video.revalidate", "video", id, { outcome });
  revalidatePath("/admin/videos");
}

export async function addBlocklistAction(formData: FormData) {
  const actor = await requireAdmin();
  const entryType = z.enum(["domain", "provider_video"]).parse(formData.get("entryType"));
  const value = z.string().min(1).max(500).parse(formData.get("value")).toLowerCase();
  const reason = String(formData.get("reason") ?? "").slice(0, 2000) || null;
  const db = getDb();
  await db.insert(blocklist).values({ entryType, value, reason }).onConflictDoNothing();
  await audit(actor, "blocklist.add", "blocklist", `${entryType}:${value}`, { reason });
  revalidatePath("/admin/moderation");
}
