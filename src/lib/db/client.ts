import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

let pool: Pool | null = null;

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!pool) pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof getDb>;
