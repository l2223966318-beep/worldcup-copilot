import { NextResponse } from "next/server";

import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { qualityControl } from "@/lib/ai/quality";
import {
  auditHotDraft,
  generateHotDraft,
  type HotAuditResult,
  type HotGenerationConfig
} from "@/lib/hot/hotTopicWorkflow";
import type { HotTopic } from "@/lib/hot/types";

export const dynamic = "force-dynamic";

type WorkflowAction = "generate" | "audit";

type GeneratePayload = {
  draft?: string;
};

type AuditPayload = {
  level?: HotAuditResult["level"];
  authenticity?: string[];
  risk?: string[];
  ethics?: string[];
  platformFit?: string[];
  suggestions?: string[];
  rewriteSuggestion?: string;
};

type GenerateCacheEntry = {
  expiresAt: number;
  payload: {
    sourceStatus: "live";
    draft: string;
    model?: string;
  };
};

type AuditCacheEntry = {
  expiresAt: number;
  payload: {
    sourceStatus: "live";
    audit: HotAuditResult;
    model?: string;
  };
};

const HOT_WORKFLOW_AI_CACHE_TTL_MS = Number(process.env.HOT_WORKFLOW_AI_CACHE_TTL_MS ?? 10 * 60_000);
const HOT_WORKFLOW_GENERATE_TIMEOUT_MS = Number(process.env.HOT_WORKFLOW_GENERATE_TIMEOUT_MS ?? 35_000);
const HOT_WORKFLOW_AUDIT_TIMEOUT_MS = Number(process.env.HOT_WORKFLOW_AUDIT_TIMEOUT_MS ?? 30_000);
const generateCache = new Map<string, GenerateCacheEntry>();
const auditCache = new Map<string, AuditCacheEntry>();

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: WorkflowAction;
      topic?: HotTopic;
      config?: HotGenerationConfig;
      draft?: string;
      apiKey?: string;
    };

    if (!body.topic || !body.config || !body.action) {
      return NextResponse.json(
        {
          sourceStatus: "error",
          message: "action、topic、config 均为必填。"
        },
        { status: 400 }
      );
    }

    if (body.action === "generate") {
      return handleGenerate(body.topic, body.config, body.apiKey);
    }

    if (!body.draft?.trim()) {
      return NextResponse.json(
        {
          sourceStatus: "error",
          message: "draft is required for audit."
        },
        { status: 400 }
      );
    }

    return handleAudit(body.topic, body.config, body.draft, body.apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown hot topic workflow error.";
    return NextResponse.json(
      {
        sourceStatus: "error",
        message
      },
      { status: 500 }
    );
  }
}

async function handleGenerate(topic: HotTopic, config: HotGenerationConfig, apiKey?: string) {
  const fallbackDraft = qualityControl(generateHotDraft(topic, config));
  const cacheKey = buildGenerateCacheKey(topic, config);
  const cached = generateCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  const result = await generateDeepSeekJson<GeneratePayload>(
    [
      {
        role: "system",
        content: [
          "你是体育赛事内容运营编辑，只输出严格 JSON，不要 Markdown。",
          "先在内部判断：热点事实是否足够、当前平台用户会关心什么、这个内容应该做成哪种可发布形态。最终不要输出推理过程。",
          "任务：基于一个热点生成可直接编辑发布的中文内容。",
          "硬规则：只能使用热点 title、summary、source、platform、url、category、valueScore、tags 和用户配置；不得编造比分、球员发言、伤病、判罚细节、官方结论。",
          "信息不足时必须写“需核实”或“目前只能确认存在讨论”。",
          "不同平台必须彻底分开写法，不共用同一套模板。",
          "成稿要像真人运营会发的内容：开头有钩子，中段有信息，结尾有讨论或行动，但不要营销号腔。",
          platformInstruction(config),
          lengthInstruction(config),
          "最终只返回 {\"draft\":\"...\"}。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          topic,
          config,
          outputGoal: {
            draft: "生成一段完整可编辑文案；保留换行；必须贴合所选平台、内容类型、语气和长度；必要处标注需核验。"
          }
        })
      }
    ],
    { timeoutMs: HOT_WORKFLOW_GENERATE_TIMEOUT_MS, apiKey, quality: "quality", reasoningEffort: "high" }
  );

  if (!result.ok) {
    return NextResponse.json({
      sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
      draft: fallbackDraft,
      message: result.message
    });
  }

  const draft = normalizeDraft(result.data.draft, fallbackDraft);
  const payload = {
    sourceStatus: "live",
    draft,
    model: result.model
  } as const;
  generateCache.set(cacheKey, { expiresAt: Date.now() + HOT_WORKFLOW_AI_CACHE_TTL_MS, payload });
  return NextResponse.json(payload);
}

