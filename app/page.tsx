"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Palette, Pause, Play, Trophy, Volume2, VolumeX } from "lucide-react";

import { HotTopicRadarPanel } from "@/components/worldcup/hot-topic-radar-panel";
import { localizeCompetitionName, localizeMatchStatus, localizeRoundName, localizeTeamName, localizeVenueText } from "@/lib/services/footballNames";
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
  const sourceIssue = formatSourceIssue(activePayload?.message);
  const hasFilters = Boolean(matchSearchQuery.trim() || dateFilter || statusFilter !== "all" || competitionFilter !== "all");
  const isMockMode = activeStatus === "fallback";
  const isNoDataState = !loading && !error && !hasFilters && filteredMatches.length === 0;
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
    <div className="relative flex flex-col gap-8 pb-16">
      <ThemeSideSelector active={sportType} onChange={selectSportTheme} />
      <ImmersiveWorldCupHero />

      <div className="mx-auto grid w-full max-w-[1600px] items-start gap-5 px-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(380px,0.95fr)] lg:px-6 xl:grid-cols-[minmax(0,1.72fr)_minmax(420px,0.9fr)]">
        <div className="min-w-0 space-y-8">
          <section id="opportunity-pool">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionTitle title="今日赛事内容机会池" />
              <SourceBadge
                status={activeStatus}
                provider={readPayloadProvider(activePayload?.data)}
                lastUpdated={activePayload?.lastUpdated}
                loading={loading || (useFullFixturePool && allLoading)}
                error={error || sourceIssue}
              />
            </div>
            <div className="mt-5 grid gap-3 rounded-[22px] border border-slate-200 bg-white p-3.5 md:grid-cols-4">
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

        </div>

        <div id="hot-moments" className="scroll-mt-24">
          <HotTopicRadarPanel theme={theme} matches={matches} />
        </div>
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
    const settings = JSON.parse(raw) as { tavilyKey?: string; topHubDataKey?: string; dailyHotBaseUrl?: string; xhsHotUrl?: string; xhsHotKey?: string; redfoxApiKey?: string; redfoxXhsCategory?: string };
    if (settings.tavilyKey?.trim()) headers["x-worldcup-tavily-key"] = settings.tavilyKey.trim();
    if (settings.topHubDataKey?.trim()) headers["x-worldcup-tophubdata-key"] = settings.topHubDataKey.trim();
    if (settings.dailyHotBaseUrl?.trim()) headers["x-worldcup-dailyhot-base"] = settings.dailyHotBaseUrl.trim();
    if (settings.xhsHotUrl?.trim()) headers["x-worldcup-xhs-url"] = settings.xhsHotUrl.trim();
    if (settings.xhsHotKey?.trim()) headers["x-worldcup-xhs-key"] = settings.xhsHotKey.trim();
    if (settings.redfoxApiKey?.trim()) headers["x-worldcup-redfox-key"] = settings.redfoxApiKey.trim();
    if (settings.redfoxXhsCategory?.trim()) headers["x-worldcup-redfox-xhs-category"] = encodeURIComponent(settings.redfoxXhsCategory.trim());
  } catch {
    return headers;
  }

  return headers;
}

function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div>
      {eyebrow ? <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{eyebrow}</div> : null}
      <h2 className={eyebrow ? "mt-2 text-3xl font-semibold tracking-tight text-slate-950" : "text-3xl font-semibold tracking-tight text-slate-950"}>{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}

function ImmersiveWorldCupHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPaused, setVideoPaused] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);

  function handlePointerMove(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty("--hero-x", x.toFixed(3));
    event.currentTarget.style.setProperty("--hero-y", y.toFixed(3));
  }

  function handlePointerLeave(event: MouseEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--hero-x", "0");
    event.currentTarget.style.setProperty("--hero-y", "0");
  }

  function scrollToSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) return;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.scrollY,
      left: 0,
      behavior: "smooth"
    });
  }

  async function toggleVideoPlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      setVideoPaused(false);
      return;
    }
    video.pause();
    setVideoPaused(true);
  }

  function toggleVideoMute() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setVideoMuted(nextMuted);
  }

  return (
    <section
      className="worldcup-immersive-hero -mx-4 -mt-5 min-h-[100svh] overflow-hidden text-white lg:-mx-8"
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      style={{ "--hero-x": 0, "--hero-y": 0 } as CSSProperties}
      aria-label="WorldCup Copilot 世界杯沉浸开屏"
    >
      <video
        ref={videoRef}
        className="worldcup-hero-video"
        autoPlay
        loop
        muted={videoMuted}
        playsInline
        preload="metadata"
        onPause={() => setVideoPaused(true)}
        onPlay={() => setVideoPaused(false)}
      >
        <source src="/videos/worldcup-hero.mp4" type="video/mp4" />
      </video>
      <div className="worldcup-hero-video-overlay" />

      <div className="worldcup-hero-layout relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl items-center px-4 py-12 md:py-14 lg:px-8">
        <div className="worldcup-hero-copy">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-white/10 px-4 py-2 text-xs font-black tracking-[0.16em] text-emerald-100 shadow-[0_0_34px_rgba(34,197,94,0.2)] backdrop-blur">
            <Trophy className="h-4 w-4 text-amber-300" />
            WorldCup Copilot
          </div>
          <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[0.94] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-6xl xl:text-[4.75rem]">
            <span className="block">把每一场比赛</span>
            <span className="block">变成高光时刻</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
            WorldCup Copilot 将实时赛况、场上热点和比赛数据，转成可直接进入平台分发的选题与内容方案。
          </p>
          <div className="worldcup-hero-actions mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => scrollToSection("opportunity-pool")} className="worldcup-hero-cta worldcup-hero-cta-primary">
              进入赛事中心
              <ArrowRight className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => scrollToSection("hot-moments")} className="worldcup-hero-cta worldcup-hero-cta-secondary">
              查看热点时刻
            </button>
          </div>
        </div>

        <div className="worldcup-hero-media-controls" aria-label="开屏视频控制">
          <button type="button" onClick={toggleVideoPlayback} className="worldcup-hero-control" aria-label={videoPaused ? "播放视频" : "暂停视频"}>
            {videoPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button type="button" onClick={toggleVideoMute} className="worldcup-hero-control" aria-label={videoMuted ? "打开声音" : "静音"}>
            {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
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
    <div className="fixed bottom-5 right-24 z-40 hidden md:block">
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
  const risk = match.status === "live" ? "中" : "低";
  const homeTeam = localizeTeamName(match.homeTeam.name);
  const awayTeam = localizeTeamName(match.awayTeam.name);
  const round = localizeRoundName(match.round || "世界杯赛程");
  const statusText = localizeMatchStatus(match.statusText);
  const heatTone = matchHeatTone(opportunity.score, theme);

  return (
    <article
      className="grid gap-4 overflow-hidden rounded-[28px] border p-4 shadow-[0_18px_48px_rgba(15,23,42,0.055)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.09)] md:p-5 lg:grid-cols-[74px_minmax(0,1fr)]"
      style={heatTone}
    >
      <div className="flex items-center gap-3 lg:block">
        <div className="flex h-14 w-14 items-center justify-center rounded-[22px] text-2xl font-black text-white shadow-sm lg:h-16 lg:w-16 lg:text-3xl" style={{ backgroundColor: priorityColor(priority) }}>
          {priority}
        </div>
        <div className="text-sm font-semibold text-slate-500 lg:mt-2">机会等级</div>
        <div className="mt-1 text-xs font-semibold text-slate-400 lg:mt-1">评分 {opportunity.score}</div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            北京时间 {formatKickoffTime(match.kickoffTime)}
          </span>
          <h3 className="min-w-0 text-2xl font-semibold tracking-tight text-slate-950 lg:text-[1.72rem]">
            {homeTeam} <span style={{ color: theme.primary }}>{match.score.display}</span> {awayTeam}
          </h3>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{statusText}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{round}</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">风险：{risk}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            {opportunity.signals.slice(0, 3).map((signal) => (
              <span key={signal} className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80">
                {signal}
              </span>
            ))}
            {["B站", "微博", "赛后复盘", "数据解读", localizeVenue(match.venue.city ?? match.venue.name)].map((direction) => (
              <span key={direction} className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80">
                {direction}
              </span>
            ))}
          </div>
          <Link
            href={`/matches/${match.id}`}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            style={{ backgroundColor: theme.primary, boxShadow: `0 14px 30px ${theme.heroGlow}` }}
          >
            进入分析
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function localizeVenue(value?: string) {
  return localizeVenueText(value);
}

