export type TrackSource = "official" | "community";

interface TrackBase {
  id: number;
  name: string;
  sceneId: number;
  sceneName: string;
  publishedAt: string;
  type: number;
  rating: number;
  ratingCount: number;
  downloadAvailable: boolean;
}

export interface OfficialTrack extends TrackBase {
  source: "official";
  version: number;
}

export interface CommunityTrack extends TrackBase {
  source: "community";
  creator: string;
  typeLabel: string;
}

export type Track = OfficialTrack | CommunityTrack;

export interface Facets {
  sceneries: Array<{ id?: number; name: string; count: number }>;
  types: Array<{ type: number; count: number }>;
}

export interface TrackListResponse {
  tracks: Track[];
  facets: Facets;
  page: number;
  limit: number;
  total: number;
  pages: number;
  lastSyncAt: string | null;
  resultLimitReached?: boolean;
}
