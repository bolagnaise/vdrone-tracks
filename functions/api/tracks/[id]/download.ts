import type { Env } from "../../../_lib";
import { json, parseTrackId } from "../../../_lib";
import { safeFilename } from "../../../../shared/sceneries";

// The www host reaches the same official API without Cloudflare-to-Cloudflare
// routing failures seen on the bare .co.uk hostname from Pages Functions.
const DOWNLOAD_URL = "https://www.velocidrone.com/api/download-file";

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = parseTrackId(String(params.id));
  if (id === null) return json({ error: "Invalid track ID" }, 400);
  const track = await env.DB.prepare("SELECT name, remote_path FROM tracks WHERE id = ? AND active = 1")
    .bind(id).first<{ name: string; remote_path: string | null }>();
  if (!track) return json({ error: "Track not found" }, 404);
  if (!track.remote_path) return json({ error: "This track uses an unknown scenery and cannot be downloaded yet" }, 409);

  let upstream: Response;
  try {
    upstream = await fetch(DOWNLOAD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "vdrone-tracks/1.0",
      },
      body: new URLSearchParams({ file_path: track.remote_path }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return json({ error: "VelociDrone did not respond. Try the download again." }, 502);
  }
  if (upstream.status === 404) return json({ error: "This historical track is no longer available from VelociDrone" }, 404);
  if (upstream.status === 429) return json({ error: "VelociDrone is rate limiting downloads. Try again shortly." }, 429);
  if (!upstream.ok || !upstream.body) return json({ error: "VelociDrone could not provide this track" }, 502);

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFilename(track.name)}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
