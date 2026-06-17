import { apiFootballGet } from "@/lib/sports/apiFootballClient";
import { hasApiFootballKey } from "@/lib/sports/apiFootballClient";
import {
  createPayload,
  getFallbackMatch,
  getFallbackMatches,
  normalizeFixture,
  normalizeFixtures
} from "@/lib/sports/normalizers";
import type {
  ApiFootballEvent,
  ApiFootballFixture,
  ApiFootballStatistic,
  SourceStatus,
  WorldCupMatch,
  WorldCupPayload
} from "@/lib/sports/types";
import {
  getSportmonksWorldCupFixtures,
  getSportmonksWorldCupLive,
  getSportmonksWorldCupMatch,
  getSportmonksWorldCupStandings,
  getSportmonksWorldCupToday,
  hasSportmonksKey
} from "@/lib/sports/sportmonksClient";
import {
  getFreeWorldCup2026Fixtures,
  getFreeWorldCup2026Live,
  getFreeWorldCup2026Match,
  getFreeWorldCup2026Standings,
  getFreeWorldCup2026Today
} from "@/lib/sports/worldCup2026FreeClient";
import { getBeijingDateKey } from "@/lib/time/beijingTime";

const WORLD_CUP_LEAGUE = 1;
const DEFAULT_WORLD_CUP_SEASON = 2026;
const WORLD_CUP_SEASON = getConfiguredWorldCupSeason();
const FIXTURE_CACHE_TTL_MS = 10 * 60_000;
const ACTIVE_CACHE_TTL_MS = 60_000;
const ERROR_CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  expiresAt: number;
  payload: WorldCupPayload<T>;
};

type DataSource = "auto" | "sportmonks" | "api-football" | "free-2026";

const cache = new Map<string, CacheEntry<unknown>>();

export async function getWorldCupFixtures() {
  return firstAvailable(
    [
      {
        key: "sportmonks-fixtures",
        enabled: shouldUseSportmonksSource(),
        ttlMs: FIXTURE_CACHE_TTL_MS,
        load: getSportmonksWorldCupFixtures
      },
      {
        key: "fixtures",
        enabled: shouldUseApiFootballSource(),
        ttlMs: FIXTURE_CACHE_TTL_MS,
        load: getApiFootballFixtures
      },
      {
        key: "free-2026-fixtures",
        enabled: shouldUseFreeWorldCup2026Source(),
        ttlMs: FIXTURE_CACHE_TTL_MS,
        load: getFreeWorldCup2026Fixtures
      }
    ],
    fallbackList
  );
}

async function getApiFootballFixtures() {
    const payload = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON
    });
    const matches = normalizeFixtures(payload.response ?? []);
    if (!matches.length) return fallbackList("API-Football returned no fixtures.");
    return createPayload("live", matches);
}

async function getApiFootballToday(date: string) {
  const payload = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
    league: WORLD_CUP_LEAGUE,
    season: WORLD_CUP_SEASON,
    date
  });
  const matches = normalizeFixtures(payload.response ?? []);
  if (!matches.length) return fallbackList("No World Cup fixtures for today.");
  return createPayload("live", matches);
}

export async function getTodayWorldCupFixtures(date = getTodayDate()) {
  return firstAvailable(
    [
      {
        key: `sportmonks-fixtures-today-${date}`,
        enabled: shouldUseSportmonksSource(),
        ttlMs: ACTIVE_CACHE_TTL_MS,
        load: () => getSportmonksWorldCupToday(date)
      },
      {
        key: `fixtures-today-${date}`,
        enabled: shouldUseApiFootballSource(),
        ttlMs: ACTIVE_CACHE_TTL_MS,
        load: () => getApiFootballToday(date)
      },
      {
        key: `free-2026-fixtures-today-${date}`,
        enabled: shouldUseFreeWorldCup2026Source(),
        ttlMs: ACTIVE_CACHE_TTL_MS,
        load: () => getFreeWorldCup2026Today(date)
      }
    ],
    fallbackList
  );
}

export async function getLiveWorldCupFixtures() {
  return firstAvailable(
    [
      {
        key: "sportmonks-fixtures-live",
        enabled: shouldUseSportmonksSource(),
        ttlMs: 20_000,
        load: getSportmonksWorldCupLive
      },
      {
        key: "fixtures-live",
        enabled: shouldUseApiFootballSource(),
        ttlMs: 20_000,
        load: getApiFootballLive
      },
      {
        key: "free-2026-fixtures-live",
        enabled: shouldUseFreeWorldCup2026Source(),
        ttlMs: 20_000,
        load: getFreeWorldCup2026Live
      }
    ],
    () => createPayload("fallback", [])
  );
}

async function getApiFootballLive() {
    const payload = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON,
      live: "all"
    });
    const matches = normalizeFixtures(payload.response ?? []);
    if (!matches.length) return createPayload("live", []);
    return createPayload("live", matches);
}

async function getApiFootballMatch(fixtureId: string) {
  const [fixturePayload, eventsPayload, statisticsPayload] = await Promise.all([
    apiFootballGet<ApiFootballFixture[]>("/fixtures", { id: fixtureId }),
    apiFootballGet<ApiFootballEvent[]>("/fixtures/events", { fixture: fixtureId }),
    apiFootballGet<ApiFootballStatistic[]>("/fixtures/statistics", { fixture: fixtureId })
  ]);

  const fixture = fixturePayload.response?.[0];
  if (!fixture) return createPayload("fallback", getFallbackMatch(), "Fixture not found.");

  const match = normalizeFixture(fixture, {
    events: eventsPayload.response ?? [],
    statistics: statisticsPayload.response ?? []
  });

  return createPayload("live", match);
}

