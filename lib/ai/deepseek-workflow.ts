import type { MatchData } from "@/data/matches";
import { generatePlatformContent, type PlatformContent } from "@/lib/ai/content";
import { generateDeepSeekJson } from "@/lib/ai/deepseek";
import { cleanList, cleanTitle, ensurePublishable, qualityControl } from "@/lib/ai/quality";
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

const DEFAULT_CATEGORY = "鏁版嵁瑙ｈ" as TopicCategory;
const DEFAULT_RECOMMENDATION = "瑙傚療" as TopicRecommendation;
const DEFAULT_LEVEL = "涓?" as TopicIdea["difficulty"];
const DEFAULT_LOW_LEVEL = "浣?" as TopicIdea["riskLevel"];
const PLATFORM_COPY_RULES = [
  "标题必须短、准、有平台感：B站16-28字，微博12-22字，小红书12-20字。",
  "禁止标题套标题、连续冒号、长问句、机械式“为什么……？”模板。",
  "内容必须按三层思路生成：可直接发布版、编辑参考版、风险提示版。",
  "可直接发布版排最前，短、顺、人话，复制后稍改就能发。",
  "不得出现：这里需要补充来源、待补充、根据数据显示但无来源、变量残留。",
  "不得编造伤病、冲突、内部矛盾、裁判争议；无来源只能写“需核验”。",
  "mock/demo内容必须明确是演示口径，不要伪装成真实新闻。"
].join("\n");
const PLATFORM_FEW_SHOTS = {
  bilibili: ["梅西这场，真把剧本踢满了", "法国追平那一刻，决赛才真正开始", "阿根廷夺冠不是童话，是熬出来的"],
  weibo: ["这场决赛后劲太大了", "法国追平时，我以为剧本要反转", "梅西终于补上最后一块拼图"],
  xiaohongshu: ["这场世界杯决赛为什么封神", "看懂阿根廷夺冠，只要这3个瞬间", "梅西圆梦夜，最戳人的不是冠军"]
};
const CATEGORY_ALIASES: Record<string, TopicCategory> = {
  战术复盘: "鎴樻湳澶嶇洏" as TopicCategory,
  球员叙事: "鐞冨憳鍙欎簨" as TopicCategory,
  数据解读: "鏁版嵁瑙ｈ" as TopicCategory,
  历史对照: "鍘嗗彶瀵圭収" as TopicCategory,
  争议讨论: "浜夎璁ㄨ" as TopicCategory,
  情绪共鸣: "鎯呯华鍏遍福" as TopicCategory,
  冷知识科普: "鍐风煡璇嗙鏅?" as TopicCategory,
  平台热点: "骞冲彴鐑偣" as TopicCategory
};
const RECOMMENDATION_ALIASES: Record<string, TopicRecommendation> = {
  主推: "涓绘帹" as TopicRecommendation,
  次推: "娆℃帹" as TopicRecommendation,
  观察: "瑙傚療" as TopicRecommendation,
  谨慎发布: "璋ㄦ厧鍙戝竷" as TopicRecommendation
};

