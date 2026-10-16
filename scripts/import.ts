import { readFileSync, existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const get = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const mode = (get("--mode") ?? "incremental") as
    | "initial"
    | "incremental"
    | "deletions";
  const dryRun = args.includes("--dry-run");
  const maxRows = get("--max-rows") ? parseInt(get("--max-rows")!, 10) : undefined;
  const provider = get("--provider") ?? "pornhub";

  const { runImport } = await import("../src/lib/importer/run");
  const summary = await runImport({
    providerSlug: provider,
    mode,
    dryRun,
    maxRows,
  });
  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.status === "failed" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
