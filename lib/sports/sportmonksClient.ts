import { createPayload } from "@/lib/sports/normalizers";
import type { MatchEvent, MatchStatistic, WorldCupMatch, WorldCupPayload } from "@/lib/sports/types";

const DEFAULT_BASE_URL = "https://api.sportmonks.com/v3/football";
const REQUEST_TIMEOUT_MS = Number(process.env.SPORTMONKS_TIMEOUT_MS ?? 5000);
const DEFAULT_LEAGUE_ID = Number(process.env.SPORTMONKS_WORLD_CUP_LEAGUE_ID ?? 732);
const DEFAULT_SEASON = Number(process.env.SPORTMONKS_WORLD_CUP_SEASON ?? 2026);

type SportmonksResponse<T> = {
  data?: T;
  message?: string;
  errors?: unknown;
};

type SportmonksFixture = Record<string, unknown>;
type SportmonksEntity = Record<string, unknown>;

export function hasSportmonksKey() {
  return Boolean(process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY);
}

export async function getSportmonksWorldCupFixtures(): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const seasonId = getSportmonksSeasonId();
  if (seasonId) {
    const payload = await sportmonksGet<SportmonksFixture[]>(`/fixtures/seasons/${seasonId}`, {
      include: fixtureIncludes()
    });
    return createPayload("live", normalizeSportmonksFixtures(payload.data ?? []));
  }

  const payload = await sportmonksGet<SportmonksFixture[]>("/fixtures", {
    include: fixtureIncludes(),
    filters: `fixtureLeagues:${DEFAULT_LEAGUE_ID}`
  });
  return createPayload("live", normalizeSportmonksFixtures(payload.data ?? []));
}

export async function getSportmonksWorldCupToday(date: string): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const payload = await sportmonksGet<SportmonksFixture[]>(`/fixtures/date/${date}`, {
    include: fixtureIncludes(),
    filters: `fixtureLeagues:${DEFAULT_LEAGUE_ID}`
  });
  return createPayload("live", normalizeSportmonksFixtures(payload.data ?? []));
}

export async function getSportmonksWorldCupLive(): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const payload = await sportmonksGet<SportmonksFixture[]>("/livescores/inplay", {
    include: fixtureIncludes()
  });
  return createPayload("live", normalizeSportmonksFixtures(payload.data ?? []).filter((match) => match.status === "live"));
}

export async function getSportmonksWorldCupMatch(fixtureId: string): Promise<WorldCupPayload<WorldCupMatch>> {
  const payload = await sportmonksGet<SportmonksFixture>(`/fixtures/${fixtureId}`, {
    include: fixtureIncludes()
  });
  const fixture = payload.data;
  if (!fixture) throw new Error(`Sportmonks fixture ${fixtureId} not found.`);
  return createPayload("live", normalizeSportmonksFixture(fixture));
}

export async function getSportmonksWorldCupStandings(): Promise<WorldCupPayload<unknown[]>> {
  const seasonId = getSportmonksSeasonId();
  if (!seasonId) throw new Error("SPORTMONKS_WORLD_CUP_SEASON_ID is required for Sportmonks standings.");
  const payload = await sportmonksGet<unknown[]>(`/standings/seasons/${seasonId}`);
  return createPayload("live", payload.data ?? []);
}

