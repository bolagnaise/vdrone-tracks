import type { TrackListResponse, TrackSource } from "../shared/types";

export async function fetchTracks(source: TrackSource, params: URLSearchParams, signal?: AbortSignal): Promise<TrackListResponse> {
  const endpoint = source === "community" ? "/api/community-tracks" : "/api/tracks";
  const response = await fetch(`${endpoint}?${params}`, { signal });
  if (!response.ok) throw new Error("The track board could not be loaded.");
  return response.json() as Promise<TrackListResponse>;
}

export async function downloadTrack(source: TrackSource, id: number, name: string): Promise<void> {
  const endpoint = source === "community" ? "/api/community-tracks" : "/api/tracks";
  const response = await fetch(`${endpoint}/${id}/download`);
  if (!response.ok) {
    let message = "The track could not be downloaded.";
    try { message = (await response.json() as { error?: string }).error ?? message; } catch { /* use fallback */ }
    throw new Error(message);
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.replace(/[\\/:*?"<>|]/g, "_")}.trk`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
