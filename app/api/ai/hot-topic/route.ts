import { NextResponse } from "next/server";

import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import {
  buildHotAnalysis,
  buildTopicIntro,
  type HotAnalysisResult,
  type HotInsight
} from "@/lib/hot/hotTopicWorkflow";
import type { HotTopic } from "@/lib/hot/types";

export const dynamic = "force-dynamic";

type HotTopicAiPayload = {
  intro?: string;
  overview?: Partial<HotInsight>[];
  production?: Partial<HotInsight>[];
  whyCare?: string[];
  relation?: string[];
  angles?: string[];
  platforms?: string[];
  factsToVerify?: string[];
  risks?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { topic?: HotTopic; apiKey?: string };
    if (!body.topic) {
      return NextResponse.json(
        {
          sourceStatus: "error",
          message: "topic is required."
        },
        { status: 400 }
      );
    }

    const fallbackIntro = buildTopicIntro(body.topic);
    const fallbackAnalysis = buildHotAnalysis(body.topic);

    const result = await generateDeepSeekJson<HotTopicAiPayload>(
      [
        {
          role: "system",
          content:
            "你是体育内容运营编辑总监。你只输出严格 JSON，不要 Markdown。任务是把热点分析写得短、准、可执行，避免空话。必须基于用户提供的热点 title、summary、source、platform、valueScore、category、tags。不能编造比分、球员发言、比赛细节。若信息不足，明确写“需二次核验”。overview 和 production 各输出 3 条，每条只包含 label、value、note。value 必须短，像标签；note 必须一句话说明原因。whyCare、relation、angles、platforms、factsToVerify、risks 各控制在 1-2 条。intro 是 50-90 字基本介绍，先说发生了什么，再说哪些事实仍需核验。"
        },
        {
          role: "user",
          content: JSON.stringify({
            topic: body.topic,
            outputShape: {
              intro: "50到90字的基本介绍",
              overview: [{ label: "价值判断", value: "高价值", note: "一句说明原因" }],
              production: [{ label: "主推平台", value: "微博", note: "一句说明原因" }],
              whyCare: ["1条"],
              relation: ["1条"],
              angles: ["1条"],
              platforms: ["1条"],
              factsToVerify: ["1条"],
              risks: ["1条"]
            }
          })
        }
      ],
      { timeoutMs: 30000, apiKey: body.apiKey }
    );

    if (!result.ok) {
      return NextResponse.json({
        sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
        intro: fallbackIntro,
        analysis: fallbackAnalysis,
        message: result.message
      });
    }

    const analysis = normalizeAnalysis(result.data, fallbackAnalysis);
    const intro = normalizeIntro(result.data.intro, fallbackIntro);

    return NextResponse.json({
      sourceStatus: "live",
      intro,
      analysis,
      model: result.model
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown hot topic AI error.";
    return NextResponse.json(
      {
        sourceStatus: "error",
        message
      },
      { status: 500 }
    );
  }
}

function normalizeIntro(value: string | undefined, fallback: string) {
  if (typeof value !== "string") return fallback;
  const next = value.trim();
  return next || fallback;
}

function normalizeAnalysis(input: HotTopicAiPayload, fallback: HotAnalysisResult): HotAnalysisResult {
  return {
    overview: normalizeInsights(input.overview, fallback.overview),
    production: normalizeInsights(input.production, fallback.production),
    whyCare: normalizeList(input.whyCare, fallback.whyCare, 2),
    relation: normalizeList(input.relation, fallback.relation, 2),
    angles: normalizeList(input.angles, fallback.angles, 2),
    platforms: normalizeList(input.platforms, fallback.platforms, 2),
    factsToVerify: normalizeList(input.factsToVerify, fallback.factsToVerify, 2),
    risks: normalizeList(input.risks, fallback.risks, 2)
  };
}

function normalizeInsights(input: Partial<HotInsight>[] | undefined, fallback: HotInsight[]) {
  if (!Array.isArray(input)) return fallback;
  const list = input
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : "",
      value: typeof item.value === "string" && item.value.trim() ? item.value.trim() : "",
      note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : ""
    }))
    .filter((item) => item.label && item.value && item.note)
    .slice(0, 3);
  return list.length ? list : fallback;
}

function normalizeList(input: string[] | undefined, fallback: string[], limit: number) {
  if (!Array.isArray(input)) return fallback;
  const list = input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
  return list.length ? list : fallback.slice(0, limit);
}
