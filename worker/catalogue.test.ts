import { createCipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import { catalogueKey, decryptCatalogue, normalizedTrack, validateTracks } from "./catalogue";

function encrypt(value: unknown): string {
  const cipher = createCipheriv("aes-128-ecb", catalogueKey(), Buffer.alloc(0));
  return Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]).toString("base64");
}

const track = { track_name: "Test Line", track_id: 42, scene_id: 12, ver: 3, date: "2026-07-10 00:00:00", type: 2, rating: 4.5, count: 8 };

describe("catalogue protocol", () => {
  it("derives the key used by the client", () => expect(catalogueKey().toString()).toBe("BatCaveGGevaCtaB"));
  it("decrypts and validates a catalogue", () => expect(decryptCatalogue(encrypt({ success: true, tracks: [track] })).tracks[0].track_id).toBe(42));
  it("rejects duplicate IDs", () => expect(() => validateTracks([track, track])).toThrow(/Duplicate/));
  it("rejects malformed records", () => expect(() => validateTracks([{ ...track, track_name: "" }])).toThrow(/Invalid/));
  it("maps known scenery and trusted path", () => expect(normalizedTrack(track, "now")).toMatchObject({ sceneName: "Countryside", remotePath: "downloads/scenes/Countryside/official_tracks/Test Line.trk" }));
  it("maps the Chemical Plant scenery", () => expect(normalizedTrack({ ...track, scene_id: 106 }, "now")).toMatchObject({ sceneName: "ChemicalPlant", remotePath: "downloads/scenes/ChemicalPlant/official_tracks/Test Line.trk" }));
  it("leaves unknown scenery unavailable", () => expect(normalizedTrack({ ...track, scene_id: 999 }, "now")).toMatchObject({ sceneName: "Scene #999", remotePath: null }));
});
