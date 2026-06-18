import { ensurePublishable } from "@/lib/ai/quality";
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
    "## 可直接发布版",
    firstPublishableSection(platformDraft),
    "",
    "## 编辑参考版",
    ensurePublishable(analysis.summary),
    "",
    ensurePublishable(analysis.winLossReason),
    "",
    "## 推荐选题",
    `- 标题：${ensurePublishable(selectedTopic.title)}`,
    `- 适合平台：${selectedTopic.recommendedFormat}`,
    `- 核心看点：${ensurePublishable(selectedTopic.coreAngle)}`,
    `- 推荐表达：${ensurePublishable(selectedTopic.reason)}`,
    `- 风险提醒：${selectedTopic.riskLevel}`,
    "",
    `## ${platformDraft.platform} 完整稿件`,
    platformDraft.body,
    "",
    "## 风险提示版",
    `- 等级：${reviewResult.level}`,
    `- 分数：${reviewResult.score}`,
    `- 建议：${ensurePublishable(reviewResult.advice)}`,
    ...reviewResult.findings.map((finding) => `- ${finding.type}：${ensurePublishable(finding.rewrite)}`)
  ].map((line) => ensurePublishable(line)).join("\n");
}

export function createPackageText(contentPackage: ContentPackage) {
  return createPackageMarkdown(contentPackage).replace(/^#+\s*/gm, "");
}

function firstPublishableSection(platformDraft: PlatformDraft) {
  return ensurePublishable(platformDraft.sections.find((section) => section.title.includes("可直接发布"))?.content ?? platformDraft.body);
}
