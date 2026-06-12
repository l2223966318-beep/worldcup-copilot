"use client";

import Link from "next/link";
import { ArrowRight, Filter, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchSelect } from "@/components/worldcup/match-select";
import { exampleMatches } from "@/data/matches";
import { generateTopics, type TopicIdea } from "@/lib/ai/topics";
import { useLocalStorageState } from "@/lib/local-store";

const filters = ["全部", "B站高适配", "小红书高适配", "低风险", "数据解读", "球员叙事"];

export default function TopicEnginePage() {
  const [matchId, setMatchId] = useLocalStorageState("worldcup.selectedMatchId", exampleMatches[0].id);
  const [filter, setFilter] = useState(filters[0]);
  const [selectedTopicId, setSelectedTopicId] = useLocalStorageState("worldcup.selectedTopicId", "");
  const match = exampleMatches.find((item) => item.id === matchId) ?? exampleMatches[0];
  const topics = useMemo(() => generateTopics(match), [match]);
  const filtered = topics.filter((topic) => matchFilter(topic, filter));
  const activeTopicId = selectedTopicId || topics[0].id;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">Topic Engine</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">选题引擎</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          根据比赛数据生成热点选题，并给出主推、次推、观察和谨慎发布四类运营建议。
        </p>
      </section>

      <Card>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[360px_1fr_auto]">
          <MatchSelect value={matchId} onChange={setMatchId} />
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-200">
              <Filter className="h-4 w-4" />
              筛选
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <Button key={item} variant={filter === item ? "default" : "secondary"} size="sm" onClick={() => setFilter(item)}>
                  {item}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <Button asChild className="gap-2">
              <Link href="/workshop">
                进入内容工坊
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {filtered.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((topic) => (
            <TopicCard key={topic.id} topic={topic} selected={activeTopicId === topic.id} onSelect={() => setSelectedTopicId(topic.id)} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-200">当前筛选没有匹配选题，请切换筛选条件。</CardContent>
        </Card>
      )}
    </div>
  );
}

function TopicCard({ topic, selected, onSelect }: { topic: TopicIdea; selected: boolean; onSelect: () => void }) {
  return (
    <Card className={selected ? "border-emerald-300/40" : ""}>
      <CardHeader>
        <div className="flex flex-wrap gap-2">
          <Badge>{topic.recommendation}</Badge>
          <Badge variant="secondary">{topic.category}</Badge>
          <Badge variant={topic.riskLevel === "高" ? "destructive" : topic.riskLevel === "中" ? "warning" : "success"}>
            {topic.riskLevel}风险
          </Badge>
          <Badge variant="secondary">{topic.difficulty}难度</Badge>
        </div>
        <CardTitle className="flex items-center gap-2 pt-3">
          <Sparkles className="h-5 w-5 text-emerald-200" />
          {topic.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-7 text-slate-200">
        <p className="text-base">{topic.coreAngle}</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Metric label="新闻价值" value={topic.newsValue} />
          <Metric label="传播潜力" value={topic.spreadPotential} />
          <Metric label="平台适配" value={topic.platformFit} />
          <Metric label="B站" value={topic.bilibiliFit} />
          <Metric label="短视频" value={topic.shortVideoFit} />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <InfoPill label="制作成本" value={topic.productionCost} />
          <InfoPill label="小红书适配" value={`${topic.xiaohongshuFit}`} />
          <InfoPill label="微博适配" value={`${topic.weiboFit}`} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="text-xs text-slate-300">推荐内容形式</div>
          <div className="mt-1 font-semibold text-white">{topic.recommendedFormat}</div>
        </div>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4">
          <div className="text-xs text-emerald-100">评分理由</div>
          <p className="mt-1 text-slate-100">{topic.scoreReason}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4">
          <div className="text-xs text-amber-100">为什么推荐这个选题</div>
          <p className="mt-1 text-slate-100">{topic.businessExplanation}</p>
        </div>
        <p><span className="font-semibold text-white">选题理由：</span>{topic.reason}</p>
        <div>
          <div className="mb-2 text-xs text-slate-300">示例标题</div>
          <div className="space-y-2">
            {topic.sampleTitles.map((title) => (
              <div key={title} className="rounded-xl border border-white/10 bg-white/[0.055] p-3 text-slate-100">{title}</div>
            ))}
          </div>
        </div>
        <Button variant={selected ? "default" : "outline"} onClick={onSelect}>
          {selected ? "已选择用于生成内容" : "选择这个选题"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
      <div className="text-[11px] text-slate-300">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
      <div className="text-[11px] text-slate-300">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function matchFilter(topic: TopicIdea, filter: string) {
  if (filter === "B站高适配") return topic.bilibiliFit >= 85;
  if (filter === "小红书高适配") return topic.xiaohongshuFit >= 80;
  if (filter === "低风险") return topic.riskLevel === "低";
  if (filter === "数据解读") return topic.category === "数据解读";
  if (filter === "球员叙事") return topic.category === "球员叙事";
  return true;
}
