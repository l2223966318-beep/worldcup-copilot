import {
  createPayload,
  getFallbackMatch,
  getFallbackMatches
} from "@/lib/sports/normalizers";
import type {
  SourceStatus,
  WorldCupMatch,
  WorldCupPayload
} from "@/lib/sports/types";
import {
  getSportradarWorldCupFixtures,
  getSportradarWorldCupLive,
  getSportradarWorldCupMatch,
  getSportradarWorldCupStandings,
  getSportradarWorldCupToday,
  hasSportradarKey,
  hasSportradarSeasonId,
  isSportradarFixtureId
} from "@/lib/sports/sportradarClient";
import {
  getFreeWorldCup2026Fixtures,
  getFreeWorldCup2026Live,
  getFreeWorldCup2026Match,
  getFreeWorldCup2026Standings,
  getFreeWorldCup2026Today
} from "@/lib/sports/worldCup2026FreeClient";
import { getBeijingDateKey } from "@/lib/time/beijingTime";

// Retry a recovered primary source promptly instead of holding a fallback fixture list for ten minutes.
const FIXTURE_CACHE_TTL_MS = 2 * 60_000;
const ACTIVE_CACHE_TTL_MS = 10 * 60_000;
const LIVE_CACHE_TTL_MS = 2 * 60_000;
const ERROR_CACHE_TTL_MS = 2 * 60_000;

type CacheEntry<T> = {
  expiresAt: number;
  payload: WorldCupPayload<T>;
};

type SourceLoader<T> = {
  enabled?: boolean;
  load: () => Promise<WorldCupPayload<T>>;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getWorldCupFixtures() {
  return cachedFirstAvailable(
    "worldcup-fixtures",
    FIXTURE_CACHE_TTL_MS,
    [
      {
        enabled: hasSportradarKey() && hasSportradarSeasonId(),
        load: getSportradarWorldCupFixtures
      },
      { load: getFreeWorldCup2026Fixtures }
    ],
    fallbackList
  );
}

export async function getTodayWorldCupFixtures(date = getTodayDate()) {
  return cachedFirstAvailable(
    `worldcup-fixtures-today-${date}`,
    ACTIVE_CACHE_TTL_MS,
    [
      {
        enabled: hasSportradarKey(),
        load: () => requireNonEmpty(getSportradarWorldCupToday(date), "Sportradar returned no fixtures for today.")
      },
      { load: () => getFreeWorldCup2026Today(date) }
    ],
    fallbackList
  );
}

export async function getLiveWorldCupFixtures() {
  return cachedFirstAvailable(
    "worldcup-fixtures-live",
    LIVE_CACHE_TTL_MS,
    [
      {
        enabled: hasSportradarKey(),
        load: getSportradarWorldCupLive
      },
      { load: getFreeWorldCup2026Live }
    ],
    () => createPayload("fallback", [])
  );
}

export async function getWorldCupMatch(fixtureId: string) {
  if (fixtureId === "argentina-france-2022-final") {
    return createPayload("fallback", getFallbackMatch(fixtureId), "Historical mock sample.");
  }

  return cachedFirstAvailable(
    `worldcup-match-${fixtureId}`,
    ACTIVE_CACHE_TTL_MS,
    [
      {
        enabled: hasSportradarKey() && isSportradarFixtureId(fixtureId),
        load: () => getSportradarWorldCupMatch(fixtureId)
      },
      { load: () => getFreeWorldCup2026Match(fixtureId) }
    ],
    (message) => createPayload("fallback", getFallbackMatch(fixtureId), message)
  );
}

export async function getWorldCupStandings() {
  return cachedFirstAvailable(
    "worldcup-standings",
    120_000,
    [
      {
        enabled: hasSportradarKey() && hasSportradarSeasonId(),
        load: getSportradarWorldCupStandings
      },
      { load: getFreeWorldCup2026Standings }
    ],
    (message) => createPayload("fallback", [], message)
  );
}

async function cachedFirstAvailable<T>(
  key: string,
  ttlMs: number,
  sources: SourceLoader<T>[],
  fallback: (message?: string) => WorldCupPayload<T>
): Promise<WorldCupPayload<T>> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const now = Date.now();

  if (entry && entry.expiresAt > now && !isFallbackFixturePayload(entry.payload)) {
    return { ...entry.payload, sourceStatus: "cache" as SourceStatus };
  }

  if (entry && isFallbackFixturePayload(entry.payload)) cache.delete(key);

  let lastMessage: string | undefined;

  for (const source of sources) {
    if (source.enabled === false) continue;

    try {
      const payload = await source.load();
      if (payload.sourceStatus === "live" || payload.sourceStatus === "fallback") {
        // A usable fallback should render as data, not as an upstream provider error.
        const resolvedPayload = lastMessage && payload.sourceStatus === "fallback"
          ? withFallbackMessage(payload, lastMessage)
          : payload;
        if (!isFallbackFixturePayload(resolvedPayload)) {
          cache.set(key, { expiresAt: now + ttlMs, payload: resolvedPayload });
        }
        return resolvedPayload;
      }
      return lastMessage ? withFallbackMessage(payload, lastMessage) : payload;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "Unknown World Cup data source error.";
      if (process.env.NODE_ENV !== "production") {
        console.error("[worldcup-service]", lastMessage);
      }
    }
  }

  if (entry) return { ...entry.payload, sourceStatus: "cache" };

  const message = lastMessage ?? "No World Cup data source was available.";
  const payload = {
    ...fallback(message),
    sourceStatus: "error" as SourceStatus,
    message
  };
  cache.set(key, { expiresAt: now + ERROR_CACHE_TTL_MS, payload });
  return payload;
}

function fallbackList(message?: string): WorldCupPayload<WorldCupMatch[]> {
  return createPayload("fallback", getFallbackMatches(), message);
}

function withFallbackMessage<T>(payload: WorldCupPayload<T>, upstreamMessage: string): WorldCupPayload<T> {
  return {
    ...payload,
    message: payload.message
      ? `${upstreamMessage}；${payload.message}`
      : upstreamMessage
  };
}

function isFallbackFixturePayload<T>(payload: WorldCupPayload<T>) {
  if (!Array.isArray(payload.data) || !payload.data.length) return false;
  const first = payload.data[0] as { source?: { provider?: string } };
  return first.source?.provider === "worldcup26-free" || first.source?.provider === "thestatsapi-fixtures";
}

async function requireNonEmpty<T>(
  payloadPromise: Promise<WorldCupPayload<T[]>>,
  message: string
) {
  const payload = await payloadPromise;
  if (!payload.data.length) throw new Error(payload.message ?? message);
  return payload;
}

function getTodayDate() {
  return getBeijingDateKey();
}
