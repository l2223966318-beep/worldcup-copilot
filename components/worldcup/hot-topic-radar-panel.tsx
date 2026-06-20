"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Search } from "lucide-react";

import type { HotItem, HotSearchPayload, HotTopic } from "@/lib/hot/types";
import { HOT_RADAR_CACHE_KEY, type HotRadarCache } from "@/lib/hot/hotTopicWorkflow";
import { localizeTeamName } from "@/lib/services/footballNames";
import type { WorldCupMatch } from "@/lib/sports/types";
import type { SportTheme } from "@/lib/sport-theme";
import { formatBeijingDateTime } from "@/lib/time/beijingTime";

type HotTab = "全部" | "微博" | "B站" | "抖音" | "小红书" | "知乎" | "百度" | "头条";

const tabs: HotTab[] = ["全部", "微博", "B站", "抖音", "小红书", "知乎", "百度", "头条"];

export function HotTopicRadarPanel({
  theme,
  matches
}: {
  theme: SportTheme;
  matches: WorldCupMatch[];
}) {
  const router = useRouter();
  const allowMock = process.env.NEXT_PUBLIC_USE_MOCK === "true";
  const [topics, setTopics] = useState<HotTopic[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [sourceStatus, setSourceStatus] = useState<HotSearchPayload["sourceStatus"]>("fallback");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<HotTab>("全部");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = readCache();
    if (!cached) return;
    if (cached.sourceStatus === "fallback" && !allowMock) return;
    setTopics(cached.topics);
    setLastUpdatedAt(cached.lastUpdatedAt);
    setSourceStatus(cached.sourceStatus);
    setMessage(cached.message ?? "");
  }, [allowMock]);

  const rankedTopics = useMemo(() => {
    return topics
      .map((topic) => ({
        ...topic,
        relevanceScore: topic.relevanceScore ?? 0,
        relatedMatches: topic.relatedMatches?.length ? topic.relatedMatches : findRelatedMatches(topic, matches)
      }))
      .sort((a, b) => {
        return (b.valueScore ?? 0) - (a.valueScore ?? 0) || getTopicHeatScore(b) - getTopicHeatScore(a) || (a.rank ?? 999) - (b.rank ?? 999);
      });
  }, [topics, matches]);

  const filteredTopics = useMemo(() => rankedTopics.filter((topic) => filterByTab(topic, activeTab)), [activeTab, rankedTopics]);

  function openTopic(topic: HotTopic, mode: "analysis" | "generate" = "analysis") {
    const query = mode === "generate" ? "?mode=generate" : "";
    router.push(`/hot-topics/${encodeURIComponent(topic.id)}${query}`);
  }

  async function updateHotTopics() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/hot?source=all&scope=sports&limit=20", {
        cache: "no-store",
        headers: getStoredHotSourceHeaders()
      });
      const payload = (await response.json().catch(() => null)) as HotSearchPayload | null;
      if (!response.ok) throw new Error(payload?.message || `热点 API 请求失败：${response.status}`);
      if (!payload) throw new Error("热点 API 返回格式不可读取。");
      if (payload.sourceStatus === "error") throw new Error(payload.message || "热点 API 请求失败。");

      const nextTopics = normalizeHotTopics(payload.data, matches, payload.lastUpdated);
      if (!nextTopics.length) throw new Error(payload.message || "热点接口没有返回可展示数据。");

      const nextCache: HotRadarCache = {
        topics: nextTopics,
        lastUpdatedAt: payload.lastUpdated,
        sourceStatus: payload.sourceStatus,
        message: payload.message
      };
      writeCache(nextCache);
      setTopics(nextTopics);
      setLastUpdatedAt(payload.lastUpdated);
      setSourceStatus(payload.sourceStatus);
      setMessage(payload.message ?? "");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "热点更新失败。");
      setSourceStatus("error");
      setMessage("");
      if (!allowMock && sourceStatus === "fallback") {
        setTopics([]);
        setLastUpdatedAt("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-[32px] border bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)]" style={{ borderColor: theme.border }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black tracking-[0.18em] text-slate-400">热点雷达</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">今日热点雷达</h2>
          </div>
          <button
            type="button"
            onClick={updateHotTopics}
            disabled={loading}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: theme.primary, boxShadow: `0 14px 30px ${theme.heroGlow}` }}
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "更新中" : "更新热点"}
          </button>
        </div>

        <div className="mt-3 text-xs font-semibold text-slate-400">
          {sourceStatusLabel(sourceStatus)}
          {lastUpdatedAt ? ` · ${formatHotTime(lastUpdatedAt)}` : ""}
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {error}
            {topics.length ? " 已保留最近一次可用数据。" : ""}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ring-1 transition ${
                activeTab === tab ? "text-white shadow-sm" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
              }`}
              style={activeTab === tab ? { backgroundColor: theme.primary, boxShadow: `0 10px 24px ${theme.heroGlow}` } : undefined}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {filteredTopics.length ? (
            filteredTopics.slice(0, 12).map((topic, index) => {
              return (
                <article
                  key={topic.id}
                  onClick={() => openTopic(topic)}
                  className="block w-full cursor-pointer rounded-3xl border bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]"
                  style={{ borderColor: theme.border }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: theme.primary }}>
                      {topic.rank ?? index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      {topic.url ? (
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="line-clamp-2 text-base font-black leading-6 text-slate-950 transition hover:text-emerald-700"
                        >
                          {topic.title}
                        </a>
                      ) : (
                        <div className="line-clamp-2 text-base font-black leading-6 text-slate-950">{topic.title}</div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge>{topic.platform ?? "全网"}</Badge>
                        <Badge>{topic.source}</Badge>
                        {topic.category ? <Badge>{topic.category}</Badge> : null}
                        {topic.leverageValue ? <Badge strong={topic.leverageValue === "高价值"}>{topic.leverageValue}</Badge> : null}
                      </div>
                      <div className="mt-2 text-xs font-semibold" style={{ color: theme.secondary }}>
                        热度：{topic.heat ?? topic.relevanceScore ?? "-"}
                        {typeof topic.valueScore === "number" ? `｜价值分：${topic.valueScore}` : ""}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTopic(topic);
                          }}
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5"
                        >
                          查看详情
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTopic(topic, "generate");
                          }}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                          style={{ backgroundColor: theme.primary }}
                        >
                          生成选题
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
              <Search className="mx-auto h-7 w-7 text-slate-400" />
              <div className="mt-3 text-base font-semibold text-slate-950">暂无热点数据</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{emptyStateText(activeTab, message)}</p>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}

function Badge({ children, strong }: { children: string | number; strong?: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${strong ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-white text-slate-600 ring-slate-200"}`}>
      {children}
    </span>
  );
}

