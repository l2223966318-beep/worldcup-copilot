import type { MatchData } from "@/data/matches";
import { diversifyPlatformText, qualityControl } from "@/lib/ai/quality";
import type { TopicIdea } from "@/lib/ai/topics";

export type PlatformContent = {
  bilibili: {
    titles: string[];
    recommendedSection: string;
    recommendedDuration: string;
    openingScript: string;
    outline: string[];
    coverKeywords: string[];
    coverCopy: string;
    danmakuPoints: string[];
    commentPrompt: string;
    pinnedComment: string;
    creatorType: string;
    unsuitableCreatorType: string;
  };
  xiaohongshu: {
    titles: string[];
    firstImageCopy: string;
    cards: Array<{ title: string; body: string }>;
    cardTitles: string[];
    coverTitle: string;
    collectReason: string;
    tags: string[];
    avoidWords: string[];
  };
  weibo: {
    fiveMinuteComment: string;
    thirtyMinuteDiscussion: string;
    controversySafeVersion: string;
    shortComment: string;
    longPost: string;
    debateQuestion: string;
    hashtags: string[];
    riskTip: string;
  };
  shortVideo: {
    threeSecondHook: string;
    fifteenSec: string;
    thirtySec: string;
    sixtySec: string;
    storyboard: string[];
    voiceover: string;
    materialList: string[];
    visuals: string[];
  };
  article: {
    title: string;
    intro: string;
    fullOutline: string[];
    structure: string[];
    subheads: string[];
    ending: string;
    chartPlacements: string[];
    chartSuggestions: string[];
  };
};

