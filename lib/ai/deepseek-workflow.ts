import type { MatchData } from "@/data/matches";
import { generatePlatformContent, type PlatformContent } from "@/lib/ai/content";
import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { qualityControl } from "@/lib/ai/quality";
import { buildSignalContext } from "@/lib/ai/signals";
import type { TopicCategory, TopicIdea, TopicRecommendation } from "@/lib/ai/topics";

type DeepSeekTopic = Partial<Omit<TopicIdea, "id">>;
type DeepSeekPlatformContent = Partial<{
  bilibili: Partial<PlatformContent["bilibili"]>;
  xiaohongshu: Partial<PlatformContent["xiaohongshu"]>;
  weibo: Partial<PlatformContent["weibo"]>;
  article: Partial<PlatformContent["article"]>;
}>;

type DeepSeekWorkflowResponse = {
  conclusions?: Array<{
    title?: string;
    body?: string;
    featured?: boolean;
  }>;
  topics?: DeepSeekTopic[];
  platformStrategy?: {
    bilibili?: string;
    weibo?: string;
    xiaohongshu?: string;
    article?: string;
  };
  platformContent?: DeepSeekPlatformContent;
};

export type MatchWorkflowEnhancement = {
  workflowVersion: "platform-content-v1";
  sourceStatus: "live" | "fallback" | "error";
  model?: string;
  message?: string;
  conclusions: Array<{
    title: string;
    body: string;
    featured?: boolean;
  }>;
  topics: TopicIdea[];
  platformStrategy?: DeepSeekWorkflowResponse["platformStrategy"];
  platformContent?: PlatformContent;
};

const categories: TopicCategory[] = ["战术复盘", "球员叙事", "数据解读", "历史对照", "争议讨论", "情绪共鸣", "冷知识科普", "平台热点"];
const recommendations: TopicRecommendation[] = ["主推", "次推", "观察", "谨慎发布"];

