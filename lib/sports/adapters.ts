import type { MatchData, MatchEvent, TeamStats } from "@/data/matches";
import { localizeCompetitionName, localizeMatchStatus, localizeRoundName, localizeTeamName } from "@/lib/services/footballNames";
import type { MatchStatistic, WorldCupMatch } from "@/lib/sports/types";

export function worldCupMatchToMatchData(match: WorldCupMatch): MatchData {
  const homeStats = statisticsToTeamStats(match.statistics, match.homeTeam.name);
  const awayStats = statisticsToTeamStats(match.statistics, match.awayTeam.name);
  const homeTeam = localizeTeamName(match.homeTeam.name);
  const awayTeam = localizeTeamName(match.awayTeam.name);
  const competition = localizeCompetitionName(match.competition);
  const round = localizeRoundName(match.round);
  const coverageNote = buildCoverageNote(match);

  return {
    id: match.id,
    isExample: match.source.provider === "mock",
    name: `${competition}：${homeTeam} vs ${awayTeam}`,
    stage: round,
    time: match.kickoffTime,
    teamA: homeTeam,
    teamB: awayTeam,
    score: match.score.home !== null && match.score.away !== null ? `${match.score.home}-${match.score.away}` : "vs",
    penaltyScore: match.score.penalty,
    summary: `${homeTeam} vs ${awayTeam}，状态：${localizeMatchStatus(match.statusText)}。当前数据来自${sourceProviderName(match.source.provider)}。${coverageNote}`,
    stats: {
      teamA: homeStats,
      teamB: awayStats
    },
    keyPlayers: [
      {
        name: homeTeam,
        team: homeTeam,
        role: "球队",
        goals: match.score.home ?? 0,
        assists: 0,
        shots: homeStats.shots,
        keyPasses: 0,
        duelsWon: 0,
        rating: 7.6
      },
      {
        name: awayTeam,
        team: awayTeam,
        role: "球队",
        goals: match.score.away ?? 0,
        assists: 0,
        shots: awayStats.shots,
        keyPasses: 0,
        duelsWon: 0,
        rating: 7.4
      }
    ],
    keyEvents: match.events.length
      ? match.events.map((event) => ({
          minute: event.minute ? `${event.minute}${event.extraMinute ? `+${event.extraMinute}` : ""}'` : "-",
          team: localizeTeamName(event.team),
          type: normalizeEventType(event.type, event.detail),
          description: describeMatchEvent(event)
        }))
      : [
          {
            minute: "-",
            team: "数据源",
            type: "终场",
            description: "当前 Sportradar 基础覆盖未返回事件流；可基于比分、状态和基础统计做内容判断，但不要编造进球过程、判罚、伤病或球员发言。"
          }
        ],
    historicalMeetings: [
      {
        year: String(match.season),
        match: round,
        score: `${homeTeam} ${match.score.display} ${awayTeam}`,
        note: match.venue.name ? `比赛场馆：${match.venue.name}` : "真实赛程数据。"
      }
    ]
  };
}

function buildCoverageNote(match: WorldCupMatch) {
  const hasEvents = match.events.length > 0;
  const hasOnlyBasicStats = match.statistics.every((statistic) =>
    statistic.values.every((entry) => entry.type === "Goals" || entry.type === "Data Coverage")
  );

  if (!hasEvents && hasOnlyBasicStats) {
    return "当前覆盖主要包含赛程、比分和基础进球数据，未返回事件流和完整技术统计；内容生产应明确需二次核验，不要推断具体场上细节。";
  }

  if (!hasEvents) {
    return "当前接口未返回事件流；可先基于比分、状态和已返回技术统计做内容判断，具体进球过程和判罚仍需补充来源。";
  }

  return "已返回事件流，可结合比分、状态和事件时间线做内容判断。";
}

function statisticsToTeamStats(statistics: MatchStatistic[], teamName: string): TeamStats {
  const item = statistics.find((stat) => stat.team === teamName);

  return {
    possession: numberStat(item, ["Ball Possession", "控球率"], 50, true),
    shots: numberStat(item, ["Total Shots", "Shots total", "射门"], 0),
    shotsOnTarget: numberStat(item, ["Shots on Goal", "Shots on Target", "射正"], 0),
    corners: numberStat(item, ["Corner Kicks", "角球"], 0),
    fouls: numberStat(item, ["Fouls", "犯规"], 0),
    yellowCards: numberStat(item, ["Yellow Cards", "黄牌"], 0)
  };
}

function numberStat(statistic: MatchStatistic | undefined, names: string[], fallback: number, percentage = false) {
  const value = statistic?.values.find((entry) => names.includes(entry.type))?.value;
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value).replace("%", ""));
  if (!Number.isFinite(parsed)) return fallback;
  return percentage ? Math.round(parsed) : parsed;
}

function describeMatchEvent(event: WorldCupMatch["events"][number]) {
  const player = event.player?.trim();
  const assist = event.assist?.trim();
  const detail = event.detail?.trim() || event.type;
  const normalized = `${event.type} ${detail}`.toLowerCase();
  const subject = player || localizeTeamName(event.team) || "场上球员";

  if (/miss|shot_off_target|off target/.test(normalized)) return `${subject}射门偏出。`;
  if (/shot on target/.test(normalized)) return `${subject}完成射正。`;
  if (/shot.*saved|save|saved/.test(normalized)) return `${subject}射门被扑出。`;
  if (/penalty/.test(normalized) && /goal|scored/.test(normalized)) return `${subject}点球破门。`;
  if (/own goal|own_goal/.test(normalized)) return `${subject}造成乌龙球。`;
  if (/goal|score/.test(normalized)) return assist ? `${subject}破门，${assist}送出助攻。` : `${subject}完成进球。`;
  if (/yellow/.test(normalized)) return `${subject}吃到黄牌。`;
  if (/red/.test(normalized)) return `${subject}吃到红牌。`;
  if (/substitution|subst|change/.test(normalized)) return `${subject}完成换人调整。`;

  return [subject, readableEventDetail(detail)].filter(Boolean).join("，") + "。";
}

function readableEventDetail(detail: string) {
  const normalized = detail.trim();
  if (!normalized || normalized === "event") return "出现关键事件";
  return normalized.replace(/_/g, " ");
}

function normalizeEventType(type: string, detail = ""): MatchEvent["type"] {
  const normalized = `${type} ${detail}`.toLowerCase();
  if (/goal|score/.test(normalized)) return "进球";
  if (/card/.test(normalized)) return "黄牌";
  if (/subst|substitution|change/.test(normalized)) return "换人";
  if (/save|saved/.test(normalized)) return "关键扑救";
  if (/miss|shot/.test(normalized)) return "射门";
  return "终场";
}

function sourceProviderName(provider: WorldCupMatch["source"]["provider"]) {
  const names: Record<WorldCupMatch["source"]["provider"], string> = {
    sportradar: "Sportradar",
    "api-football": "API-Football",
    "worldcup26-free": "WorldCup26 免费 API",
    "thestatsapi-fixtures": "TheStatsAPI 免费赛程",
    mock: "示例数据"
  };
  return names[provider];
}
