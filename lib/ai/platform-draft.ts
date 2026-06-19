import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { cleanTitle, ensurePublishable } from "@/lib/ai/quality";
import { contentTypeOptions, platformLabel, topicModeOptions, type ContentTypeKey, type TopicModeKey } from "@/lib/services/contentService";
import type { AnalysisResult, MatchContext, PlatformDraft, PlatformKey, WorkflowTopic } from "@/types/workflow";

type AiPlatformDraft = {
  title?: string;
  direct?: string;
  reference?: string;
  risk?: string;
};

export async function generatePlatformDraftWithAi(input: {
  platform: PlatformKey;
  contentType: ContentTypeKey;
  topicMode: TopicModeKey;
  matchContext: MatchContext;
  topic: WorkflowTopic;
  analysis: AnalysisResult;
  apiKey?: string;
}): Promise<{ sourceStatus: "live" | "fallback" | "error"; draft?: PlatformDraft; model?: string; message?: string }> {
  const { platform, contentType, topicMode, matchContext, topic, analysis, apiKey } = input;
  const result = await generateDeepSeekJson<AiPlatformDraft>(
    [
      {
        role: "system",
        content:
          "你是体育内容运营编辑，只输出严格 JSON。只基于输入的比赛事实、事件、数据和热点信号生成，不编造伤病、采访、内部矛盾、裁判动机或社媒热搜。文案要像真实运营稿，短、准、可发布，不要模板说明。"
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "生成当前赛事详情页的一个平台内容产物。direct 是可直接发布版，必须排最前；reference 是编辑参考；risk 是风险提示。选题要具体到做法，例如动漫角色介绍球星、时间线复盘、数据卡拆解、评论区问题，而不是泛泛分析。",
          outputShape: {
            title: "短标题",
            direct: "可直接发布版",
            reference: "编辑参考版",
            risk: "风险提示版"
          },
          platform: platformLabel(platform),
          contentType: optionLabel(contentTypeOptions, contentType),
          topicMode: optionLabel(topicModeOptions, topicMode),
          matchContext,
          topic,
          analysis
        })
      }
    ],
    { timeoutMs: 22_000, apiKey, quality: "quality" }
  );

  if (!result.ok) {
    return {
      sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
      message: result.message
    };
  }

  const sections = [
    { title: "可直接发布版", content: ensurePublishable(result.data.direct || "") },
    { title: "编辑参考版", content: ensurePublishable(result.data.reference || "") },
    { title: "风险提示版", content: ensurePublishable(result.data.risk || "") }
  ].filter((section) => section.content);

  if (!sections.length) {
    return { sourceStatus: "error", model: result.model, message: "AI draft is empty." };
  }

  const title = cleanTitle(result.data.title || sections[0].content.split("\n")[0] || topic.title, platform === "videoScript" ? "douyin" : platform);
  return {
    sourceStatus: "live",
    model: result.model,
    draft: {
      id: `${matchContext.id}-${topic.id}-${platform}-${Date.now()}`,
      platform,
      title,
      sections,
      body: sections.map((section) => `【${section.title}】\n${section.content}`).join("\n\n"),
      createdAt: new Date().toISOString()
    }
  };
}

function optionLabel<T extends string>(options: Array<{ key: T; label: string }>, key: T) {
  return options.find((item) => item.key === key)?.label ?? key;
}
