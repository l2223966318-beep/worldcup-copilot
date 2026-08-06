import { generateDeepSeekJson, getDeepSeekFallbackMessage } from "@/lib/ai/deepseek";
import { cleanText, ensurePublishable } from "@/lib/ai/quality";
import { contentTypeOptions, platformLabel, topicModeOptions, type ContentTypeKey, type TopicModeKey } from "@/lib/services/contentService";
import type { AnalysisResult, MatchContext, PlatformDraft, PlatformKey, WorkflowTopic } from "@/types/workflow";

type AiTopicAngle = {
  title?: string;
  approach?: string;
  reason?: string;
};

type AiPlatformDraft = {
  title?: string;
  direct?: string;
  reference?: string;
  risk?: string;
  topics?: AiTopicAngle[];
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
  const generationTask = contentType === "topic"
    ? {
        task: "基于当前选中的热点，生成正好5个可以做成作品的选题角度。",
        hardRules: [
          "每项只写角度标题、怎么做、说明，不要展开成完整稿件。",
          "角度必须是具体创作方法，不是泛泛的赛后复盘或专业分析。",
          "五项必须明显不同，可从动漫二创、游戏二创、事件时间线、人物关系、数据拆解、球迷互动中选择。",
          "所有角度必须对应当前热点和已知比赛事实，不得生搬示例或编造事件。",
          "标题、怎么做、说明中出现的每个比赛数字都必须能在 evidence 中找到；不要自行补算或猜测。",
          "只有 evidence 明确记录进球或绝杀时才能使用“绝杀”，普通射门、扑救和界外球不能写成绝杀。",
          "结合所选风格决定表达方法，但不要让五项变成同一种写法。",
          "不要输出可直接发布版、编辑参考版或风险提示版。"
        ],
        outputShape: {
          topics: [{
            title: "12至24字的角度名称",
            approach: "一句话说明作品怎么做",
            reason: "一句话说明它与当前热点或比赛事实的关系"
          }]
        },
        fewShotStyleOnly: [
          {
            title: "把关键球员做成动漫角色关系图",
            approach: "用角色定位解释球员关系，再用真实事件收束。",
            reason: "人物关系与当前比赛转折能够互相对应。"
          },
          {
            title: "用足球游戏任务重做关键回合",
            approach: "把比赛节点改写成游戏任务和回合复盘。",
            reason: "游戏二创能放大事件过程，但不改变事实。"
          }
        ]
      }
    : {
        task: "生成当前赛事详情页的一个平台内容产物。direct 是可直接发布版，必须排最前；reference 是编辑参考；risk 是风险提示。",
        hardRules: [
          "title 必须来自当前热点或本场比赛，不得套用示例标题。",
          "title 不要连续冒号，不要“为什么会成为传播爆点”这类机械模板。",
          "direct 必须匹配所选生成类型，能直接复制使用，保留人话和平台感，不要长段 AI 分析。",
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
        }
      };
  const result = await generateDeepSeekJson<AiPlatformDraft>(
    [
      {
        role: "system",
        content:
          [
            "你是体育内容运营编辑，只输出严格 JSON，不要 Markdown。",
            "先在内部完成三步判断：这场比赛有什么已知事实、哪个热点最值得做、当前平台应该怎么表达。最终不要输出推理过程。",
            "只基于输入的比赛事实、事件、数据和热点信号生成，不编造伤病、采访、内部矛盾、裁判动机、社媒热搜或未给出的比分。",
            "evidence 是唯一可用于具体比分、时间点、事件和技术统计的事实清单；未出现在 evidence 中的数字禁止写入成稿。",
            "verifiedStats=false 表示 stats 是界面占位值，禁止引用或据此推导比赛过程。",
            "文案要像真实运营稿，短、准、可发布；不要写任务说明、不要写模板腔、不要用无关历史案例兜底。",
            contentType === "topic"
              ? "当前任务是提出作品角度，不是写稿；输出5种不同的创作方法。"
              : "如果事实不够，只能把不确定点放进 risk，direct 里不要假装确定。"
          ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          ...generationTask,
          platform: platformLabel(platform),
          generationType: optionLabel(contentTypeOptions, contentType),
          generationTypeGuide: generationTypeGuide(contentType),
          styleType: optionLabel(topicModeOptions, topicMode),
          styleTypeGuide: styleTypeGuide(topicMode),
          matchContext,
          evidence: matchContext.evidence ?? [],
          topic,
          analysis
        })
      }
    ],
    { timeoutMs: 30_000, apiKey, quality: "fast", maxTokens: 2_000 }
  );

  if (!result.ok) {
    return {
      sourceStatus: "fallback",
      message: getDeepSeekFallbackMessage(result.message)
    };
  }

  if (contentType === "topic") {
    const topics = (result.data.topics ?? []).map((angle) => ({
      title: cleanText(angle.title || ""),
      approach: ensurePublishable(angle.approach || ""),
      reason: ensurePublishable(angle.reason || "")
    })).filter((angle) => angle.title && angle.approach && angle.reason);

    if (topics.length !== 5) {
      return { sourceStatus: "error", model: result.model, message: "AI topic angles must contain exactly five complete items." };
    }

    const sections = [{
      title: "选题角度",
      content: topics.map((angle, index) => [
        `${index + 1}. ${angle.title}`,
        `怎么做：${angle.approach}`,
        `说明：${angle.reason}`
      ].join("\n")).join("\n\n")
    }];

    return {
      sourceStatus: "live",
      model: result.model,
      draft: {
        id: `${matchContext.id}-${topic.id}-${platform}-${Date.now()}`,
        platform,
        title: "5个选题角度",
        sections,
        body: sections.map((section) => `【${section.title}】\n${section.content}`).join("\n\n"),
        createdAt: new Date().toISOString()
      }
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

function generationTypeGuide(type: ContentTypeKey) {
  const guides: Record<ContentTypeKey, string> = {
    topic: "只给5个可执行的作品角度，每项包含角度标题、怎么做和说明，不写成稿。",
    title: "给出5个彼此不同的短标题，符合所选平台长度和语气，不附正文。",
    shortCopy: "写一段可直接发布的短文案，先给比赛信息，再给一个观点或讨论口。",
    videoScript: "按开场钩子、事实推进、关键证据、结尾互动组织，短句口播，不写论文段落。",
    commentPrompt: "给出3个有具体比赛依据的互动问题，能引导讨论但不制造球迷对立。",
    cardStructure: "按封面和逐页卡片给出信息顺序，每页只承载一个结论或证据。"
  };
  return guides[type];
}

function styleTypeGuide(type: TopicModeKey) {
  const guides: Record<TopicModeKey, string> = {
    professional: "专业复盘必须结合关键事件和数据证据，解释过程，不只罗列比分。",
    objectiveNews: "客观资讯按事实先后写清比分、事件和来源，不加入未经证实的判断。",
    fanDiscussion: "球迷讨论保留鲜明讨论点，用问题打开交流，不使用引战或绝对化表达。",
    playful: "轻松整活可以使用梗、动漫或游戏包装，但必须让真实比赛事实清晰可辨。",
    playerStory: "人物故事围绕球员在本场已知事件中的作用，不编造采访、心理活动或私生活。",
    dataRead: "数据解读要比较双方数据并解释其意义，不能只抄数字或把相关性写成因果。",
    riskSafe: "稳妥表达要分开事实、观点和待核验信息，主动降低争议定性。"
  };
  return guides[type];
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
