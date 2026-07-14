import { describe, expect, it } from "vitest";
import { remoteTrackPath, safeFilename, sceneName } from "./sceneries";

describe("track paths", () => {
  it("uses client scenery names", () => expect(remoteTrackPath(33, "Race 1")).toBe("downloads/scenes/DynamicWeather/official_tracks/Race 1.trk"));
  it("maps Chemical Plant tracks", () => expect(remoteTrackPath(106, "Freestyle")).toBe("downloads/scenes/ChemicalPlant/official_tracks/Freestyle.trk"));
  it("does not build unknown paths", () => expect(remoteTrackPath(999, "Race 1")).toBeNull());
  it("sanitizes download names", () => expect(safeFilename('A/B: "C"')).toBe("A_B_ _C_.trk"));
  it("labels unknown scenes", () => expect(sceneName(999)).toBe("Scene #999"));
});