function readCache(): HotRadarCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HOT_RADAR_CACHE_KEY);
    return raw ? (JSON.parse(raw) as HotRadarCache) : null;
  } catch {
    return null;
  }
}

function writeCache(cache: HotRadarCache) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HOT_RADAR_CACHE_KEY, JSON.stringify(cache));
}

function getStoredHotSourceHeaders() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("worldcup.datasource.settings");
    const settings = raw ? (JSON.parse(raw) as { tavilyKey?: string; topHubDataKey?: string; xhsHotUrl?: string; xhsHotKey?: string; xhsHotQueries?: string }) : null;
    const headers: Record<string, string> = {};
    if (settings?.tavilyKey?.trim()) headers["x-worldcup-tavily-key"] = settings.tavilyKey.trim();
    if (settings?.topHubDataKey?.trim()) headers["x-worldcup-tophubdata-key"] = settings.topHubDataKey.trim();
    if (settings?.xhsHotUrl?.trim()) headers["x-worldcup-xhs-url"] = settings.xhsHotUrl.trim();
    if (settings?.xhsHotKey?.trim()) headers["x-worldcup-xhs-key"] = settings.xhsHotKey.trim();
    if (settings?.xhsHotQueries?.trim()) headers["x-worldcup-xhs-queries"] = encodeURIComponent(settings.xhsHotQueries.trim());
    return headers;
  } catch {
    return {};
  }
}

