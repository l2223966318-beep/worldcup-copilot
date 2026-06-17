import type { MatchData } from "@/data/matches";
import type { TopicIdea } from "@/lib/ai/topics";
import type { SourceStatus, WorldCupMatch } from "@/lib/sports/types";

export type OpportunityGrade = "S" | "A" | "B" | "C";
export type OpportunityRecommendation = "优先做" | "可观察" | "谨慎跟进" | "信息不足";
export type RiskLevel = "低" | "中" | "高";

export type PlatformFitScores = {
  bilibili: number;
  weibo: number;
  xiaohongshu: number;
  douyin: number;
};

export type ContentOpportunityModel = {
  heat: number;
  scarcity: number;
  platformFit: number;
  risk: number;
  productionCost: number;
  valueScore: number;
  grade: OpportunityGrade;
  recommendation: OpportunityRecommendation;
  recommendationReason: string;
  riskSummary: string;
  caution: string;
  riskLevel: RiskLevel;
  signals: string[];
  sourceConfidence: number;
  platformFits: PlatformFitScores;
};

type BaseModelInput = {
  heat: number;
  scarcity: number;
  platformFits: PlatformFitScores;
  risk: number;
  productionCost: number;
  sourceConfidence: number;
  signals: string[];
};

export function buildMatchOpportunityModel(
  match: WorldCupMatch,
  options?: { now?: number }
): ContentOpportunityModel {
  const now = options?.now ?? Date.now();
  const kickoffMs = Date.parse(match.kickoffTime || "");
  const hoursToKickoff = Number.isFinite(kickoffMs) ? Math.abs(kickoffMs - now) / 36e5 : 24;
  const totalGoals = safeNumber(match.score.home) + safeNumber(match.score.away);
  const goalDiff = Math.abs(safeNumber(match.score.home) - safeNumber(match.score.away));
  const eventCount = match.events.length;
  const statCount = match.statistics.reduce(
    (sum, entry) =>
      sum +
      entry.values.filter((value) => value.value !== null && value.value !== "" && value.type !== "Data Coverage").length,
    0
  );
  const scoreKnown = typeof match.score.home === "number" && typeof match.score.away === "number";
  const richData = statCount >= 8;
  const eventText = match.events
    .map((event) => `${event.type} ${event.detail} ${event.comment ?? ""}`.toLowerCase())
    .join(" ");

  let heat = 28;
  if (match.status === "live") heat += 36;
  else if (match.status === "finished") heat += 24;
  else if (match.status === "scheduled") heat += hoursToKickoff <= 6 ? 22 : hoursToKickoff <= 18 ? 14 : 8;
  heat += Math.min(16, totalGoals * 4);
  if (goalDiff <= 1 && totalGoals > 0) heat += 8;
  if (eventCount >= 4) heat += 10;
  if (hasBigStage(match.round, match.group)) heat += 14;

  let scarcity = 24;
  if (hasBigStage(match.round, match.group)) scarcity += 18;
  if (scoreKnown && totalGoals >= 4) scarcity += 12;
  if (goalDiff === 0 && totalGoals > 0) scarcity += 10;
  if (/(penalty|var|red card|own goal|乌龙|点球|红牌|争议|绝杀|帽子戏法)/i.test(eventText)) scarcity += 18;
  if (eventCount >= 5) scarcity += 8;
  if (richData) scarcity += 6;

  const platformFits: PlatformFitScores = {
    bilibili: clamp(45 + (richData ? 18 : 6) + (eventCount >= 3 ? 8 : 0) + (hasBigStage(match.round, match.group) ? 10 : 0)),
    weibo: clamp(48 + (match.status === "live" ? 18 : 8) + (eventCount >= 2 ? 10 : 0) + (scoreKnown ? 6 : 0)),
    xiaohongshu: clamp(42 + (scoreKnown ? 10 : 4) + (richData ? 10 : 0) + (goalDiff <= 1 ? 6 : 2)),
    douyin: clamp(44 + (eventCount >= 3 ? 14 : 4) + (/(penalty|own goal|绝杀|帽子戏法|点球|乌龙)/i.test(eventText) ? 16 : 0))
  };

  let risk = 18;
  if (!scoreKnown && match.status !== "scheduled") risk += 20;
  if (!richData && eventCount === 0 && match.status !== "scheduled") risk += 14;
  if (/(var|controvers|争议|红牌|penalty)/i.test(eventText)) risk += 18;
  if (match.status === "live") risk += 10;
  if (!["sportmonks", "api-football"].includes(match.source.provider)) risk += 8;

  let productionCost = 52;
  productionCost -= richData ? 16 : 0;
  productionCost -= eventCount >= 3 ? 8 : 0;
  productionCost += match.status === "live" ? 10 : 0;
  productionCost += !scoreKnown && match.status !== "scheduled" ? 10 : 0;
  productionCost -= hasBigStage(match.round, match.group) ? 4 : 0;

  let sourceConfidence = 40;
  if (match.source.provider === "sportmonks") sourceConfidence += 38;
  if (match.source.provider === "api-football") sourceConfidence += 35;
  if (scoreKnown) sourceConfidence += 12;
  if (richData) sourceConfidence += 8;
  if (eventCount >= 2) sourceConfidence += 5;
  if (!scoreKnown && match.status !== "scheduled") sourceConfidence -= 18;

  const signals = [
    match.status === "live" ? "实时比赛" : match.status === "finished" ? "已完赛可复盘" : "赛前预热",
    hasBigStage(match.round, match.group) ? "淘汰赛价值" : "小组赛内容",
    richData ? "数据完整" : "数据偏少",
    eventCount >= 3 ? "场上事件密集" : "事件信号一般"
  ];

  return finalizeOpportunityModel({
    heat,
    scarcity,
    platformFits,
    risk,
    productionCost,
    sourceConfidence,
    signals
  });
}

