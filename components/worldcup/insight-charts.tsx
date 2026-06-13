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
  const radarPlayer = match.keyPlayers[0];
  const isTeamSubject = radarPlayer.role === "球队";
  const playerRadar = [
    { metric: "进球", value: radarPlayer.goals * 30 + 40 },
    { metric: "射门", value: radarPlayer.shots * 12 },
    { metric: "关键传球", value: radarPlayer.keyPasses * 18 },
    { metric: "对抗", value: radarPlayer.duelsWon * 12 },
    { metric: "评分", value: radarPlayer.rating * 10 }
  ];
  const historyData = match.historicalMeetings.map((item, index) => ({
    name: item.year,
    场次: index + 1
  }));
  const radarTitle = isTeamSubject ? "球队表现雷达：这条比赛线是否站得住" : "关键球员雷达：人物叙事是否站得住";
  const radarOperation = isTeamSubject
    ? `${radarPlayer.name}射门 ${radarPlayer.shots} 次、进球 ${radarPlayer.goals} 个。雷达图适合放在球队走势段，说明这条内容线是否有数据支撑。`
    : `${radarPlayer.name}评分 ${radarPlayer.rating}，进球 ${radarPlayer.goals}，关键传球 ${radarPlayer.keyPasses}。雷达图适合放在人物叙事段，证明主角不是靠单一镜头成立。`;
  const radarQuote = isTeamSubject
    ? `${radarPlayer.name}这条内容线不能只看比分，要看它在射门、控球和机会质量里的位置。`
    : `${radarPlayer.name}的价值不只在进球，也在他把比赛叙事串了起来。`;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard
        title="控球率对比：谁真正掌握比赛时间？"
        operation={`${match.teamA}控球率为 ${match.stats.teamA.possession}%，${match.teamB}为 ${match.stats.teamB.possession}%。运营上不要只写谁控球更多，要解释控球是否转化成真正威胁。`}
        quote="控球率只是比赛的时间分配，射正和 xG 才更接近机会质量。"
        theme={theme}
      >
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={possessionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" />
            <XAxis dataKey="team" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Bar dataKey="value" fill={theme.chartA} radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="射门 / 射正：比赛机会密度怎么讲"
        operation={`${match.teamA}射门 ${match.stats.teamA.shots} 次、射正 ${match.stats.teamA.shotsOnTarget} 次；${match.teamB}射门 ${match.stats.teamB.shots} 次、射正 ${match.stats.teamB.shotsOnTarget} 次。这个图适合解释场面热闹和真实威胁的差别。`}
        quote="别只看射门数，真正决定内容角度的是射正率和机会质量。"
        theme={theme}
      >
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={shotData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" />
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Legend />
            <Bar dataKey={match.teamA} fill={theme.chartA} radius={[10, 10, 0, 0]} />
            <Bar dataKey={match.teamB} fill={theme.chartB} radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={radarTitle}
        operation={radarOperation}
        quote={radarQuote}
        theme={theme}
      >
        <ResponsiveContainer width="100%" height={270}>
          <RadarChart data={playerRadar}>
            <PolarGrid stroke="rgba(148,163,184,.3)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#475569", fontSize: 12 }} />
            <PolarRadiusAxis tick={false} axisLine={false} />
            <Radar dataKey="value" stroke={theme.chartA} fill={theme.chartA} fillOpacity={0.25} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="赛事背景：这场比赛如何放进内容上下文"
        operation={`${match.teamA}和${match.teamB}当前有 ${match.historicalMeetings.length} 条可用背景记录。它适合放在长文或 B站视频中段，用来补充赛程、场馆和历史语境。`}
        quote="背景信息不是本场比赛的答案，但能帮助观众理解这场球为什么值得被拆解。"
        theme={theme}
      >
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={historyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" />
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip />
            <Line type="monotone" dataKey="场次" stroke={theme.chartB} strokeWidth={3} dot={{ r: 5, fill: theme.chartB }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
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
      <div className="mt-5 rounded-2xl border p-4 text-sm leading-7" style={{ borderColor: theme.border, backgroundColor: theme.background, color: theme.mutedText }}>
        <div><span className="font-semibold" style={{ color: theme.secondary }}>运营解释：</span>{operation}</div>
        <div className="mt-2"><span className="font-semibold" style={{ color: theme.accent }}>可复制内容金句：</span>{quote}</div>
      </div>
    </div>
  );
}
