import { apiFootballGet } from "@/lib/sports/apiFootballClient";
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
  getFreeWorldCup2026Fixtures,
  getFreeWorldCup2026Live,
  getFreeWorldCup2026Match,
  getFreeWorldCup2026Standings,
  getFreeWorldCup2026Today
} from "@/lib/sports/worldCup2026FreeClient";

const WORLD_CUP_LEAGUE = 1;
const DEFAULT_WORLD_CUP_SEASON = 2026;
const WORLD_CUP_SEASON = getConfiguredWorldCupSeason();
const FIXTURE_CACHE_TTL_MS = 30_000;
const ACTIVE_CACHE_TTL_MS = 15_000;

type CacheEntry<T> = {
  expiresAt: number;
  payload: WorldCupPayload<T>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getWorldCupFixtures() {
  if (shouldUseFreeWorldCup2026Source()) {
    return cached("free-2026-fixtures", FIXTURE_CACHE_TTL_MS, getFreeWorldCup2026Fixtures, fallbackList);
  }

  return cached("fixtures", FIXTURE_CACHE_TTL_MS, async () => {
    const payload = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON
    });
    const matches = normalizeFixtures(payload.response ?? []);
    if (!matches.length) return fallbackList("API-Football returned no fixtures.");
    return createPayload("live", matches);
  }, fallbackList);
}

export async function getTodayWorldCupFixtures(date = getTodayDate()) {
  if (shouldUseFreeWorldCup2026Source()) {
    return cached(`free-2026-fixtures-today-${date}`, ACTIVE_CACHE_TTL_MS, () => getFreeWorldCup2026Today(date), fallbackList);
  }

  return cached(`fixtures-today-${date}`, ACTIVE_CACHE_TTL_MS, async () => {
    const payload = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON,
      date
    });
    const matches = normalizeFixtures(payload.response ?? []);
    if (!matches.length) return fallbackList("No World Cup fixtures for today.");
    return createPayload("live", matches);
  }, fallbackList);
}

export async function getLiveWorldCupFixtures() {
  if (shouldUseFreeWorldCup2026Source()) {
    return cached("free-2026-fixtures-live", 20_000, getFreeWorldCup2026Live, () => createPayload("fallback", []));
  }

  return cached("fixtures-live", 20_000, async () => {
    const payload = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON,
      live: "all"
    });
    const matches = normalizeFixtures(payload.response ?? []);
    if (!matches.length) return createPayload("live", []);
    return createPayload("live", matches);
  }, () => createPayload("fallback", []));
}

export async function getWorldCupMatch(fixtureId: string) {
  if (fixtureId === "argentina-france-2022-final") {
    return createPayload("fallback", getFallbackMatch(fixtureId), "Historical mock sample.");
  }

  if (shouldUseFreeWorldCup2026Source()) {
    return cached(
      `free-2026-match-${fixtureId}`,
      ACTIVE_CACHE_TTL_MS,
      () => getFreeWorldCup2026Match(fixtureId),
      (message) => createPayload("fallback", getFallbackMatch(fixtureId), message)
    );
  }

  return cached(`match-${fixtureId}`, ACTIVE_CACHE_TTL_MS, async () => {
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
  }, (message) => createPayload("fallback", getFallbackMatch(fixtureId), message));
}

export async function getWorldCupStandings() {
  if (shouldUseFreeWorldCup2026Source()) {
    return cached("free-2026-standings", 120_000, getFreeWorldCup2026Standings, (message) => createPayload("fallback", [], message));
  }

  return cached("standings", 120_000, async () => {
    const payload = await apiFootballGet<unknown[]>("/standings", {
      league: WORLD_CUP_LEAGUE,
      season: WORLD_CUP_SEASON
    });
    return createPayload("live", payload.response ?? []);
  }, (message) => createPayload("fallback", [], message));
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
    if (payload.sourceStatus === "live") {
      cache.set(key, { expiresAt: now + ttlMs, payload });
    }
    return payload;
  } catch (error) {
    if (entry) return { ...entry.payload, sourceStatus: "cache" };
    const message = error instanceof Error ? error.message : "Unknown API-Football error.";
    const fallbackPayload = fallback(message);
    const sourceStatus: SourceStatus = message.includes("API_FOOTBALL_KEY is not configured") ? "fallback" : "error";
    return {
      ...fallbackPayload,
      sourceStatus,
      message
    };
  }
}

function fallbackList(message?: string): WorldCupPayload<WorldCupMatch[]> {
  return createPayload("fallback", getFallbackMatches(), message);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getConfiguredWorldCupSeason() {
  const season = Number(process.env.API_FOOTBALL_SEASON);
  return Number.isInteger(season) && season > 0 ? season : DEFAULT_WORLD_CUP_SEASON;
}

function shouldUseFreeWorldCup2026Source() {
  const source = process.env.WORLD_CUP_DATA_SOURCE ?? "free-2026";
  return source === "free-2026" || (WORLD_CUP_SEASON === 2026 && source !== "api-football");
}
