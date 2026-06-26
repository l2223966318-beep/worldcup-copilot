"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { MatchData } from "@/data/matches";
import { copyToClipboard } from "@/lib/download";
import { HighlightedText } from "@/components/ui/readable-text";
import { buildChartCopy, buildTeamRadarData } from "@/lib/services/matchDetailPresentation";
import { getSportTheme, type SportTheme } from "@/lib/sport-theme";

export function InsightCharts({ match, theme = getSportTheme("football") }: { match: MatchData; theme?: SportTheme }) {
  const possessionData = [
    { team: match.teamA, value: match.stats.teamA.possession },
    { team: match.teamB, value: match.stats.teamB.possession }
  ];
  const shotData = [
    { name: "射门", [match.teamA]: match.stats.teamA.shots, [match.teamB]: match.stats.teamB.shots },
    { name: "射正", [match.teamA]: match.stats.teamA.shotsOnTarget, [match.teamB]: match.stats.teamB.shotsOnTarget }
  ];
  const teamRadar = buildTeamRadarData(match);
  const chartCopy = buildChartCopy(match);
  const hasEnoughHistory = match.historicalMeetings.length >= 2;
  const historyData = match.historicalMeetings.map((item, index) => ({
    name: item.year,
    场次: index + 1
  }));

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard
        title="控球率对比：谁真正掌握比赛时间？"
        operation={chartCopy.possession.operation}
        quote={chartCopy.possession.quote}
        theme={theme}
      >
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={possessionData} barCategoryGap="44%" margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="possessionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.4} />
            <XAxis
              dataKey="team"
              axisLine={{ stroke: "#CBD5E1", strokeWidth: 1 }}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12, fontFamily: "inherit" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12, fontFamily: "inherit" }}
            />
            <Tooltip />
            <Bar dataKey="value" fill="url(#possessionGradient)" radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="射门 / 射正：比赛机会密度怎么讲"
        operation={chartCopy.shots.operation}
        quote={chartCopy.shots.quote}
        theme={theme}
      >
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={shotData} barGap={10} barCategoryGap="36%" margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="teamAGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="teamBGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.4} />
            <XAxis
              dataKey="name"
              axisLine={{ stroke: "#CBD5E1", strokeWidth: 1 }}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12, fontFamily: "inherit" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94A3B8", fontSize: 12, fontFamily: "inherit" }}
            />
            <Tooltip />
            <Legend iconType="circle" wrapperStyle={{ color: "#64748B", fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey={match.teamA} fill="url(#teamAGradient)" radius={[6, 6, 0, 0]} maxBarSize={38} />
            <Bar dataKey={match.teamB} fill="url(#teamBGradient)" radius={[6, 6, 0, 0]} maxBarSize={38} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="球队表现雷达：两队强弱项一眼对比"
        operation={chartCopy.radar.operation}
        quote={chartCopy.radar.quote}
        theme={theme}
      >
        <ResponsiveContainer width="100%" height={270}>
          <RadarChart data={teamRadar}>
            <PolarGrid stroke="rgba(148,163,184,.3)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#475569", fontSize: 12 }} />
            <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
            <Radar name={match.teamA} dataKey={match.teamA} stroke={theme.chartA} fill={theme.chartA} fillOpacity={0.22} />
            <Radar name={match.teamB} dataKey={match.teamB} stroke={theme.chartB} fill={theme.chartB} fillOpacity={0.18} />
            <Legend />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="赛事背景：这场比赛如何放进内容上下文"
        operation={chartCopy.context.operation}
        quote={chartCopy.context.quote}
        theme={theme}
      >
        {hasEnoughHistory ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={historyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Line type="monotone" dataKey="场次" stroke={theme.chartB} strokeWidth={3} dot={{ r: 5, fill: theme.chartB }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <MatchContextFallback match={match} theme={theme} />
        )}
      </ChartCard>
    </div>
  );
}

function MatchContextFallback({ match, theme }: { match: MatchData; theme: SportTheme }) {
  const eventCount = match.keyEvents.filter((event) => event.team !== "数据源").length;
  const statSignals = [
    `${match.teamA} 控球 ${match.stats.teamA.possession}%`,
    `${match.teamB} 控球 ${match.stats.teamB.possession}%`,
    `射门 ${match.stats.teamA.shots}-${match.stats.teamB.shots}`,
    `射正 ${match.stats.teamA.shotsOnTarget}-${match.stats.teamB.shotsOnTarget}`
  ];

  return (
    <div className="min-h-[250px] rounded-[24px] border bg-white p-5" style={{ borderColor: theme.border }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black tracking-[0.18em] text-slate-400">CONTEXT</div>
          <div className="mt-2 text-xl font-black text-slate-950">背景数据不足</div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">未返回历史交锋</span>
      </div>
      <p className="mt-4 text-sm leading-7 text-slate-600">
        当前数据源没有提供两条以上可核验的历史背景记录，因此不展示趋势图。内容判断应优先使用本场比分、赛程阶段、事件和基础统计。
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <ContextMetric label="本场比分" value={match.score} />
        <ContextMetric label="关键事件" value={eventCount ? `${eventCount} 条` : "待补充"} />
        {statSignals.slice(0, 2).map((item) => (
          <ContextMetric key={item} label="基础统计" value={item} />
        ))}
      </div>
      <div className="mt-4 rounded-2xl p-3 text-sm leading-6" style={{ backgroundColor: theme.background, color: theme.secondary }}>
        可讲方向：先把这场比赛本身讲清楚，不补写未经核验的历史交锋、伤病、内部矛盾或裁判争议。
      </div>
    </div>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  operation,
  quote,
  theme,
  children
}: {
  title: string;
  operation: string;
  quote: string;
  theme: SportTheme;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(quote);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="group rounded-[28px] border bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.1)]" style={{ borderColor: theme.border }}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold leading-snug" style={{ color: theme.strongText }}>{title}</h3>
        <button
          onClick={handleCopy}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5"
          style={{ borderColor: theme.border, color: theme.primary, backgroundColor: "#fff" }}
        >
          {copied ? "已复制" : "复制金句"}
        </button>
      </div>
      <div className="mt-5">{children}</div>
      <div className="mt-5 space-y-3.5 rounded-2xl border p-4 text-sm leading-relaxed text-slate-700" style={{ borderColor: theme.border, backgroundColor: theme.background }}>
        <div><span className="font-semibold" style={{ color: theme.secondary }}>运营解释：</span><HighlightedText text={operation} /></div>
        <div><span className="font-semibold" style={{ color: theme.accent }}>可复制内容金句：</span><HighlightedText text={quote} /></div>
      </div>
    </div>
  );
}
