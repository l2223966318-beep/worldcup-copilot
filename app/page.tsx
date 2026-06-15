"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, Flame, Search, ShieldAlert, Sparkles, Trophy } from "lucide-react";

import type { HotItem, HotSearchPayload } from "@/lib/hot/types";
import { localizeCompetitionName, localizeMatchStatus, localizeRoundName, localizeTeamName } from "@/lib/services/footballNames";
import { filterMatchesByQuery, queryLooksLikeMatchSearch } from "@/lib/services/matchSearchService";
import { useWorldCupQuery } from "@/lib/sports/client";
import type { SourceStatus, WorldCupMatch } from "@/lib/sports/types";
import { getSportTheme, sportThemes, type SportTheme } from "@/lib/sport-theme";

export default function DashboardPage() {
  const theme = getSportTheme("football");
  const { payload, loading, error } = useWorldCupQuery<WorldCupMatch[]>("/api/worldcup/fixtures/today", 60_000);
  const { payload: allPayload, loading: allLoading } = useWorldCupQuery<WorldCupMatch[]>("/api/worldcup/fixtures", 120_000);
  const [matchSearchQuery, setMatchSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const useFullFixturePool = Boolean(matchSearchQuery.trim() || dateFilter || statusFilter !== "all" || competitionFilter !== "all");
  const matches = useFullFixturePool ? allPayload?.data ?? [] : payload?.data ?? [];
  const queryFilteredMatches = filterMatchesByQuery(matches, matchSearchQuery);
  const filteredMatches = queryFilteredMatches.filter((item) => {
    const statusOk = statusFilter === "all" || item.status === statusFilter;
    const dateOk = !dateFilter || item.kickoffTime.slice(0, 10) === dateFilter;
    const competitionOk = competitionFilter === "all" || item.competition === competitionFilter;
    return statusOk && dateOk && competitionOk;
  });
  const competitions = Array.from(new Set(matches.map((item) => item.competition))).filter(Boolean);
  const priorityMatches = filteredMatches.filter((item) => getPriority(item) === "S" || getPriority(item) === "A");
  const watchMatches = filteredMatches.filter((item) => getPriority(item) === "B");
  const firstMatchHref = filteredMatches[0] ? `/matches/${filteredMatches[0].id}` : "/matches/argentina-france-2022-final";
  const [hotQuery, setHotQuery] = useState("美国队 乌龙球 世界杯");
  const [hotPayload, setHotPayload] = useState<HotSearchPayload>();
  const [hotLoading, setHotLoading] = useState(false);
  const [hotError, setHotError] = useState("");
  const [copiedHotId, setCopiedHotId] = useState("");

  const runHotSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHotLoading(true);
    setHotError("");
    try {
      const response = await fetch(`/api/hot/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`热点接口请求失败：${response.status}`);
      const result = (await response.json()) as HotSearchPayload;
      setHotPayload(result);
    } catch (requestError) {
      setHotError(requestError instanceof Error ? requestError.message : "热点接口请求失败");
    } finally {
      setHotLoading(false);
    }
  }, []);

  const applyGlobalSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    setHotQuery(query);
    setDateFilter("");
    setStatusFilter("all");
    setCompetitionFilter("all");
    setMatchSearchQuery(queryLooksLikeMatchSearch(trimmed) ? trimmed : "");
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("q");
    if (!query) return;
    applyGlobalSearch(query);
    void runHotSearch(query);
  }, [applyGlobalSearch, runHotSearch]);

  useEffect(() => {
    function handleGlobalSearch(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      applyGlobalSearch(detail?.query ?? "");
    }

    window.addEventListener("worldcup:global-search", handleGlobalSearch);
    return () => window.removeEventListener("worldcup:global-search", handleGlobalSearch);
  }, [applyGlobalSearch]);

  async function copyHotTopic(item: HotItem) {
    const text = `热点信号：${item.title}\n来源：${item.platform} / ${item.source}\n选题角度：${buildHotTopicAngle(item)}`;
    await navigator.clipboard.writeText(text);
    setCopiedHotId(item.id);
    window.setTimeout(() => setCopiedHotId(""), 1400);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-16">
      <section className={`relative overflow-hidden rounded-[40px] border bg-gradient-to-br ${theme.gradient} p-7 shadow-[0_28px_90px_rgba(15,23,42,0.08)] lg:p-10`} style={{ borderColor: theme.border }}>
        <HeroPattern theme={theme} />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <div className="inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm" style={{ color: theme.secondary }}>
              当前项目：2026 世界杯内容运营
            </div>
            <h1 className="mt-8 max-w-4xl text-5xl font-black leading-tight tracking-tight text-slate-950 lg:text-7xl">
              WorldCup Copilot
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-9 text-slate-700">
              从赛事数据到平台分发，帮运营人员快速找到值得做的内容角度。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#opportunity-pool"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                style={{ backgroundColor: theme.primary, boxShadow: `0 18px 38px ${theme.heroGlow}` }}
              >
                查看今日比赛池
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/matches/argentina-france-2022-final"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white bg-white/85 px-5 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5"
              >
                查看经典样例
              </Link>
            </div>
          </div>
          <div className="rounded-[32px] border bg-white/85 p-6 shadow-xl shadow-slate-900/10 backdrop-blur" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6" style={{ color: theme.primary }} />
              <div className="text-lg font-semibold text-slate-950">今日运营建议</div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroMetric label="优先做" value={priorityMatches.length} theme={theme} />
              <HeroMetric label="观望" value={watchMatches.length} theme={theme} />
              <HeroMetric label="不投入" value={0} theme={theme} />
            </div>
            <div className="mt-5 rounded-2xl p-4 text-sm leading-6" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
              今日主推内容方向：球星叙事 + 数据解释。风险提醒：避免黑幕、保送、确认伤退等定性表达。
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Object.values(sportThemes).map((item) => (
          <div key={item.sportType} className={`rounded-[28px] border bg-gradient-to-br ${item.gradient} p-5 shadow-sm`} style={{ borderColor: item.border }}>
            <div className="text-lg font-semibold" style={{ color: item.strongText }}>{item.name}主题</div>
            <p className="mt-2 text-sm leading-6" style={{ color: item.mutedText }}>{item.pattern}</p>
            <div className="mt-4 flex gap-2">
              {[item.primary, item.secondary, item.accent].map((color) => (
                <span key={color} className="h-8 w-8 rounded-full ring-4 ring-white" style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section id="hot-search" className="rounded-[34px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div>
            <SectionTitle
              eyebrow="HOT SIGNALS"
              title="热点信息源搜索"
              description="接入榜眼数据、Tavily 和今日热榜公共源，把场上事件、社媒热词和全网讨论纳入选题判断。"
            />
            <form
              className="mt-6 flex overflow-hidden rounded-full border bg-slate-50 p-1"
              style={{ borderColor: theme.border }}
              onSubmit={(event) => {
                event.preventDefault();
                void runHotSearch(hotQuery);
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={hotQuery}
                  onChange={(event) => setHotQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="例如：美国队乌龙球、球衣被扯破、VAR争议"
                  aria-label="搜索热点事件"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: theme.primary }}
                disabled={hotLoading}
              >
                {hotLoading ? "搜索中" : "搜索热点"}
              </button>
            </form>
            <div className="mt-4 rounded-2xl p-4 text-sm leading-6" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
              业务用法：把“乌龙球、球衣被扯破、VAR争议、伤退传闻”等热点信号作为选题来源，再结合比赛数据生成内容角度。
            </div>
            {hotPayload ? (
              <div className="mt-3 text-xs font-semibold text-slate-500">
                来源状态：{hotStatusLabel(hotPayload.sourceStatus)} · 最后更新：{formatDate(hotPayload.lastUpdated)}
              </div>
            ) : null}
            {hotError ? <div className="mt-3 text-sm font-semibold text-red-600">{hotError}</div> : null}
          </div>

          <div className="grid gap-4">
            {hotPayload?.data?.length ? (
              hotPayload.data.slice(0, 6).map((item) => (
                <HotSignalCard
                  key={item.id}
                  item={item}
                  theme={theme}
                  copied={copiedHotId === item.id}
                  onCopy={() => void copyHotTopic(item)}
                />
              ))
            ) : (
              <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div className="text-lg font-semibold text-slate-950">输入关键词后查看热点信号</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  示例：美国队乌龙球、韩国球员球衣被扯破、世界杯 VAR 争议。
                </p>
                <button
                  type="button"
                  onClick={() => void runHotSearch(hotQuery)}
                  className="mt-5 inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
                  style={{ backgroundColor: theme.primary }}
                >
                  用示例关键词搜索
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="opportunity-pool">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle eyebrow="TODAY OPPORTUNITIES" title="今日赛事内容机会池" description="数据来自内部服务端接口，API-Football 不会暴露给浏览器。" />
          <SourceBadge status={(useFullFixturePool ? allPayload?.sourceStatus : payload?.sourceStatus) ?? "fallback"} lastUpdated={(useFullFixturePool ? allPayload?.lastUpdated : payload?.lastUpdated)} loading={loading || (useFullFixturePool && allLoading)} error={error} />
        </div>
        <div className="mt-5 grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 md:grid-cols-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">搜索比赛 / 球队</span>
            <input
              value={matchSearchQuery}
              onChange={(event) => setMatchSearchQuery(event.target.value)}
              placeholder="例如：日本、Japan、美国"
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">赛事</span>
            <select value={competitionFilter} onChange={(event) => setCompetitionFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
              <option value="all">全部赛事</option>
              {competitions.map((item) => <option key={item} value={item}>{localizeCompetitionName(item)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">日期</span>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500">状态</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
              <option value="all">全部状态</option>
              <option value="scheduled">未开始</option>
              <option value="live">进行中</option>
              <option value="finished">已结束</option>
            </select>
          </label>
        </div>
        <div className="mt-6 grid gap-5">
          {filteredMatches.length ? (
            filteredMatches.map((item) => (
              <OpportunityMatchCard key={item.id} match={item} theme={theme} sourceStatus={payload?.sourceStatus ?? "fallback"} />
            ))
          ) : (
            <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              当前筛选条件下没有比赛。可清空搜索、日期、状态筛选，或继续使用经典样例完整演示。
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
          <SectionTitle eyebrow="OPS DECISION" title="今日运营建议" description="把比赛转成可执行排期，而不是让用户自己在功能里找方向。" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DecisionCard icon={CheckCircle2} title="今日优先做" value={`${priorityMatches.length} 场`} body="先处理高热度、强叙事、平台适配清晰的比赛。" theme={theme} />
            <DecisionCard icon={CircleDot} title="观望比赛" value={`${watchMatches.length} 场`} body="适合作为素材储备，等待赛后舆情和平台热度变化。" theme={theme} />
            <DecisionCard icon={Sparkles} title="今日主推方向" value="人物复盘" body="以世界杯强叙事比赛作为主线，承接长尾讨论。" theme={theme} />
            <DecisionCard icon={ShieldAlert} title="今日风险提醒" value="中风险" body="避免黑幕、保送、确认伤退等定性表达。" theme={theme} />
          </div>
        </div>

        <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
          <SectionTitle eyebrow="CLASSIC CASES" title="历史经典样例" description="真实 API 无数据时，仍保留高完成度 mock 样例入口。" />
          <div className="mt-6 space-y-4">
            <Link
              href={firstMatchHref}
              className="group block rounded-[26px] border bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_54px_rgba(15,23,42,0.08)]"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: theme.primary }}>今日数据链路入口</div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">进入第一场比赛分析</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">真实 fixtureId 会进入 API-Football 详情链路；历史样例继续走 fallback。</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950" />
              </div>
            </Link>
            <Link
              href="/matches/argentina-france-2022-final"
              className="group block rounded-[26px] border bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_54px_rgba(15,23,42,0.08)]"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold" style={{ color: theme.primary }}>经典样例</div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">阿根廷 3-3 法国</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">保留为 mock 历史经典样例，方便无 API key 时完整演示。</p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950" />
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroPattern({ theme }: { theme: SportTheme }) {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-70">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 78% 18%, ${theme.heroGlow}, transparent 300px)` }} />
      <div className="absolute left-[6%] top-[16%] h-[68%] w-[88%] rounded-[44px] border-2 border-white/55" />
      <div className="absolute left-1/2 top-[16%] h-[68%] w-px bg-white/55" />
      <div className="absolute left-[43%] top-[34%] h-40 w-40 rounded-full border-2 border-white/55" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(135deg,rgba(255,255,255,.28)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.28)_50%,rgba(255,255,255,.28)_75%,transparent_75%)] bg-[length:30px_30px] opacity-20" />
    </div>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function HeroMetric({ label, value, theme }: { label: string; value: number; theme: SportTheme }) {
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
      <div className="text-3xl font-black" style={{ color: theme.primary }}>{value}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function OpportunityMatchCard({ match, theme, sourceStatus }: { match: WorldCupMatch; theme: SportTheme; sourceStatus: SourceStatus }) {
  const priority = getPriority(match);
  const risk = match.status === "live" ? "中" : "低";
  const homeTeam = localizeTeamName(match.homeTeam.name);
  const awayTeam = localizeTeamName(match.awayTeam.name);
  const round = localizeRoundName(match.round || "世界杯比赛");
  const statusText = localizeMatchStatus(match.statusText);

  return (
    <article className="grid gap-5 rounded-[30px] border bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.1)] lg:grid-cols-[90px_1fr_220px]" style={{ borderColor: theme.border }}>
      <div className="flex items-center gap-3 lg:block">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-3xl font-black text-white" style={{ backgroundColor: priorityColor(priority, theme) }}>
          {priority}
        </div>
        <div className="text-sm font-semibold text-slate-500 lg:mt-2">机会等级</div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-3xl font-semibold tracking-tight text-slate-950">
            {homeTeam} <span style={{ color: theme.primary }}>{match.score.display}</span> {awayTeam}
          </h3>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{statusText}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">风险：{risk}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">数据：{sourceLabel(sourceStatus)}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">推荐内容主线：{round}，适合从赛果、球员叙事和数据反差中寻找内容角度。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["B站", "微博", "赛后复盘", "数据解读", match.venue.city ?? match.venue.name ?? "世界杯"].map((direction) => (
            <span key={direction} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {direction}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-4">
        <div className="rounded-2xl p-4 text-sm leading-6" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
          推荐平台：B站深度复盘 + 微博话题扩散
        </div>
        <Link
          href={`/matches/${match.id}`}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          style={{ backgroundColor: theme.primary, boxShadow: `0 18px 38px ${theme.heroGlow}` }}
        >
          进入分析
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function SourceBadge({ status, lastUpdated, loading, error }: { status: SourceStatus; lastUpdated?: string; loading?: boolean; error?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
      <div className="font-semibold text-slate-950">数据来源：{loading ? "加载中" : sourceLabel(status)}</div>
      <div className="mt-1 text-xs text-slate-500">
        {lastUpdated ? `最后更新：${formatDate(lastUpdated)}` : "等待接口返回"}
        {error ? `｜${error}` : ""}
      </div>
    </div>
  );
}

function DecisionCard({ icon: Icon, title, value, body, theme }: { icon: typeof Flame; title: string; value: string; body: string; theme: SportTheme }) {
  return (
    <div className="rounded-[24px] border bg-slate-50 p-4" style={{ borderColor: theme.border }}>
      <Icon className="h-5 w-5" style={{ color: theme.primary }} />
      <div className="mt-4 text-sm font-semibold text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}

function HotSignalCard({
  item,
  theme,
  copied,
  onCopy
}: {
  item: HotItem;
  theme: SportTheme;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <article className="rounded-[26px] border bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]" style={{ borderColor: theme.border }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: theme.primary }}>
          {item.relevance}
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{item.platform}</span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{item.source}</span>
        {item.heat ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{item.heat}</span> : null}
      </div>
      <h3 className="mt-4 text-xl font-black leading-tight text-slate-950">{item.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
      <div className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
        <span className="font-semibold" style={{ color: theme.secondary }}>可转化选题：</span>
        {buildHotTopicAngle(item)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {item.tags.length ? item.tags.map((tag) => (
            <span key={tag} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: theme.background, color: theme.secondary }}>
              {tag}
            </span>
          )) : <span className="text-xs font-semibold text-slate-400">等待更多标签</span>}
        </div>
        <div className="flex gap-2">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5"
            >
              查看来源
            </a>
          ) : null}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            style={{ backgroundColor: theme.primary }}
          >
            {copied ? "已复制" : "复制为选题素材"}
          </button>
        </div>
      </div>
    </article>
  );
}

function getPriority(match: WorldCupMatch) {
  if (match.status === "live") return "S";
  if (match.status === "finished") return "A";
  return "B";
}

function priorityColor(priority: string, theme: SportTheme) {
  if (priority === "S") return theme.primary;
  if (priority === "A") return theme.accent;
  return theme.secondary;
}

function sourceLabel(status: SourceStatus) {
  const labels: Record<SourceStatus, string> = {
    live: "真实 API 数据",
    fallback: "示例数据",
    cache: "缓存数据",
    error: "请求失败"
  };
  return labels[status];
}

function hotStatusLabel(status: HotSearchPayload["sourceStatus"]) {
  const labels: Record<HotSearchPayload["sourceStatus"], string> = {
    live: "真实热点源",
    partial: "部分热点源可用",
    cache: "缓存热点",
    fallback: "示例热点",
    error: "请求失败"
  };
  return labels[status];
}

function buildHotTopicAngle(item: HotItem) {
  if (item.tags.includes("乌龙球")) {
    return "从“关键失误如何改变比赛走势”切入，结合比分节点、球队心态和社媒讨论做赛后复盘。";
  }
  if (item.tags.includes("球衣被扯破")) {
    return "从“高对抗瞬间为什么会成为传播点”切入，适合做短视频拆解和微博讨论钩子。";
  }
  if (item.tags.includes("争议判罚") || item.tags.includes("VAR")) {
    return "从“判罚争议如何影响观众情绪”切入，注意用需核实和规则解释降低风险。";
  }
  if (item.tags.includes("伤病需核实")) {
    return "从“阵容变化对比赛策略的影响”切入，避免确认伤情，建议补充来源并人工确认。";
  }
  return "从热点讨论反推内容角度，优先判断它能否支撑人物叙事、战术复盘或平台话题承接。";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
