import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { cleanText, ensurePublishable } from "@/lib/ai/quality";
import type { MatchContext, ReviewResultSnapshot } from "@/types/workflow";

type AiReviewDraft = {
  level?: string;
  score?: number;
  riskPoints?: string[];
  rewriteSuggestion?: string;
  checklist?: string[];
  findings?: Array<{ type?: string; sentence?: string; rewrite?: string }>;
};

export async function reviewDraftWithAi(input: {
  draft: string;
  matchContext: MatchContext;
  apiKey?: string;
}): Promise<{
  sourceStatus: "live" | "fallback" | "error";
  result?: ReviewResultSnapshot;
  riskPoints?: string[];
  rewriteSuggestion?: string;
  checklist?: string[];
  model?: string;
  message?: string;
}> {
  const result = await generateDeepSeekJson<AiReviewDraft>(
    [
      {
        role: "system",
        content:
          [
            "你是体育内容发布审稿编辑，只输出严格 JSON，不要 Markdown。",
            "先在内部按真实发布流程审稿：逐句找事实断言、判断是否有当前比赛依据、识别高风险表达、给出可直接替换的改写。最终不要输出推理过程。",
            "审核重点是事实边界、无来源断言、伤病/判罚/冲突/内部消息、引战词、模板腔。",
            "给出的改写必须可直接发布，不能新增事实；不确定的内容要改成“需核验”“目前只能确认”。",
            "不要每次都机械输出同一句风险提示，必须针对稿件里的具体句子。"
          ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "审核这段赛事内容，并给出可应用的改写版本。不要输出长解释。",
          hardRules: [
            "riskPoints 必须指出具体问题，不要泛泛写“需核验来源”。",
            "rewriteSuggestion 必须是一版改好的发布稿，不是建议清单。",
            "findings 中 sentence 必须引用原稿中的问题句；如果没有明显问题，findings 返回空数组。",
            "checklist 只保留发布前必须确认的事项，最多 4 条。"
          ],
          outputShape: {
            level: "低/中/高",
            score: 0,
            riskPoints: ["风险点"],
            rewriteSuggestion: "改写后可发布稿",
            checklist: ["发布前检查项"],
            findings: [{ type: "问题类型", sentence: "原句", rewrite: "建议改写" }]
          },
          matchContext: input.matchContext,
          draft: input.draft
        })
      }
    ],
    { timeoutMs: 35_000, apiKey: input.apiKey, quality: "quality", reasoningEffort: "high" }
  );

  if (!result.ok) {
    return {
      sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
      message: result.message
    };
  }

  const level = normalizeLevel(result.data.level);
  const score = normalizeScore(result.data.score, level);
  const riskPoints = normalizeList(result.data.riskPoints, ["未命中高风险表达，仍需核验数据、事件和素材来源。"]);
  const rewriteSuggestion = ensurePublishable(result.data.rewriteSuggestion || input.draft);
  const checklist = normalizeList(result.data.checklist, [
    "比分和事件只引用当前比赛已知信息",
    "伤病、判罚、冲突和内部消息保留需核验",
    "标题避免黑幕、保送、全网都在骂等定性词"
  ]);

  return {
    sourceStatus: "live",
    model: result.model,
    riskPoints,
    rewriteSuggestion,
    checklist,
    result: {
      level,
      score,
      advice: level === "高" ? "建议暂缓" : level === "中" ? "修改后发布" : "可发布",
      findings: (result.data.findings ?? []).slice(0, 5).map((finding) => ({
        type: cleanText(finding.type || "风险表达"),
        sentence: cleanText(finding.sentence || ""),
        rewrite: ensurePublishable(finding.rewrite || rewriteSuggestion)
      }))
    }
  };
}

function normalizeLevel(value: unknown): ReviewResultSnapshot["level"] {
  if (value === "高" || value === "中" || value === "低") return value;
  return "低";
}

function normalizeScore(value: unknown, level: string) {
  const score = Number(value);
  if (Number.isFinite(score)) return Math.max(0, Math.min(100, Math.round(score)));
  if (level === "高") return 72;
  if (level === "中") return 42;
  return 12;
}

function normalizeList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const list = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => cleanText(item));
  return list.length ? list : fallback;
}