export async function enhanceMatchWorkflowWithDeepSeek(input: {
  match: MatchData;
  baselineTopics: TopicIdea[];
}): Promise<MatchWorkflowEnhancement> {
  const { match, baselineTopics } = input;
  const signalContext = buildSignalContext(match);
  const result = await generateDeepSeekJson<DeepSeekWorkflowResponse>(
    [
      {
        role: "system",
        content:
          "你是体育赛事内容运营总监。你只输出严格 JSON，不要 Markdown。基于真实比赛数据和场上热点信号给出可执行的运营结论、选题、平台策略和平台内容预览。选题优先级是：场上热点事件 > 关键进球事件 > 比分走势 > 球员表现 > 技术统计 > 历史背景。不能编造伤病、采访、内幕、社媒热搜或未提供的事实。涉及不确定信息必须使用“需核实”“建议补充来源”。"
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "增强 WorldCup Copilot 单场比赛工作流。输出 conclusions 3 条、topics 3 条、platformStrategy 和 platformContent。必须优先使用 matchSignals 中的乌龙球、球衣被扯破、VAR、争议判罚、冲突、伤病需核实等场上热点信号生成选题；不要只围绕比分或控球率。topics 与 platformContent 必须贴合当前比赛，不要套用梅西/姆巴佩等无关样例。",
          outputShape: {
            conclusions: [{ title: "为什么值得做", body: "80字以内", featured: false }],
            topics: [
              {
                title: "选题标题",
                coreAngle: "核心角度",
                category: "战术复盘/球员叙事/数据解读/历史对照/争议讨论/情绪共鸣/冷知识科普/平台热点",
                recommendation: "主推/次推/观察/谨慎发布",
                newsValue: 0,
                spreadPotential: 0,
                platformFit: 0,
                bilibiliFit: 0,
                xiaohongshuFit: 0,
                weiboFit: 0,
                shortVideoFit: 0,
                recommendedFormat: "推荐内容形式",
                difficulty: "低/中/高",
                productionCost: "低/中/高",
                riskLevel: "低/中/高",
                scoreReason: "评分理由",
                businessExplanation: "为什么推荐这个选题",
                reason: "数据依据",
                sampleTitles: ["示例标题1", "示例标题2"]
              }
            ],
            platformStrategy: {
              bilibili: "B站打法",
              weibo: "微博打法",
              xiaohongshu: "小红书打法",
              article: "公众号打法"
            },
            platformContent: {
              bilibili: {
                titles: ["视频标题1", "视频标题2"],
                coverCopy: "封面文案",
                openingScript: "开头 15 秒口播",
                outline: ["00:00 结构段落"],
                danmakuPoints: ["弹幕互动问题"]
              },
              weibo: {
                hashtags: ["#话题#"],
                fiveMinuteComment: "赛后 5 分钟快评",
                debateQuestion: "讨论钩子",
                riskTip: "风险提示"
              },
              xiaohongshu: {
                coverTitle: "首图标题",
                cardTitles: ["第1页", "第2页", "第3页", "第4页", "第5页"],
                cards: [{ title: "页标题", body: "正文" }],
                collectReason: "收藏理由"
              },
              article: {
                title: "公众号标题",
                intro: "导语",
                fullOutline: ["完整文章大纲"],
                ending: "结尾观点"
              }
            }
          },
          match,
          matchSignals: signalContext.signals,
          matchSignalSummary: signalContext.summary,
          baselineTopics
        })
      }
    ],
    { timeoutMs: 45_000 }
  );

  if (!result.ok) {
    return {
      workflowVersion: "platform-content-v1",
      sourceStatus: result.message.includes("DEEPSEEK_API_KEY") ? "fallback" : "error",
      message: result.message,
      conclusions: [],
      topics: []
    };
  }

  const topics = normalizeTopics(match.id, result.data.topics, baselineTopics);
  const fallbackContent = generatePlatformContent(match, topics[0] ?? baselineTopics[0]);

  return {
    workflowVersion: "platform-content-v1",
    sourceStatus: "live",
    model: result.model,
    conclusions: normalizeConclusions(result.data.conclusions),
    topics,
    platformStrategy: result.data.platformStrategy,
    platformContent: normalizePlatformContent(result.data.platformContent, fallbackContent)
  };
}

function normalizeConclusions(conclusions?: DeepSeekWorkflowResponse["conclusions"]) {
  return (conclusions ?? [])
    .filter((item) => item?.title && item?.body)
    .slice(0, 3)
    .map((item, index) => ({
      title: String(item.title),
      body: String(item.body),
      featured: Boolean(item.featured ?? index === 1)
    }));
}

function normalizeTopics(matchId: string, topics: DeepSeekTopic[] | undefined, fallback: TopicIdea[]) {
  const normalized = (topics ?? []).slice(0, 3).map((topic, index) => ({
    id: `${matchId}-deepseek-${index + 1}`,
    title: String(topic.title || fallback[index]?.title || "比赛内容运营选题"),
    coreAngle: String(topic.coreAngle || fallback[index]?.coreAngle || "基于比分、技术统计和关键事件拆解内容价值。"),
    category: normalizeEnum(topic.category, categories, fallback[index]?.category ?? "数据解读"),
    recommendation: normalizeEnum(topic.recommendation, recommendations, fallback[index]?.recommendation ?? "观察"),
    newsValue: normalizeScore(topic.newsValue, fallback[index]?.newsValue ?? 80),
    spreadPotential: normalizeScore(topic.spreadPotential, fallback[index]?.spreadPotential ?? 80),
    platformFit: normalizeScore(topic.platformFit, fallback[index]?.platformFit ?? 80),
    bilibiliFit: normalizeScore(topic.bilibiliFit, fallback[index]?.bilibiliFit ?? 82),
    xiaohongshuFit: normalizeScore(topic.xiaohongshuFit, fallback[index]?.xiaohongshuFit ?? 72),
    weiboFit: normalizeScore(topic.weiboFit, fallback[index]?.weiboFit ?? 82),
    shortVideoFit: normalizeScore(topic.shortVideoFit, fallback[index]?.shortVideoFit ?? 80),
    recommendedFormat: String(topic.recommendedFormat || fallback[index]?.recommendedFormat || "B站复盘 + 微博讨论"),
    difficulty: normalizeEnum(topic.difficulty, ["低", "中", "高"], fallback[index]?.difficulty ?? "中"),
    productionCost: normalizeEnum(topic.productionCost, ["低", "中", "高"], fallback[index]?.productionCost ?? "中"),
    riskLevel: normalizeEnum(topic.riskLevel, ["低", "中", "高"], fallback[index]?.riskLevel ?? "低"),
    scoreReason: String(topic.scoreReason || fallback[index]?.scoreReason || "数据和内容角度具备基础支撑。"),
    businessExplanation: String(topic.businessExplanation || fallback[index]?.businessExplanation || "适合用于赛事内容运营拆解。"),
    reason: String(topic.reason || fallback[index]?.reason || "基于当前比赛数据生成。"),
    sampleTitles: Array.isArray(topic.sampleTitles) && topic.sampleTitles.length
      ? topic.sampleTitles.slice(0, 3).map(String)
      : fallback[index]?.sampleTitles ?? ["从一场比赛看内容机会", "比分之外的赛事复盘角度"]
  }));

  return qualityControl(normalized.length ? normalized : fallback.slice(0, 3)) as TopicIdea[];
}

