import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { takedownRequests, videos } from "@/lib/db/schema";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { isUuid } from "@/lib/queries";

const bodySchema = z.object({
  videoId: z.string().refine(isUuid),
  requestType: z.enum(["illegal", "non_consensual", "copyright", "privacy", "other"]),
  reason: z.string().min(10).max(5000),
  reporterContact: z.string().email().max(320).optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req, "report"), 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many reports. Please try again later." },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report data." }, { status: 400 });
  }

  const db = getDb();
  const video = await db.query.videos.findFirst({
    where: eq(videos.id, parsed.data.videoId),
    columns: { id: true },
  });
  if (!video) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  await db.insert(takedownRequests).values({
    videoId: parsed.data.videoId,
    requestType: parsed.data.requestType,
    reason: parsed.data.reason,
    reporterContact: parsed.data.reporterContact ?? null,
  });

  return NextResponse.json({ ok: true });
}
