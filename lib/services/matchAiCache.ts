import type { MatchData } from "@/data/matches";
import type { TopicIdea } from "@/lib/ai/topics";

export const MATCH_AI_WORKFLOW_CACHE_TTL_MS = 7 * 24 * 60 * 60_000;

const MATCH_AI_WORKFLOW_CACHE_VERSION = "match-analysis-v1";
const MATCH_AI_WORKFLOW_CACHE_PREFIX = "worldcup.match-ai-workflow";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type CacheableAiPayload = { sourceStatus: string };

type MatchAiCacheEntry<T> = {
  version: string;
  fingerprint: string;
  savedAt: number;
  payload: T;
};

export function readMatchAiWorkflowCache<T extends CacheableAiPayload>(
  storage: StorageLike,
  match: MatchData,
  topics: TopicIdea[],
  now = Date.now()
): T | null {
  const key = buildMatchAiCacheKey(match.id);

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as MatchAiCacheEntry<T>;
    const isValid =
      entry.version === MATCH_AI_WORKFLOW_CACHE_VERSION &&
      entry.fingerprint === buildMatchFingerprint(match, topics) &&
      entry.payload?.sourceStatus === "live" &&
      now - entry.savedAt <= MATCH_AI_WORKFLOW_CACHE_TTL_MS;

    if (!isValid) {
      storage.removeItem(key);
      return null;
    }

    return entry.payload;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeMatchAiWorkflowCache<T extends CacheableAiPayload>(
  storage: StorageLike,
  match: MatchData,
  topics: TopicIdea[],
  payload: T,
  now = Date.now()
) {
  if (payload.sourceStatus !== "live") return;

  const entry: MatchAiCacheEntry<T> = {
    version: MATCH_AI_WORKFLOW_CACHE_VERSION,
    fingerprint: buildMatchFingerprint(match, topics),
    savedAt: now,
    payload
  };

  try {
    storage.setItem(buildMatchAiCacheKey(match.id), JSON.stringify(entry));
  } catch {
    // Storage may be unavailable in privacy mode; AI analysis can still run normally.
  }
}

function buildMatchAiCacheKey(matchId: string) {
  return `${MATCH_AI_WORKFLOW_CACHE_PREFIX}.${encodeURIComponent(matchId)}`;
}

function buildMatchFingerprint(match: MatchData, topics: TopicIdea[]) {
  const source = JSON.stringify({
    version: MATCH_AI_WORKFLOW_CACHE_VERSION,
    match,
    topics
  });
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }
  return String(hash);
}