async function handleAudit(topic: HotTopic, config: HotGenerationConfig, draft: string, apiKey?: string) {
  const fallbackAudit = qualityControl(auditHotDraft(draft, topic, config.platform));
  const cacheKey = buildAuditCacheKey(topic, config, draft);
  const cached = auditCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  const result = await generateDeepSeekJson<AuditPayload>(
    [
      {
        role: "system",
        content: [
          "你是体育内容审稿编辑，只输出严格 JSON，不要 Markdown。",
          "任务：审稿一段准备发布的体育热点内容。",
          "必须指出具体风险句子，不能只写泛泛风险。",
          "输出字段：level、authenticity、risk、ethics、platformFit、suggestions、rewriteSuggestion。",
          "level 只能是 pass / revise / block。",
          "authenticity：指出未核验事实、比分、球员、伤病、裁判、官方结论等具体句子。",
          "risk：指出造谣、引战、人身攻击、地域歧视、标题党、版权、平台不适配等具体句子。",
          "ethics：指出过度煽动、断章取义、诱导网暴等问题。",
          "platformFit：判断是否适合所选平台。",
          "suggestions：给出可直接执行的修改建议。",
          "rewriteSuggestion：必须给出一版完整可替换文本，删除高风险定性词，保留可核验表达；信息不足时写“需核实”。"
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          topic,
          config,
          draft
        })
      }
    ],
    { timeoutMs: HOT_WORKFLOW_AUDIT_TIMEOUT_MS, apiKey, quality: "quality", reasoningEffort: "high" }
  );

  if (!result.ok) {
    return NextResponse.json({
      sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
      audit: fallbackAudit,
      message: result.message
    });
  }

  const audit = normalizeAudit(result.data, fallbackAudit);
  const payload = {
    sourceStatus: "live",
    audit,
    model: result.model
  } as const;
  auditCache.set(cacheKey, { expiresAt: Date.now() + HOT_WORKFLOW_AI_CACHE_TTL_MS, payload });
  return NextResponse.json(payload);
}

function platformInstruction(config: HotGenerationConfig) {
  switch (config.platform) {
    case "B站":
      return "B站写法：标题要有观点和信息密度；正文包含开头钩子、视频结构、弹幕互动点、评论区问题；适合深度复盘和观点解释。";
    case "微博":
      return "微博写法：先给 1 句短评，再给话题标签、讨论钩子和降风险表述；适合热点承接，不写长篇铺垫。";
    case "小红书":
      return "小红书写法：输出首图标题、3-5 页卡片结构、新手能懂的解释、收藏理由；语气清楚但不过度标题党。";
    case "抖音":
      return "抖音写法：必须有前三秒钩子、分镜、口播节奏和画面素材建议；先抓注意力，再回到事实核验。";
    default:
      return "通用写法：稳妥概述热点、说明可用角度、标注需核验信息和发布风险。";
  }
}

function lengthInstruction(config: HotGenerationConfig) {
  if (config.length === "短") return "长度：短，控制在 120-220 字或等量结构。";
  if (config.length === "长") return "长度：长，给出完整结构和可直接展开的段落。";
  return "长度：中，信息完整但避免冗长。";
}

function buildGenerateCacheKey(topic: HotTopic, config: HotGenerationConfig) {
  return [
    "generate",
    topic.id,
    topic.title,
    topic.updatedAt ?? "",
    config.platform,
    config.contentType,
    config.tone,
    config.length,
    config.useMatchFacts ? "facts" : "nofacts",
    config.includeRiskReminder ? "risk" : "norisk"
  ].join("::");
}

function buildAuditCacheKey(topic: HotTopic, config: HotGenerationConfig, draft: string) {
  return [
    "audit",
    topic.id,
    config.platform,
    config.contentType,
    simpleHash(draft)
  ].join("::");
}

function simpleHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return String(hash);
}

function normalizeDraft(value: string | undefined, fallback: string) {
  if (typeof value !== "string") return fallback;
  const next = qualityControl(value.trim());
  return next || fallback;
}

function normalizeAudit(input: AuditPayload, fallback: HotAuditResult): HotAuditResult {
  const level = input.level === "pass" || input.level === "revise" || input.level === "block" ? input.level : fallback.level;
  return qualityControl({
    level,
    authenticity: normalizeList(input.authenticity, fallback.authenticity),
    risk: normalizeList(input.risk, fallback.risk),
    ethics: normalizeList(input.ethics, fallback.ethics),
    platformFit: normalizeList(input.platformFit, fallback.platformFit),
    suggestions: normalizeList(input.suggestions, fallback.suggestions),
    rewriteSuggestion: normalizeDraft(input.rewriteSuggestion, fallback.rewriteSuggestion)
  });
}

function normalizeList(value: string[] | undefined, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const list = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
  return list.length ? list : fallback;
}
