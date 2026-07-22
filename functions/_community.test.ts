import { describe, expect, it, vi } from "vitest";
import {
  COMMUNITY_SEARCH_PATH,
  apiKey,
  decodeTrackText,
  decryptText,
  encryptText,
  normalizedCommunityTrack,
  packageCommunityTrack,
  requestCommunityApi,
  trackFileKey,
  type CommunitySourceTrack,
} from "./_community";

const sourceTrack: CommunitySourceTrack = {
  id: 37452,
  scenery_id: 33,
  track_name: "Backyard+Rush",
  track_type: "Intermediate",
  playername: "Rotor%2BPilot",
  rating: "4.5",
  total_ratings: 4,
  date: "2026-07-21",
  track_data: encodeURIComponent(JSON.stringify({ gates: [{ x: 1, y: 2 }], title: "line\nbreak" })),
};

describe("community track protocol", () => {
  it("uses reversible AES envelopes for API payloads", () => {
    const plaintext = "track_name=Backyard+Rush&order_by_date=true";
    expect(decryptText(encryptText(plaintext, apiKey()), apiKey())).toBe(plaintext);
  });

  it("decodes raw and double-encoded spaces in track metadata", () => {
    expect(decodeTrackText("Backyard+Rush")).toBe("Backyard Rush");
    expect(decodeTrackText("Rotor%2BPilot")).toBe("Rotor Pilot");
  });

  it("normalizes search records into community tracks", () => {
    expect(normalizedCommunityTrack(sourceTrack)).toMatchObject({
      source: "community", id: 37452, name: "Backyard Rush", creator: "Rotor Pilot",
      sceneId: 33, sceneName: "DynamicWeather", type: 2, typeLabel: "Intermediate",
      rating: 4.5, ratingCount: 4,
    });
  });

  it("packages the five fields expected by current VelociDrone imports", () => {
    const packaged = packageCommunityTrack(sourceTrack);
    const [sceneId, name, data, type, onlineId] = decryptText(packaged.body, trackFileKey()).split("\n");
    expect([sceneId, name, type, onlineId]).toEqual(["33", "Backyard Rush", "2", "37452"]);
    expect(JSON.parse(data)).toEqual({ gates: [{ x: 1, y: 2 }], title: "line\nbreak" });
  });

  it("encrypts search fields and decrypts the upstream response", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      const fields = new URLSearchParams(decryptText(body.get("post_data") ?? "", apiKey()));
      expect(fields.get("track_name")).toBe("Backyard Rush");
      return new Response(encryptText(JSON.stringify({ success: true, user_tracks: [sourceTrack] }), apiKey()));
    }) as typeof fetch;
    const tracks = await requestCommunityApi(COMMUNITY_SEARCH_PATH, { track_name: "Backyard Rush" }, fetcher);
    expect(tracks).toEqual([sourceTrack]);
    expect(fetcher).toHaveBeenCalledWith("https://www.velocidrone.com/api/v1/private/user/rated_tracks_list", expect.objectContaining({ method: "POST" }));
  });

  it("rejects malformed track data instead of emitting an unusable file", () => {
    expect(() => packageCommunityTrack({ ...sourceTrack, track_data: "%7Bbad-json" })).toThrow(/track data/i);
  });

  it.skipIf(process.env.VDRONE_LIVE_TEST !== "1")("queries VelociDrone's live community directory", async () => {
    const tracks = await requestCommunityApi(COMMUNITY_SEARCH_PATH, {
      scenery_id: "", playername: "", track_name: "race", track_type: "",
      order_by_date: "true", order_by_rating: "false",
      show_beginner: "True", show_intermediate: "True", show_advanced: "True",
    });
    expect(tracks.length).toBeGreaterThan(0);
    expect(normalizedCommunityTrack(tracks[0])).not.toBeNull();
  });
});
