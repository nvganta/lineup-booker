export type QlooEntity = {
  entity_id?: string;
  id?: string;
  name: string;
  type?: string;
  subtype?: string;
  popularity?: number;
  properties?: {
    description?: string;
    short_description?: string;
    image?: { url?: string };
    boundary?: string;
    discography?: unknown;
    albums?: unknown;
    album_count?: number;
    obscurity_scale?: number;
  };
  tags?: Array<{ id?: string; name?: string; type?: string }>;
  query?: {
    affinity?: number;
    affinity_rank?: number;
    explainability?: unknown;
  };
  disambiguation?: string;
};

export type QlooTag = {
  tag_id?: string;
  id?: string;
  name: string;
  type?: string;
  subtype?: string;
  types?: string[];
  tag_value?: string;
  popularity?: number;
};

export type QlooHeatmapPoint = {
  location?: {
    latitude?: number;
    longitude?: number;
    geohash?: string;
  };
  query?: {
    affinity?: number;
    affinity_rank?: number;
    popularity?: number;
  };
  name?: string;
  properties?: {
    name?: string;
    geocode?: { city?: string; neighborhood?: string };
  };
};

export type QlooInsightsResponse = {
  success?: boolean;
  results?: {
    entities?: QlooEntity[];
    heatmap?: QlooHeatmapPoint[];
    tags?: QlooTag[];
  };
  tags?: QlooTag[];
  query?: Record<string, unknown>;
  duration?: number;
};

export type QlooTagsResponse = {
  success?: boolean;
  results?: {
    tags?: QlooTag[];
  };
};

export type QlooSearchResponse = {
  results?: QlooEntity[];
};