function normalizePlatformContent(content: DeepSeekPlatformContent | undefined, fallback: PlatformContent) {
  const normalized: PlatformContent = {
    ...fallback,
    bilibili: {
      ...fallback.bilibili,
      titles: stringList(content?.bilibili?.titles, fallback.bilibili.titles),
      coverCopy: stringValue(content?.bilibili?.coverCopy, fallback.bilibili.coverCopy),
      openingScript: stringValue(content?.bilibili?.openingScript, fallback.bilibili.openingScript),
      outline: stringList(content?.bilibili?.outline, fallback.bilibili.outline),
      danmakuPoints: stringList(content?.bilibili?.danmakuPoints, fallback.bilibili.danmakuPoints)
    },
    weibo: {
      ...fallback.weibo,
      hashtags: stringList(content?.weibo?.hashtags, fallback.weibo.hashtags),
      fiveMinuteComment: stringValue(content?.weibo?.fiveMinuteComment, fallback.weibo.fiveMinuteComment),
      debateQuestion: stringValue(content?.weibo?.debateQuestion, fallback.weibo.debateQuestion),
      riskTip: stringValue(content?.weibo?.riskTip, fallback.weibo.riskTip)
    },
    xiaohongshu: {
      ...fallback.xiaohongshu,
      coverTitle: stringValue(content?.xiaohongshu?.coverTitle, fallback.xiaohongshu.coverTitle),
      cardTitles: stringList(content?.xiaohongshu?.cardTitles, fallback.xiaohongshu.cardTitles),
      cards: cardList(content?.xiaohongshu?.cards, fallback.xiaohongshu.cards),
      collectReason: stringValue(content?.xiaohongshu?.collectReason, fallback.xiaohongshu.collectReason)
    },
    article: {
      ...fallback.article,
      title: stringValue(content?.article?.title, fallback.article.title),
      intro: stringValue(content?.article?.intro, fallback.article.intro),
      fullOutline: stringList(content?.article?.fullOutline, fallback.article.fullOutline),
      ending: stringValue(content?.article?.ending, fallback.article.ending)
    }
  };

  return qualityControl(normalized);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const list = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  return list.length ? list : fallback;
}

function cardList(value: unknown, fallback: PlatformContent["xiaohongshu"]["cards"]) {
  if (!Array.isArray(value)) return fallback;
  const list = value
    .filter((item): item is { title?: unknown; body?: unknown } => Boolean(item) && typeof item === "object")
    .map((item) => ({
      title: stringValue(item.title, ""),
      body: stringValue(item.body, "")
    }))
    .filter((item) => item.title && item.body);
  return list.length ? list : fallback;
}

function normalizeScore(value: unknown, fallback: number) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
