import type { MatchData } from "@/data/matches";
import type { MatchSignal } from "@/lib/ai/signals";
import type { RiskReviewResult } from "@/lib/ai/risk";
import type { HotItem, HotSearchPayload } from "@/lib/hot/types";

export type TeamRadarRow = {
  metric: string;
  note: string;
} & Record<string, string | number>;

export type MatchHotspot = {
  id: string;
  rank: number;
  title: string;
  summary: string;
  source: string;
  platform: string;
  heat?: string | number;
  heatScore: number;
  valueScore: number;
  matchReason: string;
  actionText: string;
  url?: string;
};

export type DraftReviewFlow = {
  draft: string;
  result: Pick<RiskReviewResult, "level" | "score" | "advice" | "findings">;
  riskPoints: string[];
  rewriteSuggestion: string;
  checklist: string[];
};

export function buildTeamRadarData(match: MatchData): TeamRadarRow[] {
  const teamA = match.teamA;
  const teamB = match.teamB;
  const statsA = match.stats.teamA;
  const statsB = match.stats.teamB;
  const disciplineA = statsA.fouls + statsA.yellowCards * 3;
  const disciplineB = statsB.fouls + statsB.yellowCards * 3;

  return [
    buildRadarRow("控球", teamA, statsA.possession, teamB, statsB.possession, "谁掌握比赛节奏"),
    buildRadarRow("射门", teamA, statsA.shots, teamB, statsB.shots, "谁制造更多机会"),
    buildRadarRow("射正", teamA, statsA.shotsOnTarget, teamB, statsB.shotsOnTarget, "谁的威胁更接近进球"),
    buildRadarRow("角球", teamA, statsA.corners, teamB, statsB.corners, "谁更常把球推进到危险区域"),
    buildRadarRow("纪律", teamA, disciplineA, teamB, disciplineB, "犯规和黄牌越少越稳定", true)
  ];
}

