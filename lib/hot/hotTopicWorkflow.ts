import { cleanList, qualityControl } from "@/lib/ai/quality";
import type { HotSearchPayload, HotTopic, HotValueLevel } from "@/lib/hot/types";

export const HOT_RADAR_CACHE_KEY = "worldcup.hot-topic-radar.cache.v3";

export type HotRadarCache = {
  topics: HotTopic[];
  lastUpdatedAt: string;
  sourceStatus: HotSearchPayload["sourceStatus"];
  message?: string;
};

export type GeneratedHotPackage = {
  bilibili: string[];
  weibo: string[];
  xiaohongshu: string[];
  shortVideo: string[];
  risk: string[];
};

export type HotGenerationConfig = {
  platform: "B站" | "微博" | "小红书" | "抖音" | "通用";
  contentType: "选题" | "标题" | "短文案" | "视频脚本" | "评论区互动问题" | "图文卡片结构";
  tone: "客观资讯" | "球迷讨论" | "轻松整活" | "专业分析";
  length: "短" | "中" | "长";
  useMatchFacts: boolean;
  includeRiskReminder: boolean;
};

export type HotAuditResult = {
  level: "pass" | "revise" | "block";
  authenticity: string[];
  risk: string[];
  ethics: string[];
  platformFit: string[];
  suggestions: string[];
  rewriteSuggestion: string;
};

export function buildTopicIntro(topic: HotTopic) {
  const base = topic.summary?.trim() || topic.title;
  if (!base || base === topic.title) {
    return "目前仅能确认该热点存在讨论，具体事实需二次核验。";
  }
  return truncate(`${base}。目前仅能确认该热点存在讨论，具体事实需二次核验。`, 80);
}

export function buildWhyCare(topic: HotTopic) {
  return cleanList([
    `来源显示该话题正在${topic.platform ?? "相关平台"}出现讨论，适合作为内容选题入口。`,
    topic.valueLevel === "high"
      ? "它同时具备体育相关性、即时性和内容转化空间，适合优先生产。"
      : topic.valueLevel === "medium"
        ? "它有一定传播潜力，但需要先核验事实和判断平台适配。"
        : "它目前更适合作为观察素材，不建议直接当主推选题。",
    topic.category ? `当前分类为“${topic.category}”，价值分 ${topic.valueScore ?? "-"}。` : "建议结合来源链接人工确认背景。"
  ]);
}

export function buildHotAnalysis(topic: HotTopic) {
  const text = `${topic.title} ${topic.summary ?? ""}`;
  const risky = hasRisk(text);
  return {
    whyCare: buildWhyCare(topic),
    relation: [
      topic.category === "世界杯" || topic.category === "体育"
        ? "它和世界杯/足球语境直接相关，可以作为选题判断的主素材。"
        : "它不是纯赛事信息，只适合作为泛热点借势，需要找到和球队、球员、赛事情绪的连接点。",
      "正文应回到比赛事实、公开来源或数据解释，避免只蹭热词。"
    ],
    angles: topic.contentAngles?.length
      ? topic.contentAngles
      : [
          `从“${topic.title}”切入，做一次赛事情绪或传播现象解释。`,
          "把热点拆成：发生了什么、为什么会热、和比赛有什么关系、发布前要核验什么。"
        ],
    platforms: ["微博：承接即时讨论", "B站：做事件复盘和观点解释", "小红书：做新手看球卡片", "抖音：用前三秒热点钩子切入"],
    factsToVerify: [
      "来源链接是否能证明该热点真实存在。",
      "涉及比分、球员、球队、伤病、裁判判罚时，需要二次核验。",
      "如果只是网友讨论，不要写成官方结论。"
    ],
    risks: [
      risky ? "存在争议或高风险词，发布前要改成“引发讨论”“需核实”等稳妥表达。" : "避免把讨论热度写成事实结论。",
      "避免制造球员、球队、国家之间的对立。",
      "引用图片、视频或平台截图时注意版权和来源。"
    ]
  };
}

export function generateHotDraft(topic: HotTopic, config: HotGenerationConfig) {
  const factLine = config.useMatchFacts
    ? "可引用比赛事实，但必须只使用已确认的比分、事件和公开来源。"
    : "不引用具体比分和球员发言，只围绕热点讨论本身展开。";
  const riskLine = config.includeRiskReminder ? "发布前需人工核验来源，避免把讨论写成定论。" : "";
  const base = {
    topicTitle: topic.title,
    sourceLine: `来源：${topic.source}${topic.url ? `｜原文：${topic.url}` : ""}`,
    factLine,
    riskLine
  };

  const body = buildPlatformDraft(topic, config, base);
  return qualityControl(body).trim();
}

