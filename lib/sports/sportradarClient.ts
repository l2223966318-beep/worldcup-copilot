import { createPayload } from "@/lib/sports/normalizers";
import type { MatchEvent, MatchStatistic, WorldCupMatch, WorldCupPayload } from "@/lib/sports/types";
import { getBeijingDateKeyFromValue } from "@/lib/time/beijingTime";

const WORLD_CUP_LEAGUE = 1;
const WORLD_CUP_SEASON = 2026;
const DEFAULT_ACCESS_LEVEL = "trial";
const DEFAULT_LANGUAGE_CODE = "en";
const REQUEST_TIMEOUT_MS = Number(process.env.SPORTRADAR_TIMEOUT_MS ?? 12_000);
const SEASON_SCHEDULE_PAGE_SIZE = 1000;

type SportradarNamed = {
  id?: string;
  name?: string;
  country_code?: string;
};

type SportradarCompetitor = SportradarNamed & {
  abbreviation?: string;
  country?: string;
  qualifier?: string;
};

type SportradarContext = {
  competition?: SportradarNamed;
  season?: SportradarNamed & {
    year?: string;
    competition_id?: string;
  };
  stage?: {
    type?: string;
    phase?: string;
    year?: string;
  };
  round?: {
    number?: number | string;
    name?: string;
  };
  groups?: Array<SportradarNamed & { group_name?: string }>;
  category?: SportradarNamed;
};

type SportradarVenue = SportradarNamed & {
  city_name?: string;
  city?: string;
  country_name?: string;
};

type SportradarSportEvent = {
  id?: string;
  start_time?: string;
  sport_event_context?: SportradarContext;
  competitors?: SportradarCompetitor[];
  venue?: SportradarVenue;
};

type SportradarStatus = {
  status?: string;
  match_status?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  period_scores?: Array<{
    home_score?: number | string | null;
    away_score?: number | string | null;
    type?: string;
    number?: number | string;
  }>;
};

type SportradarTimelineItem = {
  type?: string;
  match_time?: number;
  stoppage_time?: number;
  team?: string;
  competitor?: SportradarNamed;
  player?: SportradarNamed;
  players?: SportradarNamed[];
  description?: string;
  method?: string;
  outcome?: string;
  stoppage_time_clock?: string;
};

type SportradarCompetitorStatistics = SportradarNamed & {
  statistics?: Record<string, unknown>;
};

type SportradarStatistics = {
  totals?: {
    competitors?: SportradarCompetitorStatistics[];
  };
  competitors?: SportradarCompetitorStatistics[];
};

type SportradarSchedule = {
  sport_event?: SportradarSportEvent;
  sport_event_status?: SportradarStatus;
  statistics?: SportradarStatistics;
  timeline?: SportradarTimelineItem[];
};

type SportradarScheduleResponse = {
  generated_at?: string;
  schedules?: SportradarSchedule[];
};

type SportradarSummaryResponse = {
  generated_at?: string;
  sport_event?: SportradarSportEvent;
  sport_event_status?: SportradarStatus;
  statistics?: SportradarStatistics;
  timeline?: SportradarTimelineItem[];
};

type SportradarStandingsResponse = {
  generated_at?: string;
  standings?: unknown[];
};

type SportradarConfig = {
  apiKey: string;
  accessLevel: string;
  languageCode: string;
  soccerBaseUrl: string;
  soccerExtendedBaseUrl: string;
  competitionId?: string;
  seasonId?: string;
};

export function hasSportradarKey() {
  return Boolean(process.env.SPORTRADAR_API_KEY?.trim());
}

export function hasSportradarSeasonId() {
  return Boolean(process.env.SPORTRADAR_WORLD_CUP_SEASON_ID?.trim());
}

export function isSportradarFixtureId(fixtureId: string) {
  return safeDecode(fixtureId).startsWith("sr:sport_event:");
}

export async function getSportradarWorldCupFixtures(): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const config = getSportradarConfig();
  if (!config.seasonId) {
    throw new Error("SPORTRADAR_WORLD_CUP_SEASON_ID is required for the full Sportradar schedule.");
  }

  const payload = await getSeasonSchedules(config);
  const matches = normalizeSchedules(payload.schedules ?? [], payload.generated_at);
  if (!matches.length) throw new Error("Sportradar returned no fixtures for the configured season.");
  return createPayload("live", matches);
}

