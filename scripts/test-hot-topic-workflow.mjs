import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

const files = ["lib/ai/quality.ts", "lib/hot/hotTopicWorkflow.ts"];
const outDir = join(tmpdir(), "worldcup-copilot-hot-topic-workflow-test");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });

for (const file of files) {
  const sourcePath = new URL(`../${file}`, import.meta.url);
  const source = readFileSync(sourcePath, "utf8").replaceAll("@/lib/ai/quality", "../ai/quality.mjs");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  const targetPath = join(outDir, file.replace(".ts", ".mjs"));
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, compiled, "utf8");
}

const { auditHotDraft, generateHotDraft } = await import(`file:///${join(outDir, "lib/hot/hotTopicWorkflow.mjs").replaceAll("\\", "/")}`);

const topic = {
  id: "hot-1",
  title: "C罗是否不该在世界杯首发了",
  summary: "热榜讨论，不代表官方结论。",
  source: "UApiPro",
  platform: "微博",
  valueScore: 76,
  tags: ["世界杯"]
};

const safeDraft = [
  "开头15秒：今天这个热点先别急着站队，我们先确认能确定的事实，再看它为什么会影响世界杯内容传播。",
  "分镜1：热搜词条/来源截图，字幕：先确认它在被讨论。",
  "发布前需人工核验来源，避免把讨论写成定论。"
].join("\n");
const safeAudit = auditHotDraft(safeDraft, topic, "抖音");
assert.equal(safeAudit.level, "pass");
assert.deepEqual(safeAudit.authenticity, []);
assert.deepEqual(safeAudit.risk, []);
assert.deepEqual(safeAudit.ethics, []);
assert.deepEqual(safeAudit.suggestions, []);
assert.equal(safeAudit.rewriteSuggestion, safeDraft);

const safeTitleAudit = auditHotDraft("1. C罗首发讨论，焦点不只一个", topic, "B站", "标题");
assert.equal(safeTitleAudit.level, "pass");
assert.deepEqual(safeTitleAudit.platformFit, []);

const riskyAudit = auditHotDraft("官方证实他已经确认伤退，这事已经实锤。", topic, "微博");
assert.notEqual(riskyAudit.level, "pass");
assert.ok(riskyAudit.authenticity.some((item) => item.includes("确定性表述")));
assert.ok(riskyAudit.risk.some((item) => item.includes("确认伤退")));
assert.ok(!riskyAudit.suggestions.some((item) => item === "补充来源链接或注明“需人工核验”。"));

const topicDraft = generateHotDraft(topic, {
  platform: "B站",
  contentType: "选题",
  tone: "轻松整活",
  length: "中",
  useMatchFacts: false,
  includeRiskReminder: false
});
assert.equal((topicDraft.match(/^\d+\./gm) ?? []).length, 5);
assert.ok(topicDraft.includes("怎么做："));
assert.ok(topicDraft.includes("说明："));
assert.ok(topicDraft.includes("动漫二创"));
assert.ok(topicDraft.includes("游戏二创"));
assert.ok(!topicDraft.includes("开头15秒"));

const pageSource = readFileSync(new URL("../app/hot-topics/[id]/page.tsx", import.meta.url), "utf8");
assert.match(pageSource, /label="生成类型"/);
assert.match(pageSource, /label="风格类型"/);
assert.doesNotMatch(pageSource, /label="内容类型"/);
assert.match(pageSource, /function updateConfig[\s\S]*setDraft\(""\)[\s\S]*setAudit\(null\)/);
assert.match(pageSource, /audit\.level !== "pass" \? \(/);

const routeSource = readFileSync(new URL("../app/api/ai/hot-topic-workflow/route.ts", import.meta.url), "utf8");
assert.match(routeSource, /contentTypeInstruction\(config\)/);
assert.match(routeSource, /styleInstruction\(config\)/);
assert.match(routeSource, /normalizeGeneratedDraft\(result\.data\.draft, fallbackDraft, config\)/);
assert.match(routeSource, /topicNumbers\.length !== 5/);
assert.match(routeSource, /没有具体问题时对应数组返回空数组/);
assert.doesNotMatch(routeSource, /信息不足时必须写“需核实”/);

console.log("hot topic workflow ok");
