import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const sourcePath = new URL("../lib/ai/signals.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const outDir = join(tmpdir(), "worldcup-copilot-signals-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const modulePath = join(outDir, "signals.mjs");
writeFileSync(modulePath, compiled, "utf8");

const { extractMatchSignals } = await import(`file:///${modulePath.replaceAll("\\", "/")}`);

const match = {
  id: "korea-czech-hotspot",
  isExample: false,
  name: "韩国 vs 捷克",
  stage: "小组赛",
  time: "2026-06-14",
  teamA: "韩国",
  teamB: "捷克",
  score: "2-1",
  summary: "捷克球员球衣被拉扯破，引发大量讨论。韩国队还制造一次乌龙球。",
  stats: {
    teamA: { possession: 51, shots: 10, shotsOnTarget: 5, corners: 4, fouls: 12, yellowCards: 1, xg: 1.4 },
    teamB: { possession: 49, shots: 9, shotsOnTarget: 3, corners: 3, fouls: 14, yellowCards: 2, xg: 1.0 }
  },
  keyPlayers: [],
  keyEvents: [
    { minute: "18'", team: "捷克", type: "争议", description: "捷克球员球衣被扯破，裁判没有第一时间中断比赛。" },
    { minute: "37'", team: "韩国", type: "进球", description: "韩国队传中造成捷克后卫乌龙球。" },
    { minute: "60'", team: "韩国", type: "进球", description: "韩国队扩大比分。" }
  ],
  historicalMeetings: []
};

const signals = extractMatchSignals(match);

assert.equal(signals[0].type, "wardrobe-incident");
assert.equal(signals[0].priority, "primary");
assert.ok(signals[0].topicSeed.includes("球衣被扯破"));
assert.ok(signals.some((signal) => signal.type === "own-goal" && signal.priority === "primary"));
assert.ok(signals.find((signal) => signal.type === "own-goal").recommendedPlatforms.includes("短视频"));
assert.ok(signals[0].contentValue > signals.at(-1).contentValue);

console.log(`signals ok: ${signals.map((signal) => signal.type).join(", ")}`);