export async function getSportradarWorldCupToday(date: string): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const config = getSportradarConfig();
  if (config.seasonId) {
    const payload = await getSeasonSchedules(config);
    const matches = dedupeMatches(normalizeSchedules(payload.schedules ?? [], payload.generated_at)).filter(
      (match) => getBeijingDateKeyFromValue(match.kickoffTime) === date
    );
    return createPayload("live", matches, matches.length ? undefined : "No Sportradar matches for this Beijing date.");
  }

  const dates = adjacentDates(date);
  const settled = await Promise.allSettled(
    dates.map((day) => fetchSportradarJson<SportradarScheduleResponse>(config, `schedules/${day}/schedules.json`))
  );

  const schedules = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value.schedules ?? [] : []
  );
  const lastError = settled.find((result) => result.status === "rejected");
  if (!schedules.length && lastError?.status === "rejected") {
    throw new Error(errorMessage(lastError.reason, "Sportradar daily schedule request failed."));
  }

  const matches = dedupeMatches(normalizeSchedules(schedules)).filter(
    (match) => getBeijingDateKeyFromValue(match.kickoffTime) === date
  );
  return createPayload("live", matches, matches.length ? undefined : "No Sportradar matches for this Beijing date.");
}

async function getSeasonSchedules(config: SportradarConfig) {
  if (!config.seasonId) {
    throw new Error("SPORTRADAR_WORLD_CUP_SEASON_ID is required for season schedules.");
  }

  return fetchSportradarJson<SportradarScheduleResponse>(
    config,
    `seasons/${encodeURIComponent(config.seasonId)}/schedules.json`,
    false,
    { limit: String(SEASON_SCHEDULE_PAGE_SIZE) }
  );
}

export async function getSportradarWorldCupLive(): Promise<WorldCupPayload<WorldCupMatch[]>> {
  const config = getSportradarConfig();
  const payload = await fetchSportradarJson<SportradarScheduleResponse>(config, "schedules/live/schedules.json");
  return createPayload("live", dedupeMatches(normalizeSchedules(payload.schedules ?? [], payload.generated_at)));
}

export async function getSportradarWorldCupMatch(fixtureId: string): Promise<WorldCupPayload<WorldCupMatch>> {
  const config = getSportradarConfig();
  const eventId = safeDecode(fixtureId);
  const [summary, timeline] = await Promise.all([
    fetchSportradarJson<SportradarSummaryResponse>(
      config,
      `sport_events/${encodeURIComponent(eventId)}/summary.json`
    ),
    fetchSportradarJson<SportradarSummaryResponse>(
      config,
      `sport_events/${encodeURIComponent(eventId)}/timeline.json`,
      true
    ).catch(() => undefined)
  ]);

  const match = normalizeSchedule(
    {
      sport_event: summary.sport_event,
      sport_event_status: summary.sport_event_status,
      statistics: summary.statistics,
      timeline: timeline?.timeline ?? summary.timeline
    },
    summary.generated_at
  );

  if (!match) throw new Error(`Sportradar fixture ${fixtureId} was not found.`);
  return createPayload("live", match);
}

export async function getSportradarWorldCupStandings(): Promise<WorldCupPayload<unknown[]>> {
  const config = getSportradarConfig();
  if (!config.seasonId) {
    throw new Error("SPORTRADAR_WORLD_CUP_SEASON_ID is required for Sportradar standings.");
  }

  const payload = await fetchSportradarJson<SportradarStandingsResponse>(
    config,
    `seasons/${encodeURIComponent(config.seasonId)}/standings.json`,
    true
  );
  return createPayload("live", payload.standings ?? []);
}

function normalizeSchedules(schedules: SportradarSchedule[], generatedAt?: string) {
  return schedules
    .filter(shouldKeepSchedule)
    .map((schedule) => normalizeSchedule(schedule, generatedAt))
    .filter((match): match is WorldCupMatch => Boolean(match));
}

