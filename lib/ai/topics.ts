import type { MatchData } from "@/data/matches";

export type TopicCategory =
  | "战术复盘"
  | "球员叙事"
  | "数据解读"
  | "历史对照"
  | "争议讨论"
  | "情绪共鸣"
  | "冷知识科普"
  | "平台热点";

export type TopicIdea = {
  id: string;
  title: string;
  coreAngle: string;
  category: TopicCategory;
  newsValue: number;
  bilibiliFit: number;
  xiaohongshuFit: number;
  weiboFit: number;
  shortVideoFit: number;
  recommendedFormat: string;
  difficulty: "低" | "中" | "高";
  riskLevel: "低" | "中" | "高";
  reason: string;
  sampleTitles: string[];
};

export function generateTopics(match: MatchData): TopicIdea[] {
  const topPlayer = [...match.keyPlayers].sort((a, b) => b.rating - a.rating)[0];
  const scorer = [...match.keyPlayers].sort((a, b) => b.goals - a.goals)[0];
  const possessionGap = Math.abs(match.stats.teamA.possession - match.stats.teamB.possession);
  const xgGap = Math.abs(match.stats.teamA.xg - match.stats.teamB.xg).toFixed(1);
  const isFinal = match.id === "argentina-france-2022-final";

  if (isFinal) {
    return worldCupFinalTopics(match);
  }

  return [
    createTopic(match, {
      id: "control-gap",
      title: `${match.teamA}真的控制住比赛了吗？`,
      coreAngle: `控球率差距 ${possessionGap}% 不等于内容结论，需要结合射正、xG 和关键事件判断比赛控制权。`,
      category: "战术复盘",
      scores: [86, 91, 58, 78, 84],
      recommendedFormat: "B站深度复盘 + 60 秒短视频",
      difficulty: "中",
      riskLevel: "低",
      reason: "适合用数据解释比赛观感与真实威胁之间的差异。",
      sampleTitles: [`控球更多就踢得更好吗？复盘${match.name}`, `${match.score} 背后的真实胜负手`]
    }),
    createTopic(match, {
      id: "player-story",
      title: `${topPlayer.name}如何成为比赛叙事中心`,
      coreAngle: `用 ${topPlayer.name} 的进球、关键传球、对抗和评分串联比赛情绪。`,
      category: "球员叙事",
      scores: [90, 86, 82, 88, 91],
      recommendedFormat: "人物短视频 + 小红书卡片",
      difficulty: "低",
      riskLevel: "低",
      reason: "人物抓手明确，适合跨平台传播。",
      sampleTitles: [`${topPlayer.name}这一晚，为什么值得被记住？`, `从一个镜头看懂${topPlayer.name}的比赛气质`]
    }),
    createTopic(match, {
      id: "data-anomaly",
      title: `xG 差距 ${xgGap}：比分之外还有什么信号`,
      coreAngle: "把 xG、射门、射正和角球放在一起，解释哪些机会真正改变了比赛。",
      category: "数据解读",
      scores: [84, 88, 72, 80, 78],
      recommendedFormat: "数据图解 + 微博长图",
      difficulty: "中",
      riskLevel: "低",
      reason: "数据异常能让内容从普通赛果报道升级为分析稿。",
      sampleTitles: [`别只看比分：${match.name}的 7 个关键数据`, `这场球的数据，和你的观感一样吗？`]
    }),
    createTopic(match, {
      id: "timeline",
      title: "决定比赛走向的三个瞬间",
      coreAngle: "从事件时间线中提炼转折点，适合短视频和微博快评。",
      category: "战术复盘",
      scores: [88, 84, 64, 86, 93],
      recommendedFormat: "短视频分镜 + 复盘长图",
      difficulty: "中",
      riskLevel: "低",
      reason: `本场记录了 ${match.keyEvents.length} 个关键事件，天然适合做节奏化叙事。`,
      sampleTitles: ["真正改变比赛的不是比分，而是这三个瞬间", "三分钟看懂这场比赛的转折点"]
    }),
    createTopic(match, {
      id: "risk-controversy",
      title: "争议点能不能发？先把事实边界讲清楚",
      coreAngle: "把争议讨论转成规则、事实和多方来源，不做绝对判断。",
      category: "争议讨论",
      scores: [78, 74, 48, 92, 80],
      recommendedFormat: "微博讨论 + 审稿后短视频",
      difficulty: "高",
      riskLevel: "中",
      reason: "有传播空间，但必须避免把观点包装成事实。",
      sampleTitles: ["这几个瞬间值得讨论，但别急着下结论", "赛后争议怎么理性看？"]
    })
  ];
}

