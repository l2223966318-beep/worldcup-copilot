import type { HotItem } from "@/lib/hot/types";

type AnyRecord = Record<string, unknown>;

const REDFOX_XHS_CATEGORIES = [
  "综合全部",
  "出行代步",
  "休闲爱好",
  "影视娱乐",
  "数码科技",
  "医疗保健",
  "综合杂项",
  "星座情感",
  "时尚穿搭",
  "婚庆婚礼",
  "拍摄记录",
  "学习教育",
  "化妆美容",
  "居家装修",
  "旅行度假",
  "亲子育儿",
  "个人护理",
  "美味佳肴",
  "职业发展",
  "宠物天地",
  "潮流鞋包",
  "日常生活",
  "科学探索",
  "新闻资讯",
  "体育锻炼"
] as const;

export async function fetchXiaohongshuHotItems(
  limit: number,
  options: {
    apiUrl?: string;
    apiKey?: string;
    redfoxApiKey?: string;
    redfoxCategory?: string;
    redfoxRankDate?: string;
  } = {}
): Promise<{ items: HotItem[]; message?: string }> {
  const configuredUrl = options.apiUrl?.trim() || process.env.XHS_HOT_API_URL?.trim();
  const configuredKey = options.apiKey?.trim() || process.env.XHS_HOT_API_KEY?.trim();
  const redfoxApiKey = options.redfoxApiKey?.trim() || process.env.REDFOX_API_KEY?.trim();
  const redfoxCategory = normalizeRedFoxCategory(options.redfoxCategory?.trim() || process.env.REDFOX_XHS_CATEGORY?.trim());
  const redfoxRankDate = options.redfoxRankDate?.trim() || process.env.REDFOX_XHS_RANK_DATE?.trim() || getDefaultRedFoxRankDate();

  if (configuredUrl) {
    try {
      return { items: await fetchConfiguredXhsSource(configuredUrl, configuredKey, limit) };
    } catch (error) {
      console.error("[hot-api] XHS configured source failed", {
        status: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (redfoxApiKey) {
    try {
      const items = await fetchRedFoxXhsSource({
        apiKey: redfoxApiKey,
        category: redfoxCategory,
        rankDate: redfoxRankDate,
        limit
      });
      return {
        items,
        message: items.length ? `小红书热点源：RedFox ${redfoxCategory}，榜单日期 ${redfoxRankDate}。` : `RedFox 小红书源暂无 ${redfoxCategory} 榜单数据。`
      };
    } catch (error) {
      console.error("[hot-api] RedFox XHS source failed", {
        status: error instanceof Error ? error.message : String(error)
      });
      return {
        items: [],
        message: error instanceof Error ? `RedFox 小红书热点源请求失败：${error.message}` : "RedFox 小红书热点源请求失败。"
      };
    }
  }

  return {
    items: [],
    message: "暂未配置小红书实时热点源：请填写 RedFox API Key，或设置小红书热点接口 URL。"
  };
}

async function fetchConfiguredXhsSource(url: string, apiKey: string | undefined, limit: number) {
  const target = new URL(url);
  if (!target.searchParams.has("limit")) target.searchParams.set("limit", String(limit));

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-Key"] = apiKey;
  }

  const response = await fetch(target, { cache: "no-store", headers });
  if (!response.ok) throw new Error(`小红书配置源返回 ${response.status}`);
  const payload = await response.json();
  return extractArray(payload).map((item, index) => normalizeXhsItem(item, index, "小红书配置源"));
}

async function fetchRedFoxXhsSource({
  apiKey,
  category,
  rankDate,
  limit
}: {
  apiKey: string;
  category: string;
  rankDate: string;
  limit: number;
}) {
  const target = new URL("https://redfox.hk/story/api/cozeSkill/getXhsCozeSkillDataOne");
  target.searchParams.set("rankDate", rankDate);
  target.searchParams.set("source", "小红书单日数据爆款文章-GitHub");
  target.searchParams.set("category", category);

  const response = await fetch(target, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-API-KEY": apiKey
    }
  });
  if (!response.ok) throw new Error(`RedFox 小红书源返回 ${response.status}`);

  const payload = await response.json();
  const root = asRecord(payload);
  if (typeof root.code === "number" && root.code !== 2000 && root.code !== 200) {
    throw new Error(pickString(root, ["msg", "message"]) || `RedFox 返回 ${root.code}`);
  }

  return dedupe(extractArray(payload).map((item, index) => normalizeRedFoxXhsItem(item, index, category, rankDate))).slice(0, limit);
}

function normalizeXhsItem(item: unknown, index: number, source: string) {
  const record = asRecord(item);
  const title = pickString(record, ["title", "name", "keyword", "word", "noteTitle"]) || "未命名小红书热点";
  const summary = pickString(record, ["summary", "desc", "description", "content", "noteDesc"]) || title;
  const url = pickString(record, ["url", "link", "href", "noteUrl", "photoJumpUrl"]);
  const heat = pickValue(record, ["heat", "hot", "score", "likes", "views", "interactiveCount"]);
  const publishedAt = pickString(record, ["publishedAt", "time", "createdAt", "updatedAt"]);
  return createItem({
    idSeed: `${source}:${url || title}`,
    title,
    summary,
    url,
    source,
    platform: "小红书",
    rank: numberValue(record.rank) ?? index + 1,
    heat,
    publishedAt,
    raw: item,
    tags: ["小红书", "实时热点"]
  });
}

function normalizeRedFoxXhsItem(item: unknown, index: number, category: string, rankDate: string) {
  const record = asRecord(item);
  const anaAdd = asRecord(record.anaAdd);
  const title = pickString(record, ["title", "noteTitle", "name"]) || "未命名小红书爆款笔记";
  const desc = pickString(record, ["desc", "summary", "description", "content"]);
  const userName = pickString(record, ["userName", "nickname", "author"]);
  const url = pickString(record, ["photoJumpUrl", "url", "link", "href", "noteUrl"]);
  const heat =
    pickValue(anaAdd, ["interactiveCount", "addInteractiveount", "useLikeCount", "collectedCount"]) ??
    pickValue(record, ["interactiveCount", "addInteractiveount", "useLikeCount", "heat", "hot"]);
  const summaryParts = [
    userName ? `作者：${userName}` : "",
    desc || title,
    formatMetric("互动", pickValue(anaAdd, ["interactiveCount"]), pickValue(anaAdd, ["addInteractiveount"])),
    formatMetric("点赞", pickValue(anaAdd, ["useLikeCount"]), pickValue(anaAdd, ["addLikeCount"])),
    formatMetric("收藏", pickValue(anaAdd, ["collectedCount"]), pickValue(anaAdd, ["addCollectedCunt"]))
  ].filter(Boolean);

  return createItem({
    idSeed: `redfox-xhs:${rankDate}:${url || title}`,
    title,
    summary: summaryParts.join("；"),
    url,
    source: `RedFox 小红书每日爆款笔记`,
    platform: "小红书",
    rank: numberValue(record.rank) ?? index + 1,
    heat,
    publishedAt: `${rankDate} 19:00`,
    raw: item,
    tags: ["小红书", "实时热点", "RedFox", category]
  });
}

function createItem(input: {
  idSeed: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  platform: string;
  rank?: number;
  heat?: string | number;
  publishedAt?: string;
  raw: unknown;
  tags?: string[];
}): HotItem {
  return {
    id: stableId(input.idSeed),
    title: input.title,
    summary: input.summary,
    url: input.url,
    source: input.source,
    platform: input.platform,
    rank: input.rank,
    heat: input.heat,
    hot: input.heat,
    publishedAt: input.publishedAt,
    time: input.publishedAt,
    relevance: 50,
    tags: input.tags ?? ["小红书", "实时热点"],
    raw: input.raw
  };
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.result)) return root.result;
  if (Array.isArray(root.list)) return root.list;
  if (Array.isArray(root.items)) return root.items;
  const data = asRecord(root.data);
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.items)) return data.items;
  const result = asRecord(root.result);
  if (Array.isArray(result.list)) return result.list;
  if (Array.isArray(result.items)) return result.items;
  return [];
}

function formatMetric(label: string, total: unknown, added: unknown) {
  const totalText = stringifyMetric(total);
  const addedText = stringifyMetric(added);
  if (!totalText && !addedText) return "";
  return `${label}${totalText || "-"}${addedText ? `，新增${addedText}` : ""}`;
}

function stringifyMetric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function getDefaultRedFoxRankDate() {
  const now = new Date();
  const chinaNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const queryOffset = chinaNow.getUTCHours() >= 19 ? 1 : 2;
  chinaNow.setUTCDate(chinaNow.getUTCDate() - queryOffset);
  return chinaNow.toISOString().slice(0, 10);
}

function normalizeRedFoxCategory(value?: string) {
  const text = value?.trim();
  if (!text) return "体育锻炼";
  if ((REDFOX_XHS_CATEGORIES as readonly string[]).includes(text)) return text;
  if (/世界杯|足球|体育|运动|健身|比赛|赛事|球星|进球|射门|点球/i.test(text)) return "体育锻炼";
  return "综合全部";
}

function dedupe(items: HotItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url || item.title.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function pickString(record: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickValue(record: AnyRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `xhs-hot-${Math.abs(hash)}`;
}