export function buildDetailOpportunityModel(
  match: MatchData,
  topic: TopicIdea,
  sourceStatus: SourceStatus = "fallback"
): ContentOpportunityModel {
  const totalGoals = scoreTotal(match.score);
  const eventCount = match.keyEvents.length;
  const statsCoverage = countStats(match);
  const exampleBoost = match.isExample ? 8 : 0;

  const heat = clamp(Math.round(topic.newsValue * 0.58 + topic.spreadPotential * 0.22 + totalGoals * 4 + eventCount * 2 + exampleBoost));
  const scarcity = clamp(
    Math.round(
      topic.category === "历史对照"
        ? 82
        : topic.category === "争议讨论"
          ? 72
          : topic.category === "平台热点"
            ? 68
            : 55 + Math.min(20, eventCount * 4) + (match.penaltyScore ? 10 : 0)
    )
  );
  const platformFits: PlatformFitScores = {
    bilibili: clamp(topic.bilibiliFit),
    weibo: clamp(topic.weiboFit),
    xiaohongshu: clamp(topic.xiaohongshuFit),
    douyin: clamp(topic.shortVideoFit)
  };
  const risk = clamp(
    (topic.riskLevel === "高" ? 76 : topic.riskLevel === "中" ? 54 : 28) +
      (sourceStatus !== "live" ? 8 : 0) +
      (topic.category === "争议讨论" ? 10 : 0)
  );
  const productionCost = clamp(
    (topic.productionCost === "高" ? 78 : topic.productionCost === "中" ? 58 : 36) +
      (topic.difficulty === "高" ? 10 : topic.difficulty === "中" ? 4 : 0) -
      Math.min(12, statsCoverage * 2)
  );

  const sourceConfidence =
    sourceStatus === "live" ? 88 : sourceStatus === "cache" ? 68 : sourceStatus === "error" ? 40 : match.isExample ? 80 : 55;

  const signals = [
    topic.category,
    topic.recommendation,
    statsCoverage >= 8 ? "数据证据充分" : "证据需补充",
    match.penaltyScore ? "含点球叙事" : "常规比赛叙事"
  ];

  return finalizeOpportunityModel({
    heat,
    scarcity,
    platformFits,
    risk,
    productionCost,
    sourceConfidence,
    signals
  });
}