export function buildMatchHotspotShortlist({
  match,
  signals,
  hotItems,
  limit = 8
}: {
  match: MatchData;
  signals: Array<Pick<MatchSignal, "id" | "label" | "minute" | "team" | "evidence" | "topicSeed" | "contentValue" | "riskLevel" | "recommendedPlatforms" | "contentFormats" | "angleHints">>;
  hotItems: HotItem[];
  limit?: number;
}): MatchHotspot[] {
  const sourceTopics = hotItems
    .map((item) => hotItemToMatchHotspot(item, match))
    .filter((item): item is MatchHotspot => Boolean(item));
  const signalTopics = signals.map((signal) => signalToMatchHotspot(signal, match));
  const deduped = dedupeHotspots([...sourceTopics, ...signalTopics]);

  return deduped
    .sort((a, b) => b.heatScore - a.heatScore || b.valueScore - a.valueScore || a.rank - b.rank)
    .slice(0, limit)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

export function mergeHotSearchPayloads(payloads: HotSearchPayload[]): HotSearchPayload {
  const liveRank = { live: 5, partial: 4, cache: 3, fallback: 2, error: 1 } satisfies Record<HotSearchPayload["sourceStatus"], number>;
  const sortedPayloads = [...payloads].sort((a, b) => liveRank[b.sourceStatus] - liveRank[a.sourceStatus]);
  const sourceStatus = sortedPayloads[0]?.sourceStatus ?? "fallback";
  const message = payloads.map((payload) => payload.message).filter(Boolean).join("；");
  const seen = new Set<string>();
  const data = payloads
    .flatMap((payload) => payload.data)
    .filter((item) => {
      const key = normalizeText(item.url || item.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    sourceStatus,
    data,
    lastUpdated: payloads[0]?.lastUpdated ?? new Date().toISOString(),
    message
  };
}

export function buildDraftReviewFlow(draft: string, match: MatchData, result?: RiskReviewResult): DraftReviewFlow {
  const review = normalizeReviewResult(result ?? simpleReviewRisk(draft));
  const riskPoints = review.findings.length
    ? review.findings.map((finding) => `${finding.type}：${finding.sentence || finding.reason}`)
    : ["未命中明显高风险词，但仍需人工核验比分、事件、素材版权和数据来源。"];
  const rewriteSuggestion = buildRewriteSuggestion(draft, match, review);

  return {
    draft,
    result: review,
    riskPoints,
    rewriteSuggestion,
    checklist: [
      `比分和事件是否只引用 ${match.teamA} vs ${match.teamB} 的已知信息`,
      "伤病、判罚、内部消息是否保留“需核实”表述",
      "标题是否避免黑幕、保送、确认伤退、全网都在骂等定性词",
      "是否注明数据或画面来源，避免把热度写成事实结论"
    ]
  };
}

function normalizeReviewResult(result: DraftReviewFlow["result"]): DraftReviewFlow["result"] {
  if (result.advice !== "可发布" || !result.findings.length) return result;
  return {
    ...result,
    level: result.level === "低" ? "中" : result.level,
    score: Math.max(result.score, 36),
    advice: "修改后发布"
  };
}

export function buildChartCopy(match: MatchData) {
  const shotAccuracyA = percent(match.stats.teamA.shotsOnTarget, match.stats.teamA.shots);
  const shotAccuracyB = percent(match.stats.teamB.shotsOnTarget, match.stats.teamB.shots);
  const firstEvent = match.keyEvents[0];
  const keyEventText = firstEvent ? `${firstEvent.minute}${firstEvent.team}${firstEvent.description}` : "当前接口暂未返回关键事件";
  const shotLeader = match.stats.teamA.shotsOnTarget === match.stats.teamB.shotsOnTarget
    ? "双方"
    : match.stats.teamA.shotsOnTarget > match.stats.teamB.shotsOnTarget
      ? match.teamA
      : match.teamB;

  return {
    possession: {
      operation: `${match.teamA}控球 ${match.stats.teamA.possession}%，${match.teamB}控球 ${match.stats.teamB.possession}%。这段适合回答“谁在控场”，但要和射正、关键事件一起看，避免把控球率直接写成优势。`,
      quote: `这场球不能只看控球，${keyEventText}才是更适合抓住观众的叙事入口。`
    },
    shots: {
      operation: `${match.teamA}射门 ${match.stats.teamA.shots} 次、射正率 ${shotAccuracyA}；${match.teamB}射门 ${match.stats.teamB.shots} 次、射正率 ${shotAccuracyB}。运营文案应优先解释${shotLeader}为什么更接近真实威胁。`,
      quote: `${shotLeader}的内容价值不在射门数本身，而在射正和关键事件能不能串成一个清楚故事。`
    },
    radar: {
      operation: `雷达把${match.teamA}和${match.teamB}放在同一张图里：控球、射门、射正、角球看进攻，纪律看风险边界。它适合替代“谁表现更好”的空泛判断。`,
      quote: `把两队放在同一张雷达里，运营才能看清是${match.teamA}在压制，还是${match.teamB}在用效率回应。`
    },
    context:
      match.historicalMeetings.length >= 2
        ? {
            operation: `${match.name}有 ${match.historicalMeetings.length} 条可用背景记录，当前关键事件是“${keyEventText}”。长文或 B站中段可以用背景补足语境，但不要让历史信息盖过本场事实。`,
            quote: `历史背景只负责垫高语境，真正决定这场内容怎么讲的，还是本场比分、事件和数据。`
          }
        : {
            operation: `${match.name}当前没有两条以上可核验的历史背景记录。内容上下文应回到本场事实：比分、阶段、关键事件和基础统计，不要把单场赛程包装成历史趋势。`,
            quote: `背景数据不足时，最稳的讲法不是补历史，而是把本场比分、事件和数据讲清楚。`
          }
  };
}

function buildRadarRow(
  metric: string,
  teamA: string,
  valueA: number,
  teamB: string,
  valueB: number,
  note: string,
  inverse = false
): TeamRadarRow {
  const [scoreA, scoreB] = normalizePair(valueA, valueB, inverse);
  return {
    metric,
    [teamA]: scoreA,
    [teamB]: scoreB,
    note
  };
}

function normalizePair(valueA: number, valueB: number, inverse = false) {
  if (!Number.isFinite(valueA) || !Number.isFinite(valueB)) return [0, 0];
  if (inverse) {
    const max = Math.max(valueA, valueB, 1);
    return [Math.round((1 - valueA / (max * 1.2)) * 100), Math.round((1 - valueB / (max * 1.2)) * 100)];
  }
  const max = Math.max(valueA, valueB, 1);
  return [Math.round((valueA / max) * 100), Math.round((valueB / max) * 100)];
}

function hotItemToMatchHotspot(item: HotItem, match: MatchData): MatchHotspot | null {
  const text = `${item.title} ${item.summary} ${(item.tags ?? []).join(" ")}`;
  const reason = getMatchReason(text, match);
  if (!reason) return null;

  const heatScore = numericHeat(item.heat ?? item.hot) + (item.valueScore ?? item.relevance ?? 0) * 10;
  return {
    id: item.id,
    rank: item.rank ?? 999,
    title: item.title,
    summary: item.summary || "热点源没有返回摘要，进入分析页后需先补充事实核验。",
    source: item.source,
    platform: item.platform,
    heat: item.heat ?? item.hot,
    heatScore,
    valueScore: item.valueScore ?? item.relevance ?? 0,
    matchReason: reason,
    actionText: "进入分析/生成",
    url: item.url
  };
}

function signalToMatchHotspot(signal: Pick<MatchSignal, "id" | "label" | "minute" | "team" | "evidence" | "topicSeed" | "contentValue" | "recommendedPlatforms">, match: MatchData): MatchHotspot {
  return {
    id: signal.id,
    rank: 999,
    title: signal.topicSeed,
    summary: `${signal.minute}｜${signal.team}｜${signal.evidence}`,
    source: "场上事件",
    platform: signal.recommendedPlatforms.join(" / "),
    heat: signal.contentValue,
    heatScore: signal.contentValue * 1000,
    valueScore: signal.contentValue,
    matchReason: `来自${match.name}的关键事件`,
    actionText: "复制选题/生成内容"
  };
}

function getMatchReason(text: string, match: MatchData) {
  const normalized = normalizeText(text);
  const teamAAliases = teamAliases(match.teamA);
  const teamBAliases = teamAliases(match.teamB);
  const hasTeamA = teamAAliases.some((alias) => normalized.includes(alias));
  const hasTeamB = teamBAliases.some((alias) => normalized.includes(alias));
  if (hasTeamA && hasTeamB) return "当前对阵";
  return "";
}

function teamAliases(team: string) {
  const compact = normalizeText(team);
  const withoutBrackets = normalizeText(team.replace(/[（(].*?[）)]/g, ""));
  const bracketText = team.match(/[（(](.*?)[）)]/)?.[1] ?? "";
  return Array.from(new Set([compact, withoutBrackets, normalizeText(`${withoutBrackets}${bracketText}`)].filter((item) => item.length >= 2)));
}

function dedupeHotspots(items: MatchHotspot[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeText(item.url || item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function simpleReviewRisk(text: string): DraftReviewFlow["result"] {
  const findings = [
    /(全网都在骂|吊打|碾压|完虐|耻辱|打爆)/.test(text)
      ? {
          type: "引战表达",
          level: "中" as const,
          sentence: text,
          reason: "强对立表达容易激化讨论，也会降低内容专业度。",
          rewrite: "这场表现引发讨论，建议结合比赛过程和公开信息理性分析。",
          publishAdvice: "修改后发布；弱化情绪判断，增加事实依据。"
        }
      : null,
    /(黑哨|保送|假球|黑幕)/.test(text)
      ? {
          type: "夸大争议判罚",
          level: "高" as const,
          sentence: text,
          reason: "判罚争议需要规则依据和多方来源，不能直接给出操纵性定性。",
          rewrite: "这一判罚引发讨论，建议结合规则条文、多角度回放和权威解读继续分析。",
          publishAdvice: "建议暂缓直接定性；先补充规则来源和可靠解读。"
        }
      : null
  ].filter(Boolean) as RiskReviewResult["findings"];
  const score = Math.min(100, findings.reduce((sum, finding) => sum + (finding.level === "高" ? 26 : 18), 8));
  const level = score >= 70 ? "高" : score >= 36 ? "中" : "低";
  const advice = level === "高" ? "建议暂缓" : level === "中" ? "修改后发布" : "可发布";
  return { level, score, findings, advice };
}

function buildRewriteSuggestion(draft: string, match: MatchData, review: DraftReviewFlow["result"]) {
  const safer = draft
    .replace(/打爆|吊打|碾压|完虐/g, "表现引发讨论")
    .replace(/全网都在骂/g, "不少讨论集中在")
    .replace(/黑哨|黑幕|假球|保送/g, "争议判罚")
    .replace(/确认伤退/g, "伤病情况仍需核实");

  const sourceReminder = `\n\n发布前补充：这段内容只基于${match.name}的已知比分、事件和公开数据整理，涉及伤病、判罚、球员动机或平台热度时需人工核验。`;
  if (!review.findings.length) return `${safer}${sourceReminder}`;
  return `${safer}\n\n改写方向：保留比赛事实，把情绪词改成“引发讨论”“需要结合数据继续看”，不要直接给球员、球队或裁判下定性结论。${sourceReminder}`;
}

function numericHeat(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const matched = value.replace(/,/g, "").match(/([\d.]+)/);
  if (!matched) return 0;
  const parsed = Number(matched[1]);
  if (!Number.isFinite(parsed)) return 0;
  if (value.includes("亿")) return parsed * 100_000_000;
  if (value.includes("万")) return parsed * 10_000;
  return parsed;
}

function percent(part: number, total: number) {
  if (!total) return "暂无";
  return `${Math.round((part / total) * 100)}%`;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}