function SourceBadge({
  status,
  provider,
  lastUpdated,
  loading,
  error
}: {
  status: SourceStatus;
  provider?: WorldCupMatch["source"]["provider"];
  lastUpdated?: string;
  loading?: boolean;
  error?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
      <div className="font-semibold text-slate-950">数据来源：{loading ? "加载中" : sourceLabel(status, provider)}</div>
      <div className="mt-1 text-xs text-slate-500">
        {lastUpdated ? `最后更新：${formatDate(lastUpdated)}` : "等待接口返回"}
        {error ? `｜${error}` : ""}
      </div>
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
  const { score, signals } = getOpportunityScore(match);

  if (score >= 85) {
    return {
      grade: "S",
      score,
      reason: "高张力场次，适合立即做热点承接、赛后复盘和观点扩散。",
      signals
    } as const;
  }

  if (score >= 70) {
    return {
      grade: "A",
      score,
      reason: "内容价值明确，适合从赛果、球员叙事和数据反差切入。",
      signals
    } as const;
  }

  if (score >= 55) {
    return {
      grade: "B",
      score,
      reason: "有基础内容空间，先观察舆情或作为备选素材储备。",
      signals
    } as const;
  }

  return {
    grade: "C",
    score,
    reason: "当前内容信号偏弱，除非出现额外热点事件，否则不建议优先投入。",
    signals
  } as const;
}

function getOpportunityScore(match: WorldCupMatch) {
  let score = 18;
  const signals: string[] = [];
  const kickoffMs = Date.parse(match.kickoffTime || "");
  const hoursToKickoff = Number.isFinite(kickoffMs) ? (kickoffMs - Date.now()) / (1000 * 60 * 60) : undefined;

  if (match.status === "live") {
    score += 34;
    signals.push("进行中");
  } else if (match.status === "finished") {
    score += 16;
    signals.push("已结束可复盘");
  } else if (match.status === "scheduled") {
    if (typeof hoursToKickoff === "number" && hoursToKickoff <= 6) {
      score += 14;
      signals.push("即将开赛");
    } else if (typeof hoursToKickoff === "number" && hoursToKickoff <= 18) {
      score += 10;
      signals.push("今日开赛");
    } else {
      score += 5;
      signals.push("赛前预热");
    }
  }

  const roundText = `${match.round} ${match.group ?? ""}`.toLowerCase();
  if (/final|semi|quarter|淘汰|八强|四强|决赛|半决赛|1\/8|1\/4/.test(roundText)) {
    score += 18;
    signals.push("淘汰赛");
  } else if (/group|小组/.test(roundText)) {
    score += 4;
    signals.push("小组赛");
  }

  const home = match.score.home;
  const away = match.score.away;
  const hasConfirmedScore = typeof home === "number" && typeof away === "number";
  const totalGoals = typeof home === "number" && typeof away === "number" ? home + away : 0;
  const goalDiff = typeof home === "number" && typeof away === "number" ? Math.abs(home - away) : null;

  if (hasConfirmedScore) {
    score += 10;
    signals.push("比分已确认");
  } else if (match.status !== "scheduled") {
    score -= 12;
    signals.push("比分待确认");
  }

  if (totalGoals >= 4) {
    score += 10;
    signals.push("进球多");
  } else if (totalGoals >= 2) {
    score += 5;
  }

  if (goalDiff === 0 && totalGoals > 0) {
    score += 8;
    signals.push("比分胶着");
  } else if (goalDiff === 1) {
    score += 6;
    signals.push("一球差");
  }

  const eventCount = match.events.length;
  if (eventCount >= 5) {
    score += 14;
    signals.push("事件密集");
  } else if (eventCount >= 3) {
    score += 9;
    signals.push("多关键事件");
  } else if (eventCount >= 1) {
    score += 4;
  }

  const eventText = match.events.map((event) => `${event.type} ${event.detail} ${event.comment ?? ""}`).join(" ");
  if (/penalty|own goal|var|red card|yellow card|争议|乌龙|点球|红牌|裁判/i.test(eventText)) {
    score += 12;
    signals.push("争议/名场面");
  }

  const richStatsCoverage = match.statistics.some((entry) =>
    entry.values.some((value) => {
      if (value.type === "Data Coverage" || value.type === "Goals") return false;
      return value.value !== null && value.value !== "";
    })
  );
  if (richStatsCoverage) {
    score += 8;
    signals.push("数据可讲");
  } else if (hasConfirmedScore) {
    score += 2;
  }

  if (!hasConfirmedScore && eventCount === 0 && !richStatsCoverage && match.status === "finished") {
    score -= 10;
    signals.push("信息偏少");
  }

  if (match.source.provider === "api-football") {
    score += 5;
    signals.push("实时接口");
  } else if (match.source.provider === "worldcup26-free" && !hasConfirmedScore && eventCount === 0) {
    score -= 4;
  }

  return {
    score: Math.max(0, Math.min(99, score)),
    signals: dedupeSignals(signals)
  };
}

function priorityColor(priority: string) {
  if (priority === "S") return "#047857";
  if (priority === "A") return "#16a34a";
  if (priority === "B") return "#0f766e";
  return "#94a3b8";
}

function matchHeatTone(score: number, theme: SportTheme): CSSProperties {
  if (score >= 85) {
    return {
      background:
        "radial-gradient(circle at 86% 50%, rgba(4,120,87,0.58) 0%, rgba(16,185,129,0.26) 25%, transparent 52%), radial-gradient(circle at 8% 0%, rgba(245,158,11,0.36) 0%, transparent 38%), linear-gradient(112deg, transparent 0%, transparent 56%, rgba(255,255,255,0.58) 56.4%, transparent 58.6%), linear-gradient(118deg, rgba(255,255,255,0.98) 0%, rgba(236,253,245,0.96) 38%, rgba(167,243,208,0.92) 70%, rgba(255,247,237,0.96) 100%)",
      borderColor: "rgba(4, 120, 87, 0.78)",
      boxShadow: `0 24px 72px rgba(15,23,42,0.1), 0 0 66px ${theme.heroGlow}`
    };
  }

  if (score >= 70) {
    return {
      background:
        "radial-gradient(circle at 90% 52%, rgba(22,163,74,0.44) 0%, rgba(34,197,94,0.18) 28%, transparent 52%), radial-gradient(circle at 10% 0%, rgba(251,191,36,0.22) 0%, transparent 36%), linear-gradient(112deg, transparent 0%, transparent 60%, rgba(255,255,255,0.5) 60.4%, transparent 62.4%), linear-gradient(118deg, rgba(255,255,255,0.98) 0%, rgba(240,253,244,0.96) 46%, rgba(187,247,208,0.8) 78%, rgba(255,251,235,0.92) 100%)",
      borderColor: "rgba(22, 163, 74, 0.58)",
      boxShadow: "0 21px 60px rgba(15,23,42,0.078), 0 0 44px rgba(34,197,94,0.18)"
    };
  }

  if (score >= 55) {
    return {
      background:
        "radial-gradient(circle at 91% 54%, rgba(15,118,110,0.38) 0%, rgba(45,212,191,0.14) 29%, transparent 54%), radial-gradient(circle at 10% 0%, rgba(245,158,11,0.12) 0%, transparent 34%), linear-gradient(112deg, transparent 0%, transparent 63%, rgba(255,255,255,0.38) 63.4%, transparent 65.2%), linear-gradient(118deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 50%, rgba(204,251,241,0.74) 100%)",
      borderColor: "rgba(15, 118, 110, 0.48)",
      boxShadow: "0 19px 52px rgba(15,23,42,0.068), 0 0 36px rgba(20,184,166,0.13)"
    };
  }

  return {
    background:
      "radial-gradient(circle at 91% 54%, rgba(34,197,94,0.28) 0%, rgba(34,197,94,0.1) 30%, transparent 54%), radial-gradient(circle at 12% 0%, rgba(251,191,36,0.1) 0%, transparent 34%), linear-gradient(112deg, transparent 0%, transparent 64%, rgba(255,255,255,0.34) 64.4%, transparent 66%), linear-gradient(118deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 54%, rgba(220,252,231,0.7) 100%)",
    borderColor: "rgba(34, 197, 94, 0.34)",
    boxShadow: "0 18px 48px rgba(15,23,42,0.06), 0 0 30px rgba(34,197,94,0.09)"
  };
}

function dedupeSignals(signals: string[]) {
  return Array.from(new Set(signals));
}

function sourceLabel(status: SourceStatus, provider?: WorldCupMatch["source"]["provider"]) {
  const providerName = providerSourceName(provider);
  if (provider === "thestatsapi-fixtures" && status === "live") return "TheStatsAPI 兜底数据";
  if (provider === "thestatsapi-fixtures" && status === "cache") return "TheStatsAPI 兜底缓存";
  if (status === "live") return providerName ? `${providerName} 实时数据` : "真实接口数据";
  if (status === "cache") return providerName ? `${providerName} 缓存数据` : "缓存数据";
  if (status === "fallback") return "示例数据";
  return "请求失败";
}

function formatSourceIssue(message?: string) {
  if (!message) return "";
  if (/429|limit exceeded/i.test(message)) return "Sportradar 当前限流，已切换兜底源";
  if (/sportradar/i.test(message)) return "Sportradar 暂不可用，已切换兜底源";
  return message;
}

function providerSourceName(provider?: WorldCupMatch["source"]["provider"]) {
  const labels: Partial<Record<WorldCupMatch["source"]["provider"], string>> = {
    sportradar: "Sportradar",
    "api-football": "API-Football",
    "worldcup26-free": "免费赛程源",
    "thestatsapi-fixtures": "TheStatsAPI",
    mock: "经典样例"
  };
  return provider ? labels[provider] : undefined;
}

function readPayloadProvider(data?: WorldCupMatch[]) {
  return data?.find((item) => item.source?.provider)?.source.provider;
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
