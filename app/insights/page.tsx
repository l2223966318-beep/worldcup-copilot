"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InsightCharts } from "@/components/worldcup/insight-charts";
import { MatchSelect } from "@/components/worldcup/match-select";
import { exampleMatches } from "@/data/matches";
import { useLocalStorageState } from "@/lib/local-store";

export default function InsightsPage() {
  const [matchId, setMatchId] = useLocalStorageState("worldcup.selectedMatchId", exampleMatches[0].id);
  const match = exampleMatches.find((item) => item.id === matchId) ?? exampleMatches[0];
  const shootingEfficiencyA = Math.round((match.stats.teamA.shotsOnTarget / Math.max(match.stats.teamA.shots, 1)) * 100);
  const shootingEfficiencyB = Math.round((match.stats.teamB.shotsOnTarget / Math.max(match.stats.teamB.shots, 1)) * 100);
  const possessionLeader = match.stats.teamA.possession >= match.stats.teamB.possession ? match.teamA : match.teamB;
  const shotLeader = match.stats.teamA.shotsOnTarget >= match.stats.teamB.shotsOnTarget ? match.teamA : match.teamB;
  const xgGap = Math.abs(match.stats.teamA.xg - match.stats.teamB.xg).toFixed(1);
  const yellowTotal = match.stats.teamA.yellowCards + match.stats.teamB.yellowCards;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">Data Insight</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">数据洞察</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          基于赛事数据生成图表和 AI 解说，把技术统计转成可直接用于内容创作的解释。
        </p>
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div className="w-full max-w-xl">
            <MatchSelect value={matchId} onChange={setMatchId} />
          </div>
          <Button asChild className="gap-2">
            <Link href="/workshop">
              生成多平台内容
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <InsightCharts match={match} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>比赛事件时间线</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {match.keyEvents.map((event) => (
              <div key={`${event.minute}-${event.description}`} className="grid grid-cols-[80px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className="font-semibold text-amber-100">{event.minute}</div>
                <div>
                  <div className="text-sm font-semibold text-white">{event.team} · {event.type}</div>
                  <div className="mt-1 text-sm text-slate-200">{event.description}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-200" />
              数据异常提示卡
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-slate-200">
            <AlertCard title="控球与威胁不完全同步" body={`${possessionLeader}控球更多，但射正领先方是${shotLeader}。这说明运营文案要把“控球”和“威胁”拆开讲。`} />
            <AlertCard title="射正效率可做短视频钩子" body={`${match.teamA}射正率 ${shootingEfficiencyA}%，${match.teamB}射正率 ${shootingEfficiencyB}%。如果做短视频，建议用“射正率解释比赛观感”作为前三秒钩子。`} />
            <AlertCard title="xG 差距需要补来源" body={`${match.teamA} xG ${match.stats.teamA.xg}，${match.teamB} xG ${match.stats.teamB.xg}，差距 ${xgGap}。正式发布时应标注数据源。`} />
            <AlertCard title="黄牌和犯规只做强度提示" body={`本场共 ${yellowTotal} 张黄牌，${match.teamA}犯规 ${match.stats.teamA.fouls} 次，${match.teamB}犯规 ${match.stats.teamB.fouls} 次。不要直接推断恶意动作。`} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AlertCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
      <div className="font-semibold text-amber-100">{title}</div>
      <p className="mt-1">{body}</p>
    </div>
  );
}
