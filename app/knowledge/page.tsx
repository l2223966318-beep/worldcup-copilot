"use client";

import { BookOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { knowledgeEntries } from "@/data/knowledge";
import { appendKnowledgeContext } from "@/lib/services/workflowStore";

const sampleQuestions = [
  "梅西和姆巴佩在世界杯决赛中的表现有什么历史意义？",
  "阿根廷和法国世界杯历史交锋有哪些？",
  "什么是 xG？",
  "点球大战为什么适合做短视频内容？"
];

export default function KnowledgePage() {
  const [question, setQuestion] = useState(sampleQuestions[0]);
  const [inserted, setInserted] = useState(false);
  const result = useMemo(() => {
    const exact = knowledgeEntries.find((item) => item.question === question);
    if (exact) return exact;
    if (question.toLowerCase().includes("xg")) return knowledgeEntries.find((item) => item.id === "what-is-xg") ?? knowledgeEntries[0];
    if (question.includes("点球")) return knowledgeEntries.find((item) => item.id === "penalty-short-video") ?? knowledgeEntries[0];
    if (question.includes("历史") || question.includes("交锋")) return knowledgeEntries.find((item) => item.id === "argentina-france-history") ?? knowledgeEntries[0];
    return knowledgeEntries[0];
  }, [question]);

  function insertIntoContext() {
    appendKnowledgeContext(`${result.question}\n${result.answer}`);
    setInserted(true);
    window.setTimeout(() => setInserted(false), 1400);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">Knowledge Base</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">知识库问答</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          第一版使用本地 mock 知识库，不强依赖联网。答案用于创作辅助，不替代人工事实核查。
        </p>
      </section>

      <Card>
        <CardContent className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-200">提问</span>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-2 min-h-[110px] w-full rounded-xl border border-white/10 bg-slate-950/40 p-4 text-sm text-white outline-none" />
          </label>
          <div className="flex flex-wrap gap-2">
            {sampleQuestions.map((item) => (
              <Button key={item} variant="secondary" size="sm" onClick={() => setQuestion(item)}>{item}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-200" />
            回答
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-7 text-slate-200">
          <Section title="答案" body={result.answer} />
          <List title="相关事实" items={result.facts} />
          <List title="可用于内容创作的角度" items={result.angles} />
          <Section title="建议用途" body={result.usage} />
          <Section title="来源说明" body={result.sourceNote} />
          <Button onClick={insertIntoContext}>{inserted ? "已插入上下文" : "插入到内容生成上下文"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-200" />
            本地知识库范围
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {["世界杯经典比赛", "世界杯冠军列表", "球星基础资料", "球队历史交锋", "常见足球术语", "经典纪录", "示例 2022 世界杯数据"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm text-slate-100">{item}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="mb-2 text-xs text-slate-300">{title}</div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-slate-100">{body}</div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-2 text-xs text-slate-300">{title}</div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-white/10 bg-white/[0.055] p-3 text-slate-100">{item}</div>
        ))}
      </div>
    </div>
  );
}
