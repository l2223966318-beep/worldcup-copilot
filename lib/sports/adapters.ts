import type { MatchData, MatchEvent, TeamStats } from "@/data/matches";
import type { MatchStatistic, WorldCupMatch } from "@/lib/sports/types";

export function worldCupMatchToMatchData(match: WorldCupMatch): MatchData {
  const homeStats = statisticsToTeamStats(match.statistics, match.homeTeam.name);
  const awayStats = statisticsToTeamStats(match.statistics, match.awayTeam.name);

  return {
    id: match.id,
    isExample: match.source.provider === "mock",
    name: `${match.competition}：${match.homeTeam.name} vs ${match.awayTeam.name}`,
    stage: match.round,
    time: match.kickoffTime,
    teamA: match.homeTeam.name,
    teamB: match.awayTeam.name,
    score: match.score.home !== null && match.score.away !== null ? `${match.score.home}-${match.score.away}` : "vs",
    penaltyScore: match.score.penalty,
    summary: `${match.homeTeam.name} vs ${match.awayTeam.name}，状态：${match.statusText}。当前数据来自${match.source.provider === "mock" ? "示例数据" : "API-Football"}，适合用于赛后内容角度、平台分发和风险审稿。`,
    stats: {
      teamA: homeStats,
      teamB: awayStats
    },
    keyPlayers: [
      {
        name: match.homeTeam.name,
        team: match.homeTeam.name,
        role: "球队",
        goals: match.score.home ?? 0,
        assists: 0,
        shots: homeStats.shots,
        keyPasses: 0,
        duelsWon: 0,
        rating: 7.6
      },
      {
        name: match.awayTeam.name,
        team: match.awayTeam.name,
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
          minute: event.minute ? `${event.minute}'` : "-",
          team: event.team,
          type: normalizeEventType(event.type),
          description: [event.player, event.detail, event.comment].filter(Boolean).join(" / ") || event.type
        }))
      : [
          {
            minute: "-",
            team: match.homeTeam.name,
            type: "终场",
            description: "当前接口暂未返回事件数据，可先基于比分、状态和技术统计进行内容判断。"
          }
        ],
    historicalMeetings: [
      {
        year: String(match.season),
        match: match.round,
        score: `${match.homeTeam.name} ${match.score.display} ${match.awayTeam.name}`,
        note: match.venue.name ? `比赛场馆：${match.venue.name}` : "真实赛程数据。"
      }
    ]
  };
}

function statisticsToTeamStats(statistics: MatchStatistic[], teamName: string): TeamStats {
  const item = statistics.find((stat) => stat.team === teamName);

  return {
    possession: numberStat(item, ["Ball Possession", "控球率"], 50, true),
    shots: numberStat(item, ["Total Shots", "Shots total", "射门"], 0),
    shotsOnTarget: numberStat(item, ["Shots on Goal", "Shots on Target", "射正"], 0),
    corners: numberStat(item, ["Corner Kicks", "角球"], 0),
    fouls: numberStat(item, ["Fouls", "犯规"], 0),
    yellowCards: numberStat(item, ["Yellow Cards", "黄牌"], 0),
    xg: numberStat(item, ["Expected Goals", "xG"], 0)
  };
}

function numberStat(statistic: MatchStatistic | undefined, names: string[], fallback: number, percentage = false) {
  const value = statistic?.values.find((entry) => names.includes(entry.type))?.value;
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(String(value).replace("%", ""));
  if (!Number.isFinite(parsed)) return fallback;
  return percentage ? Math.round(parsed) : parsed;
}

function normalizeEventType(type: string): MatchEvent["type"] {
  if (type.includes("Goal")) return "进球";
  if (type.includes("Card")) return "黄牌";
  if (type.includes("subst")) return "换人";
  return "终场";
}
