"use client";

import Link from "next/link";
import { ArrowRight, ClipboardPaste, Database, FileInput, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExampleBadge } from "@/components/worldcup/example-badge";
import { MatchCard } from "@/components/worldcup/match-card";
import { exampleMatches } from "@/data/matches";
import { useLocalStorageState } from "@/lib/local-store";

export default function MatchInputPage() {
  const [selectedId, setSelectedId] = useLocalStorageState("worldcup.selectedMatchId", exampleMatches[0].id);
  const [mode, setMode] = useState<"example" | "manual" | "paste">("example");
  const [manual, setManual] = useState({
    name: "我的比赛：A队 vs B队",
    stage: "小组赛",
    time: "2026-06-12 20:00",
    teamA: "A队",
    teamB: "B队",
    score: "2-1",
    summary: "这里填写比赛摘要、关键情绪和内容目标。"
  });
  const [savedNotice, setSavedNotice] = useState("");
  const [pasted, setPasted] = useState(JSON.stringify(exampleMatches[0], null, 2));
  const selectedMatch = useMemo(() => exampleMatches.find((item) => item.id === selectedId) ?? exampleMatches[0], [selectedId]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0d3553]/90 via-[#0b223b]/80 to-[#173516]/75 p-6 shadow-soft-xl backdrop-blur-2xl lg:p-8">
        <Badge variant="warning" className="mb-5">Match Input</Badge>
        <h1 className="text-4xl font-semibold tracking-normal lg:text-6xl">赛事输入</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-100">
          支持示例数据、手动输入和粘贴 CSV / JSON。第一版不需要 API Key，也不要求用户提供平台账号。
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <ModeButton active={mode === "example"} icon={Database} title="使用示例数据" onClick={() => setMode("example")} />
        <ModeButton active={mode === "manual"} icon={FileInput} title="手动输入比赛数据" onClick={() => setMode("manual")} />
        <ModeButton active={mode === "paste"} icon={ClipboardPaste} title="粘贴 CSV / JSON 示例数据" onClick={() => setMode("paste")} />
      </div>

      {mode === "example" ? (
        <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>示例比赛</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {exampleMatches.map((match) => (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => setSelectedId(match.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedId === match.id ? "border-emerald-300/45 bg-emerald-300/10" : "border-white/10 bg-white/[0.055] hover:bg-white/[0.09]"}`}
                >
                  <div className="mb-2"><ExampleBadge /></div>
                  <div className="font-semibold text-white">{match.name}</div>
                  <div className="mt-1 text-sm text-slate-300">{match.stage} · {match.score}</div>
                </button>
              ))}
            </CardContent>
          </Card>
          <MatchDetail matchId={selectedId} />
        </div>
      ) : null}

      {mode === "manual" ? (
        <Card>
          <CardHeader>
            <CardTitle>手动输入</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {Object.entries(manual).map(([key, value]) => (
              <label key={key} className={key === "summary" ? "block md:col-span-2" : "block"}>
                <span className="text-sm font-medium text-slate-200">{manualLabel(key)}</span>
                {key === "summary" ? (
                  <textarea value={value} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 min-h-[120px] w-full rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-white outline-none" />
                ) : (
                  <input value={value} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white outline-none" />
                )}
              </label>
            ))}
            <div className="md:col-span-2">
              <Button
                className="gap-2"
                onClick={() => {
                  window.localStorage.setItem("worldcup.manualMatchDraft", JSON.stringify(manual));
                  setSavedNotice("已暂存到本地草稿。当前演示仍默认使用示例数据生成后续内容。");
                }}
              >
                <Save className="h-4 w-4" />
                保存为当前分析比赛
              </Button>
              <p className="mt-3 text-sm text-slate-300">{savedNotice || "当前阶段手动输入用于演示表单结构，完整版本可继续接入字段校验、导入映射和持久化。"}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "paste" ? (
        <Card>
          <CardHeader>
            <CardTitle>粘贴 CSV / JSON 示例数据</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              className="min-h-[420px] w-full rounded-2xl border border-white/10 bg-slate-950/40 p-5 font-mono text-xs leading-6 text-slate-100 outline-none"
            />
            <p className="mt-3 text-sm text-slate-300">示例数据仅用于本地演示，正式版本可增加校验、导入和字段映射。</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <MatchCard match={selectedMatch} />
        <Button asChild className="gap-2">
          <Link href="/topic-engine">
            生成选题
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function MatchDetail({ matchId }: { matchId: string }) {
  const match = exampleMatches.find((item) => item.id === matchId) ?? exampleMatches[0];
  const statRows = [
    ["控球率", `${match.stats.teamA.possession}%`, `${match.stats.teamB.possession}%`],
    ["射门", match.stats.teamA.shots, match.stats.teamB.shots],
    ["射正", match.stats.teamA.shotsOnTarget, match.stats.teamB.shotsOnTarget],
    ["角球", match.stats.teamA.corners, match.stats.teamB.corners],
    ["犯规", match.stats.teamA.fouls, match.stats.teamB.fouls],
    ["黄牌", match.stats.teamA.yellowCards, match.stats.teamB.yellowCards],
    ["xG", match.stats.teamA.xg, match.stats.teamB.xg]
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>技术统计</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-slate-300">指标</div>
          <div className="font-semibold text-white">{match.teamA}</div>
          <div className="font-semibold text-white">{match.teamB}</div>
          {statRows.map((row) => (
            <div key={row[0]} className="contents">
              <div className="rounded-xl bg-white/[0.06] p-3 text-slate-200">{row[0]}</div>
              <div className="rounded-xl bg-emerald-300/[0.08] p-3 font-semibold text-white">{row[1]}</div>
              <div className="rounded-xl bg-amber-300/[0.08] p-3 font-semibold text-white">{row[2]}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ModeButton({ active, icon: Icon, title, onClick }: { active: boolean; icon: typeof Database; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl border p-5 text-left transition-all ${active ? "border-emerald-300/45 bg-emerald-300/10 text-white" : "border-white/10 bg-white/[0.055] text-slate-200 hover:bg-white/[0.09]"}`}>
      <Icon className="mb-3 h-5 w-5 text-emerald-200" />
      <div className="font-semibold">{title}</div>
    </button>
  );
}

function manualLabel(key: string) {
  const labels: Record<string, string> = {
    name: "比赛名称",
    stage: "赛事阶段",
    time: "比赛时间",
    teamA: "A队",
    teamB: "B队",
    score: "比分",
    summary: "比赛摘要"
  };
  return labels[key] ?? key;
}
