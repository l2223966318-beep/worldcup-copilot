import { cleanTitle, ensurePublishable } from "@/lib/ai/quality";
import type { AnalysisResult, MatchContext, PlatformDraft, PlatformKey, WorkflowTopic } from "@/types/workflow";

export const supportedPlatforms: PlatformKey[] = ["bilibili", "xiaohongshu", "weibo", "douyin", "videoScript", "article"];

type DraftSection = { title: string; content: string };
export type ContentTypeKey = "topic" | "title" | "shortCopy" | "videoScript" | "commentPrompt" | "cardStructure";
export type TopicModeKey = "objectiveNews" | "professional" | "fanDiscussion" | "playful" | "playerStory" | "dataRead" | "riskSafe";
export type PlatformDraftOptions = {
  contentType?: ContentTypeKey;
  topicMode?: TopicModeKey;
};

export const contentTypeOptions: Array<{ key: ContentTypeKey; label: string }> = [
  { key: "topic", label: "选题" },
  { key: "title", label: "标题" },
  { key: "shortCopy", label: "短文案" },
  { key: "videoScript", label: "视频脚本" },
  { key: "commentPrompt", label: "评论区互动问题" },
  { key: "cardStructure", label: "图文卡片结构" }
];

export const topicModeOptions: Array<{ key: TopicModeKey; label: string }> = [
  { key: "professional", label: "专业分析" },
  { key: "objectiveNews", label: "客观资讯" },
  { key: "fanDiscussion", label: "球迷讨论" },
  { key: "playful", label: "轻松整活" },
  { key: "playerStory", label: "球员故事" },
  { key: "dataRead", label: "数据解读" },
  { key: "riskSafe", label: "风险安全版" }
];

export function createPlatformDraft(
  platform: PlatformKey,
  matchContext: MatchContext,
  topic: WorkflowTopic,
  analysis: AnalysisResult,
  options: PlatformDraftOptions = {}
): PlatformDraft {
  const contentType = options.contentType ?? "videoScript";
  const topicMode = options.topicMode ?? "professional";
  const factory = platformFactories[platform];
  const sections = contentType === "videoScript"
    ? factory(matchContext, topic, analysis)
    : createTypedSections(platform, matchContext, topic, analysis, contentType, topicMode);
  const title = cleanTitle(sections[0]?.content.split("\n")[0] || `${topic.title} - ${platformLabel(platform)}`, toTone(platform));

  return {
    id: `${matchContext.id}-${topic.id}-${platform}-${Date.now()}`,
    platform,
    title,
    body: sections.map((section) => `【${section.title}】\n${section.content}`).join("\n\n"),
    sections,
    createdAt: new Date().toISOString()
  };
}

function createTypedSections(
  platform: PlatformKey,
  match: MatchContext,
  topic: WorkflowTopic,
  analysis: AnalysisResult,
  contentType: ContentTypeKey,
  topicMode: TopicModeKey
): DraftSection[] {
  if (contentType === "topic") return createTopicSections(platform, match, topic, analysis, topicMode);
  if (contentType === "title") return createTitleSections(platform, match, topic, topicMode);
  if (contentType === "shortCopy") return createShortCopySections(platform, match, topic, analysis, topicMode);
  if (contentType === "commentPrompt") return createCommentSections(platform, match, topic, topicMode);
  return createCardSections(platform, match, topic, analysis, topicMode);
}

function createTopicSections(platform: PlatformKey, match: MatchContext, topic: WorkflowTopic, analysis: AnalysisResult, topicMode: TopicModeKey) {
  const mode = topicModeMeta(topicMode);
  const method = topicMethod(topicMode, match, topic, analysis);
  const platformHint = platform === "bilibili" ? "B站主推" : `${platformLabel(platform)}可做，B站可作为深度版承接`;
  return threeLayerDraft({
    direct: [
      `选题：${method.title}`,
      `类型：${mode.label}`,
      `适合平台：${platformHint}`,
      `核心看点：${method.core}`,
      `推荐表达：${method.expression}`,
      `风险提醒：${method.risk}`
    ].join("\n"),
    reference: [
      `依据：${topic.reason}`,
      `比赛事实：${match.matchInfo.name} ${match.matchInfo.score}`,
      `事件抓手：${safeTurningPoint(analysis)}`,
      `制作方式：${method.production}`
    ].join("\n"),
    risk: riskText(topic, method.risk)
  });
}

