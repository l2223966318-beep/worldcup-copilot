import { createPayload } from "@/lib/sports/normalizers";
import { inferStaticFixtureStatus } from "@/lib/sports/staticFixtureStatus";
import type { MatchEvent, MatchStatistic, WorldCupMatch, WorldCupPayload } from "@/lib/sports/types";

const WORLD_CUP_2026_LEAGUE = 1;
const WORLD_CUP_2026_SEASON = 2026;
const WORLDCUP26_BASE_URL = "https://worldcup26.ir";
const THE_STATS_API_FIXTURES_URL = "https://www.thestatsapi.com/world-cup/data/fixtures.json";
const REQUEST_TIMEOUT_MS = 12_000;

type WorldCup26GamesResponse = {
  games?: WorldCup26Game[];
};

type WorldCup26GroupsResponse = {
  groups?: unknown[];
};

type WorldCup26StadiumsResponse = {
  stadiums?: WorldCup26Stadium[];
};

type WorldCup26GameResponse = {
  game?: WorldCup26Game;
};

type WorldCup26Game = {
  id?: string;
  home_team_id?: string;
  away_team_id?: string;
  home_score?: string;
  away_score?: string;
  home_scorers?: string;
  away_scorers?: string;
  group?: string;
  matchday?: string;
  local_date?: string;
  stadium_id?: string;
  finished?: string;
  time_elapsed?: string;
  type?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_team_label?: string;
  away_team_label?: string;
};

type WorldCup26Stadium = {
  id?: string;
  name_en?: string;
  fifa_name?: string;
  city_en?: string;
  country_en?: string;
};

type TheStatsApiFixtures = {
  fixtures?: TheStatsApiFixture[];
};

type TheStatsApiFixture = {
  matchNumber?: number;
  date?: string;
  kickoffUtc?: string;
  stage?: string;
  group?: string | null;
  homeTeam?: string;
  awayTeam?: string;
  stadium?: string;
  hostCity?: string;
};

export async function getFreeWorldCup2026Fixtures(): Promise<WorldCupPayload<WorldCupMatch[]>> {
  try {
    const [games, stadiums] = await Promise.all([getWorldCup26Games(), getWorldCup26Stadiums()]);
    if (games.length) return createPayload("live", games.map((game) => normalizeWorldCup26Game(game, stadiums)));
  } catch {
    // TheStatsAPI static file is the stable fallback for the complete 104-match schedule.
  }

  const fixtures = await getTheStatsApiFixtures();
  if (!fixtures.length) return createPayload("fallback", [], "Free World Cup 2026 sources returned no fixtures.");
  return createPayload("live", fixtures.map(normalizeTheStatsApiFixture));
}

export async function getFreeWorldCup2026Today(date = getTodayDate()): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const payload = await getFreeWorldCup2026Fixtures();
  const matches = payload.data.filter((match) => normalizeDateKey(match.kickoffTime) === date);
  return {
    ...payload,
    data: matches,
    message: matches.length ? payload.message : "No free World Cup 2026 fixtures for today."
  };
}

export async function getFreeWorldCup2026Live(): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const payload = await getFreeWorldCup2026Fixtures();
  return {
    ...payload,
    data: payload.data.filter((match) => match.status === "live")
  };
}

export async function getFreeWorldCup2026Match(fixtureId: string): Promise<WorldCupPayload<WorldCupMatch>> {
  const normalizedId = fixtureId.replace(/^wc26-/, "");

  try {
    const [game, stadiums] = await Promise.all([getWorldCup26Game(normalizedId), getWorldCup26Stadiums()]);
    if (game) return createPayload("live", normalizeWorldCup26Game(game, stadiums));
  } catch {
    // Some public deployments expose list endpoints more reliably than the single-match route.
  }

  try {
    const [games, stadiums] = await Promise.all([getWorldCup26Games(), getWorldCup26Stadiums()]);
    const game = games.find((item) => item.id === normalizedId);
    if (game) return createPayload("live", normalizeWorldCup26Game(game, stadiums));
  } catch {
    // Fall through to the complete static schedule fallback.
  }

  const fixtures = await getTheStatsApiFixtures();
  const fixture = fixtures.find((item) => String(item.matchNumber) === normalizedId);
  if (!fixture) throw new Error(`World Cup 2026 fixture ${fixtureId} was not found in free sources.`);
  return createPayload("live", normalizeTheStatsApiFixture(fixture));
}

