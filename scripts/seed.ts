import { readFileSync, existsSync } from "node:fs";
import { scryptSync, randomBytes } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const { providers, videos, categories, videoCategories, adminUsers } = schema;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  // Provider row (disabled by default — enable after terms review)
  const [provider] = await db
    .insert(providers)
    .values({
      name: "Pornhub",
      slug: "pornhub",
      integrationType: "embed_dump",
      enabled: true,
      allowedHosts: ["www.pornhub.com", "pornhub.com", "phncdn.com", "*.phncdn.com"],
      operationalStatus: "seeded",
      termsReviewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: providers.slug,
      set: { updatedAt: new Date() },
    })
    .returning();
  console.log("provider:", provider.slug, provider.id);

  const [vrbone] = await db
    .insert(providers)
    .values({
      name: "VRBone",
      slug: "vrbone",
      integrationType: "sitemap_scrape",
      enabled: true,
      allowedHosts: ["vrbone.com", "www.vrbone.com", "vrbone.b-cdn.net"],
      operationalStatus: "seeded",
    })
    .onConflictDoUpdate({
      target: providers.slug,
      set: { updatedAt: new Date() },
    })
    .returning();
  console.log("provider:", vrbone.slug, vrbone.id);

  // Admin user from env
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (username && password) {
    await db
      .insert(adminUsers)
      .values({ username, passwordHash: hashPassword(password) })
      .onConflictDoNothing();
    console.log("admin user ensured:", username);
  } else {
    console.warn("ADMIN_USERNAME/ADMIN_PASSWORD not set — no admin user created");
  }

  // Synthetic catalogue (no real provider content; IDs are fabricated).
  // Re-runnable: removes prior synthetic rows first.
  await db
    .delete(videos)
    .where(
      sql`${videos.providerId} = ${provider.id} and (${videos.providerVideoId} like 'feed%' or ${videos.providerVideoId} like 'seed%')`
    );

  const cats = [
    "Amateur",
    "BDSM",
    "Blonde",
    "Brunette",
    "Compilation",
    "Cosplay",
    "Couples",
    "Massage",
    "Outdoor",
    "POV",
    "Solo",
    "Vintage",
  ];
  const catIds = new Map<string, string>();
  for (const name of cats) {
    const slug = name.toLowerCase();
    const [c] = await db
      .insert(categories)
      .values({ name, slug })
      .onConflictDoNothing()
      .returning();
    if (c) catIds.set(slug, c.id);
  }
  const allCats = await db.select().from(categories);
  for (const c of allCats) catIds.set(c.slug, c.id);

  const synthetic = Array.from({ length: 40 }, (_, i) => {
    const id = `feed${String(i).padStart(16, "0")}`;
    const cat = cats[i % cats.length];
    return {
      providerId: provider.id,
      providerVideoId: id,
      title: `Synthetic test video ${i + 1}: ${cat} sample`,
      description: `Synthetic seed record ${i + 1} for local development.`,
      thumbnailUrl: null,
      embedUrl: `https://www.pornhub.com/embed/${id}`,
      sourceUrl: `https://www.pornhub.com/view_video.php?viewkey=${id}`,
      durationSeconds: 180 + i * 37,
      views: 1000 + i * 733,
      tags: [cat.toLowerCase(), "synthetic", "test"],
      status: (i % 7 === 0 ? "pending_review" : "approved") as
        | "pending_review"
        | "approved",
      lastSeenAt: new Date(),
      _cat: cat.toLowerCase(),
    };
  });

  await db.insert(videos).values(
    synthetic.map(({ _cat, ...v }) => v)
  );
  const inserted = await db
    .select({ id: videos.id, providerVideoId: videos.providerVideoId })
    .from(videos)
    .where(sql`${videos.providerId} = ${provider.id}`);
  const idByVid = new Map(inserted.map((v) => [v.providerVideoId, v.id]));
  const links = synthetic
    .map((s) => ({
      videoId: idByVid.get(s.providerVideoId)!,
      categoryId: catIds.get(s._cat)!,
    }))
    .filter((l) => l.videoId && l.categoryId);
  await db.insert(videoCategories).values(links).onConflictDoNothing();

  console.log(`seeded ${synthetic.length} synthetic videos`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