export async function enhanceMatchWorkflowWithDeepSeek(input: {
  match: MatchData;
  baselineTopics: TopicIdea[];
  apiKey?: string;
}): Promise<MatchWorkflowEnhancement> {
  const { match, baselineTopics, apiKey } = input;
  const signalContext = buildSignalContext(match);
  const result = await generateDeepSeekJson<DeepSeekWorkflowResponse>(
    [
      {
        role: "system",
        content:
          "你是体育赛事内容运营总监，只输出严格 JSON，不要 Markdown。你的任务不是普通写稿，而是把一场比赛拆成可执行的内容生产方案。先在内部完成：事实摘要 -> 关键事件 -> 传播价值 -> 平台打法 -> 风险点，最终不要输出推理过程。只基于用户提供的 match、matchSignals、baselineTopics，不得编造伤病、采访、内幕、社媒热搜、球员发言或未给出的比分。若信息不足，明确写“需核验”或“建议补充来源”。输出要短、准、可执行，避免泛泛模板。"
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "增强 WorldCup Copilot 单场比赛工作流。输出 conclusions 3 条、topics 6 条、platformStrategy 和 platformContent。conclusions 必须分别覆盖：事实摘要、运营判断、风险提醒。topics 必须优先利用 matchSignals 中的乌龙球、球衣被扯破、VAR、争议判罚、冲突、伤病需核验等场上热点信号；没有信号时，再从比分走势、关键球员、技术统计里找角度。选题不是泛泛角度，而是具体做法，必须覆盖客观资讯、球迷讨论、轻松整活、专业分析，可加入球员故事、数据解读、风险安全版等方向；例如“用动漫角色介绍球星定位”“用一分钟时间线讲清绝杀”“用数据卡拆射正效率”。不要只围绕比分或控球率。platformContent 必须贴合当前比赛和主推选题，不要套用无关球员或历史样例。",
          outputShape: {
            conclusions: [{ title: "事实摘要/运营判断/风险提醒", body: "80字以内，必须具体", featured: false }],
            topics: [
              {
                title: "具体选题标题",
                coreAngle: "一句话说明内容切入角度",
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
                scoreReason: "说明评分为什么是这个值",
                businessExplanation: "为什么运营上推荐这个选题",
                reason: "引用的比赛事实/热点信号/数据依据",
                sampleTitles: ["可直接使用标题1", "可直接使用标题2"]
              }
            ],
            platformStrategy: {
              bilibili: "B站打法：深度结构、开头钩子、互动点",
              weibo: "微博打法：短评、话题、讨论钩子、降风险表述",
              xiaohongshu: "小红书打法：卡片结构、新手解释、收藏理由",
              article: "公众号打法：深度评论、图表位置、结尾观点"
            },
            platformContent: {
              bilibili: {
                titles: ["视频标题1", "视频标题2"],
                coverCopy: "封面文案",
                openingScript: "开头15秒口播",
                outline: ["00:00 结构段落"],
                danmakuPoints: ["弹幕互动问题"]
              },
              weibo: {
                hashtags: ["#话题#"],
                fiveMinuteComment: "赛后5分钟快评",
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
          baselineTopics,
          styleRules: PLATFORM_COPY_RULES,
          fewShotTitles: PLATFORM_FEW_SHOTS
        })
      }
    ],
    { timeoutMs: 35_000, apiKey, quality: "quality", reasoningEffort: "high" }
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
      title: cleanTitle(String(item.title), "generic"),
      body: ensurePublishable(String(item.body)),
      featured: Boolean(item.featured ?? index === 1)
    }));
}

function normalizeTopics(matchId: string, topics: DeepSeekTopic[] | undefined, fallback: TopicIdea[]) {
  const fallbackTopic = fallback[0];
  const normalized = (topics ?? []).slice(0, 6).map((topic, index) => {
    const currentFallback = fallback[index] ?? fallbackTopic;
    return {
      id: `${matchId}-deepseek-${index + 1}`,
      title: cleanTitle(stringValue(topic.title, currentFallback?.title ?? "比赛内容运营选题"), "generic"),
      coreAngle: ensurePublishable(stringValue(topic.coreAngle, currentFallback?.coreAngle ?? "基于比赛事实、关键事件和传播价值拆解内容角度。")),
      category: normalizeCategory(topic.category, currentFallback?.category ?? DEFAULT_CATEGORY),
      recommendation: normalizeRecommendation(topic.recommendation, currentFallback?.recommendation ?? DEFAULT_RECOMMENDATION),
      newsValue: normalizeScore(topic.newsValue, currentFallback?.newsValue ?? 75),
      spreadPotential: normalizeScore(topic.spreadPotential, currentFallback?.spreadPotential ?? 75),
      platformFit: normalizeScore(topic.platformFit, currentFallback?.platformFit ?? 75),
      bilibiliFit: normalizeScore(topic.bilibiliFit, currentFallback?.bilibiliFit ?? 75),
      xiaohongshuFit: normalizeScore(topic.xiaohongshuFit, currentFallback?.xiaohongshuFit ?? 70),
      weiboFit: normalizeScore(topic.weiboFit, currentFallback?.weiboFit ?? 78),
      shortVideoFit: normalizeScore(topic.shortVideoFit, currentFallback?.shortVideoFit ?? 76),
      recommendedFormat: ensurePublishable(stringValue(topic.recommendedFormat, currentFallback?.recommendedFormat ?? "B站复盘 + 微博讨论")),
      difficulty: normalizeLevel(topic.difficulty, currentFallback?.difficulty ?? DEFAULT_LEVEL),
      productionCost: normalizeLevel(topic.productionCost, currentFallback?.productionCost ?? DEFAULT_LEVEL),
      riskLevel: normalizeLevel(topic.riskLevel, currentFallback?.riskLevel ?? DEFAULT_LOW_LEVEL),
      scoreReason: ensurePublishable(stringValue(topic.scoreReason, currentFallback?.scoreReason ?? "基于比赛事实、热点信号和平台适配综合评分。")),
      businessExplanation: ensurePublishable(stringValue(topic.businessExplanation, currentFallback?.businessExplanation ?? "适合用于赛事内容运营拆解。")),
      reason: ensurePublishable(stringValue(topic.reason, currentFallback?.reason ?? "基于当前比赛数据和热点信号生成。")),
      sampleTitles: cleanList(stringList(topic.sampleTitles, currentFallback?.sampleTitles ?? ["这场球别只看比分", "真正的转折在这里"]), "generic", { title: true, max: 3 })
    } satisfies TopicIdea;
  });

  return qualityControl(normalized.length ? normalized : fallback.slice(0, 6)) as TopicIdea[];
}

