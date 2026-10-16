import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim()); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const { getPublicVideo, getRelatedVideos } = await import("./src/lib/queries");
const v = await getPublicVideo("9dc2cb03-0000-4f69-adf5-d8c180b6d9b1");
console.log("video:", v?.title, v?.providerSlug, v?.categoryNames?.length, "cats", v?.tags?.length, "tags");
const rel = await getRelatedVideos(v!);
console.log("related:", rel.length);
