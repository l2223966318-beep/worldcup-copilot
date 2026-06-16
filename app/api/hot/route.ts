import { NextResponse } from "next/server";

import type { HotItem, HotSearchPayload } from "@/lib/hot/types";
import { scoreHotItem } from "@/lib/hot/valueScoring";
import { fetchXiaohongshuHotItems } from "@/lib/hot/xiaohongshuClient";

export const dynamic = "force-dynamic";

type UnknownRecord = Record<string, unknown>;
type HotFetchResult = { items: HotItem[]; message?: string };

const DEFAULT_HOT_TYPES = ["weibo", "douyin", "bilibili", "zhihu", "baidu", "toutiao", "xiaohongshu"] as const;
const HOT_TYPE_MAP: Record<string, string> = {
  all: "all",
  weibo: "weibo",
  douyin: "douyin",
  bilibili: "bilibili",
  bsite: "bilibili",
  xiaohongshu: "xiaohongshu",
  xhs: "xiaohongshu",
  zhihu: "zhihu",
  baidu: "baidu",
  toutiao: "toutiao"
};

const MESSAGE = {
  mockUnconfigured: "\u70ed\u70b9 API \u672a\u914d\u7f6e\uff0c\u5f53\u524d\u4f7f\u7528\u6f14\u793a\u6570\u636e\u3002",
  unconfigured:
    "\u70ed\u70b9 API \u672a\u914d\u7f6e\u3002\u8bf7\u914d\u7f6e UAPIPRO_BASE_URL\u3001UAPIPRO_HOT_ENDPOINT\u3002",
  failedStatus: "\u70ed\u70b9 API \u8bf7\u6c42\u5931\u8d25\uff0c\u72b6\u6001\u7801",
  empty: "\u70ed\u70b9 API \u6682\u65e0\u53ef\u5c55\u793a\u6570\u636e\u3002",
  mockFailed: "\u70ed\u70b9 API \u8bf7\u6c42\u5931\u8d25\uff0c\u5f53\u524d\u4f7f\u7528\u6f14\u793a\u6570\u636e\u3002",
  failed:
    "\u70ed\u70b9 API \u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u63a5\u53e3\u5730\u5740\u3001\u5bc6\u94a5\u6216\u7f51\u7edc\u72b6\u6001\u3002",
  noSports:
    "\u5df2\u83b7\u53d6\u70ed\u699c\u6570\u636e\uff0c\u4f46\u6682\u672a\u5339\u914d\u5230\u4e16\u754c\u676f\u3001\u8db3\u7403\u6216\u4f53\u80b2\u76f8\u5173\u70ed\u70b9\u3002",
  xhsNotConfigured: "\u6682\u672a\u914d\u7f6e\u5c0f\u7ea2\u4e66\u70ed\u70b9\u6e90\u3002",
  realTag: "\u771f\u5b9e\u70ed\u70b9",
  sportsTag: "\u4f53\u80b2\u76f8\u5173",
  demoData: "\u6f14\u793a\u6570\u636e",
  demoTitle: "\u4e16\u754c\u676f\u8d5b\u540e\u70ed\u70b9\u6837\u4f8b\uff1a\u4e4c\u9f99\u7403\u5f15\u53d1\u8ba8\u8bba",
  demoSummary: "\u8fd9\u662f\u6f14\u793a\u6570\u636e\uff0c\u4ec5\u7528\u4e8e\u672c\u5730\u529f\u80fd\u94fe\u8def\u6f14\u793a\u3002",
  unknownSource: "\u672a\u77e5\u6765\u6e90"
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "all";
  const scope = searchParams.get("scope") || "sports";
  const limit = clampLimit(searchParams.get("limit"));
  const requestLimit = scope === "all" ? limit : Math.min(50, Math.max(limit * 3, 30));
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

  const apiKey = process.env.UAPIPRO_API_KEY?.trim();
  const baseUrl = process.env.UAPIPRO_BASE_URL?.trim();
  const endpoint = process.env.UAPIPRO_HOT_ENDPOINT?.trim();

  if (!baseUrl || !endpoint) {
    if (useMock) {
      return NextResponse.json(createPayload("fallback", createMockItems(limit), MESSAGE.mockUnconfigured));
    }
    return NextResponse.json(createPayload("error", [], MESSAGE.unconfigured), { status: 503 });
  }

  try {
    const hotTypes = getRequestedTypes(source);
    const settled = await Promise.allSettled(
      hotTypes.map((type) =>
        type === "xiaohongshu"
          ? fetchXiaohongshuHotItems(requestLimit)
          : fetchUApiHotItems({ apiKey, baseUrl, endpoint, type, limit: requestLimit }).then((items): HotFetchResult => ({ items }))
      )
    );
    const failures = settled.filter((result) => result.status === "rejected");
    const messages = settled.flatMap((result) => (result.status === "fulfilled" && result.value.message ? [result.value.message] : []));
    const items = settled
      .flatMap((result) => (result.status === "fulfilled" ? result.value.items : []))
      .filter((item) => item.title)
      .filter((item) => source === "all" || matchSource(item, source))
      .map(enrichValueScore)
      .filter((item) => scope === "all" || isSportsRelated(item))
      .filter(dedupeByTitle)
      .sort(sortByValue)
      .slice(0, limit);

    if (!items.length && failures.length) {
      return NextResponse.json(createPayload("error", [], MESSAGE.failed), { status: 502 });
    }

    const message = items.length ? messages.join(" ") : messages.join(" ") || (scope === "all" ? MESSAGE.empty : MESSAGE.noSports);
    return NextResponse.json(createPayload("live", items, message));
  } catch (error) {
    console.error("[hot-api] UApiPro request exception", { error: error instanceof Error ? error.message : String(error) });
    if (useMock) {
      return NextResponse.json(createPayload("fallback", createMockItems(limit), MESSAGE.mockFailed));
    }
    return NextResponse.json(createPayload("error", [], MESSAGE.failed), { status: 502 });
  }
}

