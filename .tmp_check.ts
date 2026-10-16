import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
async function main() {
  for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  // categories present
  const cats = await p.query(`select c.slug, c.name, count(*)::int n from categories c join video_categories vc on vc.category_id=c.id group by c.slug,c.name order by n desc limit 30`);
  console.log("== categories =="); for (const r of cats.rows) console.log(r.slug, "|", r.name, "|", r.n);
  // VR-ish videos
  const vr = await p.query(`select v.status, count(*)::int n from videos v join video_categories vc on vc.video_id=v.id join categories c on c.id=vc.category_id where lower(c.name) like '%virtual%' or lower(c.name) like '%vr%' group by v.status`);
  console.log("== VR cat status ==", vr.rows);
  const vrtag = await p.query(`select v.status, count(*)::int n from videos v where v.tags::text ilike '%vr%' or v.tags::text ilike '%virtual reality%' group by v.status`);
  console.log("== VR tag status ==", vrtag.rows);
  const status = await p.query(`select status, count(*)::int n from videos group by status`);
  console.log("== overall ==", status.rows);
  const thumbs = await p.query(`select count(*)::int n from videos where status='pending_review' and thumbnail_url is not null and thumbnail_url <> ''`);
  console.log("pending with thumb:", thumbs.rows[0].n);
  await p.end();
}
main().catch(e => { console.error(e); process.exit(1); });
