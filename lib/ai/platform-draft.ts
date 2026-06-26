import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { cleanText, ensurePublishable } from "@/lib/ai/quality";
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
          [
            "你是体育内容运营编辑，只输出严格 JSON，不要 Markdown。",
            "先在内部完成三步判断：这场比赛有什么已知事实、哪个热点最值得做、当前平台应该怎么表达。最终不要输出推理过程。",
            "只基于输入的比赛事实、事件、数据和热点信号生成，不编造伤病、采访、内部矛盾、裁判动机、社媒热搜或未给出的比分。",
            "文案要像真实运营稿，短、准、可发布；不要写任务说明、不要写模板腔、不要用无关历史案例兜底。",
            "如果事实不够，只能把不确定点放进 risk，direct 里不要假装确定。"
          ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "生成当前赛事详情页的一个平台内容产物。direct 是可直接发布版，必须排最前；reference 是编辑参考；risk 是风险提示。选题要具体到做法，例如动漫角色介绍球星、时间线复盘、数据卡拆解、评论区问题，而不是泛泛分析。",
          hardRules: [
            "title 必须来自当前 topic、热点或本场比赛，不得套用示例标题。",
            "title 不要连续冒号，不要“为什么会成为传播爆点”这类机械模板。",
            "direct 必须能直接复制发布，保留人话和平台感，不要长段 AI 分析。",
            "reference 只写执行结构、素材顺序和表达抓手。",
            "risk 只写需要核验或不能定性的点。"
          ],
          outputShape: {
            title: "短标题",
            direct: "可直接发布版",
            reference: "编辑参考版",
            risk: "风险提示版"
          },
          fewShotStyleOnly: {
            bilibili: ["这球没进，反而更值得复盘", "别只看比分，这段才是转折"],
            weibo: ["这次机会真有点可惜", "这场的讨论点来了"],
            xiaohongshu: ["这场球最值得记的3个瞬间", "新手也能看懂这次转折"],
            article: ["比分之外，这场比赛真正能写什么"]
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
    { timeoutMs: 35_000, apiKey, quality: "quality", reasoningEffort: "high" }
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

  const title = buildDraftTitle(result.data.title || topic.title, topic, platform);
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

function buildDraftTitle(input: string | undefined, topic: WorkflowTopic, platform: PlatformKey) {
  const base = cleanText(input || topic.title || `${platformLabel(platform)}内容`)
    .split("\n")[0]
    .replace(/^【.+?】/, "")
    .replace(/^#/, "")
    .replace(/^(标题|选题|主题)[：:]\s*/, "")
    .replace(/[。！？!?]+$/g, "")
    .replace(/[：:]{2,}/g, "：")
    .trim();

  const title = base || cleanText(topic.title || `${platformLabel(platform)}内容`);
  const maxLength = platform === "weibo" ? 22 : platform === "xiaohongshu" ? 20 : platform === "article" ? 30 : 28;
  return title.length > maxLength ? title.slice(0, maxLength) : title;
}