async function sportmonksGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<SportmonksResponse<T>> {
  const token = process.env.SPORTMONKS_API_TOKEN || process.env.SPORTMONKS_API_KEY;
  if (!token) throw new Error("SPORTMONKS_API_TOKEN is not configured.");

  const baseUrl = (process.env.SPORTMONKS_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const url = new URL(`${baseUrl}${path}`);
  url.searchParams.set("api_token", token);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 60 }
    });
    const payload = (await response.json().catch(() => ({}))) as SportmonksResponse<T>;

    if (!response.ok) {
      const message = payload.message || `Sportmonks request failed: ${response.status}`;
      throw new Error(message);
    }
    if (payload.errors && Object.keys(payload.errors as Record<string, unknown>).length > 0) {
      throw new Error(`Sportmonks returned errors: ${JSON.stringify(payload.errors)}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function fixtureIncludes() {
  return process.env.SPORTMONKS_FIXTURE_INCLUDES || "participants;scores;state;league;season;stage;round;group;venue;events;statistics.type";
}

function getSportmonksSeasonId() {
  const seasonId = Number(process.env.SPORTMONKS_WORLD_CUP_SEASON_ID);
  return Number.isInteger(seasonId) && seasonId > 0 ? seasonId : undefined;
}

function normalizeSportmonksFixtures(fixtures: SportmonksFixture[]) {
  return fixtures.map(normalizeSportmonksFixture).filter((match) => match.id);
}

function normalizeSportmonksFixture(fixture: SportmonksFixture): WorldCupMatch {
  const id = stringValue(fixture.id);
  const participants = arrayValue(fixture.participants);
  const home = findParticipant(participants, "home");
  const away = findParticipant(participants, "away");
  const scores = arrayValue(fixture.scores);
  const homeScore = pickScore(scores, home.id);
  const awayScore = pickScore(scores, away.id);
  const statusCode = stringValue(readNested(fixture.state, ["short_name"])) || stringValue(readNested(fixture.state, ["code"]));
  const statusText = stringValue(readNested(fixture.state, ["name"])) || statusCode || "Unknown";
  const kickoffTime = stringValue(fixture.starting_at) || stringValue(fixture.starting_at_timestamp);
  const season = numberValue(readNested(fixture.season, ["name"])) ?? numberValue(readNested(fixture.season, ["year"])) ?? DEFAULT_SEASON;
  const round = stringValue(readNested(fixture.round, ["name"])) || stringValue(readNested(fixture.stage, ["name"])) || "World Cup";
  const venue = objectValue(fixture.venue);

  return {
    id,
    sportType: "football",
    competition: stringValue(readNested(fixture.league, ["name"])) || "FIFA World Cup",
    season,
    round,
    group: stringValue(readNested(fixture.group, ["name"])) || parseGroup(round),
    kickoffTime: normalizeKickoffTime(kickoffTime),
    status: normalizeSportmonksStatus(statusCode, statusText),
    statusText,
    homeTeam: {
      id: home.id,
      name: home.name || "Home",
      logo: home.logo
    },
    awayTeam: {
      id: away.id,
      name: away.name || "Away",
      logo: away.logo
    },
    score: {
      home: homeScore,
      away: awayScore,
      display: homeScore !== null && awayScore !== null ? `${homeScore}-${awayScore}` : "vs"
    },
    venue: {
      id: numberValue(venue.id) ?? undefined,
      name: stringValue(venue.name),
      city: stringValue(venue.city_name) || stringValue(venue.city)
    },
    events: normalizeSportmonksEvents(arrayValue(fixture.events)),
    statistics: normalizeSportmonksStatistics(arrayValue(fixture.statistics), home.name, away.name),
    source: {
      provider: "sportmonks",
      league: DEFAULT_LEAGUE_ID,
      season
    },
    lastUpdated: new Date().toISOString()
  };
}

function findParticipant(participants: SportmonksEntity[], location: "home" | "away") {
  const found =
    participants.find((item) => stringValue(readNested(item.meta, ["location"])).toLowerCase() === location) ||
    participants.find((item) => stringValue(item.location).toLowerCase() === location) ||
    participants[location === "home" ? 0 : 1] ||
    {};

  return {
    id: numberValue(found.id) ?? undefined,
    name: stringValue(found.name) || stringValue(found.display_name),
    logo: stringValue(found.image_path)
  };
}

function pickScore(scores: SportmonksEntity[], participantId?: number) {
  const current =
    scores.find((score) => numberValue(score.participant_id) === participantId && /current/i.test(stringValue(readNested(score.description, ["name"])))) ||
    scores.find((score) => numberValue(score.participant_id) === participantId);
  const value = readNested(current, ["score", "goals"]) ?? current?.goals ?? current?.score;
  return toNullableNumber(value);
}

function normalizeSportmonksEvents(events: SportmonksEntity[]): MatchEvent[] {
  return events.map((event) => ({
    minute: toNullableNumber(event.minute),
    extraMinute: toNullableNumber(event.extra_minute),
    team: stringValue(readNested(event.participant, ["name"])) || stringValue(readNested(event.team, ["name"])),
    player: stringValue(readNested(event.player, ["display_name"])) || stringValue(readNested(event.player, ["name"])),
    assist: stringValue(readNested(event.related_player, ["display_name"])) || stringValue(readNested(event.assist, ["name"])),
    type: stringValue(readNested(event.type, ["name"])) || stringValue(event.type),
    detail: stringValue(event.result) || stringValue(event.info) || stringValue(readNested(event.type, ["name"])) || "Event",
    comment: stringValue(event.addition)
  }));
}

function normalizeSportmonksStatistics(statistics: SportmonksEntity[], homeName: string, awayName: string): MatchStatistic[] {
  const grouped = new Map<string, MatchStatistic["values"]>();
  statistics.forEach((stat) => {
    const team = stringValue(readNested(stat.participant, ["name"])) || stringValue(stat.team_name) || "";
    if (!team) return;
    const values = grouped.get(team) ?? [];
    values.push({
      type: stringValue(readNested(stat.type, ["name"])) || stringValue(stat.type) || stringValue(stat.name) || "Statistic",
      value: primitiveValue(readNested(stat.data, ["value"])) ?? primitiveValue(stat.value) ?? null
    });
    grouped.set(team, values);
  });

  if (!grouped.size) {
    return [
      { team: homeName || "Home", values: [{ type: "Data Coverage", value: "sportmonks-fixture" }] },
      { team: awayName || "Away", values: [{ type: "Data Coverage", value: "sportmonks-fixture" }] }
    ];
  }

  return Array.from(grouped.entries()).map(([team, values]) => ({ team, values }));
}

function normalizeSportmonksStatus(code: string, text: string): WorldCupMatch["status"] {
  const normalized = `${code} ${text}`.toLowerCase();
  if (/(not started|ns|tbd|scheduled)/.test(normalized)) return "scheduled";
  if (/(1st|2nd|half|live|inplay|extra time|penalties|break)/.test(normalized)) return "live";
  if (/(finished|ft|after extra|aet|penalties finished)/.test(normalized)) return "finished";
  if (/(postponed)/.test(normalized)) return "postponed";
  if (/(cancelled|abandoned)/.test(normalized)) return "cancelled";
  return "unknown";
}

function normalizeKickoffTime(value: string) {
  if (!value) return "";
  if (/^\d+$/.test(value)) return new Date(Number(value) * 1000).toISOString();
  return value.includes("T") ? value : value.replace(" ", "T");
}

function parseGroup(round: string) {
  const match = round.match(/Group\s+([A-Z])/i);
  return match?.[1] ? `Group ${match[1].toUpperCase()}` : undefined;
}

function arrayValue(value: unknown): SportmonksEntity[] {
  return Array.isArray(value) ? (value as SportmonksEntity[]) : [];
}

function objectValue(value: unknown): SportmonksEntity {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as SportmonksEntity) : {};
}

function readNested(value: unknown, path: string[]) {
  return path.reduce<unknown>((current, key) => objectValue(current)[key], value);
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toNullableNumber(value: unknown) {
  const number = numberValue(value);
  return number ?? null;
}

function primitiveValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" || value === null ? value : undefined;
}
