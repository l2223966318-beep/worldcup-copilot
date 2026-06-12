"use client";

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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MatchData } from "@/data/matches";

export function InsightCharts({ match }: { match: MatchData }) {
  const possessionData = [
    { team: match.teamA, value: match.stats.teamA.possession },
    { team: match.teamB, value: match.stats.teamB.possession }
  ];
  const shotData = [
    { name: "射门", [match.teamA]: match.stats.teamA.shots, [match.teamB]: match.stats.teamB.shots },
    { name: "射正", [match.teamA]: match.stats.teamA.shotsOnTarget, [match.teamB]: match.stats.teamB.shotsOnTarget }
  ];
  const radarPlayer = match.keyPlayers[0];
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

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="控球率对比图"
        operation={`${match.teamA}控球率为 ${match.stats.teamA.possession}%，${match.teamB}为 ${match.stats.teamB.possession}%。运营上不要只写“谁控球更多”，要解释控球是否转化成真正威胁。`}
        quote={`控球率只是比赛的时间分配，射正和 xG 才更接近机会质量。`}
      >
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={possessionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,.18)" />
            <XAxis dataKey="team" stroke="#cbd5e1" />
            <YAxis stroke="#cbd5e1" />
            <Tooltip />
            <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="射门 / 射正对比柱状图"
        operation={`${match.teamA}射门 ${match.stats.teamA.shots} 次、射正 ${match.stats.teamA.shotsOnTarget} 次；${match.teamB}射门 ${match.stats.teamB.shots} 次、射正 ${match.stats.teamB.shotsOnTarget} 次。这个图适合解释场面热闹和真实威胁的差别。`}
        quote={`别只看射门数，真正决定内容角度的是射正率和机会质量。`}
      >
        <ResponsiveContainer width="100%" height={270}>
          <BarChart data={shotData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,.18)" />
            <XAxis dataKey="name" stroke="#cbd5e1" />
            <YAxis stroke="#cbd5e1" />
            <Tooltip />
            <Legend />
            <Bar dataKey={match.teamA} fill="#22c55e" radius={[8, 8, 0, 0]} />
            <Bar dataKey={match.teamB} fill="#f59e0b" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="关键球员雷达图"
        operation={`${radarPlayer.name}评分 ${radarPlayer.rating}，进球 ${radarPlayer.goals}，关键传球 ${radarPlayer.keyPasses}。雷达图适合放在人物叙事段，证明主角不是靠单一镜头成立。`}
        quote={`${radarPlayer.name}的价值不只在进球，也在他把比赛叙事串了起来。`}
      >
        <ResponsiveContainer width="100%" height={290}>
          <RadarChart data={playerRadar}>
            <PolarGrid stroke="rgba(226,232,240,.22)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
            <PolarRadiusAxis tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.28} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="历史交锋小图表"
        operation={`${match.teamA}和${match.teamB}有 ${match.historicalMeetings.length} 条示例历史交锋。它适合放在长文或 B站视频中段，用来抬高内容纵深。`}
        quote={`历史不是本场比赛的答案，但能解释为什么这场球会被反复讨论。`}
      >
        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={historyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,.18)" />
            <XAxis dataKey="name" stroke="#cbd5e1" />
            <YAxis stroke="#cbd5e1" />
            <Tooltip />
            <Line type="monotone" dataKey="场次" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5 }} />
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
  children
}: {
  title: string;
  operation: string;
  quote: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-sm leading-7 text-emerald-50">
          <div><span className="font-semibold text-emerald-100">运营解释：</span>{operation}</div>
          <div className="mt-2"><span className="font-semibold text-amber-100">可复制口播金句：</span>{quote}</div>
        </div>
      </CardContent>
    </Card>
  );
}
