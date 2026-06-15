"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, Flame, ShieldAlert, Sparkles, Trophy } from "lucide-react";

import { HotTopicRadarPanel } from "@/components/worldcup/hot-topic-radar-panel";
import { localizeCompetitionName, localizeMatchStatus, localizeRoundName, localizeTeamName } from "@/lib/services/footballNames";
import { filterMatchesByQuery, queryLooksLikeMatchSearch } from "@/lib/services/matchSearchService";
import { useWorldCupQuery } from "@/lib/sports/client";
import type { SourceStatus, WorldCupMatch } from "@/lib/sports/types";
import { getSportTheme, sportThemes, type SportTheme, type SportType } from "@/lib/sport-theme";
import { formatBeijingDateTime, getBeijingDateKeyFromValue } from "@/lib/time/beijingTime";

export default function DashboardPage() {
  const [sportType, setSportType] = useState<SportType>("football");
  const theme = getSportTheme(sportType);
  const { payload, loading, error } = useWorldCupQuery<WorldCupMatch[]>("/api/worldcup/fixtures/today", 20_000);
  const { payload: allPayload, loading: allLoading } = useWorldCupQuery<WorldCupMatch[]>("/api/worldcup/fixtures", 30_000);
  const [matchSearchQuery, setMatchSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [competitionFilter, setCompetitionFilter] = useState("all");
  const useFullFixturePool = Boolean(matchSearchQuery.trim() || dateFilter || statusFilter !== "all" || competitionFilter !== "all");
  const matches = useFullFixturePool ? allPayload?.data ?? [] : payload?.data ?? [];
  const queryFilteredMatches = filterMatchesByQuery(matches, matchSearchQuery);
  const filteredMatches = queryFilteredMatches.filter((item) => {
    const statusOk = statusFilter === "all" || item.status === statusFilter;
    const dateOk = !dateFilter || getBeijingDateKeyFromValue(item.kickoffTime) === dateFilter;
    const competitionOk = competitionFilter === "all" || item.competition === competitionFilter;
    return statusOk && dateOk && competitionOk;
  });
  const competitions = Array.from(new Set(matches.map((item) => item.competition))).filter(Boolean);
  const priorityMatches = filteredMatches.filter((item) => getPriority(item) === "S" || getPriority(item) === "A");
  const watchMatches = filteredMatches.filter((item) => getPriority(item) === "B");
  const firstMatchHref = filteredMatches[0] ? `/matches/${filteredMatches[0].id}` : "/matches/argentina-france-2022-final";
  const [highlightedMatch, setHighlightedMatch] = useState<WorldCupMatch | null>(null);

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
              <HeroMetric label="优先做" value={priorityMatches.length} theme={theme} />
              <HeroMetric label="观望" value={watchMatches.length} theme={theme} />
              <HeroMetric label="不投入" value={0} theme={theme} />
            </div>
            <div className="mt-3 rounded-2xl p-3 text-xs leading-5" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
              今日主推内容方向：球星叙事 + 数据解释。风险提醒：避免黑幕、保送、确认伤退等定性表达。
            </div>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(340px,3fr)]">
        <div className="min-w-0 space-y-8">
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
                  <OpportunityMatchCard
                    key={item.id}
                    match={item}
                    theme={theme}
                    sourceStatus={payload?.sourceStatus ?? "fallback"}
                    onInspect={setHighlightedMatch}
                  />
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

        <HotTopicRadarPanel theme={theme} matches={matches} highlightedMatch={highlightedMatch} />
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

function HeroMetric({ label, value, theme }: { label: string; value: number; theme: SportTheme }) {
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
  return (
    <div className="fixed bottom-5 left-4 z-40 rounded-[22px] border border-slate-200 bg-white/92 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur lg:bottom-auto lg:top-28">
      <div className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">主题</div>
      <div className="flex gap-2 lg:flex-col">
        {(Object.keys(sportThemes) as SportType[]).map((sportType) => {
          const item = sportThemes[sportType];
          const selected = active === sportType;
          return (
            <button
              key={sportType}
              type="button"
              onClick={() => onChange(sportType)}
              className={`group flex h-11 items-center gap-2 rounded-2xl px-3 text-left text-xs font-semibold transition hover:-translate-y-0.5 ${
                selected ? "text-white shadow-md" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-white"
              }`}
              style={selected ? { backgroundColor: item.primary, boxShadow: `0 12px 28px ${item.heroGlow}` } : undefined}
              aria-pressed={selected}
              title={`${item.name}主题`}
            >
              <span className="flex -space-x-1">
                {[item.primary, item.secondary, item.accent].map((color) => (
                  <span key={color} className="h-4 w-4 rounded-full border border-white" style={{ backgroundColor: color }} />
                ))}
              </span>
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OpportunityMatchCard({
  match,
  theme,
  sourceStatus,
  onInspect
}: {
  match: WorldCupMatch;
  theme: SportTheme;
  sourceStatus: SourceStatus;
  onInspect?: (match: WorldCupMatch) => void;
}) {
  const priority = getPriority(match);
  const risk = match.status === "live" ? "中" : "低";
  const homeTeam = localizeTeamName(match.homeTeam.name);
  const awayTeam = localizeTeamName(match.awayTeam.name);
  const round = localizeRoundName(match.round || "世界杯比赛");
  const statusText = localizeMatchStatus(match.statusText);

  return (
    <article
      onClick={() => onInspect?.(match)}
      onMouseEnter={() => onInspect?.(match)}
      onFocus={() => onInspect?.(match)}
      className="grid cursor-pointer gap-5 rounded-[30px] border bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.1)] lg:grid-cols-[90px_1fr_220px]"
      style={{ borderColor: theme.border }}
    >
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

function formatDate(value: string) {
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
