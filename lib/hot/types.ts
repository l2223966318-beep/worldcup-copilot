export type HotSourceStatus = "live" | "fallback" | "partial" | "cache" | "error";

export type HotCategory = "世界杯" | "体育" | "娱乐" | "社会" | "科技" | "泛热点";

export type HotValueLevel = "high" | "medium" | "low";

export type HotItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  platform: string;
  category?: HotCategory;
  rank?: number;
  heat?: string | number;
  hot?: string | number;
  valueLevel?: HotValueLevel;
  valueScore?: number;
  publishedAt?: string;
  time?: string;
  relevance: number;
  tags: string[];
  raw?: unknown;
};

export type HotSearchPayload = {
  sourceStatus: HotSourceStatus;
  data: HotItem[];
  lastUpdated: string;
  message?: string;
};

export type HotSearchContext = {
  query: string;
  source?: string;
  platform?: string;
};

export type HotTopic = {
  id: string;
  rank?: number;
  title: string;
  summary?: string;
  heat?: string | number;
  platform?: string;
  source: string;
  category?: HotCategory;
  valueLevel?: HotValueLevel;
  valueScore?: number;
  relevanceScore?: number;
  leverageValue?: "高价值" | "可观察" | "低优先级";
  tags?: string[];
  updatedAt?: string;
  url?: string;
  contentAngles?: string[];
  relatedMatches?: string[];
  raw?: unknown;
};