export function auditHotDraft(text: string, topic: HotTopic, platform: HotGenerationConfig["platform"]): HotAuditResult {
  const findings = {
    authenticity: [] as string[],
    risk: [] as string[],
    ethics: [] as string[],
    platformFit: [] as string[],
    suggestions: [] as string[]
  };

  if (/(确认|实锤|官方证实|已经证明|必然|肯定)/.test(text)) {
    findings.authenticity.push("存在确定性表述。若来源只是热榜或公开搜索，建议改成“引发讨论”“有待核验”。");
  }
  if (/\d{1,2}[:比-]\d{1,2}/.test(text) && !/\b来源|数据|据/.test(text)) {
    findings.authenticity.push("文案包含比分信息，建议补充数据来源或在发布前人工核验。");
  }
  if (/黑哨|黑幕|假球|保送|废了|骂翻|全网都在骂|确认伤退/.test(text)) {
    findings.risk.push("存在造谣、引战或攻击性高风险表达，不建议直接发布。");
  }
  if (/偷|蠢|垃圾|废物|滚|地域|人种/.test(text)) {
    findings.risk.push("存在人身攻击、地域歧视或侮辱性表达风险。");
  }
  if (/网暴|冲了|去骂|爆破/.test(text)) {
    findings.ethics.push("存在诱导网暴或过度煽动风险，需要删除。");
  }
  if (platform === "小红书" && text.length > 900) findings.platformFit.push("小红书图文建议更短、更分卡片，当前内容偏长。");
  if (platform === "微博" && text.length > 500) findings.platformFit.push("微博建议前 100 字先给观点，当前文本过长。");
  if (platform === "B站" && !/结构|开头|弹幕|评论/.test(text)) findings.platformFit.push("B站内容缺少结构、弹幕互动或评论区引导。");
  if (!findings.authenticity.length) findings.authenticity.push("未发现明显事实冒进，但仍需核验来源链接。");
  if (!findings.risk.length) findings.risk.push("未发现明显高风险词。");
  if (!findings.ethics.length) findings.ethics.push("未发现明显传播伦理问题。");
  if (!findings.platformFit.length) findings.platformFit.push(`整体适合${platform}，建议发布前再做人工校对。`);

  findings.suggestions.push("把绝对判断改成“引发讨论”“可以从规则/数据角度复盘”。");
  findings.suggestions.push("补充来源链接或注明“需人工核验”。");
  findings.suggestions.push("避免制造球员、球队、国家之间的对立。");

  const severe = findings.risk.some((item) => /不建议|高风险|攻击|歧视|网暴/.test(item));
  const needsRevision = severe || findings.authenticity.some((item) => /确定性|比分/.test(item));
  const rewriteSuggestion = rewriteSafer(text, topic);

  return {
    level: severe ? "block" : needsRevision ? "revise" : "pass",
    ...findings,
    rewriteSuggestion
  };
}

export function generateHotTopicPackage(topic: HotTopic, matchLabel = "今日世界杯比赛"): GeneratedHotPackage {
  return {
    bilibili: generateHotDraft(topic, {
      platform: "B站",
      contentType: "视频脚本",
      tone: "专业分析",
      length: "中",
      useMatchFacts: true,
      includeRiskReminder: true
    }).split("\n").filter(Boolean),
    weibo: generateHotDraft(topic, {
      platform: "微博",
      contentType: "短文案",
      tone: "球迷讨论",
      length: "短",
      useMatchFacts: false,
      includeRiskReminder: true
    }).split("\n").filter(Boolean),
    xiaohongshu: generateHotDraft(topic, {
      platform: "小红书",
      contentType: "图文卡片结构",
      tone: "客观资讯",
      length: "中",
      useMatchFacts: false,
      includeRiskReminder: true
    }).split("\n").filter(Boolean),
    shortVideo: generateHotDraft(topic, {
      platform: "抖音",
      contentType: "视频脚本",
      tone: "轻松整活",
      length: "短",
      useMatchFacts: false,
      includeRiskReminder: true
    }).split("\n").filter(Boolean),
    risk: [`关联赛事：${matchLabel}`, ...auditHotDraft(topic.title, topic, "通用").suggestions]
  };
}

