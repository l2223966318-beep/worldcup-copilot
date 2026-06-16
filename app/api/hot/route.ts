import { NextResponse } from "next/server";

import type { HotItem, HotSearchPayload } from "@/lib/hot/types";

export const dynamic = "force-dynamic";

type UnknownRecord = Record<string, unknown>;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "all";
  const limit = clampLimit(searchParams.get("limit"));
  const useMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";

  const apiKey = process.env.UAPIPRO_API_KEY?.trim();
  const baseUrl = process.env.UAPIPRO_BASE_URL?.trim();
  const endpoint = process.env.UAPIPRO_HOT_ENDPOINT?.trim();

  if (!apiKey || !baseUrl || !endpoint) {
    if (useMock) {
      return NextResponse.json(createPayload("fallback", createMockItems(limit), "热点接口未配置，当前使用演示数据。"));
    }
    return NextResponse.json(createPayload("error", [], "热点 API 未配置。请配置 UAPIPRO_API_KEY、UAPIPRO_BASE_URL、UAPIPRO_HOT_ENDPOINT。"), { status: 503 });
  }

  try {
    const url = buildUApiUrl(baseUrl, endpoint, source, limit);
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[hot-api] UApiPro 请求失败", { status: response.status, error: errorText.slice(0, 500) });
      return NextResponse.json(createPayload("error", [], `热点 API 请求失败，状态码 ${response.status}。`), { status: 502 });
    }

    const raw = await response.json();
    const items = extractHotArray(raw)
      .map((item, index) => normalizeUApiHotItem(item, index))
      .filter((item) => item.title)
      .filter((item) => source === "all" || matchSource(item, source))
      .slice(0, limit);

    return NextResponse.json(createPayload("live", items, items.length ? undefined : "热点 API 暂无可展示数据。"));
  } catch (error) {
    console.error("[hot-api] UApiPro 请求异常", { error: error instanceof Error ? error.message : String(error) });
    if (useMock) {
      return NextResponse.json(createPayload("fallback", createMockItems(limit), "热点 API 请求失败，当前使用演示数据。"));
    }
    return NextResponse.json(createPayload("error", [], "热点 API 请求失败，请检查接口地址、密钥或网络状态。"), { status: 502 });
  }
}

function buildUApiUrl(baseUrl: string, endpoint: string, source: string, limit: number) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = endpoint.startsWith("http") ? new URL(endpoint) : new URL(endpoint.replace(/^\//, ""), normalizedBase);
  url.searchParams.set("limit", String(limit));
  if (source !== "all") url.searchParams.set("source", source);
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

  return [];
}

function normalizeUApiHotItem(value: unknown, index: number): HotItem {
  const item = asRecord(value);
  const nested = asRecord(item.item) || asRecord(item.node) || {};
  const title = pickString(item, ["title", "name", "word", "keyword", "query"]) || pickString(nested, ["title", "name", "word", "keyword"]);
  const url = pickString(item, ["url", "link", "href", "mobileUrl", "shareUrl"]) || pickString(nested, ["url", "link", "href", "mobileUrl"]);
  const source = pickString(item, ["source", "platform", "sourceName", "site", "channel"]) || pickString(nested, ["source", "platform", "sourceName"]) || "UApiPro";
  const hot = pickValue(item, ["hot", "heat", "index", "score", "views", "readCount"]) ?? pickValue(nested, ["hot", "heat", "index", "score", "views"]);
  const summary = pickString(item, ["summary", "desc", "description", "content", "abstract"]) || pickString(nested, ["summary", "desc", "description"]) || title;
  const time = pickString(item, ["time", "datetime", "createdAt", "publishedAt", "updateTime"]) || pickString(nested, ["time", "datetime", "createdAt", "publishedAt"]);
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
    tags: ["真实热点"]
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
      title: "世界杯赛后热点样例：乌龙球引发讨论",
      summary: "这是演示数据，仅用于本地功能链路演示。",
      url: "",
      source: "演示数据",
      platform: "演示数据",
      rank: 1,
      heat: "演示热度",
      hot: "演示热度",
      publishedAt: new Date().toISOString(),
      time: new Date().toISOString(),
      relevance: 60,
      tags: ["演示数据"]
    }
  ].slice(0, limit);
}

function matchSource(item: HotItem, source: string) {
  const text = `${item.source} ${item.platform}`.toLowerCase();
  const sourceMap: Record<string, string[]> = {
    weibo: ["微博", "weibo"],
    bilibili: ["b站", "bilibili", "哔哩"],
    douyin: ["抖音", "douyin"],
    zhihu: ["知乎", "zhihu"],
    baidu: ["百度", "baidu"],
    toutiao: ["头条", "toutiao"]
  };
  return (sourceMap[source] ?? [source]).some((keyword) => text.includes(keyword.toLowerCase()));
}

function normalizeSourceName(source: string) {
  if (/weibo|微博/i.test(source)) return "微博";
  if (/bilibili|哔哩|b站/i.test(source)) return "B站";
  if (/douyin|抖音/i.test(source)) return "抖音";
  if (/zhihu|知乎/i.test(source)) return "知乎";
  if (/baidu|百度/i.test(source)) return "百度";
  if (/toutiao|头条/i.test(source)) return "头条";
  return source || "未知来源";
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
