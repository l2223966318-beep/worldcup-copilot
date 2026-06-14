import type { AnalysisResult, ContentPackage, MatchContext, PlatformDraft, ReviewResultSnapshot, WorkflowTopic } from "@/types/workflow";

export function createContentPackage(input: {
  matchContext: MatchContext;
  analysis: AnalysisResult;
  selectedTopic: WorkflowTopic;
  platformDraft: PlatformDraft;
  reviewResult: ReviewResultSnapshot;
}): ContentPackage {
  return {
    matchInfo: input.matchContext.matchInfo,
    analysis: input.analysis,
    selectedTopic: input.selectedTopic,
    platformDraft: input.platformDraft,
    reviewResult: input.reviewResult,
    createdAt: new Date().toISOString()
  };
}

export function createPackageMarkdown(contentPackage: ContentPackage) {
  const { matchInfo, analysis, selectedTopic, platformDraft, reviewResult, createdAt } = contentPackage;
  return [
    `# ${matchInfo.name} 内容包`,
    "",
    `- 生成时间：${createdAt}`,
    `- 比赛：${matchInfo.teamA} vs ${matchInfo.teamB}`,
    `- 比分：${matchInfo.score}`,
    `- 阶段：${matchInfo.stage}`,
    "",
    "## 赛事分析",
    analysis.summary,
    "",
    "## 胜负原因",
    analysis.winLossReason,
    "",
    "## 推荐选题",
    `- 标题：${selectedTopic.title}`,
    `- 类型：${selectedTopic.category}`,
    `- 切入角度：${selectedTopic.coreAngle}`,
    `- 风险：${selectedTopic.riskLevel}`,
    "",
    `## ${platformDraft.platform} 文案`,
    platformDraft.body,
    "",
    "## 风险审稿",
    `- 等级：${reviewResult.level}`,
    `- 分数：${reviewResult.score}`,
    `- 建议：${reviewResult.advice}`,
    ...reviewResult.findings.map((finding) => `- ${finding.type}：${finding.rewrite}`)
  ].join("\n");
}

export function createPackageText(contentPackage: ContentPackage) {
  return createPackageMarkdown(contentPackage).replace(/^#+\s*/gm, "");
}