async function fetchUApiHotItems({
  apiKey,
  baseUrl,
  endpoint,
  type,
  limit
}: {
  apiKey?: string;
  baseUrl: string;
  endpoint: string;
  type: string;
  limit: number;
}) {
  const url = buildUApiUrl(baseUrl, endpoint, type, limit);
  const response = await fetch(url, {
    cache: "no-store",
    headers: buildUApiHeaders(apiKey)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[hot-api] UApiPro request failed", {
      type,
      status: response.status,
      error: errorText.slice(0, 500)
    });
    throw new Error(`${MESSAGE.failedStatus} ${response.status}`);
  }

  const raw = await response.json();
  return extractHotArray(raw).map((item, index) => normalizeUApiHotItem(item, index, getPayloadType(raw) || type));
}

function buildUApiHeaders(apiKey?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-Key"] = apiKey;
    headers["x-api-key"] = apiKey;
  }
  return headers;
}

function buildUApiUrl(baseUrl: string, endpoint: string, type: string, limit: number) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = endpoint.startsWith("http") ? new URL(endpoint) : new URL(endpoint.replace(/^\//, ""), normalizedBase);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", String(limit));
  return url;
}

function extractHotArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  const data = root.data;
  const result = root.result;

  if (Array.isArray(data)) return data;
  if (Array.isArray(result)) return result;

  const dataRecord = asRecord(data);
  if (Array.isArray(dataRecord.list)) return dataRecord.list;
  if (Array.isArray(dataRecord.items)) return dataRecord.items;
  if (Array.isArray(dataRecord.data)) return dataRecord.data;

  const resultRecord = asRecord(result);
  if (Array.isArray(resultRecord.list)) return resultRecord.list;
  if (Array.isArray(resultRecord.items)) return resultRecord.items;
  if (Array.isArray(resultRecord.data)) return resultRecord.data;
  if (Array.isArray(root.list)) return root.list;
  if (Array.isArray(root.items)) return root.items;

  return [];
}

function getPayloadType(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const result = asRecord(root.result);
  return (
    pickString(root, ["type", "source", "platform"]) ||
    pickString(data, ["type", "source", "platform"]) ||
    pickString(result, ["type", "source", "platform"])
  );
}

function normalizeUApiHotItem(value: unknown, index: number, payloadType?: string): HotItem {
  const item = asRecord(value);
  const nested = asRecord(item.item) || asRecord(item.node) || {};
  const title =
    pickString(item, ["title", "name", "word", "keyword", "query"]) ||
    pickString(nested, ["title", "name", "word", "keyword"]);
  const url =
    pickString(item, ["url", "link", "href", "mobileUrl", "shareUrl"]) ||
    pickString(nested, ["url", "link", "href", "mobileUrl"]);
  const source =
    pickString(item, ["source", "platform", "sourceName", "site", "channel"]) ||
    pickString(nested, ["source", "platform", "sourceName"]) ||
    payloadType ||
    "UApiPro";
  const hot =
    pickValue(item, ["hot", "heat", "hot_value", "hotValue", "index", "score", "views", "readCount"]) ??
    pickValue(nested, ["hot", "heat", "hot_value", "hotValue", "index", "score", "views"]);
  const summary =
    pickString(item, ["summary", "desc", "description", "content", "abstract"]) ||
    pickString(nested, ["summary", "desc", "description"]) ||
    title;
  const time =
    pickString(item, ["time", "datetime", "createdAt", "publishedAt", "updateTime"]) ||
    pickString(nested, ["time", "datetime", "createdAt", "publishedAt"]);
  const rank = numberValue(item.rank) ?? numberValue(item.index) ?? index + 1;

  return {
    id: pickString(item, ["id", "hashid", "key"]) || stableId(`${source}:${url || title || index}`),
    title,
    summary,
    url,
    source: normalizeSourceName(source),
    platform: normalizeSourceName(source),
    rank,
    heat: normalizeHotValue(hot),
    hot: normalizeHotValue(hot),
    publishedAt: time,
    time,
    relevance: scoreByRank(rank, hot),
    tags: [MESSAGE.realTag],
    raw: value
  };
}