function createTitleSections(platform: PlatformKey, match: MatchContext, topic: WorkflowTopic, topicMode: TopicModeKey) {
  const mode = topicModeMeta(topicMode);
  const titles = [
    cleanTitle(topic.title, toTone(platform)),
    cleanTitle(`${match.matchInfo.score}背后的关键一幕`, toTone(platform)),
    cleanTitle(`${mode.label}：这场球可以这样讲`, toTone(platform))
  ];
  return threeLayerDraft({
    direct: titles.join("\n"),
    reference: `标题方向：${mode.label}。优先短标题，避免连续冒号和夸张定性。`,
    risk: riskText(topic, "标题不要写无来源争议、伤病和内部信息。")
  });
}

function createShortCopySections(platform: PlatformKey, match: MatchContext, topic: WorkflowTopic, analysis: AnalysisResult, topicMode: TopicModeKey) {
  const method = topicMethod(topicMode, match, topic, analysis);
  return threeLayerDraft({
    direct: [
      `${match.matchInfo.name} ${match.matchInfo.score}。`,
      method.expression,
      "先把事实讲清楚，再留一个讨论点。"
    ].join("\n"),
    reference: `可接${platformLabel(platform)}短评。核心看点：${method.core}`,
    risk: riskText(topic, method.risk)
  });
}

function createCommentSections(platform: PlatformKey, match: MatchContext, topic: WorkflowTopic, topicMode: TopicModeKey) {
  const mode = topicModeMeta(topicMode);
  return threeLayerDraft({
    direct: [
      `你觉得这场最该聊${topic.title}，还是先看数据？`,
      `如果做成${mode.label}内容，你最想看哪个瞬间？`,
      `${match.matchInfo.teamA}和${match.matchInfo.teamB}这场，哪个节点最改变观感？`
    ].join("\n"),
    reference: `适合放在${platformLabel(platform)}评论区置顶或结尾互动。`,
    risk: riskText(topic, "评论问题要引导讨论，不要制造球迷对立。")
  });
}

function createCardSections(platform: PlatformKey, match: MatchContext, topic: WorkflowTopic, analysis: AnalysisResult, topicMode: TopicModeKey) {
  const method = topicMethod(topicMode, match, topic, analysis);
  return threeLayerDraft({
    direct: [
      "第1页：一句话结论",
      `第2页：${safeTurningPoint(analysis)}`,
      `第3页：${method.core}`,
      "第4页：数据或事件证据",
      "第5页：讨论问题和风险提醒"
    ].join("\n"),
    reference: `适合${platformLabel(platform)}图文，也可拆成 B站视频分段。${method.production}`,
    risk: riskText(topic, method.risk)
  });
}

export function platformLabel(platform: PlatformKey) {
  const labels: Record<PlatformKey, string> = {
    bilibili: "B站",
    xiaohongshu: "小红书",
    weibo: "微博",
    douyin: "抖音",
    videoScript: "视频脚本",
    article: "公众号"
  };
  return labels[platform];
}

const platformFactories: Record<
  PlatformKey,
  (matchContext: MatchContext, topic: WorkflowTopic, analysis: AnalysisResult) => DraftSection[]
