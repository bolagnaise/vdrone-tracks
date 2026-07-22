import { createCipheriv, createDecipheriv } from "node:crypto";
import type { CommunityTrack } from "../shared/types";
import { sceneName } from "../shared/sceneries";

export const COMMUNITY_SEARCH_PATH = "/api/v1/private/user/rated_tracks_list";
export const COMMUNITY_TRACK_PATH = "/api/v1/private/user/track";
export const COMMUNITY_RESULT_LIMIT = 200;
export const COMMUNITY_HOST = "https://www.velocidrone.com";

export const COMMUNITY_TRACK_TYPES: Readonly<Record<number, string>> = {
  1: "Beginner",
  2: "Intermediate",
  3: "Advanced",
  4: "Beginner Mega",
  5: "Intermediate Mega",
  6: "Advanced Mega",
  7: "Beginner Micro",
  8: "Intermediate Micro",
  9: "Advanced Micro",
  10: "Combat",
  11: "Freestyle",
  12: "Street League",
  13: "MGP PRO Spec",
};

const TYPE_IDS = new Map(Object.entries(COMMUNITY_TRACK_TYPES).map(([id, label]) => [label, Number(id)]));

export interface CommunitySourceTrack {
  id: number;
  scenery_id: number;
  track_name: string;
  track_type: string;
  playername: string;
  rating?: string | number;
  total_ratings?: number;
  date?: string;
  track_data?: string;
}

interface CommunityEnvelope {
  success: true;
  user_tracks: CommunitySourceTrack[];
}

function derivedKey(seed: string): Buffer {
  const half = seed.replaceAll(" ", "").slice(0, 8);
  return Buffer.from(half + [...half].reverse().join(""), "utf8");
}

export function apiKey(): Buffer {
  return derivedKey("Bat Cave Games");
}

export function trackFileKey(): Buffer {
  return derivedKey("Velocidrone");
}

export function encryptText(value: string, key: Buffer): string {
  const cipher = createCipheriv("aes-128-ecb", key, Buffer.alloc(0));
  return Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64");
}

export function decryptText(value: string, key: Buffer): string {
  const decipher = createDecipheriv("aes-128-ecb", key, Buffer.alloc(0));
  return Buffer.concat([decipher.update(Buffer.from(value.trim(), "base64")), decipher.final()]).toString("utf8");
}

export function decodeTrackText(value: string): string {
  try {
    return decodeURIComponent(value.replaceAll("+", " ")).replaceAll("+", " ").trim();
  } catch {
    return value.replaceAll("+", " ").trim();
  }
}

function validEnvelope(value: unknown): value is CommunityEnvelope {
  return Boolean(value && typeof value === "object" && (value as { success?: unknown }).success === true &&
    Array.isArray((value as { user_tracks?: unknown }).user_tracks));
}

export async function requestCommunityApi(
  path: typeof COMMUNITY_SEARCH_PATH | typeof COMMUNITY_TRACK_PATH,
  fields: Record<string, string>,
  fetcher: typeof fetch = fetch,
): Promise<CommunitySourceTrack[]> {
  const postData = encryptText(new URLSearchParams(fields).toString(), apiKey());
  const response = await fetcher(COMMUNITY_HOST + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "vdrone-tracks/1.1",
    },
    body: new URLSearchParams({ post_data: postData }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Community API HTTP ${response.status}`);
  const encrypted = await response.text();
  if (Buffer.byteLength(encrypted, "utf8") > 16 * 1024 * 1024) throw new Error("Community API response is too large");
  const decoded: unknown = JSON.parse(decryptText(encrypted, apiKey()));
  if (!validEnvelope(decoded)) throw new Error("Community API returned an invalid response");
  return decoded.user_tracks;
}

export function communityTypeId(label: string): number {
  return TYPE_IDS.get(label) ?? 0;
}

export function normalizedCommunityTrack(source: CommunitySourceTrack): CommunityTrack | null {
  const id = Number(source.id);
  const sceneId = Number(source.scenery_id);
  const rating = Number(source.rating ?? 0);
  const ratingCount = Number(source.total_ratings ?? 0);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(sceneId) || sceneId <= 0 ||
      typeof source.track_name !== "string" || !source.track_name.trim() ||
      typeof source.track_type !== "string" || typeof source.playername !== "string" ||
      !Number.isFinite(rating) || !Number.isInteger(ratingCount) || ratingCount < 0) return null;
  const date = typeof source.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.date)
    ? `${source.date} 00:00:00`
    : "";
  return {
    source: "community",
    id,
    name: decodeTrackText(source.track_name),
    creator: decodeTrackText(source.playername),
    sceneId,
    sceneName: sceneName(sceneId),
    publishedAt: date,
    type: communityTypeId(source.track_type),
    typeLabel: source.track_type,
    rating,
    ratingCount,
    downloadAvailable: true,
  };
}

export function decodeTrackData(value: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(value); }
  catch { throw new Error("Community track data is not valid URL-encoded text"); }
  if (decoded.includes("\n") || decoded.includes("\r")) throw new Error("Community track data contains invalid line breaks");
  if (Buffer.byteLength(decoded, "utf8") > 10 * 1024 * 1024) throw new Error("Community track is too large");
  let parsed: unknown;
  try { parsed = JSON.parse(decoded); }
  catch { throw new Error("Community track data is not valid JSON"); }
  if (!parsed || typeof parsed !== "object") throw new Error("Community track data is not a track object");
  return decoded;
}

export function packageCommunityTrack(source: CommunitySourceTrack): { filename: string; body: string } {
  const track = normalizedCommunityTrack(source);
  if (!track || typeof source.track_data !== "string") throw new Error("Community track is incomplete");
  const data = decodeTrackData(source.track_data);
  const safeName = track.name.replace(/[\r\n]/g, " ").trim();
  const plaintext = [track.sceneId, safeName, data, track.type, track.id].join("\n");
  return { filename: safeName, body: encryptText(plaintext, trackFileKey()) };
}