function normalizePlatformContent(content: DeepSeekPlatformContent | undefined, fallback: PlatformContent) {
  const normalized: PlatformContent = {
    ...fallback,
    bilibili: {
      ...fallback.bilibili,
      titles: cleanList(stringList(content?.bilibili?.titles, fallback.bilibili.titles), "bilibili", { title: true, max: 5 }),
      coverCopy: cleanTitle(stringValue(content?.bilibili?.coverCopy, fallback.bilibili.coverCopy), "bilibili"),
      openingScript: ensurePublishable(stringValue(content?.bilibili?.openingScript, fallback.bilibili.openingScript), "bilibili"),
      outline: stringList(content?.bilibili?.outline, fallback.bilibili.outline),
      danmakuPoints: stringList(content?.bilibili?.danmakuPoints, fallback.bilibili.danmakuPoints)
    },
    weibo: {
      ...fallback.weibo,
      hashtags: stringList(content?.weibo?.hashtags, fallback.weibo.hashtags),
      fiveMinuteComment: ensurePublishable(stringValue(content?.weibo?.fiveMinuteComment, fallback.weibo.fiveMinuteComment), "weibo"),
      debateQuestion: ensurePublishable(stringValue(content?.weibo?.debateQuestion, fallback.weibo.debateQuestion), "weibo"),
      riskTip: ensurePublishable(stringValue(content?.weibo?.riskTip, fallback.weibo.riskTip), "weibo")
    },
    xiaohongshu: {
      ...fallback.xiaohongshu,
      coverTitle: cleanTitle(stringValue(content?.xiaohongshu?.coverTitle, fallback.xiaohongshu.coverTitle), "xiaohongshu"),
      cardTitles: cleanList(stringList(content?.xiaohongshu?.cardTitles, fallback.xiaohongshu.cardTitles), "xiaohongshu", { title: true, max: 5 }),
      cards: cardList(content?.xiaohongshu?.cards, fallback.xiaohongshu.cards),
      collectReason: stringValue(content?.xiaohongshu?.collectReason, fallback.xiaohongshu.collectReason)
    },
    article: {
      ...fallback.article,
      title: cleanTitle(stringValue(content?.article?.title, fallback.article.title), "article"),
      intro: ensurePublishable(stringValue(content?.article?.intro, fallback.article.intro), "article"),
      fullOutline: stringList(content?.article?.fullOutline, fallback.article.fullOutline),
      ending: stringValue(content?.article?.ending, fallback.article.ending)
    }
  };

  return qualityControl(normalized);
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const list = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  return list.length ? list : fallback;
}

function cardList(value: unknown, fallback: PlatformContent["xiaohongshu"]["cards"]) {
  if (!Array.isArray(value)) return fallback;
  const list = value
    .filter((item): item is { title?: unknown; body?: unknown } => Boolean(item) && typeof item === "object")
    .map((item) => ({
      title: cleanTitle(stringValue(item.title, ""), "xiaohongshu"),
      body: ensurePublishable(stringValue(item.body, ""), "xiaohongshu")
    }))
    .filter((item) => item.title && item.body);
  return list.length ? list : fallback;
}

function normalizeScore(value: unknown, fallback: number) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeCategory(value: unknown, fallback: TopicCategory): TopicCategory {
  if (typeof value !== "string") return fallback;
  return CATEGORY_ALIASES[value.trim()] ?? fallback;
}

function normalizeRecommendation(value: unknown, fallback: TopicRecommendation): TopicRecommendation {
  if (typeof value !== "string") return fallback;
  return RECOMMENDATION_ALIASES[value.trim()] ?? fallback;
}

function normalizeLevel<T extends TopicIdea["difficulty"] | TopicIdea["riskLevel"] | TopicIdea["productionCost"]>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  if (value === "低") return "浣?" as T;
  if (value === "中") return "涓?" as T;
  if (value === "高") return "楂?" as T;
  return fallback;
}