function normalizeHotTopics(items: HotItem[], matches: WorldCupMatch[], updatedAt: string): HotTopic[] {
  const seen = new Map<string, HotTopic>();

  for (const item of items) {
    const source = normalizeSource(item.source);
    const text = `${item.title} ${item.summary} ${(item.tags ?? []).join(" ")}`;
    const topic: HotTopic = {
      id: item.id,
      rank: item.rank,
      title: item.title,
      summary: item.summary,
      heat: item.heat ?? item.hot,
      platform: item.platform,
      source,
      category: item.category ?? classifyCategory(text),
      valueLevel: item.valueLevel,
      valueScore: item.valueScore,
      relevanceScore: item.relevance,
      leverageValue: classifyLeverage(item.valueLevel, item.valueScore, text, item.relevance),
      tags: Array.from(new Set([...(item.tags ?? []), ...buildTags(text)])),
      updatedAt: item.publishedAt ?? item.time ?? updatedAt,
      url: item.url,
      raw: item.raw,
      contentAngles: buildContentAngles(item.title, text),
      relatedMatches: findRelatedMatches({ title: item.title, summary: item.summary, tags: item.tags }, matches)
    };
    const key = item.url || normalizeText(item.title);
    const existing = seen.get(key);
    if (!existing || sourcePriority(topic.source) > sourcePriority(existing.source)) {
      seen.set(key, topic);
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => (b.valueScore ?? 0) - (a.valueScore ?? 0) || getTopicHeatScore(b) - getTopicHeatScore(a) || (a.rank ?? 999) - (b.rank ?? 999)
  );
}

function normalizeSource(source: string): HotTopic["source"] {
  if (/小红书公开搜索|小红书配置源/i.test(source)) return source;
  if (/微博|抖音|B站|哔哩|知乎|百度|头条|今日热榜|榜眼数据/i.test(source)) return "今日热榜";
  if (/tavily|全网搜索/i.test(source)) return "全网搜索";
  if (/fallback|ai|AI筛选|演示数据/i.test(source)) return "AI筛选";
  return "今日热榜";
}

function classifyCategory(text: string): HotTopic["category"] {
  if (/世界杯|World\s*Cup|FIFA/i.test(text)) return "世界杯";
  if (/足球|体育|比赛|球队|球员|进球|乌龙|VAR|裁判|soccer|football|match/i.test(text)) return "体育";
  if (/娱乐|明星|电影|音乐|综艺/i.test(text)) return "娱乐";
  if (/科技|AI|手机|芯片|互联网/i.test(text)) return "科技";
  if (/社会|通报|警方|城市|民生/i.test(text)) return "社会";
  return "泛热点";
}

function classifyLeverage(level?: HotTopic["valueLevel"], valueScore?: number, text?: string, score?: number): HotTopic["leverageValue"] {
  if (level === "high" || (valueScore ?? 0) >= 75) return "高价值";
  if (level === "medium" || (valueScore ?? 0) >= 50) return "可观察";
  if (!level && (/世界杯|足球|体育|进球|乌龙|球衣|VAR|裁判|伤退|球队|球员/i.test(text ?? "") || (score ?? 0) >= 75)) return "可观察";
  return "低优先级";
}

function buildTags(text: string) {
  const rules: Array<[RegExp, string]> = [
    [/世界杯|World\s*Cup/i, "世界杯"],
    [/足球|soccer|football/i, "足球"],
    [/乌龙|own\s*goal/i, "乌龙球"],
    [/球衣|衣服|shirt|jersey/i, "球员事件"],
    [/VAR|裁判|判罚/i, "争议判罚"],
    [/伤退|受伤|injury/i, "需核实"],
    [/日本|Japan/i, "日本队"],
    [/美国|USA|United\s*States/i, "美国队"]
  ];
  return rules.flatMap(([pattern, tag]) => (pattern.test(text) ? [tag] : []));
}

function buildContentAngles(title: string, text: string) {
  const angles = [
    `B站：从“${title}”切入，做成赛事情绪和数据复盘的开场钩子。`,
    `微博：把热点转成讨论问题，先讲事实，再问球迷怎么看。`,
    `小红书：做“看球新手也能懂”的卡片解释，降低理解门槛。`,
    `短视频：前三秒用热点画面或关键词抓注意力，随后回到比赛数据。`
  ];
  if (/VAR|裁判|判罚|伤退|黑哨|黑幕/i.test(text)) {
    angles.push("风险处理：避免定性，统一使用“引发讨论”“需核实”“建议补充来源”。");
  }
  return angles;
}

function findRelatedMatches(topic: Pick<HotTopic, "title" | "summary" | "tags">, matches: WorldCupMatch[]) {
  const text = normalizeText(`${topic.title} ${topic.summary ?? ""} ${(topic.tags ?? []).join(" ")}`);
  const related = matches.filter((match) => buildMatchKeywords(match).some((keyword) => text.includes(normalizeText(keyword))));
  return related.slice(0, 4).map((match) => `${localizeTeamName(match.homeTeam.name)} vs ${localizeTeamName(match.awayTeam.name)}`);
}

function buildMatchKeywords(match: WorldCupMatch) {
  return [
    match.homeTeam.name,
    match.awayTeam.name,
    localizeTeamName(match.homeTeam.name),
    localizeTeamName(match.awayTeam.name),
    match.venue.city ?? "",
    match.venue.name ?? "",
    "世界杯",
    "足球"
  ].filter(Boolean);
}

function filterByTab(topic: HotTopic, tab: HotTab) {
  if (tab === "全部") return true;
  const text = `${topic.source} ${topic.platform ?? ""}`.toLowerCase();
  const aliases: Record<Exclude<HotTab, "全部">, string[]> = {
    微博: ["微博", "weibo"],
    B站: ["b站", "bilibili", "哔哩"],
    抖音: ["抖音", "douyin"],
    小红书: ["小红书", "xiaohongshu", "xhs"],
    知乎: ["知乎", "zhihu"],
    百度: ["百度", "baidu"],
    头条: ["头条", "toutiao"]
  };
  return aliases[tab].some((keyword) => text.includes(keyword.toLowerCase()));
}

function emptyStateText(tab: HotTab, message: string) {
  if (tab === "B站") {
    return "当前 B站暂无可展示的赛事热点。";
  }
  if (tab === "小红书") {
    return "当前小红书暂无可展示的赛事热点。";
  }
  return message ? "当前暂无可展示的赛事热点。" : "点击更新热点获取最新内容。";
}

function formatHotTime(value: string) {
  return formatBeijingDateTime(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sourceStatusLabel(status: HotSearchPayload["sourceStatus"]) {
  const labels: Record<HotSearchPayload["sourceStatus"], string> = {
    live: "实时数据",
    partial: "部分可用",
    cache: "缓存数据",
    fallback: "演示数据",
    error: "请求失败"
  };
  return labels[status];
}

function sourcePriority(source: HotTopic["source"]) {
  if (source === "今日热榜") return 3;
  if (/小红书/.test(source)) return 2;
  if (source === "全网搜索") return 2;
  return 1;
}

function getTopicHeatScore(topic: Pick<HotTopic, "heat" | "relevanceScore" | "rank">) {
  if (typeof topic.heat === "number") return topic.heat;
  if (typeof topic.heat === "string") {
    const normalized = topic.heat.replace(/,/g, "").trim();
    const matched = normalized.match(/([\d.]+)/);
    if (matched) {
      const value = Number(matched[1]);
      if (Number.isFinite(value)) {
        if (normalized.includes("亿")) return value * 100_000_000;
        if (normalized.includes("万")) return value * 10_000;
        return value;
      }
    }
  }

  const relevance = topic.relevanceScore ?? 0;
  const rankBonus = topic.rank ? Math.max(0, 100 - topic.rank) : 0;
  return relevance * 100 + rankBonus;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
