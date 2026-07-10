import type { Env, TrackRow } from "../../_lib";
import { json, toTrack } from "../../_lib";

const SORTS: Record<string, string> = {
  newest: "published_at DESC, id DESC",
  oldest: "published_at ASC, id ASC",
  name: "name COLLATE NOCASE ASC, id ASC",
  rating: "rating DESC, rating_count DESC, id DESC",
  popularity: "rating_count DESC, rating DESC, id DESC",
};

function likeTerm(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const scenery = (url.searchParams.get("scenery") ?? "").trim().slice(0, 100);
  const typeRaw = url.searchParams.get("type");
  const type = typeRaw && /^\d+$/.test(typeRaw) ? Number(typeRaw) : null;
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const order = SORTS[url.searchParams.get("sort") ?? "newest"] ?? SORTS.newest;

  const where = ["active = 1"];
  const bindings: Array<string | number> = [];
  if (q) {
    where.push("(name LIKE ? ESCAPE '\\' COLLATE NOCASE OR scene_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR CAST(id AS TEXT) = ?)");
    bindings.push(likeTerm(q), likeTerm(q), q);
  }
  if (scenery) { where.push("scene_name = ? COLLATE NOCASE"); bindings.push(scenery); }
  if (type !== null) { where.push("type = ?"); bindings.push(type); }
  const predicate = where.join(" AND ");

  const [rows, count, sceneFacets, typeFacets, sync] = await Promise.all([
    env.DB.prepare(`SELECT id, name, scene_id, scene_name, version, published_at, type, rating, rating_count, remote_path FROM tracks WHERE ${predicate} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .bind(...bindings, limit, (page - 1) * limit).all<TrackRow>(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM tracks WHERE ${predicate}`).bind(...bindings).first<{ count: number }>(),
    env.DB.prepare("SELECT scene_name AS name, COUNT(*) AS count FROM tracks WHERE active = 1 GROUP BY scene_name ORDER BY scene_name COLLATE NOCASE").all<{ name: string; count: number }>(),
    env.DB.prepare("SELECT type, COUNT(*) AS count FROM tracks WHERE active = 1 GROUP BY type ORDER BY type").all<{ type: number; count: number }>(),
    env.DB.prepare("SELECT completed_at FROM sync_runs WHERE status = 'success' ORDER BY id DESC LIMIT 1").first<{ completed_at: string }>(),
  ]);
  const total = count?.count ?? 0;
  return json({
    tracks: rows.results.map(toTrack),
    facets: { sceneries: sceneFacets.results, types: typeFacets.results },
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    lastSyncAt: sync?.completed_at ?? null,
  });
};
