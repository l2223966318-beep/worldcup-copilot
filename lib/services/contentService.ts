import { cleanTitle, ensurePublishable } from "@/lib/ai/quality";
import type { AnalysisResult, MatchContext, PlatformDraft, PlatformKey, WorkflowTopic } from "@/types/workflow";

export const supportedPlatforms: PlatformKey[] = ["bilibili", "xiaohongshu", "weibo", "douyin", "videoScript", "article"];

type DraftSection = { title: string; content: string };

export function createPlatformDraft(
  platform: PlatformKey,
  matchContext: MatchContext,
  topic: WorkflowTopic,
  analysis: AnalysisResult
): PlatformDraft {
  const factory = platformFactories[platform];
  const sections = factory(matchContext, topic, analysis);
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
