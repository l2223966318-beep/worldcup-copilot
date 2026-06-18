import type { MatchData, MatchEvent } from "@/data/matches";

export type MatchSignalType =
  | "own-goal"
  | "wardrobe-incident"
  | "var-review"
  | "controversial-call"
  | "conflict"
  | "injury-concern"
  | "late-winner"
  | "goalkeeper-error"
  | "penalty-drama"
  | "milestone"
  | "key-moment";

export type MatchSignal = {
  id: string;
  type: MatchSignalType;
  label: string;
  minute: string;
  team: string;
  evidence: string;
  topicSeed: string;
  contentValue: number;
  riskLevel: "低" | "中" | "高";
  priority: "primary" | "secondary" | "watch";
  recommendedPlatforms: string[];
  contentFormats: string[];
  angleHints: string[];
};

type SignalRule = {
  type: MatchSignalType;
  label: string;
  patterns: RegExp[];
  contentValue: number;
  riskLevel: MatchSignal["riskLevel"];
  recommendedPlatforms: string[];
  contentFormats: string[];
  topicSeed: (match: MatchData, event: SignalSource) => string;
  angleHints: string[];
};

type SignalSource = {
  minute: string;
  team: string;
  text: string;
  index: number;
};

const signalRules: SignalRule[] = [
  {
    type: "wardrobe-incident",
    label: "装备/球衣突发事件",
    patterns: [/球衣.*(扯破|撕破|拉破|被扯|被撕)/i, /(shirt|jersey).*(torn|ripped|pulled)/i],
    contentValue: 96,
    riskLevel: "中",
    recommendedPlatforms: ["微博", "短视频", "小红书"],
    contentFormats: ["15秒现场热点解释", "微博讨论帖", "小红书看球冷知识卡"],
    topicSeed: (match, event) => `${event.team}球衣被扯破，为什么这个瞬间比比分更容易出圈？`,
    angleHints: ["现场画面记忆点强", "适合解释规则边界", "避免直接指责球员或裁判动机"]
  },
  {
    type: "own-goal",
    label: "乌龙球",
    patterns: [/乌龙|自摆乌龙|own\s*goal|o\.?g\.?/i],
    contentValue: 94,
    riskLevel: "低",
    recommendedPlatforms: ["短视频", "微博", "B站"],
    contentFormats: ["30秒转折复盘", "微博赛后热评", "B站关键回合慢放复盘"],
    topicSeed: (match, event) => `${match.name}的乌龙球，如何改变比赛叙事和赛后传播？`,
    angleHints: ["天然有转折感", "适合拆解防守压力", "表达上避免嘲讽球员"]
  },
  {
    type: "var-review",
    label: "VAR介入",
    patterns: [/VAR|视频助理裁判|回看|var review/i],
    contentValue: 90,
    riskLevel: "中",
    recommendedPlatforms: ["微博", "B站", "公众号"],
    contentFormats: ["规则解释卡", "争议降风险版本", "长文规则段落"],
    topicSeed: (match, event) => `VAR介入后，${match.name}的争议点应该怎么讲才稳妥？`,
    angleHints: ["先讲规则再讲观点", "发布前核验权威来源", "避免黑哨/保送等定性词"]
  },
  {
    type: "controversial-call",
    label: "争议判罚",
    patterns: [/争议|判罚|点球争议|红牌|越位|手球|裁判/i],
    contentValue: 88,
    riskLevel: "高",
    recommendedPlatforms: ["微博", "公众号"],
    contentFormats: ["低风险讨论帖", "规则解释长文"],
    topicSeed: (match, event) => `${match.name}的争议判罚，内容该怎么做才不踩线？`,
    angleHints: ["事实和观点分开", "使用需核验/发布前核验", "不判断裁判主观动机"]
  },
  {
    type: "conflict",
    label: "冲突/情绪瞬间",
    patterns: [/冲突|推搡|口角|争吵|情绪失控|clash|fight|argument/i],
    contentValue: 86,
    riskLevel: "中",
    recommendedPlatforms: ["短视频", "微博"],
    contentFormats: ["情绪瞬间剪辑", "评论区讨论问题"],
    topicSeed: (match, event) => `${match.name}这次冲突，背后是比赛压力还是战术博弈？`,
    angleHints: ["聚焦比赛压力", "不要扩大球迷对立", "避免侮辱性表达"]
  },
  {
    type: "injury-concern",
    label: "伤病/伤退需核实",
    patterns: [/伤退|受伤|拉伤|伤病|倒地不起|injur|knock/i],
    contentValue: 84,
    riskLevel: "高",
    recommendedPlatforms: ["微博", "公众号"],
    contentFormats: ["需核实快讯", "赛后影响分析"],
    topicSeed: (match, event) => `${event.team}伤病信号会如何影响后续赛程？`,
    angleHints: ["必须写需核验", "不写确认伤退", "发布前核验官方消息"]
  },
  {
    type: "late-winner",
    label: "绝杀/反绝杀",
    patterns: [/绝杀|反绝杀|补时|读秒|90\+|120\+|stoppage|last minute/i],
    contentValue: 86,
    riskLevel: "低",
    recommendedPlatforms: ["短视频", "B站", "微博"],
    contentFormats: ["读秒转折短视频", "时间线复盘", "微博情绪快评"],
    topicSeed: (match, event) => `${event.minute}这个瞬间值得单独复盘`,
    angleHints: ["时间线天然清晰", "适合强节奏口播", "可做情绪共鸣但别过度煽动"]
  },
  {
    type: "goalkeeper-error",
    label: "门将失误/神扑",
    patterns: [/门将|扑救|脱手|黄油手|goalkeeper|save/i],
    contentValue: 82,
    riskLevel: "低",
    recommendedPlatforms: ["B站", "短视频"],
    contentFormats: ["门将单回合复盘", "防守责任拆解"],
    topicSeed: (match, event) => `${event.team}门将这一回合，应该被责怪还是被理解？`,
    angleHints: ["拆动作不做人身攻击", "结合防线压力", "适合慢放复盘"]
  },
  {
    type: "penalty-drama",
    label: "点球戏剧性",
    patterns: [/点球|penalty|罚丢|点球大战/i],
    contentValue: 80,
    riskLevel: "低",
    recommendedPlatforms: ["短视频", "小红书", "B站"],
    contentFormats: ["点球心理解释", "新手看球科普", "B站心理博弈复盘"],
    topicSeed: (match, event) => `点球为什么总能制造${match.name}的内容爆点？`,
    angleHints: ["心理压力强", "适合科普", "不要用单一回合否定球员"]
  },
  {
    type: "milestone",
    label: "纪录/里程碑",
    patterns: [/纪录|里程碑|首球|帽子戏法|梅开二度|双响|hat.?trick|brace/i],
    contentValue: 78,
    riskLevel: "低",
    recommendedPlatforms: ["B站", "公众号", "微博"],
    contentFormats: ["人物叙事", "纪录解释", "赛后长文段落"],
    topicSeed: (match, event) => `${event.team}这个里程碑，如何转成球员叙事？`,
    angleHints: ["适合人物线", "需要补充历史资料", "避免无来源纪录表述"]
  }
];

