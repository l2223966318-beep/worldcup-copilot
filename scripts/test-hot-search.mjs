import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const sourcePath = new URL("../lib/hot/normalizers.ts", import.meta.url);
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const outDir = join(tmpdir(), "worldcup-copilot-hot-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const modulePath = join(outDir, "normalizers.mjs");
writeFileSync(modulePath, compiled, "utf8");

const { mergeHotItems, normalizeDailyHotPayload, normalizeTavilyPayload, normalizeTopHubDataPayload } = await import(`file:///${modulePath.replaceAll("\\", "/")}`);

const dailyHotItems = normalizeDailyHotPayload(
  {
    code: 200,
    title: "微博热搜",
    data: [
      { title: "美国队乌龙球引发讨论", hot: "120万", url: "https://example.com/a" },
      { title: "韩国球员球衣被扯破", desc: "场上热点瞬间", mobileUrl: "https://example.com/b" }
    ],
    updateTime: "2026-06-15 10:00:00"
  },
  { platform: "微博", source: "dailyhot-weibo", query: "世界杯" }
);

const tavilyItems = normalizeTavilyPayload(
  {
    results: [
      {
        title: "USMNT own goal talking points",
        content: "The own goal became one of the most discussed moments.",
        url: "https://example.com/a",
        score: 0.92
      },
      {
        title: "World Cup tactical notes",
        content: "A slower analysis item.",
        url: "https://example.com/c",
        score: 0.44
      }
    ]
  },
  { query: "United States Paraguay own goal" }
);

assert.equal(dailyHotItems.length, 2);
assert.equal(dailyHotItems[0].platform, "微博");
assert.equal(dailyHotItems[0].source, "dailyhot-weibo");
assert.ok(dailyHotItems[0].tags.includes("乌龙球"));
assert.equal(tavilyItems[0].source, "tavily");
assert.ok(tavilyItems[0].relevance > tavilyItems[1].relevance);

const merged = mergeHotItems([...dailyHotItems, ...tavilyItems]);

assert.equal(merged.length, 3);
assert.equal(merged[0].url, "https://example.com/a");
assert.ok(merged[0].relevance >= 90);

const recursivePayload = {};
recursivePayload.data = recursivePayload;
assert.deepEqual(normalizeTopHubDataPayload(recursivePayload, { query: "世界杯" }), []);

console.log(`hot search ok: ${merged.map((item) => item.source).join(", ")}`);
