import type { MatchData } from "@/data/matches";
import { cleanList, cleanTitle, diversifyPlatformText, ensurePublishable, qualityControl } from "@/lib/ai/quality";
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
  const scoreText = match.score === "vs" ? "这场球" : `${match.score}这场球`;
  const eventLine = match.keyEvents[0]?.description || `${match.teamA}和${match.teamB}的比赛走势`;
  const dataLine = `${match.teamA}射门${match.stats.teamA.shots}次、射正${match.stats.teamA.shotsOnTarget}次，${match.teamB}射门${match.stats.teamB.shots}次、射正${match.stats.teamB.shotsOnTarget}次`;
  const mainAngle = ensurePublishable(topic.coreAngle || topic.title);
  const sourceCaution = "涉及伤病、判罚、冲突和更衣室信息，只能写公开事实，发布前核验来源。";

  const bilibiliTitles = cleanList([
    `${leadPlayer.name}这场，真有复盘价值`,
    `${scoreText}别只看比分`,
    `${match.teamA}赢得没那么简单`,
    `${match.teamB}追到这一步不容易`,
    `${topic.title}`
  ], "bilibili", { title: true, max: 5 });

  const xhsTitles = cleanList([
    `看懂${match.teamA}这场球`,
    `${scoreText}最值得看这3点`,
    `${leadPlayer.name}这场为什么关键`,
    `不懂球也能看懂这场`,
    `${topic.title}`
  ], "xiaohongshu", { title: true, max: 5 });

  const raw: PlatformContent = {
    bilibili: {
      titles: bilibiliTitles,
      recommendedSection: "足球 / 运动综合 / 赛事复盘",
      recommendedDuration: topic.recommendation === "主推" ? "8-10分钟" : "4-6分钟",
      openingScript: ensurePublishable(`别急着下结论。${eventLine}，才是这场球最值得拆开的地方。今天就从${topic.title}讲起。`, "bilibili"),
      outline: [
        `00:00 先抛结论：${cleanTitle(topic.title, "bilibili")}`,
        `00:40 比分和关键事件`,
        `02:00 数据证据：${dataLine}`,
        `04:00 人物线：${leadPlayer.name}和${opponentPlayer.name}`,
        "结尾：给评论区一个安全讨论题"
      ],
      coverKeywords: cleanList([match.score, leadPlayer.name, topic.category, "复盘", "关键瞬间"], "generic", { max: 5 }),
      coverCopy: cleanTitle(`${scoreText}真正值得看的地方`, "bilibili"),
      danmakuPoints: cleanList([
        "这球算不算转折点？",
        `${leadPlayer.name}是不是本场关键人？`,
        "控球多就一定占优吗？",
        "你会从人物还是数据切入？"
      ], "generic", { max: 4 }),
      commentPrompt: ensurePublishable(`你觉得这场最该聊${leadPlayer.name}，还是聊${topic.category}？`, "bilibili"),
      pinnedComment: ensurePublishable(`一句话复盘这场球，你会选比分、人物，还是关键事件？`, "bilibili"),
      creatorType: "适合战术复盘、人物叙事、数据解读型账号。",
      unsuitableCreatorType: "不适合只做情绪剪辑、缺少事实核验的标题党账号。"
    },
    xiaohongshu: {
      titles: xhsTitles,
      firstImageCopy: cleanTitle(`${scoreText}为什么值得收藏`, "xiaohongshu"),
      cards: [
        { title: "先看结论", body: ensurePublishable(`${topic.title}。这条主线最容易让非核心球迷看懂。`, "xiaohongshu") },
        { title: "关键瞬间", body: ensurePublishable(eventLine, "xiaohongshu") },
        { title: "数据怎么读", body: ensurePublishable(dataLine, "xiaohongshu") },
        { title: "人物线", body: ensurePublishable(`${leadPlayer.name}和${opponentPlayer.name}可以做成一组对照。`, "xiaohongshu") },
        { title: "发布提醒", body: ensurePublishable(sourceCaution, "xiaohongshu") }
      ],
      cardTitles: ["先看结论", "关键瞬间", "数据怎么读", "人物线", "发布提醒"],
      coverTitle: cleanTitle(`${scoreText}看这3个瞬间`, "xiaohongshu"),
      collectReason: ensurePublishable("这套结构能直接复用：结论、瞬间、数据、人物、风险。", "xiaohongshu"),
      tags: cleanList(["世界杯", "足球复盘", "看懂比赛", match.teamA, match.teamB], "generic", { max: 5 }),
      avoidWords: ["黑幕", "保送", "全网都在骂", "确认伤退", "彻底废了"]
    },
    weibo: {
      fiveMinuteComment: ensurePublishable(`${match.name} ${match.score}。这场后劲最大的点，是${topic.title}。`, "weibo"),
      thirtyMinuteDiscussion: ensurePublishable(`如果只选一个切口聊这场，你会选人物、数据，还是最后的关键瞬间？`, "weibo"),
      controversySafeVersion: ensurePublishable("涉及判罚、伤病和冲突时，用“引发讨论”“仍需核验”，不要写绝对结论。", "weibo"),
      shortComment: ensurePublishable(`${scoreText}后劲不小。${mainAngle}`, "weibo"),
      longPost: ensurePublishable(`${cleanTitle(topic.title, "weibo")}\n\n${match.summary}\n\n从数据看，${dataLine}。这条内容适合先讲事实，再给观点，最后留一个讨论问题。`, "weibo"),
      debateQuestion: ensurePublishable(`这场球最值得复盘的是${leadPlayer.name}，还是${topic.category}？`, "weibo"),
      hashtags: cleanList([`#${match.teamA}vs${match.teamB}#`, "#世界杯#", "#足球复盘#"], "generic", { max: 3 }),
      riskTip: ensurePublishable(sourceCaution, "weibo")
    },
    shortVideo: {
      threeSecondHook: cleanTitle(`${scoreText}别只看比分`, "douyin"),
      fifteenSec: ensurePublishable(`先给结论：${topic.title}。再用一个关键事件和一组数据，把这场球讲清楚。`, "douyin"),
      thirtySec: ensurePublishable(`开头给比分，中段讲${eventLine}，最后用${dataLine}落到评论区问题。`, "douyin"),
      sixtySec: ensurePublishable(`这条视频分四步：比分定格、关键事件、人物线、风险提醒。重点不是煽情，而是把${topic.title}讲顺。`, "douyin"),
      storyboard: [
        "比分卡开场",
        "关键事件时间点",
        "射门和射正数据卡",
        `${leadPlayer.name}人物镜头位`,
        "评论区问题卡"
      ],
      voiceover: ensurePublishable(`${scoreText}最值得讲的不是一句输赢，而是${topic.title}。用事实和数据讲，会比喊口号更稳。`, "douyin"),
      materialList: ["比分卡", "球员图", "射门数据图", "事件时间线", "评论区问题卡"],
      visuals: ["大比分字卡", "人物对照", "数据条形图", "时间线", "风险提示标签"]
    },
    article: {
      title: cleanTitle(`${match.name}：${topic.title}`, "article"),
      intro: ensurePublishable(`${match.name}适合从${topic.title}切入。先交代比赛事实，再用数据和事件搭起复盘结构。`, "article"),
      fullOutline: [
        "比赛基本信息和核心结论",
        "关键事件时间线",
        "数据证据和比赛观感",
        "人物线和平台表达",
        "发布风险和核验清单"
      ],
      structure: ["事实", "事件", "数据", "人物", "风险"],
      subheads: ["比分之外", "关键瞬间", "数据证据", "人物主线", "发布边界"],
      ending: ensurePublishable("好的赛后内容不是替观众下结论，而是把事实、数据和叙事线整理清楚。", "article"),
      chartPlacements: ["开头后放比分卡", "数据段放射门对比", "人物段放关键球员雷达", "结尾前放发布节奏"],
      chartSuggestions: ["射门/射正对比", "控球率对比", "关键事件时间线", "平台分发清单"]
    }
  };

  return diversifyPlatformText(qualityControl(raw));
}