export function extractMatchSignals(match: MatchData): MatchSignal[] {
  const sources = buildSources(match);
  const signals = sources.flatMap((source) => matchSourceToSignals(match, source));
  const deduped = dedupeSignals(signals);

  if (deduped.length) return deduped.sort(compareSignals).slice(0, 6);

  return buildFallbackSignals(match);
}

export function buildSignalContext(match: MatchData) {
  const signals = extractMatchSignals(match);
  return {
    summary: signals.map((signal) => `${signal.label}：${signal.evidence}`).join("；"),
    signals
  };
}

function buildSources(match: MatchData): SignalSource[] {
  const eventSources = match.keyEvents.map((event, index) => ({
    minute: event.minute,
    team: event.team,
    text: eventToText(event),
    index
  }));

  return [
    ...eventSources,
    {
      minute: "-",
      team: `${match.teamA}/${match.teamB}`,
      text: match.summary,
      index: eventSources.length
    }
  ];
}

function matchSourceToSignals(match: MatchData, source: SignalSource) {
  return signalRules
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(source.text)))
    .map((rule) => ({
      id: `${match.id}-signal-${rule.type}-${source.index}`,
      type: rule.type,
      label: rule.label,
      minute: source.minute,
      team: source.team,
      evidence: source.text,
      topicSeed: rule.topicSeed(match, source),
      contentValue: adjustValueByMinute(rule.contentValue, source.minute),
      riskLevel: rule.riskLevel,
      priority: rule.contentValue >= 90 ? "primary" : rule.contentValue >= 82 ? "secondary" : "watch",
      recommendedPlatforms: rule.recommendedPlatforms,
      contentFormats: rule.contentFormats,
      angleHints: rule.angleHints
    } satisfies MatchSignal));
}

function eventToText(event: MatchEvent) {
  return [event.minute, event.team, event.type, event.description].filter(Boolean).join(" ");
}

function dedupeSignals(signals: MatchSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.type}:${signal.minute}:${signal.evidence.slice(0, 32)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildFallbackSignals(match: MatchData): MatchSignal[] {
  return match.keyEvents.slice(0, 3).map((event, index) => ({
    id: `${match.id}-signal-key-${index + 1}`,
    type: "key-moment",
    label: "关键比赛事件",
    minute: event.minute,
    team: event.team,
    evidence: event.description,
    topicSeed: `${event.minute}这个关键事件，如何改变${match.name}的内容表达？`,
    contentValue: 62 - index * 4,
    riskLevel: "低",
    priority: index === 0 ? "secondary" : "watch",
    recommendedPlatforms: ["B站", "微博"],
    contentFormats: ["时间线复盘", "赛后快评"],
    angleHints: ["补充画面或数据来源", "先讲事实再讲观点"]
  }));
}

function compareSignals(a: MatchSignal, b: MatchSignal) {
  return b.contentValue - a.contentValue;
}

function adjustValueByMinute(base: number, minute: string) {
  if (/90\+|120\+|补时|读秒|绝杀/.test(minute)) return Math.min(100, base + 4);
  if (/^(\d+)'$/.test(minute)) {
    const value = Number(minute.replace("'", ""));
    if (value >= 80) return Math.min(100, base + 2);
  }
  return base;
}
