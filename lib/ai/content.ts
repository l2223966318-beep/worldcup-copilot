import type { MatchData } from "@/data/matches";
import type { TopicIdea } from "@/lib/ai/topics";

export type PlatformContent = {
  bilibili: {
    titles: string[];
    openingScript: string;
    outline: string[];
    commentPrompt: string;
    creatorType: string;
    coverCopy: string;
  };
  xiaohongshu: {
    titles: string[];
    cards: Array<{ title: string; body: string }>;
    coverTitle: string;
    tags: string[];
    avoidWords: string[];
  };
  weibo: {
    shortComment: string;
    longPost: string;
    debateQuestion: string;
    hashtags: string[];
    riskTip: string;
  };
  shortVideo: {
    fifteenSec: string;
    thirtySec: string;
    sixtySec: string;
    storyboard: string[];
    voiceover: string;
    visuals: string[];
  };
  article: {
    title: string;
    intro: string;
    structure: string[];
    subheads: string[];
    ending: string;
    chartSuggestions: string[];
  };
};

export function generatePlatformContent(match: MatchData, topic: TopicIdea): PlatformContent {
  const leadPlayer = match.keyPlayers[0];
  const opponentPlayer = match.keyPlayers[1] ?? leadPlayer;
  const statLine = `${match.teamA}控球率 ${match.stats.teamA.possession}%、射正 ${match.stats.teamA.shotsOnTarget} 次、xG ${match.stats.teamA.xg}；${match.teamB}控球率 ${match.stats.teamB.possession}%、射正 ${match.stats.teamB.shotsOnTarget} 次、xG ${match.stats.teamB.xg}`;

  return {
    bilibili: {
      titles: [
        `${topic.title}：这场${match.stage}真正该怎么看？`,
        `${match.score} 背后，${topic.coreAngle}`,
        `深度复盘${match.teamA} vs ${match.teamB}：别只看比分`,
        topic.sampleTitles[0],
        `用数据、时间线和镜头拆开${match.name}`
      ],
      openingScript:
        `前 30 秒先抛出问题：${topic.sampleTitles[0]}。随后用 ${match.score}${match.penaltyScore ? `，点球 ${match.penaltyScore}` : ""} 建立冲突，再给出本期判断：这不是普通赛果复述，而是从“${topic.coreAngle}”切入，解释这场比赛为什么值得被反复观看。`,
      outline: [
        "00:00 用比分和关键镜头建立问题",
        "00:45 比赛阶段与双方基础阵型",
        "02:00 控球率、射门、射正和 xG 的矛盾",
        `04:00 ${leadPlayer.name} 与 ${opponentPlayer.name} 的人物叙事`,
        "06:30 时间线复盘三个转折点",
        "08:00 发布风险提醒与评论区问题"
      ],
      commentPrompt: `弹幕互动：你认为这场比赛最关键的是 ${leadPlayer.name} 的发挥、点球大战，还是 120+3 分钟的关键扑救？评论区给出你的一分钟复盘。`,
      creatorType: "战术复盘型、数据解说型、人物叙事型、体育纪录片剪辑型 UP 主。",
      coverCopy: `${topic.title}\n${match.score} 之外的真正胜负手`
    },
    xiaohongshu: {
      titles: [
        `不懂球也能看懂：${topic.title}`,
        `${match.name}最值得收藏的 5 个看点`,
        `一页讲清 ${match.score} 背后的故事`,
        `世界杯内容灵感：${topic.title}`,
        `赛后图文怎么做？先从这个角度切入`
      ],
      cards: [
        { title: "这场比赛先看什么", body: `${match.name}，最终比分 ${match.score}${match.penaltyScore ? `，点球 ${match.penaltyScore}` : ""}。先抓住比分反转、关键球员和点球压力三条线。` },
        { title: "主推选题", body: `${topic.title}。核心不是堆情绪，而是把人物、数据和历史意义放在同一条叙事线上。` },
        { title: "数据怎么说", body: `${statLine}。建议用“控球不等于控制比赛”或“机会质量高于场面观感”来解释。` },
        { title: "收藏价值", body: "适合整理成赛后复盘模板：比分、关键事件、人物主线、数据异常、发布风险五个模块。以后做其他比赛也能复用。" },
        { title: "发布提醒", body: "涉及裁判、伤病、黑幕等表述时，用“需核实”“建议补充来源”“从公开信息看”替代绝对判断。" }
      ],
      coverTitle: `${match.score} 之后，怎么讲好这场球？`,
      tags: ["世界杯", "足球复盘", "体育内容", "内容运营", match.teamA, match.teamB],
      avoidWords: ["黑哨", "黑幕", "废了", "确认伤退", "全网都在骂"]
    },
    weibo: {
      shortComment:
        `${match.name}踢成 ${match.score}，最值得快速切入的不是“谁更伟大”，而是：${topic.coreAngle}。赛后快评建议先讲事实，再讲观点，争议点留给有来源的复盘。`,
      longPost:
        `【${topic.title}】\n${match.summary}\n\n从数据看，${statLine}。这说明赛后讨论不能只看控球时间，还要看机会质量、关键事件和球员执行。\n\n我的建议是把这场比赛拆成三层：第一层讲赛果和时间线，第二层讲${leadPlayer.name}与${opponentPlayer.name}的人物对照，第三层讲数据与风险边界。涉及判罚、伤病和争议时，建议补充来源并保留“需核实”的表达。`,
      debateQuestion: `你认为${match.name}最值得复盘的角度是人物叙事、战术变化，还是点球大战心理压力？`,
      hashtags: ["#世界杯#", `#${match.teamA}vs${match.teamB}#`, "#足球复盘#", "#体育内容运营#"],
      riskTip: "微博讨论容易放大争议，涉及判罚、伤病和攻击性评价时，避免“黑哨”“废了”“确认伤退”等定性词。"
    },
    shortVideo: {
      fifteenSec:
        `开头 2 秒：${match.score} 不是全部。中段 8 秒：抛出“${topic.title}”。结尾 5 秒：用一个关键数据或镜头落到评论区问题。`,
      thirtySec:
        `0-5 秒：比分定格和冲突问题；5-12 秒：讲${leadPlayer.name}或关键事件；12-22 秒：用射正/xG 解释比赛；22-30 秒：提示发布风险并引导评论。`,
      sixtySec:
        `用事件时间线串起比赛：开场建立双方状态，中段讲${topic.coreAngle}，后段用数据图表解释走势，最后落到“这条内容适合哪个平台发”。`,
      storyboard: [
        "比分定格画面，字幕：3-3 不是终点",
        "关键球员近景，标注进球、助攻、评分",
        "射门/射正柱状图，解释机会质量",
        "事件时间线快速闪回",
        "结尾卡：评论区讨论最关键一分钟"
      ],
      voiceover:
        `这场${match.name}，如果只看 ${match.score} 会错过真正的内容价值。我们从${topic.coreAngle}切入，能看到人物、数据和历史意义是如何叠在一起的。`,
      visuals: ["比分卡", "球员照片位", "柱状图", "时间线", "风险提示标签", "评论区问题卡"]
    },
    article: {
      title: `${topic.title}：${match.name}内容方案`,
      intro:
        `这场比赛兼具赛事结果、人物叙事和数据解读价值。本文建议围绕“${topic.coreAngle}”展开，形成可用于公众号或专栏的完整复盘。`,
      structure: ["比赛基本信息", "今日核心判断", "关键事件时间线", "数据图表解读", "人物与历史意义", "平台分发建议", "风险审稿提示"],
      subheads: ["比分之外的比赛逻辑", "关键事件如何改变叙事", "数据能解释什么", "不同平台怎么拆", "发布前要核实什么"],
      ending: "体育内容的价值不是替观众下结论，而是把事实、数据和叙事线整理得更清楚，让读者知道为什么这场比赛值得被再次讨论。",
      chartSuggestions: ["控球率对比图放在战术段落", "射门/射正图放在机会质量段落", "关键球员雷达图放在人设段落", "事件时间线放在全文前半段"]
    }
  };
}
