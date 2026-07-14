export const SCENERIES: Readonly<Record<number, string>> = {
  1: "MainMenu", 2: "NetworkLobby", 3: "Hangar", 7: "Scene5", 8: "Scene6",
  12: "Countryside", 13: "FactoryNight", 14: "KartTrack", 15: "SubWay",
  16: "BlankCanvas", 17: "BlankCanvasNight", 18: "NEC_Birmingham",
  19: "Warehouse", 20: "CarPark", 21: "Gym", 22: "Coastal", 23: "River2",
  24: "City", 25: "redbull_ring", 26: "CarPark2", 27: "Front9",
  28: "VegetationStudio", 29: "Baseball", 30: "Bando", 31: "IndoorGoKart",
  32: "Slovenia", 33: "DynamicWeather", 34: "DR1Castles", 35: "Sneznik",
  36: "PolyWorld", 37: "Library", 38: "NightClub", 39: "House",
  40: "FutureHangar", 41: "Island", 42: "EmptyPoly", 43: "FutureHangarEmpty",
  44: "DynamicPoly", 45: "Gaiatest", 46: "CombatPractice", 47: "Warehouse2",
  48: "Drifting", 49: "RedValley", 50: "SportBar", 51: "MiniWarehouse",
  52: "Apartment", 53: "Office", 54: "OfficeComplex", 55: "NightFactory2",
  56: "Factory", 57: "TechFacility", 100: "PolyPort", 101: "PolyBando",
  102: "City2", 103: "AlpineLake", 104: "RomanCity", 105: "NightFactory3",
  106: "ChemicalPlant",
};

export function sceneName(sceneId: number): string {
  return SCENERIES[sceneId] ?? `Scene #${sceneId}`;
}

export function remoteTrackPath(sceneId: number, trackName: string): string | null {
  const scene = SCENERIES[sceneId];
  return scene ? `downloads/scenes/${scene}/official_tracks/${trackName}.trk` : null;
}

export function safeFilename(value: string): string {
  return (value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "").trim() || "track") + ".trk";
}
