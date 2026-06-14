export type TeamStatsSnapshot = {
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  xg: number;
};

export type MatchContext = {
  id: string;
  matchInfo: {
    id: string;
    name: string;
    teamA: string;
    teamB: string;
    score: string;
    stage: string;
    time: string;
    sourceStatus: string;
  };
  keyEvents: Array<{ minute: string; team: string; type: string; description: string }>;
  keyPlayers: Array<{ name: string; team: string; role: string; rating?: number }>;
  stats: {
    teamA: TeamStatsSnapshot;
    teamB: TeamStatsSnapshot;
  };
  hotSignals: Array<{ label: string; topicSeed: string; contentValue: number }>;
  summary: string;
};

export type AnalysisResult = {
  matchId: string;
  summary: string;
  winLossReason: string;
  keyPlayers: string[];
  turningPoints: string[];
  dataInsights: string[];
  communicationAngles: string[];
  sourceStatus: "ai" | "fallback";
  message?: string;
};

export type WorkflowTopic = {
  id: string;
  title: string;
  category: string;
  coreAngle: string;
  reason: string;
  riskLevel: string;
  recommendedFormat: string;
};

export type PlatformKey = "bilibili" | "xiaohongshu" | "weibo" | "douyin" | "videoScript" | "article";

export type PlatformDraft = {
  id: string;
  platform: PlatformKey;
  title: string;
  body: string;
  sections: Array<{ title: string; content: string }>;
  createdAt: string;
};

export type ReviewResultSnapshot = {
  level: string;
  score: number;
  findings: Array<{ type: string; sentence: string; rewrite: string }>;
  advice: string;
};

export type ContentPackage = {
  matchInfo: MatchContext["matchInfo"];
  analysis: AnalysisResult;
  selectedTopic: WorkflowTopic;
  platformDraft: PlatformDraft;
  reviewResult: ReviewResultSnapshot;
  createdAt: string;
};

export type WorkflowState = {
  currentMatch?: MatchContext;
  analysisResult?: AnalysisResult;
  topicList?: WorkflowTopic[];
  selectedTopic?: WorkflowTopic;
  selectedPlatform?: PlatformKey;
  generatedContent?: PlatformDraft;
  reviewResult?: ReviewResultSnapshot;
  dataSourceStatus?: string;
  knowledgeContext?: string[];
  updatedAt: string;
};