export function generatePlatformContent(match: MatchData, topic: TopicIdea): PlatformContent {
  const leadPlayer = match.keyPlayers[0];
  const opponentPlayer = match.keyPlayers[1] ?? leadPlayer;
  const statLine = `${match.teamA}控球率 ${match.stats.teamA.possession}%，射正 ${match.stats.teamA.shotsOnTarget} 次，xG ${match.stats.teamA.xg}；${match.teamB}控球率 ${match.stats.teamB.possession}%，射正 ${match.stats.teamB.shotsOnTarget} 次，xG ${match.stats.teamB.xg}`;

  const raw: PlatformContent = {
    bilibili: {
      titles: [
        `${topic.title}：这场${match.stage}真正该怎么看？`,
        `${match.score} 背后，${topic.coreAngle}`,
        `深度复盘${match.teamA} vs ${match.teamB}：别只看比分`,
        topic.sampleTitles[0],
        `用数据、时间线和镜头拆开${match.name}`
      ],
      recommendedSection: "足球 / 运动综合 / 体育赛事复盘",
      recommendedDuration: topic.recommendation === "主推" ? "8-12 分钟" : "4-6 分钟",
      openingScript: `前 30 秒先抛出问题：${topic.sampleTitles[0]}。随后用 ${match.score}${match.penaltyScore ? `，点球 ${match.penaltyScore}` : ""} 建立冲突，再给出本期判断：本期从“${topic.coreAngle}”切入，解释这场比赛为什么值得被复盘。`,
      outline: [
        "00:00 用比分和关键镜头建立问题",
        "00:45 比赛阶段与双方基础阵型",
        "02:00 控球率、射门、射正和 xG 的矛盾",
        `04:00 ${leadPlayer.name} 与 ${opponentPlayer.name} 的人物叙事`,
        "06:30 时间线复盘三个转折点",
        "08:00 发布风险提醒与评论区问题"
      ],
      coverKeywords: [topic.title, match.score, "机会质量", "决赛复盘"],
      coverCopy: `${topic.title}\n${match.score} 之外的真正胜负手`,
      danmakuPoints: ["这一脚太关键了", "控球不等于控制", "这里建议回看慢镜头", "点球大战开始紧张了"],
      commentPrompt: `弹幕互动：你认为这场比赛最关键的是 ${leadPlayer.name} 的发挥、点球大战，还是 120+3 分钟的关键扑救？`,
      pinnedComment: "置顶评论：如果只用一句话复盘这场比赛，你会选人物、战术还是数据？欢迎按时间点补充你的判断。",
      creatorType: "战术复盘型、数据解说型、人物叙事型、体育纪录片剪辑型 UP 主。",
      unsuitableCreatorType: "只做情绪剪辑、缺少赛事事实核查、习惯使用攻击性标题的账号。"
    },
    xiaohongshu: {
      titles: [
        `不懂球也能看懂：${topic.title}`,
        `${match.name}最值得收藏的 5 个看点`,
        `一页讲清 ${match.score} 背后的故事`,
        `世界杯内容灵感：${topic.title}`,
        `赛后图文怎么做？先从这个角度切入`
      ],
      firstImageCopy: `${match.score} 之后，真正值得讲的是：${topic.title}`,
      cards: [
        { title: "这场比赛先看什么", body: `${match.name}，最终比分 ${match.score}${match.penaltyScore ? `，点球 ${match.penaltyScore}` : ""}。先抓住比分反转、关键球员和点球压力三条线。` },
        { title: "主推选题", body: `${topic.title}。核心不是堆情绪，而是把人物、数据和历史意义放在同一条叙事线上。` },
        { title: "数据怎么说", body: `${statLine}。建议用“控球不等于控制比赛”或“机会质量高于场面观感”来解释。` },
        { title: "为什么值得收藏", body: "这套结构可以复用到其他比赛：比分、关键事件、人物主线、数据异常、发布风险五个模块。" },
        { title: "发布提醒", body: "涉及裁判、伤病、争议时，用“需核实”“建议补充来源”“从公开信息看”替代绝对判断。" }
      ],
      cardTitles: ["比分不是全部", "主推选题", "关键数据", "收藏模板", "发布提醒"],
      coverTitle: `${match.score} 之后，怎么讲好这场球？`,
      collectReason: "这是一套可复用的赛后内容拆解模板，适合运营、编辑和创作者收藏。",
      tags: ["世界杯", "足球复盘", "体育内容", "内容运营", match.teamA, match.teamB],
      avoidWords: ["黑哨", "黑幕", "废了", "确认伤退", "全网都在骂"]
    },
    weibo: {
      fiveMinuteComment: `${match.name}踢成 ${match.score}。先不急着下结论，最值得看的线索是：${topic.coreAngle}`,
      thirtyMinuteDiscussion: `赛后 30 分钟讨论题：这场比赛更应该从人物叙事、战术变化，还是数据异常切入？我的判断是先推“${topic.title}”，再用图表补证据。`,
      controversySafeVersion: "涉及判罚和争议时，建议写成“这一判罚引发讨论，仍需结合规则条文和权威解读”。避免直接定性。",
      shortComment: `${match.name}踢成 ${match.score}，最值得快速切入的是：${topic.coreAngle}。赛后快评建议先讲事实，再讲观点。`,
      longPost: `【${topic.title}】\n${match.summary}\n\n从数据看，${statLine}。这说明赛后讨论不能只看控球时间，还要看机会质量、关键事件和球员执行。\n\n建议把这场比赛拆成三层：第一层讲赛果和时间线，第二层讲${leadPlayer.name}与${opponentPlayer.name}的人物对照，第三层讲数据与风险边界。`,
      debateQuestion: `你认为${match.name}最值得复盘的角度是人物叙事、战术变化，还是点球大战心理压力？`,
      hashtags: ["#世界杯#", `#${match.teamA}vs${match.teamB}#`, "#足球复盘#", "#体育内容运营#"],
      riskTip: "微博讨论容易放大争议，涉及判罚、伤病和攻击性评价时，避免高风险定性词。"
    },
    shortVideo: {
      threeSecondHook: `${match.score} 不是全部，真正的转折在这三个瞬间。`,
      fifteenSec: `开头 2 秒：${match.score} 不是全部。中段 8 秒：抛出“${topic.title}”。结尾 5 秒：用一个关键数据或镜头落到评论区问题。`,
      thirtySec: `0-5 秒：比分定格和冲突问题；5-12 秒：讲${leadPlayer.name}或关键事件；12-22 秒：用射正和 xG 解释比赛；22-30 秒：提示风险边界并引导评论。`,
      sixtySec: `用事件时间线串起比赛：开场建立双方状态，中段讲${topic.coreAngle}，后段用数据图表解释走势，最后落到“这条内容适合哪个平台发”。`,
      storyboard: [
        "比分定格画面，字幕：3-3 不是终点",
        "关键球员近景，标注进球、助攻、评分",
        "射门 / 射正柱状图，解释机会质量",
        "事件时间线快速闪回",
        "结尾卡：评论区讨论最关键一分钟"
      ],
      voiceover: `这场${match.name}，如果只看 ${match.score} 会错过真正的内容价值。我们从${topic.coreAngle}切入，能看到人物、数据和历史意义如何叠在一起。`,
      materialList: ["比分图", "球员特写", "射门数据图", "事件时间线", "历史交锋图", "风险提示字幕"],
      visuals: ["比分卡", "球员照片位", "柱状图", "时间线", "风险提示标签", "评论区问题卡"]
    },
    article: {
      title: `${topic.title}：${match.name}内容方案`,
      intro: `这场比赛兼具赛事结果、人物叙事和数据解读价值。本文建议围绕“${topic.coreAngle}”展开，形成可用于公众号或专栏的完整复盘。`,
      fullOutline: [
        "一、比赛信息与核心结论",
        "二、关键事件时间线",
        "三、数据洞察：控球、射门、xG 和效率",
        "四、人物叙事：主角、对照与历史意义",
        "五、多平台分发策略",
        "六、风险审稿与合规提醒"
      ],
      structure: ["比赛基本信息", "今日核心判断", "关键事件时间线", "数据图表解读", "人物与历史意义", "平台分发建议", "风险审稿提示"],
      subheads: ["比分之外的比赛逻辑", "关键事件如何改变叙事", "数据能解释什么", "不同平台怎么拆", "发布前要核实什么"],
      ending: "体育内容的价值不是替观众下结论，而是把事实、数据和叙事线整理得更清楚。",
      chartPlacements: ["第一部分后插入比分卡", "第三部分插入控球率和射门图", "第四部分插入关键球员雷达图", "结尾前插入发布节奏表"],
      chartSuggestions: ["控球率对比图放在战术段落", "射门 / 射正图放在机会质量段落", "关键球员雷达图放在人设段落", "事件时间线放在全文前半段"]
    }
  };

  return diversifyPlatformText(qualityControl(raw));
}
