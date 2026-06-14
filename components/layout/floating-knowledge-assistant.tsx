"use client";

import { useMemo, useState } from "react";
import { Bot, MessageSquareText, Search, Sparkles, X } from "lucide-react";

import { copyToClipboard } from "@/lib/download";
import { readWorkflowState, writeReviewDraft, writeWorkflowState } from "@/lib/services/workflowStore";
import { getSportTheme } from "@/lib/sport-theme";

const quickActions = [
  "这场比赛有什么选题？",
  "帮我改成B站风格",
  "这段文案有风险吗？",
  "给我三个标题"
];

export function FloatingKnowledgeAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("这场比赛有什么选题？");
  const [copied, setCopied] = useState(false);
  const theme = getSportTheme("football");
  const workflow = useMemo(() => (open ? readWorkflowState() : null), [open]);
  const answer = useMemo(() => answerQuestion(query, workflow), [query, workflow]);

  async function insertAnswer() {
    await copyToClipboard(answer);
    if (query.includes("风险")) writeReviewDraft(workflow?.generatedContent?.body ?? answer);
    writeWorkflowState({ knowledgeContext: [...(workflow?.knowledgeContext ?? []), answer].slice(-8) });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-[min(390px,calc(100vw-24px))] rounded-[28px] border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/20 max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: theme.primary }}>
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold">AI 内容助手</div>
                <div className="text-xs text-slate-500">{workflow?.currentMatch?.matchInfo.name ?? "等待选择比赛"}</div>
              </div>
            </div>
            <button className="rounded-full p-2 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)} aria-label="关闭 AI 内容助手">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <button
                key={action}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-white"
                onClick={() => setQuery(action)}
              >
                {action}
              </button>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent outline-none"
              placeholder="问选题、平台文案、风险表达"
            />
          </label>

          <div className="mt-4 rounded-2xl p-4 text-sm leading-7" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
            <div className="flex items-center gap-2 font-semibold" style={{ color: theme.strongText }}>
              <MessageSquareText className="h-4 w-4" />
              建议回答
            </div>
            <p className="mt-2 whitespace-pre-wrap">{answer}</p>
          </div>

          <button
            type="button"
            onClick={() => void insertAnswer()}
            className="mt-3 h-11 w-full rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: theme.primary }}
          >
            {copied ? "已复制并写入上下文" : "复制 / 插入当前模块"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:-translate-y-1"
          style={{ backgroundColor: theme.primary, boxShadow: `0 20px 44px ${theme.heroGlow}` }}
          aria-label="打开 AI 内容助手"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

function answerQuestion(query: string, workflow: ReturnType<typeof readWorkflowState> | null) {
  if (!workflow?.currentMatch) {
    return "请先从首页选择一场比赛。选择后，我可以读取当前比赛、选题、文案和审稿结果。";
  }

  const match = workflow.currentMatch.matchInfo;
  const topic = workflow.selectedTopic;
  const draft = workflow.generatedContent;
  const review = workflow.reviewResult;

  if (query.includes("选题")) {
    const base = topic ? `当前主推选题是《${topic.title}》，适合从“${topic.coreAngle}”切入。` : "当前还没有选择选题，建议先点击单场页的“生成选题”。";
    const signals = workflow.currentMatch.hotSignals.slice(0, 3).map((item) => item.topicSeed).join(" / ");
    return `${base}\n可结合热点信号：${signals || "暂无热点信号"}。`;
  }

  if (query.includes("B站")) {
    return `B站建议做深度复盘：标题围绕《${topic?.title ?? match.name}》，结构用“比分钩子 → 关键事件 → 数据解释 → 球员叙事 → 评论区问题”。`;
  }

  if (query.includes("风险")) {
    return review
      ? `当前审稿等级：${review.level}，分数：${review.score}。建议：${review.advice}。如涉及伤病、判罚或黑幕类表达，请改成“需核实”“引发讨论”“建议补充来源”。`
      : `可以先把当前文案送入风险审稿。待审稿文案摘要：${draft?.title ?? "暂无生成文案"}`;
  }

  if (query.includes("标题")) {
    return [
      `1. ${match.score} 之后，${match.name} 真正该看什么？`,
      `2. ${topic?.title ?? "这场比赛的关键转折"}：别只看比分`,
      `3. 从数据到热点，拆开 ${match.teamA} vs ${match.teamB}`
    ].join("\n");
  }

  return `当前上下文：${match.name}，比分 ${match.score}。建议先生成赛事分析和选题，再按平台生成文案并送入审稿。`;
}
