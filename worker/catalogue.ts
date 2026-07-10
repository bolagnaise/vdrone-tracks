import { createDecipheriv } from "node:crypto";
import { remoteTrackPath, sceneName } from "../shared/sceneries";

export const CATALOGUE_URL = "https://velocidrone.co.uk/api/get_official_tracks";

export interface SourceTrack {
  track_name: string;
  track_id: number;
  scene_id: number;
  ver: number;
  date: string;
  type: number;
  rating: number;
  count: number;
}

export interface Catalogue { success: true; tracks: SourceTrack[] }

export function catalogueKey(seed = "Bat Cave Games"): Buffer {
  const half = seed.replaceAll(" ", "").slice(0, 8);
  return Buffer.from(half + [...half].reverse().join(""), "utf8");
}

export function decryptCatalogue(encoded: string): Catalogue {
  const decipher = createDecipheriv("aes-128-ecb", catalogueKey(), Buffer.alloc(0));
  decipher.setAutoPadding(true);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encoded.trim(), "base64")), decipher.final()]).toString("utf8");
  const value: unknown = JSON.parse(plaintext);
  if (!value || typeof value !== "object" || (value as { success?: unknown }).success !== true || !Array.isArray((value as { tracks?: unknown }).tracks)) {
    throw new Error("Catalogue response was not successful");
  }
  return value as Catalogue;
}

export function validateTracks(tracks: SourceTrack[]): SourceTrack[] {
  const ids = new Set<number>();
  return tracks.map((track) => {
    if (!track || !Number.isInteger(track.track_id) || track.track_id <= 0 || !Number.isInteger(track.scene_id) ||
        typeof track.track_name !== "string" || !track.track_name.trim() || !Number.isFinite(Number(track.rating)) ||
        !Number.isInteger(track.ver) || !Number.isInteger(track.type) || !Number.isInteger(track.count) ||
        Number.isNaN(Date.parse(track.date))) throw new Error(`Invalid track record ${JSON.stringify(track)}`);
    if (ids.has(track.track_id)) throw new Error(`Duplicate track ID ${track.track_id}`);
    ids.add(track.track_id);
    return { ...track, track_name: track.track_name.trim() };
  });
}

export function normalizedTrack(track: SourceTrack, seenAt: string) {
  return {
    id: track.track_id, name: track.track_name, sceneId: track.scene_id,
    sceneName: sceneName(track.scene_id), version: track.ver, publishedAt: track.date,
    type: track.type, rating: Number(track.rating), ratingCount: track.count,
    remotePath: remoteTrackPath(track.scene_id, track.track_name), seenAt,
  };
}
