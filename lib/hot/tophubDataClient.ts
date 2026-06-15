const DEFAULT_BASE_URL = "https://api.tophubdata.com";

export async function fetchTopHubDataSearch(query: string, overrideApiKey?: string) {
  const apiKey = overrideApiKey || process.env.TOPHUBDATA_API_KEY;
  if (!apiKey) return { ok: false as const, reason: "TOPHUBDATA_API_KEY is not configured." };

  const baseUrl = (process.env.TOPHUBDATA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const params = new URLSearchParams({ q: query, p: "1" });
  const nodeHashid = process.env.TOPHUBDATA_NODE_HASHID || process.env.TOPHUBDATA_NODE_HASHIDS?.split(",")[0]?.trim();
  if (nodeHashid) params.set("hashid", nodeHashid);

  const response = await fetchWithTimeout(`${baseUrl}/search?${params.toString()}`, {
    headers: { Authorization: apiKey }
  });

  if (!response.ok) {
    throw new Error(`TopHubData request failed: ${response.status}`);
  }

  return { ok: true as const, payload: await response.json() };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}
