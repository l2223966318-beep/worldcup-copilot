import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const sourcePath = new URL("../lib/services/matchDetailPresentation.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const outDir = join(tmpdir(), "worldcup-copilot-match-detail-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const modulePath = join(outDir, "matchDetailPresentation.mjs");
writeFileSync(modulePath, compiled, "utf8");

const {
  buildDraftReviewFlow,
  buildMatchHotspotShortlist,
  buildTeamRadarData,
  mergeHotSearchPayloads,
  summarizeHotspotSources
} = await import(`file:///${modulePath.replaceAll("\\", "/")}`);

const match = {
  id: "usa-paraguay",
  isExample: false,
  name: "美国 vs 巴拉圭",
  stage: "小组赛",
  time: "2026-06-15 08:00",
  teamA: "美国",
  teamB: "巴拉圭",
  score: "4-1",
  summary: "美国队通过开场乌龙球和高效射正拉开比分。",
  stats: {
    teamA: { possession: 57, shots: 14, shotsOnTarget: 7, corners: 5, fouls: 10, yellowCards: 1 },
    teamB: { possession: 43, shots: 7, shotsOnTarget: 2, corners: 2, fouls: 14, yellowCards: 3 }
  },
  keyPlayers: [],
  keyEvents: [
    { minute: "4'", team: "巴拉圭", type: "进球", description: "D. Bobadilla own goal，巴拉圭后卫乌龙球。" },
    { minute: "62'", team: "美国", type: "进球", description: "美国队扩大比分。" }
  ],
  historicalMeetings: []
};

const radar = buildTeamRadarData(match);
assert.deepEqual(radar.map((item) => item.metric), ["控球", "射门", "射正", "角球", "纪律"]);
assert.ok(radar.every((item) => typeof item[match.teamA] === "number" && typeof item[match.teamB] === "number"));
assert.ok(radar.find((item) => item.metric === "射正")[match.teamA] > radar.find((item) => item.metric === "射正")[match.teamB]);

const hotspots = buildMatchHotspotShortlist({
  match,
  signals: [
    {
      id: "signal-own-goal",
      label: "乌龙球",
      minute: "4'",
      team: "巴拉圭",
      evidence: "巴拉圭后卫乌龙球",
      topicSeed: "乌龙球如何改变美国 vs 巴拉圭的传播节奏？",
      contentValue: 94,
      riskLevel: "低",
      recommendedPlatforms: ["抖音", "微博"],
      contentFormats: ["短视频脚本"],
      angleHints: ["转折明确"]
    }
  ],
  hotItems: [
    {
      id: "general",
      title: "世界杯开幕式嘉宾阵容",
      summary: "泛世界杯热点",
      source: "微博",
      platform: "微博",
      relevance: 45,
      valueScore: 80,
      heat: "300万",
      tags: ["世界杯"]
    },
    {
      id: "match-hot",
      title: "美国队4比1巴拉圭 乌龙球",
      summary: "美国队凭借开场乌龙球建立优势",
      source: "抖音",
      platform: "抖音",
      relevance: 82,
      valueScore: 88,
      heat: "520万",
      tags: ["美国", "巴拉圭", "乌龙球"]
    },
    {
      id: "match-weibo",
      title: "美国队4比1巴拉圭赛后讨论",
      summary: "双方比赛结束后引发球迷讨论",
      source: "微博",
      platform: "微博",
      relevance: 84,
      valueScore: 86,
      heat: "480万",
      tags: ["美国", "巴拉圭"]
    },
    {
      id: "match-redfox",
      title: "D. Bobadilla乌龙球成为比赛转折",
      summary: "小红书创作者讨论这次关键事件",
      source: "RedFox 小红书每日爆款笔记",
      platform: "小红书",
      relevance: 82,
      valueScore: 84,
      tags: ["D. Bobadilla", "乌龙球"]
    }
  ],
  limit: 4
});
assert.equal(hotspots[0].title, "美国队4比1巴拉圭 乌龙球");
assert.ok(hotspots[0].heatScore > hotspots[1].heatScore);
assert.ok(hotspots.every((item) =>
  item.matchReason === "当前对阵场外讨论" ||
  item.matchReason === "本场球员场外热议" ||
  item.source === "场上事件"
));
assert.deepEqual(
  new Set(hotspots.map((item) => item.platform)),
  new Set(["抖音", "微博", "小红书", "抖音 / 微博"])
);
assert.ok(hotspots.some((item) => item.id === "match-redfox" && item.matchReason === "本场球员场外热议"));
assert.equal(summarizeHotspotSources(hotspots), "抖音、场上事件、微博、小红书");
const onFieldHotspot = hotspots.find((item) => item.source === "场上事件");
assert.ok(onFieldHotspot.title.includes("4'"));
assert.ok(onFieldHotspot.title.includes("乌龙球"));
assert.ok(!onFieldHotspot.title.includes("如何改变"));

const narrowMatch = {
  ...match,
  id: "portugal-congo",
  name: "世界杯：葡萄牙 vs 刚果（金）",
  teamA: "葡萄牙",
  teamB: "刚果（金）",
  score: "vs",
  keyEvents: [
    { minute: "90+1'", team: "葡萄牙", type: "关键扑救", description: "补时阶段出现关键扑救。" }
  ]
};
const narrowHotspots = buildMatchHotspotShortlist({
  match: narrowMatch,
  signals: [],
  hotItems: [
    {
      id: "generic-world-cup",
      title: "世界杯今日赛程热议",
      summary: "泛世界杯热点，没有出现当前对阵双方。",
      url: "",
      source: "UApiPro",
      platform: "微博",
      relevance: 80,
      valueScore: 85,
      heat: "900万",
      tags: ["世界杯"]
    },
    {
      id: "fixture-match",
      title: "葡萄牙vs刚果 世界杯小组赛前瞻",
      summary: "当前对阵相关热点。",
      url: "",
      source: "UApiPro",
      platform: "抖音",
      relevance: 88,
      valueScore: 90,
      heat: "500万",
      tags: ["葡萄牙", "刚果"]
    }
  ]
});
assert.equal(narrowHotspots.length, 1);
assert.equal(narrowHotspots[0].id, "fixture-match");
assert.equal(narrowHotspots[0].matchReason, "当前对阵场外讨论");

const mergedPayload = mergeHotSearchPayloads([
  {
    sourceStatus: "live",
    lastUpdated: "2026-06-18T01:00:00.000Z",
    message: "UApiPro 已返回热榜",
    data: [
      {
        id: "uapi-1",
        title: "美国队4比1巴拉圭登上抖音热榜",
        summary: "来自 UApiPro 的热点",
        url: "https://example.com/uapi",
        source: "UApiPro",
        platform: "抖音",
        relevance: 90,
        valueScore: 92,
        heat: "800万",
        tags: ["美国", "巴拉圭"]
      }
    ]
  },
  {
    sourceStatus: "partial",
    lastUpdated: "2026-06-18T01:01:00.000Z",
    message: "榜眼数据没有返回匹配热点",
    data: [
      {
        id: "search-1",
        title: "美国队4比1巴拉圭登上抖音热榜",
        summary: "重复热点",
        url: "https://example.com/uapi",
        source: "榜眼数据",
        platform: "全网搜索",
        relevance: 70,
        valueScore: 70,
        heat: "100万",
        tags: ["美国", "巴拉圭"]
      },
      {
        id: "search-2",
        title: "世界杯小组赛赛后讨论",
        summary: "另一个搜索热点",
        url: "",
        source: "全网搜索",
        platform: "全网搜索",
        relevance: 50,
        valueScore: 55,
        tags: ["世界杯"]
      }
    ]
  }
]);
assert.equal(mergedPayload.sourceStatus, "live");
assert.equal(mergedPayload.data.length, 2);
assert.equal(mergedPayload.data[0].source, "UApiPro");
assert.ok(mergedPayload.message.includes("UApiPro"));

const review = buildDraftReviewFlow(
  "美国队这场彻底打爆巴拉圭，巴拉圭后卫乌龙就是灾难。",
  match
);
assert.equal(review.result.advice, "修改后发布");
assert.ok(review.riskPoints.some((item) => item.includes("引战表达")));
assert.ok(review.rewriteSuggestion.includes("引发讨论"));
assert.ok(!review.rewriteSuggestion.includes("打爆"));

console.log("match detail presentation ok");