export async function getFreeWorldCup2026Standings(): Promise<WorldCupPayload<unknown[]>> {
  const payload = await fetchJson<WorldCup26GroupsResponse>(`${WORLDCUP26_BASE_URL}/get/groups`);
  return createPayload("live", payload.groups ?? []);
}

async function getWorldCup26Games() {
  const payload = await fetchJson<WorldCup26GamesResponse>(`${WORLDCUP26_BASE_URL}/get/games`);
  return payload.games ?? [];
}

async function getWorldCup26Game(matchId: string) {
  const payload = await fetchJson<WorldCup26GameResponse>(`${WORLDCUP26_BASE_URL}/get/game/${matchId}`);
  return payload.game;
}

async function getWorldCup26Stadiums() {
  const payload = await fetchJson<WorldCup26StadiumsResponse>(`${WORLDCUP26_BASE_URL}/get/stadiums`);
  return new Map((payload.stadiums ?? []).map((stadium) => [stadium.id, stadium]));
}

async function getTheStatsApiFixtures() {
  const payload = await fetchJson<TheStatsApiFixtures>(THE_STATS_API_FIXTURES_URL);
  return payload.fixtures ?? [];
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWorldCup26Game(game: WorldCup26Game, stadiums: Map<string | undefined, WorldCup26Stadium>): WorldCupMatch {
  const homeName = game.home_team_name_en || game.home_team_label || "TBD";
  const awayName = game.away_team_name_en || game.away_team_label || "TBD";
  const homeScore = parseNullableNumber(game.home_score);
  const awayScore = parseNullableNumber(game.away_score);
  const stadium = stadiums.get(game.stadium_id);
  const kickoffTime = localDateToIso(game.local_date);
  const status = normalizeWorldCup26Status(game, kickoffTime);
  const hasTrustedScore = hasTrustedWorldCup26Score(game);

  return {
    id: `wc26-${game.id ?? ""}`,
    sportType: "football",
    competition: "FIFA World Cup 2026",
    season: WORLD_CUP_2026_SEASON,
    round: stageLabel(game.type, game.matchday),
    group: game.group ? `Group ${game.group}` : undefined,
    kickoffTime,
    status,
    statusText: statusText(status, game.time_elapsed),
    homeTeam: {
      id: parseNullableNumber(game.home_team_id) ?? undefined,
      name: homeName
    },
    awayTeam: {
      id: parseNullableNumber(game.away_team_id) ?? undefined,
      name: awayName
    },
    score: {
      home: hasTrustedScore ? homeScore : null,
      away: hasTrustedScore ? awayScore : null,
      fulltime: hasTrustedScore && homeScore !== null && awayScore !== null ? `${homeScore}-${awayScore}` : undefined,
      display: scoreDisplay(status, hasTrustedScore ? homeScore : null, hasTrustedScore ? awayScore : null)
    },
    venue: {
      id: parseNullableNumber(stadium?.id) ?? undefined,
      name: stadium?.fifa_name || stadium?.name_en,
      city: [stadium?.city_en, stadium?.country_en].filter(Boolean).join(", ")
    },
    events: normalizeScorers(homeName, game.home_scorers).concat(normalizeScorers(awayName, game.away_scorers)),
    statistics: buildBasicStatistics(homeName, awayName, homeScore, awayScore),
    source: {
      provider: "worldcup26-free",
      league: WORLD_CUP_2026_LEAGUE,
      season: WORLD_CUP_2026_SEASON
    },
    lastUpdated: new Date().toISOString()
  };
}

function normalizeTheStatsApiFixture(fixture: TheStatsApiFixture): WorldCupMatch {
  const homeName = fixture.homeTeam ?? "TBD";
  const awayName = fixture.awayTeam ?? "TBD";
  const kickoffTime = fixture.kickoffUtc ?? fixture.date ?? "";
  const status = inferStaticFixtureStatus(kickoffTime);

  return {
    id: `wc26-${fixture.matchNumber ?? ""}`,
    sportType: "football",
    competition: "FIFA World Cup 2026",
    season: WORLD_CUP_2026_SEASON,
    round: stageLabel(fixture.stage),
    group: fixture.group ? `Group ${fixture.group}` : undefined,
    kickoffTime,
    status,
    statusText: statusText(status),
    homeTeam: { name: homeName },
    awayTeam: { name: awayName },
    score: {
      home: null,
      away: null,
      display: status === "scheduled" ? "vs" : "待补比分"
    },
    venue: {
      name: fixture.stadium,
      city: fixture.hostCity
    },
    events: [],
    statistics: buildBasicStatistics(homeName, awayName, null, null),
    source: {
      provider: "thestatsapi-fixtures",
      league: WORLD_CUP_2026_LEAGUE,
      season: WORLD_CUP_2026_SEASON
    },
    lastUpdated: new Date().toISOString()
  };
}

function normalizeWorldCup26Status(game: WorldCup26Game, kickoffTime?: string): WorldCupMatch["status"] {
  if (game.finished === "TRUE" || game.time_elapsed === "finished") return "finished";
  if (game.time_elapsed && !["notstarted", "not_started", "0"].includes(game.time_elapsed.toLowerCase())) return "live";
  return inferStaticFixtureStatus(kickoffTime);
}

function hasTrustedWorldCup26Score(game: WorldCup26Game) {
  const elapsed = game.time_elapsed?.toLowerCase();
  if (game.finished === "TRUE" || elapsed === "finished") return true;
  return Boolean(elapsed && !["notstarted", "not_started", "0"].includes(elapsed));
}

function statusText(status: WorldCupMatch["status"], raw?: string) {
  if (status === "finished") return "Match Finished";
  if (status === "live") return raw ? `Live ${raw}` : "Live";
  return "Scheduled";
}

function scoreDisplay(status: WorldCupMatch["status"], homeScore: number | null, awayScore: number | null) {
  if (status === "scheduled") return "vs";
  if (homeScore !== null && awayScore !== null) return `${homeScore}-${awayScore}`;
  return "待补比分";
}

function stageLabel(type?: string, matchday?: string) {
  const labels: Record<string, string> = {
    "group-stage": "Group Stage",
    group: matchday ? `Group Stage - ${matchday}` : "Group Stage",
    r32: "Round of 32",
    r16: "Round of 16",
    qf: "Quarter-finals",
    sf: "Semi-finals",
    third: "Third-place match",
    final: "Final"
  };
  return labels[type ?? ""] ?? type ?? "World Cup 2026";
}

function buildBasicStatistics(homeName: string, awayName: string, homeScore: number | null, awayScore: number | null): MatchStatistic[] {
  return [
    {
      team: homeName,
      values: [
        { type: "Goals", value: homeScore },
        { type: "Data Coverage", value: "free-score-source" }
      ]
    },
    {
      team: awayName,
      values: [
        { type: "Goals", value: awayScore },
        { type: "Data Coverage", value: "free-score-source" }
      ]
    }
  ];
}

function normalizeScorers(team: string, raw?: string): MatchEvent[] {
  if (!raw || raw === "null") return [];
  const matches = [...raw.matchAll(/([^"{},]+?)\s+(\d+)'(?:\+(\d+)')?(\(OG\))?/g)];
  return matches.map((match) => ({
    minute: Number(match[2]),
    extraMinute: match[3] ? Number(match[3]) : undefined,
    team,
    player: match[1].trim(),
    type: "Goal",
    detail: match[4] ? `${match[1].trim()} own goal` : `${match[1].trim()} scored`,
    comment: match[4] ? "Own goal" : undefined
  }));
}

function localDateToIso(value?: string) {
  if (!value) return "";
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return value;
  const [, month, day, year, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00`;
}

function normalizeDateKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : value.slice(0, 10);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseNullableNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