function normalizeSchedule(schedule: SportradarSchedule, generatedAt?: string): WorldCupMatch | undefined {
  const event = schedule.sport_event;
  if (!event?.id) return undefined;

  const context = event.sport_event_context;
  const competitors = event.competitors ?? [];
  const home = competitors.find((team) => team.qualifier === "home") ?? competitors[0];
  const away = competitors.find((team) => team.qualifier === "away") ?? competitors[1];
  const status = normalizeSportradarStatus(schedule.sport_event_status);
  const score = normalizeSportradarScore(schedule.sport_event_status);
  const homeName = home?.name ?? "Home";
  const awayName = away?.name ?? "Away";

  return {
    id: event.id,
    sportType: "football",
    competition: context?.competition?.name ?? "FIFA World Cup",
    season: Number(context?.season?.year ?? context?.stage?.year ?? WORLD_CUP_SEASON),
    round: roundLabel(context),
    group: context?.groups?.[0]?.group_name ?? context?.groups?.[0]?.name,
    kickoffTime: event.start_time ?? "",
    status,
    statusText: statusText(status, schedule.sport_event_status),
    homeTeam: { name: homeName },
    awayTeam: { name: awayName },
    score,
    venue: {
      name: event.venue?.name,
      city: [event.venue?.city_name ?? event.venue?.city, event.venue?.country_name].filter(Boolean).join(", ")
    },
    events: normalizeTimeline(schedule.timeline ?? [], homeName, awayName),
    statistics: normalizeStatistics(schedule.statistics, homeName, awayName, score.home, score.away),
    source: {
      provider: "sportradar",
      league: WORLD_CUP_LEAGUE,
      season: Number(context?.season?.year ?? WORLD_CUP_SEASON)
    },
    lastUpdated: generatedAt ?? new Date().toISOString()
  };
}

