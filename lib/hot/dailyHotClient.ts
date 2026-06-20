const DEFAULT_BASE_URL = "https://nicee-wine.vercel.app";
export const DEFAULT_DAILY_HOT_BASE_URL = DEFAULT_BASE_URL;
export const DEFAULT_DAILY_HOT_PLATFORMS = ["bilibili", "douyin", "baidu", "toutiao", "hupu"];

export async function fetchDailyHotFeeds(options: { baseUrl?: string; platforms?: string[]; limit?: number } = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const platforms = (options.platforms?.length ? options.platforms : readDailyHotPlatforms())
    .filter((platform) => platform !== "xiaohongshu")
    .slice(0, options.limit ?? 8);

  const results = await Promise.allSettled(platforms.map((platform) => fetchDailyHotFeed(platform, { baseUrl })));

  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function fetchDailyHotFeed(platform: string, options: { baseUrl?: string } = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const response = await fetchWithTimeout(`${baseUrl}/${platform}`, { headers: { Accept: "application/json" } }, 5000);
  if (!response.ok) throw new Error(`DailyHotApi 请求失败：${platformLabel(platform)}，状态码 ${response.status}`);
  return { platform, payload: await response.json() };
}

export function normalizeDailyHotBaseUrl(value?: string) {
  return normalizeBaseUrl(value);
}

function readDailyHotPlatforms() {
  return (process.env.DAILY_HOT_PLATFORMS || DEFAULT_DAILY_HOT_PLATFORMS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value?: string) {
  return (value?.trim() || process.env.DAILY_HOT_API_BASE || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    weibo: "微博",
    douyin: "抖音",
    bilibili: "B站",
    baidu: "百度",
    zhihu: "知乎",
    hupu: "虎扑",
    toutiao: "头条",
    kuaishou: "快手"
  };
  return labels[platform] ?? platform;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
