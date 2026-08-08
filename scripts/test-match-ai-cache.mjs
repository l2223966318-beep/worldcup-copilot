import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const sourcePath = new URL("../lib/services/matchAiCache.ts", import.meta.url);
assert.ok(existsSync(sourcePath), "match AI cache service should exist");

const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const outDir = join(tmpdir(), "worldcup-copilot-match-ai-cache-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const modulePath = join(outDir, "matchAiCache.mjs");
writeFileSync(modulePath, compiled, "utf8");

const {
  MATCH_AI_WORKFLOW_CACHE_TTL_MS,
  readMatchAiWorkflowCache,
  writeMatchAiWorkflowCache
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

const match = {
  id: "final-2026",
  isExample: false,
  name: "西班牙 vs 阿根廷",
  stage: "决赛",
  time: "2026-07-20 03:00",
  teamA: "西班牙",
  teamB: "阿根廷",
  score: "1-0",
  keyPlayers: [],
  keyEvents: [{ minute: "85'", team: "西班牙", type: "射门", description: "射门偏出" }],
  summary: "决赛复盘",
  stats: {
    teamA: { possession: 55, shots: 10, shotsOnTarget: 4, corners: 4, fouls: 8, yellowCards: 1 },
    teamB: { possession: 45, shots: 8, shotsOnTarget: 3, corners: 3, fouls: 10, yellowCards: 2 }
  },
  historicalMeetings: []
};
const topics = [{ id: "topic-1", title: "决赛关键转折" }];
const payload = { sourceStatus: "live", model: "deepseek-v4-flash", conclusions: [], topics: [] };
const storage = new MemoryStorage();
const savedAt = 1_000;

writeMatchAiWorkflowCache(storage, match, topics, payload, savedAt);
assert.deepEqual(readMatchAiWorkflowCache(storage, match, topics, savedAt + 1), payload);
assert.equal(readMatchAiWorkflowCache(storage, { ...match, score: "2-0" }, topics, savedAt + 1), null);

writeMatchAiWorkflowCache(storage, match, topics, payload, savedAt);
assert.equal(readMatchAiWorkflowCache(storage, match, topics, savedAt + MATCH_AI_WORKFLOW_CACHE_TTL_MS + 1), null);

writeMatchAiWorkflowCache(storage, match, topics, { ...payload, sourceStatus: "error" }, savedAt);
assert.equal(readMatchAiWorkflowCache(storage, match, topics, savedAt + 1), null);

const pageSource = readFileSync(new URL("../app/matches/[id]/page.tsx", import.meta.url), "utf8");
assert.match(pageSource, /readMatchAiWorkflowCache/);
assert.match(pageSource, /writeMatchAiWorkflowCache/);
assert.match(pageSource, /if \(cachedEnhancement\) \{[\s\S]*setAiEnhancement\(cachedEnhancement\)[\s\S]*return/);
assert.match(pageSource, /if \(loading && !payload\) return/);

console.log("match AI cache ok");