export function packageLabel(key: string) {
  const labels: Record<string, string> = {
    bilibili: "B站选题",
    weibo: "微博话题",
    xiaohongshu: "小红书标题",
    shortVideo: "短视频方向",
    risk: "风险提醒"
  };
  return labels[key] ?? key;
}

function buildPlatformDraft(
  topic: HotTopic,
  config: HotGenerationConfig,
  base: { topicTitle: string; sourceLine: string; factLine: string; riskLine: string }
) {
  const risk = base.riskLine ? `\n风险提醒：${base.riskLine}` : "";
  const verify = "目前仅能确认该热点存在讨论，具体事实需二次核验。";

  if (config.platform === "B站") {
    return [
      `B站${config.contentType}｜${base.topicTitle}`,
      `标题1：${base.topicTitle}背后，这场世界杯热点到底该怎么看？`,
      `标题2：别只看热搜，从规则、数据和传播情绪拆开讲。`,
      `开头15秒：今天这个热点先别急着站队，我们先确认能确定的事实，再看它为什么会影响世界杯内容传播。`,
      `视频结构：热点发生了什么 → 已知事实与待核验信息 → 和足球/世界杯的关系 → 可做的争议降风险表达 → 评论区问题。`,
      `弹幕互动：你觉得这是比赛转折，还是赛后传播转折？`,
      base.factLine,
      base.sourceLine,
      risk
    ].filter(Boolean).join("\n");
  }

  if (config.platform === "微博") {
    return [
      `#${base.topicTitle.replace(/\s+/g, "")}#`,
      `先看热度，再回到事实。${base.topicTitle}正在引发讨论，但不能把讨论直接写成结论。更稳的角度是：它为什么会成为今天世界杯内容的传播入口？`,
      `讨论钩子：你会把它做成赛事情绪复盘、规则解释，还是球迷讨论帖？`,
      base.sourceLine,
      risk
    ].filter(Boolean).join("\n");
  }

  if (config.platform === "小红书") {
    return [
      `小红书图文｜${base.topicTitle}`,
      `首图标题：这个世界杯热点，新手看球也能懂`,
      `第1页：发生了什么？${verify}`,
      "第2页：为什么会热？它有情绪点，也有比赛理解门槛。",
      "第3页：和足球内容有什么关系？适合解释规则、比赛情绪和平台讨论。",
      "第4页：怎么表达更安全？少用定性词，多用“引发讨论”“需核验”。",
      "第5页：收藏理由：这套拆解方法可以复用到其他赛后热点。",
      base.sourceLine,
      risk
    ].filter(Boolean).join("\n");
  }

  if (config.platform === "抖音") {
    return [
      `抖音脚本｜${base.topicTitle}`,
      "前三秒钩子：今天这个世界杯热点，先别急着下结论。",
      "分镜1：热搜词条/来源截图，字幕：先确认它在被讨论。",
      "分镜2：回到比赛或足球语境，字幕：它为什么能出圈？",
      "分镜3：给出稳妥观点，字幕：事实归事实，情绪归情绪。",
      "口播节奏：5秒说热点，20秒讲关系，10秒提醒核验，最后抛评论区问题。",
      base.sourceLine,
      risk
    ].filter(Boolean).join("\n");
  }

  return [
    `通用内容｜${base.topicTitle}`,
    `核心观点：该热点可以作为体育内容入口，但具体事实需要二次核验。`,
    `可做方向：选题、标题、短文案、视频脚本、评论区互动问题。`,
    base.factLine,
    base.sourceLine,
    risk
  ].filter(Boolean).join("\n");
}

function rewriteSafer(text: string, topic: HotTopic) {
  const cleaned = text
    .replace(/黑哨|黑幕|假球|保送/g, "争议讨论")
    .replace(/废了|垃圾|废物/g, "表现引发讨论")
    .replace(/全网都在骂|骂翻/g, "不少讨论集中在")
    .replace(/确认伤退/g, "伤病情况需核实")
    .replace(/实锤|官方证实/g, "有待进一步确认");
  return `${cleaned}\n\n发布前补充：该内容基于“${topic.title}”的热点讨论整理，具体事实、比分、伤病和判罚信息需人工核验后再发布。`;
}

function hasRisk(text: string) {
  return /黑哨|黑幕|确认伤退|伤退|裁判|VAR|争议|假球|保送|全网都在骂/i.test(text);
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
