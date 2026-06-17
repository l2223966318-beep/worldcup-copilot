"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, Flame, Palette, ShieldAlert, Sparkles, Trophy } from "lucide-react";

import { HotTopicRadarPanel } from "@/components/worldcup/hot-topic-radar-panel";
import {
  OpportunityMetricBars,
  OpportunityQuadrant,
  OpportunityRiskCard,
  PlatformFitCompare
} from "@/components/worldcup/opportunity-visuals";
import { localizeCompetitionName, localizeMatchStatus, localizeRoundName, localizeTeamName } from "@/lib/services/footballNames";
import { buildMatchOpportunityModel } from "@/lib/services/opportunityModel";
import { filterMatchesByQuery, queryLooksLikeMatchSearch } from "@/lib/services/matchSearchService";
import { useWorldCupQuery } from "@/lib/sports/client";
import type { SourceStatus, WorldCupMatch } from "@/lib/sports/types";
import { getSportTheme, sportThemes, type SportTheme, type SportType } from "@/lib/sport-theme";
import { formatBeijingDateTime, getBeijingDateKeyFromValue } from "@/lib/time/beijingTime";

export default function DashboardPage() {
  const [sportType, setSportType] = useState<SportType>("football");
  const theme = getSportTheme(sportType);
  const [matchSearchQuery, setMatchSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const useFullFixturePool = Boolean(matchSearchQuery.trim() || dateFilter || statusFilter !== "all" || competitionFilter !== "all");
  const { payload, loading, error } = useWorldCupQuery<WorldCupMatch[]>("/api/worldcup/fixtures/today", 20_000, {
    cacheKey: "worldcup.fixtures.today",
    staleMs: 90_000
  });
  const { payload: allPayload, loading: allLoading } = useWorldCupQuery<WorldCupMatch[]>("/api/worldcup/fixtures", 120_000, {
    enabled: useFullFixturePool,
    cacheKey: "worldcup.fixtures.all",
    staleMs: 300_000
  });
  const matches = useFullFixturePool ? allPayload?.data ?? [] : payload?.data ?? [];
  const queryFilteredMatches = filterMatchesByQuery(matches, matchSearchQuery);
  const filteredMatches = queryFilteredMatches
    .filter((item) => {
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const dateOk = !dateFilter || getBeijingDateKeyFromValue(item.kickoffTime) === dateFilter;
      const competitionOk = competitionFilter === "all" || item.competition === competitionFilter;
      return statusOk && dateOk && competitionOk;
    })
    .sort((a, b) => {
      const left = Date.parse(a.kickoffTime || "") || 0;
      const right = Date.parse(b.kickoffTime || "") || 0;
      return left - right;
    });
  const competitions = Array.from(new Set(matches.map((item) => item.competition))).filter(Boolean);
  const activePayload = useFullFixturePool ? allPayload : payload;
  const activeStatus = activePayload?.sourceStatus ?? "fallback";
  const hasFilters = Boolean(matchSearchQuery.trim() || dateFilter || statusFilter !== "all" || competitionFilter !== "all");
  const isMockMode = activeStatus === "fallback";
  const isNoDataState = !loading && !error && !hasFilters && filteredMatches.length === 0;
  const priorityMatches = filteredMatches.filter((item) => {
    const grade = getOpportunityGrade(item);
    return grade === "S" || grade === "A";
  });
  const watchMatches = filteredMatches.filter((item) => getOpportunityGrade(item) === "B");
  const lowPriorityMatches = filteredMatches.filter((item) => getOpportunityGrade(item) === "C");
  const firstMatchHref = filteredMatches[0] ? `/matches/${filteredMatches[0].id}` : "/matches/argentina-france-2022-final";
  const heroOpsState = getOpsState({
    loading,
    error,
    filteredCount: filteredMatches.length,
    priorityCount: priorityMatches.length,
    watchCount: watchMatches.length,
    lowCount: lowPriorityMatches.length,
    status: activeStatus
  });

  useEffect(() => {
    setSportType(readSavedSportType());
  }, []);

  function selectSportTheme(nextSportType: SportType) {
    setSportType(nextSportType);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("worldcup.sportType", nextSportType);
    }
  }

  const applyGlobalSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    setDateFilter("");
    setStatusFilter("all");
    setCompetitionFilter("all");
    setMatchSearchQuery(queryLooksLikeMatchSearch(trimmed) ? trimmed : "");
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("q");
    if (!query) return;
    applyGlobalSearch(query);
  }, [applyGlobalSearch]);

  useEffect(() => {
    function handleGlobalSearch(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      applyGlobalSearch(detail?.query ?? "");
    }

    window.addEventListener("worldcup:global-search", handleGlobalSearch);
    return () => window.removeEventListener("worldcup:global-search", handleGlobalSearch);
  }, [applyGlobalSearch]);

  return (
    <div className="relative mx-auto flex max-w-7xl flex-col gap-6 pb-16">
      <ThemeSideSelector active={sportType} onChange={selectSportTheme} />
      <section className={`relative overflow-hidden rounded-[32px] border bg-gradient-to-br ${theme.gradient} p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)] lg:p-7`} style={{ borderColor: theme.border }}>
        <HeroPattern theme={theme} />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <div className="inline-flex rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm" style={{ color: theme.secondary }}>
              当前项目：2026 世界杯内容运营
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight tracking-tight text-slate-950 lg:text-6xl">
              WorldCup Copilot
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700 lg:text-lg">
              从赛事数据到平台分发，帮运营人员快速找到值得做的内容角度。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="#opportunity-pool"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5"
                style={{ backgroundColor: theme.primary, boxShadow: `0 18px 38px ${theme.heroGlow}` }}
              >
                查看今日比赛池
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/matches/argentina-france-2022-final"
                className="inline-flex h-10 items-center justify-center rounded-full border border-white bg-white/85 px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5"
              >
                查看经典样例
              </Link>
            </div>
          </div>
          <div className="rounded-[26px] border bg-white/85 p-4 shadow-lg shadow-slate-900/10 backdrop-blur" style={{ borderColor: theme.border }}>
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5" style={{ color: theme.primary }} />
              <div className="text-base font-semibold text-slate-950">今日运营建议</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <HeroMetric label="优先做" value={heroOpsState.metrics.priority} theme={theme} />
              <HeroMetric label="观望" value={heroOpsState.metrics.watch} theme={theme} />
              <HeroMetric label="不投入" value={heroOpsState.metrics.low} theme={theme} />
            </div>
            <div className="mt-3 rounded-2xl p-3 text-xs leading-5" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
              {heroOpsState.copy}
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <div className="min-w-0 space-y-8">
          <section id="opportunity-pool">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionTitle eyebrow="今日机会池" title="今日赛事内容机会池" description="数据来自内部服务端接口，足球数据密钥不会暴露给浏览器。" />
              <SourceBadge status={activeStatus} lastUpdated={activePayload?.lastUpdated} loading={loading || (useFullFixturePool && allLoading)} error={error} />
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
                <div className="relative mt-2">
                  {!dateFilter ? (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      年/月/日
                    </span>
                  ) : null}
                  <input
                    type="date"
                    lang="zh-CN"
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value)}
                    className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none ${dateFilter ? "text-slate-700" : "text-transparent"}`}
                  />
                </div>
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
                  <OpportunityMatchCard key={item.id} match={item} theme={theme} sourceStatus={activeStatus} />
                ))
              ) : isNoDataState ? (
                <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10">
                  <div className="text-xl font-semibold text-slate-950">
                    {loading ? "正在加载今日比赛数据" : error ? "今日比赛数据请求失败" : isMockMode ? "当前没有可用的真实今日比赛数据" : "今天暂未返回比赛数据"}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                    {loading
                      ? "正在从服务端读取今日比赛池，稍后会自动更新。"
                      : error
                        ? `当前接口返回错误：${error}。你可以先用经典样例完成完整演示。`
                        : isMockMode
                          ? "当前处于示例 / fallback 数据模式，没有拿到可展示的今日比赛。为保证演示顺畅，建议先进入经典样例走完整链路。"
                          : "接口当前返回为空。你可以先切换筛选条件，或直接进入经典样例完整演示。"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link href="/matches/argentina-france-2022-final" className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                      进入经典样例完整演示
                    </Link>
                    <Link href="/settings" className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5">
                      检查数据源设置
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-[30px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                  当前筛选条件下没有比赛。可清空搜索、日期、状态筛选，或继续使用经典样例完整演示。
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
              <SectionTitle eyebrow="运营判断" title="今日运营建议" description="把比赛转成可执行排期，而不是让用户自己在功能里找方向。" />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <DecisionCard icon={CheckCircle2} title="今日优先做" value={heroOpsState.cards.priority.value} body={heroOpsState.cards.priority.body} theme={theme} />
                <DecisionCard icon={CircleDot} title="观望比赛" value={heroOpsState.cards.watch.value} body={heroOpsState.cards.watch.body} theme={theme} />
                <DecisionCard icon={Sparkles} title="今日主推方向" value={heroOpsState.cards.direction.value} body={heroOpsState.cards.direction.body} theme={theme} />
                <DecisionCard icon={ShieldAlert} title="今日风险提醒" value={heroOpsState.cards.risk.value} body={heroOpsState.cards.risk.body} theme={theme} />
              </div>
            </div>

            <div className="rounded-[32px] border bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.06)]" style={{ borderColor: theme.border }}>
              <SectionTitle eyebrow="经典样例" title="历史经典样例" description="真实数据暂缺时，仍保留高完成度演示样例入口。" />
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
                      <p className="mt-2 text-sm leading-6 text-slate-600">真实比赛编号会进入足球数据详情链路；历史样例继续走演示数据。</p>
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
                      <p className="mt-2 text-sm leading-6 text-slate-600">保留为历史经典演示样例，方便没有接口密钥时完整演示。</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-950" />
                  </div>
                </Link>
              </div>
            </div>
          </section>
        </div>

        <HotTopicRadarPanel theme={theme} matches={matches} />
      </div>
    </div>
  );
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

function HeroMetric({ label, value, theme }: { label: string; value: string | number; theme: SportTheme }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
      <div className="text-2xl font-black" style={{ color: theme.primary }}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function ThemeSideSelector({
  active,
  onChange
}: {
  active: SportType;
  onChange: (sportType: SportType) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeTheme = sportThemes[active];

  return (
    <div className="fixed bottom-5 left-4 z-40">
      {open ? (
        <div className="mb-3 w-56 rounded-[22px] border border-slate-200 bg-white/95 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)] backdrop-blur">
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">主题</div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">
              收起
            </button>
          </div>
          <div className="grid gap-2">
            {(Object.keys(sportThemes) as SportType[]).map((sportType) => {
              const item = sportThemes[sportType];
              const selected = active === sportType;
              return (
                <button
                  key={sportType}
                  type="button"
                  onClick={() => {
                    onChange(sportType);
                    setOpen(false);
                  }}
                  className={`group flex h-11 items-center justify-between rounded-2xl px-3 text-left text-xs font-semibold transition hover:-translate-y-0.5 ${
                    selected ? "text-white shadow-md" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-white"
                  }`}
                  style={selected ? { backgroundColor: item.primary, boxShadow: `0 12px 28px ${item.heroGlow}` } : undefined}
                  aria-pressed={selected}
                  title={`${item.name}主题`}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex -space-x-1">
                      {[item.primary, item.secondary, item.accent].map((color) => (
                        <span key={color} className="h-4 w-4 rounded-full border border-white" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span>{item.name}</span>
                  </span>
                  {selected ? <span className="text-[11px] opacity-90">当前</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 text-sm font-semibold text-slate-800 shadow-[0_14px_40px_rgba(15,23,42,0.14)] backdrop-blur transition hover:-translate-y-0.5"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ backgroundColor: activeTheme.primary }}>
          <Palette className="h-4 w-4" />
        </span>
        <span>{activeTheme.name}主题</span>
      </button>
    </div>
  );
}

function OpportunityMatchCard({
  match,
  theme,
  sourceStatus
}: {
  match: WorldCupMatch;
  theme: SportTheme;
  sourceStatus: SourceStatus;
}) {
  const opportunity = getOpportunityProfile(match);
  const priority = opportunity.grade;
  const homeTeam = localizeTeamName(match.homeTeam.name);
  const awayTeam = localizeTeamName(match.awayTeam.name);
  const round = localizeRoundName(match.round || "世界杯赛程");
  const statusText = localizeMatchStatus(match.statusText);

  return (
    <article
      className="grid gap-5 rounded-[30px] border bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.1)] lg:grid-cols-[90px_minmax(0,1.2fr)_minmax(280px,0.8fr)_220px]"
      style={{ borderColor: theme.border }}
    >
      <div className="flex items-center gap-3 lg:block">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-3xl font-black text-white" style={{ backgroundColor: priorityColor(priority, theme) }}>
          {priority}
        </div>
        <div className="text-sm font-semibold text-slate-500 lg:mt-2">机会等级</div>
        <div className="mt-1 text-xs font-semibold text-slate-400 lg:mt-1">价值分 {opportunity.valueScore}</div>
        <div className="mt-2 flex flex-wrap gap-1.5 lg:mt-3">
          {opportunity.signals.slice(0, 3).map((signal) => (
            <span key={signal} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {signal}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            北京时间 {formatKickoffTime(match.kickoffTime)}
          </span>
          <h3 className="text-3xl font-semibold tracking-tight text-slate-950">
            {homeTeam} <span style={{ color: theme.primary }}>{match.score.display}</span> {awayTeam}
          </h3>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{statusText}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{round}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">风险：{opportunity.riskLevel}</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">数据：{sourceLabel(sourceStatus)}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">推荐内容主线：{opportunity.recommendationReason}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["B站", "微博", "赛后复盘", "数据解读", localizeVenue(match.venue.city ?? match.venue.name)].map((direction) => (
            <span key={direction} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
              {direction}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <OpportunityQuadrant heat={opportunity.heat} scarcity={opportunity.scarcity} theme={theme} />
        <OpportunityMetricBars model={opportunity} theme={theme} compact />
        <PlatformFitCompare platformFits={opportunity.platformFits} theme={theme} />
      </div>
      <div className="flex flex-col justify-between gap-4">
        <OpportunityRiskCard model={opportunity} theme={theme} dense />
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

function localizeVenue(value?: string) {
  if (!value) return "场馆待确认";
  return value
    .replace(/Houston, TX, USA/i, "休斯敦，美国")
    .replace(/United States/i, "美国")
    .replace(/USA/i, "美国")
    .replace(/New York\/New Jersey \(East Rutherford\)/i, "纽约/新泽西")
    .replace(/Miami \(Miami Gardens\)/i, "迈阿密")
    .replace(/Houston Stadium/i, "休斯敦体育场");
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

function getPriority(match: WorldCupMatch) {
  return getOpportunityGrade(match);
}

function getOpportunityGrade(match: WorldCupMatch) {
  return getOpportunityProfile(match).grade;
}

function getOpportunityProfile(match: WorldCupMatch) {
  return buildMatchOpportunityModel(match);
}

function priorityColor(priority: string, theme: SportTheme) {
  if (priority === "S") return theme.primary;
  if (priority === "A") return theme.accent;
  if (priority === "C") return "#94a3b8";
  return theme.secondary;
}

function dedupeSignals(signals: string[]) {
  return Array.from(new Set(signals));
}

function sourceLabel(status: SourceStatus) {
  const labels: Record<SourceStatus, string> = {
    live: "真实接口数据",
    fallback: "示例数据",
    cache: "缓存数据",
    error: "请求失败"
  };
  return labels[status];
}

function formatDate(value: string) {
  return formatBeijingDateTime(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatKickoffTime(value: string) {
  return formatBeijingDateTime(value, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function readSavedSportType(): SportType {
  if (typeof window === "undefined") return "football";
  const saved = window.localStorage.getItem("worldcup.sportType");
  return saved === "basketball" || saved === "swimming" || saved === "football" ? saved : "football";
}

function getOpsState(input: {
  loading: boolean;
  error?: string;
  filteredCount: number;
  priorityCount: number;
  watchCount: number;
  lowCount: number;
  status: SourceStatus;
}) {
  if (input.loading) {
    return {
      metrics: { priority: "…", watch: "…", low: "…" },
      copy: "真实比赛池加载中，系统正在判断今天哪些比赛值得优先投入。",
      cards: {
        priority: { value: "加载中", body: "等待接口返回后再判断优先制作场次。" },
        watch: { value: "加载中", body: "比赛池尚未完成初始化，先保留观察位。" },
        direction: { value: "待判断", body: "等今日比赛池返回后，再决定主推方向。" },
        risk: { value: "待确认", body: "当前先不要对外输出定性判断。" }
      }
    };
  }

  if (input.error) {
    return {
      metrics: { priority: "-", watch: "-", low: "-" },
      copy: `真实数据请求失败：${input.error}。建议直接进入经典样例完成完整演示。`,
      cards: {
        priority: { value: "请求失败", body: "当前不适合根据空接口强行给出优先场次。" },
        watch: { value: "等待重试", body: "可稍后重试真实数据，或改用样例继续演示。" },
        direction: { value: "经典样例", body: "当前最稳妥的演示路径是阿根廷 vs 法国经典样例。" },
        risk: { value: "中", body: "空数据时不要把平台建议和比赛判断写成确定结论。" }
      }
    };
  }

  if (input.filteredCount === 0 && input.status === "fallback") {
    return {
      metrics: { priority: 0, watch: 0, low: 0 },
      copy: "当前处于示例 / fallback 数据模式，但今日比赛池没有可展示场次。建议切换到经典样例走完整链路。",
      cards: {
        priority: { value: "示例模式", body: "当前没有真实比赛可排优先级，不展示伪判断。" },
        watch: { value: "无今日场次", body: "今日比赛池为空，适合转入经典样例演示。" },
        direction: { value: "样例演示", body: "用经典样例展示赛事分析、选题、文案和审稿全链路。" },
        risk: { value: "低", body: "演示模式下需明确标注是样例，不冒充真实今日判断。" }
      }
    };
  }

  if (input.filteredCount === 0) {
    return {
      metrics: { priority: 0, watch: 0, low: 0 },
      copy: "今天暂未返回可分析的比赛数据，建议保留样例入口，不强行输出运营结论。",
      cards: {
        priority: { value: "无数据", body: "没有比赛时不展示伪优先级。" },
        watch: { value: "无数据", body: "当前没有可观察比赛，等待接口更新。" },
        direction: { value: "等待数据", body: "比赛池恢复后再做今日主推方向判断。" },
        risk: { value: "低", body: "不要在无数据情况下产出看似真实的今日建议。" }
      }
    };
  }

  return {
    metrics: { priority: input.priorityCount, watch: input.watchCount, low: input.lowCount },
    copy: "今日主推内容方向：球星叙事 + 数据解释。风险提醒：避免黑幕、保送、确认伤退等定性表达。",
    cards: {
      priority: { value: `${input.priorityCount} 场`, body: "先处理高热度、强叙事、平台适配清晰的比赛。" },
      watch: { value: `${input.watchCount} 场`, body: "适合作为素材储备，等待赛后舆情和平台热度变化。" },
      direction: { value: "人物复盘", body: "以世界杯强叙事比赛作为主线，承接长尾讨论。" },
      risk: { value: "中风险", body: "避免黑幕、保送、确认伤退等定性表达。" }
    }
  };
}
