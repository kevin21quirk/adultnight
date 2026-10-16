import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Load .env.local so integration tests can reach the dev database.
for (const file of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), file);
  if (existsSync(p)) {
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
