import { readFileSync, existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

/**
 * Ensure a provider row exists/enabled without reseeding synthetic videos.
 * Usage: tsx scripts/add-provider.ts <slug> [name] [integrationType]
 */
const KNOWN_HOSTS: Record<string, string[]> = {
  vrbone: ["vrbone.com", "www.vrbone.com", "vrbone.b-cdn.net"],
  eporner: ["eporner.com", "www.eporner.com", "*.eporner.com"],
};

async function main() {
  const slug = process.argv[2] ?? "vrbone";
  const name = process.argv[3] ?? "VRBone";
  const integrationType = process.argv[4] ?? "sitemap_scrape";

  const { Pool } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const schema = await import("../src/lib/db/schema");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const [row] = await db
    .insert(schema.providers)
    .values({
      name,
      slug,
      integrationType,
      enabled: true,
      allowedHosts: KNOWN_HOSTS[slug] ?? [],
      operationalStatus: "seeded",
    })
    .onConflictDoUpdate({
      target: schema.providers.slug,
      set: { enabled: true, updatedAt: new Date() },
    })
    .returning();

  console.log("provider:", row.slug, row.id);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
