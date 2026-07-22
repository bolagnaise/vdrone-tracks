import { COMMUNITY_TRACK_PATH, packageCommunityTrack, requestCommunityApi } from "../../../_community";
import { json, parseTrackId } from "../../../_lib";
import { safeFilename } from "../../../../shared/sceneries";

export const onRequestGet: PagesFunction = async ({ params }) => {
  const id = parseTrackId(String(params.id));
  if (id === null) return json({ error: "Invalid community track ID" }, 400);
  try {
    const tracks = await requestCommunityApi(COMMUNITY_TRACK_PATH, { track_id: String(id) });
    const source = tracks.find((track) => Number(track.id) === id);
    if (!source) return json({ error: "Community track not found" }, 404);
    const packaged = packageCommunityTrack(source);
    return new Response(packaged.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename(packaged.filename)}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Community track download failed", error);
    return json({ error: "VelociDrone could not provide this community track. Try again shortly." }, 502);
  }
};
