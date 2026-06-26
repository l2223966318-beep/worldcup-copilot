type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekChoice = {
  message?: {
    content?: string;
    reasoning_content?: string;
  };
};

type DeepSeekResponse = {
  choices?: DeepSeekChoice[];
  error?: {
    message?: string;
  };
};

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_FAST_MODEL = "deepseek-v4-flash";
const DEFAULT_QUALITY_MODEL = "deepseek-v4-pro";
const DEFAULT_TIMEOUT_MS = 18_000;
const DEFAULT_QUALITY_TIMEOUT_MS = 35_000;
const DEFAULT_FAST_MAX_TOKENS = 4096;
const DEFAULT_QUALITY_MAX_TOKENS = 8192;

export type DeepSeekJsonResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; message: string };

export async function generateDeepSeekJson<T>(
  messages: DeepSeekMessage[],
  options: {
    timeoutMs?: number;
    apiKey?: string;
    model?: string;
    quality?: "fast" | "quality";
    maxTokens?: number;
    reasoningEffort?: "high" | "max";
  } = {}
): Promise<DeepSeekJsonResult<T>> {
  const apiKey = options.apiKey?.trim() || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, message: "DEEPSEEK_API_KEY is not configured." };

  const model = selectModel(options);
  const isQuality = options.quality === "quality";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? (isQuality ? DEFAULT_QUALITY_TIMEOUT_MS : DEFAULT_TIMEOUT_MS));

  try {
    const requestBody = {
      model,
      messages,
      stream: false,
      response_format: { type: "json_object" },
      max_tokens: options.maxTokens ?? (isQuality ? DEFAULT_QUALITY_MAX_TOKENS : DEFAULT_FAST_MAX_TOKENS),
      ...(isQuality
        ? {
            thinking: { type: "enabled" },
            reasoning_effort: options.reasoningEffort ?? "high"
          }
        : {
            thinking: { type: "disabled" }
          })
    };

    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    const payload = (await response.json()) as DeepSeekResponse;
    if (!response.ok) {
      return { ok: false, message: payload.error?.message ?? `DeepSeek request failed with ${response.status}.` };
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { ok: false, message: "DeepSeek returned empty content." };

    return { ok: true, data: parseJsonContent<T>(content), model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DeepSeek error.";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}

function selectModel(options: { model?: string; quality?: "fast" | "quality" }) {
  if (options.model?.trim()) return options.model.trim();
  if (options.quality === "quality") {
    return process.env.DEEPSEEK_MODEL_QUALITY || DEFAULT_QUALITY_MODEL;
  }
  return process.env.DEEPSEEK_MODEL_FAST || process.env.DEEPSEEK_MODEL || DEFAULT_FAST_MODEL;
}

function parseJsonContent<T>(content: string): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1)) as T;
    }
    throw new Error("DeepSeek returned invalid JSON.");
  }
}