function createPayload(sourceStatus: HotSearchPayload["sourceStatus"], data: HotItem[], message?: string): HotSearchPayload {
  return {
    sourceStatus,
    data,
    lastUpdated: new Date().toISOString(),
    message
  };
}

function createMockItems(limit: number): HotItem[] {
  return [
    {
      id: "mock-hot-1",
      title: MESSAGE.demoTitle,
      summary: MESSAGE.demoSummary,
      url: "",
      source: MESSAGE.demoData,
      platform: MESSAGE.demoData,
      rank: 1,
      heat: "\u6f14\u793a\u70ed\u5ea6",
      hot: "\u6f14\u793a\u70ed\u5ea6",
      publishedAt: new Date().toISOString(),
      time: new Date().toISOString(),
      relevance: 60,
      tags: [MESSAGE.demoData]
    }
  ].slice(0, limit);
}

function matchSource(item: HotItem, source: string) {
  const text = `${item.source} ${item.platform}`.toLowerCase();
  const sourceMap: Record<string, string[]> = {
    weibo: ["\u5fae\u535a", "weibo"],
    bilibili: ["b\u7ad9", "bilibili", "\u54d4\u54e9"],
    douyin: ["\u6296\u97f3", "douyin"],
    xiaohongshu: ["\u5c0f\u7ea2\u4e66", "xiaohongshu", "xhs"],
    zhihu: ["\u77e5\u4e4e", "zhihu"],
    baidu: ["\u767e\u5ea6", "baidu"],
    toutiao: ["\u5934\u6761", "toutiao"]
  };
  return (sourceMap[source] ?? [source]).some((keyword) => text.includes(keyword.toLowerCase()));
}

function getRequestedTypes(source: string) {
  const normalized = HOT_TYPE_MAP[source] ?? source;
  return normalized === "all" ? [...DEFAULT_HOT_TYPES] : [normalized];
}

function dedupeByTitle(item: HotItem, index: number, items: HotItem[]) {
  const current = normalizeComparableText(item.title);
  return items.findIndex((candidate) => normalizeComparableText(candidate.title) === current) === index;
}

function enrichValueScore(item: HotItem): HotItem {
  const scoring = scoreHotItem(item);
  return {
    ...item,
    category: scoring.category,
    valueLevel: scoring.valueLevel,
    valueScore: scoring.valueScore,
    relevance: scoring.relevanceScore,
    tags: Array.from(new Set([...(item.tags ?? []), ...scoring.tags, MESSAGE.sportsTag]))
  };
}

function isSportsRelated(item: HotItem) {
  return (item.relevance ?? 0) >= 12;
}

function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

function sortByValue(a: HotItem, b: HotItem) {
  const valueDiff = (b.valueScore ?? 0) - (a.valueScore ?? 0);
  if (valueDiff !== 0) return valueDiff;
  const heatDiff = numericHeat(b.heat ?? b.hot) - numericHeat(a.heat ?? a.hot);
  if (heatDiff !== 0) return heatDiff;
  return (a.rank ?? 999) - (b.rank ?? 999);
}

function numericHeat(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeSourceName(source: string) {
  if (/weibo|\u5fae\u535a/i.test(source)) return "\u5fae\u535a";
  if (/bilibili|\u54d4\u54e9|b\u7ad9/i.test(source)) return "B\u7ad9";
  if (/douyin|\u6296\u97f3/i.test(source)) return "\u6296\u97f3";
  if (/xiaohongshu|xhs|\u5c0f\u7ea2\u4e66/i.test(source)) return "\u5c0f\u7ea2\u4e66";
  if (/zhihu|\u77e5\u4e4e/i.test(source)) return "\u77e5\u4e4e";
  if (/baidu|\u767e\u5ea6/i.test(source)) return "\u767e\u5ea6";
  if (/toutiao|\u5934\u6761/i.test(source)) return "\u5934\u6761";
  return source || MESSAGE.unknownSource;
}

function clampLimit(value: string | null) {
  const parsed = Number(value ?? 20);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(50, Math.max(1, Math.round(parsed)));
}

function scoreByRank(rank: number, hot: unknown) {
  const heatBonus = hot ? 8 : 0;
  return Math.min(100, Math.max(1, 96 - (rank - 1) * 4 + heatBonus));
}

function normalizeHotValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function pickString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickValue(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `uapipro-hot-${Math.abs(hash)}`;
}
