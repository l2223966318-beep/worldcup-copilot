import type { HotItem, HotSearchContext } from "./types";

type AnyRecord = Record<string, unknown>;

const tagRules: Array<[RegExp, string]> = [
  [/(乌龙球|own\s*goal|o\.?g\.?)/i, "乌龙球"],
  [/(球衣被扯破|衣服被扯破|jersey\s*ripped|shirt\s*torn)/i, "球衣被扯破"],
  [/(var|视频助理裁判)/i, "VAR"],
  [/(争议|裁判|判罚|黑哨)/i, "争议判罚"],
  [/(伤退|受伤|injury|injured)/i, "伤病需核实"],
  [/(世界杯|world\s*cup)/i, "世界杯"],
  [/(美国|united\s*states|usmnt|usa)/i, "美国队"],
  [/(韩国|korea)/i, "韩国队"],
  [/(捷克|czech)/i, "捷克队"]
];

export function normalizeDailyHotPayload(payload: unknown, context: HotSearchContext): HotItem[] {
  const root = asRecord(payload);
  const data = firstArray(root, ["data", "items", "list", "result"]);
  const platform = context.platform ?? stringValue(root.title) ?? "今日热榜";

  return data.map((entry, index) => {
    const item = asRecord(entry);
    const title = pickString(item, ["title", "name", "word", "keyword"]) || "未命名热点";
    const summary = pickString(item, ["desc", "summary", "content", "description"]) || title;
    const url = pickString(item, ["url", "mobileUrl", "link", "href"]) || "";
    const rank = numberValue(item.rank) ?? index + 1;
    const heat = pickString(item, ["hot", "heat", "views", "score"]);

    return createHotItem({
      title,
      summary,
      url,
      source: context.source ?? "dailyhot",
      platform,
      rank,
      heat,
      relevance: scoreByRank(rank, heat, `${title} ${summary}`, context.query),
      context
    });
  });
}

export function normalizeTavilyPayload(payload: unknown, context: HotSearchContext): HotItem[] {
  const root = asRecord(payload);
  const data = firstArray(root, ["results", "data", "items"]);

  return data.map((entry, index) => {
    const item = asRecord(entry);
    const title = pickString(item, ["title", "name"]) || "未命名搜索结果";
    const summary = pickString(item, ["content", "snippet", "summary", "description"]) || title;
    const url = pickString(item, ["url", "link", "href"]) || "";
    const apiScore = numberValue(item.score);

    return createHotItem({
      title,
      summary,
      url,
      source: "tavily",
      platform: "全网搜索",
      rank: index + 1,
      relevance: Math.max(1, Math.round((apiScore ?? 0.55) * 100)),
      context
    });
  });
}

export function normalizeTopHubDataPayload(payload: unknown, context: HotSearchContext): HotItem[] {
  const root = asRecord(payload);
  const data = findFirstArray(root);

  return data.map((entry, index) => {
    const item = asRecord(entry);
    const nested = asRecord(item.item) || asRecord(item.node) || {};
    const title = pickString(item, ["title", "name", "keyword"]) || pickString(nested, ["title", "name"]) || "未命名热点";
    const summary = pickString(item, ["description", "desc", "summary", "excerpt"]) || pickString(nested, ["description", "desc"]) || title;
    const url = pickString(item, ["url", "link", "mobileUrl", "href"]) || pickString(nested, ["url", "link"]) || "";
    const rank = numberValue(item.rank) ?? index + 1;
    const heat = pickString(item, ["hot", "heat", "views", "score"]);
    const platform = pickString(item, ["platform", "sourceName"]) || pickString(nested, ["title", "name"]) || context.platform || "榜眼数据";

    return createHotItem({
      title,
      summary,
      url,
      source: "tophubdata",
      platform,
      rank,
      heat,
      relevance: scoreByRank(rank, heat, `${title} ${summary}`, context.query),
      context
    });
  });
}

export function mergeHotItems(items: HotItem[]): HotItem[] {
  const merged = new Map<string, HotItem>();

  for (const item of items) {
    const key = item.url || normalizeText(item.title);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }

    const primary = sourcePriority(existing.source) >= sourcePriority(item.source) ? existing : item;
    const supplement = primary === existing ? item : existing;
    merged.set(key, {
      ...primary,
      summary: primary.summary.length >= supplement.summary.length ? primary.summary : supplement.summary,
      relevance: Math.max(existing.relevance, item.relevance),
      tags: Array.from(new Set([...existing.tags, ...item.tags])),
      source: Array.from(new Set([...existing.source.split("+"), ...item.source.split("+")])).join("+"),
      heat: primary.heat ?? supplement.heat,
      rank: Math.min(existing.rank ?? 999, item.rank ?? 999)
    });
  }

  return Array.from(merged.values()).sort(
    (a, b) => sourcePriority(b.source) - sourcePriority(a.source) || b.relevance - a.relevance || (a.rank ?? 999) - (b.rank ?? 999)
  );
}

function sourcePriority(source: string) {
  if (/tophubdata|dailyhot/i.test(source)) return 3;
  if (/tavily/i.test(source)) return 2;
  if (/fallback|ai/i.test(source)) return 1;
  return 0;
}

function createHotItem(input: {
  title: string;
  summary: string;
  url: string;
  source: string;
  platform: string;
  rank?: number;
  heat?: string;
  relevance: number;
  context: HotSearchContext;
}): HotItem {
  const text = `${input.title} ${input.summary}`;
  const tags = extractTags(`${text} ${input.context.query}`);

  return {
    id: stableId(`${input.source}:${input.url || input.title}`),
    title: cleanText(input.title),
    summary: cleanText(input.summary),
    url: input.url,
    source: input.source,
    platform: input.platform,
    rank: input.rank,
    heat: input.heat,
    relevance: clamp(input.relevance + queryBoost(text, input.context.query) + tags.length * 2, 1, 100),
    tags
  };
}

function extractTags(text: string) {
  const tags = tagRules.flatMap(([pattern, tag]) => (pattern.test(text) ? [tag] : []));
  return Array.from(new Set(tags));
}

function queryBoost(text: string, query: string) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  const normalized = normalizeText(text);
  const matched = words.filter((word) => normalized.includes(word)).length;
  return Math.min(12, matched * 4);
}

function scoreByRank(rank: number, heat: string | undefined, text: string, query: string) {
  const rankScore = Math.max(35, 96 - (rank - 1) * 5);
  const heatScore = heat ? 4 : 0;
  return clamp(rankScore + heatScore + queryBoost(text, query), 1, 100);
}

function firstArray(root: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = root[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function findFirstArray(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown[] {
  if (depth > 8) return [];
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  if (seen.has(record)) return [];
  seen.add(record);
  for (const key of ["data", "items", "list", "result", "results", "nodes"]) {
    const found = findFirstArray(record[key], depth + 1, seen);
    if (found.length) return found;
  }
  return [];
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function pickString(record: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return "";
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(value: string) {
  return cleanText(value).toLowerCase();
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `hot-${Math.abs(hash)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
