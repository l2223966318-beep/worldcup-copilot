const DEFAULT_BASE_URL = "https://api.tavily.com";

export async function fetchTavilySearch(query: string, overrideApiKey?: string) {
  const apiKey = overrideApiKey || process.env.TAVILY_API_KEY;
  if (!apiKey) return { ok: false as const, reason: "TAVILY_API_KEY is not configured." };

  const baseUrl = (process.env.TAVILY_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const response = await fetchWithTimeout(`${baseUrl}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 8,
      include_answer: false
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily request failed: ${response.status}`);
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
