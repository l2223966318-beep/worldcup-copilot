import type { KnowledgeEntry } from "@/data/knowledge";
import type { MatchData } from "@/data/matches";
import type { PlatformContent } from "@/lib/ai/content";
import { cleanText, cleanTitle, ensurePublishable, qualityControl } from "@/lib/ai/quality";
import type { RiskReviewResult } from "@/lib/ai/risk";
import type { TopicIdea } from "@/lib/ai/topics";

type ReportInput = {
  match: MatchData;
  topics: TopicIdea[];
  content: PlatformContent;
  risk: RiskReviewResult;
  knowledge: KnowledgeEntry;
};

const cadence = [
  ["赛后 5 分钟", "微博快评", "值班编辑", "事实边界、比分、关键事件"],
  ["赛后 30 分钟", "短视频复盘", "短视频编导", "口播是否夸大、素材版权"],
  ["赛后 2 小时", "B站深度复盘", "体育作者 / UP 主", "数据来源、战术表述"],
  ["次日", "公众号 / 专栏", "主笔编辑", "历史资料、图表口径、合规表述"]
];

export function createMarkdownReport(input: ReportInput) {
  const { match, topics, content, risk, knowledge } = input;
  const topTopic = topics[0];
  const safeTopics = qualityControl(topics);

  const lines = [
    `# ${match.name} 内容方案`,
    "",
    "## 可直接发布版",
    `B站：${cleanTitle(content.bilibili.titles[0], "bilibili")}`,
    `微博：${ensurePublishable(content.weibo.fiveMinuteComment, "weibo")}`,
    `小红书：${cleanTitle(content.xiaohongshu.coverTitle, "xiaohongshu")}`,
    "",
    "## 编辑参考版",
    `主线：${ensurePublishable(topTopic.title)}`,
    `核心看点：${ensurePublishable(topTopic.coreAngle)}`,
    `推荐表达：${ensurePublishable(topTopic.reason)}`,
    "",
    "## 比赛信息",
    `- 阶段：${match.stage}`,
    `- 时间：${match.time}`,
    `- 对阵：${match.teamA} vs ${match.teamB}`,
    `- 比分：${match.score}${match.penaltyScore ? `，点球 ${match.penaltyScore}` : ""}`,
    "- 数据来源：示例数据。正式发布前需替换为授权体育数据或公开统计口径。",
    "",
    "## 内容优先级",
    ...safeTopics.slice(0, 6).map((topic, index) => `${index + 1}. ${topic.recommendation}｜${cleanTitle(topic.title)}｜适合平台：${topic.recommendedFormat}｜风险：${topic.riskLevel}`),
    "",
    "## 平台分发策略",
    `- B站：${content.bilibili.titles[0]}。分区建议：${content.bilibili.recommendedSection}；时长建议：${content.bilibili.recommendedDuration}。`,
    `- 小红书：${content.xiaohongshu.firstImageCopy}。核心目标是收藏和非球迷理解，收藏理由：${content.xiaohongshu.collectReason}`,
    `- 微博：${content.weibo.fiveMinuteComment} 30 分钟后切换到讨论帖：${content.weibo.thirtyMinuteDiscussion}`,
    `- 短视频：前三秒钩子为“${content.shortVideo.threeSecondHook}”，素材优先准备比分图、球员特写和数据图。`,
    `- 公众号 / 专栏：${content.article.title}。建议按完整文章大纲推进，图表插入位置写入执行清单。`,
    "",
    "## 数据洞察",
    `- 控球率：${match.teamA} ${match.stats.teamA.possession}%，${match.teamB} ${match.stats.teamB.possession}%。运营解释应强调控球不等于控制比赛。`,
    `- 射门 / 射正：${match.teamA} ${match.stats.teamA.shots}/${match.stats.teamA.shotsOnTarget}，${match.teamB} ${match.stats.teamB.shots}/${match.stats.teamB.shotsOnTarget}。可用来解释机会质量。`,
    "- 时间线：用关键事件做短视频节奏点，不要只罗列比分。",
    "",
    "## 发布节奏",
    ...cadence.map(([time, type, owner, review]) => `- ${time}：${type}｜负责人：${owner}｜审核重点：${review}`),
    "",
    "## 风险提示版",
    `- 当前风险等级：${risk.level}`,
    `- 风险分数：${risk.score}`,
    `- 发布建议：${risk.advice}`,
    ...risk.findings.slice(0, 5).map((finding) => `- ${finding.type}｜${finding.level}风险｜建议：${finding.rewrite}`),
    "",
    "## 执行清单",
    "| 内容类型 | 负责人角色 | 发布时间 | 审核重点 |",
    "| --- | --- | --- | --- |",
    ...cadence.map(([time, type, owner, review]) => `| ${type} | ${owner} | ${time} | ${review} |`),
    "",
    "## 知识库补充",
    knowledge.answer,
    "",
    "## 合规说明",
    "当前报告基于示例数据、本地 mock 知识库和规则生成，用于演示工作流。正式发布前必须人工复核事实、数据来源、素材版权和平台规则。涉及伤病、判罚和争议时，使用“需核实”“建议补充来源”“建议人工确认”等表达。"
  ];

  return cleanText(lines.map((line) => cleanText(line)).join("\n"));
}
