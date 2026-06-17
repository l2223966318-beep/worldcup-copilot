export type SourceDebugResult = {
  configured: {
    apiKey: boolean;
    accessLevel: string;
    languageCode: string;
    competitionId: boolean;
    seasonId: boolean;
  };
  sportradar: {
    attempted: boolean;
    ok: boolean;
    status?: number;
    endpoint?: string;
    itemCount?: number;
    matchedWorldCupCount?: number;
    message?: string;
  };
  fallbackHint: string;
};

export async function getSportradarSourceDebug(): Promise<SourceDebugResult> {
  const accessLevel = process.env.SPORTRADAR_ACCESS_LEVEL?.trim() || "trial";
  const languageCode = process.env.SPORTRADAR_LANGUAGE_CODE?.trim() || "en";
  const apiKey = process.env.SPORTRADAR_API_KEY?.trim();
  const competitionId = process.env.SPORTRADAR_WORLD_CUP_COMPETITION_ID?.trim();
  const seasonId = process.env.SPORTRADAR_WORLD_CUP_SEASON_ID?.trim();

  const result: SourceDebugResult = {
    configured: {
      apiKey: Boolean(apiKey),
      accessLevel,
      languageCode,
      competitionId: Boolean(competitionId),
      seasonId: Boolean(seasonId)
    },
    sportradar: {
      attempted: false,
      ok: false
    },
    fallbackHint: "Sportradar 未完成诊断。"
  };

  if (!apiKey) {
    result.fallbackHint = "线上环境没有读取到 SPORTRADAR_API_KEY，会直接走免费源兜底。";
    return result;
  }

  const endpoint = `https://api.sportradar.com/soccer/${accessLevel}/v4/${languageCode}/schedules/live/schedules.json`;
  const url = new URL(endpoint);
  url.searchParams.set("api_key", apiKey);
  result.sportradar.attempted = true;
  result.sportradar.endpoint = endpoint;

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-api-key": apiKey
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });

    result.sportradar.status = response.status;

    if (!response.ok) {
      result.sportradar.message = await response.text().then((body) => body.slice(0, 240)).catch(() => "");
      result.fallbackHint = `Sportradar 请求失败，状态码 ${response.status}。通常是 key 无效、套餐未开通 Soccer v4，或 access level 不匹配。`;
      console.error("[sportradar-debug]", response.status, result.sportradar.message);
      return result;
    }

    const payload = (await response.json()) as { schedules?: unknown[] };
    const schedules = Array.isArray(payload.schedules) ? payload.schedules : [];
    result.sportradar.ok = true;
    result.sportradar.itemCount = schedules.length;
    result.sportradar.matchedWorldCupCount = schedules.filter(isWorldCupSchedule).length;

    if (!schedules.length) {
      result.fallbackHint = "Sportradar 连接成功，但 live schedules 当前没有比赛。今日赛程会继续尝试 daily schedules。";
    } else if (!result.sportradar.matchedWorldCupCount && !competitionId && !seasonId) {
      result.fallbackHint = "Sportradar 连接成功，但没有匹配到 World Cup。建议配置 SPORTRADAR_WORLD_CUP_COMPETITION_ID 或 SPORTRADAR_WORLD_CUP_SEASON_ID。";
    } else {
      result.fallbackHint = "Sportradar 连接成功。若业务接口仍 fallback，请检查赛季/赛事 ID 或当天是否有匹配赛程。";
    }

    return result;
  } catch (error) {
    result.sportradar.message = error instanceof Error ? error.message : "Unknown Sportradar request error.";
    result.fallbackHint = "Sportradar 请求异常，线上会继续走免费源兜底。";
    console.error("[sportradar-debug]", result.sportradar.message);
    return result;
  }
}

function isWorldCupSchedule(schedule: unknown) {
  const text = JSON.stringify(schedule).toLowerCase();
  return text.includes("world cup") || text.includes("fifa");
}
