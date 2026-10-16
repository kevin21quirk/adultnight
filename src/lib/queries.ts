import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "./db/client";
import { categories, providers, videoCategories, videos, type Video } from "./db/schema";

export const PAGE_SIZE = 24;

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type VideoCard = Pick<
  Video,
  | "id"
  | "title"
  | "thumbnailUrl"
  | "durationSeconds"
  | "providerVideoId"
  | "providerId"
  | "views"
> & { providerName: string };

const cardColumns = {
  id: videos.id,
  title: videos.title,
  thumbnailUrl: videos.thumbnailUrl,
  durationSeconds: videos.durationSeconds,
  providerVideoId: videos.providerVideoId,
  providerId: videos.providerId,
  views: videos.views,
  providerName: providers.name,
} as const;

const PUBLIC_STATUS = "approved" as const;

export async function listVideos(opts: {
  page: number;
  categorySlug?: string;
  tag?: string;
  query?: string;
  sort?: "newest" | "views";
}): Promise<PageResult<VideoCard>> {
  const db = getDb();
  const page = Math.max(1, opts.page);
  const conditions: SQL[] = [eq(videos.status, PUBLIC_STATUS)];

  if (opts.query) {
    const q = opts.query.trim().slice(0, 200);
    if (q.length > 0) {
      // The GIN expression index covers title+description; tags are matched
      // via array membership so both paths stay indexed.
      conditions.push(
        sql`(to_tsvector('english', coalesce(${videos.title}, '') || ' ' || coalesce(${videos.description}, '')) @@ plainto_tsquery('english', ${q}) or ${q} = any(${videos.tags}))`
      );
    }
  }
  if (opts.tag) {
    conditions.push(sql`${opts.tag} = any(${videos.tags})`);
  }
  if (opts.categorySlug) {
    conditions.push(
      sql`exists (select 1 from ${videoCategories} vc join ${categories} c on c.id = vc.category_id where vc.video_id = ${videos.id} and c.slug = ${opts.categorySlug})`
    );
  }

  const where = and(...conditions);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videos)
    .where(where);

  const orderBy =
    opts.sort === "views"
      ? [desc(videos.views), desc(videos.importedAt)]
      : [desc(videos.importedAt)];

  const items = await db
    .select(cardColumns)
    .from(videos)
    .innerJoin(providers, eq(videos.providerId, providers.id))
    .where(where)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    total: count,
    totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
  };
}

export interface PublicVideo extends Video {
  providerName: string;
  providerSlug: string;
  categoryNames: { name: string; slug: string }[];
}

export async function getPublicVideo(id: string): Promise<PublicVideo | null> {
  const db = getDb();
  const rows = await db
    .select({ video: videos, providerName: providers.name, providerSlug: providers.slug })
    .from(videos)
    .innerJoin(providers, eq(videos.providerId, providers.id))
    .where(and(eq(videos.id, id), eq(videos.status, PUBLIC_STATUS)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const cats = await db
    .select({ name: categories.name, slug: categories.slug })
    .from(videoCategories)
    .innerJoin(categories, eq(videoCategories.categoryId, categories.id))
    .where(eq(videoCategories.videoId, row.video.id));
  return { ...row.video, providerName: row.providerName, providerSlug: row.providerSlug, categoryNames: cats };
}

export async function getRelatedVideos(
  video: PublicVideo,
  limit = 12
): Promise<VideoCard[]> {
  const db = getDb();
  const catIds = video.categoryNames.map((c) => c.slug);
  const tagList = video.tags.slice(0, 20);

  const conditions: SQL[] = [
    eq(videos.status, PUBLIC_STATUS),
    sql`${videos.id} <> ${video.id}`,
  ];
  const matchParts: SQL[] = [];
  if (catIds.length > 0) {
    matchParts.push(
      sql`exists (select 1 from ${videoCategories} vc join ${categories} c on c.id = vc.category_id where vc.video_id = ${videos.id} and c.slug in (${sql.join(catIds.map((s) => sql`${s}`), sql`, `)}))`
    );
  }
  if (tagList.length > 0) {
    matchParts.push(
      sql`${videos.tags} && array[${sql.join(
        tagList.map((t) => sql`${t}`),
        sql`, `
      )}]::text[]`
    );
  }
  if (matchParts.length === 0) return [];
  conditions.push(sql`(${sql.join(matchParts, sql` or `)})`);

  // Fetch a bounded candidate pool (indexed filters only), then rank in
  // JS — correlated scoring in ORDER BY was too heavy on cold functions.
  const candidates = await db
    .select({ ...cardColumns, tags: videos.tags })
    .from(videos)
    .innerJoin(providers, eq(videos.providerId, providers.id))
    .where(and(...conditions))
    .orderBy(desc(videos.views))
    .limit(300);

  const catSet = new Set(catIds);
  const tagSet = new Set(tagList);
  const catCount = new Map<string, number>();
  if (catIds.length > 0) {
    const vidIds = candidates.map((c) => c.id);
    const links = await db
      .select({ videoId: videoCategories.videoId, slug: categories.slug })
      .from(videoCategories)
      .innerJoin(categories, eq(videoCategories.categoryId, categories.id))
      .where(inArray(videoCategories.videoId, vidIds));
    for (const l of links) {
      if (catSet.has(l.slug)) {
        catCount.set(l.videoId, (catCount.get(l.videoId) ?? 0) + 1);
      }
    }
  }

  return candidates
    .map((c) => ({
      card: c,
      score:
        (c.providerId === video.providerId ? 1000 : 0) +
        (catCount.get(c.id) ?? 0) * 10 +
        c.tags.filter((t) => tagSet.has(t)).length,
    }))
    .sort((a, b) => b.score - a.score || (b.card.views ?? 0) - (a.card.views ?? 0))
    .slice(0, limit)
    .map(({ card: { tags: _tags, ...card } }) => card);
}

export async function listCategoriesWithCounts(): Promise<
  { name: string; slug: string; count: number }[]
> {
  const db = getDb();
  return db
    .select({
      name: categories.name,
      slug: categories.slug,
      count: sql<number>`count(${videoCategories.videoId})::int`,
    })
    .from(categories)
    .innerJoin(videoCategories, eq(videoCategories.categoryId, categories.id))
    .innerJoin(videos, eq(videoCategories.videoId, videos.id))
    .where(eq(videos.status, PUBLIC_STATUS))
    .groupBy(categories.id)
    .orderBy(desc(sql`count(${videoCategories.videoId})`), categories.name)
    .limit(48);
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