function shouldKeepSchedule(schedule: SportradarSchedule) {
  const config = getSportradarConfig();
  const context = schedule.sport_event?.sport_event_context;
  const competitionId = context?.competition?.id;
  const seasonId = context?.season?.id;

  if (config.seasonId && seasonId === config.seasonId) return true;
  if (config.competitionId && competitionId === config.competitionId) return true;
  if (config.seasonId || config.competitionId) return false;

  const text = [
    context?.competition?.name,
    context?.season?.name,
    context?.category?.name,
    context?.groups?.map((group) => group.name).join(" ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes("world cup");
}

function normalizeSportradarStatus(raw?: SportradarStatus): WorldCupMatch["status"] {
  const value = `${raw?.status ?? ""} ${raw?.match_status ?? ""}`.toLowerCase();
  if (!value.trim()) return "unknown";
  if (/(not_started|scheduled|postponed|delayed|time_to_be_defined)/.test(value)) return "scheduled";
  if (/(live|1st_half|2nd_half|halftime|overtime|penalties|awaiting_extra|awaiting_penalties)/.test(value)) return "live";
  if (/(closed|ended|aet|ap|after_penalties|after_extra_time)/.test(value)) return "finished";
  if (/postponed/.test(value)) return "postponed";
  if (/(cancelled|abandoned)/.test(value)) return "cancelled";
  return "unknown";
}

function normalizeSportradarScore(raw?: SportradarStatus): WorldCupMatch["score"] {
  const home = toNullableNumber(raw?.home_score);
  const away = toNullableNumber(raw?.away_score);
  const display = home !== null && away !== null ? `${home}-${away}` : "vs";
  const firstHalf = raw?.period_scores?.find((period) => String(period.number) === "1");
  const fulltime = raw?.period_scores?.find((period) => period.type === "regular_period" && String(period.number) === "2");
  const penalties = raw?.period_scores?.find((period) => /penalt/i.test(period.type ?? ""));

  return {
    home,
    away,
    halftime: pairScore(firstHalf?.home_score, firstHalf?.away_score),
    fulltime: pairScore(fulltime?.home_score, fulltime?.away_score),
    penalty: pairScore(penalties?.home_score, penalties?.away_score),
    display: penalties ? `${display} (pens ${penalties.home_score}-${penalties.away_score})` : display
  };
}

function normalizeTimeline(items: SportradarTimelineItem[], homeName: string, awayName: string): MatchEvent[] {
  return items
    .filter((item) => item.type || item.description)
    .slice(-24)
    .map((item) => ({
      minute: typeof item.match_time === "number" ? item.match_time : null,
      extraMinute: typeof item.stoppage_time === "number" ? item.stoppage_time : undefined,
      team: item.competitor?.name ?? sideName(item.team, homeName, awayName),
      player: item.player?.name ?? item.players?.[0]?.name,
      type: item.type ?? "event",
      detail: item.description ?? [item.method, item.outcome].filter(Boolean).join(" / ") ?? item.type ?? "event",
      comment: item.stoppage_time_clock
    }));
}

function normalizeStatistics(
  raw: SportradarStatistics | undefined,
  homeName: string,
  awayName: string,
  homeScore: number | null,
  awayScore: number | null
): MatchStatistic[] {
  const competitors = raw?.totals?.competitors ?? raw?.competitors ?? [];
  if (competitors.length) {
    return competitors.map((item) => ({
      team: item.name ?? "",
      values: Object.entries(item.statistics ?? {}).map(([type, value]) => ({
        type: statisticLabel(type),
        value: primitiveValue(value)
      }))
    }));
  }

  return [
    {
      team: homeName,
      values: [
        { type: "Goals", value: homeScore },
        { type: "Data Coverage", value: "sportradar-basic" }
      ]
    },
    {
      team: awayName,
      values: [
        { type: "Goals", value: awayScore },
        { type: "Data Coverage", value: "sportradar-basic" }
      ]
    }
  ];
}

function roundLabel(context?: SportradarContext) {
  const parts = [
    context?.stage?.phase,
    context?.stage?.type,
    context?.round?.name,
    context?.round?.number ? `Round ${context.round.number}` : undefined
  ].filter(Boolean);
  return parts.join(" - ") || "World Cup";
}

function statusText(status: WorldCupMatch["status"], raw?: SportradarStatus) {
  if (raw?.match_status) return raw.match_status.replace(/_/g, " ");
  if (status === "finished") return "Finished";
  if (status === "live") return "Live";
  if (status === "scheduled") return "Scheduled";
  if (status === "postponed") return "Postponed";
  if (status === "cancelled") return "Cancelled";
  return "Unknown";
}

function getSportradarConfig(): SportradarConfig {
  const apiKey = process.env.SPORTRADAR_API_KEY?.trim();
  if (!apiKey) throw new Error("SPORTRADAR_API_KEY is not configured.");

  const accessLevel = process.env.SPORTRADAR_ACCESS_LEVEL?.trim() || DEFAULT_ACCESS_LEVEL;
  const languageCode = process.env.SPORTRADAR_LANGUAGE_CODE?.trim() || DEFAULT_LANGUAGE_CODE;
  const soccerBaseUrl =
    process.env.SPORTRADAR_BASE_URL?.trim() ||
    `https://api.sportradar.com/soccer/${accessLevel}/v4/${languageCode}`;
  const soccerExtendedBaseUrl =
    process.env.SPORTRADAR_EXTENDED_BASE_URL?.trim() ||
    `https://api.sportradar.com/soccer-extended/${accessLevel}/v4/${languageCode}`;

  return {
    apiKey,
    accessLevel,
    languageCode,
    soccerBaseUrl,
    soccerExtendedBaseUrl,
    competitionId: process.env.SPORTRADAR_WORLD_CUP_COMPETITION_ID?.trim() || undefined,
    seasonId: process.env.SPORTRADAR_WORLD_CUP_SEASON_ID?.trim() || undefined
  };
}

async function fetchSportradarJson<T>(
  config: SportradarConfig,
  path: string,
  extended = false,
  query: Record<string, string> = {}
): Promise<T> {
  const baseUrl = extended ? config.soccerExtendedBaseUrl : config.soccerBaseUrl;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  url.searchParams.set("api_key", config.apiKey);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-api-key": config.apiKey
      },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Sportradar ${path} returned ${response.status}${body ? `: ${body.slice(0, 160)}` : ""}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function dedupeMatches(matches: WorldCupMatch[]) {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.id)) return false;
    seen.add(match.id);
    return true;
  });
}

function adjacentDates(date: string) {
  const base = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return [date];
  return [-1, 0, 1].map((offset) => {
    const next = new Date(base);
    next.setUTCDate(base.getUTCDate() + offset);
    return next.toISOString().slice(0, 10);
  });
}

function pairScore(home?: number | string | null, away?: number | string | null) {
  const normalizedHome = toNullableNumber(home);
  const normalizedAway = toNullableNumber(away);
  return normalizedHome !== null && normalizedAway !== null ? `${normalizedHome}-${normalizedAway}` : undefined;
}

function toNullableNumber(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sideName(side: string | undefined, homeName: string, awayName: string) {
  if (side === "home") return homeName;
  if (side === "away") return awayName;
  return "";
}

function primitiveValue(value: unknown): string | number | null {
  if (typeof value === "string" || typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  return null;
}

function statisticLabel(value: string) {
  const labels: Record<string, string> = {
    ball_possession: "Ball Possession",
    shots_on_target: "Shots on Target",
    shots_total: "Total Shots",
    corner_kicks: "Corner Kicks",
    fouls: "Fouls",
    yellow_cards: "Yellow Cards",
    red_cards: "Red Cards",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
