import type { ApiFootballResponse } from "@/lib/sports/types";

const BASE_URL = "https://v3.football.api-sports.io";

export class ApiFootballError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiFootballError";
  }
}

export function hasApiFootballKey() {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

export async function apiFootballGet<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  init?: RequestInit
): Promise<ApiFootballResponse<T>> {
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    throw new ApiFootballError("API_FOOTBALL_KEY is not configured.");
  }

  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    ...init,
    headers: {
      "x-apisports-key": apiKey,
      ...(init?.headers ?? {})
    },
    next: { revalidate: 60 }
  });

  if (!response.ok) {
    throw new ApiFootballError(`API-Football request failed: ${response.status}`, response.status);
  }

  const payload = (await response.json()) as ApiFootballResponse<T>;

  if (payload.errors && Object.keys(payload.errors as Record<string, unknown>).length > 0) {
    throw new ApiFootballError(`API-Football returned errors: ${JSON.stringify(payload.errors)}`, response.status);
  }

  return payload;
}