export async function getWorldCupMatch(fixtureId: string) {
  if (fixtureId === "argentina-france-2022-final") {
    return createPayload("fallback", getFallbackMatch(fixtureId), "Historical mock sample.");
  }

  return firstAvailable(
    [
      {
        key: `sportmonks-match-${fixtureId}`,
        enabled: shouldUseSportmonksSource() && isLikelyNumericId(fixtureId),
        ttlMs: ACTIVE_CACHE_TTL_MS,
        load: () => getSportmonksWorldCupMatch(fixtureId)
      },
      {
        key: `match-${fixtureId}`,
        enabled: shouldUseApiFootballSource() && isLikelyNumericId(fixtureId),
        ttlMs: ACTIVE_CACHE_TTL_MS,
        load: () => getApiFootballMatch(fixtureId)
      },
      {
        key: `free-2026-match-${fixtureId}`,
        enabled: shouldUseFreeWorldCup2026Source(),
        ttlMs: ACTIVE_CACHE_TTL_MS,
        load: () => getFreeWorldCup2026Match(fixtureId)
      }
    ],
    (message) => createPayload("fallback", getFallbackMatch(fixtureId), message)
  );
}

export async function getWorldCupStandings() {
  return firstAvailable(
    [
      {
        key: "sportmonks-standings",
        enabled: shouldUseSportmonksSource(),
        ttlMs: 120_000,
        load: getSportmonksWorldCupStandings
      },
      {
        key: "standings",
        enabled: shouldUseApiFootballSource(),
        ttlMs: 120_000,
        load: getApiFootballStandings
      },
      {
        key: "free-2026-standings",
        enabled: shouldUseFreeWorldCup2026Source(),
        ttlMs: 120_000,
        load: getFreeWorldCup2026Standings
      }
    ],
    (message) => createPayload("fallback", [], message)
  );
}

async function getApiFootballStandings() {
    const payload = await apiFootballGet<unknown[]>("/standings", {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON
    });
    return createPayload("live", payload.response ?? []);
}

async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<WorldCupPayload<T>>,
  fallback: (message?: string) => WorldCupPayload<T>
): Promise<WorldCupPayload<T>> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (entry && entry.expiresAt > now) {
    return { ...entry.payload, sourceStatus: "cache" as SourceStatus };
  }

  try {
    const payload = await load();
    if (payload.sourceStatus === "live" || payload.sourceStatus === "fallback") {
      cache.set(key, { expiresAt: now + ttlMs, payload });
    }
    return payload;
  } catch (error) {
    if (entry) return { ...entry.payload, sourceStatus: "cache" };
    const message = error instanceof Error ? error.message : "Unknown API-Football error.";
    const fallbackPayload = fallback(message);
    const sourceStatus: SourceStatus = message.includes("API_FOOTBALL_KEY is not configured") ? "fallback" : "error";
    const payload = {
      ...fallbackPayload,
      sourceStatus,
      message
    };
    cache.set(key, { expiresAt: now + ERROR_CACHE_TTL_MS, payload });
    return payload;
  }
}

async function firstAvailable<T>(
  sources: Array<{
    key: string;
    enabled: boolean;
    ttlMs: number;
    load: () => Promise<WorldCupPayload<T>>;
  }>,
  fallback: (message?: string) => WorldCupPayload<T>
): Promise<WorldCupPayload<T>> {
  const errors: string[] = [];

  for (const source of sources) {
    if (!source.enabled) continue;
    const payload = await cached(source.key, source.ttlMs, source.load, (message) => {
      errors.push(message ?? `${source.key} failed.`);
      return fallback(message);
    });

    if (payload.sourceStatus === "live" || payload.sourceStatus === "cache") {
      return payload;
    }
    if (payload.message) errors.push(payload.message);
  }

  return fallback(errors.filter(Boolean).join("；") || "No configured World Cup data source returned data.");
}

function fallbackList(message?: string): WorldCupPayload<WorldCupMatch[]> {
  return createPayload("fallback", getFallbackMatches(), message);
}

function getTodayDate() {
  return getBeijingDateKey();
}

function getConfiguredWorldCupSeason() {
  const season = Number(process.env.API_FOOTBALL_SEASON);
  return Number.isInteger(season) && season > 0 ? season : DEFAULT_WORLD_CUP_SEASON;
}

function getConfiguredDataSource(): DataSource {
  const source = process.env.WORLD_CUP_DATA_SOURCE;
  if (source === "sportmonks" || source === "api-football" || source === "free-2026") return source;
  return "auto";
}

function shouldUseSportmonksSource() {
  const source = getConfiguredDataSource();
  return (source === "auto" || source === "sportmonks") && hasSportmonksKey();
}

function shouldUseApiFootballSource() {
  const source = getConfiguredDataSource();
  return (source === "auto" || source === "api-football") && hasApiFootballKey();
}

function shouldUseFreeWorldCup2026Source() {
  const source = getConfiguredDataSource();
  return source === "auto" || source === "free-2026";
}

function isLikelyNumericId(value: string) {
  return /^\d+$/.test(value);
}
