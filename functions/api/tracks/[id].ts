import type { Env, TrackRow } from "../../_lib";
import { json, parseTrackId, toTrack } from "../../_lib";

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = parseTrackId(String(params.id));
  if (id === null) return json({ error: "Invalid track ID" }, 400);
  const row = await env.DB.prepare("SELECT id, name, scene_id, scene_name, version, published_at, type, rating, rating_count, remote_path FROM tracks WHERE id = ? AND active = 1")
    .bind(id).first<TrackRow>();
  return row ? json({ track: toTrack(row) }) : json({ error: "Track not found" }, 404);
};
