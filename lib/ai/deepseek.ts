type DeepSeekMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekChoice = {
  message?: {
    content?: string;
  };
};

type DeepSeekResponse = {
  choices?: DeepSeekChoice[];
  error?: {
    message?: string;
  };
};

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_TIMEOUT_MS = 18_000;

export type DeepSeekJsonResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; message: string };

export async function generateDeepSeekJson<T>(
  messages: DeepSeekMessage[],
  options: { timeoutMs?: number } = {}
): Promise<DeepSeekJsonResult<T>> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, message: "DEEPSEEK_API_KEY is not configured." };

  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" }
      }),
      signal: controller.signal
    });

    const payload = (await response.json()) as DeepSeekResponse;
    if (!response.ok) {
      return { ok: false, message: payload.error?.message ?? `DeepSeek request failed with ${response.status}.` };
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { ok: false, message: "DeepSeek returned empty content." };

    return { ok: true, data: JSON.parse(content) as T, model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DeepSeek error.";
    return { ok: false, message };
  } finally {
    clearTimeout(timeout);
  }
}
