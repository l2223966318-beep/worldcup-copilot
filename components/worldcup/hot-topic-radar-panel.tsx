"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Search, Sparkles } from "lucide-react";

import type { HotItem, HotSearchPayload, HotTopic } from "@/lib/hot/types";
import { cleanList, qualityControl } from "@/lib/ai/quality";
import { localizeTeamName } from "@/lib/services/footballNames";
import type { WorldCupMatch } from "@/lib/sports/types";
import type { SportTheme } from "@/lib/sport-theme";
import { formatBeijingDateTime } from "@/lib/time/beijingTime";

type HotTab = "全部" | "体育相关" | "世界杯相关" | "可借势" | "高价值";

type HotRadarCache = {
  topics: HotTopic[];
  lastUpdatedAt: string;
  sourceStatus: HotSearchPayload["sourceStatus"];
  message?: string;
};

type GeneratedHotPackage = {
  bilibili: string[];
  weibo: string[];
  xiaohongshu: string[];
  shortVideo: string[];
  risk: string[];
};

const CACHE_KEY = "worldcup.hot-topic-radar.cache.v1";
const tabs: HotTab[] = ["全部", "体育相关", "世界杯相关", "可借势", "高价值"];

export function HotTopicRadarPanel({
  theme,
  matches,
  highlightedMatch
}: {
  theme: SportTheme;
  matches: WorldCupMatch[];
  highlightedMatch?: WorldCupMatch | null;
}) {
  const [topics, setTopics] = useState<HotTopic[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");
  const [sourceStatus, setSourceStatus] = useState<HotSearchPayload["sourceStatus"]>("fallback");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<HotTab>("全部");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [generatedTopicId, setGeneratedTopicId] = useState("");
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = readCache();
    if (!cached) return;
    setTopics(cached.topics);
    setLastUpdatedAt(cached.lastUpdatedAt);
    setSourceStatus(cached.sourceStatus);
    setMessage(cached.message ?? "");
    setSelectedTopicId(cached.topics[0]?.id ?? "");
  }, []);

  const highlightedKeywords = useMemo(() => {
    if (!highlightedMatch) return [];
    return buildMatchKeywords(highlightedMatch);
  }, [highlightedMatch]);

  const rankedTopics = useMemo(() => {
    return topics
      .map((topic) => ({
        ...topic,
        relevanceScore: topic.relevanceScore ?? 0,
        relatedMatches: topic.relatedMatches?.length ? topic.relatedMatches : findRelatedMatches(topic, matches)
      }))
      .sort((a, b) => {
        const highlightA = isTopicHighlighted(a, highlightedKeywords) ? 1 : 0;
        const highlightB = isTopicHighlighted(b, highlightedKeywords) ? 1 : 0;
        return highlightB - highlightA || sourcePriority(b.source) - sourcePriority(a.source) || (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0);
      });
  }, [topics, matches, highlightedKeywords]);

  const filteredTopics = useMemo(() => rankedTopics.filter((topic) => filterByTab(topic, activeTab)), [activeTab, rankedTopics]);
  const selectedTopic = filteredTopics.find((topic) => topic.id === selectedTopicId) ?? filteredTopics[0] ?? rankedTopics[0];
  const generatedPackage = selectedTopic && generatedTopicId === selectedTopic.id ? generateHotTopicPackage(selectedTopic, highlightedMatch ?? matches[0]) : null;

  async function updateHotTopics() {
    setLoading(true);
    setError("");

    try {
      const query = buildUpdateQuery(highlightedMatch);
      const response = await fetch(`/api/hot/search?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
        headers: readHotSourceHeaders()
      });
      if (!response.ok) throw new Error(`热点接口请求失败：${response.status}`);

      const payload = (await response.json()) as HotSearchPayload;
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
      setSelectedTopicId(nextTopics[0]?.id ?? "");
      setGeneratedTopicId("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "热点更新失败。");
    } finally {
      setLoading(false);
    }
  }

  async function copyGenerated(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  }

  return (
    <aside className="lg:sticky lg:top-24">
      <div className="rounded-[32px] border bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)]" style={{ borderColor: theme.border }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">HOT RADAR</div>
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

        <div className="mt-4 rounded-2xl p-4 text-xs leading-6" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
          <div className="font-semibold text-slate-800">数据源状态</div>
          <div>今日热榜：主数据源</div>
          <div>Tavily：补充数据源，不覆盖今日热榜</div>
          <div>AI筛选：分类、标签和借势价值加工层</div>
          <div className="mt-2 font-semibold">
            状态：{sourceStatusLabel(sourceStatus)}
            {lastUpdatedAt ? ` · 更新时间：${formatHotTime(lastUpdatedAt)}` : " · 暂无缓存"}
          </div>
        </div>

        {highlightedMatch ? (
          <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold leading-5 text-emerald-800">
            已根据左侧赛事高亮：{localizeTeamName(highlightedMatch.homeTeam.name)} vs {localizeTeamName(highlightedMatch.awayTeam.name)}
          </div>
        ) : null}

        {message ? <div className="mt-3 text-xs leading-5 text-slate-500">{message}</div> : null}
        {error ? <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">{error} 旧缓存已保留。</div> : null}

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
              const highlighted = isTopicHighlighted(topic, highlightedKeywords);
              return (
                <article
                  key={topic.id}
                  onClick={() => {
                    setSelectedTopicId(topic.id);
                    setGeneratedTopicId("");
                  }}
                  className={`block w-full cursor-pointer rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)] ${
                    selectedTopic?.id === topic.id ? "bg-white" : "bg-slate-50"
                  }`}
                  style={{ borderColor: highlighted || selectedTopic?.id === topic.id ? theme.primary : theme.border }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: highlighted ? theme.accent : theme.primary }}>
                      {topic.rank ?? index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-base font-black leading-6 text-slate-950">{topic.title}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge>{topic.platform ?? "全网"}</Badge>
                        <Badge>{topic.source}</Badge>
                        {topic.category ? <Badge>{topic.category}</Badge> : null}
                        {topic.leverageValue ? <Badge strong={topic.leverageValue === "高价值"}>{topic.leverageValue}</Badge> : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{topic.summary || "等待补充摘要。"}</p>
                      <div className="mt-2 text-xs font-semibold" style={{ color: theme.secondary }}>
                        热度：{topic.heat ?? topic.relevanceScore ?? "-"}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTopicId(topic.id);
                            setGeneratedTopicId("");
                          }}
                          className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:-translate-y-0.5"
                        >
                          查看详情
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedTopicId(topic.id);
                            setGeneratedTopicId(topic.id);
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
              <p className="mt-2 text-sm leading-6 text-slate-500">点击“更新热点”获取最新内容。页面不会自动频繁请求热点 API。</p>
            </div>
          )}
        </div>

        {selectedTopic ? (
          <div className="mt-5 rounded-[28px] border bg-white p-4" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black text-slate-950">热点详情</div>
              {selectedTopic.url ? (
                <a href={selectedTopic.url} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: theme.primary }}>
                  查看来源
                </a>
              ) : null}
            </div>
            <h3 className="mt-3 text-xl font-black leading-7 text-slate-950">{selectedTopic.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{selectedTopic.summary || "该热点暂无摘要，建议更新后结合来源链接人工确认。"}</p>
            <DetailBlock title="为什么值得关注" items={buildWhyCare(selectedTopic)} />
            <DetailBlock title="可借势内容方向" items={selectedTopic.contentAngles ?? []} />
            <DetailBlock title="推荐关联赛事" items={selectedTopic.relatedMatches?.length ? selectedTopic.relatedMatches : ["暂无强关联赛事，可作为泛体育热点观察"]} />
            <button
              type="button"
              onClick={() => setGeneratedTopicId(selectedTopic.id)}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
              style={{ backgroundColor: theme.primary }}
            >
              <Sparkles className="h-4 w-4" />
              生成选题
            </button>
          </div>
        ) : null}

        {generatedPackage ? (
          <div className="mt-4 rounded-[28px] border bg-slate-50 p-4" style={{ borderColor: theme.border }}>
            <div className="text-sm font-black text-slate-950">热点选题包</div>
            {Object.entries(generatedPackage).map(([key, lines]) => (
              <div key={key} className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-black text-slate-500">{packageLabel(key)}</div>
                  <button
                    type="button"
                    onClick={() => copyGenerated(lines.join("\n"), key)}
                    className="text-xs font-semibold"
                    style={{ color: theme.primary }}
                  >
                    {copied === key ? "已复制" : "复制"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                  {lines.map((line) => <li key={line}>· {line}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function DetailBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <div className="text-xs font-black text-slate-500">{title}</div>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
        {items.map((item) => <li key={item}>· {item}</li>)}
      </ul>
    </div>
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
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as HotRadarCache) : null;
  } catch {
    return null;
  }
}

function writeCache(cache: HotRadarCache) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function readHotSourceHeaders() {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;

  try {
    const raw = window.localStorage.getItem("worldcup.datasource.settings");
    if (!raw) return headers;
    const settings = JSON.parse(raw) as { tavilyKey?: string; topHubDataKey?: string };
    if (settings.tavilyKey?.trim()) headers["x-worldcup-tavily-key"] = settings.tavilyKey.trim();
    if (settings.topHubDataKey?.trim()) headers["x-worldcup-tophubdata-key"] = settings.topHubDataKey.trim();
  } catch {
    return headers;
  }

  return headers;
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
      heat: item.heat,
      platform: item.platform,
      source,
      category: classifyCategory(text),
      relevanceScore: item.relevance,
      leverageValue: classifyLeverage(text, item.relevance),
      tags: Array.from(new Set([...(item.tags ?? []), ...buildTags(text)])),
      updatedAt,
      url: item.url,
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
    (a, b) => sourcePriority(b.source) - sourcePriority(a.source) || (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0) || (a.rank ?? 999) - (b.rank ?? 999)
  );
}

function normalizeSource(source: string): HotTopic["source"] {
  if (/tavily/i.test(source)) return "Tavily";
  if (/fallback|ai/i.test(source)) return "AI筛选";
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

function classifyLeverage(text: string, score?: number): HotTopic["leverageValue"] {
  if (/世界杯|足球|体育|进球|乌龙|球衣|VAR|裁判|伤退|球队|球员/i.test(text) || (score ?? 0) >= 82) return "高价值";
  if ((score ?? 0) >= 55) return "可尝试";
  return "低相关";
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

function buildWhyCare(topic: HotTopic) {
  return cleanList([
    `${topic.source}信号显示它具备即时讨论价值。`,
    topic.leverageValue === "高价值" ? "它和体育/世界杯语境关联强，可以直接进入选题判断。" : "它不是纯比赛数据，但可以作为泛热点借势素材。",
    topic.category ? `当前分类为“${topic.category}”，适合先判断平台适配度再生成内容。` : "建议结合来源链接人工确认背景。"
  ]);
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

function isTopicHighlighted(topic: HotTopic, keywords: string[]) {
  if (!keywords.length) return false;
  const text = normalizeText(`${topic.title} ${topic.summary ?? ""} ${(topic.tags ?? []).join(" ")}`);
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function filterByTab(topic: HotTopic, tab: HotTab) {
  if (tab === "全部") return true;
  if (tab === "体育相关") return topic.category === "体育" || topic.category === "世界杯";
  if (tab === "世界杯相关") return topic.category === "世界杯" || topic.tags?.includes("世界杯");
  if (tab === "可借势") return topic.leverageValue === "高价值" || topic.leverageValue === "可尝试";
  return topic.leverageValue === "高价值";
}

function generateHotTopicPackage(topic: HotTopic, match?: WorldCupMatch | null): GeneratedHotPackage {
  const matchLabel = match ? `${localizeTeamName(match.homeTeam.name)} vs ${localizeTeamName(match.awayTeam.name)}` : "今日世界杯比赛";
  const riskLine = /黑哨|黑幕|确认伤退|伤退|裁判|VAR|争议/i.test(`${topic.title} ${topic.summary ?? ""}`)
    ? "风险提醒：不要直接定性，建议写成“引发讨论”“需核实”“从规则角度复盘”。"
    : "风险提醒：避免夸大全网情绪，补充数据或来源后再发布。";

  return qualityControl({
    bilibili: [
      `选题：${topic.title}背后，${matchLabel}还能怎么复盘？`,
      "结构：热点开场 / 比赛事实 / 数据解释 / 平台讨论 / 评论区问题。",
      "弹幕互动：你觉得这是比赛转折，还是赛后传播转折？"
    ],
    weibo: [
      `话题：#${topic.title.replace(/\s+/g, "")}#`,
      `短帖：先看热点，再回到${matchLabel}，这类事件最适合讨论“比赛之外的传播点”。`,
      "讨论钩子：你会把它做成战术复盘、人设叙事，还是争议解释？"
    ],
    xiaohongshu: [
      `标题：${topic.title}，看球新手也能懂的3个重点`,
      "卡片：发生了什么 / 为什么会热 / 和比赛有什么关系 / 可以怎么表达 / 发布前避坑。",
      "收藏理由：这套结构可以复用到其他赛后热点。"
    ],
    shortVideo: [
      `前三秒：今天这个热点，不只是热闹，它能帮你重新看懂${matchLabel}。`,
      "分镜：热点词条截图 / 比分卡 / 关键事件 / 一句话观点 / 评论区提问。",
      "节奏：15秒讲发生了什么，30秒讲为什么值得做，60秒补充数据和风险。"
    ],
    risk: [
      riskLine,
      "发布建议：先确认来源，再把绝对判断改成可核实表达。",
      "适合平台：微博承接讨论，B站做复盘，小红书做解释卡片，短视频做前置信号。"
    ]
  });
}

function buildUpdateQuery(match?: WorldCupMatch | null) {
  if (!match) return "世界杯 足球 今日热点";
  return `${localizeTeamName(match.homeTeam.name)} ${localizeTeamName(match.awayTeam.name)} 世界杯 足球 今日热点`;
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
  if (source === "Tavily") return 2;
  return 1;
}

function packageLabel(key: string) {
  const labels: Record<string, string> = {
    bilibili: "B站选题",
    weibo: "微博话题",
    xiaohongshu: "小红书标题",
    shortVideo: "短视频方向",
    risk: "风险提醒"
  };
  return labels[key] ?? key;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
