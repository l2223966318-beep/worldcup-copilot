import type { KnowledgeEntry } from "@/data/knowledge";
import type { MatchData } from "@/data/matches";
import type { PlatformContent } from "@/lib/ai/content";
import type { RiskReviewResult } from "@/lib/ai/risk";
import type { TopicIdea } from "@/lib/ai/topics";

export function createMarkdownReport({
  match,
  topics,
  content,
  risk,
  knowledge
}: {
  match: MatchData;
  topics: TopicIdea[];
  content: PlatformContent;
  risk: RiskReviewResult;
  knowledge: KnowledgeEntry;
}) {
  const topTopic = topics[0];

  return [
    `# ${match.name} 内容运营方案`,
    "",
    "## 今日核心判断",
    `${match.name} 不是单纯赛果报道，而是一场同时具备人物叙事、战术复盘、数据异常和发布风险管理价值的内容样本。建议以“${topTopic.title}”作为主推选题，再用数据图表和平台改写支撑完整传播链路。`,
    "",
    "## 比赛基本信息",
    `- 阶段：${match.stage}`,
    `- 时间：${match.time}`,
    `- 对阵：${match.teamA} vs ${match.teamB}`,
    `- 比分：${match.score}${match.penaltyScore ? `，点球 ${match.penaltyScore}` : ""}`,
    `- 数据来源：示例数据，正式发布前需替换为授权体育数据或公开统计口径。`,
    "",
    "## 核心赛事摘要",
    match.summary,
    "",
    "## 推荐主推选题",
    `**${topTopic.title}**`,
    `- 核心角度：${topTopic.coreAngle}`,
    `- 新闻价值：${topTopic.newsValue}`,
    `- 推荐形式：${topTopic.recommendedFormat}`,
    `- 风险提示：${topTopic.riskLevel}风险，发布前仍需人工复核事实和数据来源。`,
    "",
    "## 推荐选题 Top 5",
    ...topics.slice(0, 5).map((topic, index) => `${index + 1}. ${topic.title}｜${topic.category}｜新闻价值 ${topic.newsValue}｜B站 ${topic.bilibiliFit}｜小红书 ${topic.xiaohongshuFit}｜微博 ${topic.weiboFit}｜短视频 ${topic.shortVideoFit}`),
    "",
    "## 推荐平台打法",
    `- B站：${content.bilibili.titles[0]}。重点做深度复盘、分段结构和弹幕互动。`,
    `- 小红书：${content.xiaohongshu.coverTitle}。重点做 5 页卡片和可收藏模板。`,
    `- 微博：${content.weibo.shortComment}。重点做快评、话题标签和讨论钩子。`,
    `- 短视频：${content.shortVideo.thirtySec}。重点做比分定格、关键镜头和 30 秒口播。`,
    `- 公众号 / 专栏：${content.article.title}。重点做完整论证和图表插入。`,
    "",
    "## 数据图表使用建议",
    "- 控球率对比图：用于解释“控球不等于控制比赛”。",
    "- 射门 / 射正柱状图：用于解释机会数量与机会质量。",
    "- 关键球员雷达图：用于支撑人物叙事，不要只写进球。",
    "- 比赛事件时间线：用于提炼 3 个传播转折点。",
    "- 历史交锋小图表：用于补足背景，但不要把历史结果直接推导成本场结论。",
    "",
    "## 风险注意事项",
    `- 当前审稿等级：${risk.level}`,
    `- 风险分数：${risk.score}`,
    `- 发布建议：${risk.advice}`,
    "- 避免使用“裁判黑哨”“某球员彻底废了”“某队靠黑幕夺冠”“全网都在骂”“确认伤退”等定性表达。",
    "- 涉及伤病、判罚、争议和数据时，建议使用“需核实”“建议补充来源”“建议人工确认”。",
    "",
    "## 知识库补充资料",
    knowledge.answer,
    "",
    "## 发布节奏",
    "- 赛后 5 分钟：微博快评，先发事实和讨论问题。",
    "- 赛后 30 分钟：短视频复盘，抓关键镜头和一个数据点。",
    "- 赛后 2 小时：B站深度复盘，加入图表、时间线和人物对照。",
    "- 次日：公众号 / 专栏长文，沉淀完整方案和历史背景。",
    "",
    "## 合规说明",
    "当前报告基于示例数据、本地 mock 知识库和规则生成，用于演示工作流。正式发布前必须人工复核事实、数据来源、素材版权和平台规则。"
  ].join("\n");
}
