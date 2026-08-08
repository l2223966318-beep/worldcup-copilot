import type { HotTopic } from "@/lib/hot/types";

export const HOT_TOPIC_AI_CACHE_TTL_MS = 7 * 24 * 60 * 60_000;

const HOT_TOPIC_AI_CACHE_VERSION = "hot-topic-analysis-v1";
const HOT_TOPIC_AI_CACHE_PREFIX = "worldcup.hot-topic-ai-analysis";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type CacheableAiPayload = { sourceStatus: string };

type HotTopicAiCacheEntry<T> = {
  version: string;
  fingerprint: string;
  savedAt: number;
  payload: T;
};

export function readHotTopicAiCache<T extends CacheableAiPayload>(
  storage: StorageLike,
  topic: HotTopic,
  now = Date.now()
): T | null {
  const key = buildCacheKey(topic.id);

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as HotTopicAiCacheEntry<T>;
    const isValid =
      entry.version === HOT_TOPIC_AI_CACHE_VERSION &&
      entry.fingerprint === buildTopicFingerprint(topic) &&
      entry.payload?.sourceStatus === "live" &&
      now - entry.savedAt <= HOT_TOPIC_AI_CACHE_TTL_MS;

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

export function writeHotTopicAiCache<T extends CacheableAiPayload>(
  storage: StorageLike,
  topic: HotTopic,
  payload: T,
  now = Date.now()
) {
  if (payload.sourceStatus !== "live") return;

  const entry: HotTopicAiCacheEntry<T> = {
    version: HOT_TOPIC_AI_CACHE_VERSION,
    fingerprint: buildTopicFingerprint(topic),
    savedAt: now,
    payload
  };

  try {
    storage.setItem(buildCacheKey(topic.id), JSON.stringify(entry));
  } catch {
    // Browser storage can be unavailable; analysis still works without caching.
  }
}

function buildCacheKey(topicId: string) {
  return `${HOT_TOPIC_AI_CACHE_PREFIX}.${encodeURIComponent(topicId)}`;
}

function buildTopicFingerprint(topic: HotTopic) {
  const source = JSON.stringify({
    version: HOT_TOPIC_AI_CACHE_VERSION,
    id: topic.id,
    title: topic.title,
    summary: topic.summary,
    heat: topic.heat,
    platform: topic.platform,
    source: topic.source,
    category: topic.category,
    valueLevel: topic.valueLevel,
    valueScore: topic.valueScore,
    relevanceScore: topic.relevanceScore,
    tags: topic.tags,
    updatedAt: topic.updatedAt,
    contentAngles: topic.contentAngles,
    relatedMatches: topic.relatedMatches
  });
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) | 0;
  }
  return String(hash);
}
