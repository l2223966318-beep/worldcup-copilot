import { exampleMatches, type MatchData } from "@/data/matches";

export type Project = {
  id: string;
  name: string;
  eventType: string;
  description: string;
};

export type MatchWorkflowStatus = "待处理" | "已生成" | "进行中" | "未开始";

export type MatchTask = {
  match: MatchData;
  priority: "S" | "A" | "B";
  status: MatchWorkflowStatus;
  endedAgo?: string;
  highlight: string;
  recommendedDirections: string[];
  generatedPlatforms: string[];
};

export const projects: Project[] = [
  {
    id: "worldcup-2026-ops",
    name: "2026 世界杯内容运营",
    eventType: "足球 / 世界杯",
    description: "围绕赛后数据解读、选题角度、平台分发和风险审稿的内容运营项目。"
  }
];

const matchTasks: MatchTask[] = [
  {
    match: exampleMatches[0],
    priority: "S",
    status: "待处理",
    endedAgo: "12 分钟前结束",
    highlight: "法国后段射正效率突然拉高，阿根廷控球和机会质量更稳定。",
    recommendedDirections: ["赛后复盘", "数据解读", "球星表现"],
    generatedPlatforms: []
  },
  {
    match: exampleMatches[1],
    priority: "A",
    status: "已生成",
    endedAgo: "2 小时前结束",
    highlight: "英格兰控球占优但禁区效率不足，巴西转换进攻更直接。",
    recommendedDirections: ["战术复盘", "短视频钩子", "边路速度"],
    generatedPlatforms: ["B站", "微博", "公众号"]
  },
  {
    match: exampleMatches[2],
    priority: "B",
    status: "进行中",
    highlight: "中国队低控球下保持防线紧凑，定位球仍是主要内容抓手。",
    recommendedDirections: ["情绪共鸣", "数据解释", "风险审稿"],
    generatedPlatforms: []
  }
];

export function getProjects() {
  return projects;
}

export function getCurrentProject() {
  return projects[0];
}

export function getTodayMatches(projectId: string) {
  void projectId;
  return matchTasks;
}

export function getMatchesByProject(projectId: string) {
  return getTodayMatches(projectId).map((item) => item.match);
}

export function getMatchDetail(matchId: string) {
  return matchTasks.find((item) => item.match.id === matchId)?.match ?? exampleMatches[0];
}

export function getMatchTask(matchId: string) {
  return matchTasks.find((item) => item.match.id === matchId) ?? matchTasks[0];
}

export function getProjectDataSource(projectId: string) {
  void projectId;
  return {
    name: "示例赛后数据",
    status: "已连接",
    updateFrequency: "手动导入 / 示例数据",
    fields: ["比分", "关键事件", "控球率", "射门", "射正", "角球", "犯规", "黄牌"]
  };
}

export function getProjectOutputPlatforms(projectId: string) {
  void projectId;
  return ["B站", "微博", "小红书", "公众号"];
}

export function analyzeMatch(matchData: MatchData) {
  const teamAShotRate = Math.round((matchData.stats.teamA.shotsOnTarget / Math.max(matchData.stats.teamA.shots, 1)) * 100);
  const teamBShotRate = Math.round((matchData.stats.teamB.shotsOnTarget / Math.max(matchData.stats.teamB.shots, 1)) * 100);

  return {
    trend: `${matchData.teamA}在控球和持续进攻上更主动，${matchData.teamB}则依靠关键时段的效率改变比赛情绪。`,
    reason: `射正率分别为 ${teamAShotRate}% 和 ${teamBShotRate}%，说明内容不能只写比分，要解释射门质量和关键节点。`,
    turningPoint: matchData.keyEvents[Math.min(3, matchData.keyEvents.length - 1)]?.description ?? matchData.summary,
    contentValue: "适合拆成数据解释、球员叙事和平台化短内容三条线。"
  };
}

export function generateContentByPlatform() {
  return "本地 mock 生成逻辑通过 lib/ai/content.ts 提供，后续可替换为真实模型或机构模板服务。";
}

export function reviewContentRisk() {
  return "本地 mock 审稿逻辑通过 lib/ai/risk.ts 提供，正式版本可接入审核策略库。";
}

export function searchKnowledgeBase(query: string, projectId: string) {
  void projectId;
  if (query.includes("控球")) return "控球率高不一定代表优势，运营表达要继续看射正、关键事件和关键区域触球。";
  if (query.includes("风险")) return "涉及黑哨、黑幕、确认伤退等定性说法时，应改为需核验、引发讨论、发布前核验。";
  return "可以从术语解释、运营理解、内容表达和风险提示四个角度组织回答。";
}

export function suggestKnowledgeTerms() {
  return ["控球率", "射正率", "高位逼抢", "点球大战", "争议判罚表达风险"];
}
