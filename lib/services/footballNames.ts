const teamNames: Record<string, string> = {
  japan: "日本",
  "united states": "美国",
  usa: "美国",
  usmnt: "美国",
  canada: "加拿大",
  mexico: "墨西哥",
  germany: "德国",
  france: "法国",
  argentina: "阿根廷",
  brazil: "巴西",
  england: "英格兰",
  spain: "西班牙",
  portugal: "葡萄牙",
  "congo dr": "刚果（金）",
  "dr congo": "刚果（金）",
  "democratic republic of the congo": "刚果（金）",
  italy: "意大利",
  netherlands: "荷兰",
  belgium: "比利时",
  uruguay: "乌拉圭",
  paraguay: "巴拉圭",
  colombia: "哥伦比亚",
  ecuador: "厄瓜多尔",
  australia: "澳大利亚",
  "korea republic": "韩国",
  "south korea": "韩国",
  korea: "韩国",
  iran: "伊朗",
  "saudi arabia": "沙特阿拉伯",
  qatar: "卡塔尔",
  morocco: "摩洛哥",
  tunisia: "突尼斯",
  egypt: "埃及",
  senegal: "塞内加尔",
  nigeria: "尼日利亚",
  ghana: "加纳",
  croatia: "克罗地亚",
  serbia: "塞尔维亚",
  switzerland: "瑞士",
  denmark: "丹麦",
  norway: "挪威",
  czechia: "捷克",
  "czech republic": "捷克",
  austria: "奥地利",
  poland: "波兰",
  sweden: "瑞典",
  wales: "威尔士",
  scotland: "苏格兰",
  ukraine: "乌克兰",
  turkey: "土耳其",
  chile: "智利",
  peru: "秘鲁",
  bolivia: "玻利维亚",
  venezuela: "委内瑞拉",
  "new zealand": "新西兰"
};

const statusNames: Record<string, string> = {
  scheduled: "未开始",
  "not started": "未开始",
  "time to be defined": "时间待定",
  "match finished": "已结束",
  finished: "已结束",
  live: "进行中",
  "in progress": "进行中",
  "1st half": "上半场",
  "first half": "上半场",
  "2nd half": "下半场",
  "second half": "下半场",
  halftime: "中场休息",
  postponed: "延期",
  cancelled: "取消"
};

export function localizeTeamName(name: string) {
  return teamNames[normalize(name)] ?? name;
}

export function localizeCompetitionName(name: string) {
  const normalized = normalize(name);
  if (normalized.includes("fifa world cup 2026")) return "2026 世界杯";
  if (normalized.includes("fifa world cup")) return "世界杯";
  return name;
}

export function localizeRoundName(name: string) {
  const normalized = normalize(name);
  if (normalized.includes("group stage")) return "小组赛";
  if (normalized.includes("regular season") || normalized.includes("league")) {
    const round = normalized.match(/round\s+(\d+)/);
    return round?.[1] ? `小组赛第 ${round[1]} 轮` : "小组赛";
  }
  if (normalized.startsWith("round ")) {
    const round = normalized.match(/round\s+(\d+)/);
    return round?.[1] ? `第 ${round[1]} 轮` : "轮次待定";
  }
  if (normalized.includes("round of 16")) return "1/8 决赛";
  if (normalized.includes("quarter")) return "1/4 决赛";
  if (normalized.includes("semi")) return "半决赛";
  if (normalized.includes("final")) return "决赛";
  return name;
}

export function localizeMatchStatus(status: string) {
  return statusNames[normalize(status)] ?? status;
}

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}