function worldCupFinalTopics(match: MatchData): TopicIdea[] {
  return [
    createTopic(match, {
      id: "messi-last-piece",
      title: "梅西职业生涯最后拼图",
      coreAngle: "用冠军、两次领先、点球大战和时代交接，讲清梅西为什么不是单纯“夺冠”，而是完成了职业叙事闭环。",
      category: "球员叙事",
      scores: [98, 95, 90, 94, 96],
      recommendedFormat: "B站 8 分钟人物复盘 + 小红书 5 页收藏卡 + 短视频高光口播",
      difficulty: "中",
      riskLevel: "低",
      reason: "人物、历史意义和情绪共鸣同时成立，是最适合作为主推的内容角度。",
      sampleTitles: ["梅西等了 16 年的最后拼图，为什么必须在这一夜完成？", "从少年到球王：梅西世界杯冠军的叙事闭环"]
    }),
    createTopic(match, {
      id: "control-does-not-mean-control",
      title: "控球并不等于控制比赛",
      coreAngle: "阿根廷控球率只有 54%，但射门和射正优势明显，可以用“机会质量高于控球时长”解释比赛。",
      category: "战术复盘",
      scores: [92, 94, 66, 83, 88],
      recommendedFormat: "B站战术复盘 + 数据图表解说",
      difficulty: "中",
      riskLevel: "低",
      reason: "战术复盘抓手清楚，可以把普通赛果报道升级成专业内容。",
      sampleTitles: ["阿根廷不是靠控球赢下决赛，而是靠更准确的机会选择", "3-3 背后：真正控制比赛的是谁？"]
    }),
    createTopic(match, {
      id: "mbappe-hat-trick",
      title: "姆巴佩的帽子戏法为什么仍然输了",
      coreAngle: "用个人爆发、团队阶段性被动和点球大战心理压力，讨论球星表现与比赛结果的错位。",
      category: "球员叙事",
      scores: [93, 90, 82, 91, 92],
      recommendedFormat: "人物对照视频 + 微博讨论帖",
      difficulty: "中",
      riskLevel: "低",
      reason: "梅西与姆巴佩形成天然对照，有讨论度但不需要制造对立。",
      sampleTitles: ["帽子戏法还不够：姆巴佩在决赛里输给了什么？", "一场比赛里的两种球王叙事"]
    }),
    createTopic(match, {
      id: "data-anomaly-final",
      title: "数据异常：阿根廷射正效率如何改写比赛",
      coreAngle: "阿根廷 20 次射门、10 次射正，法国 10 次射门、5 次射正，双方射正率接近但机会来源完全不同。",
      category: "数据解读",
      scores: [89, 88, 76, 84, 82],
      recommendedFormat: "数据图解 + 公众号图表段落",
      difficulty: "中",
      riskLevel: "低",
      reason: "数据反差可以支撑“为什么观感紧张但阿根廷长期占优”的解释。",
      sampleTitles: ["别只看 3-3：这组射门数据说明了决赛的另一面", "阿根廷赢在哪里？先看射正和 xG"]
    }),
    createTopic(match, {
      id: "2018-to-2022",
      title: "从 2018 被法国淘汰，到 2022 点球复仇",
      coreAngle: "把 2018 的速度冲击和 2022 的决赛拉到同一条历史线上，做出更有纵深的世界杯记忆。",
      category: "历史对照",
      scores: [87, 91, 70, 78, 76],
      recommendedFormat: "B站历史线复盘 + 公众号长文",
      difficulty: "中",
      riskLevel: "低",
      reason: "历史对照能增强内容厚度，适合作品集展示。",
      sampleTitles: ["四年之后，阿根廷终于把输给法国的那一页翻过去", "2018 到 2022：一条世界杯复仇线"]
    }),
    createTopic(match, {
      id: "martinez-save",
      title: "马丁内斯 120+3 分钟扑救的内容价值",
      coreAngle: "把一个瞬间拆成门将选择、比赛心理和短视频节奏，是最适合做 30 秒传播的节点。",
      category: "平台热点",
      scores: [85, 82, 78, 86, 95],
      recommendedFormat: "30 秒短视频 + 微博动图讨论",
      difficulty: "低",
      riskLevel: "低",
      reason: "单镜头记忆点强，适合短视频平台快速传播。",
      sampleTitles: ["如果没有这次扑救，梅西的结局可能完全不同", "120+3 分钟，世界杯决赛最窒息的一秒"]
    }),
    createTopic(match, {
      id: "penalty-story",
      title: "点球大战为什么天生适合短视频",
      coreAngle: "点球大战具备倒计时、对视、心理压力和明确结果，天然符合短视频节奏。",
      category: "冷知识科普",
      scores: [82, 80, 84, 82, 94],
      recommendedFormat: "小红书科普卡 + 短视频口播",
      difficulty: "低",
      riskLevel: "低",
      reason: "适合把足球规则和内容方法结合，扩大非球迷受众。",
      sampleTitles: ["为什么点球大战总能让人屏住呼吸？", "看懂点球大战，先看这三个心理细节"]
    }),
    createTopic(match, {
      id: "controversy-safe",
      title: "决赛争议怎么讲，才不踩发布风险",
      coreAngle: "裁判、点球和犯规讨论要先区分事实、规则和观点，避免使用“黑哨”“黑幕”等定性表达。",
      category: "争议讨论",
      scores: [80, 76, 54, 95, 84],
      recommendedFormat: "微博风险审稿样例 + 运营提示卡",
      difficulty: "高",
      riskLevel: "中",
      reason: "争议内容有流量，但也是体育内容运营最容易翻车的部分。",
      sampleTitles: ["可以讨论争议，但不要把观点写成判决书", "世界杯决赛争议点，运营发布前要检查什么？"]
    }),
    createTopic(match, {
      id: "platform-split",
      title: "同一场决赛如何拆成 5 个平台版本",
      coreAngle: "B站讲深度，小红书讲收藏，微博讲讨论，短视频讲瞬间，公众号讲完整方案。",
      category: "平台热点",
      scores: [86, 88, 88, 90, 91],
      recommendedFormat: "多平台内容包",
      difficulty: "中",
      riskLevel: "低",
      reason: "能直接展示这个工作台的业务价值。",
      sampleTitles: ["一场球，5 个平台应该怎么发？", "赛事运营人如何拆解世界杯决赛内容？"]
    }),
    createTopic(match, {
      id: "emotion",
      title: "为什么这场比赛能打动非球迷",
      coreAngle: "领先、追平、加时、点球和冠军叙事连续叠加，让比赛具备电影式情绪曲线。",
      category: "情绪共鸣",
      scores: [88, 80, 92, 90, 90],
      recommendedFormat: "小红书情绪卡片 + 短视频混剪口播",
      difficulty: "低",
      riskLevel: "低",
      reason: "适合破圈，但要避免过度煽情和不准确事实。",
      sampleTitles: ["不懂球，也会被这场决赛打动", "胜负之外，这场比赛真正留下了什么？"]
    })
  ];
}

function createTopic(
  match: MatchData,
  config: {
    id: string;
    title: string;
    coreAngle: string;
    category: TopicCategory;
    scores: [number, number, number, number, number];
    recommendedFormat: string;
    difficulty: "低" | "中" | "高";
    riskLevel: "低" | "中" | "高";
    reason: string;
    sampleTitles: string[];
  }
): TopicIdea {
  return {
    id: `${match.id}-${config.id}`,
    title: config.title,
    coreAngle: config.coreAngle,
    category: config.category,
    newsValue: config.scores[0],
    bilibiliFit: config.scores[1],
    xiaohongshuFit: config.scores[2],
    weiboFit: config.scores[3],
    shortVideoFit: config.scores[4],
    recommendedFormat: config.recommendedFormat,
    difficulty: config.difficulty,
    riskLevel: config.riskLevel,
    reason: config.reason,
    sampleTitles: config.sampleTitles
  };
}
