import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/lib/db/schema";

for (const file of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), file);
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

export const hasDb = !!process.env.DATABASE_URL;

export function testDb() {
  return drizzle(new Pool({ connectionString: process.env.DATABASE_URL! }), {
    schema,
  });
}
