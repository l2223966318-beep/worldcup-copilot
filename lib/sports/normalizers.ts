import { exampleMatches, type MatchData } from "@/data/matches";
import type {
  ApiFootballEvent,
  ApiFootballFixture,
  ApiFootballStatistic,
  MatchScore,
  MatchStatistic,
  SourceStatus,
  WorldCupMatch,
  WorldCupPayload
} from "@/lib/sports/types";

const WORLD_CUP_LEAGUE = 1;
const WORLD_CUP_SEASON = 2026;

export function normalizeFixture(
  fixture: ApiFootballFixture,
  options: {
    events?: ApiFootballEvent[];
    statistics?: ApiFootballStatistic[];
    lastUpdated?: string;
  } = {}
): WorldCupMatch {
  const lastUpdated = options.lastUpdated ?? new Date().toISOString();
  const home = fixture.teams?.home;
  const away = fixture.teams?.away;
  const score = normalizeScore(fixture);
  const status = normalizeStatus(fixture.fixture?.status?.short);
  const round = fixture.league?.round ?? "World Cup";
  const season = Number(fixture.league?.season ?? WORLD_CUP_SEASON);

  return {
    id: String(fixture.fixture?.id ?? ""),
    sportType: "football",
    competition: fixture.league?.name ?? "FIFA World Cup",
    season,
    round,
    group: parseGroup(round),
    kickoffTime: fixture.fixture?.date ?? "",
    status,
    statusText: fixture.fixture?.status?.long ?? fixture.fixture?.status?.short ?? "Unknown",
    homeTeam: {
      id: home?.id,
      name: home?.name ?? "Home",
      logo: home?.logo
    },
    awayTeam: {
      id: away?.id,
      name: away?.name ?? "Away",
      logo: away?.logo
    },
    score,
    venue: {
      id: fixture.fixture?.venue?.id,
      name: fixture.fixture?.venue?.name,
      city: fixture.fixture?.venue?.city
    },
    events: (options.events ?? []).map((event) => ({
      minute: event.time?.elapsed ?? null,
      extraMinute: event.time?.extra,
      team: event.team?.name ?? "",
      player: event.player?.name,
      assist: event.assist?.name,
      type: event.type ?? "",
      detail: event.detail ?? "",
      comment: event.comments
    })),
    statistics: normalizeStatistics(options.statistics ?? []),
    source: {
      provider: "api-football",
      league: WORLD_CUP_LEAGUE,
      season
    },
    lastUpdated
  };
}

export function normalizeFixtures(fixtures: ApiFootballFixture[], lastUpdated = new Date().toISOString()) {
  return fixtures.map((fixture) => normalizeFixture(fixture, { lastUpdated }));
}

export function createPayload<T>(sourceStatus: SourceStatus, data: T, message?: string): WorldCupPayload<T> {
  return {
    sourceStatus,
    data,
    lastUpdated: new Date().toISOString(),
    message
  };
}

export function mockMatchToWorldCupMatch(match: MatchData): WorldCupMatch {
  const [homeScoreRaw, awayScoreRaw] = match.score.split("-");
  const homeScore = toNullableNumber(homeScoreRaw);
  const awayScore = toNullableNumber(awayScoreRaw);
  const now = new Date().toISOString();

  return {
    id: match.id,
    sportType: "football",
    competition: "FIFA World Cup",
    season: 2026,
    round: match.stage,
    group: undefined,
    kickoffTime: match.time,
    status: "finished",
    statusText: "示例数据",
    homeTeam: { name: match.teamA },
    awayTeam: { name: match.teamB },
    score: {
      home: homeScore,
      away: awayScore,
      fulltime: match.score,
      penalty: match.penaltyScore,
      display: match.penaltyScore ? `${match.score}（点球 ${match.penaltyScore}）` : match.score
    },
    venue: { name: "示例场馆" },
    events: match.keyEvents.map((event) => ({
      minute: Number.parseInt(event.minute, 10) || null,
      team: event.team,
      type: event.type,
      detail: event.description
    })),
    statistics: [
      {
        team: match.teamA,
        values: [
          { type: "控球率", value: `${match.stats.teamA.possession}%` },
          { type: "射门", value: match.stats.teamA.shots },
          { type: "射正", value: match.stats.teamA.shotsOnTarget },
          { type: "角球", value: match.stats.teamA.corners },
          { type: "犯规", value: match.stats.teamA.fouls },
          { type: "黄牌", value: match.stats.teamA.yellowCards },
          { type: "xG", value: match.stats.teamA.xg }
        ]
      },
      {
        team: match.teamB,
        values: [
          { type: "控球率", value: `${match.stats.teamB.possession}%` },
          { type: "射门", value: match.stats.teamB.shots },
          { type: "射正", value: match.stats.teamB.shotsOnTarget },
          { type: "角球", value: match.stats.teamB.corners },
          { type: "犯规", value: match.stats.teamB.fouls },
          { type: "黄牌", value: match.stats.teamB.yellowCards },
          { type: "xG", value: match.stats.teamB.xg }
        ]
      }
    ],
    source: {
      provider: "mock",
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON
    },
    lastUpdated: now
  };
}

export function getFallbackMatches() {
  return exampleMatches.map(mockMatchToWorldCupMatch);
}

export function getFallbackMatch(id?: string) {
  const fallback = exampleMatches.find((match) => match.id === id) ?? exampleMatches[0];
  return mockMatchToWorldCupMatch(fallback);
}

function normalizeScore(fixture: ApiFootballFixture): MatchScore {
  const home = fixture.goals?.home ?? null;
  const away = fixture.goals?.away ?? null;
  const penaltyHome = fixture.score?.penalty?.home;
  const penaltyAway = fixture.score?.penalty?.away;
  const display = home !== null && away !== null ? `${home}-${away}` : "vs";

  return {
    home,
    away,
    halftime: pairScore(fixture.score?.halftime?.home, fixture.score?.halftime?.away),
    fulltime: pairScore(fixture.score?.fulltime?.home, fixture.score?.fulltime?.away),
    penalty: pairScore(penaltyHome, penaltyAway),
    display: penaltyHome !== null && penaltyHome !== undefined && penaltyAway !== null && penaltyAway !== undefined
      ? `${display}（点球 ${penaltyHome}-${penaltyAway}）`
      : display
  };
}

function normalizeStatistics(statistics: ApiFootballStatistic[]): MatchStatistic[] {
  return statistics.map((item) => ({
    team: item.team?.name ?? "",
    values: (item.statistics ?? []).map((stat) => ({
      type: stat.type ?? "",
      value: stat.value ?? null
    }))
  }));
}

function normalizeStatus(short?: string): WorldCupMatch["status"] {
  if (!short) return "unknown";
  if (["NS", "TBD"].includes(short)) return "scheduled";
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["PST"].includes(short)) return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "unknown";
}

function parseGroup(round: string) {
  const match = round.match(/Group\s+([A-Z])/i);
  return match?.[1] ? `Group ${match[1].toUpperCase()}` : undefined;
}

function pairScore(home?: number | null, away?: number | null) {
  return home !== null && home !== undefined && away !== null && away !== undefined ? `${home}-${away}` : undefined;
}

function toNullableNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
