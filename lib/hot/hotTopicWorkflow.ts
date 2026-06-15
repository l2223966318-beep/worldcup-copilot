import { cleanList, qualityControl } from "@/lib/ai/quality";
import type { HotSearchPayload, HotTopic } from "@/lib/hot/types";

export const HOT_RADAR_CACHE_KEY = "worldcup.hot-topic-radar.cache.v1";

export type HotRadarCache = {
  topics: HotTopic[];
  lastUpdatedAt: string;
  sourceStatus: HotSearchPayload["sourceStatus"];
  message?: string;
};

export type GeneratedHotPackage = {
  bilibili: string[];
  weibo: string[];
  xiaohongshu: string[];
  shortVideo: string[];
  risk: string[];
};

export function buildWhyCare(topic: HotTopic) {
  return cleanList([
    `${topic.source}信号显示它具备即时讨论价值。`,
    topic.leverageValue === "高价值" ? "它和体育/世界杯语境关联强，可以直接进入选题判断。" : "它不是纯比赛数据，但可以作为泛热点借势素材。",
    topic.category ? `当前分类为“${topic.category}”，适合先判断平台适配度再生成内容。` : "建议结合来源链接人工确认背景。"
  ]);
}

export function generateHotTopicPackage(topic: HotTopic, matchLabel = "今日世界杯比赛"): GeneratedHotPackage {
  const riskLine = /黑哨|黑幕|确认伤退|伤退|裁判|VAR|争议/i.test(`${topic.title} ${topic.summary ?? ""}`)
    ? "风险提醒：不要直接定性，建议写成“引发讨论”“需核实”“从规则角度复盘”。"
    : "风险提醒：避免夸大全网情绪，补充数据或来源后再发布。";

  return qualityControl({
    bilibili: [
      `选题：${topic.title}背后，${matchLabel}还能怎么复盘？`,
      "结构：热点开场 / 比赛事实 / 数据解释 / 平台讨论 / 评论区问题。",
      "弹幕互动：你觉得这是比赛转折，还是赛后传播转折？"
    ],
    weibo: [
      `话题：#${topic.title.replace(/\s+/g, "")}#`,
      `短帖：先看热点，再回到${matchLabel}，这类事件最适合讨论“比赛之外的传播点”。`,
      "讨论钩子：你会把它做成战术复盘、人设叙事，还是争议解释？"
    ],
    xiaohongshu: [
      `标题：${topic.title}，看球新手也能懂的3个重点`,
      "卡片：发生了什么 / 为什么会热 / 和比赛有什么关系 / 可以怎么表达 / 发布前避坑。",
      "收藏理由：这套结构可以复用到其他赛后热点。"
    ],
    shortVideo: [
      `前三秒：今天这个热点，不只是热闹，它能帮你重新看懂${matchLabel}。`,
      "分镜：热点词条截图 / 比分卡 / 关键事件 / 一句话观点 / 评论区提问。",
      "节奏：15秒讲发生了什么，30秒讲为什么值得做，60秒补充数据和风险。"
    ],
    risk: [
      riskLine,
      "发布建议：先确认来源，再把绝对判断改成可核实表达。",
      "适合平台：微博承接讨论，B站做复盘，小红书做解释卡片，短视频做前置信号。"
    ]
  });
}

export function packageLabel(key: string) {
  const labels: Record<string, string> = {
    bilibili: "B站选题",
    weibo: "微博话题",
    xiaohongshu: "小红书标题",
    shortVideo: "短视频方向",
    risk: "风险提醒"
  };
  return labels[key] ?? key;
}
