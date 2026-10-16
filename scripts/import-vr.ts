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
 * Targeted VR import: scans the full provider catalogue dump but only
 * imports records whose categories/tags indicate virtual-reality content.
 * Idempotent like the main import — safe to re-run.
 */
const VR_RE = /virtual.?reality|^vr$|vr porn/i;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const { runImport } = await import("../src/lib/importer/run");
  const summary = await runImport({
    providerSlug: "pornhub",
    mode: "incremental",
    dryRun,
    recordFilter: (rec) =>
      rec.categories.some((c) => VR_RE.test(c)) ||
      rec.tags.some((t) => VR_RE.test(t)),
  });
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.status === "failed" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
