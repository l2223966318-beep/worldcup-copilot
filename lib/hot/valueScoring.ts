import type { HotCategory, HotItem, HotValueLevel } from "@/lib/hot/types";

export type HotValueBreakdown = {
  heatScore: number;
  relevanceScore: number;
  timelinessScore: number;
  contentPotentialScore: number;
  riskPenalty: number;
  valueScore: number;
  valueLevel: HotValueLevel;
  category: HotCategory;
  tags: string[];
};

const WORLD_CUP_TERMS = ["世界杯", "worldcup", "world cup", "fifa", "小组赛", "淘汰赛", "决赛", "世预赛"];
const FOOTBALL_TERMS = ["足球", "男足", "女足", "国足", "点球", "乌龙球", "红牌", "黄牌", "var", "裁判", "射门", "射正", "控球", "角球", "越位", "门将", "前锋", "中场", "后卫", "帽子戏法", "伤退", "补时", "进球"];
const COUNTRY_TERMS = ["中国", "美国", "日本", "韩国", "德国", "法国", "英格兰", "西班牙", "葡萄牙", "阿根廷", "巴西", "意大利", "荷兰", "比利时", "克罗地亚", "捷克", "丹麦", "墨西哥", "加拿大", "卡塔尔", "伊朗", "新西兰", "摩洛哥", "瑞士", "波兰", "澳大利亚", "沙特", "乌拉圭", "哥伦比亚", "佛得角", "埃及", "库拉索"];
const PLAYER_TERMS = ["梅西", "姆巴佩", "内马尔", "C罗", "哈兰德", "贝林厄姆", "莫德里奇", "孙兴慜", "三笘薰", "久保建英"];
const CONTENT_TERMS = ["争议", "冷门", "逆转", "爆冷", "神图", "哭了", "破防", "名场面", "撕破", "球衣", "黑马", "首秀", "出线", "晋级", "淘汰"];
const RISK_TERMS = ["黑哨", "黑幕", "假球", "保送", "废了", "全网都在骂", "确认伤退", "赌球", "歧视", "辱骂", "网暴"];
const ENTERTAINMENT_TERMS = ["百花奖", "电影", "明星", "综艺", "演唱会", "恋情", "塌房"];
const TECH_TERMS = ["AI", "芯片", "手机", "机器人", "大模型", "互联网"];
const SOCIETY_TERMS = ["警方", "通报", "医保", "高考", "城市", "民生", "事故", "教育部"];

export function scoreHotItem(item: HotItem): HotValueBreakdown {
  const text = `${item.title} ${item.summary ?? ""} ${(item.tags ?? []).join(" ")}`;
  const normalized = normalize(text);
  const heatScore = getHeatScore(item.heat ?? item.hot, item.rank);
  const relevanceScore = getRelevanceScore(normalized);
  const timelinessScore = getTimelinessScore(item.publishedAt ?? item.time);
  const contentPotentialScore = getContentPotentialScore(normalized);
  const riskPenalty = getRiskPenalty(normalized);
  const category = classifyCategory(normalized);
  const weakSports = relevanceScore < 12;
  const cappedHeatScore = weakSports ? Math.min(heatScore, 12) : heatScore;
  const valueScore = clamp(cappedHeatScore + relevanceScore + timelinessScore + contentPotentialScore - riskPenalty, 0, 100);
  const valueLevel = getValueLevel(valueScore);

  return {
    heatScore: cappedHeatScore,
    relevanceScore,
    timelinessScore,
    contentPotentialScore,
    riskPenalty,
    valueScore,
    valueLevel,
    category,
    tags: buildTags(normalized, valueLevel)
  };
}

export function valueLevelLabel(level?: HotValueLevel) {
  if (level === "high") return "高价值";
  if (level === "medium") return "可观察";
  return "低优先级";
}

export function isSportsRelatedItem(item: HotItem) {
  return scoreHotItem(item).relevanceScore >= 12;
}

function getHeatScore(heat: unknown, rank?: number) {
  const numeric = numericHeat(heat);
  if (numeric > 0) {
    const logScore = Math.log10(numeric + 1) * 4;
    return clamp(logScore, 0, 30);
  }
  if (rank) return clamp(30 - (rank - 1) * 2, 6, 30);
  return 8;
}

function getRelevanceScore(text: string) {
  let score = 0;
  if (includesAny(text, WORLD_CUP_TERMS)) score += 16;
  if (includesAny(text, FOOTBALL_TERMS)) score += 9;
  if (includesAny(text, COUNTRY_TERMS)) score += 4;
  if (includesAny(text, PLAYER_TERMS)) score += 6;
  if (/\d{1,2}[:比-]\d{1,2}/u.test(text)) score += 7;
  return clamp(score, 0, 25);
}

function getTimelinessScore(value?: string) {
  if (!value) return 15;
  const time = Date.parse(value.replace(/-/g, "/"));
  if (!Number.isFinite(time)) return 12;
  const hours = (Date.now() - time) / 3_600_000;
  if (hours <= 6) return 20;
  if (hours <= 24) return 16;
  if (hours <= 72) return 10;
  return 4;
}

function getContentPotentialScore(text: string) {
  let score = 0;
  if (includesAny(text, CONTENT_TERMS)) score += includesAny(text, WORLD_CUP_TERMS) ? 12 : 8;
  if (includesAny(text, ["乌龙球", "var", "裁判", "伤退", "红牌", "点球", "球衣", "撕破"])) score += 5;
  if (/\d{1,2}[:比-]\d{1,2}/u.test(text)) score += 4;
  return clamp(score, 0, 15);
}

function getRiskPenalty(text: string) {
  let penalty = 0;
  if (includesAny(text, RISK_TERMS)) penalty += 12;
  if (includesAny(text, ["黑哨", "黑幕", "假球", "保送", "赌球"])) penalty += 8;
  return clamp(penalty, 0, 20);
}

function classifyCategory(text: string): HotCategory {
  if (includesAny(text, WORLD_CUP_TERMS)) return "世界杯";
  if (includesAny(text, [...FOOTBALL_TERMS, ...PLAYER_TERMS])) return "体育";
  if (includesAny(text, ENTERTAINMENT_TERMS)) return "娱乐";
  if (includesAny(text, TECH_TERMS)) return "科技";
  if (includesAny(text, SOCIETY_TERMS)) return "社会";
  return "泛热点";
}

function getValueLevel(score: number): HotValueLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function buildTags(text: string, level: HotValueLevel) {
  const tags = [valueLevelLabel(level)];
  if (includesAny(text, WORLD_CUP_TERMS)) tags.push("世界杯");
  if (includesAny(text, FOOTBALL_TERMS)) tags.push("足球");
  if (includesAny(text, ["乌龙球", "球衣", "撕破", "VAR", "var", "伤退", "红牌", "点球"])) tags.push("场上事件");
  if (includesAny(text, RISK_TERMS)) tags.push("需核验");
  return Array.from(new Set(tags));
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function numericHeat(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
