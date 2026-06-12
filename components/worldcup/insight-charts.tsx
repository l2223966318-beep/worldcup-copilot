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
        note={`${match.teamA}控球率为 ${match.stats.teamA.possession}%，${match.teamB}为 ${match.stats.teamB.possession}%。控球率并不直接等于控制比赛，建议结合射正和 xG 判断机会质量。`}
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
        note="如果一方射门少但射正率高，可以从“效率高于场面优势”的角度切入，避免只按控球率下结论。"
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
        note={`${radarPlayer.name}可以作为人物叙事核心。雷达图适合解释他为什么不只是“进球者”，也可能是组织、对抗或情绪节点。`}
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
        note="历史交锋适合给内容增加背景感，但要避免把历史结果直接推导为本场结论。"
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
  note,
  children
}: {
  title: string;
  note: string;
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
          <span className="font-semibold text-emerald-100">AI 解说：</span>{note}
        </div>
      </CardContent>
    </Card>
  );
}
