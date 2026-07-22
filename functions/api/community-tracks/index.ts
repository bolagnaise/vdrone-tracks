import { COMMUNITY_RESULT_LIMIT, COMMUNITY_SEARCH_PATH, COMMUNITY_TRACK_TYPES, normalizedCommunityTrack, requestCommunityApi } from "../../_community";
import { json } from "../../_lib";

function clipped(value: string | null, length = 100): string {
  return (value ?? "").trim().slice(0, length);
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const q = clipped(url.searchParams.get("q"));
  const creator = clipped(url.searchParams.get("creator"));
  const sceneRaw = clipped(url.searchParams.get("scenery"), 10);
  const sceneId = /^\d+$/.test(sceneRaw) ? Number(sceneRaw) : null;
  const typeRaw = clipped(url.searchParams.get("type"), 10);
  const typeId = /^\d+$/.test(typeRaw) ? Number(typeRaw) : null;
  const typeLabel = typeId === null ? "" : COMMUNITY_TRACK_TYPES[typeId] ?? "";
  const sort = url.searchParams.get("sort") === "rating" ? "rating" : "newest";
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));

  let source;
  try {
    source = await requestCommunityApi(COMMUNITY_SEARCH_PATH, {
      scenery_id: sceneId === null ? "" : String(sceneId),
      playername: creator,
      track_name: q,
      track_type: typeLabel,
      order_by_date: String(sort === "newest"),
      order_by_rating: String(sort === "rating"),
      show_beginner: "True",
      show_intermediate: "True",
      show_advanced: "True",
    });
  } catch (error) {
    console.error("Community track search failed", error);
    return json({ error: "VelociDrone's community track search is unavailable. Try again shortly." }, 502);
  }

  const allTracks = source.map(normalizedCommunityTrack).filter((track) => track !== null);
  const sceneCounts = new Map<number, { id: number; name: string; count: number }>();
  const typeCounts = new Map<number, { type: number; count: number }>();
  for (const track of allTracks) {
    const scene = sceneCounts.get(track.sceneId) ?? { id: track.sceneId, name: track.sceneName, count: 0 };
    scene.count += 1;
    sceneCounts.set(track.sceneId, scene);
    const type = typeCounts.get(track.type) ?? { type: track.type, count: 0 };
    type.count += 1;
    typeCounts.set(track.type, type);
  }
  const total = allTracks.length;
  const start = (page - 1) * limit;
  return json({
    tracks: allTracks.slice(start, start + limit),
    facets: {
      sceneries: [...sceneCounts.values()].sort((a, b) => a.name.localeCompare(b.name)),
      types: [...typeCounts.values()].sort((a, b) => a.type - b.type),
    },
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    lastSyncAt: null,
    resultLimitReached: source.length >= COMMUNITY_RESULT_LIMIT,
  });
};
