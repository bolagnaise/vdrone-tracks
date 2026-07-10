import { CATALOGUE_URL, decryptCatalogue, normalizedTrack, validateTracks } from "./catalogue";

interface Env { DB: D1Database; SYNC_TOKEN: string }

async function syncCatalogue(env: Env): Promise<{ count: number; inactive: number }> {
  const startedAt = new Date().toISOString();
  const run = await env.DB.prepare("INSERT INTO sync_runs (started_at, status) VALUES (?, 'running') RETURNING id").bind(startedAt).first<{ id: number }>();
  if (!run) throw new Error("Could not create sync run");
  try {
    const response = await fetch(CATALOGUE_URL, { headers: { "User-Agent": "vdrone-tracks-sync/1.0" } });
    if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
    const tracks = validateTracks(decryptCatalogue(await response.text()).tracks);
    const seenAt = new Date().toISOString();
    const statement = env.DB.prepare(`INSERT INTO tracks
      (id, name, scene_id, scene_name, version, published_at, type, rating, rating_count, remote_path, active, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, scene_id=excluded.scene_id,
      scene_name=excluded.scene_name, version=excluded.version, published_at=excluded.published_at,
      type=excluded.type, rating=excluded.rating, rating_count=excluded.rating_count,
      remote_path=excluded.remote_path, active=1, last_seen_at=excluded.last_seen_at`);
    for (let offset = 0; offset < tracks.length; offset += 75) {
      await env.DB.batch(tracks.slice(offset, offset + 75).map((source) => {
        const t = normalizedTrack(source, seenAt);
        return statement.bind(t.id, t.name, t.sceneId, t.sceneName, t.version, t.publishedAt,
          t.type, t.rating, t.ratingCount, t.remotePath, t.seenAt);
      }));
    }
    const inactiveResult = await env.DB.prepare("UPDATE tracks SET active = 0 WHERE active = 1 AND last_seen_at <> ?").bind(seenAt).run();
    const inactive = inactiveResult.meta.changes ?? 0;
    await env.DB.prepare("UPDATE sync_runs SET completed_at=?, status='success', source_count=?, upserted_count=?, inactive_count=? WHERE id=?")
      .bind(new Date().toISOString(), tracks.length, tracks.length, inactive, run.id).run();
    return { count: tracks.length, inactive };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
    await env.DB.prepare("UPDATE sync_runs SET completed_at=?, status='failed', error=? WHERE id=?")
      .bind(new Date().toISOString(), message, run.id).run();
    throw error;
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncCatalogue(env));
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/sync") return new Response("Not found", { status: 404 });
    if (!env.SYNC_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.SYNC_TOKEN}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    try { return Response.json(await syncCatalogue(env)); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
  },
};
