import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SourceKey = "tavily" | "topHubData" | "xiaohongshu" | "deepseek" | "openai";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    source?: SourceKey;
    apiKey?: string;
    sourceUrl?: string;
    queries?: string;
    tavilyKey?: string;
  };
  const source = body.source;
  const apiKey = body.apiKey?.trim();

  if (!source) {
    return NextResponse.json({ ok: false, message: "缺少数据源类型。" }, { status: 400 });
  }

  if (!apiKey && source !== "xiaohongshu") {
    return NextResponse.json({
      ok: false,
      mode: "demo",
      message: "未填写 API Key，系统会使用 demo/mock 模式。"
    });
  }

  try {
    const result = await testSource(source, apiKey ?? "", body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      mode: "error",
      message: error instanceof Error ? error.message : "测试连接失败。"
    });
  }
}

async function testSource(source: SourceKey, apiKey: string, body: { sourceUrl?: string; queries?: string; tavilyKey?: string }) {
  if (source === "tavily") {
    const response = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "World Cup", search_depth: "basic", max_results: 1 })
    });
    if (!response.ok) throw new Error(`Tavily 返回 ${response.status}`);
    return { ok: true, mode: "live", message: "Tavily 连接成功。" };
  }

  if (source === "topHubData") {
    const params = new URLSearchParams({ q: "世界杯", p: "1" });
    const response = await fetchWithTimeout(`https://api.tophubdata.com/search?${params.toString()}`, {
      headers: { Authorization: apiKey }
    });
    if (!response.ok) throw new Error(`榜眼数据返回 ${response.status}`);
    return { ok: true, mode: "live", message: "今日热榜 / 榜眼数据连接成功。" };
  }

  if (source === "xiaohongshu") {
    const sourceUrl = body.sourceUrl?.trim();
    if (sourceUrl) {
      const target = new URL(sourceUrl);
      if (!target.searchParams.has("limit")) target.searchParams.set("limit", "3");
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
        headers["X-API-Key"] = apiKey;
      }
      const response = await fetchWithTimeout(target.toString(), { headers });
      if (!response.ok) throw new Error(`小红书热点源返回 ${response.status}`);
      return { ok: true, mode: "live", message: "小红书自定义热点源连接成功。" };
    }

    const tavilyKey = body.tavilyKey?.trim() || apiKey;
    if (!tavilyKey) {
      return { ok: false, mode: "demo", message: "未填写小红书接口 URL，也没有 Tavily Key，系统会跳过小红书实时源。" };
    }
    const query = body.queries?.split(/\n|,/).map((item) => item.trim()).find(Boolean) || "site:xiaohongshu.com 世界杯 足球 热点";
    const response = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${tavilyKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, search_depth: "basic", max_results: 1 })
    });
    if (!response.ok) throw new Error(`Tavily 小红书搜索返回 ${response.status}`);
    return { ok: true, mode: "live", message: "小红书公开搜索可用。" };
  }

  if (source === "deepseek") {
    const response = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4
      })
    });
    if (!response.ok) throw new Error(`DeepSeek 返回 ${response.status}`);
    return { ok: true, mode: "live", message: "DeepSeek 连接成功。" };
  }

  const response = await fetchWithTimeout("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!response.ok) throw new Error(`OpenAI 返回 ${response.status}`);
  return { ok: true, mode: "live", message: "OpenAI 连接成功。" };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
