import type { AnalysisResult, MatchContext } from "@/types/workflow";

export function createRuleBasedAnalysis(matchContext: MatchContext): AnalysisResult {
  const { matchInfo, stats, keyEvents, hotSignals } = matchContext;
  const possessionGap = Math.abs(stats.teamA.possession - stats.teamB.possession);
  const shotGap = stats.teamA.shotsOnTarget - stats.teamB.shotsOnTarget;
  const xgGap = Number((stats.teamA.xg - stats.teamB.xg).toFixed(2));
  const leadingTeam = scoreLeader(matchInfo.score, matchInfo.teamA, matchInfo.teamB);
  const topEvent = keyEvents[0];
  const topSignal = hotSignals[0];

  return {
    matchId: matchInfo.id,
    summary: `${matchInfo.name} 的核心不是只看比分 ${matchInfo.score}，而是把比分、关键事件、射正效率和热点讨论放在同一条传播主线里判断。`,
    winLossReason: leadingTeam
      ? `${leadingTeam} 在比分结果上占优。结合射正差 ${shotGap}、xG 差 ${xgGap}，可以从机会质量和关键节点执行力解释胜负。`
      : `双方比分未分出胜负或赛程未结束，当前更适合围绕控球差 ${possessionGap}%、射正差 ${shotGap} 和事件时间线做内容预热。`,
    keyPlayers: matchContext.keyPlayers.length
      ? matchContext.keyPlayers.slice(0, 3).map((player) => `${player.name}：${player.role}，适合承担人物叙事或镜头线索。`)
      : [`${matchInfo.teamA} 与 ${matchInfo.teamB} 的关键球员数据暂缺，建议以球队整体表现和事件节点作为主线。`],
    turningPoints: [
      topEvent ? `${topEvent.minute} ${topEvent.team}：${topEvent.description}` : "当前接口未返回详细事件，先以比分和技术统计作为转折点依据。",
      topSignal ? `热点信号：${topSignal.topicSeed}` : "如出现乌龙球、VAR、球衣被扯破等场上事件，应优先纳入选题判断。"
    ],
    dataInsights: [
      `控球率：${matchInfo.teamA} ${stats.teamA.possession}% / ${matchInfo.teamB} ${stats.teamB.possession}%，控球差为 ${possessionGap}%。`,
      `射门与射正：${matchInfo.teamA} ${stats.teamA.shots}/${stats.teamA.shotsOnTarget}，${matchInfo.teamB} ${stats.teamB.shots}/${stats.teamB.shotsOnTarget}，适合解释进攻效率。`,
      `xG：${matchInfo.teamA} ${stats.teamA.xg} / ${matchInfo.teamB} ${stats.teamB.xg}，可用于支撑机会质量判断。`
    ],
    communicationAngles: [
      "数据向：用射正、xG 和事件时间线解释比分背后的机会质量。",
      "情绪向：抓住关键失误、反转、争议或球星节点做短视频和微博讨论。",
      "运营向：B站做深度复盘，微博做热点承接，小红书做解释卡，抖音做前三秒钩子。"
    ],
    sourceStatus: "fallback",
    message: "未调用外部模型时使用本地规则生成，适合 demo 模式完整跑通。"
  };
}

function scoreLeader(score: string, teamA: string, teamB: string) {
  const [a, b] = score.split("-").map((item) => Number(item));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return "";
  return a > b ? teamA : teamB;
}