> = {
  bilibili: (match, topic, analysis) => {
    const title = cleanTitle(`${topic.title}，这场真值得复盘`, "bilibili");
    return threeLayerDraft({
      direct: [
        title,
        "",
        `开头：别急着只看${match.matchInfo.score}。这场球真正值得拆的，是${topic.title}。`,
        `中段：先讲${safeTurningPoint(analysis)}，再用射门、射正和关键事件补证据。`,
        "结尾：你觉得这场最关键的是人物、数据，还是那个转折瞬间？"
      ].join("\n"),
      reference: [
        `定位：${platformLabel("bilibili")}深度复盘`,
        `核心看点：${topic.coreAngle}`,
        "结构：比分钩子 / 关键事件 / 数据证据 / 人物线 / 评论区问题",
        "素材：比分卡、事件时间线、射门数据、关键球员图"
      ].join("\n"),
      risk: riskText(topic, "不要把未经核验的判罚、伤病、冲突写成定论。")
    });
  },
  xiaohongshu: (match, topic) => {
    const title = cleanTitle(`看懂这场球，只要这3点`, "xiaohongshu");
    return threeLayerDraft({
      direct: [
        title,
        "",
        `这场${match.matchInfo.name}，别只记比分。`,
        `最值得看的主线是：${topic.title}。`,
        "可以按这3步看：关键瞬间、数据证据、人物线。"
      ].join("\n"),
      reference: [
        "图文结构：封面结论 / 关键瞬间 / 数据怎么读 / 人物线 / 发布提醒",
        `推荐表达：${topic.coreAngle}`,
        "配图：比分卡、数据卡、人物对照卡"
      ].join("\n"),
      risk: riskText(topic, "避免营销号腔，不写绝对判断。")
    });
  },
  weibo: (match, topic, analysis) => {
    const title = cleanTitle(`${match.matchInfo.score}这场后劲太大了`, "weibo");
    return threeLayerDraft({
      direct: [
        `${title}`,
        "",
        `${match.matchInfo.name}，最值得聊的不是一句输赢，而是${topic.title}。`,
        `如果只选一个复盘切口，我会先看${safeTurningPoint(analysis)}。`,
        "你觉得这场该聊人物、数据，还是最后的关键瞬间？"
      ].join("\n"),
      reference: [
        "节奏：5分钟短评先发，30分钟后补讨论帖。",
        `话题：#${match.matchInfo.teamA}vs${match.matchInfo.teamB}# #世界杯#`,
        `核心看点：${topic.coreAngle}`
      ].join("\n"),
      risk: riskText(topic, "讨论可以有态度，但不要引战。")
    });
  },
  douyin: (match, topic, analysis) => {
    const title = cleanTitle(`${match.matchInfo.score}不是全部`, "douyin");
    return threeLayerDraft({
      direct: [
        title,
        "",
        `前三秒：${match.matchInfo.score}不是全部。`,
        `15秒：真正改变这场球的，是${safeTurningPoint(analysis)}。`,
        `结尾：这场你更想聊${topic.title}，还是聊球员表现？`
      ].join("\n"),
      reference: [
        "镜头：比分卡 / 关键事件 / 数据卡 / 人物图 / 评论区问题。",
        "口播：短句，少铺垫，先给结论。",
        `核心看点：${topic.coreAngle}`
      ].join("\n"),
      risk: riskText(topic, "没有版权画面时，用自制数据卡和口播承接。")
    });
  },
  videoScript: (match, topic) => threeLayerDraft({
    direct: [
      cleanTitle(`${match.matchInfo.score}这球怎么讲`, "douyin"),
      "",
      "镜头1：比分卡定格。",
      `镜头2：打出主线：${topic.title}。`,
      "镜头3：补一张数据卡。",
      "镜头4：留评论区问题。"
    ].join("\n"),
    reference: "适合剪成30秒短视频。画面以自制卡片和数据图为主。",
    risk: riskText(topic, "不要使用无版权比赛画面。")
  }),
  article: (match, topic, analysis) => {
    const title = cleanTitle(`${match.matchInfo.name}复盘：${topic.title}`, "article");
    return threeLayerDraft({
      direct: [
        title,
        "",
        `${match.matchInfo.name}适合从${topic.title}切入。`,
        `第一段先交代比分和事实，第二段讲${safeTurningPoint(analysis)}，第三段用数据补证据。`,
        "结尾不要喊口号，落回这场比赛能给后续内容留下什么。"
      ].join("\n"),
      reference: [
        "结构：事实摘要 / 关键事件 / 数据证据 / 人物线 / 发布边界。",
        `核心看点：${topic.coreAngle}`,
        "图表：比分卡、射门射正对比、关键事件时间线。"
      ].join("\n"),
      risk: riskText(topic, "深度复盘要标清数据来源。")
    });
  }
};

function topicModeMeta(mode: TopicModeKey) {
  return topicModeOptions.find((item) => item.key === mode) ?? topicModeOptions[0];
}

