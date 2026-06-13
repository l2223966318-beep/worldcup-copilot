"use client";

import { useMemo, useState } from "react";
import { Bot, MessageSquareText, Search, Sparkles, X } from "lucide-react";

import { searchKnowledgeBase, suggestKnowledgeTerms } from "@/lib/project-api";
import { getSportTheme } from "@/lib/sport-theme";

const quickActions = [
  "问这场比赛怎么做内容",
  "改写标题",
  "生成微博文案",
  "检查表达风险"
];

export function FloatingKnowledgeAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("这场比赛怎么做内容？");
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const terms = useMemo(() => suggestKnowledgeTerms(), []);
  const theme = getSportTheme("football");
  const answer = useMemo(() => {
    if (query.includes("这场比赛")) return "建议先做“梅西职业生涯最后拼图”的人物复盘，再用控球率、射正和 xG 支撑战术解释，微博负责承接讨论，小红书做新手看球解释。";
    if (query.includes("标题")) return "可以改成：梅西最后拼图，不只是冠军，而是一场时代交接的决赛。";
    if (query.includes("微博")) return "这场决赛最值得聊的不是谁压过谁，而是梅西和姆巴佩把两代球星的竞技张力推到最高点。";
    if (query.includes("风险")) return "避免使用黑哨、黑幕、保送、确认伤退等定性词。建议写成“引发讨论”“仍需核实”“建议补充来源”。";
    return searchKnowledgeBase(query, "worldcup-2026-ops");
  }, [query]);

  function handleAction(action: string) {
    setQuery(action);
    setCopiedAction(action);
    window.setTimeout(() => setCopiedAction(null), 1200);
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
                <div className="text-xs text-slate-500">标题、平台文案、风险表达随时问</div>
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
                onClick={() => handleAction(action)}
              >
                {copiedAction === action ? "已选择：" : ""}
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
              placeholder="搜索足球术语、平台文案、表达风险"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {terms.slice(0, 4).map((term) => (
              <button
                key={term}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: theme.background, color: theme.secondary }}
                onClick={() => setQuery(term)}
              >
                {term}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl p-4 text-sm leading-7" style={{ backgroundColor: theme.background, color: theme.mutedText }}>
            <div className="flex items-center gap-2 font-semibold" style={{ color: theme.strongText }}>
              <MessageSquareText className="h-4 w-4" />
              建议回答
            </div>
            <p className="mt-2">{answer}</p>
          </div>
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
