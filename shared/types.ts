export interface Track {
  id: number;
  name: string;
  sceneId: number;
  sceneName: string;
  version: number;
  publishedAt: string;
  type: number;
  rating: number;
  ratingCount: number;
  downloadAvailable: boolean;
}

export interface Facets {
  sceneries: Array<{ name: string; count: number }>;
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
}
