type QualityNode =
  | string
  | number
  | boolean
  | null
  | undefined
  | QualityNode[]
  | { [key: string]: QualityNode };

const repeatedPhrasePatterns = [
  /这不是普通赛果复盘，而是/g,
  /建议先讲事实，再讲观点/g,
  /发布前仍需人工复核事实和数据来源/g,
  /从一场比赛出发/g
];

const riskyPunctuation = [
  [/？。/g, "？"],
  [/！。/g, "！"],
  [/。。+/g, "。"],
  [/，，+/g, "，"],
  [/、、+/g, "、"],
  [/\?\.+/g, "?"],
  [/!\.+/g, "!"]
] as const;

const platformLead: Record<string, string> = {
  bilibili: "B站版本重点放在复盘结构、弹幕互动和讨论深度。",
  xiaohongshu: "小红书版本重点放在卡片收藏、封面信息密度和非球迷理解。",
  weibo: "微博版本重点放在赛后讨论节奏、话题钩子和低风险表达。",
  shortVideo: "短视频版本重点放在前三秒钩子、画面推进和口播节奏。",
  article: "公众号版本重点放在完整论证、图表插入和观点收束。"
};

export function cleanText(input: string) {
  let text = input.replace(/[ \t]+/g, " ").trim();

  for (const [pattern, replacement] of riskyPunctuation) {
    text = text.replace(pattern, replacement);
  }

  for (const pattern of repeatedPhrasePatterns) {
    let seen = false;
    text = text.replace(pattern, (match) => {
      if (seen) return "";
      seen = true;
      return match;
    });
  }

  return splitLongSentences(text);
}

export function cleanList(items: string[]) {
  const seen = new Set<string>();

  return items
    .map(cleanText)
    .filter((item) => {
      const key = normalizeForCompare(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function qualityControl<T>(value: T): T {
  return walkQuality(value) as T;
}

export function diversifyPlatformText<T extends Record<string, unknown>>(content: T): T {
  const used = new Set<string>();

  function walk(node: unknown, platform = ""): unknown {
    if (typeof node === "string") {
      const normalized = normalizeForCompare(node);
      if (normalized.length > 18 && used.has(normalized)) {
        return cleanText(`${platformLead[platform] ?? "换一种表达："}${node}`);
      }
      used.add(normalized);
      return cleanText(node);
    }

    if (Array.isArray(node)) {
      return node.map((item) => walk(item, platform));
    }

    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([key, value]) => [
          key,
          walk(value, platform || key)
        ])
      );
    }

    return node;
  }

  return walk(content) as T;
}

function walkQuality(node: unknown): unknown {
  if (typeof node === "string") return cleanText(node);
  if (Array.isArray(node)) return node.map(walkQuality);

  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([key, value]) => [
        key,
        walkQuality(value)
      ])
    );
  }

  return node as QualityNode;
}

function normalizeForCompare(text: string) {
  return text.replace(/[，。！？、\s:：；;“”"']/g, "");
}

function splitLongSentences(text: string) {
  return text
    .split(/(?<=[。！？\n])/)
    .map((sentence) => {
      if (sentence.length <= 96) return sentence;

      let passedFirstCut = false;
      return sentence.replace(/，/g, (match, offset) => {
        if (!passedFirstCut && offset > 42) {
          passedFirstCut = true;
          return "。";
        }
        return match;
      });
    })
    .join("")
    .replace(/。。+/g, "。")
    .replace(/？。/g, "？")
    .replace(/！。/g, "！");
}
