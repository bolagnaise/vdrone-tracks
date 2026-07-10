import type { Track } from "../shared/types";

export interface Env { DB: D1Database }

export interface TrackRow {
  id: number;
  name: string;
  scene_id: number;
  scene_name: string;
  version: number;
  published_at: string;
  type: number;
  rating: number;
  rating_count: number;
  remote_path: string | null;
}

export function toTrack(row: TrackRow): Track {
  return {
    id: row.id,
    name: row.name,
    sceneId: row.scene_id,
    sceneName: row.scene_name,
    version: row.version,
    publishedAt: row.published_at,
    type: row.type,
    rating: row.rating,
    ratingCount: row.rating_count,
    downloadAvailable: row.remote_path !== null,
  };
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": status === 200 ? "public, max-age=60, s-maxage=300" : "no-store" },
  });
}

export function parseTrackId(value: string): number | null {
  return /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
}
