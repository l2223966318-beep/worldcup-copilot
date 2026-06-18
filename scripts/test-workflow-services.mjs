import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const files = [
  "types/workflow.ts",
  "lib/ai/quality.ts",
  "lib/services/analysisService.ts",
  "lib/services/contentService.ts",
  "lib/services/exportService.ts"
];

const outDir = join(tmpdir(), "worldcup-copilot-workflow-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, "types"), { recursive: true });
mkdirSync(join(outDir, "lib/ai"), { recursive: true });
mkdirSync(join(outDir, "lib/services"), { recursive: true });

for (const file of files) {
  const sourcePath = new URL(`../${file}`, import.meta.url);
  const source = readFileSync(sourcePath, "utf8")
    .replaceAll("@/types/workflow", "../../types/workflow.mjs")
    .replaceAll("@/lib/services/contentService", "./contentService.mjs")
    .replaceAll("@/lib/ai/quality", "../ai/quality.mjs");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  writeFileSync(join(outDir, file.replace(".ts", ".mjs")), compiled, "utf8");
}

const { createRuleBasedAnalysis } = await import(`file:///${join(outDir, "lib/services/analysisService.mjs").replaceAll("\\", "/")}`);
const { createPlatformDraft, supportedPlatforms } = await import(`file:///${join(outDir, "lib/services/contentService.mjs").replaceAll("\\", "/")}`);
const { createContentPackage, createPackageMarkdown } = await import(`file:///${join(outDir, "lib/services/exportService.mjs").replaceAll("\\", "/")}`);

const matchContext = {
  id: "match-1",
  matchInfo: {
    id: "match-1",
    name: "美国 vs 巴拉圭",
    teamA: "美国",
    teamB: "巴拉圭",
    score: "4-1",
    stage: "Group Stage",
    time: "2026-06-15",
    sourceStatus: "live"
  },
  keyEvents: [{ minute: "4'", team: "巴拉圭", type: "乌龙球", description: "D. Bobadilla own goal" }],
  keyPlayers: [{ name: "美国前锋", team: "美国", role: "前锋", rating: 8.1 }],
  stats: {
    teamA: { possession: 57, shots: 14, shotsOnTarget: 7, corners: 5, fouls: 10, yellowCards: 1, xg: 2.2 },
    teamB: { possession: 43, shots: 7, shotsOnTarget: 2, corners: 2, fouls: 14, yellowCards: 3, xg: 0.8 }
  },
  hotSignals: [{ label: "开场乌龙球", topicSeed: "乌龙球如何改变比赛走势", contentValue: 92 }],
  summary: "美国队大胜，开场乌龙球成为传播热点。"
};

const topic = {
  id: "topic-1",
  title: "乌龙球如何改变美国队比赛走势",
  category: "数据向选题",
  coreAngle: "从场上突发事件解释比赛走势",
  reason: "热点事件和比分走势同时成立",
  riskLevel: "低",
  recommendedFormat: "短视频口播 + 微博讨论"
};

const analysis = createRuleBasedAnalysis(matchContext);
assert.equal(analysis.matchId, "match-1");
assert.ok(analysis.turningPoints.some((item) => item.includes("乌龙球")));

const douyin = createPlatformDraft("douyin", matchContext, topic, analysis);
const bilibili = createPlatformDraft("bilibili", matchContext, topic, analysis);
assert.equal(supportedPlatforms.includes("douyin"), true);
assert.notEqual(douyin.body, bilibili.body);
assert.ok(douyin.body.includes("可直接发布版"));

const pkg = createContentPackage({
  matchContext,
  analysis,
  selectedTopic: topic,
  platformDraft: douyin,
  reviewResult: { level: "低", score: 18, findings: [], advice: "可发布" }
});
assert.equal(pkg.matchInfo.name, "美国 vs 巴拉圭");
assert.equal(pkg.platformDraft.platform, "douyin");
assert.ok(createPackageMarkdown(pkg).includes("可直接发布版"));

console.log("workflow services ok");
