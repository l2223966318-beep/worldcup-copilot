import type { AnalysisResult, MatchContext, PlatformDraft, PlatformKey, WorkflowTopic } from "@/types/workflow";

export const supportedPlatforms: PlatformKey[] = ["bilibili", "xiaohongshu", "weibo", "douyin", "videoScript", "article"];

export function createPlatformDraft(
  platform: PlatformKey,
  matchContext: MatchContext,
  topic: WorkflowTopic,
  analysis: AnalysisResult
): PlatformDraft {
  const factory = platformFactories[platform];
  const sections = factory(matchContext, topic, analysis);
  const title = sections[0]?.content || `${topic.title} - ${platformLabel(platform)}`;

  return {
    id: `${matchContext.id}-${topic.id}-${platform}-${Date.now()}`,
    platform,
    title,
    body: sections.map((section) => `【${section.title}】\n${section.content}`).join("\n\n"),
    sections,
    createdAt: new Date().toISOString()
  };
}

export function platformLabel(platform: PlatformKey) {
  const labels: Record<PlatformKey, string> = {
    bilibili: "B站",
    xiaohongshu: "小红书",
    weibo: "微博",
    douyin: "抖音",
    videoScript: "视频脚本",
    article: "图文长稿"
  };
  return labels[platform];
}

const platformFactories: Record<
  PlatformKey,
  (matchContext: MatchContext, topic: WorkflowTopic, analysis: AnalysisResult) => Array<{ title: string; content: string }>
> = {
  bilibili: (match, topic, analysis) => [
    { title: "视频标题", content: `${topic.title}：这场 ${match.matchInfo.score} 真正该怎么看？` },
    { title: "推荐分区与时长", content: "足球 / 运动综合；建议 8-12 分钟，前 30 秒建立冲突，中段用数据和事件复盘。"},
    { title: "开头 30 秒脚本", content: `别只看比分，${analysis.turningPoints[0]}。本期用 ${topic.coreAngle} 拆开这场比赛。` },
    { title: "视频结构", content: "比分钩子 → 关键事件 → 数据解释 → 球员叙事 → 评论区问题。" },
    { title: "弹幕互动点", content: "控球是否等于控制比赛？乌龙球/争议节点是否改变比赛走势？" },
    { title: "评论区置顶", content: "如果只用一句话复盘这场比赛，你会选数据、球星还是场上事件？" }
  ],
  xiaohongshu: (match, topic) => [
    { title: "封面标题", content: `${match.matchInfo.score} 之后，这场球最值得收藏的角度` },
    { title: "首图文案", content: `不懂球也能看懂：${topic.title}` },
    { title: "5页卡片标题", content: "比分不是全部 / 关键事件 / 数据怎么读 / 为什么值得收藏 / 发布前避坑" },
    { title: "正文风格", content: `用生活化语言解释 ${topic.coreAngle}，避免低俗冲突词，多用“引发讨论”“需要结合数据看”。` },
    { title: "收藏理由", content: "这套结构可以复用到其他比赛：比分、事件、人物、数据、风险五步拆解。" }
  ],
  weibo: (match, topic, analysis) => [
    { title: "赛后5分钟快评", content: `${match.matchInfo.name} ${match.matchInfo.score}。先别急着下结论，最值得讨论的是：${topic.coreAngle}` },
    { title: "30分钟讨论帖", content: `${analysis.summary}\n你觉得这场比赛更该从数据、人物，还是场上热点事件切入？` },
    { title: "话题标签", content: `#${match.matchInfo.teamA}vs${match.matchInfo.teamB}# #世界杯# #足球复盘#` },
    { title: "争议降风险版本", content: "涉及判罚和伤病时，统一改成“引发讨论”“仍需核实”“建议补充来源”。" }
  ],
  douyin: (match, topic, analysis) => [
    { title: "前三秒钩子", content: `前三秒：${match.matchInfo.score} 不是全部，这个瞬间才改变了比赛。` },
    { title: "15秒口播", content: `比分一出来，先抓 ${topic.title}。一句话：${analysis.turningPoints[0]}` },
    { title: "30秒口播", content: `先给比分，再讲关键事件，最后用射正和 xG 解释为什么这不是普通赛后复盘。` },
    { title: "60秒口播", content: `用事件时间线串起比赛：开局/转折/数据/风险提示/评论区问题，结尾引导讨论。` },
    { title: "画面素材清单", content: "比分卡、球员特写、射门数据图、事件时间线、评论区问题卡。" }
  ],
  videoScript: (match, topic) => [
    { title: "分镜1", content: `比分卡：${match.matchInfo.teamA} ${match.matchInfo.score} ${match.matchInfo.teamB}` },
    { title: "分镜2", content: `事件线：突出 ${topic.coreAngle}` },
    { title: "分镜3", content: "数据图：控球率、射门、射正、xG 对比。" },
    { title: "分镜4", content: "结尾：用一个安全问题引导评论，不做未经证实判断。" },
    { title: "BGM建议", content: "前段节奏紧，中段降速解释，结尾用鼓点增强讨论感。" }
  ],
  article: (match, topic, analysis) => [
    { title: "文章标题", content: `${topic.title}：${match.matchInfo.name} 内容方案` },
    { title: "导语", content: analysis.summary },
    { title: "正文结构", content: "比赛信息 → 关键事件 → 数据洞察 → 人物叙事 → 平台分发 → 风险提示。" },
    { title: "图表插入位置", content: "技术统计段插控球和射门图；人物段插关键球员雷达；结尾插发布节奏表。" },
    { title: "结尾观点", content: "体育内容不是替观众下结论，而是把事实、数据和叙事线整理清楚。" }
  ]
};
