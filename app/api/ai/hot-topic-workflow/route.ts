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
const HOT_WORKFLOW_GENERATE_TIMEOUT_MS = Number(process.env.HOT_WORKFLOW_GENERATE_TIMEOUT_MS ?? 24_000);
const HOT_WORKFLOW_AUDIT_TIMEOUT_MS = Number(process.env.HOT_WORKFLOW_AUDIT_TIMEOUT_MS ?? 20_000);
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
          "任务：严格按用户选择的生成类型和风格类型，基于一个热点生成中文内容。",
          "硬规则：只能使用热点 title、summary、source、platform、url、category、valueScore、tags 和用户配置；不得编造比分、球员发言、伤病、判罚细节、官方结论。",
          "不要机械添加“需核实”“数据未知”“目前只能确认存在讨论”。只有文案确实需要使用、但输入没有提供的具体事实才标明信息边界。",
          "不同平台必须彻底分开写法，不共用同一套模板。",
          "选择“选题”时只生成正好5个作品角度，每个仅含“角度标题、怎么做、说明”，不能写成完整稿件。",
          "选择其他类型时才生成对应成品，不要混入其他生成类型的结构。",
          platformInstruction(config),
          contentTypeInstruction(config),
          styleInstruction(config),
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
            draft: config.contentType === "选题"
              ? "正好5个可制作的作品角度；格式为“1. 角度标题\\n怎么做：...\\n说明：...”；至少包含二创、叙事、数据或互动中的不同方法。"
              : "生成与所选平台、生成类型、风格类型和长度严格一致的可编辑内容。"
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

  const draft = normalizeGeneratedDraft(result.data.draft, fallbackDraft, config);
  const payload = {
    sourceStatus: "live",
    draft,
    model: result.model
  } as const;
  generateCache.set(cacheKey, { expiresAt: Date.now() + HOT_WORKFLOW_AI_CACHE_TTL_MS, payload });
  return NextResponse.json(payload);
}

async function handleAudit(topic: HotTopic, config: HotGenerationConfig, draft: string, apiKey?: string) {
  const fallbackAudit = qualityControl(auditHotDraft(draft, topic, config.platform, config.contentType));
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
          "只指出原稿中真实存在的具体问题，必须引用问题词或问题句，不能输出泛泛风险。",
          "热点 title、summary、source 和 platform 已作为当前审稿依据；不要因为稿件来自热点源就默认判定“数据未知”或“来源需核实”。",
          "没有具体问题时对应数组返回空数组，level 返回 pass，rewriteSuggestion 原样返回稿件。",
          "输出字段：level、authenticity、risk、ethics、platformFit、suggestions、rewriteSuggestion。",
          "level 只能是 pass / revise / block。",
          "authenticity：指出未核验事实、比分、球员、伤病、裁判、官方结论等具体句子。",
          "risk：指出造谣、引战、人身攻击、地域歧视、标题党、版权、平台不适配等具体句子。",
          "ethics：指出过度煽动、断章取义、诱导网暴等问题。",
          "platformFit：判断是否适合所选平台。",
          "suggestions：只针对已发现的问题给出可执行建议；没有问题时返回空数组。",
          "rewriteSuggestion：只改存在问题的句子，不新增免责声明；没有问题时保持原稿不变。"
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

function contentTypeInstruction(config: HotGenerationConfig) {
  switch (config.contentType) {
    case "选题":
      return "选题规则：正好5项；角度必须是作品做法而不是成稿，可覆盖动漫二创、游戏二创、人物关系、事件时间线、数据拆解或球迷互动；五项不能同质化。";
    case "标题":
      return "标题规则：给出5个不同标题，只输出标题列表；短、准、有平台感，禁止连续冒号和机械问句。";
    case "短文案":
      return "短文案规则：输出一版可直接发布的短文案，先给有效信息，再给观点或讨论口，不写脚本结构。";
    case "视频脚本":
      return "视频脚本规则：按开场钩子、信息推进、关键证据、结尾互动组织，使用可口播的短句。";
    case "评论区互动":
      return "评论区互动规则：给出5个基于当前热点的具体问题，不引战，不泛泛询问“怎么看”。";
    case "图文卡片":
      return "图文卡片规则：输出封面和3至5页卡片结构，每页只承载一个信息点。";
  }
}

function styleInstruction(config: HotGenerationConfig) {
  switch (config.tone) {
    case "专业复盘":
      return "风格规则：用事件链和已有数据解释过程，不只复述热榜标题。";
    case "客观资讯":
      return "风格规则：按事实顺序写清热点内容和来源，不加入输入之外的判断。";
    case "球迷讨论":
      return "风格规则：保留讨论感和明确问题，但不制造球迷、球队或国家对立。";
    case "轻松整活":
      return "风格规则：允许梗、动漫或游戏包装，但必须让真实信息与二创表达清楚分开。";
    case "人物故事":
      return "风格规则：围绕热点中已出现的人物行动组织内容，不编造心理、采访或私生活。";
    case "数据解读":
      return "风格规则：只使用输入中已有的热度、价值分和分类信号，并解释数字代表什么。";
    case "稳妥表达":
      return "风格规则：区分事实、观点和讨论，不使用绝对化定性，也不机械堆叠风险提醒。";
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

function normalizeGeneratedDraft(value: string | undefined, fallback: string, config: HotGenerationConfig) {
  const draft = normalizeDraft(value, fallback);
  if (config.contentType !== "选题") return draft;

  const topicNumbers = draft.match(/^\d+\./gm) ?? [];
  const approaches = draft.match(/^怎么做：/gm) ?? [];
  const reasons = draft.match(/^说明：/gm) ?? [];
  if (topicNumbers.length !== 5 || approaches.length !== 5 || reasons.length !== 5) return fallback;
  return draft;
}

function normalizeAudit(input: AuditPayload, fallback: HotAuditResult): HotAuditResult {
  const level = input.level === "pass" || input.level === "revise" || input.level === "block" ? input.level : fallback.level;
  return qualityControl({
    level,
    authenticity: normalizeAuditList(input.authenticity, fallback.authenticity),
    risk: normalizeAuditList(input.risk, fallback.risk),
    ethics: normalizeAuditList(input.ethics, fallback.ethics),
    platformFit: normalizeAuditList(input.platformFit, fallback.platformFit),
    suggestions: normalizeAuditList(input.suggestions, fallback.suggestions),
    rewriteSuggestion: normalizeDraft(input.rewriteSuggestion, fallback.rewriteSuggestion)
  });
}

function normalizeAuditList(value: string[] | undefined, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}
