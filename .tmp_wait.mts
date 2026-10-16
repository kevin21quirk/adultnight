import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { execSync } from "node:child_process";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const p = new Pool({ connectionString: process.env.DATABASE_URL });
// wait until no running import for pornhub
for (;;) {
  const r = await p.query(`select count(*)::int n from import_runs ir join providers pr on pr.id=ir.provider_id where pr.slug='pornhub' and ir.status='running'`);
  if (r.rows[0].n === 0) break;
  console.log("lock held, waiting...");
  await new Promise(r2 => setTimeout(r2, 30000));
}
await p.end();
console.log("lock free — starting full refresh import");
execSync("npx tsx scripts/import.ts --provider pornhub --mode incremental", { stdio: "inherit" });
