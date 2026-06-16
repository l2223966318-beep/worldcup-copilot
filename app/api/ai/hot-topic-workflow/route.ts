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

  const result = await generateDeepSeekJson<GeneratePayload>(
    [
      {
        role: "system",
        content:
          "你是体育内容运营编辑。你只输出严格 JSON，不要 Markdown。任务是基于热点信息生成一段可直接使用的中文内容。必须遵守：1. 只能基于 title、summary、source、platform、url、category、valueScore、tags 和明确给出的配置写作。2. 不得编造比分、球员发言、受伤、判罚细节、官方结论。3. 信息不足时必须明确写“需核实”或“目前只能确认存在讨论”。4. 输出必须真的可发，不要空话，不要模板腔。5. 不同平台风格要明显区分：B站偏结构和互动，微博偏短评和讨论钩子，小红书偏卡片标题和解释，抖音偏前三秒钩子和口播节奏，通用版偏稳妥概述。最终只返回 {\"draft\":\"...\"}。"
      },
      {
        role: "user",
        content: JSON.stringify({
          topic,
          config,
          outputGoal: {
            draft: "完整可编辑文案，保留分段和换行，长度跟随配置，必要时点明需核实项"
          }
        })
      }
    ],
    { timeoutMs: 30000, apiKey }
  );

  if (!result.ok) {
    return NextResponse.json({
      sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
      draft: fallbackDraft,
      message: result.message
    });
  }

  const draft = normalizeDraft(result.data.draft, fallbackDraft);
  return NextResponse.json({
    sourceStatus: "live",
    draft,
    model: result.model
  });
}

async function handleAudit(topic: HotTopic, config: HotGenerationConfig, draft: string, apiKey?: string) {
  const fallbackAudit = qualityControl(auditHotDraft(draft, topic, config.platform));

  const result = await generateDeepSeekJson<AuditPayload>(
    [
      {
        role: "system",
        content:
          "你是体育内容审核编辑。你只输出严格 JSON，不要 Markdown。你要审核一段准备发布的体育热点内容，输出字段：level、authenticity、risk、ethics、platformFit、suggestions、rewriteSuggestion。规则：1. level 只能是 pass / revise / block。2. 必须根据输入文本具体判断，不要泛泛而谈。3. 真实性重点查未核验事实、比分、球员、伤病、裁判、官方结论。4. 风险重点查造谣、引战、人身攻击、地域歧视、标题党、版权和平台不适配。5. rewriteSuggestion 必须是一版更稳妥、可直接替换的完整文本，且不能保留高风险定性词。6. 如果信息不足，明确写“需核实”。"
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
    { timeoutMs: 30000, apiKey }
  );

  if (!result.ok) {
    return NextResponse.json({
      sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
      audit: fallbackAudit,
      message: result.message
    });
  }

  const audit = normalizeAudit(result.data, fallbackAudit);
  return NextResponse.json({
    sourceStatus: "live",
    audit,
    model: result.model
  });
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
    .slice(0, 4);
  return list.length ? list : fallback;
}
