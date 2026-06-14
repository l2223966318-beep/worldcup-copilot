"use client";

import Link from "next/link";
import { ArrowRight, Copy, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reviewRisk } from "@/lib/ai/risk";
import { copyToClipboard } from "@/lib/download";
import { readReviewDraft, writeWorkflowState } from "@/lib/services/workflowStore";

const sampleDraft =
  "这场比赛就是裁判黑哨，某队靠黑幕夺冠。某球员彻底废了，已经确认伤退。全网都在骂这个判罚，数据显示他们一定是被保送。";

const samples = [
  "裁判黑哨",
  "某球员彻底废了",
  "某队靠黑幕夺冠",
  "全网都在骂",
  "确认伤退"
];

export default function RiskReviewPage() {
  const [text, setText] = useState(sampleDraft);
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => reviewRisk(text), [text]);

  useEffect(() => {
    const draft = readReviewDraft();
    if (draft) setText(draft);
  }, []);

  useEffect(() => {
    writeWorkflowState({
      reviewResult: {
        level: result.level,
        score: result.score,
        advice: result.advice,
        findings: result.findings.map((finding) => ({ type: finding.type, sentence: finding.sentence, rewrite: finding.rewrite }))
      }
    });
  }, [result]);

  async function copySafeVersion() {
    const safeText = result.findings.length
      ? result.findings.map((finding) => finding.rewrite).join("\n")
      : text;
    await copyToClipboard(safeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">Risk Review</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">风险审稿</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          粘贴标题或稿件，检测体育内容发布风险。系统不判断真假，命中风险句后按风险类型生成整句安全改写。
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <Card>
          <CardHeader>
            <CardTitle>待审稿内容</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {samples.map((item) => (
                <Button key={item} variant="secondary" size="sm" onClick={() => setText((current) => `${current}\n${item}`)}>
                  {item}
                </Button>
              ))}
            </div>
            <textarea value={text} onChange={(event) => setText(event.target.value)} className="min-h-[360px] w-full rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm leading-7 text-white outline-none" />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setText(sampleDraft)}>填入风险样例</Button>
              <Button variant="secondary" className="gap-2" onClick={copySafeVersion}>
                <Copy className="h-4 w-4" />
                {copied ? "已复制" : "复制安全版本"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
              审稿结果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="风险等级" value={result.level} />
              <Metric label="风险分数" value={`${result.score}`} />
              <Metric label="发布建议" value={result.advice} />
            </div>
            {result.findings.length > 0 ? (
              result.findings.map((finding, index) => (
                <div key={`${finding.sentence}-${index}`} className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-4 text-sm leading-7 text-slate-100">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="warning">{finding.type}</Badge>
                    <Badge variant={finding.level === "高" ? "destructive" : finding.level === "中" ? "warning" : "success"}>
                      {finding.level}风险
                    </Badge>
                  </div>
                  <div className="mt-3 text-white">风险句：{finding.sentence}</div>
                  <div className="mt-2">风险原因：{finding.reason}</div>
                  <div className="mt-2 text-emerald-100">安全改写：{finding.rewrite}</div>
                  <div className="mt-2 text-slate-100">平台发布建议：{finding.publishAdvice}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-sm text-emerald-100">未发现明显规则风险，仍建议人工确认事实和数据来源。</div>
            )}
            <Button asChild className="w-full gap-2">
              <Link href="/report">
                生成方案报告
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
      <div className="text-[11px] text-slate-300">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
