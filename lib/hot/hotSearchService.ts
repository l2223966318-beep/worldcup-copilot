import { fetchDailyHotFeeds } from "./dailyHotClient";
import { mergeHotItems, normalizeDailyHotPayload, normalizeTavilyPayload, normalizeTopHubDataPayload } from "./normalizers";
import { fetchTavilySearch } from "./tavilyClient";
import { fetchTopHubDataSearch } from "./tophubDataClient";
import type { HotItem, HotSearchPayload, HotSourceStatus } from "./types";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; payload: HotSearchPayload }>();

type HotSearchOptions = {
  tavilyApiKey?: string;
  topHubDataApiKey?: string;
};

export async function searchHotSignals(query: string, options: HotSearchOptions = {}): Promise<HotSearchPayload> {
  const normalizedQuery = normalizeQuery(query);
  const cacheKey = buildCacheKey(normalizedQuery, options);
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return { ...cached.payload, sourceStatus: "cache" as HotSourceStatus };
  }

  const items: HotItem[] = [];
  const failures: string[] = [];
  let liveSourceCount = 0;

  const [topHubResult, tavilyResult, dailyHotResult] = await Promise.allSettled([
    fetchTopHubDataSearch(normalizedQuery, options.topHubDataApiKey),
    fetchTavilySearch(normalizedQuery, options.tavilyApiKey),
    fetchDailyHotFeeds()
  ]);

  if (topHubResult.status === "fulfilled" && topHubResult.value.ok) {
    const normalized = normalizeTopHubDataPayload(topHubResult.value.payload, { query: normalizedQuery });
    items.push(...normalized);
    liveSourceCount += normalized.length ? 1 : 0;
  } else {
    failures.push(readFailure(topHubResult, "榜眼数据未返回可用结果"));
  }

  if (tavilyResult.status === "fulfilled" && tavilyResult.value.ok) {
    const normalized = normalizeTavilyPayload(tavilyResult.value.payload, { query: normalizedQuery });
    items.push(...normalized);
    liveSourceCount += normalized.length ? 1 : 0;
  } else {
    failures.push(readFailure(tavilyResult, "Tavily 未返回可用结果"));
  }

  if (dailyHotResult.status === "fulfilled" && dailyHotResult.value.length) {
    for (const feed of dailyHotResult.value) {
      items.push(
        ...normalizeDailyHotPayload(feed.payload, {
          query: normalizedQuery,
          platform: dailyHotPlatformName(feed.platform),
          source: `dailyhot-${feed.platform}`
        })
      );
    }
    liveSourceCount += 1;
  } else {
    failures.push(readFailure(dailyHotResult, "今日热榜公共源未返回可用结果"));
  }

  const merged = mergeHotItems(items).slice(0, 18);
  const payload =
    merged.length > 0
      ? createPayload(liveSourceCount > 0 && failures.length > 0 ? "partial" : "live", merged, failures.join("；"))
      : createPayload("fallback", createFallbackHotItems(normalizedQuery), failures.join("；"));

  if (payload.sourceStatus === "live" || payload.sourceStatus === "partial") {
    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, payload });
  }

  return payload;
}

function buildCacheKey(query: string, options: HotSearchOptions) {
  const sourceKey = [
    options.tavilyApiKey ? "tavily:client" : "tavily:env",
    options.topHubDataApiKey ? "tophub:client" : "tophub:env"
  ].join("|");
  return `${query}::${sourceKey}`;
}

function createPayload(sourceStatus: HotSourceStatus, data: HotItem[], message?: string): HotSearchPayload {
  return {
    sourceStatus,
    data,
    lastUpdated: new Date().toISOString(),
    message: message || undefined
  };
}

function createFallbackHotItems(query: string): HotItem[] {
  const baseTags = query.includes("世界杯") ? ["世界杯"] : ["待配置"];
  return [
    {
      id: "hot-fallback-1",
      title: `${query} 相关热点待接入`,
      summary: "配置 TOPHUBDATA_API_KEY 或 TAVILY_API_KEY 后，这里会显示真实热榜和全网搜索结果。",
      url: "",
      source: "fallback",
      platform: "系统提示",
      relevance: 40,
      tags: baseTags
    },
    {
      id: "hot-fallback-2",
      title: "可纳入选题判断的场上事件",
      summary: "乌龙球、球衣被扯破、VAR 争议、伤退传闻等事件会被识别成热点信号，再进入选题引擎。",
      url: "",
      source: "fallback",
      platform: "示例逻辑",
      relevance: 35,
      tags: ["乌龙球", "球衣被扯破", "争议判罚"]
    }
  ];
}

function readFailure<T>(result: PromiseSettledResult<T>, fallback: string) {
  if (result.status === "fulfilled") {
    const value = result.value as { ok?: boolean; reason?: string };
    return value.reason ?? fallback;
  }
  return result.reason instanceof Error ? result.reason.message : fallback;
}

function normalizeQuery(query: string) {
  const value = query.trim().replace(/\s+/g, " ");
  return value || "世界杯 足球 今日热点";
}

function dailyHotPlatformName(platform: string) {
  const labels: Record<string, string> = {
    weibo: "微博",
    douyin: "抖音",
    bilibili: "B站",
    baidu: "百度",
    zhihu: "知乎",
    hupu: "虎扑"
  };
  return labels[platform] ?? platform;
}
