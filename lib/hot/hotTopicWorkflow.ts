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
  contentType: "选题" | "标题" | "短文案" | "视频脚本" | "评论区互动" | "图文卡片";
  tone: "客观资讯" | "球迷讨论" | "轻松整活" | "专业复盘" | "人物故事" | "数据解读" | "稳妥表达";
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

export type HotInsight = {
  label: string;
  value: string;
  note: string;
};

export type HotAnalysisResult = {
  overview: HotInsight[];
  production: HotInsight[];
  whyCare: string[];
  relation: string[];
  angles: string[];
  platforms: string[];
  factsToVerify: string[];
  risks: string[];
};

export function buildTopicIntro(topic: HotTopic) {
  const cleanSummary = normalizeSentence(topic.summary);
  const base =
    cleanSummary && cleanSummary !== topic.title
      ? cleanSummary
      : `该热点围绕“${topic.title}”在${topic.platform ?? topic.source ?? "公开平台"}出现讨论`;
  const signal = [
    topic.heat ? `热度 ${topic.heat}` : "",
    typeof topic.valueScore === "number" ? `价值分 ${topic.valueScore}` : "",
    topic.category ? `归类为${topic.category}` : ""
  ].filter(Boolean).join("，");
  return truncate(`${base}。${signal ? `${signal}。` : ""}目前只能确认存在讨论，具体事实需二次核验。`, 110);
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

export function buildHotAnalysis(topic: HotTopic): HotAnalysisResult {
  const text = `${topic.title} ${topic.summary ?? ""}`;
  const risky = hasRisk(text);
  const valueLabel = getValueLabel(topic);
  const platform = topic.platform ?? topic.source ?? "公开平台";
  const score = typeof topic.valueScore === "number" ? topic.valueScore : "-";
  const reason = getValueReason(topic);
  const angle = getBestAngle(topic);
  const primaryPlatform = getPrimaryPlatform(topic);
  return {
    overview: [
      {
        label: "价值判断",
        value: valueLabel,
        note: `价值分 ${score}；${reason}`
      },
      {
        label: "核心原因",
        value: topic.category === "世界杯" || topic.category === "体育" ? "赛事语境强" : "可借势观察",
        note: `来自${platform}，${topic.heat ? `热度 ${topic.heat}` : "已有讨论信号"}，适合先判断是否能转成体育内容。`
      },
      {
        label: "选题抓手",
        value: angle,
        note: `从“${topic.title}”切入，先讲已知讨论，再回到比赛事实或公开来源。`
      }
    ] satisfies HotInsight[],
    production: [
      {
        label: "主推平台",
        value: primaryPlatform,
        note: getPlatformReason(primaryPlatform)
      },
      {
        label: "最适合产物",
        value: getBestFormat(topic),
        note: "先做轻量内容验证热度，再决定是否扩展成长视频或长文。"
      },
      {
        label: "发布边界",
        value: risky ? "先降风险再发" : "可低风险试发",
        note: risky ? "含争议/判罚/伤病等敏感信号，避免写成定论。" : "仍需保留“需核验”“据公开讨论”等来源说明。"
      }
    ] satisfies HotInsight[],
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

function normalizeSentence(value?: string) {
  return value?.trim().replace(/[。.!！?？]+$/g, "");
}

function getValueLabel(topic: HotTopic) {
  if (topic.valueLevel === "high" || topic.leverageValue === "高价值") return "高价值";
  if (topic.valueLevel === "medium" || topic.leverageValue === "可观察") return "可观察";
  return "低优先级";
}

function getValueReason(topic: HotTopic) {
  if (topic.valueLevel === "high") return "同时具备热度、体育相关性和内容转化空间";
  if (topic.valueLevel === "medium") return "有传播信号，但需要核验事实和平台适配";
  return "与赛事关联较弱或风险较高，适合作为备选素材";
}

function getBestAngle(topic: HotTopic) {
  if (topic.contentAngles?.[0]) return truncate(topic.contentAngles[0], 28);
  const text = `${topic.title} ${topic.summary ?? ""}`;
  if (/伤|退|病/.test(text)) return "伤病信息核验";
  if (/裁判|VAR|点球|红牌|黄牌|争议/.test(text)) return "判罚争议复盘";
  if (/首秀|上演|进球|帽子戏法|乌龙/.test(text)) return "关键事件放大";
  if (/梅西|姆巴佩|C罗|球员/.test(text)) return "球员叙事";
  return "热点讨论转选题";
}

function getPrimaryPlatform(topic: HotTopic) {
  const text = `${topic.title} ${topic.summary ?? ""}`;
  if (/争议|裁判|VAR|热搜|讨论/.test(text)) return "微博";
  if (/数据|复盘|为什么|战术/.test(text)) return "B站";
  if (/新手|科普|看球|收藏/.test(text)) return "小红书";
  if (/名场面|乌龙|首秀|进球|破门/.test(text)) return "抖音";
  return "微博";
}

function getPlatformReason(platform: string) {
  const reasons: Record<string, string> = {
    微博: "适合承接即时讨论和话题扩散，先用短评测试舆论反应。",
    B站: "适合把热点拆成事件复盘、规则解释或观点长视频。",
    小红书: "适合做新手看球卡片和收藏型解释，降低理解门槛。",
    抖音: "适合用前三秒钩子抓住注意力，再回到事实核验。"
  };
  return reasons[platform] ?? "适合作为通用热点素材，先轻量试发。";
}

function getBestFormat(topic: HotTopic) {
  const text = `${topic.title} ${topic.summary ?? ""}`;
  if (/争议|裁判|VAR/.test(text)) return "微博讨论帖";
  if (/首秀|进球|乌龙|名场面/.test(text)) return "短视频脚本";
  if (/为什么|数据|复盘/.test(text)) return "B站复盘大纲";
  return "选题标题 + 短文案";
}

export function generateHotDraft(topic: HotTopic, config: HotGenerationConfig) {
  const factLine = config.useMatchFacts
    ? "仅使用热点标题、摘要和来源中已经明确出现的比赛事实。"
    : "不扩写热点来源未提供的比分、事件和球员发言。";
  const riskyTopic = hasRisk(`${topic.title} ${topic.summary ?? ""}`);
  const riskLine = config.includeRiskReminder && riskyTopic
    ? "该热点含伤病、判罚或争议信号，避免把讨论直接写成事实结论。"
    : "";
  const base = {
    topicTitle: topic.title,
    sourceLine: `来源：${topic.source}${topic.url ? `｜原文：${topic.url}` : ""}`,
    factLine,
    riskLine
  };

  const body = buildPlatformDraft(topic, config, base);
  return qualityControl(body).trim();
}

export function auditHotDraft(
  text: string,
  topic: HotTopic,
  platform: HotGenerationConfig["platform"],
  contentType?: HotGenerationConfig["contentType"]
): HotAuditResult {
  const findings = {
    authenticity: [] as string[],
    risk: [] as string[],
    ethics: [] as string[],
    platformFit: [] as string[],
    suggestions: [] as string[]
  };

  if (/(实锤|官方证实|已经证明|必然|肯定|确认伤退|确认报销|确认缺席)/.test(text)) {
    const phrase = text.match(/实锤|官方证实|已经证明|必然|肯定|确认伤退|确认报销|确认缺席/)?.[0];
    findings.authenticity.push(`“${phrase}”属于确定性表述，但当前热点材料没有提供对应证明。`);
    findings.suggestions.push(`将“${phrase}”改成与现有来源强度一致的描述。`);
  }
  const score = text.match(/\d{1,2}[:比-]\d{1,2}/)?.[0];
  if (score && !/(来源[:：]|数据源|据\S{0,8}(报道|统计|显示))/.test(text)) {
    findings.authenticity.push(`比分“${score}”在稿件中没有对应来源说明。`);
    findings.suggestions.push(`为比分“${score}”补充明确来源，或删除该比分。`);
  }
  if (/黑哨|黑幕|假球|保送|废了|骂翻|全网都在骂|确认伤退/.test(text)) {
    const phrase = text.match(/黑哨|黑幕|假球|保送|废了|骂翻|全网都在骂|确认伤退/)?.[0];
    findings.risk.push(`“${phrase}”带有造谣、引战或攻击性风险，不建议直接发布。`);
    findings.suggestions.push(`删除“${phrase}”的定性，改写为对具体比赛现象的描述。`);
  }
  if (/偷|蠢|垃圾|废物|滚|地域|人种/.test(text)) {
    const phrase = text.match(/偷|蠢|垃圾|废物|滚|地域|人种/)?.[0];
    findings.risk.push(`“${phrase}”存在人身攻击、地域歧视或侮辱性表达风险。`);
    findings.suggestions.push(`删除“${phrase}”，把评价落回可观察的比赛表现。`);
  }
  if (/网暴|冲了|去骂|爆破/.test(text)) {
    const phrase = text.match(/网暴|冲了|去骂|爆破/)?.[0];
    findings.ethics.push(`“${phrase}”存在诱导网暴或过度煽动风险，需要删除。`);
    findings.suggestions.push(`删除“${phrase}”及相关号召，不引导用户攻击具体对象。`);
  }
  if (platform === "小红书" && text.length > 900) {
    findings.platformFit.push(`当前稿件 ${text.length} 字，小红书图文篇幅偏长。`);
    findings.suggestions.push("压缩重复解释，并拆成每页一个信息点。");
  }
  if (platform === "微博" && text.length > 500) {
    findings.platformFit.push(`当前稿件 ${text.length} 字，微博首屏信息密度不足。`);
    findings.suggestions.push("把核心观点和热点事实前置到前 100 字。");
  }
  if (platform === "B站" && contentType === "视频脚本" && !/结构|开头|弹幕|评论/.test(text)) {
    findings.platformFit.push("稿件没有视频结构、开场或互动设计，不适合作为完整 B站脚本。");
    findings.suggestions.push("补充开场钩子、内容段落和结尾互动。");
  }

  const severe = findings.risk.some((item) => /不建议|攻击|歧视|网暴/.test(item)) || findings.ethics.length > 0;
  const needsRevision = severe || findings.authenticity.length > 0 || findings.platformFit.length > 0;
  const rewriteSuggestion = rewriteSafer(text);

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
      tone: "专业复盘",
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
      contentType: "图文卡片",
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
  if (config.contentType === "选题") return buildTopicAngles(topic, config);
  if (config.contentType === "标题") return buildTitles(topic, config);
  if (config.contentType === "短文案") return buildShortCopy(topic, config, base);
  if (config.contentType === "视频脚本") return buildVideoScript(topic, config, base);
  if (config.contentType === "评论区互动") return buildCommentPrompts(topic, config);
  return buildCardStructure(topic, config, base);
}

type TopicAngle = {
  title: string;
  approach: string;
  reason: string;
};

function buildTopicAngles(topic: HotTopic, config: HotGenerationConfig) {
  const subject = truncate(topic.title, 30);
  const source = topic.platform ?? topic.source ?? "当前热点源";
  const summary = normalizeSentence(topic.summary);
  const signal = [
    topic.heat ? `热度 ${topic.heat}` : "",
    typeof topic.valueScore === "number" ? `价值分 ${topic.valueScore}` : "",
    topic.category ? `${topic.category}语境` : ""
  ].filter(Boolean).join("、");
  const angles: TopicAngle[] = [
    {
      title: `${config.tone}拆解：热点是怎么形成的`,
      approach: `围绕“${subject}”梳理触发点、传播节点和讨论分歧，只使用来源中已有的信息。`,
      reason: summary || `${source}已提供明确讨论入口，适合先把事件脉络讲清楚。`
    },
    {
      title: "把热点人物做成动漫二创",
      approach: "用动漫角色定位表现人物关系或舆论位置，再用热点原文中的事实收束。",
      reason: "角色化表达能降低理解门槛，适合 B站和短视频，但不能替代真实事件。"
    },
    {
      title: "用足球游戏任务做游戏二创",
      approach: "把热点拆成阵容选择、关键任务和结果复盘，用游戏语言解释讨论焦点。",
      reason: "游戏任务结构适合表现过程和选择，不需要虚构新的比赛细节。"
    },
    {
      title: "用一组数据卡判断热点价值",
      approach: `把${signal || "平台来源、发布时间和讨论信号"}做成卡片，解释这个热点为什么值得做。`,
      reason: "数据卡能区分真实传播信号和主观判断，适合收藏型图文或视频中段。"
    },
    {
      title: "把评论分歧做成双视角作品",
      approach: "选取两种有代表性的观点分别陈述，再回到热点原文判断哪些是事实、哪些是态度。",
      reason: "双视角能保留讨论感，同时避免把单一观点包装成全网共识。"
    }
  ];

  return angles.map((angle, index) => [
    `${index + 1}. ${angle.title}`,
    `怎么做：${angle.approach}`,
    `说明：${angle.reason}`
  ].join("\n")).join("\n\n");
}

function buildTitles(topic: HotTopic, config: HotGenerationConfig) {
  const subject = truncate(topic.title, 22);
  const titles = [
    subject,
    `${subject}，讨论焦点不只一个`,
    `从${config.tone}角度重看这个热点`,
    "这条热榜最值得拆的三个细节",
    `${config.platform}怎么讲清这个热点`
  ];
  return titles.map((title, index) => `${index + 1}. ${truncate(title, 28)}`).join("\n");
}

function buildShortCopy(
  topic: HotTopic,
  config: HotGenerationConfig,
  base: { sourceLine: string; riskLine: string }
) {
  const summary = normalizeSentence(topic.summary);
  const discussion = config.tone === "球迷讨论"
    ? "你更关注事件本身，还是它在平台上的传播方式？"
    : config.tone === "轻松整活"
      ? "这个话题可以玩梗，但事实和观点要分开。"
      : "先看热点原文，再判断哪些信息值得继续展开。";
  return [
    `${topic.title}正在${topic.platform ?? topic.source ?? "相关平台"}形成讨论。`,
    summary && summary !== topic.title ? summary : "",
    discussion,
    base.sourceLine,
    base.riskLine ? `风险提醒：${base.riskLine}` : ""
  ].filter(Boolean).join("\n");
}

function buildVideoScript(
  topic: HotTopic,
  config: HotGenerationConfig,
  base: { sourceLine: string; factLine: string; riskLine: string }
) {
  const summary = normalizeSentence(topic.summary);
  const opening = config.platform === "抖音"
    ? `前三秒：${truncate(topic.title, 20)}，真正值得看的是什么？`
    : `开场：热榜上的“${truncate(topic.title, 24)}”，可以拆成三层来看。`;
  return [
    opening,
    `第一段：交代热点来源和已知信息。${summary || base.factLine}`,
    `第二段：按${config.tone}风格解释讨论焦点，不补写来源中没有的细节。`,
    "第三段：给出一个可讨论的判断，并区分事实和观点。",
    "结尾互动：你会从事件、人物还是传播角度继续看这个热点？",
    base.sourceLine,
    base.riskLine ? `风险提醒：${base.riskLine}` : ""
  ].filter(Boolean).join("\n");
}

function buildCommentPrompts(topic: HotTopic, config: HotGenerationConfig) {
  const subject = truncate(topic.title, 24);
  return [
    `1. “${subject}”最值得继续追的是事件本身，还是平台讨论？`,
    `2. 如果按${config.tone}来做，你更想看人物线、时间线还是数据线？`,
    "3. 这个热点里，哪些是已经明确的信息，哪些只是观点？",
    `4. 你觉得它更适合做成${config.platform}短内容，还是完整复盘？`,
    "5. 如果只保留一个内容切口，你会选哪一个？"
  ].join("\n");
}

function buildCardStructure(
  topic: HotTopic,
  config: HotGenerationConfig,
  base: { sourceLine: string; riskLine: string }
) {
  const summary = normalizeSentence(topic.summary);
  return [
    `封面：${truncate(topic.title, 20)}`,
    `第1页：热点发生了什么｜${summary || `来自${topic.platform ?? topic.source ?? "公开平台"}的讨论信号`}`,
    `第2页：为什么值得看｜${topic.heat ? `当前热度 ${topic.heat}` : "已有明确平台讨论"}`,
    `第3页：${config.tone}切口｜人物、事件和传播中选择一条主线`,
    "第4页：作品怎么做｜给出画面、信息顺序和一个核心结论",
    "第5页：评论区问题｜邀请用户选择下一步想看的角度",
    base.sourceLine,
    base.riskLine ? `风险提醒：${base.riskLine}` : ""
  ].filter(Boolean).join("\n");
}

function rewriteSafer(text: string) {
  const cleaned = text
    .replace(/黑哨|黑幕|假球|保送/g, "争议讨论")
    .replace(/废了|垃圾|废物/g, "表现引发讨论")
    .replace(/全网都在骂|骂翻/g, "不少讨论集中在")
    .replace(/确认伤退|确认报销|确认缺席/g, "伤情引发讨论")
    .replace(/实锤|官方证实|已经证明/g, "现有讨论显示");
  return cleaned;
}

function hasRisk(text: string) {
  return /黑哨|黑幕|确认伤退|伤退|裁判|VAR|争议|假球|保送|全网都在骂/i.test(text);
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