function finalizeOpportunityModel(input: BaseModelInput): ContentOpportunityModel {
  const platformFit = average(Object.values(input.platformFits));
  const lowRiskBonus = 100 - input.risk;
  const lowCostBonus = 100 - input.productionCost;

  let valueScore = Math.round(
    input.heat * 0.28 +
      input.scarcity * 0.24 +
      platformFit * 0.22 +
      lowRiskBonus * 0.14 +
      lowCostBonus * 0.12
  );

  valueScore = Math.round(valueScore * (input.sourceConfidence / 100));
  valueScore = clamp(valueScore);

  const averagePlatform = platformFit;
  const highRisk = input.heat >= 75 && input.risk >= 65;
  const highHomogeneous = input.heat >= 78 && input.scarcity < 48;
  const strongExecution = input.heat >= 55 && input.heat <= 82 && input.risk <= 42 && averagePlatform >= 72;
  const insufficientSource = input.sourceConfidence < 45;

  let recommendation: OpportunityRecommendation = "可观察";
  let recommendationReason = "热度存在，但还需要结合更多独特信息决定是否投入。";

  if (insufficientSource) {
    recommendation = "信息不足";
    recommendationReason = "来源和事实支撑不足，当前只能作为线索，不适合直接判高价值。";
  } else if (highRisk) {
    recommendation = "谨慎跟进";
    recommendationReason = "热度够高，但风险也高，适合先核实事实和表达边界。";
  } else if (highHomogeneous) {
    recommendation = "可观察";
    recommendationReason = "热度高但同质化明显，先观察平台讨论，再决定是否跟进。";
  } else if (strongExecution) {
    recommendation = "优先做";
    recommendationReason = "热度中高、风险低、平台适配强，具备较好的落地效率。";
  } else if (valueScore < 55) {
    recommendation = "可观察";
    recommendationReason = "当前信号偏弱，更适合做素材储备或补充信息后再判断。";
  }

  const grade = insufficientSource
    ? "C"
    : recommendation === "优先做"
      ? valueScore >= 80
        ? "S"
        : "A"
      : recommendation === "谨慎跟进"
        ? "B"
        : valueScore >= 70
          ? "B"
          : "C";

  const riskLevel: RiskLevel = input.risk >= 68 ? "高" : input.risk >= 42 ? "中" : "低";
  const riskSummary =
    recommendation === "信息不足"
      ? "信息不足：来源不够硬，不能直接当成高价值内容。"
      : recommendation === "谨慎跟进"
        ? "高热但高风险：适合跟进，不适合先下定性结论。"
        : recommendation === "优先做"
          ? "低风险且平台适配强：可以优先进入生产。"
          : "可观察：可先观察热度走向和差异化空间。";
  const caution =
    insufficientSource
      ? "需要补来源、补事实、补比赛证据。"
      : input.risk >= 65
        ? "避免黑幕、保送、确认伤退这类定性词。"
        : input.scarcity < 48
          ? "避免跟风同质内容，优先找不同角度。"
          : "可直接围绕数据、事件和平台适配做内容。";

  return {
    heat: clamp(input.heat),
    scarcity: clamp(input.scarcity),
    platformFit: averagePlatform,
    risk: clamp(input.risk),
    productionCost: clamp(input.productionCost),
    valueScore,
    grade,
    recommendation,
    recommendationReason,
    riskSummary,
    caution,
    riskLevel,
    signals: Array.from(new Set(input.signals)).filter(Boolean),
    sourceConfidence: clamp(input.sourceConfidence),
    platformFits: input.platformFits
  };
}

function hasBigStage(round?: string, group?: string) {
  const roundText = `${round ?? ""} ${group ?? ""}`.toLowerCase();
  return /final|semi|quarter|1\/8|1\/4|淘汰|八强|四强|决赛|半决赛/.test(roundText);
}

function countStats(match: MatchData) {
  const values = [
    match.stats.teamA.possession,
    match.stats.teamA.shots,
    match.stats.teamA.shotsOnTarget,
    match.stats.teamA.corners,
    match.stats.teamA.fouls,
    match.stats.teamA.yellowCards,
    match.stats.teamA.xg,
    match.stats.teamB.possession,
    match.stats.teamB.shots,
    match.stats.teamB.shotsOnTarget,
    match.stats.teamB.corners,
    match.stats.teamB.fouls,
    match.stats.teamB.yellowCards,
    match.stats.teamB.xg
  ];
  return values.filter((value) => typeof value === "number" && !Number.isNaN(value)).length;
}

function average(values: number[]) {
  return clamp(Math.round(values.reduce((sum, value) => sum + value, 0) / values.length));
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function scoreTotal(score: string) {
  const [home, away] = score.split("-").map((value) => Number(value));
  return (Number.isFinite(home) ? home : 0) + (Number.isFinite(away) ? away : 0);
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
