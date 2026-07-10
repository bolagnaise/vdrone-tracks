import type { TrackListResponse } from "../shared/types";

export async function fetchTracks(params: URLSearchParams, signal?: AbortSignal): Promise<TrackListResponse> {
  const response = await fetch(`/api/tracks?${params}`, { signal });
  if (!response.ok) throw new Error("The track board could not be loaded.");
  return response.json() as Promise<TrackListResponse>;
}

export async function downloadTrack(id: number, name: string): Promise<void> {
  const response = await fetch(`/api/tracks/${id}/download`);
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
