export type TeamStats = {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  xg: number;
};

export type KeyPlayer = {
  name: string;
  team: string;
  role: string;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  duelsWon: number;
  rating: number;
};

export type MatchEvent = {
  minute: string;
  team: string;
  type: "进球" | "点球" | "换人" | "黄牌" | "关键扑救" | "争议" | "终场";
  description: string;
};

export type HistoricalMeeting = {
  year: string;
  match: string;
  score: string;
  note: string;
};

export type MatchData = {
  id: string;
  isExample: boolean;
  name: string;
  stage: string;
  time: string;
  teamA: string;
  teamB: string;
  score: string;
  penaltyScore?: string;
  keyPlayers: KeyPlayer[];
  keyEvents: MatchEvent[];
  summary: string;
  stats: {
    teamA: TeamStats;
    teamB: TeamStats;
  };
  historicalMeetings: HistoricalMeeting[];
};

export const exampleMatches: MatchData[] = [
  {
    id: "argentina-france-2022-final",
    isExample: true,
    name: "2022 世界杯决赛：阿根廷 vs 法国",
    stage: "决赛",
    time: "2022-12-18 23:00",
    teamA: "阿根廷",
    teamB: "法国",
    score: "3-3",
    penaltyScore: "4-2",
    summary:
      "阿根廷两度领先，法国在常规时间末段和加时赛完成追平，最终阿根廷通过点球大战夺冠。这场比赛兼具球星叙事、战术调整、数据反差、心理博弈和历史意义，是世界杯内容运营的高密度样本。",
    stats: {
      teamA: { possession: 54, shots: 20, shotsOnTarget: 10, corners: 6, fouls: 20, yellowCards: 5, xg: 3.2 },
      teamB: { possession: 46, shots: 10, shotsOnTarget: 5, corners: 5, fouls: 18, yellowCards: 3, xg: 2.4 }
    },
    keyPlayers: [
      { name: "梅西", team: "阿根廷", role: "前锋", goals: 2, assists: 0, shots: 5, keyPasses: 3, duelsWon: 6, rating: 9.4 },
      { name: "姆巴佩", team: "法国", role: "前锋", goals: 3, assists: 0, shots: 6, keyPasses: 1, duelsWon: 5, rating: 9.2 },
      { name: "迪马利亚", team: "阿根廷", role: "边锋", goals: 1, assists: 1, shots: 2, keyPasses: 4, duelsWon: 4, rating: 8.8 }
    ],
    keyEvents: [
      { minute: "23'", team: "阿根廷", type: "点球", description: "梅西点球破门，阿根廷取得领先。" },
      { minute: "36'", team: "阿根廷", type: "进球", description: "迪马利亚完成快速反击进球，阿根廷扩大优势。" },
      { minute: "80'", team: "法国", type: "点球", description: "姆巴佩点球扳回一球，法国重新进入比赛。" },
      { minute: "81'", team: "法国", type: "进球", description: "姆巴佩凌空抽射迅速扳平，比赛叙事被彻底改写。" },
      { minute: "109'", team: "阿根廷", type: "进球", description: "梅西补射破门，阿根廷再次领先。" },
      { minute: "118'", team: "法国", type: "点球", description: "姆巴佩点球完成帽子戏法，法国再次追平。" },
      { minute: "120+3'", team: "阿根廷", type: "关键扑救", description: "马丁内斯完成关键扑救，保住点球大战机会。" },
      { minute: "点球", team: "阿根廷", type: "终场", description: "阿根廷点球大战 4-2 取胜，夺得世界杯冠军。" }
    ],
    historicalMeetings: [
      { year: "1930", match: "世界杯小组赛", score: "阿根廷 1-0 法国", note: "双方首次世界杯交锋。" },
      { year: "1978", match: "世界杯小组赛", score: "阿根廷 2-1 法国", note: "阿根廷主场赛事中取胜。" },
      { year: "2018", match: "世界杯 1/8 决赛", score: "法国 4-3 阿根廷", note: "姆巴佩速度冲击成为焦点。" },
      { year: "2022", match: "世界杯决赛", score: "阿根廷 3-3 法国", note: "阿根廷点球大战夺冠，梅西完成冠军拼图。" }
    ]
  },
  {
    id: "england-brazil-friendly",
    isExample: true,
    name: "示例比赛：英格兰 vs 巴西",
    stage: "国际热身赛",
    time: "2026-03-28 03:45",
    teamA: "英格兰",
    teamB: "巴西",
    score: "1-2",
    summary: "巴西利用边路速度和转换进攻制造威胁，英格兰控球时间更长但禁区内效率不足，适合拆解“控球优势与进攻质量不一致”的选题。",
    stats: {
      teamA: { possession: 58, shots: 14, shotsOnTarget: 4, corners: 7, fouls: 12, yellowCards: 2, xg: 1.4 },
      teamB: { possession: 42, shots: 11, shotsOnTarget: 6, corners: 4, fouls: 15, yellowCards: 3, xg: 1.9 }
    },
    keyPlayers: [
      { name: "贝林厄姆", team: "英格兰", role: "中场", goals: 0, assists: 1, shots: 3, keyPasses: 4, duelsWon: 7, rating: 8.0 },
      { name: "维尼修斯", team: "巴西", role: "边锋", goals: 1, assists: 0, shots: 4, keyPasses: 2, duelsWon: 6, rating: 8.4 },
      { name: "罗德里戈", team: "巴西", role: "前锋", goals: 1, assists: 1, shots: 3, keyPasses: 3, duelsWon: 3, rating: 8.6 }
    ],
    keyEvents: [
      { minute: "18'", team: "巴西", type: "进球", description: "维尼修斯反击破门。" },
      { minute: "51'", team: "英格兰", type: "进球", description: "英格兰利用定位球扳平。" },
      { minute: "76'", team: "巴西", type: "进球", description: "罗德里戈禁区内低射制胜。" }
    ],
    historicalMeetings: [
      { year: "2002", match: "世界杯 1/4 决赛", score: "巴西 2-1 英格兰", note: "罗纳尔迪尼奥任意球成为经典镜头。" },
      { year: "2013", match: "友谊赛", score: "英格兰 2-1 巴西", note: "英格兰在温布利取胜。" }
    ]
  },
  {
    id: "china-qualifier-example",
    isExample: true,
    name: "示例比赛：中国队世界杯预选赛",
    stage: "亚洲区预选赛",
    time: "2026-06-06 20:00",
    teamA: "中国队",
    teamB: "韩国队",
    score: "1-1",
    summary: "中国队在防守压力下保持阵型紧凑，通过定位球取得进球。比赛结果让出线形势仍保留讨论空间，适合做情绪共鸣、数据解释和发布风险审稿演示。",
    stats: {
      teamA: { possession: 39, shots: 8, shotsOnTarget: 3, corners: 3, fouls: 17, yellowCards: 4, xg: 0.9 },
      teamB: { possession: 61, shots: 15, shotsOnTarget: 5, corners: 8, fouls: 11, yellowCards: 1, xg: 1.6 }
    },
    keyPlayers: [
      { name: "张玉宁", team: "中国队", role: "中锋", goals: 1, assists: 0, shots: 3, keyPasses: 1, duelsWon: 5, rating: 7.8 },
      { name: "王大雷", team: "中国队", role: "门将", goals: 0, assists: 0, shots: 0, keyPasses: 0, duelsWon: 1, rating: 8.1 },
      { name: "孙兴慜", team: "韩国队", role: "前锋", goals: 1, assists: 0, shots: 5, keyPasses: 3, duelsWon: 4, rating: 8.3 }
    ],
    keyEvents: [
      { minute: "34'", team: "中国队", type: "进球", description: "中国队利用角球机会头球破门。" },
      { minute: "62'", team: "韩国队", type: "进球", description: "韩国队通过禁区前配合扳平。" },
      { minute: "88'", team: "中国队", type: "关键扑救", description: "门将完成近距离扑救，保住平局。" }
    ],
    historicalMeetings: [
      { year: "2017", match: "世界杯预选赛", score: "中国队 1-0 韩国队", note: "经典主场胜利。" },
      { year: "2024", match: "世界杯预选赛", score: "韩国队 1-0 中国队", note: "中国队客场惜败。" }
    ]
  }
];
