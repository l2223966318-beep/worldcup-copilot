"use client";

import { Copy, Download, FileText } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchSelect } from "@/components/worldcup/match-select";
import { knowledgeEntries } from "@/data/knowledge";
import { exampleMatches } from "@/data/matches";
import { generatePlatformContent } from "@/lib/ai/content";
import { createMarkdownReport } from "@/lib/ai/report";
import { reviewRisk } from "@/lib/ai/risk";
import { generateTopics } from "@/lib/ai/topics";
import { copyToClipboard, downloadTextFile } from "@/lib/download";
import { useLocalStorageState } from "@/lib/local-store";

export default function ReportPage() {
  const [matchId, setMatchId] = useLocalStorageState("worldcup.selectedMatchId", exampleMatches[0].id);
  const match = exampleMatches.find((item) => item.id === matchId) ?? exampleMatches[0];
  const topics = useMemo(() => generateTopics(match), [match]);
  const content = useMemo(() => generatePlatformContent(match, topics[0]), [match, topics]);
  const risk = useMemo(() => reviewRisk(content.weibo.longPost), [content]);
  const knowledge = knowledgeEntries[0];
  const markdown = createMarkdownReport({ match, topics, content, risk, knowledge });

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">Report</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">方案报告</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          一键生成可以交给运营主管的内容方案，包括核心判断、主推选题、平台打法、图表建议、发布节奏和风险注意事项。
        </p>
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div className="w-full max-w-xl">
            <MatchSelect value={matchId} onChange={setMatchId} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-2" onClick={() => copyToClipboard(markdown)}>
              <Copy className="h-4 w-4" />
              复制 Markdown
            </Button>
            <Button className="gap-2" onClick={() => downloadTextFile("worldcup-copilot-report.md", markdown, "text/markdown;charset=utf-8")}>
              <Download className="h-4 w-4" />
              导出 Markdown
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-200" />
            可复制 Markdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[760px] overflow-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-sm leading-7 text-slate-100">{markdown}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
