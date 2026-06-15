export type HotSourceStatus = "live" | "fallback" | "partial" | "cache" | "error";

export type HotItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  platform: string;
  rank?: number;
  heat?: string;
  publishedAt?: string;
  relevance: number;
  tags: string[];
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
  source: "今日热榜" | "Tavily" | "AI筛选";
  category?: "世界杯" | "体育" | "娱乐" | "社会" | "科技" | "泛热点";
  relevanceScore?: number;
  leverageValue?: "高价值" | "可尝试" | "低相关";
  tags?: string[];
  updatedAt?: string;
  url?: string;
  contentAngles?: string[];
  relatedMatches?: string[];
};