function topicMethod(mode: TopicModeKey, match: MatchContext, topic: WorkflowTopic, analysis: AnalysisResult) {
  const event = safeTurningPoint(analysis);
  const shotLine = `${match.matchInfo.teamA}射门${match.stats.teamA.shots}次、射正${match.stats.teamA.shotsOnTarget}次，${match.matchInfo.teamB}射门${match.stats.teamB.shots}次、射正${match.stats.teamB.shotsOnTarget}次`;
  const methods: Record<TopicModeKey, { title: string; core: string; expression: string; production: string; risk: string }> = {
    objectiveNews: {
      title: `${match.matchInfo.name}赛后发生了什么`,
      core: `用比分、关键事件和${shotLine}交代事实，不替观众下结论。`,
      expression: `先报${match.matchInfo.score}，再讲${event}，最后补一组数据。`,
      production: "适合做赛后快讯、微博短评和B站开头事实段。",
      risk: "只写已知事实；未公开的伤病、冲突、采访和判罚动机都不写。"
    },
    professional: {
      title: `${topic.title}怎么拆成一条B站复盘`,
      core: `把${event}和${shotLine}放在一起，解释观感和数据是否一致。`,
      expression: `别只看比分，先看关键事件，再看射正效率。`,
      production: "适合做B站8分钟复盘：结论、事件、数据、人物、评论区问题。",
      risk: "战术判断要有数据或画面依据，不把推测写成定论。"
    },
    fanDiscussion: {
      title: `${topic.title}最值得吵的点是什么`,
      core: "把讨论点收束到比赛事实、关键瞬间和球员表现，不扩大球迷对立。",
      expression: "这场可以讨论，但先把事实边界讲清楚。",
      production: "适合微博讨论、B站结尾互动和评论区置顶问题。",
      risk: "避免“黑幕”“保送”“彻底废了”等高风险定性。"
    },
    playful: {
      title: `用动漫角色讲${topic.title}`,
      core: "把球星或球队关系转成观众熟悉的角色关系，降低理解门槛，但不编造真实剧情。",
      expression: `如果把这场做成动漫角色介绍，${event}就是剧情转折点。`,
      production: "适合B站轻松整活：角色设定、关键回合、反差点、最后回到真实数据。",
      risk: "整活只能做表达包装，不能把玩笑写成真实新闻或攻击球员。"
    },
    playerStory: {
      title: `${topic.title}背后的人物线`,
      core: "用关键球员、关键事件和赛后情绪串成一条人物叙事。",
      expression: "这不是只看数据的一场，人物线才是传播入口。",
      production: "适合B站人物复盘、小红书图文和短视频口播。",
      risk: "不要编造采访、心理活动、内部矛盾。"
    },
    dataRead: {
      title: `用一组数据看懂${match.matchInfo.score}`,
      core: `${shotLine}，适合解释机会质量和比赛控制感。`,
      expression: "比分是结果，射门和射正更能解释过程。",
      production: "适合数据卡、B站复盘中段和小红书收藏卡。",
      risk: "数据口径要标来源；缺项就说明当前接口未返回。"
    },
    riskSafe: {
      title: `${topic.title}的低风险发布法`,
      core: "把事实、观点和待核验信息拆开写，保留讨论空间。",
      expression: "可以讨论，但不要把观点写成判决书。",
      production: "适合争议类话题的审稿前版本和公众号风险提示段。",
      risk: "涉及伤病、判罚、冲突、内部信息，一律写需核验。"
    }
  };

  return methods[mode];
}

function threeLayerDraft(input: { direct: string; reference: string; risk: string }): DraftSection[] {
  return [
    { title: "可直接发布版", content: ensurePublishable(input.direct) },
    { title: "编辑参考版", content: ensurePublishable(input.reference) },
    { title: "风险提示版", content: ensurePublishable(input.risk) }
  ];
}

function riskText(topic: WorkflowTopic, extra: string) {
  return [
    `风险等级：${topic.riskLevel}`,
    `谨慎表达：${extra}`,
    "无来源的伤病、冲突、内部矛盾、裁判争议，都要写成“需核验”。",
    "mock/demo内容只用于演示，不要伪装成真实新闻。"
  ].join("\n");
}

function safeTurningPoint(analysis: AnalysisResult) {
  return ensurePublishable(analysis.turningPoints[0] || analysis.summary || "关键事件和数据变化");
}

function toTone(platform: PlatformKey) {
  if (platform === "bilibili") return "bilibili";
  if (platform === "weibo") return "weibo";
  if (platform === "xiaohongshu") return "xiaohongshu";
  if (platform === "douyin" || platform === "videoScript") return "douyin";
  if (platform === "article") return "article";
  return "generic";
}
