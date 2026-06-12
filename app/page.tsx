import Link from "next/link";
import { ArrowRight, BarChart3, FileText, PenTool, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchCard } from "@/components/worldcup/match-card";
import { RadarGlobe } from "@/components/worldcup/radar-globe";
import { exampleMatches } from "@/data/matches";

const flow = [
  { title: "赛事数据", body: "录入比分、球员、事件和技术统计，形成一场比赛的内容底座。", icon: BarChart3 },
  { title: "选题角度", body: "生成差异化选题，判断新闻价值、平台适配和发布风险。", icon: Sparkles },
  { title: "图表解读", body: "把控球率、射门、xG 和时间线转成可引用的 AI 解说。", icon: BarChart3 },
  { title: "多平台内容", body: "输出 B站、小红书、微博、短视频和公众号方案。", icon: PenTool },
  { title: "风险审稿", body: "标记伤病、判罚、攻击性表达和数据来源风险。", icon: ShieldCheck },
  { title: "方案报告", body: "导出可交给运营主管的 Markdown 内容方案。", icon: FileText }
];

const metrics = [
  ["10", "差异化选题"],
  ["5", "平台内容版本"],
  ["6", "核心图表与提示"],
  ["1", "完整运营报告"]
];

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">AI 世界杯内容生产与传播助手</Badge>
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-white lg:text-6xl">
              WorldCup Copilot
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-100">
              从一场比赛出发，自动生成差异化选题、数据可视化解读、多平台内容方案与发布风险提醒。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="gap-2">
                <Link href="/match-input">
                  使用世界杯示例数据演示
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="gap-2">
                <Link href="/match-input">开始分析一场比赛</Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/report">查看内容方案报告</Link>
              </Button>
            </div>
            <div className="mt-7 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
              {metrics.map(([value, label]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.08] p-4">
                  <div className="text-3xl font-semibold text-white">{value}</div>
                  <div className="mt-1 text-sm text-slate-200">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <RadarGlobe />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {flow.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-emerald-200" />
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-base leading-7 text-slate-200">{item.body}</CardContent>
            </Card>
          );
        })}
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        {exampleMatches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </section>
    </div>
  );
}
