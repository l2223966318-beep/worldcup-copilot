import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, Clock3, FileText, PenTool, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchCard } from "@/components/worldcup/match-card";
import { RadarGlobe } from "@/components/worldcup/radar-globe";
import { exampleMatches } from "@/data/matches";

const outputs = [
  { title: "主推选题", body: "判断主推、次推、观察和谨慎发布，让运营优先级清楚。", icon: Sparkles },
  { title: "多平台内容", body: "按 B站、小红书、微博、短视频和公众号生成差异化版本。", icon: PenTool },
  { title: "数据洞察", body: "把控球、射门、xG 和事件时间线转成运营解释和口播金句。", icon: BarChart3 },
  { title: "风险审稿", body: "识别伤病、判罚、引战、数据来源等风险，并给出安全改写。", icon: ShieldCheck },
  { title: "运营报告", body: "输出可复制 Markdown，包含节奏、清单和合规说明。", icon: FileText }
];

const demoSteps = [
  "选择 2022 世界杯决赛示例数据",
  "生成“梅西职业生涯最后拼图”等热点选题",
  "查看图表洞察、平台内容、风险审稿和方案报告"
];

export default function HomePage() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">体育赛事运营指挥台</Badge>
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-normal text-white lg:text-6xl">
              WorldCup Copilot
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-100">
              面向体育内容运营的赛事热点拆解与多平台分发工作台。
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200">
              输入一场比赛，输出主推选题、平台内容、数据洞察、风险审稿和运营报告，帮助编辑和运营团队完成赛后 3 分钟决策。
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild className="gap-2">
                <Link href="/match-input">
                  使用世界杯示例数据演示
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="gap-2">
                <Link href="/topic-engine">生成赛事热点选题</Link>
              </Button>
              <Button asChild variant="outline" className="gap-2">
                <Link href="/report">查看运营方案报告</Link>
              </Button>
            </div>
          </div>
          <RadarGlobe />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>输入 / 输出对照</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-200">
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4">
              <div className="text-sm text-emerald-100">输入</div>
              <div className="mt-2 text-2xl font-semibold text-white">一场比赛</div>
              <div className="mt-2 text-sm leading-6">比分、关键球员、事件时间线、技术统计、历史交锋。</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {outputs.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <Icon className="mb-3 h-5 w-5 text-amber-200" />
                    <div className="font-semibold text-white">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-200">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3 分钟演示路径</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoSteps.map((step, index) => (
              <div key={step} className="grid grid-cols-[42px_1fr] gap-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300/15 text-lg font-semibold text-amber-100">{index + 1}</div>
                <div>
                  <div className="font-semibold text-white">{step}</div>
                  <div className="mt-1 text-sm text-slate-300">{index === 0 ? "进入赛事输入页，确认阿根廷 vs 法国。" : index === 1 ? "进入选题引擎，选择主推选题。" : "完成内容工坊、审稿和报告导出。"}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <SignalCard title="比分卡" value="3-3" body="点球 4-2，适合作为首页第一视觉信号。" icon={Clock3} />
        <SignalCard title="数据卡" value="20 / 10" body="阿根廷射门 / 射正，支撑机会质量分析。" icon={BarChart3} />
        <SignalCard title="风险警报" value="6 类" body="伤病、判罚、引战、侮辱、事实观点、数据来源。" icon={AlertTriangle} />
        <SignalCard title="发布节奏" value="5 分钟" body="赛后快评、30 分钟短视频、2 小时深度复盘。" icon={FileText} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {exampleMatches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </section>
    </div>
  );
}

function SignalCard({ title, value, body, icon: Icon }: { title: string; value: string; body: string; icon: typeof Clock3 }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <Badge variant="secondary">{title}</Badge>
          <Icon className="h-5 w-5 text-emerald-200" />
        </div>
        <div className="text-4xl font-semibold text-white">{value}</div>
        <p className="mt-3 text-sm leading-6 text-slate-200">{body}</p>
      </CardContent>
    </Card>
  );
}
