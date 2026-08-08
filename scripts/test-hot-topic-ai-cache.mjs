import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const sourcePath = new URL("../lib/services/hotTopicAiCache.ts", import.meta.url);
assert.ok(existsSync(sourcePath), "hot topic AI cache service should exist");

const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const outDir = join(tmpdir(), "worldcup-copilot-hot-topic-ai-cache-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const modulePath = join(outDir, "hotTopicAiCache.mjs");
writeFileSync(modulePath, compiled, "utf8");

const {
  HOT_TOPIC_AI_CACHE_TTL_MS,
  readHotTopicAiCache,
  writeHotTopicAiCache
} = await import(`file:///${modulePath.replaceAll("\\", "/")}`);

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const topic = {
  id: "hot-2026-final",
  title: "决赛最后十分钟发生了什么",
  summary: "决赛末段连续出现关键事件。",
  heat: 880000,
  platform: "微博",
  source: "今日热榜",
  valueScore: 86,
  relevanceScore: 92,
  tags: ["世界杯", "决赛"],
  updatedAt: "2026-08-08T15:24:00+08:00"
};
const payload = {
  sourceStatus: "live",
  intro: "这条热点适合从决赛节奏变化切入。",
  analysis: {
    overview: [],
    production: [],
    whyCare: [],
    angles: [],
    factsToVerify: [],
    risks: []
  }
};
const storage = new MemoryStorage();
const savedAt = 1_000;

writeHotTopicAiCache(storage, topic, payload, savedAt);
assert.deepEqual(readHotTopicAiCache(storage, topic, savedAt + 1), payload);
assert.equal(readHotTopicAiCache(storage, { ...topic, heat: 990000 }, savedAt + 1), null);

writeHotTopicAiCache(storage, topic, payload, savedAt);
assert.equal(readHotTopicAiCache(storage, topic, savedAt + HOT_TOPIC_AI_CACHE_TTL_MS + 1), null);

writeHotTopicAiCache(storage, topic, { ...payload, sourceStatus: "fallback" }, savedAt);
assert.equal(readHotTopicAiCache(storage, topic, savedAt + 1), null);

const pageSource = readFileSync(new URL("../app/hot-topics/[id]/page.tsx", import.meta.url), "utf8");
assert.match(pageSource, /readHotTopicAiCache/);
assert.match(pageSource, /writeHotTopicAiCache/);
assert.match(pageSource, /if \(cachedAnalysis\) \{[\s\S]*setAnalysisStatus\("cache"\)[\s\S]*return/);
assert.match(pageSource, /const currentDeepseekKey = getStoredDeepseekKey\(\)/);
assert.match(pageSource, /\}, \[topic, fallbackAnalysis, fallbackIntro\]\);/);
assert.match(pageSource, /JSON\.stringify\(current\) === JSON\.stringify\(snapshot\.topic\)/);

console.log("hot topic AI cache ok");
